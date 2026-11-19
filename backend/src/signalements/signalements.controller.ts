import type { Request, Response } from "express";
import { obtenirUtilisateurCourant } from "../middlewares/authentification";
import { ServiceSignalements } from "./signalements.service";
import {
  validerCreationSignalement,
  validerFiltresAdmin,
  validerStatut
} from "./signalements.validation";

export class SignalementsController {
  constructor(private readonly service: ServiceSignalements) {}

  creer = async (requete: Request, reponse: Response): Promise<void> => {
    const utilisateur = obtenirUtilisateurCourant(requete);
    const donnees = validerCreationSignalement(requete.body);
    const resultat = await this.service.creer(utilisateur.compteId, donnees);
    reponse.status(resultat.cree ? 201 : 200).json({
      success: true,
      idempotent: !resultat.cree,
      data: resultat.signalement
    });
  };

  lireMoi = async (requete: Request, reponse: Response): Promise<void> => {
    const utilisateur = obtenirUtilisateurCourant(requete);
    const signalements = await this.service.listerParAuteur(utilisateur.compteId);
    reponse.status(200).json({ success: true, data: signalements });
  };

  listerAdmin = async (requete: Request, reponse: Response): Promise<void> => {
    const filtres = validerFiltresAdmin(requete.query);
    const page = await this.service.listerAdmin(filtres);
    reponse.status(200).json({ success: true, data: page });
  };

  mettreAJourStatut = async (requete: Request, reponse: Response): Promise<void> => {
    const statut = validerStatut(requete.body?.statut);
    const referenceBrute = requete.params.reference;
    const reference = Array.isArray(referenceBrute) ? referenceBrute[0] : referenceBrute;
    const signalement = await this.service.changerStatut(String(reference ?? ""), statut);
    reponse.status(200).json({ success: true, data: signalement });
  };
}
