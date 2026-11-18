import express from "express";
import { Pool } from 'pg';
import cors from "cors";
import "dotenv/config";
import routeurSante from "./commun/routes/sante.routes";
import { verifierConnexionBdd, verifierPostgis, ErreurBaseDeDonnees } from "./configuration/baseDeDonnees";
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
// KBE-27 : routes publiques des lignes et des arrêts.
import routeurTransport from "./transport/transport.routes";


const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

app.use("/api/sante", routeurSante);
// KBE-27 : enregistrement des routes publiques
// pour consulter les lignes et les arrêts.
app.use("/api", routeurTransport);
// Route de vérification du serveur
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const verifierToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ erreur: "Token manquant ou invalide." });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    req.utilisateur = decoded;
    next(); 
  } catch (error) {
    return res.status(401).json({ erreur: "Token expiré ou invalide." });
  }
};

app.post('/api/inscription', async (req, res) => {
  const client = await pool.connect(); 
  try {
    const { pseudo, email, motDePasse } = req.body;

    if (!motDePasse || motDePasse.length < 8) {
      return res.status(400).json({ error: "Le mot de passe doit faire au moins 8 caractères." });
    }
    
    const hash = await argon2.hash(motDePasse, {
      type: argon2.argon2id,
    });
    await client.query('BEGIN');

    const identifiantPublic = `user_${Date.now()}`;
    const requeteCompte = `
      INSERT INTO comptes (email, mot_de_passe_hash, identifiant_public, role_id, etat) 
      VALUES ($1, $2, $3, (SELECT id FROM roles WHERE code = 'voyageur'), 'actif') 
      RETURNING id
    `;
    const resultatCompte = await client.query(requeteCompte, [email, hash, identifiantPublic]);
    const compteId = resultatCompte.rows[0].id;
    const requeteVoyageur = `
      INSERT INTO voyageurs (compte_id, pseudo) 
      VALUES ($1, $2) 
      RETURNING compte_id, pseudo
    `;
    const resultatVoyageur = await client.query(requeteVoyageur, [compteId, pseudo]);

    await client.query('COMMIT');

    res.status(201).json({ 
      success: true, 
      message: "Compte créé !", 
      data: {
        id: compteId,
        email: email,
        pseudo: resultatVoyageur.rows[0].pseudo
      } 
    });
  } catch (error: any) {
    await client.query('ROLLBACK');

    if (error.code === '23505') {
      return res.status(409).json({ error: "Cet email ou ce pseudo est déjà utilisé." });
    }
    console.error(error);
    res.status(500).json({ error: "Erreur lors de la création du compte." });
  } finally {
    client.release();
  }
});

app.post('/api/connexion', async (req, res) => {
  try {
    const { identifiant, motDePasse } = req.body;
    const requete = `
      SELECT c.id, c.email, c.mot_de_passe_hash, c.etat, v.pseudo
      FROM comptes c LEFT JOIN voyageurs v ON v.compte_id = c.id
      WHERE c.email = $1 OR v.pseudo = $1
    `;
    const resultat = await pool.query(requete, [identifiant]);
    if (resultat.rows.length === 0) return res.status(401).json({ erreur: "Identifiants invalides." });

    const compte = resultat.rows[0];
    if (compte.etat !== 'actif') return res.status(403).json({ erreur: "Compte inactif." });

    const motDePasseValide = await argon2.verify(compte.mot_de_passe_hash, motDePasse);
    if (!motDePasseValide) return res.status(401).json({ erreur: "Identifiants invalides." });

    const token = jwt.sign(
      { id: compte.id, role_id: compte.role_id, pseudo: compte.pseudo },
      process.env.JWT_SECRET as string,
      { expiresIn: '24h' }
    );

    res.status(200).json({ message: "Connexion réussie.", token: token, utilisateur: { id: compte.id, pseudo: compte.pseudo } });
  } catch (error: any) {
    console.error("ERREUR DE CONNEXION :", error.message);
    res.status(500).json({ erreur: "Erreur serveur." });
  }
});

app.put('/api/utilisateurs/moi', verifierToken, async (req: any, res: any) => {
  const client = await pool.connect();
  try {
    const { pseudo, email } = req.body;
    const compteId = req.utilisateur.id; 

    await client.query('BEGIN');

    // 1. Mise à jour de l'email dans 'comptes'
    if (email) {
      await client.query('UPDATE comptes SET email = $1, modifie_le = now() WHERE id = $2', [email, compteId]);
    }

    // 2. Mise à jour du pseudo dans 'voyageurs'
    if (pseudo) {
      await client.query('UPDATE voyageurs SET pseudo = $1, modifie_le = now() WHERE compte_id = $2', [pseudo, compteId]);
    }

    await client.query('COMMIT');
    res.json({ message: "Profil mis à jour avec succès." });

  } catch (error: any) {
    await client.query('ROLLBACK');
    if (error.code === '23505') return res.status(409).json({ erreur: "Cet email ou pseudo est déjà pris." });
    res.status(500).json({ erreur: "Erreur lors de la mise à jour." });
  } finally {
    client.release();
  }
});

app.delete('/api/utilisateurs/moi', verifierToken, async (req: any, res: any) => {
  const client = await pool.connect();
  try {
    const compteId = req.utilisateur.id;

    await client.query('BEGIN');
    
    await client.query('DELETE FROM voyageurs WHERE compte_id = $1', [compteId]);
    await client.query('DELETE FROM comptes WHERE id = $1', [compteId]);

    await client.query('COMMIT');
    res.json({ message: "Compte supprimé avec succès." });

  } catch (error: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ erreur: "Erreur lors de la suppression du compte." });
  } finally {
    client.release();
  }
});

app.get("/", (req, res) => {
  res.json({
    message: "Bienvenue sur l'API KotBis",
    status: "OK"
  });
});

// Démarrage du serveur
app.listen(PORT, async () => {
  console.log(`Serveur KotBis démarré sur le port ${PORT}`);

  // Vérification de la connexion PostgreSQL ; aucun secret n'est affiché en cas d'échec
  try {
    await verifierConnexionBdd();
    console.log("[BDD] Connexion PostgreSQL réussie");
    const versionPostgis = await verifierPostgis();
    console.log(`[BDD] PostGIS disponible (version ${versionPostgis})`);
  } catch (erreur) {
    if (erreur instanceof ErreurBaseDeDonnees) {
      console.error(`[BDD] ${erreur.message} (code : ${erreur.code ?? "inconnu"})`);
    } else {
      console.error(`[BDD] ${(erreur as Error).message}`);
    }
  }
});
