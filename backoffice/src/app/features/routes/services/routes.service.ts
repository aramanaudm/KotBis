import { computed, Injectable, signal } from '@angular/core';
import type { TransitRoute } from '../models/route';

@Injectable({ providedIn: 'root' })
export class RoutesService {
  private readonly routes = signal<TransitRoute[]>([]);

  readonly all = this.routes.asReadonly();
  readonly total = computed(() => this.routes().length);
  readonly active = computed(() => this.routes().filter((route) => route.status === 'active'));
}
