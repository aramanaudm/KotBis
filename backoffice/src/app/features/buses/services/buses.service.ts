import { computed, Injectable, signal } from '@angular/core';
import type { Bus } from '../models/bus';

@Injectable({ providedIn: 'root' })
export class BusesService {
  private readonly buses = signal<Bus[]>([]);

  readonly all = this.buses.asReadonly();
  readonly total = computed(() => this.buses().length);
}
