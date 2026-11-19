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

describe("KBE-25 profil personnel", () => {
  it("lit uniquement le profil de la session et ne révèle aucun secret", async () => {
    const { application, depot } = creerApplicationTest();
    await creerCompte(depot, "profil-a@example.com", "profilA");
    await creerCompte(depot, "profil-b@example.com", "profilB");
    const compteA = [...depot.comptes.values()].find(
      (compte) => compte.email === "profil-a@example.com"
    );
    const compteB = [...depot.comptes.values()].find(
      (compte) => compte.email === "profil-b@example.com"
    );
    assert.ok(compteA);
    assert.ok(compteB);
    const jetonA = await connecter(application, "profil-a@example.com");
    const jetonB = await connecter(application, "profil-b@example.com");

    const reponseA = await request(application)
      .get("/api/utilisateurs/moi")
      .set("Authorization", `Bearer ${jetonA}`)
      .expect(200);
    assert.equal(reponseA.body.utilisateur.compteId, compteA.compteId);
    assert.equal(reponseA.body.utilisateur.pseudo, "profilA");
    assert.equal(reponseA.body.utilisateur.email, "profil-a@example.com");
    assert.equal(reponseA.headers["cache-control"], "no-store");
    const corps = JSON.stringify(reponseA.body).toLowerCase();
    assert.equal(corps.includes("motdepasse"), false);
    assert.equal(corps.includes("hash"), false);
    assert.equal(corps.includes("empreinte"), false);

    const reponseB = await request(application)
      .get("/api/utilisateurs/moi")
      .set("Authorization", `Bearer ${jetonB}`)
      .expect(200);
    assert.equal(reponseB.body.utilisateur.compteId, compteB.compteId);
    assert.equal(reponseB.body.utilisateur.pseudo, "profilB");
    assert.notEqual(reponseB.body.utilisateur.compteId, reponseA.body.utilisateur.compteId);
  });

  it("modifie les champs autorisés du profil de la session", async () => {
    const { application, depot } = creerApplicationTest();
    await creerCompte(depot, "modifier@example.com", "modifier1");
    const jeton = await connecter(application, "modifier@example.com");

    const modification = await request(application)
      .patch("/api/utilisateurs/moi")
      .set("Authorization", `Bearer ${jeton}`)
      .send({
        pseudo: "modifier2",
        zoneLibre: "Curepipe",
        telephone: "+230 5555 1234",
        avatarRef: "avatar-01"
      });
    assert.equal(modification.status, 200);
    assert.equal(modification.body.utilisateur.pseudo, "modifier2");
    assert.equal(modification.body.utilisateur.zoneLibre, "Curepipe");
    assert.equal(modification.body.utilisateur.telephone, "+230 5555 1234");
    assert.equal(modification.body.utilisateur.avatarRef, "avatar-01");
    assert.equal(modification.headers["cache-control"], "no-store");

    const profil = await request(application)
      .get("/api/utilisateurs/moi")
      .set("Authorization", `Bearer ${jeton}`)
      .expect(200);
    assert.equal(profil.body.utilisateur.pseudo, "modifier2");
    assert.equal(profil.body.utilisateur.zoneLibre, "Curepipe");

    const alias = await request(application)
      .patch("/api/utilisateurs/moi")
      .set("Authorization", `Bearer ${jeton}`)
      .send({ pseudonyme: "modifier3", city: "Port-Louis", phone: "+230 5555 5678" });
    assert.equal(alias.status, 200);
    assert.equal(alias.body.utilisateur.pseudo, "modifier3");
    assert.equal(alias.body.utilisateur.zoneLibre, "Port-Louis");
    assert.equal(alias.body.utilisateur.telephone, "+230 5555 5678");
  });

  it("ignore les identifiants fournis dans le corps et n'accède jamais à un autre compte", async () => {
    const { application, depot } = creerApplicationTest();
    await creerCompte(depot, "isole-a@example.com", "isoleA");
    await creerCompte(depot, "isole-b@example.com", "isoleB");
    const compteA = [...depot.comptes.values()].find(
      (compte) => compte.email === "isole-a@example.com"
    );
    const compteB = [...depot.comptes.values()].find(
      (compte) => compte.email === "isole-b@example.com"
    );
    assert.ok(compteA);
    assert.ok(compteB);
    const jetonA = await connecter(application, "isole-a@example.com");

    const modification = await request(application)
      .patch("/api/utilisateurs/moi")
      .set("Authorization", `Bearer ${jetonA}`)
      .send({
        pseudo: "isoleA2",
        compteId: compteB.compteId,
        email: compteB.email,
        role: "administrateur"
      });
    assert.equal(modification.status, 200);
    assert.equal(modification.body.utilisateur.compteId, compteA.compteId);
    assert.equal(modification.body.utilisateur.pseudo, "isoleA2");
    assert.equal(modification.body.utilisateur.email, "isole-a@example.com");
    assert.equal(modification.body.utilisateur.role, "voyageur");

    assert.equal(compteA.pseudo, "isoleA2");
    assert.equal(compteB.pseudo, "isoleB");
    assert.equal(compteB.email, "isole-b@example.com");
    assert.equal(compteB.role, "voyageur");

    const profilB = await request(application)
      .get("/api/utilisateurs/moi")
      .set("Authorization", `Bearer ${await connecter(application, "isole-b@example.com")}`)
      .expect(200);
    assert.equal(profilB.body.utilisateur.compteId, compteB.compteId);
    assert.equal(profilB.body.utilisateur.pseudo, "isoleB");
  });

  it("refuse un pseudonyme déjà pris et les champs invalides ou absents", async () => {
    const { application, depot } = creerApplicationTest();
    await creerCompte(depot, "conflit-a@example.com", "conflitA");
    await creerCompte(depot, "conflit-b@example.com", "conflitB");
    const jeton = await connecter(application, "conflit-a@example.com");

    const pseudoDejaPris = await request(application)
      .patch("/api/utilisateurs/moi")
      .set("Authorization", `Bearer ${jeton}`)
      .send({ pseudo: "CONFLITB" });
    assert.equal(pseudoDejaPris.status, 409);
    assert.equal(pseudoDejaPris.body.erreur.code, "PSEUDO_DEJA_UTILISE");

    const pseudoInvalide = await request(application)
      .patch("/api/utilisateurs/moi")
      .set("Authorization", `Bearer ${jeton}`)
      .send({ pseudo: "a" });
    assert.equal(pseudoInvalide.status, 422);

    const zoneInvalide = await request(application)
      .patch("/api/utilisateurs/moi")
      .set("Authorization", `Bearer ${jeton}`)
      .send({ zoneLibre: "z".repeat(61) });
    assert.equal(zoneInvalide.status, 422);

    const telephoneInvalide = await request(application)
      .patch("/api/utilisateurs/moi")
      .set("Authorization", `Bearer ${jeton}`)
      .send({ telephone: "abc" });
    assert.equal(telephoneInvalide.status, 422);

    const aucunChamp = await request(application)
      .patch("/api/utilisateurs/moi")
      .set("Authorization", `Bearer ${jeton}`)
      .send({});
    assert.equal(aucunChamp.status, 422);

    const identifiantSeul = await request(application)
      .patch("/api/utilisateurs/moi")
      .set("Authorization", `Bearer ${jeton}`)
      .send({ compteId: "999", email: "autre@example.com", role: "administrateur" });
    assert.equal(identifiantSeul.status, 422);

    await request(application).patch("/api/utilisateurs/moi").send({ pseudo: "sansjeton" }).expect(401);
  });

  it("gère l'avatar séparément et permet de le retirer", async () => {
    const { application, depot } = creerApplicationTest();
    await creerCompte(depot, "avatar@example.com", "avatar1");
    const jeton = await connecter(application, "avatar@example.com");

    const avatar = await request(application)
      .patch("/api/utilisateurs/moi/avatar")
      .set("Authorization", `Bearer ${jeton}`)
      .send({ avatarRef: "avatar-02" });
    assert.equal(avatar.status, 200);
    assert.equal(avatar.body.utilisateur.avatarRef, "avatar-02");

    const retrait = await request(application)
      .patch("/api/utilisateurs/moi/avatar")
      .set("Authorization", `Bearer ${jeton}`)
      .send({ avatarRef: null });
    assert.equal(retrait.status, 200);
    assert.equal(retrait.body.utilisateur.avatarRef, null);

    const sansAvatar = await request(application)
      .patch("/api/utilisateurs/moi/avatar")
      .set("Authorization", `Bearer ${jeton}`)
      .send({});
    assert.equal(sansAvatar.status, 422);

    const avatarTropLong = await request(application)
      .patch("/api/utilisateurs/moi/avatar")
      .set("Authorization", `Bearer ${jeton}`)
      .send({ avatarRef: "a".repeat(121) });
    assert.equal(avatarTropLong.status, 422);
  });
});
