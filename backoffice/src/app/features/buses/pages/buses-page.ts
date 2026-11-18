import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { apiError } from '../../../core/services/api';
import { CsvExportService } from '../../../core/services/csv-export.service';
import { DataTable } from '../../../shared/components/data-table/data-table';
import type { TableColumn, TableRow } from '../../../shared/components/data-table/table.types';
import { FormField } from '../../../shared/components/form-field/form-field';
import { Icon } from '../../../shared/components/icon/icon';
import { Modal } from '../../../shared/components/modal/modal';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { Pagination } from '../../../shared/components/pagination/pagination';
import type { Bus, BusStatus } from '../models/bus';
import { BUS_STATUS_LABELS, BUS_STATUS_TONES } from '../models/bus';
import { RoutesService } from '../../routes/services/routes.service';
import { BusesService } from '../services/buses.service';

@Component({
  selector: 'app-buses-page',
  imports: [DataTable, FormField, Icon, Modal, PageHeader, Pagination, ReactiveFormsModule],
  templateUrl: './buses-page.html',
  styleUrl: './buses-page.scss',
})
export class BusesPage {
  private readonly buses = inject(BusesService);
  private readonly routes = inject(RoutesService);
  private readonly csv = inject(CsvExportService);
  private readonly formBuilder = inject(FormBuilder);

  constructor() {
    this.buses.load();
    this.routes.load();
  }

  protected readonly pageSize = 6;
  protected readonly statusTones = BUS_STATUS_TONES;
  protected readonly columns: readonly TableColumn[] = [
    { key: 'plate', label: 'Plaque' },
    { key: 'line', label: 'Ligne' },
    { key: 'direction', label: 'Direction' },
    { key: 'status', label: 'État', type: 'status' },
  ];

  protected readonly search = signal('');
  protected readonly statusFilter = signal<BusStatus | ''>('');
  protected readonly page = signal(1);

  protected readonly formOpen = signal(false);
  protected readonly editingBus = signal<Bus | null>(null);
  protected readonly deleteTarget = signal<Bus | null>(null);
  protected readonly formError = signal('');
  protected readonly feedback = signal('');

  protected readonly form = this.formBuilder.nonNullable.group({
    plate: ['', [Validators.required, Validators.maxLength(25)]],
    trajetCode: [''],
    status: this.formBuilder.nonNullable.control<BusStatus>('active'),
  });

  protected readonly availableRoutes = this.routes.all;
  protected readonly selectedRoute = computed(() =>
    this.availableRoutes().find((route) => route.code === this.form.controls.trajetCode.value),
  );

  protected readonly filteredBuses = computed(() => {
    const search = this.search().trim().toLowerCase();
    const filter = this.statusFilter();

    return this.buses.all().filter((bus) => {
      const matchesSearch =
        !search ||
        [bus.plate, bus.line, bus.direction].some((value) => value.toLowerCase().includes(search));
      const matchesFilter = !filter || bus.status === filter;

      return matchesSearch && matchesFilter;
    });
  });

  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.filteredBuses().length / this.pageSize)),
  );

  protected readonly rows = computed<readonly TableRow[]>(() => {
    const page = Math.min(this.page(), this.pageCount());
    const start = (page - 1) * this.pageSize;

    return this.filteredBuses()
      .slice(start, start + this.pageSize)
      .map((bus) => ({
        id: bus.id,
        values: {
          plate: bus.plate,
          line: bus.line,
          direction: bus.direction,
          status: BUS_STATUS_LABELS[bus.status],
        },
      }));
  });

  protected readonly formTitle = computed(() =>
    this.editingBus() ? 'Modifier · Bus' : 'Ajouter · Bus',
  );

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
    this.page.set(1);
  }

  protected onFilter(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as BusStatus | '');
    this.page.set(1);
  }

  protected changePage(page: number): void {
    this.page.set(page);
  }

  protected openCreate(): void {
    this.editingBus.set(null);
    this.formError.set('');
    this.form.reset({ plate: '', trajetCode: '', status: 'active' });
    this.formOpen.set(true);
  }

  protected openEdit(row: TableRow): void {
    const bus = this.buses.all().find((item) => item.id === row.id);

    if (!bus) {
      return;
    }

    this.editingBus.set(bus);
    this.formError.set('');
    this.form.setValue({
      plate: bus.plate,
      trajetCode: bus.trajetCode ?? '',
      status: bus.status,
    });
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    this.formOpen.set(false);
    this.formError.set('');
    this.editingBus.set(null);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const route = this.selectedRoute();
    const bus: Omit<Bus, 'id'> = {
      plate: value.plate,
      line: route?.line ?? '—',
      direction: route?.direction ?? '—',
      status: value.status,
      trajetCode: value.trajetCode,
    };

    const editing = this.editingBus();
    const operation = editing
      ? this.buses.update(editing.id, bus)
      : this.buses.create(bus);

    operation.subscribe({
      next: () => {
        this.closeForm();
        this.showFeedback(editing ? 'Bus modifié.' : 'Bus créé.');
      },
      error: (err) => this.formError.set(apiError(err)),
    });
  }

  protected askDelete(row: TableRow): void {
    const bus = this.buses.all().find((item) => item.id === row.id);

    if (bus) {
      this.deleteTarget.set(bus);
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

    this.buses.delete(target.id).subscribe({
      next: () => {
        this.deleteTarget.set(null);
        this.showFeedback('Bus archivé.');
      },
      error: (err) => this.showFeedback(apiError(err)),
    });
  }

  protected exportCsv(): void {
    this.csv.export(
      'kotbis-bus.csv',
      ['Plaque', 'Ligne', 'Direction', 'État'],
      this.filteredBuses().map((bus) => [
        bus.plate,
        bus.line,
        bus.direction,
        BUS_STATUS_LABELS[bus.status],
      ]),
    );
  }

  protected errorFor(name: 'plate' | 'trajetCode', message: string): string {
    const control = this.form.controls[name];

    return control.touched && control.invalid ? message : '';
  }

  private showFeedback(message: string): void {
    this.feedback.set(message);
    window.setTimeout(() => this.feedback.set(''), 3000);
  }
}