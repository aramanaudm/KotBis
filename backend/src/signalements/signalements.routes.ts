import { Router, type RequestHandler } from "express";
import { ErreurApi } from "../commun/erreurs";
import { obtenirUtilisateurCourant } from "../middlewares/authentification";
import type { SignalementsController } from "./signalements.controller";

const ROLES_ADMIN = ["operateur", "moderateur", "administrateur"];

export function exigerRole(...roles: string[]): RequestHandler {
  return (requete, _reponse, suivant) => {
    try {
      const utilisateur = obtenirUtilisateurCourant(requete);
      if (!roles.includes(utilisateur.role)) {
        throw new ErreurApi(403, "ACCES_REFUSE", "Rôle non autorisé pour cette opération.");
      }
      suivant();
    } catch (erreur) {
      suivant(erreur);
    }
  };
}

export function creerRoutesSignalements(
  controller: SignalementsController,
  authentifier: RequestHandler
): Router {
  const routeur = Router();

  routeur.post("/", authentifier, exigerRole("voyageur"), controller.creer);
  routeur.get("/moi", authentifier, exigerRole("voyageur"), controller.lireMoi);
  routeur.get("/", authentifier, exigerRole(...ROLES_ADMIN), controller.listerAdmin);
  routeur.put(
    "/:reference/statut",
    authentifier,
    exigerRole(...ROLES_ADMIN),
    controller.mettreAJourStatut
  );

  return routeur;
}
