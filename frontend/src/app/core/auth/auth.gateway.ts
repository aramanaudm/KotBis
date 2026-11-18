import { InjectionToken, inject } from '@angular/core';

import type { PublicAccount, RegisterPayload } from './auth.models';
import { LocalAuthGateway } from './local-auth.gateway';

export interface AuthGateway {
  restore(): Promise<PublicAccount | null>;
  register(payload: RegisterPayload): Promise<PublicAccount>;
  login(identifier: string, password: string): Promise<PublicAccount>;
  token(): Promise<string | null>;
  logout(): Promise<void>;
  requestPasswordReset(email: string): Promise<{ devCode?: string }>;
  confirmPasswordReset(email: string, code: string, newPassword: string): Promise<void>;
}

export const AUTH_GATEWAY = new InjectionToken<AuthGateway>('AUTH_GATEWAY', {
  factory: () => inject(LocalAuthGateway),
});
