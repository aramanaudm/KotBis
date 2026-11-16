import { InjectionToken, inject } from '@angular/core';
import type { Signal } from '@angular/core';
import { Router } from '@angular/router';
import type { CanActivateFn } from '@angular/router';

export type StaffRole = 'administrateur' | 'operateur' | 'moderateur';

/**
 * Rôle du personnel connecté, à fournir par le module d'authentification de l'équipe.
 * Voyageur ou visiteur par défaut : null, donc accès refusé.
 * Ce contrôle ne masque que l'écran : l'API devra refuser elle-même (BF01, RG03).
 */
export const STAFF_ROLE = new InjectionToken<Signal<StaffRole | null>>('STAFF_ROLE', {
  providedIn: 'root',
  factory: () => (() => null) as Signal<StaffRole | null>,
});

/** Les trois rôles du personnel peuvent traiter un signalement (cahier des charges BO, § 2.1). */
const ROLES_AUTORISES: readonly StaffRole[] = ['administrateur', 'operateur', 'moderateur'];

export const staffGuard: CanActivateFn = () => {
  const role = inject(STAFF_ROLE)();
  return role !== null && ROLES_AUTORISES.includes(role) ? true : inject(Router).createUrlTree(['/home']);
};