import { Router } from 'express';
import { Pool } from 'pg';

export function arretRoutes(pool: Pool): Router {
  const router = Router();

  // GET all — utilise la vue v_coordonnees_arrets
  router.get('/stops', async (_req, res) => {
    try {
      const resultat = await pool.query(`
        SELECT a.id, a.code, a.nom, a.actif, a.archive_le, a.version,
               a.cree_le, a.modifie_le,
               ST_Y(a.position) AS latitude,
               ST_X(a.position) AS longitude
        FROM arrets a
        WHERE a.archive_le IS NULL
        ORDER BY a.id
      `);
      res.json({ success: true, data: resultat.rows });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET one
  router.get('/stops/:id', async (req, res) => {
    try {
      const resultat = await pool.query(`
        SELECT a.id, a.code, a.nom, a.actif, a.archive_le, a.version,
               a.cree_le, a.modifie_le,
               ST_Y(a.position) AS latitude,
               ST_X(a.position) AS longitude
        FROM arrets a
        WHERE a.id = $1
      `, [req.params.id]);
      if (resultat.rowCount === 0) return res.status(404).json({ error: 'Arrêt non trouvé' });
      res.json({ success: true, data: resultat.rows[0] });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST — crée avec ST_MakePoint
  router.post('/stops', async (req, res) => {
    try {
      const { code, nom, latitude, longitude, actif } = req.body;
      if (!code || !nom || latitude == null || longitude == null) {
        return res.status(400).json({ error: 'code, nom, latitude et longitude sont obligatoires' });
      }
      if (latitude < -90 || latitude > 90) {
        return res.status(400).json({ error: 'Latitude doit être entre -90 et 90' });
      }
      if (longitude < -180 || longitude > 180) {
        return res.status(400).json({ error: 'Longitude doit être entre -180 et 180' });
      }
      const resultat = await pool.query(`
        INSERT INTO arrets (code, nom, position, actif)
        VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5)
        RETURNING id, code, nom, actif,
                  ST_Y(position) AS latitude,
                  ST_X(position) AS longitude
      `, [code, nom, longitude, latitude, actif ?? true]);
      res.status(201).json({ success: true, data: resultat.rows[0] });
    } catch (error: any) {
      if (error.code === '23505') return res.status(409).json({ error: 'Ce code existe déjà' });
      res.status(500).json({ error: error.message });
    }
  });

  // PUT
  router.put('/stops/:id', async (req, res) => {
    try {
      const { code, nom, latitude, longitude, actif } = req.body;
      const resultat = await pool.query(`
        UPDATE arrets
        SET code = $1, nom = $2,
            position = ST_SetSRID(ST_MakePoint($3, $4), 4326),
            actif = $5, modifie_le = now()
        WHERE id = $6
        RETURNING id, code, nom, actif,
                  ST_Y(position) AS latitude,
                  ST_X(position) AS longitude
      `, [code, nom, longitude, latitude, actif ?? true, req.params.id]);
      if (resultat.rowCount === 0) return res.status(404).json({ error: 'Arrêt non trouvé' });
      res.json({ success: true, data: resultat.rows[0] });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE (archive)
  router.delete('/stops/:id', async (req, res) => {
    try {
      const resultat = await pool.query(
        'UPDATE arrets SET archive_le = now() WHERE id = $1 RETURNING *',
        [req.params.id]
      );
      if (resultat.rowCount === 0) return res.status(404).json({ error: 'Arrêt non trouvé' });
      res.json({ success: true, message: 'Arrêt archivé', data: resultat.rows[0] });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}