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
import type { User, UserRole, UserStatus } from '../models/user';
import {
  USER_ROLES,
  USER_ROLE_LABELS,
  USER_STATUSES,
  USER_STATUS_LABELS,
  USER_STATUS_TONES,
} from '../models/user';
import { UsersService } from '../services/users.service';

@Component({
  selector: 'app-users-page',
  imports: [DataTable, FormField, Icon, Modal, PageHeader, Pagination, ReactiveFormsModule],
  templateUrl: './users-page.html',
  styleUrl: './users-page.scss',
})
export class UsersPage implements OnInit {
  private readonly users = inject(UsersService);
  private readonly csv = inject(CsvExportService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly dateFormatter = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  protected readonly pageSize = 6;
  protected readonly statusTones = USER_STATUS_TONES;
  protected readonly roles = USER_ROLES;
  protected readonly statuses = USER_STATUSES;
  protected readonly roleLabels = USER_ROLE_LABELS;
  protected readonly statusLabels = USER_STATUS_LABELS;
  protected readonly columns: readonly TableColumn[] = [
    { key: 'pseudo', label: 'Utilisateur', type: 'avatar' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Rôle' },
    { key: 'status', label: 'État', type: 'status' },
    { key: 'createdAt', label: 'Date de création' },
  ];

  protected readonly search = signal('');
  protected readonly statusFilter = signal<UserStatus | ''>('');
  protected readonly page = signal(1);

  protected readonly detailTarget = signal<User | null>(null);
  protected readonly formOpen = signal(false);
  protected readonly editingUser = signal<User | null>(null);
  protected readonly deleteTarget = signal<User | null>(null);
  protected readonly formError = signal('');
  protected readonly feedback = signal('');
  protected readonly saving = signal(false);

  protected readonly form = this.formBuilder.nonNullable.group({
    pseudo: ['', [Validators.required, Validators.maxLength(60)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    role: this.formBuilder.nonNullable.control<UserRole>('voyageur'),
    status: this.formBuilder.nonNullable.control<UserStatus>('actif'),
    city: ['', [Validators.maxLength(120)]],
  });

  protected readonly filteredUsers = computed(() => {
    const search = this.search().trim().toLowerCase();
    const filter = this.statusFilter();

    return this.users.all().filter((user) => {
      const matchesSearch =
        !search ||
        [
          user.pseudo,
          user.email,
          user.city,
          USER_ROLE_LABELS[user.role],
          USER_STATUS_LABELS[user.status],
        ].some((value) => value.toLowerCase().includes(search));
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
          createdAt: this.formatDate(user.createdAt),
        },
      }));
  });

  protected readonly formTitle = computed(() =>
    this.editingUser() ? 'Modifier · Utilisateur' : 'Ajouter · Utilisateur',
  );

  ngOnInit(): void {
    void this.users.load();
  }

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

  protected formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : this.dateFormatter.format(date);
  }

  protected openDetail(row: TableRow): void {
    const user = this.users.all().find((item) => item.id === row.id);
    if (user) this.detailTarget.set(user);
  }

  protected closeDetail(): void {
    this.detailTarget.set(null);
  }

  protected openCreate(): void {
    this.editingUser.set(null);
    this.formError.set('');
    this.form.reset({ pseudo: '', email: '', role: 'voyageur', status: 'actif', city: '' });
    this.formOpen.set(true);
  }

  protected openEdit(row: TableRow): void {
    const user = this.users.all().find((item) => item.id === row.id);
    if (!user) return;

    this.editingUser.set(user);
    this.formError.set('');
    this.form.setValue({
      pseudo: user.pseudo,
      email: user.email,
      role: user.role,
      status: user.status,
      city: user.city === '—' ? '' : user.city,
    });
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    this.formOpen.set(false);
    this.formError.set('');
    this.editingUser.set(null);
  }

  protected async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const editing = this.editingUser();
    const payload = this.form.getRawValue();
    this.saving.set(true);
    this.formError.set('');
    try {
      if (editing) {
        await this.users.update(editing.id, payload);
      } else {
        await this.users.create(payload);
      }
      this.closeForm();
      this.showFeedback(editing ? 'Utilisateur mis à jour.' : 'Utilisateur ajouté.');
    } catch (error) {
      this.formError.set(this.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected async toggleStatus(row: TableRow): Promise<void> {
    const user = this.users.all().find((item) => item.id === row.id);
    if (!user) return;

    const next: UserStatus = user.status === 'actif' ? 'inactif' : 'actif';
    try {
      await this.users.setStatus(user.id, next);
      this.showFeedback(next === 'actif' ? 'Utilisateur activé.' : 'Utilisateur désactivé.');
    } catch (error) {
      this.showFeedback(this.errorMessage(error));
    }
  }

  protected askDelete(row: TableRow): void {
    const user = this.users.all().find((item) => item.id === row.id);
    if (user) this.deleteTarget.set(user);
  }

  protected cancelDelete(): void {
    this.deleteTarget.set(null);
  }

  protected async confirmDelete(): Promise<void> {
    const target = this.deleteTarget();
    if (!target) return;

    try {
      await this.users.remove(target.id);
      this.showFeedback('Utilisateur supprimé.');
    } catch (error) {
      this.showFeedback(this.errorMessage(error));
    } finally {
      this.deleteTarget.set(null);
    }
  }

  protected exportCsv(): void {
    this.csv.export(
      'kotbis-utilisateurs.csv',
      ['Utilisateur', 'Email', 'Rôle', 'État', 'Date de création'],
      this.filteredUsers().map((user) => [
        user.pseudo,
        user.email,
        USER_ROLE_LABELS[user.role],
        USER_STATUS_LABELS[user.status],
        this.formatDate(user.createdAt),
      ]),
    );
  }

  protected errorFor(name: 'pseudo' | 'email', message: string): string {
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
