/**
 * CRUD générique par réflexion (équivalent TypeScript de java.lang.reflect).
 *
 * Les champs de l'objet sont lus avec Reflect.ownKeys() et Reflect.get(),
 * comme getDeclaredFields() et field.get() en Java. Les métadonnées
 * (table, clé primaire, champs ignorés) sont lues sur la classe, comme
 * les annotations @Table, @Id et @Transient.
 *
 * Les requêtes sont paramétrées (?) : les valeurs ne sont jamais
 * concaténées dans le SQL.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ValeurSql = string | number | boolean | Date | null;

export interface Requete {
  sql: string;
  params: ValeurSql[];
}

/** Métadonnées statiques qu'une classe d'entité peut déclarer. */
export interface MetaEntite {
  table?: string;
  primaryKey?: string;
  transient?: readonly string[];
}

/** Pilote compatible avec mysql2/promise : connexion.execute(sql, params). */
export interface Connexion {
  execute(sql: string, params: ValeurSql[]): Promise<[unknown, unknown]>;
}

// ---------------------------------------------------------------------------
// Outils de réflexion
// ---------------------------------------------------------------------------

const IDENTIFIANT_VALIDE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const TABLES_EXCLUES = [
  'spatial_ref_sys', 
  'comptes',         
  'sessions',        
  'signalements',    
  'mouvements_points',
  'journal_audit'  
];
function verifierIdentifiant(nom: string): string {
  if (!IDENTIFIANT_VALIDE.test(nom)) {
    throw new Error(`Identifiant SQL invalide : "${nom}"`);
  }
  return nom;
}

function getClasse(entite: object): MetaEntite & { name: string } {
  const prototype = Reflect.getPrototypeOf(entite);
  if (prototype === null) throw new Error("L'entité n'a pas de prototype");
  return Reflect.get(prototype, 'constructor') as MetaEntite & { name: string };
}

// Équivalent de @Table
export function getTable(entite: object): string {
  const classe = getClasse(entite);
  const table = Reflect.has(classe, 'table')
    ? (Reflect.get(classe, 'table') as string)
    : classe.name.toLowerCase();
  return verifierIdentifiant(table);
}

// Équivalent de @Id
export function getClePrimaire(entite: object): string {
  const classe = getClasse(entite);
  const cle = Reflect.has(classe, 'primaryKey')
    ? (Reflect.get(classe, 'primaryKey') as string)
    : 'id';
  return verifierIdentifiant(cle);
}

// Équivalent de getDeclaredFields(), hors méthodes et champs @Transient
export function getChamps(entite: object): string[] {
  const classe = getClasse(entite);
  const ignores: readonly string[] = Reflect.has(classe, 'transient')
    ? (Reflect.get(classe, 'transient') as readonly string[])
    : [];

  return Reflect.ownKeys(entite)
    .filter((cle): cle is string => typeof cle === 'string')
    .filter((cle) => typeof Reflect.get(entite, cle) !== 'function')
    .filter((cle) => Reflect.get(entite, cle) !== undefined)
    .filter((cle) => !ignores.includes(cle))
    .map(verifierIdentifiant);
}

function lire(entite: object, champ: string): ValeurSql {
  const valeur: unknown = Reflect.get(entite, champ);
  if (valeur === undefined) return null;
  if (
    valeur === null ||
    typeof valeur === 'string' ||
    typeof valeur === 'number' ||
    typeof valeur === 'boolean' ||
    valeur instanceof Date
  ) {
    return valeur;
  }
  throw new Error(`Type non supporté pour le champ "${champ}"`);
}

// ---------------------------------------------------------------------------
// INSERT
// ---------------------------------------------------------------------------

export function insert<T extends object>(entite: T): Requete {
  const table = getTable(entite);
  const cle = getClePrimaire(entite);

  // La clé primaire vide est exclue (auto-incrément).
  const champs = getChamps(entite).filter(
    (champ) => !(champ === cle && lire(entite, champ) === null)
  );

  if (champs.length === 0) throw new Error('Aucun champ à insérer');

  const colonnes = champs.join(', ');
  const marqueurs = champs.map(() => '?').join(', ');

  return {
    sql: `INSERT INTO ${table} (${colonnes}) VALUES (${marqueurs})`,
    params: champs.map((champ) => lire(entite, champ)),
  };
}

// ---------------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------------

export function update<T extends object>(entite: T): Requete {
  const table = getTable(entite);
  const cle = getClePrimaire(entite);
  const id = lire(entite, cle);

  if (id === null) throw new Error(`UPDATE impossible : "${cle}" est vide`);

  const champs = getChamps(entite).filter((champ) => champ !== cle);
  if (champs.length === 0) throw new Error('Aucun champ à mettre à jour');

  const affectations = champs.map((champ) => `${champ} = ?`).join(', ');

  return {
    sql: `UPDATE ${table} SET ${affectations} WHERE ${cle} = ?`,
    params: [...champs.map((champ) => lire(entite, champ)), id],
  };
}

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

export function remove<T extends object>(entite: T): Requete {
  const table = getTable(entite);
  const cle = getClePrimaire(entite);
  const id = lire(entite, cle);

  if (id === null) throw new Error(`DELETE impossible : "${cle}" est vide`);

  return {
    sql: `DELETE FROM ${table} WHERE ${cle} = ?`,
    params: [id],
  };
}

// ---------------------------------------------------------------------------
// Exécution (optionnelle) avec un pilote réel
// ---------------------------------------------------------------------------

export async function executer(connexion: Connexion, requete: Requete): Promise<unknown> {
  const [resultat] = await connexion.execute(requete.sql, requete.params);
  return resultat;
}