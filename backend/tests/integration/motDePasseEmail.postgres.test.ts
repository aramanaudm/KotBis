import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import express from "express";
import request from "supertest";
import { DepotAuthentificationPostgres } from "../../src/authentification/depot";
import { creerRouteurAuthentification } from "../../src/authentification/routes";
import { ServiceAuthentification } from "../../src/authentification/service";
import {
  creerMiddlewareSession,
  obtenirUtilisateurCourant
} from "../../src/middlewares/authentification";
import { gestionnaireErreurs, routeInconnue } from "../../src/middlewares/gestionErreurs";
import { creerRouteurUtilisateurs } from "../../src/utilisateurs/routes";
import { fermerConnexionBdd, obtenirPool } from "../../src/configuration/baseDeDonnees";

const MOT_DE_PASSE = "MotDePasse#2026";
const NOUVEAU_MOT_DE_PASSE = "NouveauMotDePasse#2026";
const DERNIER_MOT_DE_PASSE = "DernierMotDePasse#2026";

function creerApplication(codeEnvoye: { valeur?: string }) {
  const depot = new DepotAuthentificationPostgres(obtenirPool);
  const service = new ServiceAuthentification(depot, {
    envoyerCodeReinitialisation: async (_email, code) => {
      codeEnvoye.valeur = code;
    }
  });
  const middlewareSession = creerMiddlewareSession(service);
  const application = express();
  application.use(express.json());
  application.use("/api", creerRouteurAuthentification(service, middlewareSession));
  application.use("/api/utilisateurs", creerRouteurUtilisateurs(service, middlewareSession));
  application.get("/api/prive", middlewareSession, (requete, reponse) => {
    reponse.json({ utilisateur: obtenirUtilisateurCourant(requete) });
  });
  application.use(routeInconnue);
  application.use(gestionnaireErreurs);
  return application;
}

