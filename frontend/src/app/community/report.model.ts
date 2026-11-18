export type ReportStatus = 'A_VERIFIER' | 'CONFIRME' | 'CLASSE_SANS_SUITE';

/** Limite du commentaire facultatif, espaces compris. */
export const REPORT_COMMENT_MAX_LENGTH = 600;

export interface BusReport {
  readonly id: string;
  readonly busId: string;
  readonly busLine: string;
  readonly categoryId: string;
  readonly categoryLabel: string;
  readonly comment: string;
  readonly userId: string;
  readonly userName: string;
  readonly status: ReportStatus;
  readonly createdAt: string;
}
