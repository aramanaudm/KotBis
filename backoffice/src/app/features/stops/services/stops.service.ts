import { computed, Injectable, signal } from '@angular/core';
import type { Stop } from '../models/stop';

@Injectable({ providedIn: 'root' })
export class StopsService {
  private readonly stops = signal<Stop[]>([]);

  readonly all = this.stops.asReadonly();
  readonly active = computed(() => this.stops().filter((stop) => stop.status === 'active'));
  readonly total = computed(() => this.stops().length);
}
