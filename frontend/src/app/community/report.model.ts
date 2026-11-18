/**
 * Statuts de traitement d'un signalement (CDC Frontend § 1.2, BF-13, BF-14) :
 * « À vérifier », « Confirmé », « Rejeté », « Clôturé ».
 * Un nouveau signalement est toujours « À vérifier » ; seul le traitement
 * administratif (back-office) fait évoluer le statut.
 */
export type ReportStatus = 'A_VERIFIER' | 'CONFIRME' | 'REJETE' | 'CLOTURE';

export interface BusReport {
  readonly id: string;
  readonly busId: string;
  readonly busLine: string;
  readonly categoryId: string;
  readonly categoryLabel: string;
  readonly userId: string;
  readonly userName: string;
  readonly status: ReportStatus;
  readonly createdAt: string;
}

/** Libellé, explication et symbole de chaque statut : une couleur seule ne transmet jamais un statut (BF-27). */
export const REPORT_STATUS_DISPLAY: Readonly<
  Record<ReportStatus, { readonly label: string; readonly hint: string; readonly symbol: string }>
> = {
  A_VERIFIER: { label: 'À vérifier', hint: "En attente de vérification par l'équipe KotBis.", symbol: '⏳' },
  CONFIRME: { label: 'Confirmé', hint: "L'incident a été confirmé par l'équipe KotBis.", symbol: '✓' },
  REJETE: { label: 'Rejeté', hint: "Le signalement n'a pas été retenu après vérification.", symbol: '✕' },
  CLOTURE: { label: 'Clôturé', hint: 'Le traitement de ce signalement est terminé.', symbol: '■' },
};

/** Statut affiché tel quel s'il est connu, sinon « À vérifier » : un statut inconnu n'est jamais présenté comme confirmé. */
export function reportStatusDisplay(status: string): (typeof REPORT_STATUS_DISPLAY)[ReportStatus] {
  return REPORT_STATUS_DISPLAY[status as ReportStatus] ?? REPORT_STATUS_DISPLAY.A_VERIFIER;
}