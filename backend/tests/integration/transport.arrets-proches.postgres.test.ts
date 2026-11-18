
/**
 * KBE-28 — Tests d'intégration PostgreSQL / PostGIS.
 *
 * Objectifs :
 * - Vérifier le calcul des distances en mètres.
 * - Vérifier la recherche d'arrêts proches.
 * - Vérifier le filtrage par rayon.
 * - Vérifier le classement par distance.
 * - Vérifier la réponse lorsqu'aucun arrêt n'est trouvé.
 *
 * Ces tests utilisent la vraie base PostgreSQL.
 * Aucune donnée n'est ajoutée, modifiée ou supprimée.
 */

import { test, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";

import routeurTransport from "../../src/transport/transport.routes";

import {
  obtenirPool,
  fermerConnexionBdd
} from "../../src/configuration/baseDeDonnees";

import type {
  ArretProche
} from "../../src/transport/transport.types";

// Application Express temporaire pour les tests.
const app = express();
app.use("/api", routeurTransport);

// Ferme le pool PostgreSQL après tous les tests.
after(async () => {
  await fermerConnexionBdd();
});

/**
 * Test 1 — Vérifier une distance géographique connue.
 *
 * Une différence de 0,001 degré de latitude
 * représente environ 111 mètres à Maurice.
 *
 * Le calcul est effectué par PostGIS en mètres.
 */
test("KBE-28 — PostGIS calcule une distance en mètres", async () => {

  const resultat = await obtenirPool().query<{
    distance: number;
  }>(`
    SELECT ST_Distance(
      ST_SetSRID(
        ST_MakePoint(57.5, -20.2),
        4326
      )::geography,
      ST_SetSRID(
        ST_MakePoint(57.5, -20.199),
        4326
      )::geography
    ) AS distance
  `);

  const distance = resultat.rows[0].distance;

  // Vérifie que la distance est proche de 111 mètres.
  assert.ok(distance > 110);
  assert.ok(distance < 112);

});

/**
 * Test 2 — Vérifier une recherche réelle d'arrêts.
 *
 * On récupère un arrêt actif existant et on
 * recherche les arrêts dans un rayon de 100 mètres.
 */
test("KBE-28 — Recherche réelle avec distances et tri", async () => {

  // Sélectionne un arrêt actif disposant de coordonnées.
  const resultat = await obtenirPool().query<{
    id: string;
    latitude: number;
    longitude: number;
  }>(`
    SELECT
      id::text AS id,
      ST_Y(position) AS latitude,
      ST_X(position) AS longitude
    FROM arrets
    WHERE actif = TRUE
      AND archive_le IS NULL
      AND position IS NOT NULL
    ORDER BY id
    LIMIT 1
  `);

  // Le jeu de données doit contenir au moins un arrêt actif.
  assert.ok(
    resultat.rows.length > 0,
    "Aucun arrêt actif disponible pour le test."
  );

  const arretReference = resultat.rows[0];

  // Recherche autour de cet arrêt avec un rayon de 100 m.
  const reponse = await request(app)
    .get("/api/arrets/proches")
    .query({
      latitude: arretReference.latitude,
      longitude: arretReference.longitude,
      rayon: 100
    });

  // Vérifie la réponse HTTP.
  assert.equal(reponse.status, 200);
  assert.ok(Array.isArray(reponse.body.arrets));

  const arrets = reponse.body.arrets as ArretProche[];

  // L'arrêt de référence doit être présent.
  const arretTrouve = arrets.find(
    (arret) => arret.id === arretReference.id
  );

  assert.ok(
    arretTrouve,
    "L'arrêt de référence devrait être trouvé."
  );

  // Un arrêt recherché à ses propres coordonnées
  // doit avoir une distance proche de zéro.
  assert.ok(arretTrouve.distanceMetres >= 0);
  assert.ok(arretTrouve.distanceMetres < 0.01);

  // Tous les arrêts doivent être dans le rayon demandé.
  for (const arret of arrets) {

    assert.ok(Number.isFinite(arret.distanceMetres));

    assert.ok(
      arret.distanceMetres >= 0 &&
      arret.distanceMetres <= 100,
      `Arrêt ${arret.id} situé hors du rayon.`
    );

  }

  // Vérifie le classement par distance croissante.
  for (let i = 1; i < arrets.length; i++) {

    assert.ok(
      arrets[i - 1].distanceMetres <=
      arrets[i].distanceMetres,
      "Les arrêts ne sont pas triés par distance."
    );

  }

});

/**
 * Test 3 — Vérifier une recherche sans résultat.
 *
 * La position (0, 0) se trouve loin du réseau
 * de transport mauricien.
 */
test("KBE-28 — Aucun arrêt proche retourne un tableau vide", async () => {

  const reponse = await request(app)
    .get("/api/arrets/proches")
    .query({
      latitude: 0,
      longitude: 0,
      rayon: 1000
    });

  assert.equal(reponse.status, 200);

  assert.deepEqual(reponse.body, {
    arrets: []
  });

});
