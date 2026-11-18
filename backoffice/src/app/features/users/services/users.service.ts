import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, tap, type Observable } from 'rxjs';
import { apiError, apiUrl } from '../../../core/services/api';
import type { User, UserRole } from '../models/user';

interface ApiAccount {
  id: string;
  email: string;
  pseudo: string | null;
  role_code: string;
  etat: 'invite' | 'actif' | 'inactif';
  points: string | number;
}

const ROLE_TO_API: Record<UserRole, string> = {
  traveller: 'voyageur',
  operator: 'operateur',
  moderator: 'moderateur',
  admin: 'administrateur',
};

const API_TO_ROLE: Record<string, UserRole> = {
  voyageur: 'traveller',
  operateur: 'operator',
  moderateur: 'moderator',
  administrateur: 'admin',
};

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);
  private readonly users = signal<User[]>([]);
  private readonly erreur = signal('');

  readonly all = this.users.asReadonly();
  readonly total = computed(() => this.users().length);
  readonly error = this.erreur.asReadonly();

  load(): void {
    this.http.get<{ success: boolean; data: ApiAccount[] }>(`${apiUrl}/api/admin/accounts`).subscribe({
      next: (res) => {
        this.erreur.set('');
        this.users.set(
          res.data.map((account) => ({
            id: String(account.id),
            pseudo: account.pseudo ?? account.email.split('@')[0],
            email: account.email,
            role: API_TO_ROLE[account.role_code] ?? 'traveller',
            status: account.etat === 'inactif' ? 'inactive' : 'active',
            points: Number(account.points ?? 0),
          })),
        );
      },
      error: (err) => this.erreur.set(apiError(err)),
    });
  }

  create(user: Omit<User, 'id'>): Observable<void> {
    const body = {
      email: user.email,
      pseudo: user.pseudo,
      role_code: ROLE_TO_API[user.role],
      etat: user.status === 'inactive' ? 'inactif' : 'invite',
    };
    return this.http
      .post<{ success: boolean }>(`${apiUrl}/api/admin/accounts`, body)
      .pipe(tap(() => this.load()), map(() => undefined));
  }

  update(id: string, user: Omit<User, 'id'>): Observable<void> {
    const body = {
      email: user.email,
      pseudo: user.pseudo,
      role_code: ROLE_TO_API[user.role],
      etat: user.status === 'inactive' ? 'inactif' : 'invite',
    };
    return this.http
      .put<{ success: boolean }>(`${apiUrl}/api/admin/accounts/${id}`, body)
      .pipe(tap(() => this.load()), map(() => undefined));
  }

  delete(id: string): Observable<void> {
    return this.http
      .delete<{ success: boolean }>(`${apiUrl}/api/admin/accounts/${id}`)
      .pipe(tap(() => this.load()), map(() => undefined));
  }
}
