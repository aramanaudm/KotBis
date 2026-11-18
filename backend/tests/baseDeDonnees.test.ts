import { test, after } from "node:test";
import assert from "node:assert/strict";
import {
  lireConfigurationBdd,
  verifierConnexionBdd,
  verifierLectureBdd,
  verifierPostgis,
  fermerConnexionBdd,
  ErreurBaseDeDonnees,
  MESSAGE_BDD_INDISPONIBLE
} from "../src/configuration/baseDeDonnees";

after(async () => {
  await fermerConnexionBdd();
});

test("variable manquante : seul son nom est cité", () => {
  assert.throws(
    () => lireConfigurationBdd({ DB_HOST: "localhost", DB_PORT: "5432", DB_NAME: "kotbis", DB_USER: "utilisateur_test" }),
    { message: "Configuration BDD incomplète : DB_PASSWORD" }
  );
});

test("port invalide refusé", () => {
  assert.throws(
    () => lireConfigurationBdd({ DB_HOST: "localhost", DB_PORT: "abc", DB_NAME: "kotbis", DB_USER: "u", DB_PASSWORD: "p" }),
    { message: "Configuration BDD invalide : DB_PORT" }
  );
});

test("connexion réussie avec la configuration du .env", async () => {
  await verifierConnexionBdd();
});

test("CA-004 : une lecture PostgreSQL fonctionne", async () => {
  const nombre = await verifierLectureBdd();
  assert.ok(Number.isInteger(nombre) && nombre >= 0);
});

test("CA-005 : PostGIS est disponible", async () => {
  const version = await verifierPostgis();
  assert.match(version, /^\d+\.\d+/);
});

test("connexion échouée : le message ne révèle aucun secret", async () => {
  const motDePasseReel = process.env.DB_PASSWORD;
  const motDePasseFaux = "mot_de_passe_faux_kbe21";

  await fermerConnexionBdd();
  process.env.DB_PASSWORD = motDePasseFaux;
  try {
    await assert.rejects(verifierConnexionBdd(), (erreur: unknown) => {
      assert.ok(erreur instanceof ErreurBaseDeDonnees);
      assert.equal(erreur.message, MESSAGE_BDD_INDISPONIBLE);
      assert.equal(erreur.code, "28P01");

      const texte = `${erreur.message} ${erreur.code}`;
      for (const secret of [motDePasseFaux, motDePasseReel, process.env.DB_USER, process.env.DB_HOST]) {
        if (secret) assert.ok(!texte.includes(secret), "un secret apparaît dans l'erreur");
      }
      return true;
    });
  } finally {
    await fermerConnexionBdd();
    if (motDePasseReel === undefined) delete process.env.DB_PASSWORD;
    else process.env.DB_PASSWORD = motDePasseReel;
  }
});
