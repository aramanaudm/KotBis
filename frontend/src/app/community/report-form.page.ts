import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { COMMUNITY_BUSES } from './community-buses';
import { CommunityDialogComponent } from './community-dialog.component';
import { COMMUNITY_SESSION } from './community-session';
import { REPORT_CATEGORIES } from './report-categories';
import type { BusReport } from './report.model';
import { ReportService } from './report.service';

@Component({
  selector: 'app-report-form',
  imports: [CommunityDialogComponent, ReactiveFormsModule, RouterLink],
  templateUrl: './report-form.page.html',
})
export class ReportFormPage {
  readonly user = inject(COMMUNITY_SESSION);
  readonly buses = COMMUNITY_BUSES;
  readonly categories = REPORT_CATEGORIES;
  readonly busy = signal(false);
  readonly error = signal('');
  readonly receipt = signal<BusReport | null>(null);
  private readonly reports = inject(ReportService);
  readonly form = inject(FormBuilder).nonNullable.group({
    busId: ['', Validators.required],
    categoryId: ['', Validators.required],
  });

  async submit(): Promise<void> {
    if (this.busy() || this.receipt()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.busy.set(true);
    this.error.set('');
    try {
      this.receipt.set(await this.reports.createReport(this.form.getRawValue()));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : "Le signalement n'a pas abouti. Réessayez.");
    } finally {
      this.busy.set(false);
    }
  }

  startAgain(): void {
    this.form.reset();
    this.receipt.set(null);
    this.error.set('');
  }
}
