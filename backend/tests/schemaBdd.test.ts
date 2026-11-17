import { test, after } from "node:test";
import assert from "node:assert/strict";
import { obtenirPool, fermerConnexionBdd } from "../src/configuration/baseDeDonnees";

// Les 18 tables du script database/kotbis_schema.sql (équipe BDD)
const TABLES_ATTENDUES = [
  "roles", "comptes", "personnel", "voyageurs", "sessions",
  "lignes", "bus", "arrets", "trajets", "trajet_arrets", "zones", "affectations_bus",
  "signalements", "historique_signalements", "avis", "historique_avis",
  "mouvements_points", "journal_audit"
];

after(async () => {
  await fermerConnexionBdd();
});

test("extensions postgis et btree_gist installées", async () => {
  const { rows } = await obtenirPool().query<{ extname: string }>(
    "SELECT extname FROM pg_extension WHERE extname = ANY($1)",
    [["postgis", "btree_gist"]]
  );
  assert.deepEqual(rows.map((r) => r.extname).sort(), ["btree_gist", "postgis"]);
});

test("les 18 tables du schéma BDD existent", async () => {
  const { rows } = await obtenirPool().query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
  );
  const presentes = rows.map((r) => r.table_name);
  assert.deepEqual(TABLES_ATTENDUES.filter((t) => !presentes.includes(t)), []);
});

test("chaque table a une clé primaire", async () => {
  const { rows } = await obtenirPool().query<{ table_name: string }>(
    `SELECT c.relname AS table_name
       FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid
      WHERE k.contype = 'p' AND c.relnamespace = 'public'::regnamespace`
  );
  const avecCle = rows.map((r) => r.table_name);
  assert.deepEqual(TABLES_ATTENDUES.filter((t) => !avecCle.includes(t)), []);
});

test("colonnes spatiales en EPSG:4326", async () => {
  const { rows } = await obtenirPool().query(
    `SELECT f_table_name AS table_name, f_geometry_column AS colonne, type, srid
       FROM geometry_columns WHERE f_table_schema = 'public' ORDER BY f_table_name`
  );
  assert.deepEqual(rows, [
    { table_name: "arrets", colonne: "position", type: "POINT", srid: 4326 },
    { table_name: "zones", colonne: "contour", type: "POLYGON", srid: 4326 }
  ]);
});

test("contraintes appliquées dans une transaction annulée (rien n'est enregistré)", async () => {
  const client = await obtenirPool().connect();
  try {
    await client.query("BEGIN");

    // CHECK chk_roles_code : un code de rôle inconnu est refusé
    await client.query("SAVEPOINT verification");
    await assert.rejects(
      client.query("INSERT INTO roles (id, code, libelle) VALUES (99, 'inconnu', 'Test')"),
      { code: "23514" }
    );
    await client.query("ROLLBACK TO SAVEPOINT verification");

    // Clé étrangère : une étape vers un trajet et un arrêt inexistants est refusée
    await assert.rejects(
      client.query("INSERT INTO trajet_arrets (trajet_id, ordre, arret_id) VALUES (-1, 1, -1)"),
      { code: "23503" }
    );
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});
