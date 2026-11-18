import type { Response } from 'express';
import { Requete } from '../../commun/crud-reflect';

export function adapterRequete(requete: Requete) {
  let index = 1;
  const sqlPostgres = requete.sql.replace(/\?/g, () => `$${index++}`);
  return { sql: sqlPostgres, params: requete.params };
}

export function repondreErreur(
  res: Response,
  error: any,
  messages: Record<string, string> = {},
): void {
  const code = typeof error?.code === 'string' ? error.code : '';
  const message = messages[code] ?? (typeof error?.message === 'string' ? error.message : 'Erreur serveur');
  const statut =
    code === '23505'
      ? 409
      : code === '23502' || code === '23503' || code === '23514' || code === '22023' ||
          code === '22P02' || code === '22007'
        ? 400
        : 500;
  res.status(statut).json({ error: message });
}
