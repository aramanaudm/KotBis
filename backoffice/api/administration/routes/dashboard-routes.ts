import { Router } from 'express';
import { Pool } from 'pg';

export function dashboardRoutes(pool: Pool): Router {
  const router = Router();

  router.get('/dashboard', async (_req, res) => {
    try {
      const indicateurs = await pool.query(`
        SELECT bus_en_service::int, zones_actives::int,
               comptes_voyageurs::int, signalements_a_verifier::int
        FROM v_indicateurs_tableau_de_bord
      `);

      const flotte = await pool.query(`
        SELECT b.id, b.plaque, b.etat, b.actif,
               t.code AS trajet_code, t.direction,
               l.code AS ligne_code, l.libelle AS ligne_libelle
        FROM bus b
        LEFT JOIN affectations_bus ab ON ab.bus_id = b.id
          AND ab.debut_le <= now()
          AND (ab.fin_le IS NULL OR ab.fin_le > now())
        LEFT JOIN trajets t ON t.id = ab.trajet_id
        LEFT JOIN lignes l ON l.id = t.ligne_id
        WHERE b.archive_le IS NULL
        ORDER BY b.id
      `);

      const avisAVerifier = await pool.query(
        "SELECT COUNT(*)::int AS total FROM avis WHERE statut = 'a_verifier'",
      );

      const arrets = await pool.query(
        'SELECT COUNT(*)::int AS total FROM arrets WHERE archive_le IS NULL',
      );
      const routes = await pool.query(
        'SELECT COUNT(*)::int AS total FROM trajets WHERE archive_le IS NULL',
      );

      res.json({
        success: true,
        data: {
          indicateurs: indicateurs.rows[0],
          flotte: flotte.rows,
          avis_a_moderer: avisAVerifier.rows[0].total,
          arrets_actifs: arrets.rows[0].total,
          trajets_actifs: routes.rows[0].total,
        },
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  return router;
}
