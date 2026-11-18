import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";
import { creerApplicationTest } from "./aides/applicationTest";

const MOT_DE_PASSE = "MotDePasse#2026";

describe("KBE-22 inscription", () => {
  it("crée un compte voyageur sans retourner de secret", async () => {
    const { application } = creerApplicationTest();
    const reponse = await request(application).post("/api/inscription").send({
      pseudo: "voyageur1",
      email: "Voyageur1@Example.com",
      motDePasse: MOT_DE_PASSE,
      accepteConditions: true,
      zoneLibre: "Port-Louis",
      telephone: "+230 5555 1234",
      role: "administrateur"
    });

    assert.equal(reponse.status, 201);
    assert.equal(reponse.body.utilisateur.pseudo, "voyageur1");
    assert.equal(reponse.body.utilisateur.email, "voyageur1@example.com");
    assert.equal(reponse.body.utilisateur.role, "voyageur");
    assert.equal(reponse.body.utilisateur.zoneLibre, "Port-Louis");
    assert.equal(reponse.body.utilisateur.telephone, "+230 5555 1234");
    assert.ok(reponse.body.utilisateur.compteId);
    assert.ok(reponse.body.utilisateur.identifiantPublic);

    const corps = JSON.stringify(reponse.body).toLowerCase();
    assert.equal(corps.includes("motdepasse"), false);
    assert.equal(corps.includes("hash"), false);
    assert.equal(corps.includes("administrateur"), false);
  });

  it("refuse un e-mail déjà utilisé, sans tenir compte de la casse", async () => {
    const { application } = creerApplicationTest();
    const donnees = {
      pseudo: "voyageur2",
      email: "voyageur2@example.com",
      motDePasse: MOT_DE_PASSE,
      accepteConditions: true
    };
    await request(application).post("/api/inscription").send(donnees).expect(201);

    const reponse = await request(application)
      .post("/api/inscription")
      .send({ ...donnees, email: "Voyageur2@Example.com", pseudo: "voyageur3" });

    assert.equal(reponse.status, 409);
    assert.equal(reponse.body.erreur.code, "EMAIL_DEJA_UTILISE");
  });

  it("refuse un pseudonyme déjà utilisé, sans tenir compte de la casse", async () => {
    const { application } = creerApplicationTest();
    await request(application)
      .post("/api/inscription")
      .send({
        pseudo: "voyageur4",
        email: "voyageur4@example.com",
        motDePasse: MOT_DE_PASSE,
        accepteConditions: true
      })
      .expect(201);

    const reponse = await request(application).post("/api/inscription").send({
      pseudo: "Voyageur4",
      email: "voyageur5@example.com",
      motDePasse: MOT_DE_PASSE,
      accepteConditions: true
    });

    assert.equal(reponse.status, 409);
    assert.equal(reponse.body.erreur.code, "PSEUDO_DEJA_UTILISE");
  });

  it("accepte les noms de champs du frontend et les champs optionnels absents", async () => {
    const { application } = creerApplicationTest();
    const reponse = await request(application).post("/api/inscription").send({
      pseudo: "frontend1",
      email: "frontend1@example.com",
      password: "motdepasse1",
      conditionsAcceptees: true,
      city: "Curepipe",
      phone: "+230 5555 1234"
    });

    assert.equal(reponse.status, 201);
    assert.equal(reponse.body.utilisateur.zoneLibre, "Curepipe");
    assert.equal(reponse.body.utilisateur.telephone, "+230 5555 1234");

    const sansOptionnels = await request(application).post("/api/inscription").send({
      pseudo: "frontend2",
      email: "frontend2@example.com",
      motDePasse: "motdepasse2",
      accepteConditions: true
    });
    assert.equal(sansOptionnels.status, 201);
    assert.equal(sansOptionnels.body.utilisateur.zoneLibre, null);
    assert.equal(sansOptionnels.body.utilisateur.telephone, null);
  });

  it("applique la politique de validation du frontend", async () => {
    const { application } = creerApplicationTest();

    const pseudoTropLong = await request(application).post("/api/inscription").send({
      pseudo: "p".repeat(21),
      email: "long@example.com",
      motDePasse: MOT_DE_PASSE,
      accepteConditions: true
    });
    assert.equal(pseudoTropLong.status, 422);

    const pseudoInvalide = await request(application).post("/api/inscription").send({
      pseudo: "pseudo invalide",
      email: "pseudo@example.com",
      motDePasse: MOT_DE_PASSE,
      accepteConditions: true
    });
    assert.equal(pseudoInvalide.status, 422);

    const sansChiffre = await request(application).post("/api/inscription").send({
      pseudo: "sanschiffre1",
      email: "sanschiffre@example.com",
      motDePasse: "abcdefgh",
      accepteConditions: true
    });
    assert.equal(sansChiffre.status, 422);

    const emailInvalide = await request(application).post("/api/inscription").send({
      pseudo: "email1",
      email: "email-invalide",
      motDePasse: MOT_DE_PASSE,
      accepteConditions: true
    });
    assert.equal(emailInvalide.status, 422);

    const telephoneInvalide = await request(application).post("/api/inscription").send({
      pseudo: "telephone1",
      email: "telephone1@example.com",
      motDePasse: MOT_DE_PASSE,
      accepteConditions: true,
      telephone: "abc"
    });
    assert.equal(telephoneInvalide.status, 422);

    const valide = await request(application).post("/api/inscription").send({
      pseudo: "valide1",
      email: "valide1@example.com",
      motDePasse: "motdepasse1",
      accepteConditions: true
    });
    assert.equal(valide.status, 201);
  });

  it("refuse un mot de passe faible et l'absence d'acceptation des conditions", async () => {
    const { application } = creerApplicationTest();
    const motDePasseFaible = await request(application).post("/api/inscription").send({
      pseudo: "voyageur6",
      email: "voyageur6@example.com",
      motDePasse: "faible",
      accepteConditions: true
    });
    assert.equal(motDePasseFaible.status, 422);

    const conditionsAbsentes = await request(application).post("/api/inscription").send({
      pseudo: "voyageur7",
      email: "voyageur7@example.com",
      motDePasse: MOT_DE_PASSE
    });
    assert.equal(conditionsAbsentes.status, 422);
    assert.equal(conditionsAbsentes.body.erreur.code, "DONNEES_INVALIDES");

    const conditionsFausses = await request(application).post("/api/inscription").send({
      pseudo: "voyageur8",
      email: "voyageur8@example.com",
      motDePasse: MOT_DE_PASSE,
      accepteConditions: false
    });
    assert.equal(conditionsFausses.status, 422);
  });
});
