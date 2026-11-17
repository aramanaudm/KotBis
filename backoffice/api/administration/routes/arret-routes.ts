import { Router } from 'express';
import { Pool } from 'pg';
import { repondreErreur } from '../utils/adapter-requete';

function coordonneesValides(latitude: unknown, longitude: unknown): boolean {
  const lat = Number(latitude);
  const lon = Number(longitude);
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

async function codeOuGeneration(pool: Pool, code: unknown, prefix: string): Promise<string> {
  if (typeof code === 'string' && code.trim()) {
    return code.trim();
  }
  const table = prefix === 'A' ? 'arrets' : 'zones';
  const resultat = await pool.query(
    `SELECT nextval(pg_get_serial_sequence($1, 'id'))::int AS n`,
    [table],
  );
  return `${prefix}${String(resultat.rows[0].n).padStart(4, '0')}`;
}

export function arretRoutes(pool: Pool): Router {
  const router = Router();

  router.get('/stops', async (_req, res) => {
    try {
      const resultat = await pool.query(`
        SELECT a.id, a.code, a.nom, a.actif, a.archive_le, a.version,
               a.cree_le, a.modifie_le,
               ST_Y(a.position) AS latitude, ST_X(a.position) AS longitude
        FROM arrets a
        WHERE a.archive_le IS NULL
        ORDER BY a.id
      `);
      res.json({ success: true, data: resultat.rows });
    } catch (error) {
      repondreErreur(res, error);
    }
  });

  router.get('/stops/:id', async (req, res) => {
    try {
      const resultat = await pool.query(`
        SELECT a.id, a.code, a.nom, a.actif, a.archive_le, a.version,
               a.cree_le, a.modifie_le,
               ST_Y(a.position) AS latitude, ST_X(a.position) AS longitude
        FROM arrets a
        WHERE a.id = $1 AND a.archive_le IS NULL
      `, [req.params.id]);
      if (resultat.rowCount === 0) return res.status(404).json({ error: 'Arrêt non trouvé' });
      res.json({ success: true, data: resultat.rows[0] });
    } catch (error) {
      repondreErreur(res, error);
    }
  });

  router.post('/stops', async (req, res) => {
    try {
      const { code, nom, latitude, longitude, actif } = req.body;
      if (!nom || latitude == null || longitude == null) {
        return res.status(400).json({ error: 'nom, latitude et longitude sont obligatoires' });
      }
      if (!coordonneesValides(latitude, longitude)) {
        return res.status(400).json({ error: 'Latitude [-90,90] et longitude [-180,180] invalides' });
      }
      const nouveauCode = await codeOuGeneration(pool, code, 'A');
      const resultat = await pool.query(`
        INSERT INTO arrets (code, nom, position, actif)
        VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5)
        RETURNING id, code, nom, actif,
                  ST_Y(position) AS latitude, ST_X(position) AS longitude
      `, [nouveauCode, nom, Number(longitude), Number(latitude), actif ?? true]);
      res.status(201).json({ success: true, data: resultat.rows[0] });
    } catch (error) {
      repondreErreur(res, error, { 23505: 'Ce code existe déjà' });
    }
  });

  router.put('/stops/:id', async (req, res) => {
    try {
      const existant = await pool.query(
        'SELECT id FROM arrets WHERE id = $1 AND archive_le IS NULL',
        [req.params.id],
      );
      if (existant.rowCount === 0) return res.status(404).json({ error: 'Arrêt non trouvé' });

      const { code, nom, latitude, longitude, actif } = req.body;
      if ((latitude != null || longitude != null) && !coordonneesValides(latitude, longitude)) {
        return res.status(400).json({ error: 'Latitude [-90,90] et longitude [-180,180] invalides' });
      }
      const resultat = await pool.query(`
        UPDATE arrets
        SET code = COALESCE($1, code), nom = COALESCE($2, nom),
            position = CASE WHEN $3::float8 IS NULL OR $4::float8 IS NULL THEN position
                            ELSE ST_SetSRID(ST_MakePoint($3, $4), 4326) END,
            actif = COALESCE($5, actif), modifie_le = now()
        WHERE id = $6 AND archive_le IS NULL
        RETURNING id, code, nom, actif,
                  ST_Y(position) AS latitude, ST_X(position) AS longitude
      `, [code ?? null, nom ?? null, latitude ?? null, longitude ?? null, actif ?? null, req.params.id]);
      res.json({ success: true, data: resultat.rows[0] });
    } catch (error) {
      repondreErreur(res, error, { 23505: 'Ce code existe déjà' });
    }
  });

  router.delete('/stops/:id', async (req, res) => {
    try {
      const resultat = await pool.query(
        'UPDATE arrets SET archive_le = now() WHERE id = $1 AND archive_le IS NULL RETURNING id, code, nom, archive_le',
        [req.params.id],
      );
      if (resultat.rowCount === 0) return res.status(404).json({ error: 'Arrêt non trouvé' });
      res.json({ success: true, message: 'Arrêt archivé', data: resultat.rows[0] });
    } catch (error) {
      repondreErreur(res, error);
    }
  });

  return router;
}
