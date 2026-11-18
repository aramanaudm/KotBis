import type { Request, RequestHandler } from "express";
import type { ServiceAuthentification } from "../authentification/service";
import type { ProfilUtilisateur, SessionAuthentification } from "../authentification/types";
import { ErreurAuthentification } from "../commun/erreurs";

function lireJetonBearer(entete: string | undefined): string | null {
  if (!entete) {
    return null;
  }
  const [schema, jeton] = entete.split(" ");
  if (schema?.toLowerCase() !== "bearer" || !jeton) {
    return null;
  }
  return jeton;
}

export function creerMiddlewareSession(service: ServiceAuthentification): RequestHandler {
  return async (requete, _reponse, suivant) => {
    try {
      const jeton = lireJetonBearer(requete.header("authorization"));
      if (!jeton) {
        throw new ErreurAuthentification();
      }

      const session = await service.verifierSession(jeton);
      if (!session) {
        throw new ErreurAuthentification("SESSION_INVALIDE", "Session absente, expirée ou révoquée.");
      }

      requete.utilisateur = session.utilisateur;
      requete.sessionAuthentification = { empreinteJeton: session.empreinteJeton };
      suivant();
    } catch (erreur) {
      suivant(erreur);
    }
  };
}

export function obtenirUtilisateurCourant(requete: Request): ProfilUtilisateur {
  if (!requete.utilisateur) {
    throw new ErreurAuthentification();
  }
  return requete.utilisateur;
}

export function obtenirSessionCourante(requete: Request): SessionAuthentification {
  if (!requete.sessionAuthentification) {
    throw new ErreurAuthentification();
  }
  return requete.sessionAuthentification;
}
