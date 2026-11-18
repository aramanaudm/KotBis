import { Router } from 'express';
import { Pool } from 'pg';
import { repondreErreur } from '../utils/adapter-requete';

const SELECT_REVIEWS = `
  SELECT a.id, a.reference, a.texte, a.statut, a.cree_le, a.modifie_le,
         v.pseudo AS auteur, t.nom AS trajet
  FROM avis a
  JOIN voyageurs v ON v.compte_id = a.auteur_id
  JOIN trajets t ON t.id = a.trajet_id
`;

const STATUTS: Record<string, string> = {
  pending: 'a_verifier',
  published: 'publie',
  hidden: 'masque',
};

export function reviewRoutes(pool: Pool): Router {
  const router = Router();

  router.get('/reviews', async (_req, res) => {
    try {
      const resultat = await pool.query(`${SELECT_REVIEWS} ORDER BY a.id`);
      res.json({ success: true, data: resultat.rows });
    } catch (error) {
      repondreErreur(res, error);
    }
  });

  router.get('/reviews/:id', async (req, res) => {
    try {
      const resultat = await pool.query(`${SELECT_REVIEWS} WHERE a.id = $1`, [req.params.id]);
      if (resultat.rowCount === 0) return res.status(404).json({ error: 'Avis non trouvé' });
      res.json({ success: true, data: resultat.rows[0] });
    } catch (error) {
      repondreErreur(res, error);
    }
  });

  router.post('/reviews', async (req, res) => {
    try {
      const { auteur_id, trajet_id, texte } = req.body;
      if (!auteur_id || !trajet_id || !texte) {
        return res.status(400).json({ error: 'auteur_id, trajet_id et texte sont obligatoires' });
      }
      const reference = await pool.query(
        "SELECT 'AVI' || lpad(nextval(pg_get_serial_sequence('avis', 'id'))::text, 6, '0') AS reference",
      );
      const resultat = await pool.query(`
        INSERT INTO avis (reference, auteur_id, trajet_id, texte, statut)
        VALUES ($1, $2, $3, $4, 'a_verifier') RETURNING *
      `, [reference.rows[0].reference, auteur_id, trajet_id, texte]);
      res.status(201).json({ success: true, data: resultat.rows[0] });
    } catch (error) {
      repondreErreur(res, error, { 23505: 'Cette référence existe déjà' });
    }
  });

  router.put('/reviews/:id', async (req, res) => {
    try {
      const { statut, texte } = req.body;
      const resultat = await pool.query(`
        UPDATE avis
        SET statut = COALESCE($2, statut), texte = COALESCE($3, texte), modifie_le = now()
        WHERE CASE WHEN $1 ~ '^[0-9]+$' THEN id = $1::bigint ELSE false END OR reference = $1
        RETURNING *
      `, [req.params.id, statut ? STATUTS[statut] ?? statut : null, texte ?? null]);
      if (resultat.rowCount === 0) return res.status(404).json({ error: 'Avis non trouvé' });
      res.json({ success: true, data: resultat.rows[0] });
    } catch (error) {
      repondreErreur(res, error, { 23514: 'Statut ou texte d’avis invalide' });
    }
  });

  router.delete('/reviews/:id', async (req, res) => {
    try {
      const resultat = await pool.query(`
        UPDATE avis SET statut = 'masque', modifie_le = now()
        WHERE CASE WHEN $1 ~ '^[0-9]+$' THEN id = $1::bigint ELSE false END OR reference = $1
        RETURNING id, reference, statut
      `, [req.params.id]);
      if (resultat.rowCount === 0) return res.status(404).json({ error: 'Avis non trouvé' });
      res.json({ success: true, message: 'Avis masqué', data: resultat.rows[0] });
    } catch (error) {
      repondreErreur(res, error);
    }
  });

  return router;
}
