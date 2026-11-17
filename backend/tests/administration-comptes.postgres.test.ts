// Tests d'intégration PostgreSQL de la gestion des comptes (KBE-46).
// Exécutent le vrai SQL de DepotComptesPostgres sur la base configurée dans .env.
//
// ATTENTION : à lancer uniquement sur une base locale ou de test (jamais une base partagée).
// Chaque test crée des comptes temporaires (e-mails « kbe46-…@test.local ») puis les supprime,
// avec leurs sessions et leurs lignes de journal_audit.
// Si PostgreSQL est indisponible ou les rôles non insérés, les tests sont ignorés.
import { after, afterEach, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { fermerConnexionBdd, obtenirPool } from "../src/configuration/baseDeDonnees";
import { DepotComptesPostgres } from "../src/utilisateurs/comptes.depot.postgres";
import { GestionComptesService } from "../src/administration/gestion-comptes.service";
import { GestionComptesControleur } from "../src/administration/gestion-comptes.controleur";
import { creerRoutesAdministrationComptes } from "../src/administration/administration.routes";
import { creerMiddlewareAuthentification } from "../src/middlewares/authentification.middleware";
import { ErreurApi } from "../src/commun/erreur-api";
import type { CodeRole, CompteAuthentifie, EtatCompte } from "../src/utilisateurs/comptes.types";

const TAG = `kbe46-${Date.now().toString(36)}`;
const depot = new DepotComptesPostgres();
const service = new GestionComptesService(depot);

let bddDisponible = false;
let raisonIgnore = "PostgreSQL indisponible";
let compteurComptes = 0;
let idsCrees: number[] = [];
const nomParId = new Map<number, string>();

// Comptes créés pour chaque test
let ADMIN_A: number;
let ADMIN_B: number;
let OPERATEUR: number;
let VOYAGEUR: number;

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function creerCompte(role: CodeRole, etat: EtatCompte = "actif"): Promise<number> {
  const suffixe = `${TAG}-${++compteurComptes}`;
  const { rows } = await obtenirPool().query(
    `INSERT INTO comptes (email, mot_de_passe_hash, role_id, etat, identifiant_public)
     VALUES ($1, 'hash-de-test', (SELECT id FROM roles WHERE code = $2), $3, $4)
     RETURNING id`,
    [`${suffixe}@test.local`, role, etat, suffixe]
  );
  const id = Number(rows[0].id);
  nomParId.set(id, role === "voyageur" ? suffixe : `Agent ${suffixe}`);
  if (role === "voyageur") {
    await obtenirPool().query("INSERT INTO voyageurs (compte_id, pseudo) VALUES ($1, $2)", [id, suffixe]);
  } else {
    await obtenirPool().query("INSERT INTO personnel (compte_id, nom_affiche) VALUES ($1, $2)", [id, `Agent ${suffixe}`]);
  }
  await obtenirPool().query(
    "INSERT INTO sessions (compte_id, empreinte_jeton, expire_le) VALUES ($1, $2, now() + interval '1 hour')",
    [id, `empreinte-${suffixe}`]
  );
  idsCrees.push(id);
  return id;
}

async function supprimerComptesDeTest(): Promise<void> {
  // Filet de sécurité : tous les comptes de ce lancement, même si un test a échoué en cours de route
  const { rows } = await obtenirPool().query("SELECT id FROM comptes WHERE email LIKE $1", [`${TAG}-%@test.local`]);
  const ids = [...new Set([...idsCrees, ...rows.map((r) => Number(r.id))])];
  if (ids.length > 0) {
    const idsTexte = ids.map(String);
    await obtenirPool().query(
      "DELETE FROM journal_audit WHERE acteur_id = ANY($1::bigint[]) OR (table_cible = 'comptes' AND cle_cible = ANY($2::text[]))",
      [ids, idsTexte]
    );
    await obtenirPool().query("DELETE FROM sessions WHERE compte_id = ANY($1::bigint[])", [ids]);
    await obtenirPool().query("DELETE FROM personnel WHERE compte_id = ANY($1::bigint[])", [ids]);
    await obtenirPool().query("DELETE FROM voyageurs WHERE compte_id = ANY($1::bigint[])", [ids]);
    await obtenirPool().query("DELETE FROM comptes WHERE id = ANY($1::bigint[])", [ids]);
  }
  idsCrees = [];
}

async function lireCompte(id: number) {
  const { rows } = await obtenirPool().query(
    "SELECT c.etat, c.version, r.code AS role FROM comptes c JOIN roles r ON r.id = c.role_id WHERE c.id = $1",
    [id]
  );
  return rows[0] as { etat: EtatCompte; version: number; role: CodeRole };
}

async function sessionRevoquee(id: number): Promise<boolean> {
  const { rows } = await obtenirPool().query("SELECT revoque_le FROM sessions WHERE compte_id = $1", [id]);
  return rows.length > 0 && rows.every((r) => r.revoque_le !== null);
}

async function auditsDe(id: number) {
  const { rows } = await obtenirPool().query(
    "SELECT acteur_id, action, avant, apres, requete_id FROM journal_audit WHERE table_cible = 'comptes' AND cle_cible = $1 ORDER BY id",
    [String(id)]
  );
  return rows;
}

// Administrateurs actifs ne venant pas de ce test (base partagée par erreur, données existantes)
async function autresAdministrateursActifs(): Promise<number> {
  const { rows } = await obtenirPool().query(
    `SELECT count(*)::int AS nombre FROM comptes c JOIN roles r ON r.id = c.role_id
     WHERE r.code = 'administrateur' AND c.etat = 'actif' AND NOT (c.id = ANY($1::bigint[]))`,
    [idsCrees]
  );
  return Number(rows[0].nombre);
}

const acteur = (id: number): CompteAuthentifie => ({ id, role: "administrateur", etat: "actif" });

function erreurAvecCode(code: string, statut: number) {
  return (e: unknown) => e instanceof ErreurApi && e.code === code && e.statut === statut;
}

describe("KBE-46 — intégration PostgreSQL", () => {
  before(async () => {
    try {
      const { rows } = await obtenirPool().query(
        "SELECT count(*)::int AS nombre FROM roles WHERE code IN ('voyageur','operateur','moderateur','administrateur')"
      );
      if (Number(rows[0].nombre) === 4) {
        bddDisponible = true;
      } else {
        raisonIgnore = "Rôles non insérés (voir database/README.md)";
      }
    } catch {
      bddDisponible = false;
    }
  });

  beforeEach(async () => {
    if (!bddDisponible) return;
    ADMIN_A = await creerCompte("administrateur");
    ADMIN_B = await creerCompte("administrateur");
    OPERATEUR = await creerCompte("operateur");
    VOYAGEUR = await creerCompte("voyageur");
  });

  afterEach(async () => {
    if (bddDisponible) await supprimerComptesDeTest();
  });

  after(async () => {
    if (bddDisponible) await supprimerComptesDeTest();
    await fermerConnexionBdd();
  });

  test("Lecture du compte authentifié : rôle et état lus en base", async (t) => {
    if (!bddDisponible) return t.skip(raisonIgnore);
    assert.deepEqual(await depot.trouverCompteAuthentifie(OPERATEUR), { id: OPERATEUR, role: "operateur", etat: "actif" });
    assert.equal(await depot.trouverCompteAuthentifie(2_000_000_000), null);
  });

  test("Liste filtrée : nom issu du profil, aucune donnée sensible", async (t) => {
    if (!bddDisponible) return t.skip(raisonIgnore);
    const voyageurs = await depot.lister({ page: 1, limite: 100, role: "voyageur" });
    const v = voyageurs.elements.find((c) => c.id === VOYAGEUR);
    assert.ok(v, "le voyageur de test doit être listé");
    assert.equal(v.nom, nomParId.get(VOYAGEUR));
    const op = (await depot.lister({ page: 1, limite: 100, role: "operateur" })).elements.find((c) => c.id === OPERATEUR);
    assert.equal(op?.nom, nomParId.get(OPERATEUR));
    assert.ok(!("mot_de_passe_hash" in v));

    const personnel = await depot.lister({ page: 1, limite: 100, personnelSeulement: true });
    assert.ok(personnel.elements.some((c) => c.id === OPERATEUR));
    assert.ok(personnel.elements.every((c) => c.role !== "voyageur"));
  });

  test("EF-AUTH-012 : suspension en base, sessions révoquées et audit écrit", async (t) => {
    if (!bddDisponible) return t.skip(raisonIgnore);
    const requeteId = randomUUID();
    const resultat = await service.changerEtat(acteur(ADMIN_A), VOYAGEUR, { etat: "inactif", motif: "Test d'intégration" }, requeteId);

    assert.equal(resultat.etat, "inactif");
    const enBase = await lireCompte(VOYAGEUR);
    assert.equal(enBase.etat, "inactif");
    assert.equal(enBase.version, 2);
    assert.equal(await sessionRevoquee(VOYAGEUR), true);

    const audits = await auditsDe(VOYAGEUR);
    assert.equal(audits.length, 1);
    assert.equal(audits[0].action, "COMPTE_SUSPENDU");
    assert.equal(Number(audits[0].acteur_id), ADMIN_A);
    assert.deepEqual(audits[0].avant, { etat: "actif" });
    assert.deepEqual(audits[0].apres, { etat: "inactif", motif: "Test d'intégration" });
    assert.equal(audits[0].requete_id, requeteId);
  });

  test("EF-AUTH-012 : réactivation en base et audit", async (t) => {
    if (!bddDisponible) return t.skip(raisonIgnore);
    await service.changerEtat(acteur(ADMIN_A), VOYAGEUR, { etat: "inactif" }, randomUUID());
    await service.changerEtat(acteur(ADMIN_A), VOYAGEUR, { etat: "actif" }, randomUUID());

    assert.equal((await lireCompte(VOYAGEUR)).etat, "actif");
    assert.deepEqual((await auditsDe(VOYAGEUR)).map((a) => a.action), ["COMPTE_SUSPENDU", "COMPTE_REACTIVE"]);
  });

  test("EF-AUTH-013 : changement de rôle en base et audit", async (t) => {
    if (!bddDisponible) return t.skip(raisonIgnore);
    const resultat = await service.changerRole(acteur(ADMIN_A), OPERATEUR, { role: "moderateur" }, randomUUID());

    assert.equal(resultat.role, "moderateur");
    assert.equal((await lireCompte(OPERATEUR)).role, "moderateur");
    const audits = await auditsDe(OPERATEUR);
    assert.equal(audits[0].action, "ROLE_MODIFIE");
    assert.deepEqual(audits[0].avant, { role: "operateur" });
    assert.deepEqual(audits[0].apres, { role: "moderateur" });
  });

  test("CA-012 : un opérateur ne peut pas se promouvoir (rien n'est écrit en base)", async (t) => {
    if (!bddDisponible) return t.skip(raisonIgnore);
    const operateur: CompteAuthentifie = { id: OPERATEUR, role: "operateur", etat: "actif" };
    await assert.rejects(
      service.changerRole(operateur, OPERATEUR, { role: "administrateur" }, randomUUID()),
      erreurAvecCode("AUTO_PROMOTION_INTERDITE", 403)
    );
    await assert.rejects(
      service.changerRole(operateur, VOYAGEUR, { role: "administrateur" }, randomUUID()),
      erreurAvecCode("ACCES_INTERDIT", 403)
    );
    assert.equal((await lireCompte(OPERATEUR)).role, "operateur");
    assert.equal((await auditsDe(OPERATEUR)).length, 0);
  });

  test("Version périmée : conflit et aucune modification", async (t) => {
    if (!bddDisponible) return t.skip(raisonIgnore);
    await assert.rejects(
      service.changerEtat(acteur(ADMIN_A), VOYAGEUR, { etat: "inactif", version: 99 }, randomUUID()),
      erreurAvecCode("CONFLIT_VERSION", 409)
    );
    assert.equal((await lireCompte(VOYAGEUR)).etat, "actif");
  });

  test("Échec de l'audit : la transaction entière est annulée (ROLLBACK)", async (t) => {
    if (!bddDisponible) return t.skip(raisonIgnore);
    // Un identifiant de requête qui n'est pas un UUID fait échouer l'INSERT dans journal_audit
    await assert.rejects(service.changerEtat(acteur(ADMIN_A), VOYAGEUR, { etat: "inactif" }, "pas-un-uuid"));

    const enBase = await lireCompte(VOYAGEUR);
    assert.equal(enBase.etat, "actif");
    assert.equal(enBase.version, 1);
    assert.equal(await sessionRevoquee(VOYAGEUR), false);
    assert.equal((await auditsDe(VOYAGEUR)).length, 0);
  });

  test("RG03 : le verrou de gouvernance sérialise réellement deux transactions", async (t) => {
    if (!bddDisponible) return t.skip(raisonIgnore);
    const ordre: string[] = [];
    const premiere = depot.enTransaction(async (tx) => {
      await tx.verrouillerGouvernance();
      ordre.push("T1 début");
      await pause(300);
      ordre.push("T1 fin");
    });
    await pause(50);
    const seconde = depot.enTransaction(async (tx) => {
      await tx.verrouillerGouvernance();
      ordre.push("T2 début");
    });
    await Promise.all([premiere, seconde]);
    assert.deepEqual(ordre, ["T1 début", "T1 fin", "T2 début"]);
  });

  test("Comptage des administrateurs actifs exécuté sur la vraie base", async (t) => {
    if (!bddDisponible) return t.skip(raisonIgnore);
    const autres = await autresAdministrateursActifs();
    const nombre = await depot.enTransaction((tx) => tx.compterAdministrateursActifs());
    assert.equal(nombre, autres + 2);
  });

  test("EF-AUTH-014 : deux administrateurs se suspendent mutuellement en même temps → un seul réussit", async (t) => {
    if (!bddDisponible) return t.skip(raisonIgnore);
    if ((await autresAdministrateursActifs()) > 0) {
      return t.skip("D'autres administrateurs actifs existent dans cette base : scénario non significatif");
    }
    const resultats = await Promise.allSettled([
      service.changerEtat(acteur(ADMIN_A), ADMIN_B, { etat: "inactif" }, randomUUID()),
      service.changerEtat(acteur(ADMIN_B), ADMIN_A, { etat: "inactif" }, randomUUID())
    ]);

    assert.equal(resultats.filter((r) => r.status === "fulfilled").length, 1);
    const etats = [(await lireCompte(ADMIN_A)).etat, (await lireCompte(ADMIN_B)).etat];
    assert.equal(etats.filter((e) => e === "actif").length, 1, "un administrateur actif doit rester");
  });

  test("EF-AUTH-014 : trois suspensions croisées simultanées → au moins un administrateur actif reste", async (t) => {
    if (!bddDisponible) return t.skip(raisonIgnore);
    if ((await autresAdministrateursActifs()) > 0) {
      return t.skip("D'autres administrateurs actifs existent dans cette base : scénario non significatif");
    }
    const ADMIN_C = await creerCompte("administrateur");
    await Promise.allSettled([
      service.changerEtat(acteur(ADMIN_A), ADMIN_B, { etat: "inactif" }, randomUUID()),
      service.changerEtat(acteur(ADMIN_B), ADMIN_C, { etat: "inactif" }, randomUUID()),
      service.changerEtat(acteur(ADMIN_C), ADMIN_A, { etat: "inactif" }, randomUUID())
    ]);
    const nombre = await depot.enTransaction((tx) => tx.compterAdministrateursActifs());
    assert.ok(nombre >= 1, `il reste ${nombre} administrateur(s) actif(s)`);
  });

  test("CA-014 de bout en bout (HTTP + PostgreSQL) : le compte suspendu est bloqué à la requête suivante", async (t) => {
    if (!bddDisponible) return t.skip(raisonIgnore);
    // Seule la vérification du jeton est simulée (en attendant KBE-23) ; le compte est relu dans PostgreSQL
    const authentifier = creerMiddlewareAuthentification(async (jeton) => {
      const m = /^jeton-(\d+)$/.exec(jeton);
      return m ? { compteId: Number(m[1]) } : null;
    }, depot);
    const app = express();
    app.use(express.json());
    app.use("/api/administration", creerRoutesAdministrationComptes(authentifier, new GestionComptesControleur(service)));
    const serveur: Server = app.listen(0);
    await new Promise<void>((resolve) => serveur.once("listening", () => resolve()));
    const base = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}/api/administration`;
    const appeler = (chemin: string, compteId: number, methode = "GET", corps?: unknown) =>
      fetch(base + chemin, {
        method: methode,
        headers: { "Content-Type": "application/json", Authorization: `Bearer jeton-${compteId}` },
        body: corps === undefined ? undefined : JSON.stringify(corps)
      });

    try {
      assert.equal((await appeler("/utilisateurs?limite=1", ADMIN_B)).status, 200);
      assert.equal((await appeler("/utilisateurs?limite=1", VOYAGEUR)).status, 403); // CA-011

      const suspension = await appeler(`/utilisateurs/${ADMIN_B}/statut`, ADMIN_A, "PATCH", { etat: "inactif" });
      assert.equal(suspension.status, 200);

      const bloque = await appeler("/utilisateurs?limite=1", ADMIN_B);
      assert.equal(bloque.status, 403);
      assert.equal((await bloque.json()).erreur.code, "COMPTE_INACTIF");
      assert.equal(await sessionRevoquee(ADMIN_B), true);
    } finally {
      await new Promise<void>((resolve) => serveur.close(() => resolve()));
    }
  });
});
