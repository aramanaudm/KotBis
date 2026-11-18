import { Router } from 'express';
import { Pool } from 'pg';
import { repondreErreur } from '../utils/adapter-requete';

const ROLES: Record<string, string> = {
  operator: 'operateur',
  moderator: 'moderateur',
  admin: 'administrateur',
};

const SELECT_STAFF = `
  SELECT p.compte_id AS id, p.nom_affiche AS name, p.fonction,
         c.email, c.etat, c.identifiant_public, r.code AS role_code
  FROM personnel p
  JOIN comptes c ON c.id = p.compte_id
  JOIN roles r ON r.id = c.role_id
`;

async function roleId(client: any, role: unknown): Promise<number> {
  const code = ROLES[String(role)] ?? String(role ?? 'operateur');
  const resultat = await client.query('SELECT id FROM roles WHERE code = $1', [code]);
  if (resultat.rowCount === 0) {
    throw Object.assign(new Error("Le rôle spécifié n'existe pas"), { code: 'ROLE_INCONNU' });
  }
  return Number(resultat.rows[0].id);
}

function identifiantPublic(email: string): string {
  return `${email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 30)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function staffRoutes(pool: Pool): Router {
  const router = Router();

  router.get('/staff', async (_req, res) => {
    try {
      const resultat = await pool.query(`${SELECT_STAFF} ORDER BY p.compte_id`);
      res.json({ success: true, data: resultat.rows });
    } catch (error) {
      repondreErreur(res, error);
    }
  });

  router.get('/staff/:id', async (req, res) => {
    try {
      const resultat = await pool.query(`${SELECT_STAFF} WHERE p.compte_id = $1`, [req.params.id]);
      if (resultat.rowCount === 0) return res.status(404).json({ error: 'Membre non trouvé' });
      res.json({ success: true, data: resultat.rows[0] });
    } catch (error) {
      repondreErreur(res, error);
    }
  });

  router.post('/staff', async (req, res) => {
    const client = await pool.connect();
    try {
      const { name, email, role, status, password_hash } = req.body;
      if (!name || !email || !role) {
        return res.status(400).json({ error: 'name, email et role sont obligatoires' });
      }
      const etat = status === 'inactive' ? 'inactif' : password_hash ? 'actif' : 'invite';
      await client.query('BEGIN');
      const compte = await client.query(`
        INSERT INTO comptes (email, mot_de_passe_hash, role_id, etat, identifiant_public)
        VALUES ($1, $2, $3, $4, $5) RETURNING id
      `, [email, password_hash ?? null, await roleId(client, role), etat, identifiantPublic(email)]);
      const compteId = Number(compte.rows[0].id);
      await client.query(`
        INSERT INTO personnel (compte_id, nom_affiche, fonction) VALUES ($1, $2, $3)
      `, [compteId, name, ROLES[String(role)] ?? String(role)]);
      await client.query('COMMIT');
      const resultat = await pool.query(`${SELECT_STAFF} WHERE p.compte_id = $1`, [compteId]);
      res.status(201).json({ success: true, data: resultat.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      repondreErreur(res, error, {
        23505: 'Cet email existe déjà',
        ROLE_INCONNU: "Le rôle spécifié n'existe pas",
      });
    } finally {
      client.release();
    }
  });

  router.put('/staff/:id', async (req, res) => {
    const client = await pool.connect();
    try {
      const existant = await client.query('SELECT compte_id FROM personnel WHERE compte_id = $1', [req.params.id]);
      if (existant.rowCount === 0) return res.status(404).json({ error: 'Membre non trouvé' });
      const { name, email, role, status, password_hash } = req.body;
      await client.query('BEGIN');
      await client.query(`
        UPDATE comptes
        SET email = COALESCE($2, email),
            etat = COALESCE($3, etat),
            role_id = COALESCE($4, role_id),
            mot_de_passe_hash = COALESCE($5, mot_de_passe_hash),
            modifie_le = now()
        WHERE id = $1
      `, [req.params.id, email ?? null, status ? (status === 'inactive' ? 'inactif' : 'invite') : null,
          role ? await roleId(client, role) : null, password_hash ?? null]);
      await client.query(`
        UPDATE personnel
        SET nom_affiche = COALESCE($2, nom_affiche),
            fonction = COALESCE($3, fonction), modifie_le = now()
        WHERE compte_id = $1
      `, [req.params.id, name ?? null, role ? (ROLES[String(role)] ?? String(role)) : null]);
      await client.query('COMMIT');
      const resultat = await pool.query(`${SELECT_STAFF} WHERE p.compte_id = $1`, [req.params.id]);
      res.json({ success: true, data: resultat.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      repondreErreur(res, error, {
        23505: 'Cet email existe déjà',
        ROLE_INCONNU: "Le rôle spécifié n'existe pas",
      });
    } finally {
      client.release();
    }
  });

  router.delete('/staff/:id', async (req, res) => {
    try {
      const resultat = await pool.query(
        "UPDATE comptes SET etat = 'inactif', modifie_le = now() WHERE id = $1 RETURNING id, email, etat",
        [req.params.id],
      );
      if (resultat.rowCount === 0) return res.status(404).json({ error: 'Membre non trouvé' });
      res.json({ success: true, message: 'Membre désactivé', data: resultat.rows[0] });
    } catch (error) {
      repondreErreur(res, error);
    }
  });

  return router;
}
