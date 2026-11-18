// KBE-45 : tests HTTP du quota visiteur (EF-VIS-001 à EF-VIS-008).
// Serveur Express temporaire, stockage en mémoire et fausse route de recherche :
// ni PostgreSQL ni le serveur principal ne sont nécessaires.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import express from "express";
import request from "supertest";
import type { ServiceAuthentification } from "../src/authentification/service";
import { ErreurValidation } from "../src/commun/erreurs";
import { gestionnaireErreurs, routeInconnue } from "../src/middlewares/gestionErreurs";
import {
  creerMiddlewareQuotaVisiteur,
  ENTETE_JETON_VISITEUR,
  ENTETE_QUOTA_RESTANT
} from "../src/middlewares/quotaVisiteur";
import { creerMiddlewareSessionFacultative } from "../src/middlewares/sessionFacultative";
import { ServiceQuotaVisiteur } from "../src/trajets/quota-visiteur.service";
import { DepotQuotaMemoire } from "./aides/depotQuotaMemoire";

const JETON_SESSION_VALIDE = "jeton-session-valide";

// Faux service de session : seul JETON_SESSION_VALIDE correspond à un compte connecté.
const fausseSession: Pick<ServiceAuthentification, "verifierSession"> = {
  async verifierSession(jeton) {
    if (jeton !== JETON_SESSION_VALIDE) return null;
    return {
      empreinteJeton: "empreinte",
      utilisateur: {
        compteId: "1",
        identifiantPublic: "public-1",
        email: "voyageur@example.com",
        role: "voyageur",
        pseudo: "Voyageur",
        avatarRef: null,
        zoneLibre: null,
        telephone: null,
        creeLe: "2026-11-19T08:00:00.000Z"
      }
    };
  }
};

function creerApplication(options: { plafondJetonsParIp?: number } = {}) {
  const depot = new DepotQuotaMemoire();
  const quota = new ServiceQuotaVisiteur(depot, { secretEmpreinteIp: "secret-de-test", ...options });
  const application = express();

  // Fausse recherche : ?cas=succes | vide | invalide | panne | lent
  application.get(
    "/api/trajets/recherche",
    creerMiddlewareSessionFacultative(fausseSession),
    creerMiddlewareQuotaVisiteur(quota),
    async (requete, reponse) => {
      const cas = requete.query.cas ?? "succes";
      if (cas === "invalide") throw new ErreurValidation("Le départ est obligatoire.");
      if (cas === "panne") throw new Error("Panne simulée du calcul d'itinéraire");
      if (cas === "lent") await new Promise((resoudre) => setTimeout(resoudre, 30));
      reponse.json({ resultats: cas === "vide" ? [] : [{ ligne: "1A" }] });
    }
  );
  // Route publique non soumise au quota (EF-VIS-007).
  application.get("/api/arrets", (_requete, reponse) => {
    reponse.json({ arrets: [] });
  });
  application.use(routeInconnue);
  application.use(gestionnaireErreurs);

  return { application, depot };
}

// Laisse le temps à la restitution asynchrone d'une recherche non aboutie.
const attendre = () => new Promise((resoudre) => setImmediate(resoudre));

async function rechercher(application: express.Express, jeton?: string, cas = "succes") {
  const requete = request(application).get("/api/trajets/recherche").query({ cas });
  if (jeton) requete.set(ENTETE_JETON_VISITEUR, jeton);
  const reponse = await requete;
  await attendre();
  return reponse;
}

// Consomme `nombre` recherches réussies et retourne le jeton du visiteur.
async function consommer(application: express.Express, nombre: number): Promise<string> {
  const premiere = await rechercher(application);
  const jeton = premiere.headers[ENTETE_JETON_VISITEUR.toLowerCase()];
  for (let i = 1; i < nombre; i += 1) {
    await rechercher(application, jeton);
  }
  return jeton;
}

