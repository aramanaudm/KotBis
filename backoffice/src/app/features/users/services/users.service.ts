import { computed, Injectable, signal } from '@angular/core';
import type { User } from '../models/user';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly users = signal<User[]>([]);

  readonly all = this.users.asReadonly();
  readonly total = computed(() => this.users().length);
}
