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

function creerApplication() {
  const depot = new DepotAuthentificationPostgres(obtenirPool);
  const service = new ServiceAuthentification(depot, {
    envoyerCodeReinitialisation: async () => undefined
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
  describe("KBE-25 profil avec PostgreSQL", () => {
    const suffixe = Date.now();
    const emailA = `profil-a-${suffixe}@example.com`;
    const emailB = `profil-b-${suffixe}@example.com`;
    const pseudoA = `p${String(suffixe).slice(-12)}`;
    const pseudoB = `q${String(suffixe).slice(-12)}`;
    const emails = [emailA, emailB];

    after(async () => {
      await obtenirPool().query(
        `DELETE FROM sessions
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

    it("lit et modifie uniquement le profil de la session", async () => {
      const application = creerApplication();

      const inscriptionA = await request(application).post("/api/inscription").send({
        pseudo: pseudoA,
        email: emailA,
        motDePasse: MOT_DE_PASSE,
        accepteConditions: true
      });
      assert.equal(inscriptionA.status, 201);
      const compteA = inscriptionA.body.utilisateur.compteId as string;

      const inscriptionB = await request(application).post("/api/inscription").send({
        pseudo: pseudoB,
        email: emailB,
        motDePasse: MOT_DE_PASSE,
        accepteConditions: true
      });
      assert.equal(inscriptionB.status, 201);
      const compteB = inscriptionB.body.utilisateur.compteId as string;

      const connexionA = await request(application)
        .post("/api/connexion")
        .send({ identifiant: emailA, motDePasse: MOT_DE_PASSE });
      assert.equal(connexionA.status, 200);
      const jetonA = connexionA.body.jeton;

      const profilInitial = await request(application)
        .get("/api/utilisateurs/moi")
        .set("Authorization", `Bearer ${jetonA}`);
      assert.equal(profilInitial.status, 200);
      assert.equal(profilInitial.body.utilisateur.compteId, compteA);
      assert.equal(profilInitial.body.utilisateur.pseudo, pseudoA);
      assert.equal(profilInitial.body.utilisateur.email, emailA);
      const corps = JSON.stringify(profilInitial.body).toLowerCase();
      assert.equal(corps.includes("motdepasse"), false);
      assert.equal(corps.includes("hash"), false);
      assert.equal(corps.includes("empreinte"), false);

      const modification = await request(application)
        .patch("/api/utilisateurs/moi")
        .set("Authorization", `Bearer ${jetonA}`)
        .send({
          pseudo: `${pseudoA}x`,
          zoneLibre: "Curepipe",
          telephone: "+230 5555 1234",
          avatarRef: "avatar-01",
          compteId: compteB,
          email: emailB,
          role: "administrateur"
        });
      assert.equal(modification.status, 200);
      assert.equal(modification.body.utilisateur.compteId, compteA);
      assert.equal(modification.body.utilisateur.pseudo, `${pseudoA}x`);
      assert.equal(modification.body.utilisateur.email, emailA);
      assert.equal(modification.body.utilisateur.role, "voyageur");
      assert.equal(modification.body.utilisateur.zoneLibre, "Curepipe");
      assert.equal(modification.body.utilisateur.telephone, "+230 5555 1234");
      assert.equal(modification.body.utilisateur.avatarRef, "avatar-01");

      const lignes = await obtenirPool().query<{
        email: string;
        role: string;
        pseudo: string;
        zone_libre: string | null;
        telephone: string | null;
        avatar_ref: string | null;
      }>(
        `SELECT c.email, r.code AS role, v.pseudo, v.zone_libre,
                to_jsonb(v) ->> 'telephone' AS telephone, v.avatar_ref
         FROM comptes c
         JOIN roles r ON r.id = c.role_id
         JOIN voyageurs v ON v.compte_id = c.id
         WHERE c.email = ANY($1::text[])
         ORDER BY c.email`,
        [emails]
      );
      assert.equal(lignes.rows.length, 2);
      const ligneA = lignes.rows.find((ligne) => ligne.email === emailA);
      const ligneB = lignes.rows.find((ligne) => ligne.email === emailB);
      assert.ok(ligneA);
      assert.ok(ligneB);
      assert.equal(ligneA.pseudo, `${pseudoA}x`);
      assert.equal(ligneA.zone_libre, "Curepipe");
      assert.equal(ligneA.telephone, "+230 5555 1234");
      assert.equal(ligneA.avatar_ref, "avatar-01");
      assert.equal(ligneB.pseudo, pseudoB);
      assert.equal(ligneB.zone_libre, null);
      assert.equal(ligneB.telephone, null);
      assert.equal(ligneB.avatar_ref, null);

      const pseudoDejaPris = await request(application)
        .patch("/api/utilisateurs/moi")
        .set("Authorization", `Bearer ${jetonA}`)
        .send({ pseudo: pseudoB.toUpperCase() });
      assert.equal(pseudoDejaPris.status, 409);
      assert.equal(pseudoDejaPris.body.erreur.code, "PSEUDO_DEJA_UTILISE");

      const avatarRetire = await request(application)
        .patch("/api/utilisateurs/moi/avatar")
        .set("Authorization", `Bearer ${jetonA}`)
        .send({ avatarRef: null });
      assert.equal(avatarRetire.status, 200);
      assert.equal(avatarRetire.body.utilisateur.avatarRef, null);

      const connexionB = await request(application)
        .post("/api/connexion")
        .send({ identifiant: emailB, motDePasse: MOT_DE_PASSE });
      assert.equal(connexionB.status, 200);
      const profilB = await request(application)
        .get("/api/utilisateurs/moi")
        .set("Authorization", `Bearer ${connexionB.body.jeton}`);
      assert.equal(profilB.status, 200);
      assert.equal(profilB.body.utilisateur.compteId, compteB);
      assert.equal(profilB.body.utilisateur.pseudo, pseudoB);
      assert.equal(profilB.body.utilisateur.email, emailB);
    });
  });
}
