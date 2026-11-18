import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LanguageService } from '../../../core/i18n/language.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { CsvExportService } from '../../../core/services/csv-export.service';
import { DataTable } from '../../../shared/components/data-table/data-table';
import type { TableColumn, TableRow } from '../../../shared/components/data-table/table.types';
import { FormField } from '../../../shared/components/form-field/form-field';
import { Icon } from '../../../shared/components/icon/icon';
import { Modal } from '../../../shared/components/modal/modal';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { Pagination } from '../../../shared/components/pagination/pagination';
import { apiError } from '../../../core/services/api';
import { StopsService } from '../../stops/services/stops.service';
import type { TransitRoute, TransitRouteStatus } from '../models/route';
import { ROUTE_STATUS_TONES } from '../models/route';
import { RoutesService } from '../services/routes.service';

@Component({
  selector: 'app-routes-page',
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
  templateUrl: './routes-page.html',
  styleUrl: './routes-page.scss',
})
export class RoutesPage {
  private readonly routes = inject(RoutesService);
  private readonly stops = inject(StopsService);
  private readonly csv = inject(CsvExportService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly i18n = inject(LanguageService);

  constructor() {
    this.stops.load();
    this.routes.load();
  }

  protected readonly pageSize = 6;
  protected readonly statusTones = ROUTE_STATUS_TONES;
  protected readonly columns: readonly TableColumn[] = [
    { key: 'name', label: 'routes.column.name' },
    { key: 'line', label: 'routes.column.line' },
    { key: 'stops', label: 'routes.column.stops' },
    { key: 'status', label: 'routes.column.status', type: 'status' },
  ];

  protected readonly search = signal('');
  protected readonly statusFilter = signal<TransitRouteStatus | ''>('');
  protected readonly page = signal(1);

  protected readonly formOpen = signal(false);
  protected readonly editingRoute = signal<TransitRoute | null>(null);
  protected readonly deleteTarget = signal<TransitRoute | null>(null);
  protected readonly formError = signal('');
  protected readonly feedback = signal('');

  protected readonly routeStops = signal<readonly string[]>([]);
  protected readonly selectedStop = signal('');

  protected readonly availableStops = computed(() => this.stops.active());

  protected readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(180)]],
    line: ['', [Validators.required, Validators.maxLength(20)]],
    status: this.formBuilder.nonNullable.control<TransitRouteStatus>('active'),
  });

  protected readonly filteredRoutes = computed(() => {
    const search = this.search().trim().toLowerCase();
    const filter = this.statusFilter();

    return this.routes.all().filter((route) => {
      const matchesSearch =
        !search ||
        [route.name, route.line, route.stops.join(' ')].some((value) =>
          value.toLowerCase().includes(search),
        );
      const matchesFilter = !filter || route.status === filter;

      return matchesSearch && matchesFilter;
    });
  });

  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.filteredRoutes().length / this.pageSize)),
  );

  protected readonly rows = computed<readonly TableRow[]>(() => {
    const page = Math.min(this.page(), this.pageCount());
    const start = (page - 1) * this.pageSize;

    return this.filteredRoutes()
      .slice(start, start + this.pageSize)
      .map((route) => ({
        id: route.id,
        values: {
          name: route.name,
          line: route.line,
          stops: this.i18n.t('routes.stops.count', { count: route.stops.length }),
          status: `status.common.${route.status}`,
        },
      }));
  });

  protected readonly formTitle = computed(() =>
    this.editingRoute() ? 'routes.form.edit' : 'routes.form.create',
  );

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
    this.page.set(1);
  }

  protected onFilter(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as TransitRouteStatus | '');
    this.page.set(1);
  }

  protected changePage(page: number): void {
    this.page.set(page);
  }

  protected openCreate(): void {
    this.editingRoute.set(null);
    this.formError.set('');
    this.form.reset({ name: '', line: '', status: 'active' });
    this.routeStops.set([]);
    this.selectedStop.set(this.availableStops()[0]?.name ?? '');
    this.formOpen.set(true);
  }

  protected openEdit(row: TableRow): void {
    const route = this.routes.all().find((item) => item.id === row.id);

    if (!route) {
      return;
    }

    this.editingRoute.set(route);
    this.formError.set('');
    this.form.setValue({
      name: route.name,
      line: route.line,
      status: route.status,
    });
    this.routeStops.set([...route.stops]);
    this.selectedStop.set(this.availableStops()[0]?.name ?? '');
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    this.formOpen.set(false);
    this.formError.set('');
    this.editingRoute.set(null);
    this.routeStops.set([]);
  }

  protected onStopSelection(event: Event): void {
    this.selectedStop.set((event.target as HTMLSelectElement).value);
  }

  protected addStop(): void {
    const name = this.selectedStop();

    if (!name) {
      this.formError.set('routes.error.selectStop');
      return;
    }

    if (this.routeStops().includes(name)) {
      this.formError.set('routes.error.duplicateStop');
      return;
    }

    this.routeStops.update((stops) => [...stops, name]);
    this.formError.set('');
  }

  protected moveStop(index: number, direction: -1 | 1): void {
    const stops = [...this.routeStops()];
    const target = index + direction;

    if (target < 0 || target >= stops.length) {
      return;
    }

    [stops[index], stops[target]] = [stops[target], stops[index]];
    this.routeStops.set(stops);
  }

  protected removeStop(index: number): void {
    this.routeStops.update((stops) => stops.filter((_, position) => position !== index));
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.routeStops().length < 2) {
      this.formError.set('routes.error.minStops');
      return;
    }

    const editing = this.editingRoute();
    const route: Omit<TransitRoute, 'id'> = {
      code: editing?.code ?? '',
      name: this.form.controls.name.value,
      line: this.form.controls.line.value,
      direction: editing?.direction ?? 'aller',
      stops: this.routeStops(),
      status: this.form.controls.status.value,
    };
    const stopIds = route.stops
      .map((name) => this.stops.all().find((stop) => stop.name === name)?.id)
      .filter((id): id is string => Boolean(id));
    const operation = editing
      ? this.routes.update(editing.id, route, stopIds)
      : this.routes.create(route, stopIds);

    operation.subscribe({
      next: () => {
        this.closeForm();
        this.showFeedback(editing ? 'routes.feedback.updated' : 'routes.feedback.created');
      },
      error: (err) => this.formError.set(apiError(err)),
    });
  }

  protected askDelete(row: TableRow): void {
    const route = this.routes.all().find((item) => item.id === row.id);

    if (route) {
      this.deleteTarget.set(route);
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

    this.routes.delete(target.id).subscribe({
      next: () => {
        this.deleteTarget.set(null);
        this.showFeedback('routes.feedback.deleted');
      },
      error: (err) => this.showFeedback(apiError(err)),
    });
  }

  protected exportCsv(): void {
    this.csv.export(
      'kotbis-trajets.csv',
      [
        this.i18n.t('routes.column.name'),
        this.i18n.t('routes.column.line'),
        this.i18n.t('routes.column.stops'),
        this.i18n.t('routes.column.status'),
      ],
      this.filteredRoutes().map((route) => [
        route.name,
        route.line,
        route.stops.join(' → '),
        this.i18n.t(`status.common.${route.status}`),
      ]),
    );
  }

  protected errorFor(name: 'name' | 'line', key: string): string {
    const control = this.form.controls[name];

    return control.touched && control.invalid ? key : '';
  }

  private showFeedback(key: string): void {
    this.feedback.set(this.i18n.t(key));
    window.setTimeout(() => this.feedback.set(''), 3000);
  }
}
