// Tests unitaires du service des favoris (KBE-40), dépôts en mémoire.
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { ErreurApi } from "../src/commun/erreurs";
import { FavorisService, type CompteFavoris } from "../src/favoris/favoris.service";
import { LIMITE_FAVORIS, type NouveauFavori } from "../src/favoris/favoris.types";
import { DepotFavorisMemoire, ReferentielReseauMemoire } from "./outils/depot-favoris-memoire";

// compteId arrive en texte depuis la session (KBE-23)
const ALICE: CompteFavoris = { compteId: "10", role: "voyageur" };
const BOB: CompteFavoris = { compteId: "11", role: "voyageur" };
const OPERATEUR: CompteFavoris = { compteId: "20", role: "operateur" };

const PORT_LOUIS = 1;
const CUREPIPE = 2;
const ROSE_HILL = 3;
const ARCHIVE = 4;

const trajet = (depart: number, arrivee: number, libelle: string | null = null): NouveauFavori => ({
  type: "trajet",
  arretDepartId: depart,
  arretArriveeId: arrivee,
  libelle
});
const destination = (arrivee: number): NouveauFavori => ({
  type: "destination",
  arretDepartId: null,
  arretArriveeId: arrivee,
  libelle: null
});

let depot: DepotFavorisMemoire;
let reseau: ReferentielReseauMemoire;
let service: FavorisService;

beforeEach(() => {
  depot = new DepotFavorisMemoire();
  reseau = new ReferentielReseauMemoire([
    { id: PORT_LOUIS, code: "PL", nom: "Port-Louis", disponible: true },
    { id: CUREPIPE, code: "CP", nom: "Curepipe", disponible: true },
    { id: ROSE_HILL, code: "RH", nom: "Rose-Hill", disponible: true },
    { id: ARCHIVE, code: "AR", nom: "Ancien arrêt", disponible: false }
  ]);
  service = new FavorisService(depot, reseau);
});

async function rejette(promesse: Promise<unknown>, statut: number, code: string): Promise<void> {
  await assert.rejects(promesse, (e: unknown) => e instanceof ErreurApi && e.statut === statut && e.code === code);
}

test("EF-FAV-001 / 003 : ajout d'un trajet, renvoyé avec ce qu'il faut pour relancer la recherche", async () => {
  const favori = await service.ajouter(ALICE, trajet(PORT_LOUIS, CUREPIPE, "Travail"));
  assert.equal(favori.type, "trajet");
  assert.deepEqual(favori.depart, { id: PORT_LOUIS, code: "PL", nom: "Port-Louis" });
  assert.deepEqual(favori.arrivee, { id: CUREPIPE, code: "CP", nom: "Curepipe" });
  assert.equal(favori.libelle, "Travail");
  assert.equal(favori.disponible, true);
  assert.ok(!Number.isNaN(Date.parse(favori.creeLe)));
});

test("EF-FAV-001 : ajout d'une destination (sans départ)", async () => {
  const favori = await service.ajouter(ALICE, destination(ROSE_HILL));
  assert.equal(favori.depart, null);
  assert.equal(favori.arrivee.id, ROSE_HILL);
});

test("EF-FAV-002 / EF-AUTH-017 : chacun ne voit que ses favoris, du plus récent au plus ancien", async () => {
  await service.ajouter(ALICE, trajet(PORT_LOUIS, CUREPIPE));
  await service.ajouter(BOB, destination(ROSE_HILL));
  await service.ajouter(ALICE, destination(CUREPIPE));

  const favorisAlice = await service.lister(ALICE);
  assert.deepEqual(favorisAlice.map((f) => f.type), ["destination", "trajet"]);
  const favorisBob = await service.lister(BOB);
  assert.equal(favorisBob.length, 1);
  assert.equal(favorisBob[0].arrivee.id, ROSE_HILL);
});

