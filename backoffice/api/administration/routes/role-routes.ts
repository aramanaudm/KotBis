import { Router } from 'express';
import { Pool } from 'pg';
import { insert, update, remove } from '../../commun/crud-reflect';
import { Role } from '../entites/role';
import { adapterRequete } from '../utils/adapter-requete';

export function roleRoutes(pool: Pool): Router {
  const router = Router();

  // GET all
  router.get('/roles', async (_req, res) => {
    try {
      const resultat = await pool.query('SELECT * FROM roles ORDER BY id');
      res.json({ success: true, data: resultat.rows });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET one
  router.get('/roles/:id', async (req, res) => {
    try {
      const resultat = await pool.query('SELECT * FROM roles WHERE id = $1', [req.params.id]);
      if (resultat.rowCount === 0) return res.status(404).json({ error: 'Role non trouvé' });
      res.json({ success: true, data: resultat.rows[0] });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST
  router.post('/roles', async (req, res) => {
    try {
      const { id, code, libelle } = req.body;
      const role = new Role(id ?? null, code, libelle);
      const { sql, params } = adapterRequete(insert(role));
      const resultat = await pool.query(sql + ' RETURNING *', params);
      res.status(201).json({ success: true, data: resultat.rows[0] });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // PUT
  router.put('/roles/:id', async (req, res) => {
    try {
      const { code, libelle } = req.body;
      const role = new Role(Number(req.params.id), code, libelle);
      const { sql, params } = adapterRequete(update(role));
      const resultat = await pool.query(sql + ' RETURNING *', params);
      if (resultat.rowCount === 0) return res.status(404).json({ error: 'Role non trouvé' });
      res.json({ success: true, data: resultat.rows[0] });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE
  router.delete('/roles/:id', async (req, res) => {
    try {
      const role = new Role(Number(req.params.id), '', '');
      const { sql, params } = adapterRequete(remove(role));
      const resultat = await pool.query(sql, params);
      if (resultat.rowCount === 0) return res.status(404).json({ error: 'Role non trouvé' });
      res.json({ success: true, message: 'Role supprimé' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}