import { InjectionToken, signal } from '@angular/core';
import type { Signal } from '@angular/core';

export interface CommunityUser {
  readonly id: string;
  readonly pseudo: string;
}

/**
 * Contrat à fournir par le module d'authentification de l'équipe.
 * Visiteur par défaut : aucune identité n'est inventée à partir d'un paramètre ou du stockage.
 * Les autorisations devront aussi être appliquées par la future API.
 */
export const COMMUNITY_SESSION = new InjectionToken<Signal<CommunityUser | null>>('COMMUNITY_SESSION', {
  providedIn: 'root',
  factory: () => signal<CommunityUser | null>(null).asReadonly(),
});
