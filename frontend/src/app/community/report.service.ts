import { inject, Injectable, signal } from '@angular/core';

import { COMMUNITY_BUSES } from './community-buses';
import { COMMUNITY_SESSION } from './community-session';
import { REPORT_CATEGORIES } from './report-categories';
import type { BusReport } from './report.model';

/** Enregistrement en mémoire uniquement, en attente de l'API signalements. */
@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly user = inject(COMMUNITY_SESSION);
  private readonly items = signal<readonly BusReport[]>([]);
  readonly reports = this.items.asReadonly();

  async createReport(draft: { busId: string; categoryId: string }): Promise<BusReport> {
    const user = this.user();
    if (!user) throw new Error('Vous devez être connecté pour signaler un bus.');
    const bus = COMMUNITY_BUSES.find((item) => item.id === draft.busId);
    if (!bus) throw new Error('Sélectionnez un bus valide.');
    const category = REPORT_CATEGORIES.find((item) => item.id === draft.categoryId);
    if (!category) throw new Error('Choisissez une catégorie de signalement valide.');
    const report: BusReport = {
      id: crypto.randomUUID(),
      busId: bus.id,
      busLine: bus.line,
      categoryId: category.id,
      categoryLabel: category.label,
      userId: user.id,
      userName: user.pseudo,
      status: 'A_VERIFIER',
      createdAt: new Date().toISOString(),
    };
    this.items.update((items) => [report, ...items]);
    return report;
  }
}
