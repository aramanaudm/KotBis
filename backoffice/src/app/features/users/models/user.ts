import type { StatusTone } from '../../../shared/models/status';

export type UserRole = 'voyageur' | 'operateur' | 'moderateur' | 'administrateur';
export type UserStatus = 'actif' | 'inactif' | 'invite';

export interface User {
  readonly id: string;
  readonly pseudo: string;
  readonly email: string;
  readonly role: UserRole;
  readonly status: UserStatus;
  readonly city: string;
  readonly avatarRef: string | null;
  readonly createdAt: string;
  readonly points: number;
}

export interface UserPayload {
  readonly pseudo: string;
  readonly email: string;
  readonly role: UserRole;
  readonly status: UserStatus;
  readonly city: string;
}

export const USER_ROLE_LABELS: Readonly<Record<UserRole, string>> = {
  voyageur: 'Voyageur',
  operateur: 'Opérateur',
  moderateur: 'Modérateur',
  administrateur: 'Administrateur',
};

export const USER_STATUS_LABELS: Readonly<Record<UserStatus, string>> = {
  actif: 'Actif',
  inactif: 'Inactif',
  invite: 'Invité',
};

export const USER_STATUS_TONES: Readonly<Record<string, StatusTone>> = {
  Actif: 'green',
  Inactif: 'neutral',
  Invité: 'orange',
};

export const USER_ROLES: readonly UserRole[] = [
  'voyageur',
  'operateur',
  'moderateur',
  'administrateur',
];
export const USER_STATUSES: readonly UserStatus[] = ['actif', 'inactif', 'invite'];
