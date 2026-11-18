import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';

export type StaffRole = 'administrateur' | 'operateur' | 'moderateur';

export interface SessionUser {
  readonly name: string;
  readonly initials: string;
  readonly role: StaffRole;
  readonly email?: string;
}

interface ApiUser {
  email: string;
  pseudo: string;
  role?: 'voyageur' | 'operateur' | 'moderateur' | 'administrateur';
}

const TOKEN_KEY = 'kotbis.token';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly http = inject(HttpClient);
  private readonly session = signal<SessionUser | null>(null);
  private token: string | null = null;

  readonly currentUser = this.session.asReadonly();
  readonly isAuthenticated = computed(() => this.session() !== null);
  readonly isAdmin = computed(() => this.session()?.role === 'administrateur');

  async restore(): Promise<void> {
    const token = this.readToken();
    if (!token) {
      this.session.set(null);
      return;
    }
    try {
      const response = await firstValueFrom(
        this.http.get<{ utilisateur: ApiUser }>(`${environment.apiBaseUrl}/utilisateurs/moi`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      const api = response.utilisateur;
      const name = api.pseudo || api.email;
      this.session.set({
        name,
        initials: this.initials(name),
        role: this.toStaffRole(api.role),
        email: api.email,
      });
    } catch {
      this.clear();
    }
  }

  logout(): void {
    this.clear();
  }

  getToken(): string | null {
    return this.token;
  }

  private readToken(): string | null {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('token');
    if (fromUrl) {
      this.token = fromUrl;
      localStorage.setItem(TOKEN_KEY, fromUrl);
      params.delete('token');
      const query = params.toString();
      window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
      return fromUrl;
    }
    this.token = localStorage.getItem(TOKEN_KEY);
    return this.token;
  }

  private clear(): void {
    this.token = null;
    this.session.set(null);
    if (typeof localStorage !== 'undefined') localStorage.removeItem(TOKEN_KEY);
  }

  private toStaffRole(role: ApiUser['role']): StaffRole {
    return role === 'operateur' || role === 'moderateur' ? role : 'administrateur';
  }

  private initials(name: string): string {
    return name
      .split(/[\s._@-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }
}
