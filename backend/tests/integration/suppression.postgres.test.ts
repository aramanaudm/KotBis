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
  describe("KBE-26 demande de suppression avec PostgreSQL", () => {
    const suffixe = Date.now();
    const emailA = `suppression-a-${suffixe}@example.com`;
    const emailB = `suppression-b-${suffixe}@example.com`;
    const pseudoA = `s${String(suffixe).slice(-12)}`;
    const pseudoB = `t${String(suffixe).slice(-12)}`;
    const emails = [emailA, emailB];

    after(async () => {
      await obtenirPool().query(
        `DELETE FROM demandes_suppression
         WHERE compte_id IN (SELECT id FROM comptes WHERE email = ANY($1::text[]))`,
        [emails]
      );
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

    it("enregistre une demande sans supprimer les données liées", async () => {
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

      await request(application)
        .delete("/api/utilisateurs/moi")
        .send({ motDePasse: MOT_DE_PASSE })
        .expect(401);

      const sansMotDePasse = await request(application)
        .delete("/api/utilisateurs/moi")
        .set("Authorization", `Bearer ${jetonA}`)
        .send({});
      assert.equal(sansMotDePasse.status, 422);
      assert.equal(sansMotDePasse.body.erreur.code, "DONNEES_INVALIDES");

      const mauvaisMotDePasse = await request(application)
        .delete("/api/utilisateurs/moi")
        .set("Authorization", `Bearer ${jetonA}`)
        .send({ motDePasse: "MauvaisMotDePasse#2026" });
      assert.equal(mauvaisMotDePasse.status, 401);
      assert.equal(mauvaisMotDePasse.body.erreur.code, "MOT_DE_PASSE_INCORRECT");

      const demandesAvant = await obtenirPool().query<{ total: string }>(
        "SELECT count(*)::text AS total FROM demandes_suppression WHERE compte_id = $1",
        [compteA]
      );
      assert.equal(demandesAvant.rows[0].total, "0");

      const demande = await request(application)
        .delete("/api/utilisateurs/moi")
        .set("Authorization", `Bearer ${jetonA}`)
        .send({
          motDePasse: MOT_DE_PASSE,
          motif: "Je souhaite préparer la suppression.",
          compteId: compteB,
          email: emailB
        });
      assert.equal(demande.status, 202);
      assert.deepEqual(demande.body, { demande: { statut: "en_attente" } });
      assert.equal(demande.headers["cache-control"], "no-store");
      const corps = JSON.stringify(demande.body).toLowerCase();
      assert.equal(corps.includes("motdepasse"), false);
      assert.equal(corps.includes("hash"), false);

      const demandesA = await obtenirPool().query<{
        compte_id: string;
        motif: string | null;
        statut: string;
      }>(
        `SELECT compte_id::text, motif, statut
         FROM demandes_suppression
         WHERE compte_id = $1`,
        [compteA]
      );
      assert.equal(demandesA.rows.length, 1);
      assert.equal(demandesA.rows[0].compte_id, compteA);
      assert.equal(demandesA.rows[0].motif, "Je souhaite préparer la suppression.");
      assert.equal(demandesA.rows[0].statut, "en_attente");

      const demandesB = await obtenirPool().query<{ total: string }>(
        "SELECT count(*)::text AS total FROM demandes_suppression WHERE compte_id = $1",
        [compteB]
      );
      assert.equal(demandesB.rows[0].total, "0");

      const donneesLiees = await obtenirPool().query<{
        comptes: string;
        voyageurs: string;
        sessions: string;
      }>(
        `SELECT
          (SELECT count(*)::text FROM comptes WHERE id = $1) AS comptes,
          (SELECT count(*)::text FROM voyageurs WHERE compte_id = $1) AS voyageurs,
          (SELECT count(*)::text FROM sessions WHERE compte_id = $1) AS sessions`,
        [compteA]
      );
      assert.deepEqual(donneesLiees.rows[0], {
        comptes: "1",
        voyageurs: "1",
        sessions: "1"
      });

      await request(application)
        .get("/api/utilisateurs/moi")
        .set("Authorization", `Bearer ${jetonA}`)
        .expect(200);

      const doublon = await request(application)
        .delete("/api/utilisateurs/moi")
        .set("Authorization", `Bearer ${jetonA}`)
        .send({ motDePasse: MOT_DE_PASSE, motif: "Deuxième demande." });
      assert.equal(doublon.status, 202);
      const demandesApresDoublon = await obtenirPool().query<{ total: string }>(
        "SELECT count(*)::text AS total FROM demandes_suppression WHERE compte_id = $1",
        [compteA]
      );
      assert.equal(demandesApresDoublon.rows[0].total, "1");

      const connexionB = await request(application)
        .post("/api/connexion")
        .send({ identifiant: emailB, motDePasse: MOT_DE_PASSE });
      assert.equal(connexionB.status, 200);
      const demandeB = await request(application)
        .delete("/api/utilisateurs/moi")
        .set("Authorization", `Bearer ${connexionB.body.jeton}`)
        .send({ motDePasse: MOT_DE_PASSE, reason: "Demande B." });
      assert.equal(demandeB.status, 202);

      const demandesFinales = await obtenirPool().query<{ total: string }>(
        "SELECT count(*)::text AS total FROM demandes_suppression WHERE compte_id = ANY($1::bigint[])",
        [[compteA, compteB]]
      );
      assert.equal(demandesFinales.rows[0].total, "2");
    });
  });
}
