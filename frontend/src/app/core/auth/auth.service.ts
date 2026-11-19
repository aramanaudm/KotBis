import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { StorageService } from '../storage/storage.service';

import type { ApiUserProfile, PublicAccount, RegisterPayload, StoredSession } from './auth.models';
import { AuthError, EMPTY_COUNTERS } from './auth.models';

const SESSION_KEY = 'kotbis.session';

/**
 * Clés de l'ancienne implémentation provisoire, qui gardait les comptes (e-mails, téléphones,
 * empreintes de mot de passe) dans le stockage de l'appareil. Elles sont effacées au démarrage.
 */
const LEGACY_KEYS = ['pmh.accounts', 'pmh.session', 'pmh.resets'] as const;

interface ConnexionResponse {
  jeton: string;
  expireLe: string;
  utilisateur: ApiUserProfile;
}

interface RenewalResponse {
  jeton: string;
  expireLe: string;
}

interface ApiErrorBody {
  erreur?: { code?: string; message?: string; details?: { champ: string; message: string }[] };
}

/**
 * Authentification par l'API Back-End (KBE-22 inscription, KBE-23 connexion et sessions).
 *
 * Les comptes sont enregistrés dans PostgreSQL. L'appareil ne conserve que le jeton de session
 * opaque et le profil public du compte connecté, nécessaires pour rester connecté au redémarrage.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(StorageService);
  private readonly api = environment.apiUrl;

  readonly backendToken = signal<string | null>(null);
  private readonly currentUser = signal<PublicAccount | null>(null);
  private session: StoredSession | null = null;

  /** Compte connecté, sans secret ; `null` = visiteur (BUS-FE-036). */
  readonly user = this.currentUser.asReadonly();
  readonly isLoggedIn = computed(() => this.currentUser() !== null);

  /** Jeton à transmettre en `Authorization: Bearer …` aux API protégées ; `null` = visiteur. */
  token(): string | null {
    return this.session?.token ?? null;
  }

  /**
   * Restaure la session au démarrage. Le compte en cache est affiché aussitôt ; le serveur
   * confirme ensuite la session en arrière-plan, sans bloquer l'ouverture de l'application.
   */
  async restore(): Promise<void> {
    await Promise.all(LEGACY_KEYS.map((key) => this.storage.remove(key)));

    const saved = await this.storage.get<StoredSession | null>(SESSION_KEY, null);
    if (!saved?.token || !saved.user || this.isExpired(saved.expiresAt)) {
      await this.clearSession();
      return;
    }

    this.session = saved;
    this.backendToken.set(saved.token);
    this.currentUser.set(saved.user);
    void this.renewSession();
  }

  async register(payload: RegisterPayload): Promise<PublicAccount> {
    const email = payload.email.trim().toLowerCase();
    try {
      await firstValueFrom(
        this.http.post<{ utilisateur: ApiUserProfile }>(`${this.api}/inscription`, {
          pseudo: payload.pseudo.trim(),
          email,
          motDePasse: payload.password,
          accepteConditions: payload.acceptTerms,
          zoneLibre: payload.city?.trim() || null,
          telephone: payload.phone?.trim() || null,
        }),
      );
    } catch (error) {
      throw this.toAuthError(error);
    }

    // L'inscription ne crée pas de session : on connecte le nouveau compte, comme auparavant.
    try {
      return await this.login(email, payload.password);
    } catch {
      throw new AuthError('UNKNOWN', 'Votre compte a bien été créé. Connectez-vous pour continuer.');
    }
  }

  /** BUS-FE-032 : `identifier` peut être un e-mail ou un pseudo. */
  async login(identifier: string, password: string): Promise<PublicAccount> {
    try {
      const response = await firstValueFrom(
        this.http.post<ConnexionResponse>(`${this.api}/connexion`, {
          identifiant: identifier.trim(),
          motDePasse: password,
        }),
      );
      const user = this.toPublic(response.utilisateur);
      await this.saveSession({ token: response.jeton, expiresAt: response.expireLe, user });
      return user;
    } catch (error) {
      throw this.toAuthError(error);
    }
  }

  async logout(): Promise<void> {
    const token = this.token();
    await this.clearSession();
    if (token) {
      try {
        await firstValueFrom(
          this.http.post(`${this.api}/deconnexion`, {}, { headers: this.bearer(token) }),
        );
      } catch {
        // La session de l'appareil est déjà fermée.
      }
    }
  }

  /**
   * Étape 1 de la récupération (BUS-FE-033). L'API correspondante (KBE-24) n'est pas encore
   * disponible : aucun code n'est généré localement.
   */
  async requestPasswordReset(_email: string): Promise<{ devCode?: string }> {
    throw this.resetUnavailable();
  }

  /** Étape 2 : confirmation avec le code reçu (en attente de l'API KBE-24). */
  async confirmPasswordReset(_email: string, _code: string, _newPassword: string): Promise<void> {
    throw this.resetUnavailable();
  }

  /** Prolonge la session (POST /renouvellement-session) ; la ferme si le serveur la refuse. */
  private async renewSession(): Promise<void> {
    const current = this.session;
    if (!current) return;
    try {
      const renewed = await firstValueFrom(
        this.http.post<RenewalResponse>(`${this.api}/renouvellement-session`, null, {
          headers: this.bearer(current.token),
        }),
      );
      if (this.session !== current) return; // déconnexion ou nouvelle connexion entre-temps
      await this.saveSession({ ...current, token: renewed.jeton, expiresAt: renewed.expireLe });
    } catch (error) {
      if (this.session !== current) return;
      // Hors connexion ou serveur indisponible : la session reste valable jusqu'à son expiration.
      if (error instanceof HttpErrorResponse && error.status === 401) await this.clearSession();
    }
  }

  private async saveSession(session: StoredSession): Promise<void> {
    this.session = session;
    this.backendToken.set(session.token);
    this.currentUser.set(session.user);
    await this.storage.set(SESSION_KEY, session);
  }

  private async clearSession(): Promise<void> {
    this.session = null;
    this.backendToken.set(null);
    this.currentUser.set(null);
    await this.storage.remove(SESSION_KEY);
  }

  private toPublic(profile: ApiUserProfile): PublicAccount {
    return {
      id: profile.compteId,
      pseudo: profile.pseudo ?? '',
      email: profile.email,
      city: profile.zoneLibre ?? undefined,
      phone: profile.telephone ?? undefined,
      createdAt: profile.creeLe,
      counters: { ...EMPTY_COUNTERS },
    };
  }

  private isExpired(expiresAt: string | undefined): boolean {
    const time = expiresAt ? Date.parse(expiresAt) : NaN;
    return Number.isNaN(time) || time <= Date.now();
  }

  private bearer(token: string): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  private resetUnavailable(): AuthError {
    return new AuthError(
      'UNAVAILABLE',
      "La récupération du mot de passe n'est pas encore disponible. Réessayez plus tard.",
    );
  }

  /** Traduit une réponse d'erreur de l'API (`{ erreur: { code, message } }`) en AuthError. */
  private toAuthError(error: unknown): AuthError {
    if (!(error instanceof HttpErrorResponse)) {
      return new AuthError('UNKNOWN', 'Une erreur inattendue est survenue. Réessayez plus tard.');
    }
    if (error.status === 0) {
      return new AuthError('NETWORK', 'Impossible de joindre le serveur. Vérifiez votre connexion.');
    }

    const body = (error.error ?? {}) as ApiErrorBody;
    const code = body.erreur?.code;
    const serverMessage = body.erreur?.details?.[0]?.message ?? body.erreur?.message;

    switch (code) {
      case 'EMAIL_DEJA_UTILISE':
        return new AuthError('EMAIL_TAKEN', 'Un compte existe déjà avec cet e-mail.');
      case 'PSEUDO_DEJA_UTILISE':
        return new AuthError('PSEUDO_TAKEN', 'Ce pseudo est déjà utilisé.');
      case 'IDENTIFIANTS_INVALIDES':
        return new AuthError('INVALID_CREDENTIALS', 'Identifiant ou mot de passe incorrect.');
    }

    switch (error.status) {
      case 409:
        return new AuthError('UNKNOWN', serverMessage ?? 'Une valeur saisie est déjà utilisée.');
      case 422:
        return new AuthError('INVALID_DATA', serverMessage ?? 'Certaines informations sont invalides.');
      case 429:
        return new AuthError('TOO_MANY_ATTEMPTS', serverMessage ?? 'Trop de tentatives. Veuillez réessayer plus tard.');
      case 503:
        return new AuthError('UNAVAILABLE', 'Service momentanément indisponible. Réessayez plus tard.');
      default:
        return new AuthError('UNKNOWN', 'Une erreur est survenue. Réessayez plus tard.');
    }
  }
}
