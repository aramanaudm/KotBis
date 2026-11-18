// Tests HTTP des routes des favoris (KBE-40).
// Serveur Express temporaire, dépôts en mémoire, VRAI middleware d'authentification (KBE-46) :
// seule la vérification du jeton est simulée (« jeton-<id> »), en attendant KBE-23.
import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { FavorisControleur } from "../src/favoris/favoris.controleur";
import { creerRoutesFavoris } from "../src/favoris/favoris.routes";
import { FavorisService } from "../src/favoris/favoris.service";
import { creerMiddlewareAuthentification, type VerificateurJeton } from "../src/middlewares/authentification.middleware";
import { DepotComptesMemoire } from "./outils/depot-comptes-memoire";
import { DepotFavorisMemoire, ReferentielReseauMemoire } from "./outils/depot-favoris-memoire";

const ALICE = 10;
const BOB = 11;
const SUSPENDU = 12;
const OPERATEUR = 20;

const PORT_LOUIS = 1;
const CUREPIPE = 2;

// Simulation réservée aux tests : ne jamais utiliser en production
const verifierJetonFactice: VerificateurJeton = async (jeton) => {
  const correspondance = /^jeton-(\d+)$/.exec(jeton);
  return correspondance ? { compteId: Number(correspondance[1]) } : null;
};

let serveur: Server;
let baseUrl: string;
let favoris: DepotFavorisMemoire;
let reseau: ReferentielReseauMemoire;

