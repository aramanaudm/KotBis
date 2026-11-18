import express from "express";
import { creerRouteurAuthentification } from "../../src/authentification/routes";
import { ServiceAuthentification } from "../../src/authentification/service";
import {
  creerMiddlewareSession,
  obtenirUtilisateurCourant
} from "../../src/middlewares/authentification";
import { gestionnaireErreurs, routeInconnue } from "../../src/middlewares/gestionErreurs";
import { FauxDepot } from "./fauxDepot";

export interface ApplicationTest {
  application: express.Express;
  depot: FauxDepot;
  service: ServiceAuthentification;
}

export function creerApplicationTest(): ApplicationTest {
  const depot = new FauxDepot();
  const service = new ServiceAuthentification(depot, { dureeSessionMinutes: 60 });
  const middlewareSession = creerMiddlewareSession(service);
  const application = express();

  application.use(express.json({ limit: "100kb" }));
  application.use("/api", creerRouteurAuthentification(service, middlewareSession));
  application.get("/api/prive", middlewareSession, (requete, reponse) => {
    reponse.json({ utilisateur: obtenirUtilisateurCourant(requete) });
  });
  application.use(routeInconnue);
  application.use(gestionnaireErreurs);

  return { application, depot, service };
}
