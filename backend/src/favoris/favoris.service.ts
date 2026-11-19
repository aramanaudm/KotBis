// Règles métier des favoris (EF-FAV-001 à 006, EF-AUTH-017, CA-031).
import type { ProfilUtilisateur } from "../authentification/types";
import { ErreurApi } from "../commun/erreurs";
import { FavoriExistantErreur, type DepotFavoris, type ReferentielReseau } from "./favoris.depot";
import {
  LIMITE_FAVORIS,
  type ArretReseau,
  type ArretResume,
  type Favori,
  type FavoriEnregistre,
  type NouveauFavori,
  type TrajetPropose
} from "./favoris.types";

// Compte connecté tel que posé par le middleware de session (KBE-23)
export type CompteFavoris = Pick<ProfilUtilisateur, "compteId" | "role">;

function resumer(id: number, arret: ArretReseau | undefined): ArretResume {
  return { id, code: arret?.code ?? null, nom: arret?.nom ?? null };
}

export class FavorisService {
  constructor(
    private readonly depot: DepotFavoris,
    private readonly reseau: ReferentielReseau
  ) {}

  // EF-FAV-002 / EF-AUTH-017 : uniquement les favoris du compte connecté
  async lister(compte: CompteFavoris): Promise<Favori[]> {
    const voyageurId = this.exigerVoyageur(compte);
    const favoris = await this.depot.lister(voyageurId);
    const ids = new Set<number>();
    for (const f of favoris) {
      ids.add(f.arretArriveeId);
      if (f.arretDepartId !== null) ids.add(f.arretDepartId);
    }
    const arrets = await this.chargerArrets([...ids]);
    return favoris.map((f) => this.presenter(f, arrets));
  }

  // EF-FAV-001 / EF-FAV-005
  async ajouter(compte: CompteFavoris, nouveau: NouveauFavori): Promise<Favori> {
    const voyageurId = this.exigerVoyageur(compte);

    // On n'enregistre pas un favori vers un arrêt déjà hors service
    const ids = [nouveau.arretArriveeId, ...(nouveau.arretDepartId !== null ? [nouveau.arretDepartId] : [])];
    const arrets = await this.chargerArrets(ids);
    if (ids.some((id) => !arrets.get(id)?.disponible)) {
      throw new ErreurApi(422, "ARRET_INDISPONIBLE", "Un des arrêts choisis n'existe pas ou n'est plus desservi.");
    }

    if ((await this.depot.compter(voyageurId)) >= LIMITE_FAVORIS) {
      throw new ErreurApi(422, "LIMITE_FAVORIS", `Vous ne pouvez pas enregistrer plus de ${LIMITE_FAVORIS} favoris.`);
    }

    try {
      const enregistre = await this.depot.ajouter(voyageurId, nouveau);
      return this.presenter(enregistre, arrets);
    } catch (erreur) {
      if (erreur instanceof FavoriExistantErreur) {
        throw new ErreurApi(409, "FAVORI_EXISTANT", "Ce favori est déjà enregistré.");
      }
      throw erreur;
    }
  }

  // Trajets de la table trajets que le voyageur peut ajouter en favori
  async listerTrajets(compte: CompteFavoris, recherche: string | null, limite: number): Promise<TrajetPropose[]> {
    this.exigerVoyageur(compte);
    return this.reseau.rechercherTrajets(recherche, limite);
  }

  // EF-FAV-004 / CA-031 : le favori d'un autre compte renvoie 404, comme un favori inexistant
  async supprimer(compte: CompteFavoris, id: number): Promise<void> {
    const voyageurId = this.exigerVoyageur(compte);
    if (!(await this.depot.supprimer(voyageurId, id))) {
      throw new ErreurApi(404, "FAVORI_INTROUVABLE", "Favori introuvable.");
    }
  }

  // Les favoris sont rattachés à un voyageur (relation voyageurs → favoris).
  // Renvoie l'identifiant du voyageur (comptes.id, reçu en texte depuis la session).
  private exigerVoyageur(compte: CompteFavoris): number {
    if (compte.role !== "voyageur") {
      throw new ErreurApi(403, "ACCES_INTERDIT", "Les favoris sont réservés aux voyageurs.");
    }
    const voyageurId = Number(compte.compteId);
    if (!Number.isSafeInteger(voyageurId) || voyageurId <= 0) {
      throw new ErreurApi(401, "SESSION_INVALIDE", "Session absente, expirée ou révoquée.");
    }
    return voyageurId;
  }

  private async chargerArrets(ids: number[]): Promise<Map<number, ArretReseau>> {
    const arrets = await this.reseau.trouverArrets(ids);
    return new Map(arrets.map((a) => [a.id, a]));
  }

  // EF-FAV-006 : le favori reste visible, mais disponible = false si un de ses arrêts
  // a disparu, est archivé ou n'est plus desservi par une ligne active
  private presenter(f: FavoriEnregistre, arrets: Map<number, ArretReseau>): Favori {
    const depart = f.arretDepartId !== null ? arrets.get(f.arretDepartId) : undefined;
    const arrivee = arrets.get(f.arretArriveeId);
    const disponible = !!arrivee?.disponible && (f.arretDepartId === null || !!depart?.disponible);
    return {
      id: f.id,
      type: f.type,
      depart: f.arretDepartId !== null ? resumer(f.arretDepartId, depart) : null,
      arrivee: resumer(f.arretArriveeId, arrivee),
      libelle: f.libelle,
      creeLe: f.creeLe.toISOString(),
      disponible
    };
  }
}
