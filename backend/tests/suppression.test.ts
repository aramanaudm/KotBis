import assert from "node:assert/strict";
import { describe, it } from "node:test";
import argon2 from "argon2";
import request from "supertest";
import { creerApplicationTest } from "./aides/applicationTest";
import type { FauxDepot } from "./aides/fauxDepot";

const MOT_DE_PASSE = "MotDePasse#2026";

async function hacherPourTest(motDePasse: string): Promise<string> {
  return argon2.hash(motDePasse, {
    type: argon2.argon2id,
    memoryCost: 1024,
    timeCost: 1,
    parallelism: 1
  });
}

async function creerCompte(depot: FauxDepot, email: string, pseudo: string): Promise<void> {
  depot.ajouterCompte({
    email,
    pseudo,
    motDePasseHash: await hacherPourTest(MOT_DE_PASSE)
  });
}

async function connecter(
  application: ReturnType<typeof creerApplicationTest>["application"],
  identifiant: string
): Promise<string> {
  const reponse = await request(application)
    .post("/api/connexion")
    .send({ identifiant, motDePasse: MOT_DE_PASSE });
  assert.equal(reponse.status, 200);
  return reponse.body.jeton;
}

describe("KBE-26 demande de suppression", () => {
  it("exige une session et le mot de passe du demandeur", async () => {
    const { application, depot } = creerApplicationTest();
    await creerCompte(depot, "suppression-auth@example.com", "supprAuth");
    const jeton = await connecter(application, "suppression-auth@example.com");

    await request(application)
      .delete("/api/utilisateurs/moi")
      .send({ motDePasse: MOT_DE_PASSE })
      .expect(401);

    const sansMotDePasse = await request(application)
      .delete("/api/utilisateurs/moi")
      .set("Authorization", `Bearer ${jeton}`)
      .send({})
      .expect(422);
    assert.equal(sansMotDePasse.body.erreur.code, "DONNEES_INVALIDES");

    const mauvaisMotDePasse = await request(application)
      .delete("/api/utilisateurs/moi")
      .set("Authorization", `Bearer ${jeton}`)
      .send({ motDePasse: "MauvaisMotDePasse#2026" });
    assert.equal(mauvaisMotDePasse.status, 401);
    assert.equal(mauvaisMotDePasse.body.erreur.code, "MOT_DE_PASSE_INCORRECT");
    assert.equal(depot.demandesSuppression.length, 0);

    await request(application)
      .get("/api/utilisateurs/moi")
      .set("Authorization", `Bearer ${jeton}`)
      .expect(200);
  });

  it("crée une demande en attente sans supprimer le compte", async () => {
    const { application, depot } = creerApplicationTest();
    await creerCompte(depot, "suppression@example.com", "suppression1");
    const jeton = await connecter(application, "suppression@example.com");

    const demande = await request(application)
      .delete("/api/utilisateurs/moi")
      .set("Authorization", `Bearer ${jeton}`)
      .send({ motDePasse: MOT_DE_PASSE, motif: "Je quitte le pays." });
    assert.equal(demande.status, 202);
    assert.deepEqual(demande.body, { demande: { statut: "en_attente" } });
    assert.equal(demande.headers["cache-control"], "no-store");

    assert.equal(depot.demandesSuppression.length, 1);
    assert.equal(depot.demandesSuppression[0].compteId, "1");
    assert.equal(depot.demandesSuppression[0].motif, "Je quitte le pays.");
    assert.equal(depot.demandesSuppression[0].statut, "en_attente");
    assert.equal(depot.comptes.size, 1);

    await request(application)
      .get("/api/utilisateurs/moi")
      .set("Authorization", `Bearer ${jeton}`)
      .expect(200);

    const doublon = await request(application)
      .delete("/api/utilisateurs/moi")
      .set("Authorization", `Bearer ${jeton}`)
      .send({ motDePasse: MOT_DE_PASSE, motif: "Deuxième demande." });
    assert.equal(doublon.status, 202);
    assert.equal(depot.demandesSuppression.length, 1);
    assert.equal(depot.demandesSuppression[0].motif, "Je quitte le pays.");
  });

  it("utilise uniquement le compte de la session", async () => {
    const { application, depot } = creerApplicationTest();
    await creerCompte(depot, "suppression-a@example.com", "supprA");
    await creerCompte(depot, "suppression-b@example.com", "supprB");
    const jetonA = await connecter(application, "suppression-a@example.com");
    const jetonB = await connecter(application, "suppression-b@example.com");

    const demande = await request(application)
      .delete("/api/utilisateurs/moi")
      .set("Authorization", `Bearer ${jetonA}`)
      .send({
        motDePasse: MOT_DE_PASSE,
        motif: "Demande A",
        compteId: "2",
        email: "suppression-b@example.com"
      });
    assert.equal(demande.status, 202);
    assert.deepEqual(depot.demandesSuppression, [
      { compteId: "1", motif: "Demande A", statut: "en_attente" }
    ]);

    await request(application)
      .get("/api/utilisateurs/moi")
      .set("Authorization", `Bearer ${jetonB}`)
      .expect(200);
    assert.equal(depot.comptes.size, 2);

    const demandeB = await request(application)
      .delete("/api/utilisateurs/moi")
      .set("Authorization", `Bearer ${jetonB}`)
      .send({ motDePasse: MOT_DE_PASSE, reason: "Demande B" });
    assert.equal(demandeB.status, 202);
    assert.equal(depot.demandesSuppression.length, 2);
    assert.equal(depot.demandesSuppression[1].compteId, "2");
    assert.equal(depot.demandesSuppression[1].motif, "Demande B");
  });

  it("valide le motif et accepte son alias", async () => {
    const { application, depot } = creerApplicationTest();
    await creerCompte(depot, "suppression-motif@example.com", "supprMotif");
    const jeton = await connecter(application, "suppression-motif@example.com");

    const motifTropLong = await request(application)
      .delete("/api/utilisateurs/moi")
      .set("Authorization", `Bearer ${jeton}`)
      .send({ motDePasse: MOT_DE_PASSE, motif: "a".repeat(601) });
    assert.equal(motifTropLong.status, 422);

    const motifInvalide = await request(application)
      .delete("/api/utilisateurs/moi")
      .set("Authorization", `Bearer ${jeton}`)
      .send({ motDePasse: MOT_DE_PASSE, motif: 123 });
    assert.equal(motifInvalide.status, 422);

    const alias = await request(application)
      .delete("/api/utilisateurs/moi")
      .set("Authorization", `Bearer ${jeton}`)
      .send({ motDePasse: MOT_DE_PASSE, reason: "  Raison via alias.  " });
    assert.equal(alias.status, 202);
    assert.equal(depot.demandesSuppression[0].motif, "Raison via alias.");
  });
});
