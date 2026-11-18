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
import type { StaffMember, StaffRole, StaffStatus } from '../models/staff';
import { STAFF_ROLE_LABELS, STAFF_STATUS_LABELS, STAFF_STATUS_TONES } from '../models/staff';
import { StaffService } from '../services/staff.service';

@Component({
  selector: 'app-staff-page',
  imports: [DataTable, FormField, Icon, Modal, PageHeader, Pagination, ReactiveFormsModule],
  templateUrl: './staff-page.html',
  styleUrl: './staff-page.scss',
})
export class StaffPage {
  private readonly staff = inject(StaffService);
  private readonly csv = inject(CsvExportService);
  private readonly formBuilder = inject(FormBuilder);

  constructor() {
    this.staff.load();
  }

  protected readonly pageSize = 6;
  protected readonly statusTones = STAFF_STATUS_TONES;
  protected readonly columns: readonly TableColumn[] = [
    { key: 'name', label: 'Membre' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Rôle' },
    { key: 'status', label: 'État', type: 'status' },
  ];

  protected readonly search = signal('');
  protected readonly statusFilter = signal<StaffStatus | ''>('');
  protected readonly page = signal(1);

  protected readonly formOpen = signal(false);
  protected readonly editingMember = signal<StaffMember | null>(null);
  protected readonly deleteTarget = signal<StaffMember | null>(null);
  protected readonly formError = signal('');
  protected readonly feedback = signal('');

  protected readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    role: this.formBuilder.nonNullable.control<StaffRole>('operator'),
    status: this.formBuilder.nonNullable.control<StaffStatus>('invited'),
  });

  protected readonly filteredStaff = computed(() => {
    const search = this.search().trim().toLowerCase();
    const filter = this.statusFilter();

    return this.staff.all().filter((member) => {
      const matchesSearch =
        !search ||
        [member.name, member.email, STAFF_ROLE_LABELS[member.role]].some((value) =>
          value.toLowerCase().includes(search),
        );
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
        },
      }));
  });

  protected readonly formTitle = computed(() =>
    this.editingMember() ? 'Modifier · Personnel' : 'Ajouter · Personnel',
  );

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

  protected openCreate(): void {
    this.editingMember.set(null);
    this.formError.set('');
    this.form.reset({ name: '', email: '', role: 'operator', status: 'invited' });
    this.formOpen.set(true);
  }

  protected openEdit(row: TableRow): void {
    const member = this.staff.all().find((item) => item.id === row.id);

    if (!member) {
      return;
    }

    this.editingMember.set(member);
    this.formError.set('');
    this.form.setValue({
      name: member.name,
      email: member.email,
      role: member.role,
      status: member.status,
    });
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    this.formOpen.set(false);
    this.formError.set('');
    this.editingMember.set(null);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const editing = this.editingMember();
    const member: Omit<StaffMember, 'id'> = {
      name: this.form.controls.name.value,
      email: this.form.controls.email.value,
      role: this.form.controls.role.value,
      status: this.form.controls.status.value,
    };
    const operation = editing
      ? this.staff.update(editing.id, member)
      : this.staff.create(member);

    operation.subscribe({
      next: () => {
        this.closeForm();
        this.showFeedback(editing ? 'Membre modifié.' : 'Membre ajouté.');
      },
      error: (err) => this.formError.set(apiError(err)),
    });
  }

  protected askDelete(row: TableRow): void {
    const member = this.staff.all().find((item) => item.id === row.id);

    if (member) {
      this.deleteTarget.set(member);
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

    this.staff.delete(target.id).subscribe({
      next: () => {
        this.deleteTarget.set(null);
        this.showFeedback('Membre désactivé.');
      },
      error: (err) => this.showFeedback(apiError(err)),
    });
  }

  protected exportCsv(): void {
    this.csv.export(
      'kotbis-personnel.csv',
      ['Membre', 'Email', 'Rôle', 'État'],
      this.filteredStaff().map((member) => [
        member.name,
        member.email,
        STAFF_ROLE_LABELS[member.role],
        STAFF_STATUS_LABELS[member.status],
      ]),
    );
  }

  protected errorFor(name: 'name' | 'email', message: string): string {
    const control = this.form.controls[name];

    return control.touched && control.invalid ? message : '';
  }

  private showFeedback(message: string): void {
    this.feedback.set(message);
    window.setTimeout(() => this.feedback.set(''), 3000);
  }
}
