import { Router } from 'express';
import { Pool } from 'pg';
import { repondreErreur } from '../utils/adapter-requete';

const SELECT_REPORTS = `
  SELECT s.id, s.reference, s.type, s.commentaire, s.statut, s.cree_le,
         b.plaque AS bus_plaque, v.pseudo AS auteur
  FROM signalements s
  JOIN bus b ON b.id = s.bus_id
  JOIN voyageurs v ON v.compte_id = s.auteur_id
`;

const STATUTS: Record<string, string> = {
  pending: 'a_verifier',
  confirmed: 'confirme',
  dismissed: 'classe_sans_suite',
};

function typeSignalement(type: unknown): string {
  return type === 'breakdown' || type === 'en_panne' ? 'en_panne' : 'autre';
}

export function reportRoutes(pool: Pool): Router {
  const router = Router();

  router.get('/reports', async (_req, res) => {
    try {
      const resultat = await pool.query(`${SELECT_REPORTS} ORDER BY s.id`);
      res.json({ success: true, data: resultat.rows });
    } catch (error) {
      repondreErreur(res, error);
    }
  });

  router.get('/reports/:id', async (req, res) => {
    try {
      const resultat = await pool.query(`${SELECT_REPORTS} WHERE s.id = $1`, [req.params.id]);
      if (resultat.rowCount === 0) return res.status(404).json({ error: 'Signalement non trouvé' });
      res.json({ success: true, data: resultat.rows[0] });
    } catch (error) {
      repondreErreur(res, error);
    }
  });

  router.post('/reports', async (req, res) => {
    try {
      const { bus_id, auteur_id, type, commentaire } = req.body;
      if (!bus_id || !auteur_id || !type) {
        return res.status(400).json({ error: 'bus_id, auteur_id et type sont obligatoires' });
      }
      const reference = await pool.query(
        "SELECT 'SIG' || lpad(nextval(pg_get_serial_sequence('signalements', 'id'))::text, 6, '0') AS reference",
      );
      const resultat = await pool.query(`
        INSERT INTO signalements (reference, auteur_id, bus_id, type, commentaire, statut)
        VALUES ($1, $2, $3, $4, $5, 'a_verifier') RETURNING *
      `, [reference.rows[0].reference, auteur_id, bus_id, typeSignalement(type), commentaire ?? null]);
      res.status(201).json({ success: true, data: resultat.rows[0] });
    } catch (error) {
      repondreErreur(res, error, { 23505: 'Cette référence existe déjà' });
    }
  });

  router.put('/reports/:id', async (req, res) => {
    try {
      const { statut, commentaire, type } = req.body;
      const resultat = await pool.query(`
        UPDATE signalements
        SET statut = COALESCE($2, statut),
            commentaire = COALESCE($3, commentaire),
            type = COALESCE($4, type)
        WHERE (CASE WHEN $1 ~ '^[0-9]+$' THEN id = $1::bigint ELSE false END OR reference = $1)
          AND statut <> 'classe_sans_suite'
        RETURNING *
      `, [req.params.id, statut ? STATUTS[statut] ?? statut : null, commentaire ?? null,
          type ? typeSignalement(type) : null]);
      if (resultat.rowCount === 0) return res.status(404).json({ error: 'Signalement non trouvé' });
      res.json({ success: true, data: resultat.rows[0] });
    } catch (error) {
      repondreErreur(res, error, { 23514: 'Statut ou type de signalement invalide' });
    }
  });

  router.delete('/reports/:id', async (req, res) => {
    try {
      const resultat = await pool.query(`
        UPDATE signalements SET statut = 'classe_sans_suite'
        WHERE CASE WHEN $1 ~ '^[0-9]+$' THEN id = $1::bigint ELSE false END OR reference = $1
        RETURNING id, reference, statut
      `, [req.params.id]);
      if (resultat.rowCount === 0) return res.status(404).json({ error: 'Signalement non trouvé' });
      res.json({ success: true, message: 'Signalement classé sans suite', data: resultat.rows[0] });
    } catch (error) {
      repondreErreur(res, error);
    }
  });

  return router;
}
