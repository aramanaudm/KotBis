import type { StatusTone } from '../../../shared/models/status';

export type ReportType = 'breakdown' | 'other';
export type ReportStatus = 'pending' | 'confirmed' | 'dismissed';

export interface Report {
  readonly id: string;
  readonly bus: string;
  readonly type: ReportType;
  readonly comment: string;
  readonly status: ReportStatus;
  readonly date: string;
}

export const REPORT_TYPE_LABELS: Readonly<Record<ReportType, string>> = {
  breakdown: 'En panne',
  other: 'Autre',
};

export const REPORT_STATUS_LABELS: Readonly<Record<ReportStatus, string>> = {
  pending: 'À vérifier',
  confirmed: 'Confirmé',
  dismissed: 'Classé sans suite',
};

export const REPORT_STATUS_TONES: Readonly<Record<string, StatusTone>> = {
  'À vérifier': 'orange',
  Confirmé: 'green',
  'Classé sans suite': 'neutral',
};
