// Interfaces d'accès aux favoris et au réseau.
// Implémentation PostgreSQL : favoris.depot.postgres.ts (table favoris, KB-48).
import type { ArretReseau, FavoriEnregistre, NouveauFavori, TrajetPropose } from "./favoris.types";

// Levée par ajouter() quand la règle anti-doublon est violée (EF-FAV-005)
export class FavoriExistantErreur extends Error {
  constructor() {
    super("Favori déjà enregistré");
    this.name = "FavoriExistantErreur";
  }
}

export interface DepotFavoris {
  // Favoris du voyageur, du plus récent au plus ancien
  lister(voyageurId: number): Promise<FavoriEnregistre[]>;
  compter(voyageurId: number): Promise<number>;
  // Doublon = même voyageur + même type + même départ (ou absent) + même arrivée
  ajouter(voyageurId: number, favori: NouveauFavori): Promise<FavoriEnregistre>;
  // false si le favori n'existe pas OU appartient à un autre voyageur (CA-031)
  supprimer(voyageurId: number, id: number): Promise<boolean>;
}

export interface ReferentielReseau {
  // Arrêts trouvés parmi ids (un arrêt inexistant est absent du résultat)
  trouverArrets(ids: number[]): Promise<ArretReseau[]>;
  // Trajets actifs (ligne active, arrêts de départ et d'arrivée disponibles), filtrés par texte
  rechercherTrajets(recherche: string | null, limite: number): Promise<TrajetPropose[]>;
}
