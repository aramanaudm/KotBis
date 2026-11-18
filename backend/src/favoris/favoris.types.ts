// Types des favoris (EF-FAV-001 à 006).
// Un favori enregistre les paramètres d'une recherche (arrêts), pas un résultat :
// le trajet est recalculé à chaque relance (EF-FAV-003), selon les paramètres définis par KBE-30.

export const TYPES_FAVORI = ["destination", "trajet"] as const;
export type TypeFavori = (typeof TYPES_FAVORI)[number];

// Nombre maximal de favoris par compte (à confirmer avec le Front-End)
export const LIMITE_FAVORIS = 50;
export const LONGUEUR_MAX_LIBELLE = 80;

// destination : arrivée seule ; trajet : départ + arrivée
export interface NouveauFavori {
  type: TypeFavori;
  arretDepartId: number | null;
  arretArriveeId: number;
  libelle: string | null;
}

// Favori tel que stocké dans la table favoris
export interface FavoriEnregistre extends NouveauFavori {
  id: number;
  voyageurId: number;
  creeLe: Date;
}

// Arrêt vu par le réseau ; disponible = actif, non archivé et desservi par une ligne active
export interface ArretReseau {
  id: number;
  code: string;
  nom: string;
  disponible: boolean;
}

// Arrêt renvoyé au client ; code et nom null si l'arrêt n'existe plus
export interface ArretResume {
  id: number;
  code: string | null;
  nom: string | null;
}

// Favori renvoyé au client
export interface Favori {
  id: number;
  type: TypeFavori;
  depart: ArretResume | null;
  arrivee: ArretResume;
  libelle: string | null;
  creeLe: string;
  // EF-FAV-006 : false si un arrêt ou sa ligne n'est plus actif ; le client ne relance alors pas la recherche
  disponible: boolean;
}

// Trajet du réseau proposé à l'ajout (table trajets) : ses premier et dernier arrêts
// deviennent le départ et l'arrivée du favori.
export const LIMITE_TRAJETS_PROPOSES = 20;
export const LONGUEUR_MAX_RECHERCHE = 100;

export interface TrajetPropose {
  trajetId: number;
  ligne: string;
  nom: string;
  direction: string;
  depart: { id: number; nom: string };
  arrivee: { id: number; nom: string };
}
