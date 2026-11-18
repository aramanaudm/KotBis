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
    } catch (error) {
      if (this.isUnavailable(error)) {
        this.error.set('API indisponible : affichage des données de référence.');
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
      throw this.toError(error, "Impossible d'ajouter l'utilisateur.");
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
      throw this.toError(error, "Impossible de mettre à jour l'utilisateur.");
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
      throw this.toError(error, "Impossible de changer l'état de l'utilisateur.");
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.delete(`${this.baseUrl}/voyageurs/${id}`, { headers: this.headers() }),
      );
    } catch (error) {
      throw this.toError(error, "Impossible de supprimer l'utilisateur.");
    }
    this.users.update((items) => items.filter((item) => item.id !== id));
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

  private message(error: unknown, fallback = 'Impossible de charger les utilisateurs.'): string {
    if (!(error instanceof HttpErrorResponse)) return fallback;
    const body = error.error as { erreur?: string; error?: string } | null;
    return body?.erreur ?? body?.error ?? fallback;
  }

  private toError(error: unknown, fallback?: string): Error {
    return new Error(this.message(error, fallback));
  }
}
