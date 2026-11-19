export const CATEGORIES_MOBILES = ["c1", "c2", "c3", "c4", "c5"] as const;

export type CategorieMobile = (typeof CATEGORIES_MOBILES)[number];
export type TypeSignalement = "en_panne" | "autre";
export type StatutSignalement = "a_verifier" | "confirme" | "classe_sans_suite";

export const CATEGORIE_VERS_TYPE: Readonly<Record<CategorieMobile, TypeSignalement>> = {
  c1: "autre",
  c2: "autre",
  c3: "en_panne",
  c4: "autre",
  c5: "autre"
};

export const STATUTS_SIGNALEMENT: readonly StatutSignalement[] = [
  "a_verifier",
  "confirme",
  "classe_sans_suite"
];

export interface PositionSignalement {
  latitude: number;
  longitude: number;
}

export interface DonneesCreationSignalement {
  busId: string | null;
  trajetId: string | null;
  categorie: CategorieMobile | null;
  type: TypeSignalement;
  commentaire: string | null;
  observeLe: Date;
  cleIdempotence: string;
  position: PositionSignalement | null;
}

export interface Signalement {
  id: string;
  reference: string;
  auteurId: string;
  busId: string | null;
  trajetId: string | null;
  categorie: CategorieMobile | null;
  type: TypeSignalement;
  commentaire: string | null;
  statut: StatutSignalement;
  observeLe: string;
  recuLe: string;
  position: PositionSignalement | null;
  cleIdempotence: string;
  version: number;
  archiveLe: string | null;
  creeLe: string;
}

export interface SignalementAdmin {
  reference: string;
  bus: string;
  type: TypeSignalement;
  statut: StatutSignalement;
  recuLe: string;
  observeLe: string;
  commentaire: string | null;
  version: number;
}

export interface FiltresAdminSignalements {
  q: string | null;
  statut: StatutSignalement | null;
  page: number;
  limit: number;
}

export interface PageSignalements {
  elements: SignalementAdmin[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ResultatCreation {
  signalement: Signalement;
  cree: boolean;
}

export interface DepotSignalements {
  creer(signalement: Signalement): Promise<Signalement>;
  trouverParCleIdempotence(auteurId: string, cleIdempotence: string): Promise<Signalement | null>;
  listerParAuteur(auteurId: string): Promise<Signalement[]>;
  listerAdmin(filtres: FiltresAdminSignalements): Promise<PageSignalements>;
  mettreAJourStatut(reference: string, statut: StatutSignalement): Promise<SignalementAdmin | null>;
}
