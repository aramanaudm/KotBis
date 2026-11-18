import express from "express";
import { Pool } from 'pg';
import cors from "cors";
import "dotenv/config";
import routeurSante from "./commun/routes/sante.routes";
import { verifierConnexionBdd, verifierPostgis, ErreurBaseDeDonnees } from "./configuration/baseDeDonnees";
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

app.use("/api/sante", routeurSante);

// Route de vérification du serveur
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const SELECT_UTILISATEUR = `
  SELECT c.id, c.email, c.role_id, c.etat, c.identifiant_public, c.telephone, c.cree_le,
         c.mot_de_passe_hash,
         COALESCE(v.pseudo, p.nom_affiche, c.identifiant_public) AS pseudo,
         v.zone_libre AS city,
         r.code AS role
  FROM comptes c
  LEFT JOIN voyageurs v ON v.compte_id = c.id
  LEFT JOIN personnel p ON p.compte_id = c.id
  LEFT JOIN roles r ON r.id = c.role_id
`;

function jetonPour(compte: any): string {
  return jwt.sign(
    { id: compte.id, role_id: compte.role_id, role: compte.role, pseudo: compte.pseudo },
    process.env.JWT_SECRET as string,
    { expiresIn: '24h' },
  );
}

function utilisateurPublic(compte: any): any {
  return {
    id: String(compte.id),
    email: compte.email,
    pseudo: compte.pseudo,
    city: compte.city ?? undefined,
    phone: compte.telephone ?? undefined,
    role: compte.role ?? undefined,
    createdAt: new Date(compte.cree_le).toISOString(),
    counters: { favoris: 0, alertes: 0, signalements: 0, avis: 0, points: 0 },
  };
}

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

const verifierAdmin = (req: any, res: any, next: any) => {
  verifierToken(req, res, () => {
    const role = req.utilisateur?.role;
    const roleId = Number(req.utilisateur?.role_id);
    if (role !== 'administrateur' && roleId !== 4) {
      return res.status(403).json({ erreur: "Accès réservé aux administrateurs." });
    }
    next();
  });
};

const ETATS_COMPTE = new Set(['actif', 'inactif', 'invite']);
const ROLES_VOYAGEUR = new Set(['voyageur', 'operateur', 'moderateur', 'administrateur']);
const ROLES_PERSONNEL = new Set(['operateur', 'moderateur', 'administrateur']);

const nettoyer = (valeur: unknown, longueur: number): string =>
  String(valeur ?? '')
    .trim()
    .slice(0, longueur);

