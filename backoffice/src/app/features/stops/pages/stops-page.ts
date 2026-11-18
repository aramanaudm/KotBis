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
import type { Stop, StopStatus } from '../models/stop';
import { STOP_STATUS_TONES } from '../models/stop';
import { StopsService } from '../services/stops.service';

@Component({
  selector: 'app-stops-page',
  imports: [
    DataTable,
    FormField,
    Icon,
    Modal,
    PageHeader,
    Pagination,
    ReactiveFormsModule,
    TranslatePipe,
  ],
  templateUrl: './stops-page.html',
  styleUrl: './stops-page.scss',
})
export class StopsPage {
  private readonly stops = inject(StopsService);
  private readonly csv = inject(CsvExportService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly i18n = inject(LanguageService);

  constructor() {
    this.stops.load();
  }

  protected readonly pageSize = 6;
  protected readonly statusTones = STOP_STATUS_TONES;
  protected readonly columns: readonly TableColumn[] = [
    { key: 'name', label: 'stops.column.name' },
    { key: 'latitude', label: 'stops.column.latitude' },
    { key: 'longitude', label: 'stops.column.longitude' },
    { key: 'status', label: 'stops.column.status', type: 'status' },
  ];

  protected readonly search = signal('');
  protected readonly statusFilter = signal<StopStatus | ''>('');
  protected readonly page = signal(1);

  protected readonly formOpen = signal(false);
  protected readonly editingStop = signal<Stop | null>(null);
  protected readonly deleteTarget = signal<Stop | null>(null);
  protected readonly formError = signal('');
  protected readonly feedback = signal('');

  protected readonly form = this.formBuilder.group({
    name: this.formBuilder.nonNullable.control('', [
      Validators.required,
      Validators.maxLength(150),
    ]),
    latitude: this.formBuilder.control<number | null>(null, [
      Validators.required,
      Validators.min(-90),
      Validators.max(90),
    ]),
    longitude: this.formBuilder.control<number | null>(null, [
      Validators.required,
      Validators.min(-180),
      Validators.max(180),
    ]),
    status: this.formBuilder.nonNullable.control<StopStatus>('active'),
  });

  protected readonly filteredStops = computed(() => {
    const search = this.search().trim().toLowerCase();
    const filter = this.statusFilter();

    return this.stops.all().filter((stop) => {
      const matchesSearch =
        !search ||
        [stop.name, stop.latitude.toString(), stop.longitude.toString()].some((value) =>
          value.toLowerCase().includes(search),
        );
      const matchesFilter = !filter || stop.status === filter;

      return matchesSearch && matchesFilter;
    });
  });

  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.filteredStops().length / this.pageSize)),
  );

  protected readonly rows = computed<readonly TableRow[]>(() => {
    const page = Math.min(this.page(), this.pageCount());
    const start = (page - 1) * this.pageSize;

    return this.filteredStops()
      .slice(start, start + this.pageSize)
      .map((stop) => ({
        id: stop.id,
        values: {
          name: stop.name,
          latitude: stop.latitude.toFixed(4),
          longitude: stop.longitude.toFixed(4),
          status: `status.common.${stop.status}`,
        },
      }));
  });

  protected readonly formTitle = computed(() =>
    this.editingStop() ? 'stops.form.edit' : 'stops.form.create',
  );

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
    this.page.set(1);
  }

  protected onFilter(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as StopStatus | '');
    this.page.set(1);
  }

  protected changePage(page: number): void {
    this.page.set(page);
  }

  protected openCreate(): void {
    this.editingStop.set(null);
    this.formError.set('');
    this.form.reset({ name: '', latitude: null, longitude: null, status: 'active' });
    this.formOpen.set(true);
  }

  protected openEdit(row: TableRow): void {
    const stop = this.stops.all().find((item) => item.id === row.id);

    if (!stop) {
      return;
    }

    this.editingStop.set(stop);
    this.formError.set('');
    this.form.setValue({
      name: stop.name,
      latitude: stop.latitude,
      longitude: stop.longitude,
      status: stop.status,
    });
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    this.formOpen.set(false);
    this.formError.set('');
    this.editingStop.set(null);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const editing = this.editingStop();
    const stop: Omit<Stop, 'id'> = {
      name: this.form.controls.name.value,
      latitude: this.form.controls.latitude.value ?? 0,
      longitude: this.form.controls.longitude.value ?? 0,
      status: this.form.controls.status.value,
    };
    const operation = editing
      ? this.stops.update(editing.id, stop)
      : this.stops.create(stop);

    operation.subscribe({
      next: () => {
        this.closeForm();
        this.showFeedback(editing ? 'stops.feedback.updated' : 'stops.feedback.created');
      },
      error: (err) => this.formError.set(apiError(err)),
    });
  }

  protected askDelete(row: TableRow): void {
    const stop = this.stops.all().find((item) => item.id === row.id);

    if (stop) {
      this.deleteTarget.set(stop);
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

    this.stops.delete(target.id).subscribe({
      next: () => {
        this.deleteTarget.set(null);
        this.showFeedback('stops.feedback.deleted');
      },
      error: (err) => this.showFeedback(apiError(err)),
    });
  }

  protected exportCsv(): void {
    this.csv.export(
      'kotbis-arrets.csv',
      [
        this.i18n.t('stops.column.name'),
        this.i18n.t('stops.column.latitude'),
        this.i18n.t('stops.column.longitude'),
        this.i18n.t('stops.column.status'),
      ],
      this.filteredStops().map((stop) => [
        stop.name,
        stop.latitude.toFixed(4),
        stop.longitude.toFixed(4),
        this.i18n.t(`status.common.${stop.status}`),
      ]),
    );
  }

  protected nameError(): string {
    const control = this.form.controls.name;

    return control.touched && control.invalid ? 'stops.error.name' : '';
  }

  protected latitudeError(): string {
    const control = this.form.controls.latitude;

    return control.touched && control.invalid ? 'stops.error.latitude' : '';
  }

  protected longitudeError(): string {
    const control = this.form.controls.longitude;

    return control.touched && control.invalid ? 'stops.error.longitude' : '';
  }

  private showFeedback(key: string): void {
    this.feedback.set(this.i18n.t(key));
    window.setTimeout(() => this.feedback.set(''), 3000);
  }
}