test("EF-FAV-005 : un doublon renvoie 409, même avec un autre libellé", async () => {
  await service.ajouter(ALICE, trajet(PORT_LOUIS, CUREPIPE, "A"));
  await rejette(service.ajouter(ALICE, trajet(PORT_LOUIS, CUREPIPE, "B")), 409, "FAVORI_EXISTANT");
  await service.ajouter(ALICE, destination(CUREPIPE));
  await rejette(service.ajouter(ALICE, destination(CUREPIPE)), 409, "FAVORI_EXISTANT");
  assert.equal(depot.favoris.length, 2);
});

test("EF-FAV-005 : sens inverse, autre type ou autre compte ne sont pas des doublons", async () => {
  await service.ajouter(ALICE, trajet(PORT_LOUIS, CUREPIPE));
  await service.ajouter(ALICE, trajet(CUREPIPE, PORT_LOUIS));
  await service.ajouter(ALICE, destination(CUREPIPE));
  await service.ajouter(BOB, trajet(PORT_LOUIS, CUREPIPE));
  assert.equal(depot.favoris.length, 4);
});

test("Ajout refusé vers un arrêt indisponible ou inexistant (422)", async () => {
  await rejette(service.ajouter(ALICE, destination(ARCHIVE)), 422, "ARRET_INDISPONIBLE");
  await rejette(service.ajouter(ALICE, trajet(ARCHIVE, CUREPIPE)), 422, "ARRET_INDISPONIBLE");
  await rejette(service.ajouter(ALICE, destination(999)), 422, "ARRET_INDISPONIBLE");
  assert.equal(depot.favoris.length, 0);
});

test(`Limite de ${LIMITE_FAVORIS} favoris par compte`, async () => {
  for (let i = 0; i < LIMITE_FAVORIS; i++) {
    await depot.ajouter(Number(ALICE.compteId), { type: "destination", arretDepartId: null, arretArriveeId: 1000 + i, libelle: null });
  }
  await rejette(service.ajouter(ALICE, destination(CUREPIPE)), 422, "LIMITE_FAVORIS");
  await service.ajouter(BOB, destination(CUREPIPE));
});

test("EF-FAV-006 : arrêt archivé ou plus desservi, le favori reste listé avec disponible = false", async () => {
  await service.ajouter(ALICE, trajet(PORT_LOUIS, CUREPIPE));
  await service.ajouter(ALICE, destination(ROSE_HILL));
  reseau.rendreIndisponible(PORT_LOUIS);

  const [dest, traj] = await service.lister(ALICE);
  assert.equal(dest.disponible, true);
  assert.equal(traj.disponible, false);
  assert.equal(traj.depart!.nom, "Port-Louis");
});

test("EF-FAV-006 : arrêt disparu, le favori reste listé sans nom et indisponible", async () => {
  await service.ajouter(ALICE, destination(ROSE_HILL));
  reseau.arrets.delete(ROSE_HILL);
  const [favori] = await service.lister(ALICE);
  assert.deepEqual(favori.arrivee, { id: ROSE_HILL, code: null, nom: null });
  assert.equal(favori.disponible, false);
});

test("EF-FAV-004 : suppression de son propre favori", async () => {
  const favori = await service.ajouter(ALICE, destination(CUREPIPE));
  await service.supprimer(ALICE, favori.id);
  assert.equal((await service.lister(ALICE)).length, 0);
});

test("CA-031 : supprimer le favori d'un autre compte renvoie 404, comme un favori inexistant", async () => {
  const favori = await service.ajouter(ALICE, destination(CUREPIPE));
  await rejette(service.supprimer(BOB, favori.id), 404, "FAVORI_INTROUVABLE");
  await rejette(service.supprimer(BOB, 999), 404, "FAVORI_INTROUVABLE");
  assert.equal(depot.favoris.length, 1);
});

test("Un compte du personnel n'a pas de favoris (403)", async () => {
  await rejette(service.lister(OPERATEUR), 403, "ACCES_INTERDIT");
  await rejette(service.ajouter(OPERATEUR, destination(CUREPIPE)), 403, "ACCES_INTERDIT");
  await rejette(service.supprimer(OPERATEUR, 1), 403, "ACCES_INTERDIT");
});

test("Un identifiant de compte invalide dans la session est refusé (401)", async () => {
  await rejette(service.lister({ compteId: "abc", role: "voyageur" }), 401, "SESSION_INVALIDE");
});
