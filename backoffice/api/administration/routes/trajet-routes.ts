import { Router } from 'express';
import { Pool, PoolClient } from 'pg';
import { insert, update } from '../../commun/crud-reflect';
import { Trajet } from '../entites/trajet';
import { adapterRequete, repondreErreur } from '../utils/adapter-requete';

async function lireLigneId(client: PoolClient, ligneId: unknown, ligneCode: unknown): Promise<number | undefined> {
  if (ligneId != null && ligneId !== '') {
    return Number(ligneId);
  }
  if (typeof ligneCode === 'string' && ligneCode.trim()) {
    const resultat = await client.query(
      'SELECT id FROM lignes WHERE code = $1 AND archive_le IS NULL',
      [ligneCode.trim()],
    );
    if (resultat.rowCount === 0) {
      throw Object.assign(new Error("La ligne spécifiée n'existe pas"), { code: 'LIGNE_INCONNUE' });
    }
    return Number(resultat.rows[0].id);
  }
  return undefined;
}

async function codeTrajet(client: PoolClient, code: unknown): Promise<string> {
  if (typeof code === 'string' && code.trim()) {
    return code.trim();
  }
  const resultat = await client.query(
    "SELECT nextval(pg_get_serial_sequence('trajets', 'id'))::int AS n",
  );
  return `T${String(resultat.rows[0].n).padStart(4, '0')}`;
}

async function remplacerArrets(
  client: PoolClient,
  trajetId: number,
  stopIds: unknown,
): Promise<void> {
  if (!Array.isArray(stopIds)) {
    return;
  }
  await client.query('DELETE FROM trajet_arrets WHERE trajet_id = $1', [trajetId]);
  const ids = stopIds.map((id) => Number(id)).filter((id) => Number.isFinite(id));
  for (let index = 0; index < ids.length; index++) {
    await client.query(
      `INSERT INTO trajet_arrets (trajet_id, ordre, arret_id)
       SELECT $1, $2, a.id FROM arrets a WHERE a.id = $3 AND a.archive_le IS NULL`,
      [trajetId, index + 1, ids[index]],
    );
  }
}

async function trajetsAvecArrets(pool: Pool, where = '', params: unknown[] = []) {
  const resultat = await pool.query(`
    SELECT t.*, l.code AS ligne_code, l.libelle AS ligne_libelle,
           COALESCE((
             SELECT json_agg(a.nom ORDER BY ta.ordre)
             FROM trajet_arrets ta JOIN arrets a ON a.id = ta.arret_id
             WHERE ta.trajet_id = t.id
           ), '[]'::json) AS stops,
           COALESCE((
             SELECT json_agg(ta.arret_id ORDER BY ta.ordre)
             FROM trajet_arrets ta
             WHERE ta.trajet_id = t.id
           ), '[]'::json) AS stop_ids
    FROM trajets t
    JOIN lignes l ON l.id = t.ligne_id
    ${where}
    ORDER BY t.id
  `, params);
  return resultat;
}

export function trajetRoutes(pool: Pool): Router {
  const router = Router();

  router.get('/routes', async (_req, res) => {
    try {
      const resultat = await trajetsAvecArrets(pool, 'WHERE t.archive_le IS NULL');
      res.json({ success: true, data: resultat.rows });
    } catch (error) {
      repondreErreur(res, error);
    }
  });

  router.get('/routes/:id', async (req, res) => {
    try {
      const resultat = await trajetsAvecArrets(pool, 'WHERE t.id = $1 AND t.archive_le IS NULL', [req.params.id]);
      if (resultat.rowCount === 0) return res.status(404).json({ error: 'Trajet non trouvé' });
      res.json({ success: true, data: resultat.rows[0] });
    } catch (error) {
      repondreErreur(res, error);
    }
  });

  router.post('/routes', async (req, res) => {
    const client = await pool.connect();
    try {
      const { code, ligne_id, ligne_code, nom, direction, actif, stop_ids } = req.body;
      if (!nom || !direction) {
        return res.status(400).json({ error: 'nom et direction sont obligatoires' });
      }
      const ligneId = await lireLigneId(client, ligne_id, ligne_code);
      if (ligneId == null) {
        return res.status(400).json({ error: 'Une ligne valide est obligatoire' });
      }
      await client.query('BEGIN');
      const trajet = new Trajet(null, await codeTrajet(client, code), ligneId, nom, direction, actif ?? false);
      const { sql, params } = adapterRequete(insert(trajet));
      const cree = await client.query(sql + ' RETURNING *', params);
      const trajetId = Number(cree.rows[0].id);
      await remplacerArrets(client, trajetId, stop_ids);
      await client.query('COMMIT');
      res.status(201).json({ success: true, data: cree.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      repondreErreur(res, error, {
        23505: 'Ce code existe déjà',
        LIGNE_INCONNUE: "La ligne spécifiée n'existe pas",
      });
    } finally {
      client.release();
    }
  });

  router.put('/routes/:id', async (req, res) => {
    const client = await pool.connect();
    try {
      const existant = await client.query(
        'SELECT id FROM trajets WHERE id = $1 AND archive_le IS NULL',
        [req.params.id],
      );
      if (existant.rowCount === 0) return res.status(404).json({ error: 'Trajet non trouvé' });

      const { code, ligne_id, ligne_code, nom, direction, actif, stop_ids } = req.body;
      const ligneId = await lireLigneId(client, ligne_id, ligne_code);
      await client.query('BEGIN');
      const trajet = new Trajet(Number(req.params.id), code, ligneId, nom, direction, actif);
      const { sql, params } = adapterRequete(update(trajet));
      const modifie = await client.query(sql + ' RETURNING *', params);
      await remplacerArrets(client, Number(req.params.id), stop_ids);
      await client.query('COMMIT');
      res.json({ success: true, data: modifie.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      repondreErreur(res, error, {
        23505: 'Ce code existe déjà',
        LIGNE_INCONNUE: "La ligne spécifiée n'existe pas",
      });
    } finally {
      client.release();
    }
  });

  router.delete('/routes/:id', async (req, res) => {
    try {
      const resultat = await pool.query(
        'UPDATE trajets SET archive_le = now() WHERE id = $1 AND archive_le IS NULL RETURNING *',
        [req.params.id],
      );
      if (resultat.rowCount === 0) return res.status(404).json({ error: 'Trajet non trouvé' });
      res.json({ success: true, message: 'Trajet archivé', data: resultat.rows[0] });
    } catch (error) {
      repondreErreur(res, error);
    }
  });

  return router;
}
