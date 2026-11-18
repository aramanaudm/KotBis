import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { SessionService } from '../../../core/auth/session.service';
import { environment } from '../../../../environments/environment';
import {
  STAFF_ROLES,
  STAFF_STATUSES,
  type StaffMember,
  type StaffPayload,
  type StaffRole,
  type StaffStatus,
} from '../models/staff';

interface ApiStaffMember {
  readonly id: string | number;
  readonly email: string;
  readonly role: string;
  readonly etat: string;
  readonly nom_affiche: string;
  readonly fonction?: string | null;
  readonly cree_le?: string;
  readonly createdAt?: string;
}

const INITIAL_STAFF: readonly StaffMember[] = [
  {
    id: '2',
    name: 'Administrateur Test',
    email: 'admin.test@kotbis.fr',
    role: 'administrateur',
    status: 'actif',
    function: 'Administrateur',
    createdAt: '2026-11-17T22:36:00.954Z',
  },
];

@Injectable({ providedIn: 'root' })
export class StaffService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/$/, '');
  private readonly staff = signal<StaffMember[]>([...INITIAL_STAFF]);
  private readonly apiAvailable = signal(true);

  readonly all = this.staff.asReadonly();
  readonly total = computed(() => this.staff().length);
  readonly loading = signal(false);
  readonly error = signal('');

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const response = await firstValueFrom(
        this.http.get<ApiStaffMember[]>(`${this.baseUrl}/personnel`, { headers: this.headers() }),
      );
      this.staff.set(response.filter(this.isStaff).map(this.toMember));
      this.apiAvailable.set(true);
    } catch (error) {
      if (this.isUnavailable(error)) {
        this.apiAvailable.set(false);
        return;
      }
      this.error.set(this.message(error));
    } finally {
      this.loading.set(false);
    }
  }

  async create(payload: StaffPayload): Promise<StaffMember> {
    try {
      const response = await firstValueFrom(
        this.http.post<ApiStaffMember>(`${this.baseUrl}/personnel`, payload, {
          headers: this.headers(),
        }),
      );
      const member = this.toMember(response);
      this.staff.update((items) => [...items, member]);
      return member;
    } catch (error) {
      if (this.isUnavailable(error)) return this.createLocal(payload);
      throw this.toError(error);
    }
  }

  async update(id: string, payload: StaffPayload): Promise<StaffMember> {
    try {
      const response = await firstValueFrom(
        this.http.put<ApiStaffMember>(`${this.baseUrl}/personnel/${id}`, payload, {
          headers: this.headers(),
        }),
      );
      const member = this.toMember(response);
      this.staff.update((items) => items.map((item) => (item.id === id ? member : item)));
      return member;
    } catch (error) {
      if (this.isUnavailable(error)) return this.updateLocal(id, payload);
      throw this.toError(error);
    }
  }

  async setStatus(id: string, status: StaffStatus): Promise<StaffMember> {
    try {
      const response = await firstValueFrom(
        this.http.patch<ApiStaffMember>(
          `${this.baseUrl}/personnel/${id}/etat`,
          { etat: status },
          { headers: this.headers() },
        ),
      );
      const member = this.toMember(response);
      this.staff.update((items) => items.map((item) => (item.id === id ? member : item)));
      return member;
    } catch (error) {
      if (this.isUnavailable(error)) return this.updateLocal(id, { status });
      throw this.toError(error);
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.delete(`${this.baseUrl}/personnel/${id}`, { headers: this.headers() }),
      );
    } catch (error) {
      if (!this.isUnavailable(error)) throw this.toError(error);
    }
    this.staff.update((items) => items.filter((item) => item.id !== id));
  }

  private createLocal(payload: StaffPayload): StaffMember {
    const member: StaffMember = {
      ...payload,
      id: `local-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    this.apiAvailable.set(false);
    this.staff.update((items) => [...items, member]);
    return member;
  }

  private updateLocal(id: string, patch: Partial<StaffPayload>): StaffMember {
    const current = this.staff().find((item) => item.id === id);
    if (!current) throw new Error('Membre introuvable.');
    const member: StaffMember = { ...current, ...patch };
    this.apiAvailable.set(false);
    this.staff.update((items) => items.map((item) => (item.id === id ? member : item)));
    return member;
  }

  private readonly isStaff = (api: ApiStaffMember): boolean =>
    STAFF_ROLES.includes(api.role as StaffRole) && !!api.nom_affiche?.trim() && !!api.email?.trim();

  private readonly toMember = (api: ApiStaffMember): StaffMember => ({
    id: String(api.id),
    name: api.nom_affiche.trim(),
    email: api.email.trim().toLowerCase(),
    role: api.role as StaffRole,
    status: STAFF_STATUSES.includes(api.etat as StaffStatus)
      ? (api.etat as StaffStatus)
      : 'inactif',
    function: api.fonction?.trim() || '—',
    createdAt: api.cree_le ?? api.createdAt ?? new Date().toISOString(),
  });

  private headers(): HttpHeaders {
    const token = this.session.getToken();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  private isUnavailable(error: unknown): boolean {
    return error instanceof HttpErrorResponse && [0, 404, 405, 501].includes(error.status);
  }

  private message(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) return 'Impossible de charger le personnel.';
    const body = error.error as { erreur?: string; error?: string } | null;
    return body?.erreur ?? body?.error ?? 'Impossible de charger le personnel.';
  }

  private toError(error: unknown): Error {
    return new Error(this.message(error));
  }
}
