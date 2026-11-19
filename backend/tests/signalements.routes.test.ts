import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import argon2 from "argon2";
import request from "supertest";
import { creerApplicationSignalementsTest } from "./aides/applicationSignalementsTest";
import type { FauxDepot } from "./aides/fauxDepot";

const MOT_DE_PASSE = "MotDePasse#2026";

async function hacher(): Promise<string> {
  return argon2.hash(MOT_DE_PASSE, {
    type: argon2.argon2id,
    memoryCost: 1024,
    timeCost: 1,
    parallelism: 1
  });
}

async function ajouterCompte(
  depot: FauxDepot,
  email: string,
  pseudo: string,
  role = "voyageur"
): Promise<string> {
  return depot.ajouterCompte({ email, pseudo, motDePasseHash: await hacher(), role }).compteId;
}

async function connecter(application: ReturnType<typeof creerApplicationSignalementsTest>["application"], identifiant: string): Promise<string> {
  const reponse = await request(application)
    .post("/api/connexion")
    .send({ identifiant, motDePasse: MOT_DE_PASSE });
  assert.equal(reponse.status, 200);
  return reponse.body.jeton;
}

function corpsSignalement(surcharges: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    busId: "1",
    categorie: "c1",
    commentaire: "Retard important constaté.",
    observeLe: new Date(Date.now() - 60000).toISOString(),
    cleIdempotence: randomUUID(),
    ...surcharges
  };
}

