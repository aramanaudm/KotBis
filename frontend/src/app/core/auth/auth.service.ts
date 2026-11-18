import { Injectable, computed, inject, isDevMode, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { StorageService } from '../storage/storage.service';
import {
  AuthError,
  EMPTY_COUNTERS,
  PublicAccount,
  RegisterPayload,
  StoredAccount,
} from './auth.models';
import { isEmail } from './auth.validators';

const ACCOUNTS_KEY = 'pmh.accounts';
const SESSION_KEY = 'pmh.session';
const RESETS_KEY = 'pmh.resets';
const RESET_TTL_MS = 15 * 60 * 1000;

interface ResetRequest {
  email: string;
  code: string;
  expiresAt: number;
}

/**
 * Authentification côté application.
 *
 * ⚠️ Implémentation provisoire : les comptes sont conservés localement (Preferences) tant que
 * l'API backend d'authentification n'est pas disponible. Les composants ne dépendent que de
 * l'API publique de ce service : il suffira de remplacer le corps des méthodes par des appels
 * HTTP, sans toucher aux écrans.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly storage = inject(StorageService);
  private readonly http = inject(HttpClient);
  private readonly backendUrl = 'http://localhost:3000/api';
  private readonly tokenKey = 'kotbis.backend.jeton';

  readonly backendToken = signal<string | null>(
    sessionStorage.getItem(this.tokenKey)
  );
  private readonly currentUser = signal<PublicAccount | null>(null);

  /** Compte connecté, sans secret ; `null` = visiteur (BUS-FE-036). */
  readonly user = this.currentUser.asReadonly();
  readonly isLoggedIn = computed(() => this.currentUser() !== null);

  /** Restaure la session au démarrage de l'application. */
  async restore(): Promise<void> {
    const sessionId = await this.storage.get<string | null>(SESSION_KEY, null);
    if (!sessionId) {
      this.currentUser.set(null);
      return;
    }
    const account = (await this.loadAccounts()).find((a) => a.id === sessionId);
    this.currentUser.set(account ? this.toPublic(account) : null);
    if (!account) await this.storage.remove(SESSION_KEY);
  }

  async register(payload: RegisterPayload): Promise<PublicAccount> {
    const pseudo = payload.pseudo.trim();
    const email = payload.email.trim().toLowerCase();
    const accounts = await this.loadAccounts();

    if (accounts.some((a) => a.pseudo.toLowerCase() === pseudo.toLowerCase())) {
      throw new AuthError('PSEUDO_TAKEN', 'Ce pseudo est déjà utilisé.');
    }
    if (accounts.some((a) => a.email === email)) {
      throw new AuthError('EMAIL_TAKEN', 'Un compte existe déjà avec cet e-mail.');
    }

    const salt = this.randomHex(16);
    const account: StoredAccount = {
      id: this.randomHex(12),
      pseudo,
      email,
      city: payload.city?.trim() || undefined,
      phone: payload.phone?.trim() || undefined,
      salt,
      passwordHash: await this.hash(payload.password, salt),
      createdAt: new Date().toISOString(),
      counters: { ...EMPTY_COUNTERS },
    };

    await this.storage.set(ACCOUNTS_KEY, [...accounts, account]);
    return this.openSession(account);
  }

  /** BUS-FE-032 : `identifier` peut être un e-mail ou un pseudo. */
  async login(identifier: string, password: string): Promise<PublicAccount> {
    try {
      const response = await firstValueFrom(
        this.http.post<{
          jeton: string;
          utilisateur: {
            compteId: string;
            pseudo?: string;
            email?: string;
          };
        }>(`${this.backendUrl}/connexion`, {
          identifiant: identifier,
          motDePasse: password,
        })
      );

      sessionStorage.setItem(this.tokenKey, response.jeton);
      this.backendToken.set(response.jeton);

      const backendUser = response.utilisateur;

      const user: PublicAccount = {
        id: backendUser.compteId,
        pseudo: backendUser.pseudo || identifier,
        email: backendUser.email || '',
        createdAt: new Date().toISOString(),
        counters: { ...EMPTY_COUNTERS },
      };

      this.currentUser.set(user);
      return user;
    } catch {
      // Repli sur les comptes locaux existants.
    }

    const value = identifier.trim().toLowerCase();
    const accounts = await this.loadAccounts();
    const account = accounts.find((a) =>
      isEmail(value) ? a.email === value : a.pseudo.toLowerCase() === value,
    );

    // Même message que le compte existe ou non, pour ne pas révéler quels comptes existent.
    const invalid = new AuthError('INVALID_CREDENTIALS', 'Identifiant ou mot de passe incorrect.');
    if (!account) throw invalid;
    if ((await this.hash(password, account.salt)) !== account.passwordHash) throw invalid;

    return this.openSession(account);
  }

  async logout(): Promise<void> {
    const token = this.backendToken();

    if (token) {
      try {
        await firstValueFrom(
          this.http.post(
            `${this.backendUrl}/deconnexion`,
            {},
            {
              headers: new HttpHeaders({
                Authorization: `Bearer ${token}`,
              }),
            }
          )
        );
      } catch {
        // La session locale est supprimée même si le serveur est inaccessible.
      }
    }

    sessionStorage.removeItem(this.tokenKey);
    this.backendToken.set(null);
    await this.storage.remove(SESSION_KEY);
    this.currentUser.set(null);
  }

  /**
   * Étape 1 de la récupération (BUS-FE-033). Ne révèle jamais si l'e-mail existe.
   * Retourne le code uniquement en mode développement, faute d'envoi d'e-mail réel.
   */
  async requestPasswordReset(email: string): Promise<{ devCode?: string }> {
    const normalized = email.trim().toLowerCase();
    const accounts = await this.loadAccounts();
    if (!accounts.some((a) => a.email === normalized)) return {};

    const code = String(100000 + (this.randomInt() % 900000));
    const resets = (await this.loadResets()).filter((r) => r.email !== normalized);
    resets.push({ email: normalized, code, expiresAt: Date.now() + RESET_TTL_MS });
    await this.storage.set(RESETS_KEY, resets);
    return isDevMode() ? { devCode: code } : {};
  }

  /** Étape 2 : confirmation avec le code reçu et choix du nouveau mot de passe. */
  async confirmPasswordReset(email: string, code: string, newPassword: string): Promise<void> {
    const normalized = email.trim().toLowerCase();
    const resets = await this.loadResets();
    const request = resets.find((r) => r.email === normalized);
    if (!request || request.code !== code.trim() || request.expiresAt < Date.now()) {
      throw new AuthError('INVALID_RESET_CODE', 'Code invalide ou expiré.');
    }

    const accounts = await this.loadAccounts();
    const index = accounts.findIndex((a) => a.email === normalized);
    if (index === -1) throw new AuthError('INVALID_RESET_CODE', 'Code invalide ou expiré.');

    const salt = this.randomHex(16);
    accounts[index] = {
      ...accounts[index],
      salt,
      passwordHash: await this.hash(newPassword, salt),
    };
    await this.storage.set(ACCOUNTS_KEY, accounts);
    await this.storage.set(
      RESETS_KEY,
      resets.filter((r) => r.email !== normalized),
    );
  }

  private async openSession(account: StoredAccount): Promise<PublicAccount> {
    await this.storage.set(SESSION_KEY, account.id);
    const user = this.toPublic(account);
    this.currentUser.set(user);
    return user;
  }

  private toPublic(account: StoredAccount): PublicAccount {
    const { salt: _salt, passwordHash: _hash, ...publicAccount } = account;
    // Fusion avec les valeurs par défaut : un compte créé avant l'ajout d'un compteur reste valide.
    return { ...publicAccount, counters: { ...EMPTY_COUNTERS, ...account.counters } };
  }

  private loadAccounts(): Promise<StoredAccount[]> {
    return this.storage.get<StoredAccount[]>(ACCOUNTS_KEY, []);
  }

  private loadResets(): Promise<ResetRequest[]> {
    return this.storage.get<ResetRequest[]>(RESETS_KEY, []);
  }

  private async hash(password: string, salt: string): Promise<string> {
    const data = new TextEncoder().encode(`${salt}:${password}`);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return this.toHex(new Uint8Array(digest));
  }

  private randomHex(bytes: number): string {
    return this.toHex(crypto.getRandomValues(new Uint8Array(bytes)));
  }

  private randomInt(): number {
    return crypto.getRandomValues(new Uint32Array(1))[0];
  }

  private toHex(bytes: Uint8Array): string {
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
}
