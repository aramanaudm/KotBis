import express from "express";
import { creerRouteurAuthentification } from "../../src/authentification/routes";
import {
  ServiceAuthentification,
  type OptionsServiceAuthentification
} from "../../src/authentification/service";
import {
  creerMiddlewareSession,
  obtenirUtilisateurCourant
} from "../../src/middlewares/authentification";
import { gestionnaireErreurs, routeInconnue } from "../../src/middlewares/gestionErreurs";
import { creerRouteurUtilisateurs } from "../../src/utilisateurs/routes";
import { FauxDepot } from "./fauxDepot";

export interface OptionsApplicationTest extends OptionsServiceAuthentification {
  codesEnvoyes?: string[];
}

export interface ApplicationTest {
  application: express.Express;
  depot: FauxDepot;
  service: ServiceAuthentification;
  codesEnvoyes: string[];
}

export function creerApplicationTest(options: OptionsApplicationTest = {}): ApplicationTest {
  const depot = new FauxDepot();
  const { codesEnvoyes = [], ...optionsService } = options;
  const service = new ServiceAuthentification(depot, {
    dureeSessionMinutes: 60,
    ...optionsService,
    envoyerCodeReinitialisation: async (email, code) => {
      codesEnvoyes.push(code);
      await optionsService.envoyerCodeReinitialisation?.(email, code);
    }
  });
  const middlewareSession = creerMiddlewareSession(service);
  const application = express();

  application.use(express.json({ limit: "100kb" }));
  application.use("/api", creerRouteurAuthentification(service, middlewareSession));
  application.use(
    "/api/utilisateurs",
    creerRouteurUtilisateurs(service, middlewareSession)
  );
  application.get("/api/prive", middlewareSession, (requete, reponse) => {
    reponse.json({ utilisateur: obtenirUtilisateurCourant(requete) });
  });
  application.use(routeInconnue);
  application.use(gestionnaireErreurs);

  return { application, depot, service, codesEnvoyes };
}
