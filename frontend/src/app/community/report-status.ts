/** Statuts d'un signalement : À vérifier, Confirmé, Classé sans suite (cahier des charges BO, BF-ADM-09). */
export type ReportStatusTone = 'pending' | 'confirmed' | 'dismissed' | 'unknown';

export interface ReportStatusView {
  readonly label: string;
  /** Symbole décoratif : le statut ne repose jamais sur la couleur seule. */
  readonly symbol: string;
  readonly tone: ReportStatusTone;
}

const STATUSES = new Map<string, ReportStatusView>([
  ['A_VERIFIER', { label: 'À vérifier', symbol: '○', tone: 'pending' }],
  ['CONFIRME', { label: 'Confirmé', symbol: '✓', tone: 'confirmed' }],
  ['CLASSE_SANS_SUITE', { label: 'Classé sans suite', symbol: '–', tone: 'dismissed' }],
]);

const UNAVAILABLE: ReportStatusView = { label: 'Statut indisponible', symbol: '?', tone: 'unknown' };

export function describeReportStatus(status: string | null | undefined): ReportStatusView {
  return (status ? STATUSES.get(status) : undefined) ?? UNAVAILABLE;
}