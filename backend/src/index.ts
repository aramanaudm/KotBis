import express from "express";
import { Pool } from 'pg';
import cors from "cors";
import "dotenv/config";
import { verifierConnexionBdd, verifierPostgis, ErreurBaseDeDonnees } from "./configuration/baseDeDonnees";
import argon2 from 'argon2';
import { insert, update, remove, Requete } from './commun/crud-reflect'; 
import { administrationRoutes } from './administration';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.use('/api/admin', administrationRoutes(pool));

function adapterRequete(requete: Requete) {
  let index = 1;
  const sqlPostgres = requete.sql.replace(/\?/g, () => `$${index++}`);
  return { sql: sqlPostgres, params: requete.params };
}

class Utilisateur {
  static table = 'comptes';
  static primaryKey = 'id';
  static transient = ['motDePasseClair']; 

  constructor(
    public id: number | null, 
    public pseudo: string,
    public email: string,
    public motDePasse: string,
    public motDePasseClair?: string 
  ) {}
}

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

// 2. UPDATE (Modification du profil)
app.put('/api/test/comptes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { pseudo, email } = req.body;
    
    const userExistant = await pool.query('SELECT mot_de_passe FROM utilisateurs WHERE id = $1', [id]);
    if (userExistant.rowCount === 0) return res.status(404).json({ error: "Utilisateur non trouvé" });
    
    const hashActuel = userExistant.rows[0].mot_de_passe;

    const utilisateurAModifier = new Utilisateur(Number(id), pseudo, email, hashActuel);
    
    const requeteGeneree = update(utilisateurAModifier);
    const { sql, params } = adapterRequete(requeteGeneree);

    const resultat = await pool.query(sql, params);
    
    const userModifie = resultat.rows[0];
    delete userModifie.mot_de_passe;

    res.json({ success: true, message: "Profil mis à jour !", data: userModifie });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. DELETE (Suppression de compte)
app.delete('/api/test/comptes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const utilisateurASupprimer = new Utilisateur(Number(id), "", "", "");
    
    const requeteGeneree = remove(utilisateurASupprimer);
    const { sql, params } = adapterRequete(requeteGeneree);

    const resultat = await pool.query(sql, params);
    if (resultat.rowCount === 0) return res.status(404).json({ error: "Utilisateur non trouvé" });

    res.json({ success: true, message: `Compte ${id} supprimé` });
  } catch (error: any) {
    if (error.code === '23503') {
      return res.status(409).json({ error: "Impossible de supprimer : ce compte possède des données liées." });
    }
    res.status(500).json({ error: error.message });
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
