import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { Pool } from 'pg';
import { repondreErreur } from '../utils/adapter-requete';

const SELECT_SOLDES = `
  SELECT v.compte_id AS id, v.pseudo, c.email, COALESCE(s.solde, 0) AS points
  FROM voyageurs v
  JOIN comptes c ON c.id = v.compte_id
  LEFT JOIN v_soldes_voyageurs s ON s.voyageur_id = v.compte_id
`;

async function agentSysteme(pool: Pool): Promise<number> {
  const existant = await pool.query('SELECT compte_id FROM personnel ORDER BY compte_id LIMIT 1');
  if ((existant.rowCount ?? 0) > 0) {
    return Number(existant.rows[0].compte_id);
  }
  await pool.query(`
    INSERT INTO comptes (email, etat, role_id, identifiant_public)
    VALUES ('system@kotbis.local', 'invite', (SELECT id FROM roles WHERE code = 'administrateur'), 'system_backoffice')
    ON CONFLICT DO NOTHING
  `);
  const compte = await pool.query("SELECT id FROM comptes WHERE identifiant_public = 'system_backoffice'");
  await pool.query(`
    INSERT INTO personnel (compte_id, nom_affiche, fonction) VALUES ($1, 'Système', 'Back-office')
    ON CONFLICT DO NOTHING
  `, [compte.rows[0].id]);
  return Number(compte.rows[0].id);
}

export function pointRoutes(pool: Pool): Router {
  const router = Router();

  router.get('/points', async (_req, res) => {
    try {
      const resultat = await pool.query(`${SELECT_SOLDES} ORDER BY v.compte_id`);
      res.json({ success: true, data: resultat.rows });
    } catch (error) {
      repondreErreur(res, error);
    }
  });

  router.get('/points/movements', async (_req, res) => {
    try {
      const resultat = await pool.query(`
        SELECT m.id, m.voyageur_id AS "userId", v.pseudo AS "userName",
               m.variation, m.motif AS reason, m.cree_le AS date
        FROM mouvements_points m
        JOIN voyageurs v ON v.compte_id = m.voyageur_id
        ORDER BY m.cree_le DESC, m.id DESC
      `);
      res.json({ success: true, data: resultat.rows });
    } catch (error) {
      repondreErreur(res, error);
    }
  });

  router.post('/points', async (req, res) => {
    try {
      const { userId, variation, reason } = req.body;
      const montant = Number(variation);
      if (!userId || !reason || !Number.isInteger(montant) || montant === 0) {
        return res.status(400).json({ error: 'userId, variation (entier non nul) et reason sont obligatoires' });
      }
      const agent = await agentSysteme(pool);
      const resultat = await pool.query(`
        INSERT INTO mouvements_points (voyageur_id, agent_id, variation, motif, cle_idempotence)
        VALUES ($1, $2, $3, $4, $5) RETURNING id, variation, motif, cree_le
      `, [userId, agent, montant, reason, randomUUID()]);
      res.status(201).json({ success: true, data: resultat.rows[0] });
    } catch (error) {
      repondreErreur(res, error, { 23503: 'Voyageur ou agent inexistant' });
    }
  });

  return router;
}
