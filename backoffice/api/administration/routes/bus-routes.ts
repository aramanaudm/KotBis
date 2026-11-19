import { Router } from 'express';
import { Pool } from 'pg';
import { insert, update } from '../../commun/crud-reflect';
import { Bus } from '../entites/bus';
import { adapterRequete, repondreErreur } from '../utils/adapter-requete';

const SELECT_BUS = `
  SELECT b.*, t.code AS trajet_code, t.direction,
         l.code AS ligne_code, l.libelle AS ligne_libelle
  FROM bus b
  LEFT JOIN affectations_bus ab ON ab.bus_id = b.id
    AND ab.debut_le <= now() AND (ab.fin_le IS NULL OR ab.fin_le > now())
  LEFT JOIN trajets t ON t.id = ab.trajet_id
  LEFT JOIN lignes l ON l.id = t.ligne_id
`;

async function agentSysteme(client: any): Promise<number> {
  const existant = await client.query('SELECT compte_id FROM personnel ORDER BY compte_id LIMIT 1');
  if ((existant.rowCount ?? 0) > 0) {
    return Number(existant.rows[0].compte_id);
  }
  await client.query(`
    INSERT INTO comptes (email, etat, role_id, identifiant_public)
    VALUES ('system@kotbis.local', 'invite', (SELECT id FROM roles WHERE code = 'administrateur'), 'system_backoffice')
    ON CONFLICT DO NOTHING
  `);
  const compte = await client.query(
    "SELECT id FROM comptes WHERE identifiant_public = 'system_backoffice'",
  );
  await client.query(
    `
      INSERT INTO personnel (compte_id, nom_affiche, fonction) VALUES ($1, 'Système', 'Back-office')
      ON CONFLICT DO NOTHING
    `,
    [compte.rows[0].id],
  );
  return Number(compte.rows[0].id);
}

async function resoudreTrajet(client: any, valeur: unknown): Promise<number | null | undefined> {
  if (valeur === undefined) {
    return undefined;
  }
  const code = String(valeur ?? '').trim();
  if (!code) {
    return null;
  }
  const resultat = await client.query(
    'SELECT id FROM trajets WHERE code = $1 AND archive_le IS NULL',
    [code],
  );
  if ((resultat.rowCount ?? 0) === 0) {
    throw Object.assign(new Error('Trajet introuvable'), { code: 'TRAJET_INCONNU' });
  }
  return Number(resultat.rows[0].id);
}

async function appliquerAffectation(
  client: any,
  busId: number,
  trajetId: number | null | undefined,
): Promise<void> {
  if (trajetId === undefined) {
    return;
  }
  await client.query('UPDATE affectations_bus SET fin_le = now() WHERE bus_id = $1 AND fin_le IS NULL', [
    busId,
  ]);
  if (trajetId !== null) {
    await client.query(
      `
        INSERT INTO affectations_bus (bus_id, trajet_id, debut_le, cree_par)
        VALUES ($1, $2, now(), $3)
      `,
      [busId, trajetId, await agentSysteme(client)],
    );
  }
}

