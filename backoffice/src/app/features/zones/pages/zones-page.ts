import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { ZoneMap } from '../components/zone-map/zone-map';
import type { Zone, ZonePoint, ZoneStatus } from '../models/zone';
import { ZONE_STATUS_TONES } from '../models/zone';
import { ZonesService } from '../services/zones.service';

@Component({
  selector: 'app-zones-page',
  imports: [
    DataTable,
    FormField,
    Icon,
    Modal,
    PageHeader,
    Pagination,
    ReactiveFormsModule,
    TranslatePipe,
    ZoneMap,
  ],
  templateUrl: './zones-page.html',
  styleUrl: './zones-page.scss',
})
export class ZonesPage {
  private readonly zones = inject(ZonesService);
  private readonly csv = inject(CsvExportService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly i18n = inject(LanguageService);

  constructor() {
    this.zones.load();
  }

  protected readonly pageSize = 6;
  protected readonly statusTones = ZONE_STATUS_TONES;
  protected readonly columns: readonly TableColumn[] = [
    { key: 'name', label: 'zones.column.name' },
    { key: 'vertices', label: 'zones.column.vertices' },
    { key: 'status', label: 'zones.column.status', type: 'status' },
  ];

  protected readonly search = signal('');
  protected readonly statusFilter = signal<ZoneStatus | ''>('');
  protected readonly page = signal(1);

  protected readonly formOpen = signal(false);
  protected readonly editingZone = signal<Zone | null>(null);
  protected readonly deleteTarget = signal<Zone | null>(null);
  protected readonly formError = signal('');
  protected readonly feedback = signal('');

  protected readonly vertices = signal<readonly ZonePoint[]>([]);
  protected readonly activeZones = this.zones.active;

  protected readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    status: this.formBuilder.nonNullable.control<ZoneStatus>('inactive'),
  });

  protected readonly filteredZones = computed(() => {
    const search = this.search().trim().toLowerCase();
    const filter = this.statusFilter();

    return this.zones.all().filter((zone) => {
      const matchesSearch = !search || zone.name.toLowerCase().includes(search);
      const matchesFilter = !filter || zone.status === filter;

      return matchesSearch && matchesFilter;
    });
  });

  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.filteredZones().length / this.pageSize)),
  );

  protected readonly rows = computed<readonly TableRow[]>(() => {
    const page = Math.min(this.page(), this.pageCount());
    const start = (page - 1) * this.pageSize;

    return this.filteredZones()
      .slice(start, start + this.pageSize)
      .map((zone) => ({
        id: zone.id,
        values: {
          name: zone.name,
          vertices: this.i18n.t('zones.vertices.count', { count: zone.vertices.length }),
          status: `status.common.${zone.status}`,
        },
      }));
  });

  protected readonly formTitle = computed(() =>
    this.editingZone() ? 'zones.form.edit' : 'zones.form.create',
  );

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
    this.page.set(1);
  }

  protected onFilter(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as ZoneStatus | '');
    this.page.set(1);
  }

  protected changePage(page: number): void {
    this.page.set(page);
  }

  protected openCreate(): void {
    this.editingZone.set(null);
    this.formError.set('');
    this.form.reset({ name: '', status: 'inactive' });
    this.vertices.set([]);
    this.formOpen.set(true);
  }

  protected openEdit(row: TableRow): void {
    const zone = this.zones.all().find((item) => item.id === row.id);

    if (!zone) {
      return;
    }

    this.editingZone.set(zone);
    this.formError.set('');
    this.form.setValue({
      name: zone.name,
      status: zone.status,
    });
    this.vertices.set(zone.vertices.map(([x, y]) => [x, y] as const));
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    this.formOpen.set(false);
    this.formError.set('');
    this.editingZone.set(null);
    this.vertices.set([]);
  }

  protected setVertices(vertices: readonly ZonePoint[]): void {
    this.vertices.set(vertices);
    this.formError.set('');
  }

  protected undoVertex(): void {
    this.vertices.update((vertices) => vertices.slice(0, -1));
  }

  protected clearVertices(): void {
    this.vertices.set([]);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const name = this.form.controls.name.value.trim();

    if (!name) {
      this.formError.set('zones.error.name');
      return;
    }

    if (this.vertices().length < 3) {
      this.formError.set('zones.error.vertices');
      return;
    }

    const editing = this.editingZone();
    const zone: Omit<Zone, 'id'> = {
      name,
      vertices: this.vertices(),
      status: this.form.controls.status.value,
    };
    const operation = editing ? this.zones.update(editing.id, zone) : this.zones.create(zone);

    operation.subscribe({
      next: () => {
        this.closeForm();
        this.showFeedback(editing ? 'zones.feedback.updated' : 'zones.feedback.created');
      },
      error: (err) => this.formError.set(apiError(err)),
    });
  }

  protected askDelete(row: TableRow): void {
    const zone = this.zones.all().find((item) => item.id === row.id);

    if (zone) {
      this.deleteTarget.set(zone);
    }
  }

  protected cancelDelete(): void {
    this.deleteTarget.set(null);
  }

  protected confirmDelete(): void {
    const target = this.deleteTarget();
    if (!target) {
      return;
    }

    this.zones.delete(target.id).subscribe({
      next: () => {
        this.deleteTarget.set(null);
        this.showFeedback('zones.feedback.deleted');
      },
      error: (err) => this.showFeedback(apiError(err)),
    });
  }

  protected exportCsv(): void {
    this.csv.export(
      'kotbis-zones.csv',
      [
        this.i18n.t('zones.column.name'),
        this.i18n.t('zones.column.vertices'),
        this.i18n.t('zones.column.status'),
      ],
      this.filteredZones().map((zone) => [
        zone.name,
        String(zone.vertices.length),
        this.i18n.t(`status.common.${zone.status}`),
      ]),
    );
  }

  protected nameError(): string {
    const control = this.form.controls.name;

    return control.touched && control.invalid ? 'zones.error.name' : '';
  }

  private showFeedback(key: string): void {
    this.feedback.set(this.i18n.t(key));
    window.setTimeout(() => this.feedback.set(''), 3000);
  }
}
