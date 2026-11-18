import type { StatusTone } from '../../../shared/models/status';

export type TransitRouteStatus = 'active' | 'inactive';

export interface TransitRoute {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly line: string;
  readonly direction: string;
  readonly stops: readonly string[];
  readonly status: TransitRouteStatus;
}

export const ROUTE_STATUS_LABELS: Readonly<Record<TransitRouteStatus, string>> = {
  active: 'Actif',
  inactive: 'Inactif',
};

export const ROUTE_STATUS_TONES: Readonly<Record<string, StatusTone>> = {
  Actif: 'green',
  Inactif: 'neutral',
};
