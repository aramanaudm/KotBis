import { Pool } from 'pg';
import { Router } from 'express';
import { roleRoutes } from './routes/role-routes';
import { ligneRoutes } from './routes/ligne-routes';
import { busRoutes } from './routes/bus-routes';

export function administrationRoutes(pool: Pool): Router {
  const router = Router();
  router.use(roleRoutes(pool));
  router.use(ligneRoutes(pool));
  router.use(busRoutes(pool));
  return router;
}