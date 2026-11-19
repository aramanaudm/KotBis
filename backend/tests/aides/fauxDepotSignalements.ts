import { ErreurApi } from "../../src/commun/erreurs";
import type {
  DepotSignalements,
  FiltresAdminSignalements,
  PageSignalements,
  Signalement,
  SignalementAdmin,
  StatutSignalement
} from "../../src/signalements/signalements.types";

function versAdmin(signalement: Signalement): SignalementAdmin {
  return {
    reference: signalement.reference,
    bus: signalement.busId ?? signalement.trajetId ?? "",
    type: signalement.type,
    statut: signalement.statut,
    recuLe: signalement.recuLe,
    observeLe: signalement.observeLe,
    commentaire: signalement.commentaire,
    version: signalement.version
  };
}

export class FauxDepotSignalements implements DepotSignalements {
  readonly signalements: Signalement[] = [];
  private sequence = 1;

  async creer(signalement: Signalement): Promise<Signalement> {
    const existant = await this.trouverParCleIdempotence(
      signalement.auteurId,
      signalement.cleIdempotence
    );
    if (existant) {
      throw new ErreurApi(409, "SIGNALEMENT_IDEMPOTENT", "Signalement déjà enregistré.");
    }
    const enregistre: Signalement = { ...signalement, id: String(this.sequence++) };
    this.signalements.push(enregistre);
    return enregistre;
  }

  async trouverParCleIdempotence(
    auteurId: string,
    cleIdempotence: string
  ): Promise<Signalement | null> {
    return (
      this.signalements.find(
        (item) => item.auteurId === auteurId && item.cleIdempotence === cleIdempotence
      ) ?? null
    );
  }

  async listerParAuteur(auteurId: string): Promise<Signalement[]> {
    return this.signalements.filter((item) => item.auteurId === auteurId);
  }

  async listerAdmin(filtres: FiltresAdminSignalements): Promise<PageSignalements> {
    let elements = this.signalements.map(versAdmin);
    if (filtres.q) {
      const recherche = filtres.q.toLowerCase();
      elements = elements.filter((item) =>
        [item.reference, item.bus, item.commentaire ?? ""]
          .some((valeur) => valeur.toLowerCase().includes(recherche))
      );
    }
    if (filtres.statut) {
      elements = elements.filter((item) => item.statut === filtres.statut);
    }
    const total = elements.length;
    const debut = (filtres.page - 1) * filtres.limit;
    return {
      elements: elements.slice(debut, debut + filtres.limit),
      total,
      page: filtres.page,
      limit: filtres.limit,
      pages: total === 0 ? 1 : Math.ceil(total / filtres.limit)
    };
  }

  async mettreAJourStatut(
    reference: string,
    statut: StatutSignalement
  ): Promise<SignalementAdmin | null> {
    const signalement = this.signalements.find((item) => item.reference === reference);
    if (!signalement) return null;
    signalement.statut = statut;
    signalement.version += 1;
    return versAdmin(signalement);
  }
}
