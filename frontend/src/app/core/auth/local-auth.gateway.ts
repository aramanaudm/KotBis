import { inject, isDevMode, Injectable } from '@angular/core';

import { StorageService } from '../storage/storage.service';

import type { AuthGateway } from './auth.gateway';
import { AuthError, EMPTY_COUNTERS, type PublicAccount, type RegisterPayload, type StoredAccount } from './auth.models';
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

@Injectable({ providedIn: 'root' })
export class LocalAuthGateway implements AuthGateway {
  private readonly storage = inject(StorageService);

  async restore(): Promise<PublicAccount | null> {
    const sessionId = await this.storage.get<string | null>(SESSION_KEY, null);
    if (!sessionId) return null;
    const account = (await this.loadAccounts()).find((a) => a.id === sessionId);
    if (!account) {
      await this.storage.remove(SESSION_KEY);
      return null;
    }
    return this.toPublic(account);
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
      role: 'voyageur',
      salt,
      passwordHash: await this.hash(payload.password.trim(), salt),
      createdAt: new Date().toISOString(),
      counters: { ...EMPTY_COUNTERS },
    };

    await this.storage.set(ACCOUNTS_KEY, [...accounts, account]);
    return this.openSession(account);
  }

  async login(identifier: string, password: string): Promise<PublicAccount> {
    const value = identifier.trim().toLowerCase();
    const accounts = await this.loadAccounts();
    const account = accounts.find((a) => (isEmail(value) ? a.email === value : a.pseudo.toLowerCase() === value));

    const invalid = new AuthError('INVALID_CREDENTIALS', 'Identifiant ou mot de passe incorrect.');
    if (!account) throw invalid;
    if ((await this.hash(password.trim(), account.salt)) !== account.passwordHash) throw invalid;

    return this.openSession(account);
  }

  async token(): Promise<string | null> {
    return null;
  }

  async logout(): Promise<void> {
    await this.storage.remove(SESSION_KEY);
  }

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
      passwordHash: await this.hash(newPassword.trim(), salt),
    };
    await this.storage.set(ACCOUNTS_KEY, accounts);
    await this.storage.set(
      RESETS_KEY,
      resets.filter((r) => r.email !== normalized),
    );
  }

  private async openSession(account: StoredAccount): Promise<PublicAccount> {
    await this.storage.set(SESSION_KEY, account.id);
    return this.toPublic(account);
  }

  private toPublic(account: StoredAccount): PublicAccount {
    const { salt: _salt, passwordHash: _hash, ...publicAccount } = account;
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
