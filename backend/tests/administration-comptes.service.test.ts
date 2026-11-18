// Tests métier de la gestion des comptes (KBE-46), sans PostgreSQL.
import test from "node:test";
import assert from "node:assert/strict";
import { GestionComptesService } from "../src/administration/gestion-comptes.service";
import { ErreurApi } from "../src/commun/erreur-api";
import type { CompteAuthentifie } from "../src/utilisateurs/comptes.types";
import { DepotComptesMemoire } from "./outils/depot-comptes-memoire";

const ADMIN_A = 1;
const ADMIN_B = 2;
const OPERATEUR = 3;
const VOYAGEUR = 4;
const INVITE = 5;

function preparer() {
  const depot = new DepotComptesMemoire([
    { id: ADMIN_A, email: "a@kotbis.mu", role: "administrateur", etat: "actif" },
    { id: ADMIN_B, email: "b@kotbis.mu", role: "administrateur", etat: "actif" },
    { id: OPERATEUR, email: "op@kotbis.mu", role: "operateur", etat: "actif" },
    { id: VOYAGEUR, email: "v@kotbis.mu", role: "voyageur", etat: "actif" },
    { id: INVITE, email: "inv@kotbis.mu", role: "moderateur", etat: "invite" }
  ]);
  return { depot, service: new GestionComptesService(depot) };
}

const acteur = (depot: DepotComptesMemoire, id: number): CompteAuthentifie => {
  const c = depot.comptes.get(id)!;
  return { id: c.id, role: c.role, etat: c.etat };
};

function erreurAvecCode(code: string, statut: number) {
  return (e: unknown) => e instanceof ErreurApi && e.code === code && e.statut === statut;
}

test("EF-AUTH-012 : un administrateur suspend un voyageur, révoque ses sessions et écrit l'audit", async () => {
  const { depot, service } = preparer();
  const resultat = await service.changerEtat(acteur(depot, ADMIN_A), VOYAGEUR, { etat: "inactif", motif: "Abus" }, "req-1");

  assert.equal(resultat.etat, "inactif");
  assert.equal(resultat.version, 2);
  assert.deepEqual(depot.sessionsRevoquees, [VOYAGEUR]);
  assert.equal(depot.audits.length, 1);
  assert.equal(depot.audits[0].action, "COMPTE_SUSPENDU");
  assert.equal(depot.audits[0].acteurId, ADMIN_A);
});

test("EF-AUTH-012 : un administrateur réactive un compte suspendu", async () => {
  const { depot, service } = preparer();
  await service.changerEtat(acteur(depot, ADMIN_A), VOYAGEUR, { etat: "inactif" }, "req-1");
  const resultat = await service.changerEtat(acteur(depot, ADMIN_A), VOYAGEUR, { etat: "actif" }, "req-2");

  assert.equal(resultat.etat, "actif");
  assert.equal(depot.audits[1].action, "COMPTE_REACTIVE");
});

test("Suspendre un compte déjà suspendu est idempotent (pas de nouvel audit)", async () => {
  const { depot, service } = preparer();
  await service.changerEtat(acteur(depot, ADMIN_A), VOYAGEUR, { etat: "inactif" }, "req-1");
  await service.changerEtat(acteur(depot, ADMIN_A), VOYAGEUR, { etat: "inactif" }, "req-2");
  assert.equal(depot.audits.length, 1);
});

test("Une invitation non acceptée ne peut pas être suspendue ni réactivée", async () => {
  const { depot, service } = preparer();
  await assert.rejects(
    service.changerEtat(acteur(depot, ADMIN_A), INVITE, { etat: "actif" }, "req"),
    erreurAvecCode("COMPTE_NON_ACTIVE", 409)
  );
});

test("Un administrateur ne peut pas modifier l'état de son propre compte", async () => {
  const { depot, service } = preparer();
  await assert.rejects(
    service.changerEtat(acteur(depot, ADMIN_A), ADMIN_A, { etat: "inactif" }, "req"),
    erreurAvecCode("AUTO_MODIFICATION_INTERDITE", 403)
  );
});

test("CA-012 : un opérateur ne peut pas se promouvoir administrateur (contrôle du service)", async () => {
  const { depot, service } = preparer();
  await assert.rejects(
    service.changerRole(acteur(depot, OPERATEUR), OPERATEUR, { role: "administrateur" }, "req"),
    erreurAvecCode("AUTO_PROMOTION_INTERDITE", 403)
  );
  assert.equal(depot.comptes.get(OPERATEUR)!.role, "operateur");
});

