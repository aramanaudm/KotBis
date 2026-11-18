import type { StatusTone } from '../../../shared/models/status';

export type ZoneStatus = 'active' | 'inactive';
export type ZonePoint = readonly [number, number];

export interface Zone {
  readonly id: string;
  readonly name: string;
  readonly vertices: readonly ZonePoint[];
  readonly status: ZoneStatus;
}

export const ZONE_STATUS_LABELS: Readonly<Record<ZoneStatus, string>> = {
  active: 'Actif',
  inactive: 'Inactif',
};

export const ZONE_STATUS_TONES: Readonly<Record<string, StatusTone>> = {
  'status.common.active': 'green',
  'status.common.inactive': 'neutral',
};
