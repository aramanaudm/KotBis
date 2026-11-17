import { Pool } from 'pg';
import { Router } from 'express';
import { roleRoutes } from './routes/role-routes';
import { ligneRoutes } from './routes/ligne-routes';

export function administrationRoutes(pool: Pool): Router {
  const router = Router();
  router.use(roleRoutes(pool));
  router.use(ligneRoutes(pool));
  return router;
}