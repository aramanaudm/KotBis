import { Router } from 'express';
import { Pool } from 'pg';
import { insert, update, remove } from '../../commun/crud-reflect';
import { Trajet } from '../entites/trajet';
import { adapterRequete } from '../utils/adapter-requete';

export function trajetRoutes(pool: Pool): Router {
  const router = Router();

  // GET all — avec jointure sur lignes pour avoir le code de la ligne
  router.get('/routes', async (_req, res) => {
    try {
      const resultat = await pool.query(`
        SELECT t.*, l.code AS ligne_code, l.libelle AS ligne_libelle
        FROM trajets t
        JOIN lignes l ON l.id = t.ligne_id
        WHERE t.archive_le IS NULL
        ORDER BY t.id
      `);
      res.json({ success: true, data: resultat.rows });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET one
  router.get('/routes/:id', async (req, res) => {
    try {
      const resultat = await pool.query(`
        SELECT t.*, l.code AS ligne_code, l.libelle AS ligne_libelle
        FROM trajets t
        JOIN lignes l ON l.id = t.ligne_id
        WHERE t.id = $1
      `, [req.params.id]);
      if (resultat.rowCount === 0) return res.status(404).json({ error: 'Trajet non trouvé' });
      res.json({ success: true, data: resultat.rows[0] });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST
  router.post('/routes', async (req, res) => {
    try {
      const { code, ligne_id, nom, direction, actif } = req.body;
      if (!code || !ligne_id || !nom || !direction) {
        return res.status(400).json({ error: 'code, ligne_id, nom et direction sont obligatoires' });
      }
      const trajet = new Trajet(null, code, Number(ligne_id), nom, direction, actif ?? false);
      const { sql, params } = adapterRequete(insert(trajet));
      const resultat = await pool.query(sql + ' RETURNING *', params);
      res.status(201).json({ success: true, data: resultat.rows[0] });
    } catch (error: any) {
      if (error.code === '23505') return res.status(409).json({ error: 'Ce code existe déjà' });
      if (error.code === '23503') return res.status(400).json({ error: 'La ligne spécifiée n\'existe pas' });
      res.status(500).json({ error: error.message });
    }
  });

  // PUT
  router.put('/routes/:id', async (req, res) => {
    try {
      const { code, ligne_id, nom, direction, actif } = req.body;
      const trajet = new Trajet(Number(req.params.id), code, Number(ligne_id), nom, direction, actif ?? false);
      const { sql, params } = adapterRequete(update(trajet));
      const resultat = await pool.query(sql + ' RETURNING *', params);
      if (resultat.rowCount === 0) return res.status(404).json({ error: 'Trajet non trouvé' });
      res.json({ success: true, data: resultat.rows[0] });
    } catch (error: any) {
      if (error.code === '23503') return res.status(400).json({ error: 'La ligne spécifiée n\'existe pas' });
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE (archive)
  router.delete('/routes/:id', async (req, res) => {
    try {
      const resultat = await pool.query(
        'UPDATE trajets SET archive_le = now() WHERE id = $1 RETURNING *',
        [req.params.id]
      );
      if (resultat.rowCount === 0) return res.status(404).json({ error: 'Trajet non trouvé' });
      res.json({ success: true, message: 'Trajet archivé', data: resultat.rows[0] });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}