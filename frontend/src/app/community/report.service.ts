import { Injectable, signal } from '@angular/core';
import { REPORT_COMMENT_MAX_LENGTH } from './report.model';
import type { BusReport } from './report.model';

/**
 * Lecture des signalements en mémoire, en attente de l'API signalements.
 * À remplacer par le service complet de BUS-FE-049 (création) et par le dépôt HTTP de l'équipe.
 */
@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly items = signal<readonly BusReport[]>([]);
  readonly reports = this.items.asReadonly();
}