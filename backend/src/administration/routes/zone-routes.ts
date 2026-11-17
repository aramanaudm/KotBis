import { Router } from 'express';
import { Pool } from 'pg';

export function zoneRoutes(pool: Pool): Router {
  const router = Router();

  // GET all — contour en GeoJSON
  router.get('/zones', async (_req, res) => {
    try {
      const resultat = await pool.query(`
        SELECT id, code, nom, actif, archive_le, version,
               cree_le, modifie_le,
               ST_AsGeoJSON(contour)::json AS contour
        FROM zones
        WHERE archive_le IS NULL
        ORDER BY id
      `);
      res.json({ success: true, data: resultat.rows });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET one
  router.get('/zones/:id', async (req, res) => {
    try {
      const resultat = await pool.query(`
        SELECT id, code, nom, actif, archive_le, version,
               cree_le, modifie_le,
               ST_AsGeoJSON(contour)::json AS contour
        FROM zones
        WHERE id = $1
      `, [req.params.id]);
      if (resultat.rowCount === 0) return res.status(404).json({ error: 'Zone non trouvée' });
      res.json({ success: true, data: resultat.rows[0] });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST — contour en GeoJSON
  router.post('/zones', async (req, res) => {
    try {
      const { code, nom, contour, actif } = req.body;
      if (!code || !nom || !contour) {
        return res.status(400).json({ error: 'code, nom et contour (GeoJSON) sont obligatoires' });
      }
      const resultat = await pool.query(`
        INSERT INTO zones (code, nom, contour, actif)
        VALUES ($1, $2, ST_SetSRID(ST_GeomFromGeoJSON($3), 4326), $4)
        RETURNING id, code, nom, actif,
                  ST_AsGeoJSON(contour)::json AS contour
      `, [code, nom, JSON.stringify(contour), actif ?? false]);
      res.status(201).json({ success: true, data: resultat.rows[0] });
    } catch (error: any) {
      if (error.code === '23505') return res.status(409).json({ error: 'Ce code existe déjà' });
      if (error.code === '23514') return res.status(400).json({ error: 'Contour invalide (polygone non valide ou vide)' });
      res.status(500).json({ error: error.message });
    }
  });

  // PUT
  router.put('/zones/:id', async (req, res) => {
    try {
      const { code, nom, contour, actif } = req.body;
      const resultat = await pool.query(`
        UPDATE zones
        SET code = $1, nom = $2,
            contour = ST_SetSRID(ST_GeomFromGeoJSON($3), 4326),
            actif = $4, modifie_le = now()
        WHERE id = $5
        RETURNING id, code, nom, actif,
                  ST_AsGeoJSON(contour)::json AS contour
      `, [code, nom, JSON.stringify(contour), actif ?? false, req.params.id]);
      if (resultat.rowCount === 0) return res.status(404).json({ error: 'Zone non trouvée' });
      res.json({ success: true, data: resultat.rows[0] });
    } catch (error: any) {
      if (error.code === '23514') return res.status(400).json({ error: 'Contour invalide' });
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE (archive)
  router.delete('/zones/:id', async (req, res) => {
    try {
      const resultat = await pool.query(
        'UPDATE zones SET archive_le = now() WHERE id = $1 RETURNING id, code, nom, archive_le',
        [req.params.id]
      );
      if (resultat.rowCount === 0) return res.status(404).json({ error: 'Zone non trouvée' });
      res.json({ success: true, message: 'Zone archivée', data: resultat.rows[0] });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}