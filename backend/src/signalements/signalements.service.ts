import { randomBytes } from "node:crypto";
import { ErreurApi } from "../commun/erreurs";
import type {
  DepotSignalements,
  DonneesCreationSignalement,
  FiltresAdminSignalements,
  PageSignalements,
  ResultatCreation,
  Signalement,
  SignalementAdmin,
  StatutSignalement
} from "./signalements.types";

function genererReference(maintenant: Date): string {
  const horodatage = maintenant.getTime().toString(36).toUpperCase();
  const alea = randomBytes(3).toString("hex").toUpperCase();
  return `SIG-${horodatage}-${alea}`;
}

export class ServiceSignalements {
  constructor(private readonly depot: DepotSignalements) {}

  async creer(
    auteurId: string,
    donnees: DonneesCreationSignalement,
    maintenant: Date = new Date()
  ): Promise<ResultatCreation> {
    if (donnees.observeLe.getTime() > maintenant.getTime()) {
      throw new ErreurApi(
        400,
        "DATE_OBSERVATION_FUTURE",
        "La date d'observation ne peut pas être dans le futur.",
        [{ champ: "observeLe", message: "La date d'observation ne peut pas être dans le futur." }]
      );
    }

    const existant = await this.depot.trouverParCleIdempotence(auteurId, donnees.cleIdempotence);
    if (existant) return { signalement: existant, cree: false };

    const signalement: Signalement = {
      id: "",
      reference: genererReference(maintenant),
      auteurId,
      busId: donnees.busId,
      trajetId: donnees.trajetId,
      categorie: donnees.categorie,
      type: donnees.type,
      commentaire: donnees.commentaire,
      statut: "a_verifier",
      observeLe: donnees.observeLe.toISOString(),
      recuLe: maintenant.toISOString(),
      position: donnees.position,
      cleIdempotence: donnees.cleIdempotence,
      version: 1,
      archiveLe: null,
      creeLe: maintenant.toISOString()
    };

    try {
      const cree = await this.depot.creer(signalement);
      return { signalement: cree, cree: true };
    } catch (erreur) {
      if (erreur instanceof ErreurApi && erreur.code === "SIGNALEMENT_IDEMPOTENT") {
        const dejaCree = await this.depot.trouverParCleIdempotence(auteurId, donnees.cleIdempotence);
        if (dejaCree) return { signalement: dejaCree, cree: false };
      }
      throw erreur;
    }
  }

  async listerParAuteur(auteurId: string): Promise<Signalement[]> {
    return this.depot.listerParAuteur(auteurId);
  }

  async listerAdmin(filtres: FiltresAdminSignalements): Promise<PageSignalements> {
    return this.depot.listerAdmin(filtres);
  }

  async changerStatut(reference: string, statut: StatutSignalement): Promise<SignalementAdmin> {
    const misAJour = await this.depot.mettreAJourStatut(reference, statut);
    if (!misAJour) {
      throw new ErreurApi(404, "SIGNALEMENT_INTROUVABLE", "Signalement introuvable.");
    }
    return misAJour;
  }
}
