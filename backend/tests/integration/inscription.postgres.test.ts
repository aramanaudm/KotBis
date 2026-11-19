import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import express from "express";
import request from "supertest";
import { DepotAuthentificationPostgres } from "../../src/authentification/depot";
import { creerRouteurAuthentification } from "../../src/authentification/routes";
import { ServiceAuthentification } from "../../src/authentification/service";
import { verifierMotDePasse } from "../../src/authentification/motDePasse";
import { creerMiddlewareSession } from "../../src/middlewares/authentification";
import { gestionnaireErreurs, routeInconnue } from "../../src/middlewares/gestionErreurs";
import { fermerConnexionBdd, obtenirPool } from "../../src/configuration/baseDeDonnees";

const MOT_DE_PASSE = "MotDePasse#2026";

function creerApplication() {
  const depot = new DepotAuthentificationPostgres(obtenirPool);
  const service = new ServiceAuthentification(depot);
  const middlewareSession = creerMiddlewareSession(service);
  const application = express();
  application.use(express.json());
  application.use("/api", creerRouteurAuthentification(service, middlewareSession));
  application.use(routeInconnue);
  application.use(gestionnaireErreurs);
  return application;
}

if (process.env.KOTBIS_TEST_DB === "1") {
  describe("KBE-22 inscription avec PostgreSQL", () => {
    const suffixe = Date.now();
    const email = `inscription-${suffixe}@example.com`;
    const pseudo = `i${String(suffixe).slice(-12)}`;
    const autreEmail = `autre-${suffixe}@example.com`;

    after(async () => {
      await obtenirPool().query(
        "DELETE FROM voyageurs WHERE compte_id IN (SELECT id FROM comptes WHERE email = $1)",
        [email]
      );
      await obtenirPool().query("DELETE FROM comptes WHERE email = $1", [email]);
      await fermerConnexionBdd();
    });

    it("inscrit un voyageur et refuse les doublons", async () => {
      const application = creerApplication();
      const inscription = await request(application).post("/api/inscription").send({
        pseudo,
        email: email.toUpperCase(),
        motDePasse: MOT_DE_PASSE,
        accepteConditions: true,
        zoneLibre: "Port-Louis",
        telephone: "+230 5555 1234",
        role: "administrateur"
      });

      assert.equal(inscription.status, 201);
      assert.equal(inscription.body.utilisateur.email, email);
      assert.equal(inscription.body.utilisateur.role, "voyageur");
      assert.equal(inscription.body.utilisateur.zoneLibre, "Port-Louis");
      assert.equal(inscription.body.utilisateur.telephone, "+230 5555 1234");
      assert.equal(JSON.stringify(inscription.body).toLowerCase().includes("motdepasse"), false);
      assert.equal(JSON.stringify(inscription.body).toLowerCase().includes("hash"), false);

      const lignes = await obtenirPool().query<{
        mot_de_passe_hash: string;
        telephone: string | null;
        role: string;
      }>(
        `SELECT c.mot_de_passe_hash, v.telephone, r.code AS role
         FROM comptes c
         JOIN voyageurs v ON v.compte_id = c.id
         JOIN roles r ON r.id = c.role_id
         WHERE c.email = $1`,
        [email]
      );
      assert.equal(lignes.rows.length, 1);
      assert.equal(lignes.rows[0].role, "voyageur");
      assert.equal(lignes.rows[0].telephone, "+230 5555 1234");
      assert.match(lignes.rows[0].mot_de_passe_hash, /^\$argon2id\$/);
      assert.notEqual(lignes.rows[0].mot_de_passe_hash, MOT_DE_PASSE);
      assert.equal(await verifierMotDePasse(lignes.rows[0].mot_de_passe_hash, MOT_DE_PASSE), true);

      const emailDuplique = await request(application).post("/api/inscription").send({
        pseudo: `${pseudo}b`,
        email,
        motDePasse: MOT_DE_PASSE,
        accepteConditions: true
      });
      assert.equal(emailDuplique.status, 409);
      assert.equal(emailDuplique.body.erreur.code, "EMAIL_DEJA_UTILISE");

      const pseudoDuplique = await request(application).post("/api/inscription").send({
        pseudo: pseudo.toUpperCase(),
        email: autreEmail,
        motDePasse: MOT_DE_PASSE,
        accepteConditions: true
      });
      assert.equal(pseudoDuplique.status, 409);
      assert.equal(pseudoDuplique.body.erreur.code, "PSEUDO_DEJA_UTILISE");
    });
  });
}