describe("KBE-45 quota visiteur sur la recherche de trajet", () => {
  it("émet un jeton visiteur et indique les recherches restantes", async () => {
    const { application } = creerApplication();
    const reponse = await rechercher(application);
    assert.equal(reponse.status, 200);
    assert.match(reponse.headers["x-visiteur"], /^[0-9a-f-]{36}$/);
    assert.equal(reponse.headers["x-quota-restant"], "9");
  });

  it("AC-14 : accepte 10 recherches puis refuse la onzième avec 429 QUOTA_VISITEUR_ATTEINT", async () => {
    const { application } = creerApplication();
    const jeton = await consommer(application, 10);
    const onzieme = await rechercher(application, jeton);
    assert.equal(onzieme.status, 429);
    assert.equal(onzieme.body.erreur.code, "QUOTA_VISITEUR_ATTEINT");
    assert.match(onzieme.body.erreur.message, /Connectez-vous/);
  });

  it("compte une recherche réussie sans résultat", async () => {
    const { application, depot } = creerApplication();
    const reponse = await rechercher(application, undefined, "vide");
    assert.equal(reponse.status, 200);
    assert.deepEqual(reponse.body.resultats, []);
    assert.equal(depot.compteur(reponse.headers["x-visiteur"]), 1);
  });

  it("AC-15 / EF-VIS-004 / EF-VIS-005 : saisie invalide et panne ne consomment pas le quota", async () => {
    const { application, depot } = creerApplication();
    const jeton = await consommer(application, 9);

    const invalide = await rechercher(application, jeton, "invalide");
    assert.equal(invalide.status, 422);
    const panne = await rechercher(application, jeton, "panne");
    assert.equal(panne.status, 500);
    assert.equal(depot.compteur(jeton), 9);

    const dixieme = await rechercher(application, jeton);
    assert.equal(dixieme.status, 200);
    assert.equal(dixieme.headers["x-quota-restant"], "0");
    assert.equal((await rechercher(application, jeton)).status, 429);
  });

  it("EF-VIS-005 : base de données indisponible → 503, aucune recherche comptée", async () => {
    const { application, depot } = creerApplication();
    const jeton = await consommer(application, 3);
    depot.enPanne = true;
    const reponse = await rechercher(application, jeton);
    depot.enPanne = false;
    assert.equal(reponse.status, 503);
    assert.equal(reponse.body.erreur.code, "BASE_DE_DONNEES_INDISPONIBLE");
    assert.equal(depot.compteur(jeton), 3);
  });

  it("EF-VIS-007 : les informations publiques restent consultables après la limite", async () => {
    const { application } = creerApplication();
    const jeton = await consommer(application, 10);
    assert.equal((await rechercher(application, jeton)).status, 429);
    const arrets = await request(application).get("/api/arrets").set(ENTETE_JETON_VISITEUR, jeton);
    assert.equal(arrets.status, 200);
  });

  it("AC-16 / EF-VIS-008 : un compte connecté n'est jamais limité et rien n'est écrit", async () => {
    const { application, depot } = creerApplication();
    for (let i = 0; i < 15; i += 1) {
      const reponse = await request(application)
        .get("/api/trajets/recherche")
        .set("Authorization", `Bearer ${JETON_SESSION_VALIDE}`);
      assert.equal(reponse.status, 200);
      assert.equal(reponse.headers["x-visiteur"], undefined);
      assert.equal(reponse.headers["x-quota-restant"], undefined);
    }
    assert.equal(depot.lignes.size, 0);
  });

  it("passage au compte connecté : un visiteur au quota atteint peut rechercher une fois connecté", async () => {
    const { application } = creerApplication();
    const jeton = await consommer(application, 10);
    assert.equal((await rechercher(application, jeton)).status, 429);
    const connecte = await request(application)
      .get("/api/trajets/recherche")
      .set(ENTETE_JETON_VISITEUR, jeton)
      .set("Authorization", `Bearer ${JETON_SESSION_VALIDE}`);
    assert.equal(connecte.status, 200);
  });

  it("session expirée ou invalide → 401 SESSION_INVALIDE, sans consommer le quota visiteur", async () => {
    const { application, depot } = creerApplication();
    const reponse = await request(application)
      .get("/api/trajets/recherche")
      .set("Authorization", "Bearer jeton-expire");
    assert.equal(reponse.status, 401);
    assert.equal(reponse.body.erreur.code, "SESSION_INVALIDE");
    assert.equal(depot.lignes.size, 0);
  });

  it("un jeton visiteur inconnu est remplacé, dans la limite du plafond par IP", async () => {
    const { application } = creerApplication({ plafondJetonsParIp: 2 });
    const inconnu = "00000000-0000-4000-8000-000000000000";
    const premiere = await rechercher(application, inconnu);
    assert.equal(premiere.status, 200);
    assert.notEqual(premiere.headers["x-visiteur"], inconnu);
    assert.equal((await rechercher(application)).status, 200);

    const troisieme = await rechercher(application);
    assert.equal(troisieme.status, 429);
    assert.equal(troisieme.body.erreur.code, "TROP_DE_JETONS_VISITEUR");
  });

  it("deux recherches simultanées pour la dixième place : une seule est acceptée", async () => {
    const { application, depot } = creerApplication();
    const jeton = await consommer(application, 9);
    const [a, b] = await Promise.all([
      rechercher(application, jeton, "lent"),
      rechercher(application, jeton, "lent")
    ]);
    assert.deepEqual([a.status, b.status].sort(), [200, 429]);
    assert.equal(depot.compteur(jeton), 10);
  });
});
