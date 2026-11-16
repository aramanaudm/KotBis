import { DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular';

import { COMMUNITY_SESSION } from './community-session';
import { describeReportStatus } from './report-status';
import { ReportService } from './report.service';

@Component({
  selector: 'app-report-list',
  templateUrl: './report-list.page.html',
  styleUrl: './report-list.page.scss',
  imports: [DatePipe, IonContent, RouterLink],
})
export class ReportListPage {
  readonly user = inject(COMMUNITY_SESSION);
  private readonly service = inject(ReportService);

  /** Uniquement les signalements du compte connecté : aucune donnée d'un autre compte. */
  readonly rows = computed(() => {
    const user = this.user();
    if (!user) return [];
    return this.service
      .reports()
      .filter((report) => report.userId === user.id)
      .map((report) => ({ report, status: describeReportStatus(report.status) }));
  });
}