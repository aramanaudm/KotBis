// Dépôt des favoris et référentiel réseau en mémoire, réservés aux tests (aucun PostgreSQL).
// La règle anti-doublon reproduit l'index unique proposé à l'équipe BDD :
// (voyageur_id, type, COALESCE(arret_depart_id, 0), arret_arrivee_id).
import { FavoriExistantErreur, type DepotFavoris, type ReferentielReseau } from "../../src/favoris/favoris.depot";
import type { ArretReseau, FavoriEnregistre, NouveauFavori } from "../../src/favoris/favoris.types";

export class DepotFavorisMemoire implements DepotFavoris {
  favoris: FavoriEnregistre[] = [];
  private prochainId = 1;
  private horloge = Date.parse("2026-01-01T00:00:00Z");

  async lister(voyageurId: number): Promise<FavoriEnregistre[]> {
    return this.favoris
      .filter((f) => f.voyageurId === voyageurId)
      .sort((a, b) => b.creeLe.getTime() - a.creeLe.getTime() || b.id - a.id)
      .map((f) => ({ ...f }));
  }

  async compter(voyageurId: number): Promise<number> {
    return this.favoris.filter((f) => f.voyageurId === voyageurId).length;
  }

  async ajouter(voyageurId: number, n: NouveauFavori): Promise<FavoriEnregistre> {
    const doublon = this.favoris.some(
      (f) =>
        f.voyageurId === voyageurId &&
        f.type === n.type &&
        (f.arretDepartId ?? 0) === (n.arretDepartId ?? 0) &&
        f.arretArriveeId === n.arretArriveeId
    );
    if (doublon) throw new FavoriExistantErreur();
    const favori: FavoriEnregistre = {
      ...n,
      id: this.prochainId++,
      voyageurId,
      creeLe: new Date((this.horloge += 1000))
    };
    this.favoris.push(favori);
    return { ...favori };
  }

  async supprimer(voyageurId: number, id: number): Promise<boolean> {
    const index = this.favoris.findIndex((f) => f.id === id && f.voyageurId === voyageurId);
    if (index < 0) return false;
    this.favoris.splice(index, 1);
    return true;
  }
}

export class ReferentielReseauMemoire implements ReferentielReseau {
  arrets = new Map<number, ArretReseau>();

  constructor(arrets: ArretReseau[] = []) {
    for (const a of arrets) this.arrets.set(a.id, { ...a });
  }

  async trouverArrets(ids: number[]): Promise<ArretReseau[]> {
    return ids.flatMap((id) => {
      const a = this.arrets.get(id);
      return a ? [{ ...a }] : [];
    });
  }

  // Simule l'archivage d'un arrêt ou de la dernière ligne qui le dessert
  rendreIndisponible(id: number): void {
    this.arrets.get(id)!.disponible = false;
  }
}
