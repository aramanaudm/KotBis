// Middleware d'authentification : vérifie le jeton (fourni par KBE-23) puis relit le compte en base
// à chaque requête, pour qu'une suspension ou une rétrogradation s'applique immédiatement.
import type { RequestHandler } from "express";
import { envoyerErreur } from "../commun/erreur-api";
import type { LecteurCompte } from "../utilisateurs/comptes.depot";

// Fourni par KBE-23 (JWT ou session serveur) : null si le jeton est invalide, expiré ou révoqué
export type VerificateurJeton = (jeton: string) => Promise<{ compteId: number } | null>;

export function creerMiddlewareAuthentification(
  verifierJeton: VerificateurJeton,
  lecteur: LecteurCompte
): RequestHandler {
  return async (req, res, next) => {
    const entete = req.headers.authorization ?? "";
    const jeton = entete.startsWith("Bearer ") ? entete.slice(7).trim() : "";
    if (!jeton) {
      envoyerErreur(res, 401, "AUTHENTIFICATION_REQUISE", "Authentification requise.");
      return;
    }

    const session = await verifierJeton(jeton).catch(() => null);
    if (!session) {
      envoyerErreur(res, 401, "SESSION_INVALIDE", "Session invalide ou expirée.");
      return;
    }

    let compte;
    try {
      // Le rôle et l'état ne sont jamais lus depuis le jeton
      compte = await lecteur.trouverCompteAuthentifie(session.compteId);
    } catch {
      envoyerErreur(res, 503, "SERVICE_INDISPONIBLE", "Service temporairement indisponible.");
      return;
    }

    if (!compte) {
      envoyerErreur(res, 401, "SESSION_INVALIDE", "Session invalide ou expirée.");
      return;
    }
    if (compte.etat !== "actif") {
      envoyerErreur(res, 403, "COMPTE_INACTIF", "Ce compte est suspendu ou inactif.");
      return;
    }

    req.compte = compte;
    req.compteId = compte.id;
    next();
  };
}
