import { Component, computed, inject, signal } from '@angular/core';
import { LanguageService } from '../../../core/i18n/language.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { apiError } from '../../../core/services/api';
import { CsvExportService } from '../../../core/services/csv-export.service';
import { DataTable } from '../../../shared/components/data-table/data-table';
import type { TableColumn, TableRow } from '../../../shared/components/data-table/table.types';
import { FormField } from '../../../shared/components/form-field/form-field';
import { Icon } from '../../../shared/components/icon/icon';
import { Modal } from '../../../shared/components/modal/modal';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { Pagination } from '../../../shared/components/pagination/pagination';
import type { Report, ReportStatus, ReportType } from '../models/report';
import { REPORT_STATUS_TONES } from '../models/report';
import { ReportsService } from '../services/reports.service';

@Component({
  selector: 'app-reports-page',
  imports: [DataTable, FormField, Icon, Modal, PageHeader, Pagination, TranslatePipe],
  templateUrl: './reports-page.html',
  styleUrl: './reports-page.scss',
})
export class ReportsPage {
  private readonly reports = inject(ReportsService);
  private readonly csv = inject(CsvExportService);
  private readonly i18n = inject(LanguageService);

  constructor() {
    this.reports.load();
  }

  protected readonly pageSize = 6;
  protected readonly statusTones = REPORT_STATUS_TONES;
  protected readonly columns: readonly TableColumn[] = [
    { key: 'id', label: 'reports.column.reference' },
    { key: 'bus', label: 'reports.column.bus' },
    { key: 'type', label: 'reports.column.type' },
    { key: 'status', label: 'reports.column.status', type: 'status' },
    { key: 'date', label: 'reports.column.date' },
  ];

  protected readonly search = signal('');
  protected readonly statusFilter = signal<ReportStatus | ''>('');
  protected readonly page = signal(1);

  protected readonly reviewTarget = signal<Report | null>(null);
  protected readonly reviewStatus = signal<ReportStatus>('pending');
  protected readonly feedback = signal('');

  protected readonly filteredReports = computed(() => {
    const search = this.search().trim().toLowerCase();
    const filter = this.statusFilter();

    return this.reports.all().filter((report) => {
      const matchesSearch =
        !search ||
        [
          report.id,
          report.bus,
          this.i18n.t(this.typeKey(report.type)),
          report.comment,
          report.date,
        ].some((value) => value.toLowerCase().includes(search));
      const matchesFilter = !filter || report.status === filter;

      return matchesSearch && matchesFilter;
    });
  });

  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.filteredReports().length / this.pageSize)),
  );

  protected readonly rows = computed<readonly TableRow[]>(() => {
    const page = Math.min(this.page(), this.pageCount());
    const start = (page - 1) * this.pageSize;

    return this.filteredReports()
      .slice(start, start + this.pageSize)
      .map((report) => ({
        id: report.id,
        values: {
          id: report.id,
          bus: report.bus,
          type: this.i18n.t(this.typeKey(report.type)),
          status: `status.report.${report.status}`,
          date: report.date,
        },
      }));
  });

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
    this.page.set(1);
  }

  protected onFilter(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as ReportStatus | '');
    this.page.set(1);
  }

  protected changePage(page: number): void {
    this.page.set(page);
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

  protected saveReview(event: Event): void {
    event.preventDefault();

    const report = this.reviewTarget();

    if (!report) {
      return;
    }

    const statut = this.reviewStatus();
    this.reports.update(report.id, statut).subscribe({
      next: () => {
        this.closeReview();
        this.showFeedback('reports.feedback.updated');
      },
      error: (err) => this.showFeedback(apiError(err)),
    });
  }

  protected exportCsv(): void {
    this.csv.export(
      'kotbis-signalements.csv',
      [
        this.i18n.t('reports.column.reference'),
        this.i18n.t('reports.column.bus'),
        this.i18n.t('reports.column.type'),
        this.i18n.t('reports.column.status'),
        this.i18n.t('reports.column.date'),
      ],
      this.filteredReports().map((report) => [
        report.id,
        report.bus,
        this.i18n.t(this.typeKey(report.type)),
        this.i18n.t(`status.report.${report.status}`),
        report.date,
      ]),
    );
  }

  protected typeKey(type: ReportType): string {
    return `reportType.${type}`;
  }

  private showFeedback(key: string): void {
    this.feedback.set(this.i18n.t(key));
    window.setTimeout(() => this.feedback.set(''), 3000);
  }
}
