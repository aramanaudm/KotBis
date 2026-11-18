import type { StatusTone } from '../../../shared/models/status';

export type UserRole = 'traveller' | 'operator' | 'moderator' | 'admin';
export type UserStatus = 'invited' | 'active' | 'inactive';

export interface User {
  readonly id: string;
  readonly pseudo: string;
  readonly email: string;
  readonly role: UserRole;
  readonly status: UserStatus;
  readonly points: number;
}

export const USER_ROLE_LABELS: Readonly<Record<UserRole, string>> = {
  traveller: 'Voyageur',
  operator: 'Opérateur',
  moderator: 'Modérateur',
  admin: 'Administrateur',
};

export const USER_STATUS_LABELS: Readonly<Record<UserStatus, string>> = {
  invited: 'Invité',
  active: 'Actif',
  inactive: 'Inactif',
};

export const USER_STATUS_TONES: Readonly<Record<string, StatusTone>> = {
  Invité: 'orange',
  Actif: 'green',
  Inactif: 'neutral',
};
