import { Router, type RequestHandler } from "express";
import { obtenirSessionCourante, obtenirUtilisateurCourant } from "../middlewares/authentification";
import type { ServiceAuthentification } from "../authentification/service";
import {
  validerChangementEmail,
  validerChangementMotDePasse
} from "../authentification/validation";

export function creerRouteurUtilisateurs(
  service: ServiceAuthentification,
  middlewareSession: RequestHandler
): Router {
  const routeur = Router();

  routeur.use(middlewareSession);

  routeur.patch("/moi/email", async (requete, reponse) => {
    const utilisateur = obtenirUtilisateurCourant(requete);
    const donnees = validerChangementEmail(requete.body);
    const profil = await service.changerEmail(
      utilisateur.compteId,
      donnees.email,
      donnees.motDePasse
    );
    reponse.set("Cache-Control", "no-store");
    reponse.status(200).json({ utilisateur: profil });
  });

  routeur.patch("/moi/mot-de-passe", async (requete, reponse) => {
    const utilisateur = obtenirUtilisateurCourant(requete);
    const session = obtenirSessionCourante(requete);
    const donnees = validerChangementMotDePasse(requete.body);
    await service.changerMotDePasse(
      utilisateur.compteId,
      session.empreinteJeton,
      donnees.motDePasseActuel,
      donnees.nouveauMotDePasse
    );
    reponse.set("Cache-Control", "no-store");
    reponse.status(204).send();
  });

  return routeur;
}
