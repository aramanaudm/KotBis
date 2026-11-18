import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CsvExportService } from '../../../core/services/csv-export.service';
import { DataTable } from '../../../shared/components/data-table/data-table';
import type { TableColumn, TableRow } from '../../../shared/components/data-table/table.types';
import { FormField } from '../../../shared/components/form-field/form-field';
import { Icon } from '../../../shared/components/icon/icon';
import { Modal } from '../../../shared/components/modal/modal';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { Pagination } from '../../../shared/components/pagination/pagination';
import type { StaffMember, StaffRole, StaffStatus } from '../models/staff';
import {
  STAFF_ROLES,
  STAFF_ROLE_LABELS,
  STAFF_STATUSES,
  STAFF_STATUS_LABELS,
  STAFF_STATUS_TONES,
} from '../models/staff';
import { StaffService } from '../services/staff.service';

@Component({
  selector: 'app-staff-page',
  imports: [DataTable, FormField, Icon, Modal, PageHeader, Pagination, ReactiveFormsModule],
  templateUrl: './staff-page.html',
  styleUrl: './staff-page.scss',
})
export class StaffPage implements OnInit {
  private readonly staff = inject(StaffService);
  private readonly csv = inject(CsvExportService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly dateFormatter = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  protected readonly pageSize = 6;
  protected readonly statusTones = STAFF_STATUS_TONES;
  protected readonly roles = STAFF_ROLES;
  protected readonly statuses = STAFF_STATUSES;
  protected readonly roleLabels = STAFF_ROLE_LABELS;
  protected readonly statusLabels = STAFF_STATUS_LABELS;
  protected readonly columns: readonly TableColumn[] = [
    { key: 'name', label: 'Membre' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Rôle' },
    { key: 'status', label: 'État', type: 'status' },
    { key: 'createdAt', label: 'Date de création' },
  ];

  protected readonly search = signal('');
  protected readonly statusFilter = signal<StaffStatus | ''>('');
  protected readonly page = signal(1);

  protected readonly formOpen = signal(false);
  protected readonly editingMember = signal<StaffMember | null>(null);
  protected readonly deleteTarget = signal<StaffMember | null>(null);
  protected readonly formError = signal('');
  protected readonly feedback = signal('');
  protected readonly saving = signal(false);

  protected readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    role: this.formBuilder.nonNullable.control<StaffRole>('operateur'),
    status: this.formBuilder.nonNullable.control<StaffStatus>('actif'),
    function: ['', [Validators.maxLength(100)]],
  });

  protected readonly filteredStaff = computed(() => {
    const search = this.search().trim().toLowerCase();
    const filter = this.statusFilter();

    return this.staff.all().filter((member) => {
      const matchesSearch =
        !search ||
        [
          member.name,
          member.email,
          member.function,
          STAFF_ROLE_LABELS[member.role],
          STAFF_STATUS_LABELS[member.status],
        ].some((value) => value.toLowerCase().includes(search));
      const matchesFilter = !filter || member.status === filter;

      return matchesSearch && matchesFilter;
    });
  });

  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.filteredStaff().length / this.pageSize)),
  );

  protected readonly rows = computed<readonly TableRow[]>(() => {
    const page = Math.min(this.page(), this.pageCount());
    const start = (page - 1) * this.pageSize;

    return this.filteredStaff()
      .slice(start, start + this.pageSize)
      .map((member) => ({
        id: member.id,
        values: {
          name: member.name,
          email: member.email,
          role: STAFF_ROLE_LABELS[member.role],
          status: STAFF_STATUS_LABELS[member.status],
          createdAt: this.formatDate(member.createdAt),
        },
      }));
  });

  protected readonly formTitle = computed(() =>
    this.editingMember() ? 'Modifier · Personnel' : 'Ajouter · Personnel',
  );

  ngOnInit(): void {
    void this.staff.load();
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
    this.page.set(1);
  }

  protected onFilter(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as StaffStatus | '');
    this.page.set(1);
  }

  protected changePage(page: number): void {
    this.page.set(page);
  }

  protected formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : this.dateFormatter.format(date);
  }

  protected openCreate(): void {
    this.editingMember.set(null);
    this.formError.set('');
    this.form.reset({ name: '', email: '', role: 'operateur', status: 'actif', function: '' });
    this.formOpen.set(true);
  }

  protected openEdit(row: TableRow): void {
    const member = this.staff.all().find((item) => item.id === row.id);
    if (!member) return;

    this.editingMember.set(member);
    this.formError.set('');
    this.form.setValue({
      name: member.name,
      email: member.email,
      role: member.role,
      status: member.status,
      function: member.function === '—' ? '' : member.function,
    });
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    this.formOpen.set(false);
    this.formError.set('');
    this.editingMember.set(null);
  }

  protected async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const editing = this.editingMember();
    const payload = this.form.getRawValue();
    this.saving.set(true);
    this.formError.set('');
    try {
      if (editing) {
        await this.staff.update(editing.id, payload);
      } else {
        await this.staff.create(payload);
      }
      this.closeForm();
      this.showFeedback(editing ? 'Membre mis à jour.' : 'Membre ajouté.');
    } catch (error) {
      this.formError.set(this.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected async toggleStatus(row: TableRow): Promise<void> {
    const member = this.staff.all().find((item) => item.id === row.id);
    if (!member) return;

    const next: StaffStatus = member.status === 'actif' ? 'inactif' : 'actif';
    try {
      await this.staff.setStatus(member.id, next);
      this.showFeedback(next === 'actif' ? 'Membre activé.' : 'Membre désactivé.');
    } catch (error) {
      this.showFeedback(this.errorMessage(error));
    }
  }

  protected askDelete(row: TableRow): void {
    const member = this.staff.all().find((item) => item.id === row.id);
    if (member) this.deleteTarget.set(member);
  }

  protected cancelDelete(): void {
    this.deleteTarget.set(null);
  }

  protected async confirmDelete(): Promise<void> {
    const target = this.deleteTarget();
    if (!target) return;

    try {
      await this.staff.remove(target.id);
      this.showFeedback('Membre supprimé.');
    } catch (error) {
      this.showFeedback(this.errorMessage(error));
    } finally {
      this.deleteTarget.set(null);
    }
  }

  protected exportCsv(): void {
    this.csv.export(
      'kotbis-personnel.csv',
      ['Membre', 'Email', 'Rôle', 'État', 'Date de création'],
      this.filteredStaff().map((member) => [
        member.name,
        member.email,
        STAFF_ROLE_LABELS[member.role],
        STAFF_STATUS_LABELS[member.status],
        this.formatDate(member.createdAt),
      ]),
    );
  }

  protected errorFor(name: 'name' | 'email', message: string): string {
    const control = this.form.controls[name];
    return control.touched && control.invalid ? message : '';
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Une erreur est survenue.';
  }

  private showFeedback(message: string): void {
    this.feedback.set(message);
    window.setTimeout(() => this.feedback.set(''), 3000);
  }
}
