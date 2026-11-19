import { Router, type RequestHandler } from "express";
import { obtenirSessionCourante, obtenirUtilisateurCourant } from "../middlewares/authentification";
import type { ServiceAuthentification } from "./service";
import {
  validerConnexion,
  validerDemandeReinitialisation,
  validerInscription,
  validerReinitialisation
} from "./validation";

function adresseIp(requete: Parameters<RequestHandler>[0]): string {
  return requete.ip ?? requete.socket.remoteAddress ?? "inconnu";
}

export function creerRouteurAuthentification(
  service: ServiceAuthentification,
  middlewareSession: RequestHandler
): Router {
  const routeur = Router();

  routeur.post("/inscription", async (requete, reponse) => {
    const donnees = validerInscription(requete.body);
    const utilisateur = await service.inscrire(donnees);
    reponse.status(201).json({ utilisateur });
  });

  routeur.post("/connexion", async (requete, reponse) => {
    const donnees = validerConnexion(requete.body);
    const connexion = await service.connecter(
      donnees.identifiant,
      donnees.motDePasse,
      adresseIp(requete)
    );
    reponse.set("Cache-Control", "no-store");
    reponse.status(200).json(connexion);
  });

  routeur.post("/deconnexion", middlewareSession, async (requete, reponse) => {
    const session = obtenirSessionCourante(requete);
    await service.deconnecter(session.empreinteJeton);
    reponse.status(204).send();
  });

  routeur.post("/renouvellement-session", middlewareSession, async (requete, reponse) => {
    const utilisateur = obtenirUtilisateurCourant(requete);
    const session = obtenirSessionCourante(requete);
    const nouvelleSession = await service.renouvelerSession(utilisateur, session.empreinteJeton);
    reponse.set("Cache-Control", "no-store");
    reponse.status(200).json(nouvelleSession);
  });

  routeur.post("/mot-de-passe/oublie", async (requete, reponse) => {
    const email = validerDemandeReinitialisation(requete.body);
    const resultat = await service.demanderReinitialisation(email);
    reponse.set("Cache-Control", "no-store");
    reponse.status(202).json({
      message:
        "Si un compte actif correspond à cette adresse, un code de réinitialisation a été envoyé.",
      ...resultat
    });
  });

  routeur.post("/mot-de-passe/reinitialisation", async (requete, reponse) => {
    const donnees = validerReinitialisation(requete.body);
    await service.reinitialiserMotDePasse(
      donnees.email,
      donnees.code,
      donnees.nouveauMotDePasse
    );
    reponse.set("Cache-Control", "no-store");
    reponse.status(204).send();
  });

  return routeur;
}
