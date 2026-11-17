import { Router } from 'express';
import { Pool } from 'pg';
import { insert, update, remove } from '../../commun/crud-reflect';
import { Compte } from '../entites/compte';
import { adapterRequete } from '../utils/adapter-requete';

export function compteRoutes(pool: Pool): Router {
  const router = Router();

  // GET all — jointure avec roles
  router.get('/accounts', async (_req, res) => {
    try {
      const resultat = await pool.query(`
        SELECT c.id, c.email, c.role_id, c.etat, c.identifiant_public,
               c.cree_le, c.modifie_le, c.version,
               r.code AS role_code, r.libelle AS role_libelle
        FROM comptes c
        JOIN roles r ON r.id = c.role_id
        ORDER BY c.id
      `);
      res.json({ success: true, data: resultat.rows });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET one
  router.get('/accounts/:id', async (req, res) => {
    try {
      const resultat = await pool.query(`
        SELECT c.id, c.email, c.role_id, c.etat, c.identifiant_public,
               c.cree_le, c.modifie_le, c.version,
               r.code AS role_code, r.libelle AS role_libelle
        FROM comptes c
        JOIN roles r ON r.id = c.role_id
        WHERE c.id = $1
      `, [req.params.id]);
      if (resultat.rowCount === 0) return res.status(404).json({ error: 'Compte non trouvé' });
      res.json({ success: true, data: resultat.rows[0] });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST
  router.post('/accounts', async (req, res) => {
    try {
      const { email, mot_de_passe_hash, role_id, etat, identifiant_public } = req.body;
      if (!email || !role_id || !etat || !identifiant_public) {
        return res.status(400).json({ error: 'email, role_id, etat et identifiant_public sont obligatoires' });
      }
      const compte = new Compte(
        null,
        email,
        mot_de_passe_hash ?? null,
        Number(role_id),
        etat,
        identifiant_public
      );
      const { sql, params } = adapterRequete(insert(compte));
      const resultat = await pool.query(sql + ' RETURNING *', params);
      res.status(201).json({ success: true, data: resultat.rows[0] });
    } catch (error: any) {
      if (error.code === '23505') return res.status(409).json({ error: 'Cet email ou identifiant_public existe déjà' });
      if (error.code === '23503') return res.status(400).json({ error: 'Le rôle spécifié n\'existe pas' });
      if (error.code === '23514') return res.status(400).json({ error: 'État invalide (invite, actif, inactif)' });
      res.status(500).json({ error: error.message });
    }
  });

  // PUT
  router.put('/accounts/:id', async (req, res) => {
    try {
      const { email, mot_de_passe_hash, role_id, etat, identifiant_public } = req.body;
      const compte = new Compte(
        Number(req.params.id),
        email,
        mot_de_passe_hash ?? null,
        Number(role_id),
        etat,
        identifiant_public
      );
      const { sql, params } = adapterRequete(update(compte));
      const resultat = await pool.query(sql + ' RETURNING *', params);
      if (resultat.rowCount === 0) return res.status(404).json({ error: 'Compte non trouvé' });
      res.json({ success: true, data: resultat.rows[0] });
    } catch (error: any) {
      if (error.code === '23505') return res.status(409).json({ error: 'Cet email ou identifiant_public existe déjà' });
      if (error.code === '23503') return res.status(400).json({ error: 'Le rôle spécifié n\'existe pas' });
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE (désactivation, pas suppression physique — RG10)
  router.delete('/accounts/:id', async (req, res) => {
    try {
      const resultat = await pool.query(
        'UPDATE comptes SET etat = $1, modifie_le = now() WHERE id = $2 RETURNING id, email, etat',
        ['inactif', req.params.id]
      );
      if (resultat.rowCount === 0) return res.status(404).json({ error: 'Compte non trouvé' });
      res.json({ success: true, message: 'Compte désactivé', data: resultat.rows[0] });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}