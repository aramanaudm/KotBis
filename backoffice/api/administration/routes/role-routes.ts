import { Router } from 'express';
import { Pool } from 'pg';
import { insert, update, remove } from '../../commun/crud-reflect';
import { Role } from '../entites/role';
import { adapterRequete, repondreErreur } from '../utils/adapter-requete';

export function roleRoutes(pool: Pool): Router {
  const router = Router();

  router.get('/roles', async (_req, res) => {
    try {
      const resultat = await pool.query('SELECT * FROM roles ORDER BY id');
      res.json({ success: true, data: resultat.rows });
    } catch (error) {
      repondreErreur(res, error);
    }
  });

  router.get('/roles/:id', async (req, res) => {
    try {
      const resultat = await pool.query('SELECT * FROM roles WHERE id = $1', [req.params.id]);
      if (resultat.rowCount === 0) return res.status(404).json({ error: 'Role non trouvé' });
      res.json({ success: true, data: resultat.rows[0] });
    } catch (error) {
      repondreErreur(res, error);
    }
  });

  router.post('/roles', async (req, res) => {
    try {
      const { id, code, libelle } = req.body;
      if (!code || !libelle) {
        return res.status(400).json({ error: 'code et libelle sont obligatoires' });
      }
      const role = new Role(id ?? null, code, libelle);
      const { sql, params } = adapterRequete(insert(role));
      const resultat = await pool.query(sql + ' RETURNING *', params);
      res.status(201).json({ success: true, data: resultat.rows[0] });
    } catch (error) {
      repondreErreur(res, error, { 23505: 'Ce code existe déjà', 23514: 'Code de rôle invalide' });
    }
  });

  router.put('/roles/:id', async (req, res) => {
    try {
      const { code, libelle } = req.body;
      const role = new Role(Number(req.params.id), code, libelle);
      const { sql, params } = adapterRequete(update(role));
      const resultat = await pool.query(sql + ' RETURNING *', params);
      if (resultat.rowCount === 0) return res.status(404).json({ error: 'Role non trouvé' });
      res.json({ success: true, data: resultat.rows[0] });
    } catch (error) {
      repondreErreur(res, error, { 23505: 'Ce code existe déjà', 23514: 'Code de rôle invalide' });
    }
  });

  router.delete('/roles/:id', async (req, res) => {
    try {
      const resultat = await pool.query('SELECT id FROM roles WHERE id = $1', [req.params.id]);
      if (resultat.rowCount === 0) return res.status(404).json({ error: 'Role non trouvé' });
      res.status(409).json({ error: 'Les rôles sont un référentiel : modification possible, suppression non autorisée' });
    } catch (error) {
      repondreErreur(res, error);
    }
  });

  return router;
}
