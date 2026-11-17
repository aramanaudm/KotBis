import { Router } from 'express';
import { Pool } from 'pg';
import { insert, update, remove } from '../../commun/crud-reflect';
import { Bus } from '../entites/bus';
import { adapterRequete } from '../utils/adapter-requete';

export function busRoutes(pool: Pool): Router {
  const router = Router();

  // GET all
  router.get('/buses', async (_req, res) => {
    try {
      const resultat = await pool.query(
        'SELECT * FROM bus WHERE archive_le IS NULL ORDER BY id'
      );
      res.json({ success: true, data: resultat.rows });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET one
  router.get('/buses/:id', async (req, res) => {
    try {
      const resultat = await pool.query('SELECT * FROM bus WHERE id = $1', [req.params.id]);
      if (resultat.rowCount === 0) return res.status(404).json({ error: 'Bus non trouvé' });
      res.json({ success: true, data: resultat.rows[0] });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST
  router.post('/buses', async (req, res) => {
    try {
      const { plaque, etat, actif } = req.body;
      if (!plaque) return res.status(400).json({ error: 'La plaque est obligatoire' });
      const bus = new Bus(null, plaque, etat ?? 'actif', actif ?? true);
      const { sql, params } = adapterRequete(insert(bus));
      const resultat = await pool.query(sql + ' RETURNING *', params);
      res.status(201).json({ success: true, data: resultat.rows[0] });
    } catch (error: any) {
      if (error.code === '23505') return res.status(409).json({ error: 'Cette plaque existe déjà' });
      res.status(500).json({ error: error.message });
    }
  });

  // PUT
  router.put('/buses/:id', async (req, res) => {
    try {
      const { plaque, etat, actif } = req.body;
      const bus = new Bus(Number(req.params.id), plaque, etat ?? 'actif', actif ?? true);
      const { sql, params } = adapterRequete(update(bus));
      const resultat = await pool.query(sql + ' RETURNING *', params);
      if (resultat.rowCount === 0) return res.status(404).json({ error: 'Bus non trouvé' });
      res.json({ success: true, data: resultat.rows[0] });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE (archive)
  router.delete('/buses/:id', async (req, res) => {
    try {
      const resultat = await pool.query(
        'UPDATE bus SET archive_le = now() WHERE id = $1 RETURNING *',
        [req.params.id]
      );
      if (resultat.rowCount === 0) return res.status(404).json({ error: 'Bus non trouvé' });
      res.json({ success: true, message: 'Bus archivé', data: resultat.rows[0] });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}