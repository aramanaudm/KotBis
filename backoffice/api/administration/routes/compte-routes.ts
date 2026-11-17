import { Router } from 'express';
import { Pool } from 'pg';
import { insert, update } from '../../commun/crud-reflect';
import { Compte } from '../entites/compte';
import { adapterRequete, repondreErreur } from '../utils/adapter-requete';

const SELECT_COMPTES = `
  SELECT c.id, c.email, c.role_id, c.etat, c.identifiant_public,
         c.cree_le, c.modifie_le, c.version,
         r.code AS role_code, r.libelle AS role_libelle,
         v.pseudo, COALESCE(s.solde, 0) AS points
  FROM comptes c
  JOIN roles r ON r.id = c.role_id
  LEFT JOIN voyageurs v ON v.compte_id = c.id
  LEFT JOIN v_soldes_voyageurs s ON s.voyageur_id = c.id
`;

async function roleId(pool: Pool, roleId: unknown, roleCode: unknown): Promise<number | undefined> {
  if (roleId != null && roleId !== '') {
    return Number(roleId);
  }
  if (typeof roleCode === 'string' && roleCode.trim()) {
    const codes: Record<string, string> = {
      traveller: 'voyageur',
      operator: 'operateur',
      moderator: 'moderateur',
      admin: 'administrateur',
    };
    const resultat = await pool.query('SELECT id FROM roles WHERE code = $1', [
      codes[roleCode] ?? roleCode,
    ]);
    if (resultat.rowCount === 0) {
      throw Object.assign(new Error("Le rôle spécifiée n'existe pas"), { code: 'ROLE_INCONNU' });
    }
    return Number(resultat.rows[0].id);
  }
  return undefined;
}

function identifiantPublic(email: string): string {
  const base = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 30);
  return `${base}_${Math.random().toString(36).slice(2, 8)}`;
}

export function compteRoutes(pool: Pool): Router {
  const router = Router();

  router.get('/accounts', async (_req, res) => {
    try {
      const resultat = await pool.query(`${SELECT_COMPTES} ORDER BY c.id`);
      res.json({ success: true, data: resultat.rows });
    } catch (error) {
      repondreErreur(res, error);
    }
  });

  router.get('/accounts/:id', async (req, res) => {
    try {
      const resultat = await pool.query(`${SELECT_COMPTES} WHERE c.id = $1`, [req.params.id]);
      if (resultat.rowCount === 0) return res.status(404).json({ error: 'Compte non trouvé' });
      res.json({ success: true, data: resultat.rows[0] });
    } catch (error) {
      repondreErreur(res, error);
    }
  });

  router.post('/accounts', async (req, res) => {
    try {
      const { email, mot_de_passe_hash, role_id, role_code, etat, identifiant_public, pseudo } = req.body;
      if (!email || !etat) {
        return res.status(400).json({ error: 'email et etat sont obligatoires' });
      }
      const compte = new Compte(
        null,
        email,
        mot_de_passe_hash ?? null,
        await roleId(pool, role_id, role_code),
        etat,
        identifiant_public || identifiantPublic(email),
      );
      const { sql, params } = adapterRequete(insert(compte));
      const resultat = await pool.query(sql + ' RETURNING *', params);
      if (pseudo) {
        await pool.query(`
          INSERT INTO voyageurs (compte_id, pseudo) VALUES ($1, $2)
          ON CONFLICT (compte_id) DO UPDATE SET pseudo = EXCLUDED.pseudo
        `, [resultat.rows[0].id, pseudo]);
      }
      res.status(201).json({ success: true, data: resultat.rows[0] });
    } catch (error) {
      repondreErreur(res, error, {
        23505: 'Cet email, cet identifiant ou ce pseudo existe déjà',
        23514: "État invalide (invite, actif, inactif) ou hash manquant pour un compte actif",
        ROLE_INCONNU: "Le rôle spécifié n'existe pas",
      });
    }
  });

  router.put('/accounts/:id', async (req, res) => {
    try {
      const existant = await pool.query('SELECT id FROM comptes WHERE id = $1', [req.params.id]);
      if (existant.rowCount === 0) return res.status(404).json({ error: 'Compte non trouvé' });

      const { email, mot_de_passe_hash, role_id, role_code, etat, identifiant_public, pseudo } = req.body;
      const compte = new Compte(
        Number(req.params.id),
        email,
        mot_de_passe_hash,
        await roleId(pool, role_id, role_code),
        etat,
        identifiant_public,
      );
      const { sql, params } = adapterRequete(update(compte));
      const resultat = await pool.query(sql + ' RETURNING *', params);
      if (pseudo) {
        await pool.query(`
          INSERT INTO voyageurs (compte_id, pseudo) VALUES ($1, $2)
          ON CONFLICT (compte_id) DO UPDATE SET pseudo = EXCLUDED.pseudo
        `, [resultat.rows[0].id, pseudo]);
      }
      res.json({ success: true, data: resultat.rows[0] });
    } catch (error) {
      repondreErreur(res, error, {
        23505: 'Cet email, cet identifiant ou ce pseudo existe déjà',
        23514: "État invalide (invite, actif, inactif) ou hash manquant pour un compte actif",
        ROLE_INCONNU: "Le rôle spécifié n'existe pas",
      });
    }
  });

  router.delete('/accounts/:id', async (req, res) => {
    try {
      const resultat = await pool.query(
        'UPDATE comptes SET etat = $$inactif$$, modifie_le = now() WHERE id = $1 RETURNING id, email, etat',
        [req.params.id],
      );
      if (resultat.rowCount === 0) return res.status(404).json({ error: 'Compte non trouvé' });
      res.json({ success: true, message: 'Compte désactivé', data: resultat.rows[0] });
    } catch (error) {
      repondreErreur(res, error);
    }
  });

  return router;
}
