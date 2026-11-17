import { Pool } from 'pg';
import { Router } from 'express';
import { roleRoutes } from './routes/role-routes';

export function administrationRoutes(pool: Pool): Router {
  const router = Router();
  router.use(roleRoutes(pool));
  // Ajoute ici les autres routes au fur et à mesure
  return router;
}