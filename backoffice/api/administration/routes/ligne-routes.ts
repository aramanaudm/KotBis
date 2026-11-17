import { Router } from 'express';
import { Pool } from 'pg';
import { insert, update, remove } from '../../commun/crud-reflect';
import { Ligne } from '../entites/ligne';
import { adapterRequete } from '../utils/adapter-requete';

export function ligneRoutes(pool: Pool): Router {
  const router = Router();

  // GET all
  router.get('/lignes', async (_req, res) => {
    try {
      const resultat = await pool.query('SELECT * FROM lignes WHERE archive_le IS NULL ORDER BY id');
      res.json({ success: true, data: resultat.rows });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET one
  router.get('/lignes/:id', async (req, res) => {
    try {
      const resultat = await pool.query('SELECT * FROM lignes WHERE id = $1', [req.params.id]);
      if (resultat.rowCount === 0) return res.status(404).json({ error: 'Ligne non trouvée' });
      res.json({ success: true, data: resultat.rows[0] });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST
  router.post('/lignes', async (req, res) => {
    try {
      const { code, libelle, actif } = req.body;
      const ligne = new Ligne(null, code, libelle, actif ?? true);
      const { sql, params } = adapterRequete(insert(ligne));
      const resultat = await pool.query(sql + ' RETURNING *', params);
      res.status(201).json({ success: true, data: resultat.rows[0] });
    } catch (error: any) {
      if (error.code === '23505') return res.status(409).json({ error: 'Ce code existe déjà' });
      res.status(500).json({ error: error.message });
    }
  });

  // PUT
  router.put('/lignes/:id', async (req, res) => {
    try {
      const { code, libelle, actif } = req.body;
      const ligne = new Ligne(Number(req.params.id), code, libelle, actif ?? true);
      const { sql, params } = adapterRequete(update(ligne));
      const resultat = await pool.query(sql + ' RETURNING *', params);
      if (resultat.rowCount === 0) return res.status(404).json({ error: 'Ligne non trouvée' });
      res.json({ success: true, data: resultat.rows[0] });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE (archive)
  router.delete('/lignes/:id', async (req, res) => {
    try {
      const resultat = await pool.query(
        'UPDATE lignes SET archive_le = now() WHERE id = $1 RETURNING *',
        [req.params.id]
      );
      if (resultat.rowCount === 0) return res.status(404).json({ error: 'Ligne non trouvée' });
      res.json({ success: true, message: 'Ligne archivée', data: resultat.rows[0] });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}