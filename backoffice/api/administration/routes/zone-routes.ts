import { Router } from 'express';
import { Pool } from 'pg';
import { repondreErreur } from '../utils/adapter-requete';

type Point = [number, number];

function contourValide(contour: any): boolean {
  if (!contour || contour.type !== 'Polygon' || !Array.isArray(contour.coordinates)) {
    return false;
  }
  const ring = contour.coordinates[0];
  if (!Array.isArray(ring) || ring.length < 4) {
    return false;
  }
  const points: Point[] = ring.map((point: unknown) => {
    const coordonnee = point as unknown[];
    return [Number(coordonnee?.[0]), Number(coordonnee?.[1])];
  });
  if (points.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y))) {
    return false;
  }
  if (points[0][0] !== points[points.length - 1][0] || points[0][1] !== points[points.length - 1][1]) {
    return false;
  }
  let surface = 0;
  for (let i = 0; i < points.length - 1; i++) {
    surface += points[i][0] * points[i + 1][1] - points[i + 1][0] * points[i][1];
  }
  return Math.abs(surface) > 0;
}

async function codeZone(pool: Pool, code: unknown): Promise<string> {
  if (typeof code === 'string' && code.trim()) {
    return code.trim();
  }
  const resultat = await pool.query(
    "SELECT nextval(pg_get_serial_sequence('zones', 'id'))::int AS n",
  );
  return `Z${String(resultat.rows[0].n).padStart(4, '0')}`;
}

export function zoneRoutes(pool: Pool): Router {
  const router = Router();

  router.get('/zones', async (_req, res) => {
    try {
      const resultat = await pool.query(`
        SELECT id, code, nom, actif, archive_le, version, cree_le, modifie_le,
               ST_AsGeoJSON(contour)::json AS contour
        FROM zones
        WHERE archive_le IS NULL
        ORDER BY id
      `);
      res.json({ success: true, data: resultat.rows });
    } catch (error) {
      repondreErreur(res, error);
    }
  });

  router.get('/zones/:id', async (req, res) => {
    try {
      const resultat = await pool.query(`
        SELECT id, code, nom, actif, archive_le, version, cree_le, modifie_le,
               ST_AsGeoJSON(contour)::json AS contour
        FROM zones
        WHERE id = $1 AND archive_le IS NULL
      `, [req.params.id]);
      if (resultat.rowCount === 0) return res.status(404).json({ error: 'Zone non trouvée' });
      res.json({ success: true, data: resultat.rows[0] });
    } catch (error) {
      repondreErreur(res, error);
    }
  });

  router.get('/zones/:id/stops', async (req, res) => {
    try {
      const zone = await pool.query(
        'SELECT id FROM zones WHERE id = $1 AND archive_le IS NULL',
        [req.params.id],
      );
      if (zone.rowCount === 0) return res.status(404).json({ error: 'Zone non trouvée' });

      const resultat = await pool.query(`
        SELECT a.id, a.code, a.nom, a.actif,
               ST_Y(a.position) AS latitude, ST_X(a.position) AS longitude
        FROM zones z
        JOIN arrets a ON a.archive_le IS NULL AND ST_Intersects(z.contour, a.position)
        WHERE z.id = $1
        ORDER BY a.nom
      `, [req.params.id]);
      res.json({ success: true, data: resultat.rows });
    } catch (error) {
      repondreErreur(res, error);
    }
  });

  router.get('/zones/:id/buses', async (req, res) => {
    try {
      const zone = await pool.query(
        'SELECT id FROM zones WHERE id = $1 AND archive_le IS NULL',
        [req.params.id],
      );
      if (zone.rowCount === 0) return res.status(404).json({ error: 'Zone non trouvée' });

      const resultat = await pool.query(`
        SELECT DISTINCT b.id, b.plaque, b.etat, b.actif,
               t.code AS trajet_code, t.direction,
               l.code AS ligne_code, l.libelle AS ligne_libelle
        FROM bus b
        JOIN affectations_bus ab ON ab.bus_id = b.id
          AND ab.debut_le <= now()
          AND (ab.fin_le IS NULL OR ab.fin_le > now())
        JOIN trajets t ON t.id = ab.trajet_id
        JOIN trajet_arrets ta ON ta.trajet_id = t.id
        JOIN arrets a ON a.id = ta.arret_id
        JOIN zones z ON ST_Covers(z.contour, a.position)
        LEFT JOIN lignes l ON l.id = t.ligne_id
        WHERE z.id = $1
          AND b.archive_le IS NULL
        ORDER BY b.plaque
      `, [req.params.id]);
      res.json({ success: true, data: resultat.rows });
    } catch (error) {
      repondreErreur(res, error);
    }
  });

  router.post('/zones', async (req, res) => {
    try {
      const { code, nom, contour, actif } = req.body;
      if (!nom) {
        return res.status(400).json({ error: 'Le nom est obligatoire' });
      }
      if (!contourValide(contour)) {
        return res.status(400).json({ error: 'Contour invalide : polygone fermé non vide requis' });
      }
      const resultat = await pool.query(`
        INSERT INTO zones (code, nom, contour, actif)
        VALUES ($1, $2, ST_SetSRID(ST_GeomFromGeoJSON($3), 4326), $4)
        RETURNING id, code, nom, actif, ST_AsGeoJSON(contour)::json AS contour
      `, [await codeZone(pool, code), nom, JSON.stringify(contour), actif ?? false]);
      res.status(201).json({ success: true, data: resultat.rows[0] });
    } catch (error) {
      repondreErreur(res, error, {
        23505: 'Ce code existe déjà',
        23514: 'Contour invalide (polygone non valide, vide ou de surface nulle)',
      });
    }
  });

  router.put('/zones/:id', async (req, res) => {
    try {
      const existante = await pool.query(
        'SELECT id FROM zones WHERE id = $1 AND archive_le IS NULL',
        [req.params.id],
      );
      if (existante.rowCount === 0) return res.status(404).json({ error: 'Zone non trouvée' });

      const { code, nom, contour, actif } = req.body;
      if (contour != null && !contourValide(contour)) {
        return res.status(400).json({ error: 'Contour invalide : polygone fermé non vide requis' });
      }
      const resultat = await pool.query(`
        UPDATE zones
        SET code = COALESCE($1, code), nom = COALESCE($2, nom),
            contour = CASE WHEN $3::text IS NULL THEN contour
                           ELSE ST_SetSRID(ST_GeomFromGeoJSON($3), 4326) END,
            actif = COALESCE($4, actif), modifie_le = now()
        WHERE id = $5 AND archive_le IS NULL
        RETURNING id, code, nom, actif, ST_AsGeoJSON(contour)::json AS contour
      `, [code ?? null, nom ?? null, contour ? JSON.stringify(contour) : null, actif ?? null, req.params.id]);
      res.json({ success: true, data: resultat.rows[0] });
    } catch (error) {
      repondreErreur(res, error, {
        23505: 'Ce code existe déjà',
        23514: 'Contour invalide (polygone non valide, vide ou de surface nulle)',
      });
    }
  });

  router.delete('/zones/:id', async (req, res) => {
    try {
      const resultat = await pool.query(
        'UPDATE zones SET archive_le = now() WHERE id = $1 AND archive_le IS NULL RETURNING id, code, nom, archive_le',
        [req.params.id],
      );
      if (resultat.rowCount === 0) return res.status(404).json({ error: 'Zone non trouvée' });
      res.json({ success: true, message: 'Zone archivée', data: resultat.rows[0] });
    } catch (error) {
      repondreErreur(res, error);
    }
  });

  return router;
}
