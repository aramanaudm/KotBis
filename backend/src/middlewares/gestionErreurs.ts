import type { ErrorRequestHandler, RequestHandler } from "express";
import { ErreurApi } from "../commun/erreurs";
import { ErreurBaseDeDonnees } from "../configuration/baseDeDonnees";

export const routeInconnue: RequestHandler = (_requete, reponse) => {
  reponse.status(404).json({
    erreur: {
      code: "RESSOURCE_INTROUVABLE",
      message: "Route introuvable."
    }
  });
};

export const gestionnaireErreurs: ErrorRequestHandler = (erreur, _requete, reponse, _suivant) => {
  if (erreur instanceof ErreurApi) {
    reponse.status(erreur.statut).json({
      erreur: {
        code: erreur.code,
        message: erreur.message,
        ...(erreur.details ? { details: erreur.details } : {})
      }
    });
    return;
  }

  if (erreur instanceof ErreurBaseDeDonnees) {
    reponse.status(503).json({
      erreur: {
        code: "BASE_DE_DONNEES_INDISPONIBLE",
        message: "Base de données indisponible."
      }
    });
    return;
  }

  if (erreur instanceof SyntaxError && "body" in erreur) {
    reponse.status(400).json({
      erreur: {
        code: "JSON_INVALIDE",
        message: "Le corps de la requête n'est pas un JSON valide."
      }
    });
    return;
  }

  console.error(`[API] Erreur interne : ${erreur instanceof Error ? erreur.message : "inconnue"}`);
  reponse.status(500).json({
    erreur: {
      code: "ERREUR_INTERNE",
      message: "Erreur interne du serveur."
    }
  });
};
