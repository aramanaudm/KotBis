import type { StatusTone } from '../../../shared/models/status';

export type BusStatus = 'active' | 'inactive' | 'breakdown';

export interface Bus {
  readonly id: string;
  readonly plate: string;
  readonly line: string;
  readonly direction: string;
  readonly status: BusStatus;
}

export const BUS_STATUS_LABELS: Readonly<Record<BusStatus, string>> = {
  active: 'Actif',
  inactive: 'Inactif',
  breakdown: 'En panne',
};

export const BUS_STATUS_TONES: Readonly<Record<string, StatusTone>> = {
  Actif: 'green',
  Inactif: 'neutral',
  'En panne': 'red',
};
