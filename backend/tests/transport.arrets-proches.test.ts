
/**
 * KBE-28 — Tests HTTP de recherche des arrêts proches.
 *
 * Ces tests vérifient la validation des paramètres
 * de l'endpoint GET /api/arrets/proches.
 *
 * Les requêtes invalides sont rejetées avant
 * tout accès à PostgreSQL.
 */

import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";

import routeurTransport from "../src/transport/transport.routes";

// Crée une application Express réservée aux tests.
// Le serveur principal KotBis n'est pas démarré.
const app = express();

// Monte les routes de transport sous le même
// préfixe que dans l'application réelle.
app.use("/api", routeurTransport);

// Message d'erreur attendu pour un rayon invalide.
const erreurRayon =
  "Le rayon doit être supérieur à 0 et inférieur ou égal à 10000 mètres.";

/**
 * Scénarios de validation des paramètres HTTP.
 *
 * Chaque scénario doit retourner HTTP 400.
 */
const scenariosInvalides = [
  {
    nom: "Refuser une latitude inférieure à -90",
    query: "latitude=-91&longitude=57.5264&rayon=500",
    erreur: "La latitude doit être comprise entre -90 et 90."
  },
  {
    nom: "Refuser une latitude supérieure à 90",
    query: "latitude=91&longitude=57.5264&rayon=500",
    erreur: "La latitude doit être comprise entre -90 et 90."
  },
  {
    nom: "Refuser une longitude supérieure à 180",
    query: "latitude=-20.3162&longitude=181&rayon=500",
    erreur: "La longitude doit être comprise entre -180 et 180."
  },
  {
    nom: "Refuser une longitude inférieure à -180",
    query: "latitude=-20.3162&longitude=-181&rayon=500",
    erreur: "La longitude doit être comprise entre -180 et 180."
  },
  {
    nom: "Refuser un rayon négatif",
    query: "latitude=-20.3162&longitude=57.5264&rayon=-100",
    erreur: erreurRayon
  },
  {
    nom: "Refuser un rayon égal à zéro",
    query: "latitude=-20.3162&longitude=57.5264&rayon=0",
    erreur: erreurRayon
  },
  {
    nom: "Refuser un rayon supérieur à 10000 mètres",
    query: "latitude=-20.3162&longitude=57.5264&rayon=20000",
    erreur: erreurRayon
  },
  {
    nom: "Refuser une latitude absente",
    query: "longitude=57.5264&rayon=500",
    erreur: "La latitude doit être comprise entre -90 et 90."
  },
  {
    nom: "Refuser une longitude absente",
    query: "latitude=-20.3162&rayon=500",
    erreur: "La longitude doit être comprise entre -180 et 180."
  },
  {
    nom: "Refuser un rayon absent",
    query: "latitude=-20.3162&longitude=57.5264",
    erreur: erreurRayon
  },
  {
    nom: "Refuser une latitude non numérique",
    query: "latitude=abc&longitude=57.5264&rayon=500",
    erreur: "La latitude doit être comprise entre -90 et 90."
  },
  {
    nom: "Refuser un rayon vide",
    query: "latitude=-20.3162&longitude=57.5264&rayon=",
    erreur: erreurRayon
  },
  {
    nom: "Refuser un rayon non fini",
    query: "latitude=-20.3162&longitude=57.5264&rayon=Infinity",
    erreur: erreurRayon
  },
  {
    nom: "Refuser une latitude répétée",
    query: "latitude=-20&latitude=-21&longitude=57.5264&rayon=500",
    erreur: "La latitude doit être comprise entre -90 et 90."
  }
];

// Génère un test indépendant pour chaque scénario.
for (const scenario of scenariosInvalides) {

  test(`KBE-28 — HTTP 400 — ${scenario.nom}`, async () => {

    // Envoie une requête à notre application de test.
    const reponse = await request(app)
      .get(`/api/arrets/proches?${scenario.query}`);

    // Vérifie le code HTTP.
    assert.equal(reponse.status, 400);

    // Vérifie le message d'erreur retourné.
    assert.deepEqual(reponse.body, {
      erreur: scenario.erreur
    });

  });

}
