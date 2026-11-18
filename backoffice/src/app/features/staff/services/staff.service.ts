import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, tap, type Observable } from 'rxjs';
import { apiError, apiUrl } from '../../../core/services/api';
import type { StaffMember, StaffRole, StaffStatus } from '../models/staff';

interface ApiStaff {
  id: string;
  name: string;
  email: string;
  role_code: string;
  etat: StaffEtat;
}

type StaffEtat = 'invite' | 'actif' | 'inactif';

const ETAT_TO_STATUS: Record<StaffEtat, StaffStatus> = {
  invite: 'invited',
  actif: 'active',
  inactif: 'inactive',
};

const API_TO_ROLE: Record<string, StaffRole> = {
  operateur: 'operator',
  moderateur: 'moderator',
  administrateur: 'admin',
};

@Injectable({ providedIn: 'root' })
export class StaffService {
  private readonly http = inject(HttpClient);
  private readonly staff = signal<StaffMember[]>([]);
  private readonly erreur = signal('');

  readonly all = this.staff.asReadonly();
  readonly total = computed(() => this.staff().length);
  readonly error = this.erreur.asReadonly();

  load(): void {
    this.http.get<{ success: boolean; data: ApiStaff[] }>(`${apiUrl}/api/admin/staff`).subscribe({
      next: (res) => {
        this.erreur.set('');
        this.staff.set(
          res.data.map((member) => ({
            id: String(member.id),
            name: member.name,
            email: member.email,
            role: API_TO_ROLE[member.role_code] ?? 'operator',
            status: ETAT_TO_STATUS[member.etat] ?? 'invited',
          })),
        );
      },
      error: (err) => this.erreur.set(apiError(err)),
    });
  }

  create(member: Omit<StaffMember, 'id'>): Observable<void> {
    return this.http
      .post<{ success: boolean }>(`${apiUrl}/api/admin/staff`, this.body(member))
      .pipe(tap(() => this.load()), map(() => undefined));
  }

  update(id: string, member: Omit<StaffMember, 'id'>): Observable<void> {
    return this.http
      .put<{ success: boolean }>(`${apiUrl}/api/admin/staff/${id}`, this.body(member))
      .pipe(tap(() => this.load()), map(() => undefined));
  }

  delete(id: string): Observable<void> {
    return this.http
      .delete<{ success: boolean }>(`${apiUrl}/api/admin/staff/${id}`)
      .pipe(tap(() => this.load()), map(() => undefined));
  }

  private body(member: Omit<StaffMember, 'id'>) {
    return {
      name: member.name,
      email: member.email,
      role: member.role,
      status: member.status,
    };
  }
}
