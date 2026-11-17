import { Pool } from 'pg';
import { Router } from 'express';
import { roleRoutes } from './routes/role-routes';
import { ligneRoutes } from './routes/ligne-routes';
import { busRoutes } from './routes/bus-routes';
import { arretRoutes } from './routes/arret-routes';
import { zoneRoutes } from './routes/zone-routes';
import { trajetRoutes } from './routes/trajet-routes';

export function administrationRoutes(pool: Pool): Router {
  const router = Router();
  router.use(roleRoutes(pool));
  router.use(ligneRoutes(pool));
  router.use(busRoutes(pool));
  router.use(arretRoutes(pool));
  router.use(zoneRoutes(pool));
  router.use(trajetRoutes(pool));
  return router;
}