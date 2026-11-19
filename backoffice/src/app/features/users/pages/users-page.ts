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
import type { User, UserRole, UserStatus } from '../models/user';
import { USER_ROLE_LABELS, USER_STATUS_LABELS, USER_STATUS_TONES } from '../models/user';
import { UsersService } from '../services/users.service';

@Component({
  selector: 'app-users-page',
  imports: [DataTable, FormField, Icon, Modal, PageHeader, Pagination, ReactiveFormsModule],
  templateUrl: './users-page.html',
  styleUrl: './users-page.scss',
})
export class UsersPage {
  private readonly users = inject(UsersService);
  private readonly csv = inject(CsvExportService);
  private readonly formBuilder = inject(FormBuilder);

  constructor() {
    this.users.load();
  }

  protected readonly pageSize = 6;
  protected readonly statusTones = USER_STATUS_TONES;
  protected readonly columns: readonly TableColumn[] = [
    { key: 'pseudo', label: 'Utilisateur' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Rôle' },
    { key: 'status', label: 'État', type: 'status' },
  ];

  protected readonly search = signal('');
  protected readonly statusFilter = signal<UserStatus | ''>('');
  protected readonly page = signal(1);

  protected readonly formOpen = signal(false);
  protected readonly editingUser = signal<User | null>(null);
  protected readonly deleteTarget = signal<User | null>(null);
  protected readonly formError = signal('');
  protected readonly feedback = signal('');

  protected readonly form = this.formBuilder.nonNullable.group({
    pseudo: ['', [Validators.required, Validators.maxLength(60)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    role: this.formBuilder.nonNullable.control<UserRole>('traveller'),
    status: this.formBuilder.nonNullable.control<UserStatus>('active'),
  });

  protected readonly filteredUsers = computed(() => {
    const search = this.search().trim().toLowerCase();
    const filter = this.statusFilter();

    return this.users.all().filter((user) => {
      const matchesSearch =
        !search ||
        [user.pseudo, user.email, USER_ROLE_LABELS[user.role]].some((value) =>
          value.toLowerCase().includes(search),
        );
      const matchesFilter = !filter || user.status === filter;

      return matchesSearch && matchesFilter;
    });
  });

  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.filteredUsers().length / this.pageSize)),
  );

  protected readonly rows = computed<readonly TableRow[]>(() => {
    const page = Math.min(this.page(), this.pageCount());
    const start = (page - 1) * this.pageSize;

    return this.filteredUsers()
      .slice(start, start + this.pageSize)
      .map((user) => ({
        id: user.id,
        values: {
          pseudo: user.pseudo,
          email: user.email,
          role: USER_ROLE_LABELS[user.role],
          status: USER_STATUS_LABELS[user.status],
        },
      }));
  });

  protected readonly formTitle = computed(() =>
    this.editingUser() ? 'Modifier · Utilisateur' : 'Ajouter · Utilisateur',
  );

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
    this.page.set(1);
  }

  protected onFilter(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as UserStatus | '');
    this.page.set(1);
  }

  protected changePage(page: number): void {
    this.page.set(page);
  }

  protected openCreate(): void {
    this.editingUser.set(null);
    this.formError.set('');
    this.form.reset({ pseudo: '', email: '', role: 'traveller', status: 'active' });
    this.formOpen.set(true);
  }

  protected openEdit(row: TableRow): void {
    const user = this.users.all().find((item) => item.id === row.id);

    if (!user) {
      return;
    }

    this.editingUser.set(user);
    this.formError.set('');
    this.form.setValue({
      pseudo: user.pseudo,
      email: user.email,
      role: user.role,
      status: user.status,
    });
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    this.formOpen.set(false);
    this.formError.set('');
    this.editingUser.set(null);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const editing = this.editingUser();
    const user: Omit<User, 'id'> = {
      pseudo: this.form.controls.pseudo.value,
      email: this.form.controls.email.value,
      role: this.form.controls.role.value,
      status: this.form.controls.status.value,
      points: editing?.points ?? 0,
    };
    const operation = editing ? this.users.update(editing.id, user) : this.users.create(user);

    operation.subscribe({
      next: () => {
        this.closeForm();
        this.showFeedback(editing ? 'Utilisateur modifié.' : 'Utilisateur créé.');
      },
      error: (err) => this.formError.set(apiError(err)),
    });
  }

  protected askDelete(row: TableRow): void {
    const user = this.users.all().find((item) => item.id === row.id);

    if (user) {
      this.deleteTarget.set(user);
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

    this.users.delete(target.id).subscribe({
      next: () => {
        this.deleteTarget.set(null);
        this.showFeedback('Compte désactivé.');
      },
      error: (err) => this.showFeedback(apiError(err)),
    });
  }

  protected exportCsv(): void {
    this.csv.export(
      'kotbis-utilisateurs.csv',
      ['Utilisateur', 'Email', 'Rôle', 'État'],
      this.filteredUsers().map((user) => [
        user.pseudo,
        user.email,
        USER_ROLE_LABELS[user.role],
        USER_STATUS_LABELS[user.status],
      ]),
    );
  }

  protected errorFor(name: 'pseudo' | 'email', message: string): string {
    const control = this.form.controls[name];

    return control.touched && control.invalid ? message : '';
  }

  private showFeedback(message: string): void {
    this.feedback.set(message);
    window.setTimeout(() => this.feedback.set(''), 3000);
  }
}
