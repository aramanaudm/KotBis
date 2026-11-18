import { Pool, PoolClient, PoolConfig, QueryResultRow } from "pg";
import "dotenv/config";

// Variables d'environnement obligatoires pour la connexion PostgreSQL
const VARIABLES_OBLIGATOIRES = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"] as const;

// Message unique renvoyé à l'extérieur : il ne révèle aucun secret
export const MESSAGE_BDD_INDISPONIBLE = "Base de données indisponible";

// Erreur de connexion sans détail sensible (mot de passe, hôte, utilisateur)
export class ErreurBaseDeDonnees extends Error {
  readonly code?: string;

  constructor(code?: string) {
    super(MESSAGE_BDD_INDISPONIBLE);
    this.name = "ErreurBaseDeDonnees";
    this.code = code;
  }
}

// Lit et vérifie la configuration ; seuls les noms des variables manquantes sont cités
export function lireConfigurationBdd(env: NodeJS.ProcessEnv = process.env): PoolConfig {
  const manquantes = VARIABLES_OBLIGATOIRES.filter((nom) => !env[nom]);
  if (manquantes.length > 0) {
    throw new Error(`Configuration BDD incomplète : ${manquantes.join(", ")}`);
  }

  const port = Number(env.DB_PORT);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("Configuration BDD invalide : DB_PORT");
  }

  return {
    host: env.DB_HOST,
    port,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    connectionTimeoutMillis: 5000
  };
}

// Code technique sûr à journaliser (ex. 28P01, 3D000, ECONNREFUSED)
export function codeErreurPostgres(erreur: unknown): string | undefined {
  if (erreur && typeof erreur === "object" && "code" in erreur) {
    return String((erreur as { code: unknown }).code);
  }
  return undefined;
}

let pool: Pool | undefined;

// Pool de connexions partagé, créé au premier appel
export function obtenirPool(): Pool {
  if (!pool) {
    pool = new Pool(lireConfigurationBdd());

    // Sans ce gestionnaire, une erreur sur une connexion inactive arrête le processus
    pool.on("error", (erreur) => {
      console.error(`[BDD] Erreur sur une connexion inactive (code : ${codeErreurPostgres(erreur) ?? "inconnu"})`);
    });
  }
  return pool;
}

// Exécute une requête ; en cas d'échec de PostgreSQL, aucun secret n'est révélé
async function executer<T extends QueryResultRow>(texte: string, parametres: unknown[] = []): Promise<T[]> {
  // Hors du try : une configuration incomplète garde son message (noms des variables)
  const poolBdd = obtenirPool();
  try {
    const resultat = await poolBdd.query<T>(texte, parametres);
    return resultat.rows;
  } catch (erreur) {
    throw new ErreurBaseDeDonnees(codeErreurPostgres(erreur));
  }
}

// Encapsule une opération dans une transaction BEGIN / COMMIT / ROLLBACK
export async function avecTransaction<T>(
  poolBdd: Pool,
  action: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await poolBdd.connect();
  let transactionOuverte = false;
  try {
    await client.query("BEGIN");
    transactionOuverte = true;
    const resultat = await action(client);
    await client.query("COMMIT");
    transactionOuverte = false;
    return resultat;
  } catch (erreur) {
    if (transactionOuverte) {
      try {
        await client.query("ROLLBACK");
      } catch (erreurRollback) {
        console.error(`[BDD] Échec du rollback (code : ${codeErreurPostgres(erreurRollback) ?? "inconnu"})`);
      }
    }
    throw erreur;
  } finally {
    client.release();
  }
}

// Vérifie que la connexion à PostgreSQL fonctionne
export async function verifierConnexionBdd(): Promise<void> {
  await executer("SELECT 1");
}

// CA-004 : lit une table réelle du schéma KotBis et renvoie son nombre de lignes
export async function verifierLectureBdd(): Promise<number> {
  const [ligne] = await executer<{ nombre: number }>("SELECT count(*)::int AS nombre FROM roles");
  return ligne.nombre;
}

// CA-005 : vérifie que PostGIS est activé et calcule correctement ; renvoie sa version
export async function verifierPostgis(): Promise<string> {
  const [extension] = await executer<{ version: string }>(
    "SELECT extversion AS version FROM pg_extension WHERE extname = 'postgis'"
  );
  if (!extension) {
    throw new Error("PostGIS n'est pas activé dans la base");
  }

  // Point à Maurice en EPSG:4326 (X = longitude, Y = latitude), comme arrets.position
  const [point] = await executer<{ wkt: string }>(
    "SELECT ST_AsText(ST_SetSRID(ST_MakePoint($1, $2), 4326)) AS wkt",
    [57.5, -20.2]
  );
  if (point.wkt !== "POINT(57.5 -20.2)") {
    throw new Error("PostGIS ne répond pas correctement");
  }
  return extension.version;
}

// Ferme le pool (fin des tests, arrêt du serveur)
export async function fermerConnexionBdd(): Promise<void> {
  if (pool) {
    const ancien = pool;
    pool = undefined;
    await ancien.end();
  }
}
