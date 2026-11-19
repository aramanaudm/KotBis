// Tests d'intégration PostgreSQL du référentiel réseau des favoris (KBE-40, EF-FAV-006).
// Utilise uniquement les tables existantes (arrets, lignes, trajets, trajet_arrets) :
// la table favoris n'existe pas encore (à créer par l'équipe BDD).
//
// ATTENTION : à lancer uniquement sur une base locale ou de test.
// Les données créées (codes « KBE40-… ») sont supprimées à la fin.
// Si PostgreSQL est indisponible, les tests sont ignorés.
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { fermerConnexionBdd, obtenirPool } from "../src/configuration/baseDeDonnees";
import { ReferentielReseauPostgres } from "../src/favoris/reseau.referentiel.postgres";

const TAG = `KBE40-${Date.now().toString(36)}`;
const referentiel = new ReferentielReseauPostgres();

let bddDisponible = false;
const ids = { arrets: [] as number[], lignes: [] as number[], trajets: [] as number[] };
let DESSERVI = 0; // actif, sur un trajet et une ligne actifs
let INACTIF = 0; // arrêt désactivé
let ARCHIVE = 0; // arrêt archivé
let TRAJET_ARCHIVE = 0; // desservi seulement par un trajet archivé
let LIGNE_INACTIVE = 0; // desservi seulement par une ligne inactive
let NON_DESSERVI = 0; // actif mais sur aucun trajet

async function requete(sql: string, params: unknown[] = []): Promise<number> {
  const { rows } = await obtenirPool().query(sql, params);
  return Number(rows[0].id);
}

async function creerArret(suffixe: string, actif = true, archive = false): Promise<number> {
  const id = await requete(
    `INSERT INTO arrets (code, nom, position, actif, archive_le)
     VALUES ($1, $2, ST_SetSRID(ST_MakePoint(57.5, -20.2), 4326), $3, $4) RETURNING id`,
    [`${TAG}-${suffixe}`, `Arrêt ${suffixe}`, actif, archive ? new Date() : null]
  );
  ids.arrets.push(id);
  return id;
}

async function creerTrajet(suffixe: string, arrets: number[], o: { ligneActive?: boolean; trajetArchive?: boolean } = {}) {
  const ligne = await requete(`INSERT INTO lignes (code, libelle, actif) VALUES ($1, $2, $3) RETURNING id`, [
    `${TAG}-L${suffixe}`.slice(0, 20),
    `Ligne ${suffixe}`,
    o.ligneActive ?? true
  ]);
  ids.lignes.push(ligne);
  const trajet = await requete(
    `INSERT INTO trajets (code, ligne_id, nom, direction, actif, archive_le)
     VALUES ($1, $2, 'Test', 'Aller', TRUE, $3) RETURNING id`,
    [`${TAG}-T${suffixe}`, ligne, o.trajetArchive ? new Date() : null]
  );
  ids.trajets.push(trajet);
  for (const [i, arret] of arrets.entries()) {
    await obtenirPool().query(`INSERT INTO trajet_arrets (trajet_id, ordre, arret_id) VALUES ($1, $2, $3)`, [
      trajet,
      i + 1,
      arret
    ]);
  }
}

describe("ReferentielReseauPostgres", () => {
  before(async () => {
    try {
      await obtenirPool().query("SELECT 1 FROM trajet_arrets LIMIT 1");
      bddDisponible = true;
    } catch {
      return;
    }
    DESSERVI = await creerArret("desservi");
    INACTIF = await creerArret("inactif", false);
    ARCHIVE = await creerArret("archive", true, true);
    TRAJET_ARCHIVE = await creerArret("trajet-archive");
    LIGNE_INACTIVE = await creerArret("ligne-inactive");
    NON_DESSERVI = await creerArret("non-desservi");
    await creerTrajet("1", [DESSERVI, INACTIF, ARCHIVE]);
    await creerTrajet("2", [TRAJET_ARCHIVE], { trajetArchive: true });
    await creerTrajet("3", [LIGNE_INACTIVE], { ligneActive: false });
  });

  after(async () => {
    if (bddDisponible) {
      const pool = obtenirPool();
      await pool.query("DELETE FROM trajet_arrets WHERE trajet_id = ANY($1::bigint[])", [ids.trajets]);
      await pool.query("DELETE FROM trajets WHERE id = ANY($1::bigint[])", [ids.trajets]);
      await pool.query("DELETE FROM lignes WHERE id = ANY($1::bigint[])", [ids.lignes]);
      await pool.query("DELETE FROM arrets WHERE id = ANY($1::bigint[])", [ids.arrets]);
    }
    await fermerConnexionBdd();
  });

  test("EF-FAV-006 : seul un arrêt actif desservi par un trajet et une ligne actifs est disponible", async (t) => {
    if (!bddDisponible) return t.skip("PostgreSQL indisponible");
    const resultat = await referentiel.trouverArrets([
      DESSERVI,
      INACTIF,
      ARCHIVE,
      TRAJET_ARCHIVE,
      LIGNE_INACTIVE,
      NON_DESSERVI
    ]);
    const dispo = new Map(resultat.map((a) => [a.id, a.disponible]));
    assert.equal(dispo.get(DESSERVI), true);
    assert.equal(dispo.get(INACTIF), false);
    assert.equal(dispo.get(ARCHIVE), false);
    assert.equal(dispo.get(TRAJET_ARCHIVE), false);
    assert.equal(dispo.get(LIGNE_INACTIVE), false);
    assert.equal(dispo.get(NON_DESSERVI), false);
    const desservi = resultat.find((a) => a.id === DESSERVI)!;
    assert.equal(desservi.code, `${TAG}-desservi`);
    assert.equal(typeof desservi.id, "number");
  });

  test("Un arrêt inexistant est absent du résultat ; liste vide sans requête", async (t) => {
    if (!bddDisponible) return t.skip("PostgreSQL indisponible");
    assert.deepEqual(await referentiel.trouverArrets([-1]), []);
    assert.deepEqual(await referentiel.trouverArrets([]), []);
  });
});