beforeEach(async () => {
  const comptes = new DepotComptesMemoire([
    { id: ALICE, email: "alice@test.mu", role: "voyageur", etat: "actif" },
    { id: BOB, email: "bob@test.mu", role: "voyageur", etat: "actif" },
    { id: SUSPENDU, email: "s@test.mu", role: "voyageur", etat: "inactif" },
    { id: OPERATEUR, email: "op@test.mu", role: "operateur", etat: "actif" }
  ]);
  favoris = new DepotFavorisMemoire();
  reseau = new ReferentielReseauMemoire([
    { id: PORT_LOUIS, code: "PL", nom: "Port-Louis", disponible: true },
    { id: CUREPIPE, code: "CP", nom: "Curepipe", disponible: true }
  ]);
  const app = express();
  app.use(express.json());
  app.use(
    "/api/favoris",
    creerRoutesFavoris(
      creerMiddlewareAuthentification(verifierJetonFactice, comptes),
      new FavorisControleur(new FavorisService(favoris, reseau))
    )
  );
  serveur = app.listen(0);
  await new Promise<void>((resolve) => serveur.once("listening", () => resolve()));
  baseUrl = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}/api/favoris`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => serveur.close(() => resolve()));
});

async function appeler(methode: string, chemin: string, compteId?: number, corps?: unknown) {
  const reponse = await fetch(baseUrl + chemin, {
    method: methode,
    headers: {
      "Content-Type": "application/json",
      ...(compteId ? { Authorization: `Bearer jeton-${compteId}` } : {})
    },
    body: corps === undefined ? undefined : JSON.stringify(corps)
  });
  const texte = await reponse.text();
  return { statut: reponse.status, corps: texte ? JSON.parse(texte) : null };
}

const TRAJET = { type: "trajet", arretDepartId: PORT_LOUIS, arretArriveeId: CUREPIPE, libelle: "  Travail  " };

test("Sans jeton, les trois routes renvoient 401", async () => {
  for (const [methode, chemin, corps] of [["GET", ""], ["POST", "", TRAJET], ["DELETE", "/1"]] as const) {
    const { statut, corps: reponse } = await appeler(methode, chemin, undefined, corps);
    assert.equal(statut, 401, `${methode} ${chemin}`);
    assert.equal(reponse.erreur.code, "AUTHENTIFICATION_REQUISE");
  }
});

test("Un compte suspendu est refusé (403)", async () => {
  const { statut } = await appeler("GET", "", SUSPENDU);
  assert.equal(statut, 403);
});

test("Un compte du personnel n'a pas accès aux favoris (403)", async () => {
  const { statut, corps } = await appeler("GET", "", OPERATEUR);
  assert.equal(statut, 403);
  assert.equal(corps.erreur.code, "ACCES_INTERDIT");
});

test("Parcours complet : ajouter (201), lister (200), supprimer (204)", async () => {
  const ajout = await appeler("POST", "", ALICE, TRAJET);
  assert.equal(ajout.statut, 201);
  assert.equal(ajout.corps.libelle, "Travail");
  assert.equal(ajout.corps.disponible, true);

  const liste = await appeler("GET", "", ALICE);
  assert.equal(liste.statut, 200);
  assert.equal(liste.corps.elements.length, 1);
  assert.equal(liste.corps.elements[0].id, ajout.corps.id);

  const suppression = await appeler("DELETE", `/${ajout.corps.id}`, ALICE);
  assert.equal(suppression.statut, 204);
  assert.equal((await appeler("GET", "", ALICE)).corps.elements.length, 0);
});

test("EF-FAV-005 : doublon → 409 FAVORI_EXISTANT", async () => {
  await appeler("POST", "", ALICE, TRAJET);
  const { statut, corps } = await appeler("POST", "", ALICE, TRAJET);
  assert.equal(statut, 409);
  assert.equal(corps.erreur.code, "FAVORI_EXISTANT");
});

test("CA-031 : Bob ne voit pas et ne supprime pas le favori d'Alice (404)", async () => {
  const { corps: favori } = await appeler("POST", "", ALICE, TRAJET);
  assert.equal((await appeler("GET", "", BOB)).corps.elements.length, 0);
  const { statut, corps } = await appeler("DELETE", `/${favori.id}`, BOB);
  assert.equal(statut, 404);
  assert.equal(corps.erreur.code, "FAVORI_INTROUVABLE");
  assert.equal(favoris.favoris.length, 1);
});

test("EF-FAV-006 : un arrêt archivé rend le favori indisponible dans la liste", async () => {
  await appeler("POST", "", ALICE, TRAJET);
  reseau.rendreIndisponible(CUREPIPE);
  const { corps } = await appeler("GET", "", ALICE);
  assert.equal(corps.elements[0].disponible, false);
});

test("Corps invalides → 422 VALIDATION_INCORRECTE", async () => {
  const invalides: unknown[] = [
    {},
    { type: "ligne", arretArriveeId: CUREPIPE },
    { type: "destination" },
    { type: "destination", arretArriveeId: "2" },
    { type: "destination", arretArriveeId: 1.5 },
    { type: "destination", arretDepartId: PORT_LOUIS, arretArriveeId: CUREPIPE },
    { type: "trajet", arretArriveeId: CUREPIPE },
    { type: "trajet", arretDepartId: CUREPIPE, arretArriveeId: CUREPIPE },
    { type: "destination", arretArriveeId: CUREPIPE, libelle: 42 },
    { type: "destination", arretArriveeId: CUREPIPE, libelle: "x".repeat(81) }
  ];
  for (const corps of invalides) {
    const { statut, corps: reponse } = await appeler("POST", "", ALICE, corps);
    assert.equal(statut, 422, JSON.stringify(corps));
    assert.equal(reponse.erreur.code, "VALIDATION_INCORRECTE");
  }
  assert.equal(favoris.favoris.length, 0);
});

test("Arrêt inexistant → 422 ARRET_INDISPONIBLE", async () => {
  const { statut, corps } = await appeler("POST", "", ALICE, { type: "destination", arretArriveeId: 999 });
  assert.equal(statut, 422);
  assert.equal(corps.erreur.code, "ARRET_INDISPONIBLE");
});

test("Identifiant de suppression invalide → 400", async () => {
  for (const id of ["abc", "0", "-1", "1.5"]) {
    const { statut, corps } = await appeler("DELETE", `/${id}`, ALICE);
    assert.equal(statut, 400, id);
    assert.equal(corps.erreur.code, "IDENTIFIANT_INVALIDE");
  }
});
