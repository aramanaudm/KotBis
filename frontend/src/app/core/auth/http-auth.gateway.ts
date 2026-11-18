import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { StorageService } from '../storage/storage.service';

import type { AuthGateway } from './auth.gateway';
import {
  AuthError,
  type AuthErrorCode,
  type PublicAccount,
  type RegisterPayload,
  type UserRole,
  EMPTY_COUNTERS,
  type AccountCounters,
} from './auth.models';

interface Session {
  token: string;
  user: PublicAccount;
}

interface ApiUser {
  id: string | number;
  email: string;
  pseudo: string;
  city?: string | null;
  phone?: string | null;
  role?: UserRole;
  createdAt?: string;
  counters?: Partial<AccountCounters>;
}

interface ApiAuthResponse {
  token: string;
  utilisateur?: ApiUser;
  data?: ApiUser;
}

@Injectable({ providedIn: 'root' })
export class HttpAuthGateway implements AuthGateway {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(StorageService);
  private readonly baseUrl = environment.apiUrl.replace(/\/$/, '');

  async restore(): Promise<PublicAccount | null> {
    const session = await this.storage.get<Session | null>('pmh.session', null);
    if (!session?.token) return null;
    try {
      const response = await firstValueFrom(
        this.http.get<{ utilisateur: ApiUser }>(`${this.baseUrl}/utilisateurs/moi`, {
          headers: this.headers(session.token),
        }),
      );
      const user = this.toPublic(response.utilisateur);
      await this.storage.set('pmh.session', { token: session.token, user });
      return user;
    } catch {
      await this.storage.remove('pmh.session');
      return null;
    }
  }

  async register(payload: RegisterPayload): Promise<PublicAccount> {
    try {
      const response = await firstValueFrom(
        this.http.post<ApiAuthResponse>(`${this.baseUrl}/inscription`, {
          pseudo: payload.pseudo.trim(),
          email: payload.email.trim().toLowerCase(),
          city: payload.city?.trim() || undefined,
          phone: payload.phone?.trim() || undefined,
          password: payload.password.trim(),
        }),
      );
      return await this.open(response);
    } catch (error) {
      throw this.toError(error, 'UNKNOWN');
    }
  }

  async login(identifier: string, password: string): Promise<PublicAccount> {
    try {
      const response = await firstValueFrom(
        this.http.post<ApiAuthResponse>(`${this.baseUrl}/connexion`, {
          identifiant: identifier.trim().toLowerCase(),
          motDePasse: password.trim(),
        }),
      );
      return await this.open(response);
    } catch (error) {
      throw this.toError(error, 'INVALID_CREDENTIALS');
    }
  }

  async token(): Promise<string | null> {
    const session = await this.storage.get<Session | null>('pmh.session', null);
    return session?.token ?? null;
  }

  async logout(): Promise<void> {
    await this.storage.remove('pmh.session');
  }

  async requestPasswordReset(email: string): Promise<{ devCode?: string }> {
    try {
      const response = await firstValueFrom(
        this.http.post<{ devCode?: string }>(`${this.baseUrl}/mot-de-passe/oublie`, {
          email: email.trim().toLowerCase(),
        }),
      );
      return response.devCode ? { devCode: response.devCode } : {};
    } catch (error) {
      throw this.toError(error, 'UNKNOWN');
    }
  }

  async confirmPasswordReset(email: string, code: string, newPassword: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${this.baseUrl}/mot-de-passe/reinitialiser`, {
          email: email.trim().toLowerCase(),
          code: code.trim(),
          nouveauMotDePasse: newPassword.trim(),
        }),
      );
    } catch (error) {
      throw this.toError(error, 'INVALID_RESET_CODE');
    }
  }

  private async open(response: ApiAuthResponse): Promise<PublicAccount> {
    const apiUser = response.utilisateur ?? response.data;
    if (!response.token || !apiUser) {
      throw new AuthError('UNKNOWN', 'Réponse du serveur invalide.');
    }
    const user = this.toPublic(apiUser);
    await this.storage.set('pmh.session', { token: response.token, user });
    return user;
  }

  private toPublic(api: ApiUser): PublicAccount {
    return {
      id: String(api.id),
      email: api.email,
      pseudo: api.pseudo,
      city: api.city ?? undefined,
      phone: api.phone ?? undefined,
      role: api.role ?? 'voyageur',
      createdAt: api.createdAt ?? new Date().toISOString(),
      counters: { ...EMPTY_COUNTERS, ...api.counters },
    };
  }

  private headers(token: string): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  private toError(error: unknown, fallback: AuthErrorCode): AuthError {
    if (!(error instanceof HttpErrorResponse)) {
      return new AuthError(fallback, 'Impossible de contacter le serveur.');
    }
    const body = error.error as { erreur?: string; error?: string } | null;
    const message = body?.erreur ?? body?.error ?? 'Une erreur est survenue.';
    if (error.status === 409) {
      if (/pseudo/i.test(message)) return new AuthError('PSEUDO_TAKEN', message);
      if (/e-?mail/i.test(message)) return new AuthError('EMAIL_TAKEN', message);
    }
    if (error.status === 401 || error.status === 403) {
      return new AuthError('INVALID_CREDENTIALS', message);
    }
    if (error.status === 400 && fallback === 'INVALID_RESET_CODE') {
      return new AuthError('INVALID_RESET_CODE', message);
    }
    return new AuthError(fallback, message);
  }
}
