import type { StatusTone } from '../../../shared/models/status';

export type StaffRole = 'operator' | 'moderator' | 'admin';
export type StaffStatus = 'invited' | 'active' | 'inactive';

export interface StaffMember {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: StaffRole;
  readonly status: StaffStatus;
}

export const STAFF_ROLE_LABELS: Readonly<Record<StaffRole, string>> = {
  operator: 'Opérateur',
  moderator: 'Modérateur',
  admin: 'Administrateur',
};

export const STAFF_STATUS_LABELS: Readonly<Record<StaffStatus, string>> = {
  invited: 'Invité',
  active: 'Actif',
  inactive: 'Inactif',
};

export const STAFF_STATUS_TONES: Readonly<Record<string, StatusTone>> = {
  Invité: 'orange',
  Actif: 'green',
  Inactif: 'neutral',
};
