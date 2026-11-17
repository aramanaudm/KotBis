import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CsvExportService } from '../../../core/services/csv-export.service';
import { DataTable } from '../../../shared/components/data-table/data-table';
import type { TableColumn, TableRow } from '../../../shared/components/data-table/table.types';
import { FormField } from '../../../shared/components/form-field/form-field';
import { Icon } from '../../../shared/components/icon/icon';
import { Modal } from '../../../shared/components/modal/modal';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { Pagination } from '../../../shared/components/pagination/pagination';
import { StopsService } from '../../stops/services/stops.service';
import type { TransitRoute, TransitRouteStatus } from '../models/route';
import { ROUTE_STATUS_LABELS, ROUTE_STATUS_TONES } from '../models/route';
import { RoutesService } from '../services/routes.service';

@Component({
  selector: 'app-routes-page',
  imports: [DataTable, FormField, Icon, Modal, PageHeader, Pagination, ReactiveFormsModule],
  templateUrl: './routes-page.html',
  styleUrl: './routes-page.scss',
})
export class RoutesPage {
  private readonly routes = inject(RoutesService);
  private readonly stops = inject(StopsService);
  private readonly csv = inject(CsvExportService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly pageSize = 6;
  protected readonly statusTones = ROUTE_STATUS_TONES;
  protected readonly columns: readonly TableColumn[] = [
    { key: 'name', label: 'Trajet' },
    { key: 'line', label: 'Ligne' },
    { key: 'stops', label: 'Arrêts' },
    { key: 'status', label: 'État', type: 'status' },
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
          stops: `${route.stops.length} arrêt(s)`,
          status: ROUTE_STATUS_LABELS[route.status],
        },
      }));
  });

  protected readonly formTitle = computed(() =>
    this.editingRoute() ? 'Modifier · Trajet' : 'Ajouter · Trajet',
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
      this.formError.set('Sélectionnez un arrêt à ajouter.');
      return;
    }

    if (this.routeStops().includes(name)) {
      this.formError.set('Cet arrêt est déjà présent dans le trajet.');
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
      this.formError.set('Ajoutez au moins un départ et un terminus.');
      return;
    }

    this.closeForm();
    this.showFeedback('Aperçu du template — action à connecter à l’API.');
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
    if (!this.deleteTarget()) {
      return;
    }

    this.deleteTarget.set(null);
    this.showFeedback('Aperçu du template — action à connecter à l’API.');
  }

  protected exportCsv(): void {
    this.csv.export(
      'kotbis-trajets.csv',
      ['Trajet', 'Ligne', 'Arrêts', 'État'],
      this.filteredRoutes().map((route) => [
        route.name,
        route.line,
        route.stops.join(' → '),
        ROUTE_STATUS_LABELS[route.status],
      ]),
    );
  }

  protected errorFor(name: 'name' | 'line', message: string): string {
    const control = this.form.controls[name];

    return control.touched && control.invalid ? message : '';
  }

  private showFeedback(message: string): void {
    this.feedback.set(message);
    window.setTimeout(() => this.feedback.set(''), 3000);
  }
}
