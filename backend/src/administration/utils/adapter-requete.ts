import { Requete } from '../../commun/crud-reflect';

export function adapterRequete(requete: Requete) {
  let index = 1;
  const sqlPostgres = requete.sql.replace(/\?/g, () => `$${index++}`);
  return { sql: sqlPostgres, params: requete.params };
}