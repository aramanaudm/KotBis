// KBE-45 : application du quota visiteur sur la route de recherche de trajet.
// À placer après creerMiddlewareSessionFacultative et avant le contrôleur de recherche :
//   app.get("/api/trajets/recherche", sessionFacultative, quotaVisiteur, rechercherTrajet);
//
// - compte connecté : aucun quota (EF-VIS-008) ;
// - visiteur : une recherche est réservée avant le contrôleur, puis rendue si la
//   réponse n'est pas un succès 2xx (EF-VIS-004, EF-VIS-005) ;
// - limite atteinte : 429 QUOTA_VISITEUR_ATTEINT (EF-VIS-006).
// Les autres routes publiques ne passent pas par ce middleware (EF-VIS-007).
import type { Request, RequestHandler } from "express";
import type { ServiceQuotaVisiteur } from "../trajets/quota-visiteur.service";

// Jeton visiteur : envoyé par l'application, renvoyé par le serveur.
export const ENTETE_JETON_VISITEUR = "X-Visiteur";
// Recherches restantes après la recherche en cours, si elle réussit (réponses 2xx).
export const ENTETE_QUOTA_RESTANT = "X-Quota-Restant";

type ServiceQuota = Pick<ServiceQuotaVisiteur, "reserver" | "rendre">;

function adresseIp(requete: Request): string {
  return requete.ip ?? requete.socket.remoteAddress ?? "inconnu";
}

export function creerMiddlewareQuotaVisiteur(service: ServiceQuota): RequestHandler {
  return async (requete, reponse, suivant) => {
    if (requete.utilisateur) {
      suivant();
      return;
    }

    try {
      const jetonRecu = requete.header(ENTETE_JETON_VISITEUR)?.trim() || undefined;
      const reservation = await service.reserver(jetonRecu, adresseIp(requete));

      reponse.setHeader(ENTETE_JETON_VISITEUR, reservation.jeton);
      reponse.setHeader(ENTETE_QUOTA_RESTANT, String(reservation.restant));

      // Une seule décision par requête : la recherche est comptée si la réponse
      // est un succès envoyé en entier, sinon elle est rendue.
      let traitee = false;
      const terminer = (): void => {
        if (traitee) return;
        traitee = true;
        const reussie =
          reponse.writableFinished && reponse.statusCode >= 200 && reponse.statusCode < 300;
        if (!reussie) {
          service.rendre(reservation.jeton).catch(() => {
            console.error("[Quota visiteur] Impossible de rendre une recherche non aboutie.");
          });
        }
      };
      reponse.on("finish", terminer);
      reponse.on("close", terminer);

      suivant();
    } catch (erreur) {
      suivant(erreur);
    }
  };
}