describe("Routes Signalements", () => {
  it("refuse un visiteur non connecté", async () => {
    const { application } = creerApplicationSignalementsTest();
    const reponse = await request(application).post("/api/signalements").send(corpsSignalement());
    assert.equal(reponse.status, 401);
    assert.equal(reponse.body.erreur.code, "AUTHENTIFICATION_REQUISE");
  });

  it("refuse un compte qui n'est pas voyageur", async () => {
    const { application, depotAuth } = creerApplicationSignalementsTest();
    await ajouterCompte(depotAuth, "operateur@example.com", "operateur1", "operateur");
    const jeton = await connecter(application, "operateur@example.com");

    const reponse = await request(application)
      .post("/api/signalements")
      .set("Authorization", `Bearer ${jeton}`)
      .send(corpsSignalement());

    assert.equal(reponse.status, 403);
    assert.equal(reponse.body.erreur.code, "ACCES_REFUSE");
  });

  it("crée un signalement avec l'auteur issu de la session", async () => {
    const { application, depotAuth } = creerApplicationSignalementsTest();
    const compteId = await ajouterCompte(depotAuth, "voyageur@example.com", "voyageur1");
    const jeton = await connecter(application, "voyageur@example.com");

    const reponse = await request(application)
      .post("/api/signalements")
      .set("Authorization", `Bearer ${jeton}`)
      .send(corpsSignalement({ auteurId: "999", type: "autre" }));

    assert.equal(reponse.status, 201);
    assert.equal(reponse.body.data.auteurId, compteId);
    assert.equal(reponse.body.data.statut, "a_verifier");
    assert.equal(reponse.body.data.type, "autre");
    assert.ok(Date.parse(reponse.body.data.recuLe) >= Date.parse(reponse.body.data.observeLe));
  });

  it("ne crée pas de doublon pour la même clé d'idempotence", async () => {
    const { application, depotAuth, depotSignalements } = creerApplicationSignalementsTest();
    await ajouterCompte(depotAuth, "doublon@example.com", "doublon1");
    const jeton = await connecter(application, "doublon@example.com");
    const corps = corpsSignalement();

    const premier = await request(application)
      .post("/api/signalements")
      .set("Authorization", `Bearer ${jeton}`)
      .send(corps);
    const second = await request(application)
      .post("/api/signalements")
      .set("Authorization", `Bearer ${jeton}`)
      .send(corps);

    assert.equal(premier.status, 201);
    assert.equal(second.status, 200);
    assert.equal(second.body.idempotent, true);
    assert.equal(second.body.data.reference, premier.body.data.reference);
    assert.equal(depotSignalements.signalements.length, 1);
  });

  it("applique la limite de 600 caractères du commentaire", async () => {
    const { application, depotAuth } = creerApplicationSignalementsTest();
    await ajouterCompte(depotAuth, "commentaire@example.com", "commentaire1");
    const jeton = await connecter(application, "commentaire@example.com");

    const limite = await request(application)
      .post("/api/signalements")
      .set("Authorization", `Bearer ${jeton}`)
      .send(corpsSignalement({ commentaire: "a".repeat(600) }));
    assert.equal(limite.status, 201);

    const depasse = await request(application)
      .post("/api/signalements")
      .set("Authorization", `Bearer ${jeton}`)
      .send(corpsSignalement({ commentaire: "a".repeat(601) }));
    assert.equal(depasse.status, 400);
    assert.equal(depasse.body.erreur.details[0].champ, "commentaire");
  });

  it("n'enregistre la position GPS qu'avec consentement explicite", async () => {
    const { application, depotAuth } = creerApplicationSignalementsTest();
    await ajouterCompte(depotAuth, "gps@example.com", "gps1");
    const jeton = await connecter(application, "gps@example.com");
    const position = { latitude: -20.1609, longitude: 57.4989 };

    const sansConsentement = await request(application)
      .post("/api/signalements")
      .set("Authorization", `Bearer ${jeton}`)
      .send(corpsSignalement({ position }));
    assert.equal(sansConsentement.status, 400);
    assert.equal(sansConsentement.body.erreur.details[0].champ, "consentementGps");

    const avecConsentement = await request(application)
      .post("/api/signalements")
      .set("Authorization", `Bearer ${jeton}`)
      .send(corpsSignalement({ position, consentementGps: true }));
    assert.equal(avecConsentement.status, 201);
    assert.deepEqual(avecConsentement.body.data.position, position);
  });

  it("isole strictement les signalements d'un voyageur", async () => {
    const { application, depotAuth } = creerApplicationSignalementsTest();
    await ajouterCompte(depotAuth, "a@example.com", "voyageurA");
    await ajouterCompte(depotAuth, "b@example.com", "voyageurB");
    const jetonA = await connecter(application, "a@example.com");
    const jetonB = await connecter(application, "b@example.com");

    await request(application)
      .post("/api/signalements")
      .set("Authorization", `Bearer ${jetonA}`)
      .send(corpsSignalement({ commentaire: "Signalement de A" }));
    await request(application)
      .post("/api/signalements")
      .set("Authorization", `Bearer ${jetonB}`)
      .send(corpsSignalement({ commentaire: "Signalement de B" }));

    const listeA = await request(application)
      .get("/api/signalements/moi")
      .set("Authorization", `Bearer ${jetonA}`);
    const listeB = await request(application)
      .get("/api/signalements/moi")
      .set("Authorization", `Bearer ${jetonB}`);

    assert.equal(listeA.status, 200);
    assert.equal(listeA.body.data.length, 1);
    assert.equal(listeA.body.data[0].commentaire, "Signalement de A");
    assert.equal(listeB.body.data.length, 1);
    assert.equal(listeB.body.data[0].commentaire, "Signalement de B");
    assert.equal(listeA.body.data[0].auteurId !== listeB.body.data[0].auteurId, true);
    assert.equal(JSON.stringify(listeA.body).includes("email"), false);
    assert.equal(JSON.stringify(listeA.body).includes("telephone"), false);
  });

  it("fournit au back-office une liste paginée, filtrable et modifiable", async () => {
    const { application, depotAuth } = creerApplicationSignalementsTest();
    await ajouterCompte(depotAuth, "adminvoyageur@example.com", "adminvoyageur");
    await ajouterCompte(depotAuth, "backoffice@example.com", "backoffice1", "operateur");
    const jetonVoyageur = await connecter(application, "adminvoyageur@example.com");
    const jetonAdmin = await connecter(application, "backoffice@example.com");

    const cree = await request(application)
      .post("/api/signalements")
      .set("Authorization", `Bearer ${jetonVoyageur}`)
      .send(corpsSignalement({ commentaire: "Recherche back-office" }));
    await request(application)
      .post("/api/signalements")
      .set("Authorization", `Bearer ${jetonVoyageur}`)
      .send(corpsSignalement({ commentaire: "Second signalement" }));

    const interdit = await request(application)
      .get("/api/signalements")
      .set("Authorization", `Bearer ${jetonVoyageur}`);
    assert.equal(interdit.status, 403);

    const paginee = await request(application)
      .get("/api/signalements?statut=a_verifier&limit=1&page=1")
      .set("Authorization", `Bearer ${jetonAdmin}`);
    assert.equal(paginee.status, 200);
    assert.equal(paginee.body.data.total, 2);
    assert.equal(paginee.body.data.pages, 2);
    assert.equal(paginee.body.data.elements.length, 1);
    assert.ok(paginee.body.data.elements[0].reference);
    assert.ok(paginee.body.data.elements[0].bus);

    const recherche = await request(application)
      .get(`/api/signalements?q=${cree.body.data.reference}`)
      .set("Authorization", `Bearer ${jetonAdmin}`);
    assert.equal(recherche.body.data.total, 1);

    const modification = await request(application)
      .put(`/api/signalements/${cree.body.data.reference}/statut`)
      .set("Authorization", `Bearer ${jetonAdmin}`)
      .send({ statut: "confirme" });
    assert.equal(modification.status, 200);
    assert.equal(modification.body.data.statut, "confirme");
    assert.equal(modification.body.data.version, 2);
  });
});
