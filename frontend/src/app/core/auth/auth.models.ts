/** Compteurs affichés sur « Mon espace » (BUS-FE-035). Propres à chaque compte. */
export interface AccountCounters {
  favoris: number;
  alertes: number;
  signalements: number;
  avis: number;
  points: number;
}

export const EMPTY_COUNTERS: Readonly<AccountCounters> = {
  favoris: 0,
  alertes: 0,
  signalements: 0,
  avis: 0,
  points: 0,
};

/**
 * Compte connecté tel qu'affiché par l'application. Les comptes sont créés et vérifiés par l'API
 * (PostgreSQL) : aucun mot de passe ni empreinte n'existe côté application.
 */
export interface PublicAccount {
  id: string;
  pseudo: string;
  email: string;
  /** Facultatif à l'inscription (« Ville ou zone »). */
  city?: string;
  /** Facultatif à l'inscription (« Téléphone »). */
  phone?: string;
  createdAt: string;
  counters: AccountCounters;
}

export interface RegisterPayload {
  pseudo: string;
  email: string;
  password: string;
  /** Acceptation explicite des conditions d'utilisation (exigée par l'API). */
  acceptTerms: boolean;
  city?: string;
  phone?: string;
}

/** Profil renvoyé par l'API (`ProfilUtilisateur` côté backend). */
export interface ApiUserProfile {
  compteId: string;
  identifiantPublic: string;
  email: string;
  role: string;
  pseudo: string | null;
  avatarRef: string | null;
  zoneLibre: string | null;
  telephone: string | null;
  creeLe: string;
}

/** Session conservée sur l'appareil : jeton opaque et profil public, jamais de mot de passe. */
export interface StoredSession {
  token: string;
  expiresAt: string;
  user: PublicAccount;
}

export type AuthErrorCode =
  | 'PSEUDO_TAKEN'
  | 'EMAIL_TAKEN'
  | 'INVALID_CREDENTIALS'
  | 'INVALID_RESET_CODE'
  | 'INVALID_DATA'
  | 'TOO_MANY_ATTEMPTS'
  | 'NETWORK'
  | 'UNAVAILABLE'
  | 'UNKNOWN';

export class AuthError extends Error {
  constructor(
    readonly code: AuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
