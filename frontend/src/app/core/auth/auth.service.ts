import { Injectable, computed, inject, signal } from '@angular/core';

import { AUTH_GATEWAY } from './auth.gateway';
import type { PublicAccount, RegisterPayload } from './auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly gateway = inject(AUTH_GATEWAY);
  private readonly currentUser = signal<PublicAccount | null>(null);

  readonly user = this.currentUser.asReadonly();
  readonly isLoggedIn = computed(() => this.currentUser() !== null);

  async restore(): Promise<void> {
    this.currentUser.set(await this.gateway.restore());
  }

  async register(payload: RegisterPayload): Promise<PublicAccount> {
    const user = await this.gateway.register(payload);
    this.currentUser.set(user);
    return user;
  }

  async login(identifier: string, password: string): Promise<PublicAccount> {
    const user = await this.gateway.login(identifier, password);
    this.currentUser.set(user);
    return user;
  }

  token(): Promise<string | null> {
    return this.gateway.token();
  }

  async logout(): Promise<void> {
    await this.gateway.logout();
    this.currentUser.set(null);
  }

  requestPasswordReset(email: string): Promise<{ devCode?: string }> {
    return this.gateway.requestPasswordReset(email);
  }

  confirmPasswordReset(email: string, code: string, newPassword: string): Promise<void> {
    return this.gateway.confirmPasswordReset(email, code, newPassword);
  }
}