export function busRoutes(pool: Pool): Router {
  const router = Router();

  router.get('/buses', async (_req, res) => {
    try {
      const resultat = await pool.query(`${SELECT_BUS} WHERE b.archive_le IS NULL ORDER BY b.id`);
      res.json({ success: true, data: resultat.rows });
    } catch (error) {
      repondreErreur(res, error);
    }
  });

  router.get('/buses/:id', async (req, res) => {
    try {
      const resultat = await pool.query(`${SELECT_BUS} WHERE b.id = $1 AND b.archive_le IS NULL`, [
        req.params.id,
      ]);
      if (resultat.rowCount === 0) return res.status(404).json({ error: 'Bus non trouvé' });
      res.json({ success: true, data: resultat.rows[0] });
    } catch (error) {
      repondreErreur(res, error);
    }
  });

  router.post('/buses', async (req, res) => {
    const client = await pool.connect();
    let transaction = false;
    try {
      const { plaque, etat, actif, trajet_code, trajetCode } = req.body;
      if (!plaque) return res.status(400).json({ error: 'La plaque est obligatoire' });
      await client.query('BEGIN');
      transaction = true;
      const bus = new Bus(null, plaque, etat ?? 'actif', actif ?? true);
      const { sql, params } = adapterRequete(insert(bus));
      const cree = await client.query(sql + ' RETURNING *', params);
      const busId = Number(cree.rows[0].id);
      const trajet = await resoudreTrajet(client, trajet_code ?? trajetCode);
      await appliquerAffectation(client, busId, trajet);
      await client.query('COMMIT');
      transaction = false;
      const resultat = await pool.query(`${SELECT_BUS} WHERE b.id = $1`, [busId]);
      res.status(201).json({ success: true, data: resultat.rows[0] });
    } catch (error: any) {
      if (transaction) await client.query('ROLLBACK');
      if (error?.code === 'TRAJET_INCONNU') {
        return res.status(400).json({ error: error.message });
      }
      repondreErreur(res, error, {
        23505: 'Cette plaque existe déjà',
        23514: 'État invalide (actif, inactif, en_panne)',
      });
    } finally {
      client.release();
    }
  });

  router.put('/buses/:id', async (req, res) => {
    const client = await pool.connect();
    let transaction = false;
    try {
      const { plaque, etat, actif, trajet_code, trajetCode } = req.body;
      const key = 'trajet_code' in req.body || 'trajetCode' in req.body;
      await client.query('BEGIN');
      transaction = true;
      const bus = new Bus(Number(req.params.id), plaque, etat, actif);
      const { sql, params } = adapterRequete(update(bus));
      const modifie = await client.query(sql + ' RETURNING id', params);
      if (modifie.rowCount === 0) {
        await client.query('ROLLBACK');
        transaction = false;
        return res.status(404).json({ error: 'Bus non trouvé' });
      }
      const busId = Number(modifie.rows[0].id);
      const trajet = key ? await resoudreTrajet(client, trajet_code ?? trajetCode) : undefined;
      await appliquerAffectation(client, busId, trajet);
      await client.query('COMMIT');
      transaction = false;
      const resultat = await pool.query(`${SELECT_BUS} WHERE b.id = $1`, [busId]);
      res.json({ success: true, data: resultat.rows[0] });
    } catch (error: any) {
      if (transaction) await client.query('ROLLBACK');
      if (error?.code === 'TRAJET_INCONNU') {
        return res.status(400).json({ error: error.message });
      }
      repondreErreur(res, error, {
        23505: 'Cette plaque existe déjà',
        23514: 'État invalide (actif, inactif, en_panne)',
      });
    } finally {
      client.release();
    }
  });

  router.delete('/buses/:id', async (req, res) => {
    const client = await pool.connect();
    let transaction = false;
    try {
      await client.query('BEGIN');
      transaction = true;
      const resultat = await client.query(
        'UPDATE bus SET archive_le = now() WHERE id = $1 AND archive_le IS NULL RETURNING *',
        [req.params.id],
      );
      if (resultat.rowCount === 0) {
        await client.query('ROLLBACK');
        transaction = false;
        return res.status(404).json({ error: 'Bus non trouvé' });
      }
      await client.query(
        'UPDATE affectations_bus SET fin_le = now() WHERE bus_id = $1 AND fin_le IS NULL',
        [req.params.id],
      );
      await client.query('COMMIT');
      transaction = false;
      res.json({ success: true, message: 'Bus archivé', data: resultat.rows[0] });
    } catch (error) {
      if (transaction) await client.query('ROLLBACK');
      repondreErreur(res, error);
    } finally {
      client.release();
    }
  });

  router.post('/buses/:id/assign', async (req, res) => {
    const client = await pool.connect();
    let transaction = false;
    try {
      const { trajet_id } = req.body;
      if (!trajet_id) {
        return res.status(400).json({ error: 'trajet_id est obligatoire' });
      }

      await client.query('BEGIN');
      transaction = true;

      const bus = await client.query(
        'SELECT id FROM bus WHERE id = $1 AND archive_le IS NULL',
        [req.params.id],
      );
      if (bus.rowCount === 0) {
        await client.query('ROLLBACK');
        transaction = false;
        return res.status(404).json({ error: 'Bus non trouvé' });
      }

      const trajet = await client.query(
        'SELECT id FROM trajets WHERE id = $1 AND archive_le IS NULL',
        [trajet_id],
      );
      if (trajet.rowCount === 0) {
        await client.query('ROLLBACK');
        transaction = false;
        return res.status(404).json({ error: 'Trajet non trouvé' });
      }

      await client.query(
        'UPDATE affectations_bus SET fin_le = now() WHERE bus_id = $1 AND fin_le IS NULL',
        [req.params.id],
      );

      const resultat = await client.query(
        `
          INSERT INTO affectations_bus (bus_id, trajet_id, debut_le, cree_par)
          VALUES ($1, $2, now(), $3)
          RETURNING id, bus_id, trajet_id, debut_le
        `,
        [req.params.id, trajet_id, await agentSysteme(client)],
      );

      await client.query('COMMIT');
      transaction = false;
      res.status(201).json({ success: true, data: resultat.rows[0] });
    } catch (error) {
      if (transaction) await client.query('ROLLBACK');
      repondreErreur(res, error, {
        23503: 'Référence invalide (bus ou trajet)',
        '23P01': 'Ce bus a déjà une affectation qui chevauche cette période',
      });
    } finally {
      client.release();
    }
  });

  return router;
}
