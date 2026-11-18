import type { StatusTone } from '../../../shared/models/status';

export type StaffRole = 'operateur' | 'moderateur' | 'administrateur';
export type StaffStatus = 'actif' | 'inactif' | 'invite';

export interface StaffMember {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: StaffRole;
  readonly status: StaffStatus;
  readonly function: string;
  readonly createdAt: string;
}

export interface StaffPayload {
  readonly name: string;
  readonly email: string;
  readonly role: StaffRole;
  readonly status: StaffStatus;
  readonly function: string;
}

export const STAFF_ROLE_LABELS: Readonly<Record<StaffRole, string>> = {
  operateur: 'Opérateur',
  moderateur: 'Modérateur',
  administrateur: 'Administrateur',
};

export const STAFF_STATUS_LABELS: Readonly<Record<StaffStatus, string>> = {
  actif: 'Actif',
  inactif: 'Inactif',
  invite: 'Invité',
};

export const STAFF_STATUS_TONES: Readonly<Record<string, StatusTone>> = {
  Actif: 'green',
  Inactif: 'neutral',
  Invité: 'orange',
};

export const STAFF_ROLES: readonly StaffRole[] = ['operateur', 'moderateur', 'administrateur'];
export const STAFF_STATUSES: readonly StaffStatus[] = ['actif', 'inactif', 'invite'];
