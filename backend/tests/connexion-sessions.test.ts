import assert from "node:assert/strict";
import { describe, it } from "node:test";
import argon2 from "argon2";
import request from "supertest";
import { creerApplicationTest } from "./aides/applicationTest";
import type { FauxDepot } from "./aides/fauxDepot";

const MOT_DE_PASSE = "MotDePasse#2026";
const MAUVAIS_MOT_DE_PASSE = "MauvaisMotDePasse#2026";

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

describe("KBE-23 connexion et sessions", () => {
  it("connecte avec l'e-mail ou le pseudonyme sans exposer de secret", async () => {
    const { application, depot } = creerApplicationTest();
    await creerCompte(depot, "session@example.com", "session1");

    const parEmail = await request(application).post("/api/connexion").send({
      identifiant: "Session@Example.com",
      motDePasse: MOT_DE_PASSE
    });
    assert.equal(parEmail.status, 200);
    assert.equal(parEmail.body.utilisateur.pseudo, "session1");
    assert.equal(parEmail.body.utilisateur.email, "session@example.com");
    assert.ok(parEmail.body.jeton);
    assert.ok(Date.parse(parEmail.body.expireLe) > Date.now());
    const corps = JSON.stringify(parEmail.body).toLowerCase();
    assert.equal(corps.includes("motdepasse"), false);
    assert.equal(corps.includes("hash"), false);

    const parPseudo = await request(application).post("/api/connexion").send({
      identifiant: "SESSION1",
      motDePasse: MOT_DE_PASSE
    });
    assert.equal(parPseudo.status, 200);
    assert.notEqual(parPseudo.body.jeton, parEmail.body.jeton);
    assert.equal(depot.sessions.size, 2);
  });

  it("stocke uniquement l'empreinte du jeton de session", async () => {
    const { application, depot } = creerApplicationTest();
    await creerCompte(depot, "empreinte@example.com", "empreinte1");

    const jeton = await connecter(application, "empreinte@example.com");
    assert.equal(depot.sessions.has(jeton), false);
    assert.equal(depot.sessions.size, 1);
    assert.match([...depot.sessions.keys()][0], /^[a-f0-9]{64}$/);
  });

  it("refuse un mauvais mot de passe, un compte inconnu et un compte inactif", async () => {
    const { application, depot } = creerApplicationTest();
    await creerCompte(depot, "invalide@example.com", "invalide1");
    const compte = [...depot.comptes.values()][0];
    compte.etat = "inactif";

    const mauvaisMotDePasse = await request(application).post("/api/connexion").send({
      identifiant: "invalide@example.com",
      motDePasse: MAUVAIS_MOT_DE_PASSE
    });
    assert.equal(mauvaisMotDePasse.status, 401);
    assert.equal(mauvaisMotDePasse.body.erreur.code, "IDENTIFIANTS_INVALIDES");

    const compteInactif = await request(application).post("/api/connexion").send({
      identifiant: "invalide@example.com",
      motDePasse: MOT_DE_PASSE
    });
    assert.equal(compteInactif.status, 401);
    assert.equal(compteInactif.body.erreur.code, "IDENTIFIANTS_INVALIDES");

    const compteInconnu = await request(application).post("/api/connexion").send({
      identifiant: "inconnu@example.com",
      motDePasse: MOT_DE_PASSE
    });
    assert.equal(compteInconnu.status, 401);
    assert.equal(compteInconnu.body.erreur.code, "IDENTIFIANTS_INVALIDES");
    assert.equal(depot.sessions.size, 0);
  });

  it("limite les tentatives répétées", async () => {
    const { application, depot } = creerApplicationTest();
    await creerCompte(depot, "limite@example.com", "limite1");

    for (let essai = 0; essai < 5; essai += 1) {
      const reponse = await request(application).post("/api/connexion").send({
        identifiant: "limite@example.com",
        motDePasse: MAUVAIS_MOT_DE_PASSE
      });
      assert.equal(reponse.status, 401);
    }

    const bloquee = await request(application).post("/api/connexion").send({
      identifiant: "limite@example.com",
      motDePasse: MOT_DE_PASSE
    });
    assert.equal(bloquee.status, 429);
    assert.equal(bloquee.body.erreur.code, "TROP_DE_TENTATIVES");
    assert.equal(depot.sessions.size, 0);
  });

  it("réinitialise le compteur de tentatives après une connexion réussie", async () => {
    const { application, depot } = creerApplicationTest();
    await creerCompte(depot, "reinitialise@example.com", "reinitialise1");

    for (let essai = 0; essai < 4; essai += 1) {
      await request(application)
        .post("/api/connexion")
        .send({ identifiant: "reinitialise@example.com", motDePasse: MAUVAIS_MOT_DE_PASSE })
        .expect(401);
    }
    await request(application)
      .post("/api/connexion")
      .send({ identifiant: "reinitialise@example.com", motDePasse: MOT_DE_PASSE })
      .expect(200);

    for (let essai = 0; essai < 5; essai += 1) {
      await request(application)
        .post("/api/connexion")
        .send({ identifiant: "reinitialise@example.com", motDePasse: MAUVAIS_MOT_DE_PASSE })
        .expect(401);
    }
    await request(application)
      .post("/api/connexion")
      .send({ identifiant: "reinitialise@example.com", motDePasse: MOT_DE_PASSE })
      .expect(429);
  });

  it("protège les routes privées et invalide la session après déconnexion", async () => {
    const { application, depot } = creerApplicationTest();
    await creerCompte(depot, "protege@example.com", "protege1");
    const jeton = await connecter(application, "protege@example.com");

    const sansJeton = await request(application).get("/api/prive");
    assert.equal(sansJeton.status, 401);
    assert.equal(sansJeton.body.erreur.code, "AUTHENTIFICATION_REQUISE");

    const jetonInvalide = await request(application)
      .get("/api/prive")
      .set("Authorization", "Bearer jeton-invalide");
    assert.equal(jetonInvalide.status, 401);
    assert.equal(jetonInvalide.body.erreur.code, "SESSION_INVALIDE");

    const profil = await request(application)
      .get("/api/prive")
      .set("Authorization", `Bearer ${jeton}`)
      .expect(200);
    assert.equal(profil.body.utilisateur.pseudo, "protege1");

    await request(application).post("/api/deconnexion").expect(401);
    await request(application)
      .post("/api/deconnexion")
      .set("Authorization", `Bearer ${jeton}`)
      .expect(204);
    await request(application)
      .get("/api/prive")
      .set("Authorization", `Bearer ${jeton}`)
      .expect(401);
  });

  it("refuse une session expirée", async () => {
    const { application, depot } = creerApplicationTest();
    await creerCompte(depot, "expire@example.com", "expire1");
    const jeton = await connecter(application, "expire@example.com");
    for (const session of depot.sessions.values()) {
      session.expireLe = new Date(0);
    }

    await request(application)
      .get("/api/prive")
      .set("Authorization", `Bearer ${jeton}`)
      .expect(401);
    await request(application)
      .post("/api/renouvellement-session")
      .set("Authorization", `Bearer ${jeton}`)
      .expect(401);
  });

  it("refuse une session si le compte devient inactif", async () => {
    const { application, depot } = creerApplicationTest();
    await creerCompte(depot, "desactive@example.com", "desactive1");
    const jeton = await connecter(application, "desactive@example.com");
    const compte = [...depot.comptes.values()][0];
    compte.etat = "inactif";

    await request(application)
      .get("/api/prive")
      .set("Authorization", `Bearer ${jeton}`)
      .expect(401);
  });

  it("renouvelle une session valide en révoquant l'ancienne", async () => {
    const { application, depot } = creerApplicationTest();
    await creerCompte(depot, "renouveler@example.com", "renouveler1");
    const jeton = await connecter(application, "renouveler@example.com");

    const renouvellement = await request(application)
      .post("/api/renouvellement-session")
      .set("Authorization", `Bearer ${jeton}`)
      .expect(200);
    assert.ok(renouvellement.body.jeton);
    assert.notEqual(renouvellement.body.jeton, jeton);
    assert.ok(Date.parse(renouvellement.body.expireLe) > Date.now());

    await request(application)
      .get("/api/prive")
      .set("Authorization", `Bearer ${jeton}`)
      .expect(401);
    await request(application)
      .get("/api/prive")
      .set("Authorization", `Bearer ${renouvellement.body.jeton}`)
      .expect(200);
    await request(application)
      .post("/api/renouvellement-session")
      .set("Authorization", `Bearer ${jeton}`)
      .expect(401);

    const second = await request(application)
      .post("/api/renouvellement-session")
      .set("Authorization", `Bearer ${renouvellement.body.jeton}`)
      .expect(200);
    assert.notEqual(second.body.jeton, renouvellement.body.jeton);
    await request(application)
      .get("/api/prive")
      .set("Authorization", `Bearer ${renouvellement.body.jeton}`)
      .expect(401);
    await request(application)
      .get("/api/prive")
      .set("Authorization", `Bearer ${second.body.jeton}`)
      .expect(200);
  });

  it("refuse des identifiants manquants ou invalides", async () => {
    const { application } = creerApplicationTest();

    const corpsVide = await request(application).post("/api/connexion").send({});
    assert.equal(corpsVide.status, 422);
    assert.equal(corpsVide.body.erreur.code, "DONNEES_INVALIDES");

    const sansMotDePasse = await request(application)
      .post("/api/connexion")
      .send({ identifiant: "x@example.com" });
    assert.equal(sansMotDePasse.status, 422);

    const identifiantVide = await request(application)
      .post("/api/connexion")
      .send({ identifiant: "   ", motDePasse: MOT_DE_PASSE });
    assert.equal(identifiantVide.status, 422);

    const motDePasseVide = await request(application)
      .post("/api/connexion")
      .send({ identifiant: "x@example.com", motDePasse: "" });
    assert.equal(motDePasseVide.status, 422);

    const identifiantTropLong = await request(application)
      .post("/api/connexion")
      .send({ identifiant: "a".repeat(255), motDePasse: MOT_DE_PASSE });
    assert.equal(identifiantTropLong.status, 422);
  });

  it("accepte les alias de champs du frontend", async () => {
    const { application, depot } = creerApplicationTest();
    await creerCompte(depot, "alias@example.com", "alias1");

    const parEmail = await request(application)
      .post("/api/connexion")
      .send({ email: "alias@example.com", password: MOT_DE_PASSE });
    assert.equal(parEmail.status, 200);

    const parPseudo = await request(application)
      .post("/api/connexion")
      .send({ pseudo: "alias1", password: MOT_DE_PASSE });
    assert.equal(parPseudo.status, 200);

    const parIdentifier = await request(application)
      .post("/api/connexion")
      .send({ identifier: "alias@example.com", password: MOT_DE_PASSE });
    assert.equal(parIdentifier.status, 200);
  });
});
