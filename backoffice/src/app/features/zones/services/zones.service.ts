import { computed, Injectable, signal } from '@angular/core';
import type { Zone } from '../models/zone';

@Injectable({ providedIn: 'root' })
export class ZonesService {
  private readonly zones = signal<Zone[]>([]);

  readonly all = this.zones.asReadonly();
  readonly active = computed(() => this.zones().filter((zone) => zone.status === 'active'));
  readonly total = computed(() => this.zones().length);
}
