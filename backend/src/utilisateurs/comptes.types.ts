// Types des comptes, rôles et états.

export const ROLES_PERSONNEL = ["operateur", "moderateur", "administrateur"] as const;
export type RolePersonnel = (typeof ROLES_PERSONNEL)[number];
export type CodeRole = "voyageur" | RolePersonnel;
export const CODES_ROLES: readonly CodeRole[] = ["voyageur", ...ROLES_PERSONNEL];

export const ETATS_COMPTE = ["invite", "actif", "inactif"] as const;
export type EtatCompte = (typeof ETATS_COMPTE)[number];

// Compte attaché à la requête par le middleware d'authentification
export interface CompteAuthentifie {
  id: number;
  role: CodeRole;
  etat: EtatCompte;
}

// Compte tel que vu par l'administration
export interface CompteGere {
  id: number;
  email: string;
  nom: string | null;
  role: CodeRole;
  etat: EtatCompte;
  version: number;
}

declare global {
  namespace Express {
    interface Request {
      compte?: CompteAuthentifie;
      compteId?: number;
    }
  }
}
