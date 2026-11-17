// Interfaces d'accès aux comptes
import type { CodeRole, CompteAuthentifie, CompteGere, EtatCompte, RolePersonnel } from "./comptes.types";

export interface EntreeAudit {
  acteurId: number;
  action: string;
  tableCible: string;
  cleCible: string;
  avant: unknown;
  apres: unknown;
  requeteId: string;
}

export interface FiltresComptes {
  page: number;
  limite: number;
  role?: CodeRole;
  etat?: EtatCompte;
  personnelSeulement?: boolean;
}

export interface PageComptes {
  elements: CompteGere[];
  total: number;
}

export interface LecteurCompte {
  trouverCompteAuthentifie(id: number): Promise<CompteAuthentifie | null>;
}

export interface TransactionComptes {
  // Verrou de gouvernance : sérialise les opérations sensibles sur les comptes
  verrouillerGouvernance(): Promise<void>;
  trouverPourMiseAJour(id: number): Promise<CompteGere | null>;
  compterAdministrateursActifs(): Promise<number>;
  // Retourne null si la version a changé entre-temps
  modifierEtat(id: number, etat: EtatCompte, versionAttendue: number): Promise<CompteGere | null>;
  modifierRole(id: number, role: RolePersonnel, versionAttendue: number): Promise<CompteGere | null>;
  revoquerSessions(compteId: number): Promise<void>;
  ecrireAudit(entree: EntreeAudit): Promise<void>;
}

export interface DepotComptes extends LecteurCompte {
  lister(filtres: FiltresComptes): Promise<PageComptes>;
  // Tout ou rien : une exception annule l'ensemble (y compris l'audit)
  enTransaction<T>(travail: (tx: TransactionComptes) => Promise<T>): Promise<T>;
}
