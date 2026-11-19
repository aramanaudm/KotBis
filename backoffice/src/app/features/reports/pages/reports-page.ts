import { Component, computed, inject, signal } from '@angular/core';
import { apiError } from '../../../core/services/api';
import { CsvExportService } from '../../../core/services/csv-export.service';
import { DataTable } from '../../../shared/components/data-table/data-table';
import type { TableColumn, TableRow } from '../../../shared/components/data-table/table.types';
import { FormField } from '../../../shared/components/form-field/form-field';
import { Icon } from '../../../shared/components/icon/icon';
import { Modal } from '../../../shared/components/modal/modal';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { Pagination } from '../../../shared/components/pagination/pagination';
import type { Report, ReportStatus } from '../models/report';
import { REPORT_STATUS_LABELS, REPORT_STATUS_TONES, REPORT_TYPE_LABELS } from '../models/report';
import { ReportsService } from '../services/reports.service';

@Component({
  selector: 'app-reports-page',
  imports: [DataTable, FormField, Icon, Modal, PageHeader, Pagination],
  templateUrl: './reports-page.html',
  styleUrl: './reports-page.scss',
})
export class ReportsPage {
  private readonly reports = inject(ReportsService);
  private readonly csv = inject(CsvExportService);

  constructor() {
    this.reports.load();
  }

  protected readonly pageSize = 6;
  protected readonly statusTones = REPORT_STATUS_TONES;
  protected readonly typeLabels = REPORT_TYPE_LABELS;
  protected readonly columns: readonly TableColumn[] = [
    { key: 'id', label: 'Référence' },
    { key: 'bus', label: 'Bus' },
    { key: 'type', label: 'Type' },
    { key: 'status', label: 'Statut', type: 'status' },
    { key: 'date', label: 'Date' },
  ];

  protected readonly search = signal('');
  protected readonly statusFilter = signal<ReportStatus | ''>('');
  protected readonly page = signal(1);

  protected readonly reviewTarget = signal<Report | null>(null);
  protected readonly reviewStatus = signal<ReportStatus>('pending');
  protected readonly feedback = signal('');

  protected readonly filteredReports = computed(() => this.reports.all());
  protected readonly total = this.reports.total;
  protected readonly pageCount = computed(() => Math.max(1, this.reports.pages()));

  protected readonly rows = computed<readonly TableRow[]>(() =>
    this.filteredReports().map((report) => ({
      id: report.id,
      values: {
        id: report.id,
        bus: report.bus,
        type: REPORT_TYPE_LABELS[report.type],
        status: REPORT_STATUS_LABELS[report.status],
        date: report.date,
      },
    })),
  );

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
    this.page.set(1);
    this.reload();
  }

  protected onFilter(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as ReportStatus | '');
    this.page.set(1);
    this.reload();
  }

  protected changePage(page: number): void {
    this.page.set(page);
    this.reload();
  }

  private reload(): void {
    this.reports.load({
      q: this.search(),
      statut: this.statusFilter(),
      page: this.page(),
      limit: this.pageSize,
    });
  }

  protected openReview(row: TableRow): void {
    const report = this.reports.all().find((item) => item.id === row.id);

    if (!report) {
      return;
    }

    this.reviewTarget.set(report);
    this.reviewStatus.set(report.status);
  }

  protected closeReview(): void {
    this.reviewTarget.set(null);
  }

  protected onReviewStatus(event: Event): void {
    this.reviewStatus.set((event.target as HTMLSelectElement).value as ReportStatus);
  }

  protected async saveReview(event: Event): Promise<void> {
    event.preventDefault();

    const report = this.reviewTarget();

    if (!report) {
      return;
    }

    try {
      await this.reports.update(report.id, this.reviewStatus());
      this.closeReview();
      this.showFeedback('Signalement mis à jour.');
    } catch (erreur) {
      this.showFeedback(apiError(erreur));
    }
  }

  protected async exportCsv(): Promise<void> {
    try {
      const rapports = await this.reports.listeComplete();
      this.csv.export(
        'kotbis-signalements.csv',
        ['Référence', 'Bus', 'Type', 'Statut', 'Date'],
        rapports.map((report) => [
          report.id,
          report.bus,
          REPORT_TYPE_LABELS[report.type],
          REPORT_STATUS_LABELS[report.status],
          report.date,
        ]),
      );
    } catch (erreur) {
      this.showFeedback(apiError(erreur));
    }
  }

  private showFeedback(message: string): void {
    this.feedback.set(message);
    window.setTimeout(() => this.feedback.set(''), 3000);
  }
}
