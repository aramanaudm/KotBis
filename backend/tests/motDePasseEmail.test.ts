import assert from "node:assert/strict";
import { describe, it } from "node:test";
import argon2 from "argon2";
import request from "supertest";
import { creerApplicationTest } from "./aides/applicationTest";
import type { FauxDepot } from "./aides/fauxDepot";

const MOT_DE_PASSE = "MotDePasse#2026";
const NOUVEAU_MOT_DE_PASSE = "NouveauMotDePasse#2026";

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
  identifiant: string,
  motDePasse = MOT_DE_PASSE
): Promise<string> {
  const reponse = await request(application)
    .post("/api/connexion")
    .send({ identifiant, motDePasse });
  assert.equal(reponse.status, 200);
  return reponse.body.jeton;
}

async function demanderCode(
  application: ReturnType<typeof creerApplicationTest>["application"],
  email: string
): Promise<string> {
  const reponse = await request(application).post("/api/mot-de-passe/oublie").send({ email });
  assert.equal(reponse.status, 202);
  assert.match(reponse.body.devCode, /^\d{6}$/);
  return reponse.body.devCode;
}

describe("KBE-24 mot de passe et e-mail", () => {
  it("envoie un code temporaire sans révéler l'existence du compte", async () => {
    const { application, depot, codesEnvoyes } = creerApplicationTest({
      exposerCodeDeveloppement: true
    });
    await creerCompte(depot, "reset@example.com", "reset1");
    await creerCompte(depot, "inactif@example.com", "inactif1");
    const compteInactif = [...depot.comptes.values()].find(
      (compte) => compte.email === "inactif@example.com"
    );
    assert.ok(compteInactif);
    compteInactif.etat = "inactif";

    const inconnu = await request(application)
      .post("/api/mot-de-passe/oublie")
      .send({ email: "inconnu@example.com" });
    assert.equal(inconnu.status, 202);
    assert.equal(inconnu.body.devCode, undefined);
    assert.equal(codesEnvoyes.length, 0);

    const inactif = await request(application)
      .post("/api/mot-de-passe/oublie")
      .send({ email: "inactif@example.com" });
    assert.equal(inactif.status, 202);
    assert.equal(inactif.body.devCode, undefined);
    assert.equal(codesEnvoyes.length, 0);

    const actif = await request(application)
      .post("/api/mot-de-passe/oublie")
      .send({ email: "Reset@Example.com" });
    assert.equal(actif.status, 202);
    assert.equal(actif.body.message, inconnu.body.message);
    assert.match(actif.body.devCode, /^\d{6}$/);
    assert.deepEqual(codesEnvoyes, [actif.body.devCode]);

    const code = [...depot.codes.values()][0];
    assert.match(code.empreinteCode, /^[a-f0-9]{64}$/);
    assert.notEqual(code.empreinteCode, actif.body.devCode);
  });

  it("réinitialise le mot de passe, révoque les sessions et invalide le code", async () => {
    const { application, depot } = creerApplicationTest({ exposerCodeDeveloppement: true });
    const compte = depot.ajouterCompte({
      email: "reinitialiser@example.com",
      pseudo: "reinitialiser1",
      motDePasseHash: await hacherPourTest(MOT_DE_PASSE)
    });
    const ancienHash = compte.motDePasseHash;
    const jeton1 = await connecter(application, "reinitialiser@example.com");
    const jeton2 = await connecter(application, "reinitialiser@example.com");
    const code = await demanderCode(application, "reinitialiser@example.com");

    await request(application)
      .post("/api/mot-de-passe/reinitialisation")
      .send({
        email: "reinitialiser@example.com",
        code,
        nouveauMotDePasse: NOUVEAU_MOT_DE_PASSE
      })
      .expect(204);

    assert.notEqual(compte.motDePasseHash, ancienHash);
    assert.equal(await argon2.verify(compte.motDePasseHash, NOUVEAU_MOT_DE_PASSE), true);
    for (const session of depot.sessions.values()) {
      assert.ok(session.revoqueLe);
    }
    await request(application)
      .get("/api/prive")
      .set("Authorization", `Bearer ${jeton1}`)
      .expect(401);
    await request(application)
      .get("/api/prive")
      .set("Authorization", `Bearer ${jeton2}`)
      .expect(401);

    const connexionAncienne = await request(application)
      .post("/api/connexion")
      .send({ identifiant: "reinitialiser@example.com", motDePasse: MOT_DE_PASSE });
    assert.equal(connexionAncienne.status, 401);
    await request(application)
      .post("/api/connexion")
      .send({ identifiant: "reinitialiser@example.com", motDePasse: NOUVEAU_MOT_DE_PASSE })
      .expect(200);

    const reutilisation = await request(application)
      .post("/api/mot-de-passe/reinitialisation")
      .send({
        email: "reinitialiser@example.com",
        code,
        nouveauMotDePasse: "EncoreUnAutre#2026"
      });
    assert.equal(reutilisation.status, 422);
    assert.equal(reutilisation.body.erreur.code, "DONNEES_INVALIDES");
  });

  it("refuse un code expiré ou incorrect et un mot de passe faible", async () => {
    const { application, depot } = creerApplicationTest({ exposerCodeDeveloppement: true });
    await creerCompte(depot, "code@example.com", "code1");

    const codeExpire = await demanderCode(application, "code@example.com");
    for (const code of depot.codes.values()) {
      code.expireLe = new Date(0);
    }
    const expire = await request(application)
      .post("/api/mot-de-passe/reinitialisation")
      .send({ email: "code@example.com", code: codeExpire, nouveauMotDePasse: NOUVEAU_MOT_DE_PASSE });
    assert.equal(expire.status, 422);

    const codeValide = await demanderCode(application, "code@example.com");
    const mauvaisCode = codeValide === "000000" ? "111111" : "000000";
    const incorrect = await request(application)
      .post("/api/mot-de-passe/reinitialisation")
      .send({
        email: "code@example.com",
        code: mauvaisCode,
        nouveauMotDePasse: NOUVEAU_MOT_DE_PASSE
      });
    assert.equal(incorrect.status, 422);

    const faible = await request(application)
      .post("/api/mot-de-passe/reinitialisation")
      .send({ email: "code@example.com", code: codeValide, nouveauMotDePasse: "faible" });
    assert.equal(faible.status, 422);

    await request(application)
      .post("/api/mot-de-passe/reinitialisation")
      .send({
        email: "code@example.com",
        code: codeValide,
        nouveauMotDePasse: NOUVEAU_MOT_DE_PASSE
      })
      .expect(204);
  });

  it("limite les tentatives de réinitialisation", async () => {
    const { application, depot } = creerApplicationTest({ exposerCodeDeveloppement: true });
    await creerCompte(depot, "limite-reset@example.com", "limitereset1");
    const code = await demanderCode(application, "limite-reset@example.com");
    const mauvaisCode = code === "000000" ? "111111" : "000000";

    for (let essai = 0; essai < 5; essai += 1) {
      const reponse = await request(application)
        .post("/api/mot-de-passe/reinitialisation")
        .send({
          email: "limite-reset@example.com",
          code: mauvaisCode,
          nouveauMotDePasse: NOUVEAU_MOT_DE_PASSE
        });
      assert.equal(reponse.status, 422);
    }

    const bloquee = await request(application)
      .post("/api/mot-de-passe/reinitialisation")
      .send({
        email: "limite-reset@example.com",
        code,
        nouveauMotDePasse: NOUVEAU_MOT_DE_PASSE
      });
    assert.equal(bloquee.status, 429);
    assert.equal(bloquee.body.erreur.code, "TROP_DE_TENTATIVES");
  });

  it("change l'e-mail après vérification du mot de passe", async () => {
    const { application, depot } = creerApplicationTest();
    const compte = depot.ajouterCompte({
      email: "email@example.com",
      pseudo: "email1",
      motDePasseHash: await hacherPourTest(MOT_DE_PASSE)
    });
    await creerCompte(depot, "occupe@example.com", "occupe1");
    const jeton = await connecter(application, "email@example.com");

    const change = await request(application)
      .patch("/api/utilisateurs/moi/email")
      .set("Authorization", `Bearer ${jeton}`)
      .send({ email: "Nouveau@Example.com", motDePasse: MOT_DE_PASSE });
    assert.equal(change.status, 200);
    assert.equal(change.body.utilisateur.email, "nouveau@example.com");
    assert.equal(compte.email, "nouveau@example.com");
    assert.equal(JSON.stringify(change.body).toLowerCase().includes("motdepasse"), false);

    const dejaPris = await request(application)
      .patch("/api/utilisateurs/moi/email")
      .set("Authorization", `Bearer ${jeton}`)
      .send({ email: "occupe@example.com", motDePasse: MOT_DE_PASSE });
    assert.equal(dejaPris.status, 409);
    assert.equal(dejaPris.body.erreur.code, "EMAIL_DEJA_UTILISE");

    const mauvaisMotDePasse = await request(application)
      .patch("/api/utilisateurs/moi/email")
      .set("Authorization", `Bearer ${jeton}`)
      .send({ email: "autre@example.com", motDePasse: "Mauvais#2026" });
    assert.equal(mauvaisMotDePasse.status, 401);
    assert.equal(mauvaisMotDePasse.body.erreur.code, "MOT_DE_PASSE_INCORRECT");

    await request(application)
      .patch("/api/utilisateurs/moi/email")
      .send({ email: "sans-jeton@example.com", motDePasse: MOT_DE_PASSE })
      .expect(401);
  });

  it("change le mot de passe et déconnecte les autres sessions", async () => {
    const { application, depot } = creerApplicationTest();
    const compte = depot.ajouterCompte({
      email: "motdepasse@example.com",
      pseudo: "motdepasse1",
      motDePasseHash: await hacherPourTest(MOT_DE_PASSE)
    });
    const jetonCourant = await connecter(application, "motdepasse@example.com");
    const jetonAutre = await connecter(application, "motdepasse@example.com");

    await request(application)
      .patch("/api/utilisateurs/moi/mot-de-passe")
      .set("Authorization", `Bearer ${jetonCourant}`)
      .send({
        motDePasseActuel: MOT_DE_PASSE,
        nouveauMotDePasse: NOUVEAU_MOT_DE_PASSE
      })
      .expect(204);

    assert.equal(await argon2.verify(compte.motDePasseHash, NOUVEAU_MOT_DE_PASSE), true);
    await request(application)
      .get("/api/prive")
      .set("Authorization", `Bearer ${jetonCourant}`)
      .expect(200);
    await request(application)
      .get("/api/prive")
      .set("Authorization", `Bearer ${jetonAutre}`)
      .expect(401);
    await request(application)
      .post("/api/connexion")
      .send({ identifiant: "motdepasse@example.com", motDePasse: MOT_DE_PASSE })
      .expect(401);
    await request(application)
      .post("/api/connexion")
      .send({ identifiant: "motdepasse@example.com", motDePasse: NOUVEAU_MOT_DE_PASSE })
      .expect(200);

    const mauvaisActuel = await request(application)
      .patch("/api/utilisateurs/moi/mot-de-passe")
      .set("Authorization", `Bearer ${jetonCourant}`)
      .send({
        motDePasseActuel: MOT_DE_PASSE,
        nouveauMotDePasse: "EncoreUnAutre#2026"
      });
    assert.equal(mauvaisActuel.status, 401);
    assert.equal(mauvaisActuel.body.erreur.code, "MOT_DE_PASSE_INCORRECT");

    const faible = await request(application)
      .patch("/api/utilisateurs/moi/mot-de-passe")
      .set("Authorization", `Bearer ${jetonCourant}`)
      .send({ motDePasseActuel: NOUVEAU_MOT_DE_PASSE, nouveauMotDePasse: "faible" });
    assert.equal(faible.status, 422);
  });

  it("accepte les alias frontend et refuse les champs obligatoires absents", async () => {
    const { application, depot } = creerApplicationTest();
    await creerCompte(depot, "alias-email@example.com", "aliasemail1");
    const jeton = await connecter(application, "alias-email@example.com");

    const emailAlias = await request(application)
      .patch("/api/utilisateurs/moi/email")
      .set("Authorization", `Bearer ${jeton}`)
      .send({ email: "alias-nouveau@example.com", password: MOT_DE_PASSE });
    assert.equal(emailAlias.status, 200);

    const motDePasseAlias = await request(application)
      .patch("/api/utilisateurs/moi/mot-de-passe")
      .set("Authorization", `Bearer ${jeton}`)
      .send({ currentPassword: MOT_DE_PASSE, newPassword: NOUVEAU_MOT_DE_PASSE });
    assert.equal(motDePasseAlias.status, 204);

    const sansEmail = await request(application)
      .patch("/api/utilisateurs/moi/email")
      .set("Authorization", `Bearer ${jeton}`)
      .send({ motDePasse: NOUVEAU_MOT_DE_PASSE });
    assert.equal(sansEmail.status, 422);

    const sansMotDePasse = await request(application)
      .patch("/api/utilisateurs/moi/mot-de-passe")
      .set("Authorization", `Bearer ${jeton}`)
      .send({ nouveauMotDePasse: "EncoreUnAutre#2026" });
    assert.equal(sansMotDePasse.status, 422);
  });
});
