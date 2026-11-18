import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LanguageService } from '../../../core/i18n/language.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { CsvExportService } from '../../../core/services/csv-export.service';
import { DataTable } from '../../../shared/components/data-table/data-table';
import type { TableColumn, TableRow } from '../../../shared/components/data-table/table.types';
import { Icon } from '../../../shared/components/icon/icon';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { BUS_STATUS_TONES } from '../../buses/models/bus';
import { NetworkMap } from '../components/network-map/network-map';
import { DashboardService } from '../services/dashboard.service';

@Component({
  selector: 'app-dashboard-page',
  imports: [DataTable, Icon, NetworkMap, PageHeader, RouterLink, TranslatePipe],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class DashboardPage {
  private readonly dashboard = inject(DashboardService);
  private readonly csv = inject(CsvExportService);
  private readonly i18n = inject(LanguageService);

  constructor() {
    this.dashboard.load();
  }

  protected readonly metrics = this.dashboard.metrics;
  protected readonly attention = this.dashboard.attention;
  protected readonly activeBusCount = this.dashboard.activeBusCount;
  protected readonly stopCount = this.dashboard.stopCount;
  protected readonly routeCount = this.dashboard.routeCount;
  protected readonly statusTones = BUS_STATUS_TONES;
  protected readonly fleetColumns: readonly TableColumn[] = [
    { key: 'plate', label: 'dashboard.column.plate' },
    { key: 'line', label: 'dashboard.column.line' },
    { key: 'direction', label: 'dashboard.column.direction' },
    { key: 'status', label: 'dashboard.column.status', type: 'status' },
  ];

  protected readonly fleetRows = computed<readonly TableRow[]>(() =>
    this.dashboard.fleet().map((bus) => ({
      id: bus.id,
      values: {
        plate: bus.plate,
        line: bus.line,
        direction: bus.direction,
        status: `status.bus.${bus.status}`,
      },
    })),
  );

  protected exportFleet(): void {
    this.csv.export(
      'kotbis-flotte.csv',
      [
        this.i18n.t('dashboard.column.plate'),
        this.i18n.t('dashboard.column.line'),
        this.i18n.t('dashboard.column.direction'),
        this.i18n.t('dashboard.column.status'),
      ],
      this.dashboard
        .fleet()
        .map((bus) => [
          bus.plate,
          bus.line,
          bus.direction,
          this.i18n.t(`status.bus.${bus.status}`),
        ]),
    );
  }
}
