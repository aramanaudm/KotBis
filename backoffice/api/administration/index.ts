import { Pool } from 'pg';
import { Router } from 'express';
import { roleRoutes } from './routes/role-routes';
import { ligneRoutes } from './routes/ligne-routes';
import { busRoutes } from './routes/bus-routes';
import { arretRoutes } from './routes/arret-routes';
import { zoneRoutes } from './routes/zone-routes';
import { trajetRoutes } from './routes/trajet-routes';
import { compteRoutes } from './routes/compte-routes';
import { staffRoutes } from './routes/staff-routes';
import { reportRoutes } from './routes/report-routes';
import { reviewRoutes } from './routes/review-routes';
import { pointRoutes } from './routes/point-routes';
import { dashboardRoutes } from './routes/dashboard-routes';

export function administrationRoutes(pool: Pool): Router {
  const router = Router();
  router.use(roleRoutes(pool));
  router.use(ligneRoutes(pool));
  router.use(busRoutes(pool));
  router.use(arretRoutes(pool));
  router.use(zoneRoutes(pool));
  router.use(trajetRoutes(pool));
  router.use(compteRoutes(pool));
  router.use(staffRoutes(pool));
  router.use(reportRoutes(pool));
  router.use(reviewRoutes(pool));
  router.use(pointRoutes(pool));
  router.use(dashboardRoutes(pool));
  return router;
}
