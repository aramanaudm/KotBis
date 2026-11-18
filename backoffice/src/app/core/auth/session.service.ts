import { Injectable, signal } from '@angular/core';

export type StaffRole = 'administrateur' | 'operateur' | 'moderateur';

export interface SessionUser {
  readonly name: string;
  readonly initials: string;
  readonly role: StaffRole;
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  readonly currentUser = signal<SessionUser>({
    name: 'Administrateur',
    initials: 'AD',
    role: 'administrateur',
  });
}
