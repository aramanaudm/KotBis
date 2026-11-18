import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CommunityDialogComponent } from './community-dialog.component';
import { COMMUNITY_SESSION } from './community-session';
import { reportStatusDisplay } from './report.model';
import { ReportService } from './report.service';

/** SCRUM-67 [BUS-FE-052] — Suivi des signalements du compte et de leur statut (BF-13, AC-36). */
@Component({
  selector: 'app-report-list',
  imports: [CommunityDialogComponent, DatePipe, RouterLink],
  templateUrl: './report-list.page.html',
})
export class ReportListPage {
  readonly user = inject(COMMUNITY_SESSION);
  readonly reports = inject(ReportService).myReports;
  readonly status = reportStatusDisplay;
}