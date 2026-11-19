// KBE-45 : tests des règles du quota visiteur (sans HTTP ni PostgreSQL).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ErreurApi } from "../src/commun/erreurs";
import { ErreurBaseDeDonnees } from "../src/configuration/baseDeDonnees";
import {
  lireOptionsQuotaVisiteur,
  ServiceQuotaVisiteur
} from "../src/trajets/quota-visiteur.service";
import { DepotQuotaMemoire } from "./aides/depotQuotaMemoire";

const IP = "203.0.113.10";
const SECRET = "secret-de-test";

function creerService(options: { plafondJetonsParIp?: number; maintenant?: () => Date } = {}) {
  const depot = new DepotQuotaMemoire();
  const service = new ServiceQuotaVisiteur(depot, { secretEmpreinteIp: SECRET, ...options });
  return { depot, service };
}

async function codeErreur(promesse: Promise<unknown>): Promise<string> {
  try {
    await promesse;
  } catch (erreur) {
    assert.ok(erreur instanceof ErreurApi, "une ErreurApi est attendue");
    assert.equal(erreur.statut, 429);
    return erreur.code;
  }
  assert.fail("une erreur était attendue");
}

describe("KBE-45 ServiceQuotaVisiteur", () => {
  it("émet un jeton au premier passage et réserve la première recherche", async () => {
    const { depot, service } = creerService();
    const reservation = await service.reserver(undefined, IP);
    assert.equal(reservation.nouveauJeton, true);
    assert.equal(reservation.restant, 9);
    assert.equal(depot.compteur(reservation.jeton), 1);
  });

  it("accepte 10 recherches puis refuse la onzième, sans jamais remettre à zéro", async () => {
    const { service } = creerService();
    const { jeton } = await service.reserver(undefined, IP);
    for (let i = 2; i <= 10; i += 1) {
      const reservation = await service.reserver(jeton, IP);
      assert.equal(reservation.nouveauJeton, false);
      assert.equal(reservation.restant, 10 - i);
    }
    assert.equal(await codeErreur(service.reserver(jeton, IP)), "QUOTA_VISITEUR_ATTEINT");
    // Même bien plus tard : la limite reste atteinte.
    assert.equal(await codeErreur(service.reserver(jeton, IP)), "QUOTA_VISITEUR_ATTEINT");
  });

  it("rend une recherche non aboutie, sans descendre sous zéro", async () => {
    const { depot, service } = creerService();
    const { jeton } = await service.reserver(undefined, IP);
    await service.rendre(jeton);
    await service.rendre(jeton);
    assert.equal(depot.compteur(jeton), 0);
  });

  it("traite un jeton mal formé ou inconnu comme une absence de jeton", async () => {
    const { depot, service } = creerService();
    const malForme = await service.reserver("pas-un-uuid", IP);
    const inconnu = await service.reserver("00000000-0000-4000-8000-000000000000", IP);
    assert.equal(malForme.nouveauJeton, true);
    assert.equal(inconnu.nouveauJeton, true);
    assert.equal(depot.lignes.size, 2);
  });

  it("plafonne les nouveaux jetons par IP sur 24 h, puis accepte de nouveau", async () => {
    let maintenant = new Date("2026-11-19T08:00:00Z");
    const { service } = creerService({ plafondJetonsParIp: 3, maintenant: () => maintenant });
    for (let i = 0; i < 3; i += 1) {
      await service.reserver(undefined, IP);
    }
    assert.equal(await codeErreur(service.reserver(undefined, IP)), "TROP_DE_JETONS_VISITEUR");
    // Une autre IP n'est pas concernée.
    assert.equal((await service.reserver(undefined, "198.51.100.7")).nouveauJeton, true);
    // Plus de 24 h après : le plafond est libéré.
    maintenant = new Date("2026-11-20T08:00:01Z");
    assert.equal((await service.reserver(undefined, IP)).nouveauJeton, true);
  });

  it("ne stocke jamais l'IP en clair et efface les empreintes après 24 h", async () => {
    let maintenant = new Date("2026-11-19T08:00:00Z");
    const { depot, service } = creerService({ maintenant: () => maintenant });
    const { jeton } = await service.reserver(undefined, IP);
    const empreinte = depot.lignes.get(jeton)?.empreinteIp;
    assert.ok(empreinte);
    assert.notEqual(empreinte, IP);
    assert.ok(!empreinte.includes(IP));
    assert.equal(empreinte, service.empreinteIp(IP));

    maintenant = new Date("2026-11-20T09:00:00Z");
    await service.reserver(undefined, "198.51.100.7");
    assert.equal(depot.lignes.get(jeton)?.empreinteIp, null);
    // Le compteur, lui, est conservé.
    assert.equal(depot.compteur(jeton), 1);
  });

  it("propage une panne de base de données sans rien compter", async () => {
    const { depot, service } = creerService();
    const { jeton } = await service.reserver(undefined, IP);
    depot.enPanne = true;
    await assert.rejects(service.reserver(jeton, IP), ErreurBaseDeDonnees);
    depot.enPanne = false;
    assert.equal(depot.compteur(jeton), 1);
  });

  it("exige un secret pour l'empreinte des IP", () => {
    assert.throws(
      () => new ServiceQuotaVisiteur(new DepotQuotaMemoire(), { secretEmpreinteIp: "" }),
      /SECRET_EMPREINTE_IP/
    );
  });

  it("lit la configuration avec les valeurs par défaut 10 et 20", () => {
    assert.deepEqual(lireOptionsQuotaVisiteur({ SECRET_EMPREINTE_IP: "s" }), {
      quotaMax: 10,
      plafondJetonsParIp: 20,
      secretEmpreinteIp: "s"
    });
    assert.equal(lireOptionsQuotaVisiteur({ QUOTA_VISITEUR_MAX: "5" }).quotaMax, 5);
  });
});
