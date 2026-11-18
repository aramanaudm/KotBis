// KBE-45 : session facultative pour les routes publiques (EF-VIS-001).
// - sans en-tête Authorization : la requête continue en mode visiteur ;
// - avec un jeton valide : le compte connecté est attaché à la requête ;
// - avec un jeton invalide, expiré ou révoqué : 401, pour que l'application
//   reconnecte l'utilisateur au lieu de consommer en silence le quota visiteur.
// Réutilise la vérification de session de KBE-23 sans la modifier.
import type { RequestHandler } from "express";
import type { ServiceAuthentification } from "../authentification/service";
import { ErreurAuthentification } from "../commun/erreurs";

type VerificateurSession = Pick<ServiceAuthentification, "verifierSession">;

function lireJetonBearer(entete: string): string | null {
  const [schema, jeton] = entete.trim().split(/\s+/);
  return schema?.toLowerCase() === "bearer" && jeton ? jeton : null;
}

export function creerMiddlewareSessionFacultative(service: VerificateurSession): RequestHandler {
  return async (requete, _reponse, suivant) => {
    try {
      const entete = requete.header("authorization");
      if (!entete) {
        suivant();
        return;
      }

      const jeton = lireJetonBearer(entete);
      const session = jeton ? await service.verifierSession(jeton) : null;
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
