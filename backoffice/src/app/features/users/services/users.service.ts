import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { SessionService } from '../../../core/auth/session.service';
import { environment } from '../../../../environments/environment';
import {
  USER_ROLES,
  USER_STATUSES,
  type User,
  type UserPayload,
  type UserRole,
  type UserStatus,
} from '../models/user';

interface ApiUser {
  readonly id: string | number;
  readonly email: string;
  readonly role: string;
  readonly etat: string;
  readonly pseudo: string;
  readonly zone_libre?: string | null;
  readonly avatar_ref?: string | null;
  readonly cree_le?: string;
  readonly createdAt?: string;
  readonly points?: number | string | null;
}

const INITIAL_USERS: readonly User[] = [
  {
    id: '1',
    pseudo: 'voyageur_test',
    email: 'voyageur.test@kotbis.fr',
    role: 'voyageur',
    status: 'actif',
    city: 'Paris',
    avatarRef: null,
    createdAt: '2026-11-17T22:36:00.954Z',
    points: 0,
  },
  {
    id: '3',
    pseudo: 'clemy',
    email: 'clemy@gmail.com',
    role: 'voyageur',
    status: 'actif',
    city: 'Quatre Bornes',
    avatarRef: null,
    createdAt: '2026-11-18T07:43:01.722Z',
    points: 0,
  },
  {
    id: '4',
    pseudo: 'clemyb',
    email: 'clemyb@gmail.com',
    role: 'voyageur',
    status: 'actif',
    city: 'rose hill',
    avatarRef: null,
    createdAt: '2026-11-18T09:58:37.700Z',
    points: 0,
  },
];

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/$/, '');
  private readonly users = signal<User[]>([...INITIAL_USERS]);
  private readonly apiAvailable = signal(true);

  readonly all = this.users.asReadonly();
  readonly total = computed(() => this.users().length);
  readonly loading = signal(false);
  readonly error = signal('');

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const response = await firstValueFrom(
        this.http.get<ApiUser[]>(`${this.baseUrl}/voyageurs`, { headers: this.headers() }),
      );
      this.users.set(response.filter(this.isUser).map(this.toUser));
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

  async create(payload: UserPayload): Promise<User> {
    try {
      const response = await firstValueFrom(
        this.http.post<ApiUser>(`${this.baseUrl}/voyageurs`, payload, { headers: this.headers() }),
      );
      const user = this.toUser(response);
      this.users.update((items) => [...items, user]);
      return user;
    } catch (error) {
      if (this.isUnavailable(error)) return this.createLocal(payload);
      throw this.toError(error);
    }
  }

  async update(id: string, payload: UserPayload): Promise<User> {
    try {
      const response = await firstValueFrom(
        this.http.put<ApiUser>(`${this.baseUrl}/voyageurs/${id}`, payload, {
          headers: this.headers(),
        }),
      );
      const user = this.toUser(response);
      this.users.update((items) => items.map((item) => (item.id === id ? user : item)));
      return user;
    } catch (error) {
      if (this.isUnavailable(error)) return this.updateLocal(id, payload);
      throw this.toError(error);
    }
  }

  async setStatus(id: string, status: UserStatus): Promise<User> {
    try {
      const response = await firstValueFrom(
        this.http.patch<ApiUser>(
          `${this.baseUrl}/voyageurs/${id}/etat`,
          { etat: status },
          { headers: this.headers() },
        ),
      );
      const user = this.toUser(response);
      this.users.update((items) => items.map((item) => (item.id === id ? user : item)));
      return user;
    } catch (error) {
      if (this.isUnavailable(error)) return this.updateLocal(id, { status });
      throw this.toError(error);
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.delete(`${this.baseUrl}/voyageurs/${id}`, { headers: this.headers() }),
      );
    } catch (error) {
      if (!this.isUnavailable(error)) throw this.toError(error);
    }
    this.users.update((items) => items.filter((item) => item.id !== id));
  }

  private createLocal(payload: UserPayload): User {
    const user: User = {
      ...payload,
      id: `local-${Date.now()}`,
      avatarRef: null,
      createdAt: new Date().toISOString(),
      points: 0,
    };
    this.apiAvailable.set(false);
    this.users.update((items) => [...items, user]);
    return user;
  }

  private updateLocal(id: string, patch: Partial<UserPayload>): User {
    const current = this.users().find((item) => item.id === id);
    if (!current) throw new Error('Utilisateur introuvable.');
    const user: User = { ...current, ...patch };
    this.apiAvailable.set(false);
    this.users.update((items) => items.map((item) => (item.id === id ? user : item)));
    return user;
  }

  private readonly isUser = (api: ApiUser): boolean =>
    USER_ROLES.includes(api.role as UserRole) && !!api.pseudo?.trim() && !!api.email?.trim();

  private readonly toUser = (api: ApiUser): User => ({
    id: String(api.id),
    pseudo: api.pseudo.trim(),
    email: api.email.trim().toLowerCase(),
    role: api.role as UserRole,
    status: USER_STATUSES.includes(api.etat as UserStatus) ? (api.etat as UserStatus) : 'inactif',
    city: api.zone_libre?.trim() || '—',
    avatarRef: api.avatar_ref ?? null,
    createdAt: api.cree_le ?? api.createdAt ?? new Date().toISOString(),
    points: Number(api.points ?? 0),
  });

  private headers(): HttpHeaders {
    const token = this.session.getToken();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  private isUnavailable(error: unknown): boolean {
    return error instanceof HttpErrorResponse && [0, 404, 405, 501].includes(error.status);
  }

  private message(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) return 'Impossible de charger les utilisateurs.';
    const body = error.error as { erreur?: string; error?: string } | null;
    return body?.erreur ?? body?.error ?? 'Impossible de charger les utilisateurs.';
  }

  private toError(error: unknown): Error {
    return new Error(this.message(error));
  }
}