if (process.env.KOTBIS_TEST_DB === "1") {
  describe("KBE-24 mot de passe et e-mail avec PostgreSQL", () => {
    const suffixe = Date.now();
    const email = `reset-${suffixe}@example.com`;
    const nouvelleEmail = `reset-nouveau-${suffixe}@example.com`;
    const autreEmail = `reset-autre-${suffixe}@example.com`;
    const pseudo = `r${String(suffixe).slice(-12)}`;
    const autrePseudo = `a${String(suffixe).slice(-12)}`;
    const emails = [email, nouvelleEmail, autreEmail];

    after(async () => {
      await obtenirPool().query(
        `DELETE FROM sessions
         WHERE compte_id IN (SELECT id FROM comptes WHERE email = ANY($1::text[]))`,
        [emails]
      );
      await obtenirPool().query(
        `DELETE FROM codes_reinitialisation
         WHERE compte_id IN (SELECT id FROM comptes WHERE email = ANY($1::text[]))`,
        [emails]
      );
      await obtenirPool().query(
        `DELETE FROM voyageurs
         WHERE compte_id IN (SELECT id FROM comptes WHERE email = ANY($1::text[]))`,
        [emails]
      );
      await obtenirPool().query("DELETE FROM comptes WHERE email = ANY($1::text[])", [emails]);
      await fermerConnexionBdd();
    });

    it("réinitialise puis modifie l'e-mail et le mot de passe", async () => {
      const codeEnvoye: { valeur?: string } = {};
      const application = creerApplication(codeEnvoye);

      const inscription = await request(application).post("/api/inscription").send({
        pseudo,
        email,
        motDePasse: MOT_DE_PASSE,
        accepteConditions: true
      });
      assert.equal(inscription.status, 201);

      const connexionInitiale = await request(application)
        .post("/api/connexion")
        .send({ identifiant: email, motDePasse: MOT_DE_PASSE });
      assert.equal(connexionInitiale.status, 200);
      const jetonInitial = connexionInitiale.body.jeton;

      const demande = await request(application)
        .post("/api/mot-de-passe/oublie")
        .send({ email });
      assert.equal(demande.status, 202);
      assert.match(codeEnvoye.valeur ?? "", /^\d{6}$/);

      await request(application)
        .post("/api/mot-de-passe/reinitialisation")
        .send({
          email,
          code: codeEnvoye.valeur,
          nouveauMotDePasse: NOUVEAU_MOT_DE_PASSE
        })
        .expect(204);

      const codes = await obtenirPool().query<{
        empreinte_code: string;
        utilise_le: Date | null;
      }>(
        `SELECT empreinte_code, utilise_le
         FROM codes_reinitialisation
         WHERE compte_id = (SELECT id FROM comptes WHERE email = $1)
         ORDER BY cree_le DESC
         LIMIT 1`,
        [email]
      );
      assert.equal(codes.rows.length, 1);
      assert.match(codes.rows[0].empreinte_code, /^[a-f0-9]{64}$/);
      assert.notEqual(codes.rows[0].empreinte_code, codeEnvoye.valeur);
      assert.ok(codes.rows[0].utilise_le);

      await request(application)
        .get("/api/prive")
        .set("Authorization", `Bearer ${jetonInitial}`)
        .expect(401);
      await request(application)
        .post("/api/connexion")
        .send({ identifiant: email, motDePasse: MOT_DE_PASSE })
        .expect(401);
      const connexionNouvelle = await request(application)
        .post("/api/connexion")
        .send({ identifiant: email, motDePasse: NOUVEAU_MOT_DE_PASSE });
      assert.equal(connexionNouvelle.status, 200);
      const jetonCourant = connexionNouvelle.body.jeton;

      const reutilisation = await request(application)
        .post("/api/mot-de-passe/reinitialisation")
        .send({
          email,
          code: codeEnvoye.valeur,
          nouveauMotDePasse: DERNIER_MOT_DE_PASSE
        });
      assert.equal(reutilisation.status, 422);

      const changementEmail = await request(application)
        .patch("/api/utilisateurs/moi/email")
        .set("Authorization", `Bearer ${jetonCourant}`)
        .send({ email: nouvelleEmail, motDePasse: NOUVEAU_MOT_DE_PASSE });
      assert.equal(changementEmail.status, 200);
      assert.equal(changementEmail.body.utilisateur.email, nouvelleEmail);

      const compte = await obtenirPool().query<{ email: string }>(
        "SELECT email FROM comptes WHERE email = $1",
        [nouvelleEmail]
      );
      assert.equal(compte.rows.length, 1);

      await request(application).post("/api/inscription").send({
        pseudo: autrePseudo,
        email: autreEmail,
        motDePasse: MOT_DE_PASSE,
        accepteConditions: true
      }).expect(201);

      const emailDejaPris = await request(application)
        .patch("/api/utilisateurs/moi/email")
        .set("Authorization", `Bearer ${jetonCourant}`)
        .send({ email: autreEmail, motDePasse: NOUVEAU_MOT_DE_PASSE });
      assert.equal(emailDejaPris.status, 409);
      assert.equal(emailDejaPris.body.erreur.code, "EMAIL_DEJA_UTILISE");

      const autreConnexion = await request(application)
        .post("/api/connexion")
        .send({ identifiant: nouvelleEmail, motDePasse: NOUVEAU_MOT_DE_PASSE });
      assert.equal(autreConnexion.status, 200);
      const jetonAutre = autreConnexion.body.jeton;

      await request(application)
        .patch("/api/utilisateurs/moi/mot-de-passe")
        .set("Authorization", `Bearer ${jetonCourant}`)
        .send({
          motDePasseActuel: NOUVEAU_MOT_DE_PASSE,
          nouveauMotDePasse: DERNIER_MOT_DE_PASSE
        })
        .expect(204);

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
        .send({ identifiant: nouvelleEmail, motDePasse: NOUVEAU_MOT_DE_PASSE })
        .expect(401);
      await request(application)
        .post("/api/connexion")
        .send({ identifiant: nouvelleEmail, motDePasse: DERNIER_MOT_DE_PASSE })
        .expect(200);
    });
  });
}
