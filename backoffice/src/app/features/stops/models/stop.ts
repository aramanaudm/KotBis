import type { StatusTone } from '../../../shared/models/status';

export type StopStatus = 'active' | 'inactive';

export interface Stop {
  readonly id: string;
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly status: StopStatus;
}

export const STOP_STATUS_LABELS: Readonly<Record<StopStatus, string>> = {
  active: 'Actif',
  inactive: 'Inactif',
};

export const STOP_STATUS_TONES: Readonly<Record<string, StatusTone>> = {
  'status.common.active': 'green',
  'status.common.inactive': 'neutral',
};
