// Tests HTTP des routes d'administration des comptes (KBE-46).
// Serveur Express temporaire, dépôt en mémoire, VRAI middleware d'authentification :
// seule la vérification du jeton est simulée (« jeton-<id> »), en attendant KBE-23.
import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { creerRoutesAdministrationComptes } from "../src/administration/administration.routes";
import { GestionComptesControleur } from "../src/administration/gestion-comptes.controleur";
import { GestionComptesService } from "../src/administration/gestion-comptes.service";
import { creerMiddlewareAuthentification, type VerificateurJeton } from "../src/middlewares/authentification.middleware";
import { DepotComptesMemoire } from "./outils/depot-comptes-memoire";

const ADMIN_A = 1;
const ADMIN_B = 2;
const OPERATEUR = 3;
const MODERATEUR = 4;
const VOYAGEUR = 5;

// Simulation réservée aux tests : ne jamais utiliser en production
const verifierJetonFactice: VerificateurJeton = async (jeton) => {
  const correspondance = /^jeton-(\d+)$/.exec(jeton);
  return correspondance ? { compteId: Number(correspondance[1]) } : null;
};

let serveur: Server;
let baseUrl: string;
let depot: DepotComptesMemoire;

beforeEach(async () => {
  depot = new DepotComptesMemoire([
    { id: ADMIN_A, email: "a@kotbis.mu", role: "administrateur", etat: "actif" },
    { id: ADMIN_B, email: "b@kotbis.mu", role: "administrateur", etat: "actif" },
    { id: OPERATEUR, email: "op@kotbis.mu", role: "operateur", etat: "actif" },
    { id: MODERATEUR, email: "mod@kotbis.mu", role: "moderateur", etat: "actif" },
    { id: VOYAGEUR, email: "v@kotbis.mu", role: "voyageur", etat: "actif" }
  ]);
  const app = express();
  app.use(express.json());
  app.use(
    "/api/administration",
    creerRoutesAdministrationComptes(
      creerMiddlewareAuthentification(verifierJetonFactice, depot),
      new GestionComptesControleur(new GestionComptesService(depot))
    )
  );
  serveur = app.listen(0);
  await new Promise<void>((resolve) => serveur.once("listening", () => resolve()));
  baseUrl = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}/api/administration`;
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
  return { statut: reponse.status, corps: await reponse.json() };
}

const ROUTES_ADMIN: Array<[string, string, unknown?]> = [
  ["GET", "/utilisateurs"],
  ["PATCH", `/utilisateurs/${VOYAGEUR}/statut`, { etat: "inactif" }],
  ["PATCH", `/utilisateurs/${OPERATEUR}/role`, { role: "administrateur" }],
  ["GET", "/personnel"]
];

test("Sans jeton, toutes les routes d'administration renvoient 401", async () => {
  for (const [methode, chemin, corps] of ROUTES_ADMIN) {
    const { statut, corps: reponse } = await appeler(methode, chemin, undefined, corps);
    assert.equal(statut, 401, `${methode} ${chemin}`);
    assert.equal(reponse.erreur.code, "AUTHENTIFICATION_REQUISE");
  }
});

test("Un jeton invalide renvoie 401", async () => {
  const reponse = await fetch(baseUrl + "/utilisateurs", { headers: { Authorization: "Bearer faux" } });
  assert.equal(reponse.status, 401);
});

test("CA-011 : un voyageur n'accède à aucune route d'administration", async () => {
  for (const [methode, chemin, corps] of ROUTES_ADMIN) {
    const { statut, corps: reponse } = await appeler(methode, chemin, VOYAGEUR, corps);
    assert.equal(statut, 403, `${methode} ${chemin}`);
    assert.equal(reponse.erreur.code, "ACCES_INTERDIT");
  }
  assert.equal(depot.comptes.get(OPERATEUR)!.role, "operateur");
  assert.equal(depot.comptes.get(VOYAGEUR)!.etat, "actif");
});

test("CA-012 : un opérateur ne peut pas se promouvoir administrateur", async () => {
  const { statut } = await appeler("PATCH", `/utilisateurs/${OPERATEUR}/role`, OPERATEUR, { role: "administrateur" });
  assert.equal(statut, 403);
  assert.equal(depot.comptes.get(OPERATEUR)!.role, "operateur");
  assert.equal(depot.audits.length, 0);
});

test("Un opérateur ou un modérateur ne gère ni les comptes ni les rôles", async () => {
  for (const id of [OPERATEUR, MODERATEUR]) {
    for (const [methode, chemin, corps] of ROUTES_ADMIN) {
      const { statut } = await appeler(methode, chemin, id, corps);
      assert.equal(statut, 403, `compte ${id} : ${methode} ${chemin}`);
    }
  }
});

test("Un administrateur liste les comptes avec pagination, sans données sensibles", async () => {
  const { statut, corps } = await appeler("GET", "/utilisateurs?page=1&limite=2", ADMIN_A);
  assert.equal(statut, 200);
  assert.equal(corps.elements.length, 2);
  assert.deepEqual(corps.pagination, { page: 1, limite: 2, total: 5 });
  assert.ok(!("mot_de_passe_hash" in corps.elements[0]));
});

test("GET /personnel n'inclut pas les voyageurs", async () => {
  const { statut, corps } = await appeler("GET", "/personnel", ADMIN_A);
  assert.equal(statut, 200);
  assert.ok(corps.elements.every((c: { role: string }) => c.role !== "voyageur"));
  assert.equal(corps.pagination.total, 4);
});

test("CA-014 : un compte suspendu est bloqué immédiatement, puis débloqué après réactivation", async () => {
  // Avant : l'administrateur B accède à l'administration
  assert.equal((await appeler("GET", "/utilisateurs", ADMIN_B)).statut, 200);

  const suspension = await appeler("PATCH", `/utilisateurs/${ADMIN_B}/statut`, ADMIN_A, { etat: "inactif", motif: "Test" });
  assert.equal(suspension.statut, 200);
  assert.equal(suspension.corps.etat, "inactif");
  assert.deepEqual(depot.sessionsRevoquees, [ADMIN_B]);

  // Même jeton encore « valide » : refus car l'état est relu en base
  const bloque = await appeler("GET", "/utilisateurs", ADMIN_B);
  assert.equal(bloque.statut, 403);
  assert.equal(bloque.corps.erreur.code, "COMPTE_INACTIF");

  assert.equal((await appeler("PATCH", `/utilisateurs/${ADMIN_B}/statut`, ADMIN_A, { etat: "actif" })).statut, 200);
  assert.equal((await appeler("GET", "/utilisateurs", ADMIN_B)).statut, 200);
});

test("Une rétrogradation retire immédiatement l'accès correspondant", async () => {
  const reponse = await appeler("PATCH", `/utilisateurs/${ADMIN_B}/role`, ADMIN_A, { role: "moderateur" });
  assert.equal(reponse.statut, 200);
  assert.equal(reponse.corps.role, "moderateur");
  assert.equal((await appeler("GET", "/utilisateurs", ADMIN_B)).statut, 403);
});

test("EF-AUTH-014 : l'administrateur ne peut ni se suspendre ni se rétrograder", async () => {
  const etat = await appeler("PATCH", `/utilisateurs/${ADMIN_A}/statut`, ADMIN_A, { etat: "inactif" });
  const role = await appeler("PATCH", `/utilisateurs/${ADMIN_A}/role`, ADMIN_A, { role: "operateur" });
  assert.equal(etat.statut, 403);
  assert.equal(role.statut, 403);
  assert.equal(depot.comptes.get(ADMIN_A)!.etat, "actif");
  assert.equal(depot.comptes.get(ADMIN_A)!.role, "administrateur");
});

test("Entrées invalides : identifiant → 400, corps → 422", async () => {
  assert.equal((await appeler("PATCH", "/utilisateurs/abc/statut", ADMIN_A, { etat: "inactif" })).statut, 400);
  assert.equal((await appeler("PATCH", `/utilisateurs/${VOYAGEUR}/statut`, ADMIN_A, { etat: "supprime" })).statut, 422);
  assert.equal((await appeler("PATCH", `/utilisateurs/${OPERATEUR}/role`, ADMIN_A, { role: "voyageur" })).statut, 422);
  assert.equal((await appeler("PATCH", `/utilisateurs/${VOYAGEUR}/statut`, ADMIN_A, { etat: "inactif", version: "1" })).statut, 422);
  assert.equal((await appeler("GET", "/utilisateurs?role=pirate", ADMIN_A)).statut, 422);
});

test("Base indisponible pendant l'authentification → 503 sans détail interne", async () => {
  depot.trouverCompteAuthentifie = async () => {
    throw new Error("connexion refusée sur 10.0.0.1");
  };
  const { statut, corps } = await appeler("GET", "/utilisateurs", ADMIN_A);
  assert.equal(statut, 503);
  assert.equal(corps.erreur.code, "SERVICE_INDISPONIBLE");
  assert.ok(!JSON.stringify(corps).includes("10.0.0.1"));
});