const idCompte = (valeur: string): number | null => {
  const id = Number(valeur);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const identifiantPublic = (): string =>
  `u_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;

const hacherMotDePasse = async (motDePasse?: string): Promise<string> => {
  const valeur = motDePasse?.trim() || crypto.randomBytes(24).toString('hex');
  return argon2.hash(valeur, { type: argon2.argon2id });
};

const SELECT_VOYAGEUR = `
  SELECT c.id, c.email, c.etat, v.pseudo, v.zone_libre, v.avatar_ref, v.cree_le,
         r.code AS role, COALESCE(s.solde, 0) AS points
  FROM voyageurs v
  JOIN comptes c ON c.id = v.compte_id
  JOIN roles r ON r.id = c.role_id
  LEFT JOIN v_soldes_voyageurs s ON s.voyageur_id = v.compte_id
`;

const SELECT_PERSONNEL = `
  SELECT c.id, c.email, c.etat, p.nom_affiche, p.fonction, p.cree_le, r.code AS role
  FROM personnel p
  JOIN comptes c ON c.id = p.compte_id
  JOIN roles r ON r.id = c.role_id
`;

app.post('/api/inscription', async (req, res) => {
  const client = await pool.connect();
  try {
    const pseudo = String(req.body.pseudo ?? '').trim();
    const email = String(req.body.email ?? '').trim().toLowerCase();
    const motDePasse = String(req.body.motDePasse ?? req.body.password ?? '');
    const city = String(req.body.city ?? req.body.ville ?? '').trim() || null;
    const phone = String(req.body.phone ?? req.body.telephone ?? '').trim() || null;

    if (!pseudo || !email || !motDePasse) {
      return res.status(400).json({ error: "Pseudo, e-mail et mot de passe sont requis." });
    }
    if (motDePasse.length < 8) {
      return res.status(400).json({ error: "Le mot de passe doit faire au moins 8 caractères." });
    }

    const hash = await argon2.hash(motDePasse, { type: argon2.argon2id });
    await client.query('BEGIN');

    const identifiantPublic = `user_${Date.now()}`;
    const resultatCompte = await client.query(
      `INSERT INTO comptes (email, mot_de_passe_hash, identifiant_public, role_id, etat, telephone)
       VALUES ($1, $2, $3, (SELECT id FROM roles WHERE code = 'voyageur'), 'actif', $4)
       RETURNING id`,
      [email, hash, identifiantPublic, phone],
    );
    const compteId = resultatCompte.rows[0].id;
    await client.query(
      `INSERT INTO voyageurs (compte_id, pseudo, zone_libre) VALUES ($1, $2, $3)`,
      [compteId, pseudo, city],
    );
    await client.query('COMMIT');

    const profil = await pool.query(`${SELECT_UTILISATEUR} WHERE c.id = $1`, [compteId]);
    const compte = profil.rows[0];
    res.status(201).json({
      success: true,
      message: "Compte créé !",
      token: jetonPour(compte),
      utilisateur: utilisateurPublic(compte),
      data: utilisateurPublic(compte),
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
    const identifiant = String(
      req.body.identifiant ?? req.body.email ?? req.body.pseudo ?? '',
    )
      .trim()
      .toLowerCase();
    const motDePasse = String(req.body.motDePasse ?? req.body.password ?? '');
    const requete = `${SELECT_UTILISATEUR}
      WHERE lower(c.email) = $1 OR lower(COALESCE(v.pseudo, p.nom_affiche, c.identifiant_public)) = $2
      LIMIT 1`;
    const resultat = await pool.query(requete, [identifiant, identifiant]);
    if (resultat.rows.length === 0) return res.status(401).json({ erreur: "Identifiants invalides." });

    const compte = resultat.rows[0];
    if (compte.etat !== 'actif') return res.status(403).json({ erreur: "Compte inactif." });

    const motDePasseValide = await argon2.verify(compte.mot_de_passe_hash, motDePasse);
    if (!motDePasseValide) return res.status(401).json({ erreur: "Identifiants invalides." });

    res.status(200).json({
      message: "Connexion réussie.",
      token: jetonPour(compte),
      utilisateur: utilisateurPublic(compte),
    });
  } catch (error: any) {
    console.error("ERREUR DE CONNEXION :", error.message);
    res.status(500).json({ erreur: "Erreur serveur." });
  }
});

app.get('/api/utilisateurs/moi', verifierToken, async (req: any, res: any) => {
  try {
    const resultat = await pool.query(`${SELECT_UTILISATEUR} WHERE c.id = $1`, [req.utilisateur.id]);
    if (resultat.rows.length === 0) {
      return res.status(404).json({ erreur: "Compte introuvable." });
    }
    res.json({ utilisateur: utilisateurPublic(resultat.rows[0]) });
  } catch (error: any) {
    console.error("ERREUR PROFIL :", error.message);
    res.status(500).json({ erreur: "Erreur serveur." });
  }
});

app.post('/api/mot-de-passe/oublie', async (req, res) => {
  try {
    const email = String(req.body.email ?? '').trim().toLowerCase();
    const comptes = await pool.query('SELECT id FROM comptes WHERE lower(email) = $1', [email]);
    if (comptes.rows.length === 0) {
      return res.json({ message: "Si ce compte existe, un code a été généré." });
    }

    const code = String(crypto.randomInt(100000, 1000000));
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'UPDATE codes_reinitialisation SET consomme_le = now() WHERE compte_id = $1 AND consomme_le IS NULL',
        [comptes.rows[0].id],
      );
      await client.query(
        'INSERT INTO codes_reinitialisation (compte_id, code, expire_le) VALUES ($1, $2, now() + interval \'15 minutes\')',
        [comptes.rows[0].id, code],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    res.json({
      message: "Si ce compte existe, un code a été généré.",
      ...(process.env.NODE_ENV === 'production' ? {} : { devCode: code }),
    });
  } catch (error: any) {
    console.error("ERREUR RESET :", error.message);
    res.status(500).json({ erreur: "Erreur serveur." });
  }
});

app.post('/api/mot-de-passe/reinitialiser', async (req, res) => {
  try {
    const email = String(req.body.email ?? '').trim().toLowerCase();
    const code = String(req.body.code ?? '').trim();
    const nouveauMotDePasse = String(req.body.nouveauMotDePasse ?? req.body.password ?? '');
    if (nouveauMotDePasse.length < 8) {
      return res.status(400).json({ erreur: "Le mot de passe doit faire au moins 8 caractères." });
    }

    const resultat = await pool.query(
      `SELECT c.id FROM comptes c
       JOIN codes_reinitialisation r ON r.compte_id = c.id
       WHERE lower(c.email) = $1 AND r.code = $2
         AND r.consomme_le IS NULL AND r.expire_le > now()
       ORDER BY r.cree_le DESC LIMIT 1`,
      [email, code],
    );
    if (resultat.rows.length === 0) {
      return res.status(400).json({ erreur: "Code invalide ou expiré." });
    }

    const hash = await argon2.hash(nouveauMotDePasse, { type: argon2.argon2id });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'UPDATE comptes SET mot_de_passe_hash = $1, modifie_le = now() WHERE id = $2',
        [hash, resultat.rows[0].id],
      );
      await client.query(
        'UPDATE codes_reinitialisation SET consomme_le = now() WHERE compte_id = $1 AND consomme_le IS NULL',
        [resultat.rows[0].id],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    res.json({ message: "Mot de passe mis à jour." });
  } catch (error: any) {
    console.error("ERREUR RESET :", error.message);
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

app.get('/api/voyageurs', verifierAdmin, async (_req, res) => {
  try {
    const resultat = await pool.query(`${SELECT_VOYAGEUR} ORDER BY c.cree_le DESC`);
    return res.json(resultat.rows);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ erreur: "Impossible de charger les voyageurs." });
  }
});

app.post('/api/voyageurs', verifierAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const pseudo = nettoyer(req.body.pseudo, 60);
    const email = nettoyer(req.body.email, 254).toLowerCase();
    const role = nettoyer(req.body.role, 30) || 'voyageur';
    const etat = nettoyer(req.body.etat ?? req.body.status, 20) || 'actif';
    const city = nettoyer(req.body.city ?? req.body.zone_libre, 120) || null;
    const avatarRef = nettoyer(req.body.avatarRef ?? req.body.avatar_ref, 120) || null;
    const motDePasse = typeof req.body.motDePasse === 'string' ? req.body.motDePasse : '';

    if (!pseudo || !email) {
      return res.status(400).json({ erreur: "Le pseudo et l'email sont requis." });
    }
    if (!ROLES_VOYAGEUR.has(role)) {
      return res.status(400).json({ erreur: "Rôle invalide." });
    }
    if (!ETATS_COMPTE.has(etat)) {
      return res.status(400).json({ erreur: "État invalide." });
    }
    if (motDePasse.trim() && motDePasse.trim().length < 8) {
      return res.status(400).json({ erreur: "Le mot de passe doit faire au moins 8 caractères." });
    }

    const hash = await hacherMotDePasse(motDePasse);
    const invitation = motDePasse.trim() ? null : crypto.randomBytes(24).toString('hex');
    const expiration = motDePasse.trim() ? null : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await client.query('BEGIN');
    const compte = await client.query(
      `INSERT INTO comptes
         (email, mot_de_passe_hash, identifiant_public, role_id, etat, invitation_hash, invitation_expire_le)
       VALUES ($1, $2, $3, (SELECT id FROM roles WHERE code = $4), $5, $6, $7)
       RETURNING id`,
      [email, hash, identifiantPublic(), role, etat, invitation, expiration],
    );
    const id = compte.rows[0].id;
    await client.query(
      `INSERT INTO voyageurs (compte_id, pseudo, zone_libre, avatar_ref)
       VALUES ($1, $2, $3, $4)`,
      [id, pseudo, city, avatarRef],
    );
    await client.query('COMMIT');

    const ligne = await pool.query(`${SELECT_VOYAGEUR} WHERE c.id = $1`, [id]);
    return res.status(201).json(ligne.rows[0]);
  } catch (error: any) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      return res.status(409).json({ erreur: "Cet email ou ce pseudo est déjà utilisé." });
    }
    console.error(error);
    return res.status(500).json({ erreur: "Erreur lors de la création du voyageur." });
  } finally {
    client.release();
  }
});

app.put('/api/voyageurs/:id', verifierAdmin, async (req, res) => {
  const id = idCompte(req.params.id);
  if (id === null) {
    return res.status(400).json({ erreur: "Identifiant invalide." });
  }

  const client = await pool.connect();
  try {
    const pseudo = nettoyer(req.body.pseudo, 60);
    const email = nettoyer(req.body.email, 254).toLowerCase();
    const role = nettoyer(req.body.role, 30) || 'voyageur';
    const etat = nettoyer(req.body.etat ?? req.body.status, 20) || 'actif';
    const city = nettoyer(req.body.city ?? req.body.zone_libre, 120) || null;
    const avatarRef = nettoyer(req.body.avatarRef ?? req.body.avatar_ref, 120) || null;
    const motDePasse = typeof req.body.motDePasse === 'string' ? req.body.motDePasse : '';

    if (!pseudo || !email) {
      return res.status(400).json({ erreur: "Le pseudo et l'email sont requis." });
    }
    if (!ROLES_VOYAGEUR.has(role)) {
      return res.status(400).json({ erreur: "Rôle invalide." });
    }
    if (!ETATS_COMPTE.has(etat)) {
      return res.status(400).json({ erreur: "État invalide." });
    }
    if (motDePasse.trim() && motDePasse.trim().length < 8) {
      return res.status(400).json({ erreur: "Le mot de passe doit faire au moins 8 caractères." });
    }

    const existant = await client.query('SELECT mot_de_passe_hash FROM comptes WHERE id = $1', [id]);
    if (existant.rowCount === 0) {
      return res.status(404).json({ erreur: "Voyageur introuvable." });
    }

    const hash = motDePasse.trim()
      ? await hacherMotDePasse(motDePasse)
      : existant.rows[0].mot_de_passe_hash || (await hacherMotDePasse());

    await client.query('BEGIN');
    await client.query(
      `UPDATE comptes
       SET email = $1, role_id = (SELECT id FROM roles WHERE code = $2), etat = $3,
           mot_de_passe_hash = $4, modifie_le = now()
       WHERE id = $5`,
      [email, role, etat, hash, id],
    );
    await client.query(
      `UPDATE voyageurs
       SET pseudo = $1, zone_libre = $2, avatar_ref = $3, modifie_le = now()
       WHERE compte_id = $4`,
      [pseudo, city, avatarRef, id],
    );
    await client.query('COMMIT');

    const ligne = await pool.query(`${SELECT_VOYAGEUR} WHERE c.id = $1`, [id]);
    return res.json(ligne.rows[0]);
  } catch (error: any) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      return res.status(409).json({ erreur: "Cet email ou ce pseudo est déjà utilisé." });
    }
    console.error(error);
    return res.status(500).json({ erreur: "Erreur lors de la mise à jour du voyageur." });
  } finally {
    client.release();
  }
});

app.patch('/api/voyageurs/:id/etat', verifierAdmin, async (req, res) => {
  const id = idCompte(req.params.id);
  const etat = nettoyer(req.body.etat ?? req.body.status, 20);
  if (id === null || !ETATS_COMPTE.has(etat)) {
    return res.status(400).json({ erreur: "Identifiant ou état invalide." });
  }

  const client = await pool.connect();
  try {
    const existant = await client.query('SELECT mot_de_passe_hash FROM comptes WHERE id = $1', [id]);
    if (existant.rowCount === 0) {
      return res.status(404).json({ erreur: "Voyageur introuvable." });
    }
    const hash = existant.rows[0].mot_de_passe_hash || (await hacherMotDePasse());
    await client.query(
      'UPDATE comptes SET etat = $1, mot_de_passe_hash = $2, modifie_le = now() WHERE id = $3',
      [etat, hash, id],
    );
    const ligne = await pool.query(`${SELECT_VOYAGEUR} WHERE c.id = $1`, [id]);
    return res.json(ligne.rows[0]);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ erreur: "Erreur lors du changement d'état." });
  } finally {
    client.release();
  }
});

app.delete('/api/voyageurs/:id', verifierAdmin, async (req, res) => {
  const id = idCompte(req.params.id);
  if (id === null) {
    return res.status(400).json({ erreur: "Identifiant invalide." });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const profil = await client.query('SELECT 1 FROM voyageurs WHERE compte_id = $1', [id]);
    if (profil.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erreur: "Voyageur introuvable." });
    }
    await client.query('DELETE FROM sessions WHERE compte_id = $1', [id]);
    await client.query('DELETE FROM voyageurs WHERE compte_id = $1', [id]);
    await client.query('DELETE FROM comptes WHERE id = $1', [id]);
    await client.query('COMMIT');
    return res.json({ message: "Voyageur supprimé." });
  } catch (error: any) {
    await client.query('ROLLBACK');
    if (error.code === '23503') {
      return res.status(409).json({ erreur: "Ce compte est lié à d'autres données." });
    }
    console.error(error);
    return res.status(500).json({ erreur: "Erreur lors de la suppression du voyageur." });
  } finally {
    client.release();
  }
});

app.get('/api/personnel', verifierAdmin, async (_req, res) => {
  try {
    const resultat = await pool.query(`${SELECT_PERSONNEL} ORDER BY c.cree_le DESC`);
    return res.json(resultat.rows);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ erreur: "Impossible de charger le personnel." });
  }
});

app.post('/api/personnel', verifierAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const nom = nettoyer(req.body.nom_affiche ?? req.body.name, 120);
    const email = nettoyer(req.body.email, 254).toLowerCase();
    const role = nettoyer(req.body.role, 30) || 'operateur';
    const etat = nettoyer(req.body.etat ?? req.body.status, 20) || 'actif';
    const fonction = nettoyer(req.body.fonction ?? req.body.function, 100) || null;
    const motDePasse = typeof req.body.motDePasse === 'string' ? req.body.motDePasse : '';

    if (!nom || !email) {
      return res.status(400).json({ erreur: "Le nom et l'email sont requis." });
    }
    if (!ROLES_PERSONNEL.has(role)) {
      return res.status(400).json({ erreur: "Rôle invalide." });
    }
    if (!ETATS_COMPTE.has(etat)) {
      return res.status(400).json({ erreur: "État invalide." });
    }
    if (motDePasse.trim() && motDePasse.trim().length < 8) {
      return res.status(400).json({ erreur: "Le mot de passe doit faire au moins 8 caractères." });
    }

    const hash = await hacherMotDePasse(motDePasse);
    const invitation = motDePasse.trim() ? null : crypto.randomBytes(24).toString('hex');
    const expiration = motDePasse.trim() ? null : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await client.query('BEGIN');
    const compte = await client.query(
      `INSERT INTO comptes
         (email, mot_de_passe_hash, identifiant_public, role_id, etat, invitation_hash, invitation_expire_le)
       VALUES ($1, $2, $3, (SELECT id FROM roles WHERE code = $4), $5, $6, $7)
       RETURNING id`,
      [email, hash, identifiantPublic(), role, etat, invitation, expiration],
    );
    const id = compte.rows[0].id;
    await client.query(
      `INSERT INTO personnel (compte_id, nom_affiche, fonction) VALUES ($1, $2, $3)`,
      [id, nom, fonction],
    );
    await client.query('COMMIT');

    const ligne = await pool.query(`${SELECT_PERSONNEL} WHERE c.id = $1`, [id]);
    return res.status(201).json(ligne.rows[0]);
  } catch (error: any) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      return res.status(409).json({ erreur: "Cet email est déjà utilisé." });
    }
    console.error(error);
    return res.status(500).json({ erreur: "Erreur lors de la création du membre." });
  } finally {
    client.release();
  }
});

app.put('/api/personnel/:id', verifierAdmin, async (req, res) => {
  const id = idCompte(req.params.id);
  if (id === null) {
    return res.status(400).json({ erreur: "Identifiant invalide." });
  }

  const client = await pool.connect();
  try {
    const nom = nettoyer(req.body.nom_affiche ?? req.body.name, 120);
    const email = nettoyer(req.body.email, 254).toLowerCase();
    const role = nettoyer(req.body.role, 30) || 'operateur';
    const etat = nettoyer(req.body.etat ?? req.body.status, 20) || 'actif';
    const fonction = nettoyer(req.body.fonction ?? req.body.function, 100) || null;
    const motDePasse = typeof req.body.motDePasse === 'string' ? req.body.motDePasse : '';

    if (!nom || !email) {
      return res.status(400).json({ erreur: "Le nom et l'email sont requis." });
    }
    if (!ROLES_PERSONNEL.has(role)) {
      return res.status(400).json({ erreur: "Rôle invalide." });
    }
    if (!ETATS_COMPTE.has(etat)) {
      return res.status(400).json({ erreur: "État invalide." });
    }
    if (motDePasse.trim() && motDePasse.trim().length < 8) {
      return res.status(400).json({ erreur: "Le mot de passe doit faire au moins 8 caractères." });
    }

    const existant = await client.query('SELECT mot_de_passe_hash FROM comptes WHERE id = $1', [id]);
    if (existant.rowCount === 0) {
      return res.status(404).json({ erreur: "Membre introuvable." });
    }

    const hash = motDePasse.trim()
      ? await hacherMotDePasse(motDePasse)
      : existant.rows[0].mot_de_passe_hash || (await hacherMotDePasse());

    await client.query('BEGIN');
    await client.query(
      `UPDATE comptes
       SET email = $1, role_id = (SELECT id FROM roles WHERE code = $2), etat = $3,
           mot_de_passe_hash = $4, modifie_le = now()
       WHERE id = $5`,
      [email, role, etat, hash, id],
    );
    await client.query(
      `UPDATE personnel
       SET nom_affiche = $1, fonction = $2, modifie_le = now()
       WHERE compte_id = $3`,
      [nom, fonction, id],
    );
    await client.query('COMMIT');

    const ligne = await pool.query(`${SELECT_PERSONNEL} WHERE c.id = $1`, [id]);
    return res.json(ligne.rows[0]);
  } catch (error: any) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      return res.status(409).json({ erreur: "Cet email est déjà utilisé." });
    }
    console.error(error);
    return res.status(500).json({ erreur: "Erreur lors de la mise à jour du membre." });
  } finally {
    client.release();
  }
});

app.patch('/api/personnel/:id/etat', verifierAdmin, async (req, res) => {
  const id = idCompte(req.params.id);
  const etat = nettoyer(req.body.etat ?? req.body.status, 20);
  if (id === null || !ETATS_COMPTE.has(etat)) {
    return res.status(400).json({ erreur: "Identifiant ou état invalide." });
  }

  const client = await pool.connect();
  try {
    const existant = await client.query('SELECT mot_de_passe_hash FROM comptes WHERE id = $1', [id]);
    if (existant.rowCount === 0) {
      return res.status(404).json({ erreur: "Membre introuvable." });
    }
    const hash = existant.rows[0].mot_de_passe_hash || (await hacherMotDePasse());
    await client.query(
      'UPDATE comptes SET etat = $1, mot_de_passe_hash = $2, modifie_le = now() WHERE id = $3',
      [etat, hash, id],
    );
    const ligne = await pool.query(`${SELECT_PERSONNEL} WHERE c.id = $1`, [id]);
    return res.json(ligne.rows[0]);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ erreur: "Erreur lors du changement d'état." });
  } finally {
    client.release();
  }
});

app.delete('/api/personnel/:id', verifierAdmin, async (req, res) => {
  const id = idCompte(req.params.id);
  if (id === null) {
    return res.status(400).json({ erreur: "Identifiant invalide." });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const profil = await client.query('SELECT 1 FROM personnel WHERE compte_id = $1', [id]);
    if (profil.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erreur: "Membre introuvable." });
    }
    await client.query('DELETE FROM sessions WHERE compte_id = $1', [id]);
    await client.query('DELETE FROM personnel WHERE compte_id = $1', [id]);
    await client.query('DELETE FROM comptes WHERE id = $1', [id]);
    await client.query('COMMIT');
    return res.json({ message: "Membre supprimé." });
  } catch (error: any) {
    await client.query('ROLLBACK');
    if (error.code === '23503') {
      return res.status(409).json({ erreur: "Ce compte est lié à d'autres données." });
    }
    console.error(error);
    return res.status(500).json({ erreur: "Erreur lors de la suppression du membre." });
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
