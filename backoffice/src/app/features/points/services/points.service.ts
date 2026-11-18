import { computed, inject, Injectable, signal } from '@angular/core';
import { UsersService } from '../../users/services/users.service';
import type { PointMovement, UserBalance } from '../models/point';

@Injectable({ providedIn: 'root' })
export class PointsService {
  private readonly users = inject(UsersService);

  private readonly movements = signal<PointMovement[]>([]);

  readonly history = this.movements.asReadonly();

  readonly balances = computed<readonly UserBalance[]>(() =>
    this.users.all().map((user) => ({
      id: user.id,
      pseudo: user.pseudo,
      email: user.email,
      points: user.points,
    })),
  );
}
