import { computed, Injectable, signal } from '@angular/core';
import type { StaffMember } from '../models/staff';

@Injectable({ providedIn: 'root' })
export class StaffService {
  private readonly staff = signal<StaffMember[]>([]);

  readonly all = this.staff.asReadonly();
  readonly total = computed(() => this.staff().length);
}