test("CA-012 : un opérateur ne peut pas promouvoir un autre compte", async () => {
  const { depot, service } = preparer();
  await assert.rejects(
    service.changerRole(acteur(depot, OPERATEUR), INVITE, { role: "administrateur" }, "req"),
    erreurAvecCode("ACCES_INTERDIT", 403)
  );
});

test("Un administrateur ne peut pas modifier son propre rôle", async () => {
  const { depot, service } = preparer();
  await assert.rejects(
    service.changerRole(acteur(depot, ADMIN_A), ADMIN_A, { role: "moderateur" }, "req"),
    erreurAvecCode("AUTO_PROMOTION_INTERDITE", 403)
  );
});

test("EF-AUTH-013 : un administrateur rétrograde un autre administrateur quand il en reste un", async () => {
  const { depot, service } = preparer();
  const resultat = await service.changerRole(acteur(depot, ADMIN_A), ADMIN_B, { role: "moderateur" }, "req");

  assert.equal(resultat.role, "moderateur");
  assert.equal(depot.audits[0].action, "ROLE_MODIFIE");
  assert.deepEqual(depot.audits[0].avant, { role: "administrateur" });
});

test("EF-AUTH-014 : le dernier administrateur actif ne peut être ni suspendu ni rétrogradé", async () => {
  const { depot, service } = preparer();
  depot.nombreAdministrateursForce = 1;

  await assert.rejects(
    service.changerEtat(acteur(depot, ADMIN_A), ADMIN_B, { etat: "inactif" }, "req"),
    erreurAvecCode("DERNIER_ADMINISTRATEUR", 409)
  );
  await assert.rejects(
    service.changerRole(acteur(depot, ADMIN_A), ADMIN_B, { role: "operateur" }, "req"),
    erreurAvecCode("DERNIER_ADMINISTRATEUR", 409)
  );
  assert.equal(depot.comptes.get(ADMIN_B)!.etat, "actif");
  assert.equal(depot.comptes.get(ADMIN_B)!.role, "administrateur");
});

test("EF-AUTH-014 : deux administrateurs qui se suspendent mutuellement en même temps → un seul réussit", async () => {
  const { depot, service } = preparer();
  const resultats = await Promise.allSettled([
    service.changerEtat(acteur(depot, ADMIN_A), ADMIN_B, { etat: "inactif" }, "req-a"),
    service.changerEtat(acteur(depot, ADMIN_B), ADMIN_A, { etat: "inactif" }, "req-b")
  ]);

  assert.equal(resultats.filter((r) => r.status === "fulfilled").length, 1);
  const adminsActifs = [...depot.comptes.values()].filter((c) => c.role === "administrateur" && c.etat === "actif");
  assert.equal(adminsActifs.length, 1);
});

test("Un compte voyageur ne peut pas recevoir un rôle du personnel par cette opération", async () => {
  const { depot, service } = preparer();
  await assert.rejects(
    service.changerRole(acteur(depot, ADMIN_A), VOYAGEUR, { role: "operateur" }, "req"),
    erreurAvecCode("CHANGEMENT_FAMILLE_NON_SUPPORTE", 422)
  );
});

test("Une version attendue périmée provoque un conflit", async () => {
  const { depot, service } = preparer();
  await assert.rejects(
    service.changerEtat(acteur(depot, ADMIN_A), VOYAGEUR, { etat: "inactif", version: 99 }, "req"),
    erreurAvecCode("CONFLIT_VERSION", 409)
  );
});

test("Un compte introuvable renvoie 404", async () => {
  const { depot, service } = preparer();
  await assert.rejects(
    service.changerEtat(acteur(depot, ADMIN_A), 999, { etat: "inactif" }, "req"),
    erreurAvecCode("COMPTE_INTROUVABLE", 404)
  );
});

test("Si l'audit échoue, la modification est annulée", async () => {
  const { depot, service } = preparer();
  depot.echecAudit = true;
  await assert.rejects(service.changerEtat(acteur(depot, ADMIN_A), VOYAGEUR, { etat: "inactif" }, "req"));
  assert.equal(depot.comptes.get(VOYAGEUR)!.etat, "actif");
  assert.deepEqual(depot.sessionsRevoquees, []);
});
