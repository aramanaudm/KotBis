// Matrice des droits.
import type { CodeRole } from "../utilisateurs/comptes.types";

export type Permission =
  | "administration.acceder"
  | "comptes.consulter"
  | "comptes.suspendre"
  | "personnel.gerer"
  | "roles.modifier"
  | "audit.consulter"
  // Pour les tickets suivants (réseau, signalements, avis)
  | "reseau.gerer"
  | "signalements.traiter"
  | "avis.moderer";

const MATRICE: Readonly<Record<CodeRole, readonly Permission[]>> = {
  voyageur: [], // CA-011 : aucun accès administratif
  operateur: ["administration.acceder", "reseau.gerer", "signalements.traiter"],
  moderateur: ["administration.acceder", "signalements.traiter", "avis.moderer"],
  administrateur: [
    "administration.acceder",
    "comptes.consulter",
    "comptes.suspendre",
    "personnel.gerer",
    "roles.modifier",
    "audit.consulter",
    "reseau.gerer",
    "signalements.traiter",
    "avis.moderer"
  ]
};

export function possedePermission(role: CodeRole, permission: Permission): boolean {
  return MATRICE[role]?.includes(permission) ?? false;
}
