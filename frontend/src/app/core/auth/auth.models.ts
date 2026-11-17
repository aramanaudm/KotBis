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

/** Compte tel que stocké localement (inclut le secret haché : ne jamais l'exposer à l'UI). */
export interface StoredAccount {
  id: string;
  pseudo: string;
  email: string;
  /** Facultatif à l'inscription (« Ville ou zone »). */
  city?: string;
  /** Facultatif à l'inscription (« Téléphone »). */
  phone?: string;
  salt: string;
  passwordHash: string;
  createdAt: string;
  counters: AccountCounters;
}

/** Vue publique d'un compte, sans aucun secret : seul type utilisable par les composants. */
export type PublicAccount = Omit<StoredAccount, 'salt' | 'passwordHash'>;

export interface RegisterPayload {
  pseudo: string;
  email: string;
  password: string;
  city?: string;
  phone?: string;
}

export type AuthErrorCode =
  | 'PSEUDO_TAKEN'
  | 'EMAIL_TAKEN'
  | 'INVALID_CREDENTIALS'
  | 'INVALID_RESET_CODE'
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
