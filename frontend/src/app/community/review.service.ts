import { Injectable, signal } from '@angular/core';

import type { Review } from './review.model';

/** Source de démonstration en mémoire. À remplacer par le dépôt HTTP de l'équipe. */
@Injectable({ providedIn: 'root' })
export class ReviewService {
  private readonly items = signal<readonly Review[]>([
    {
      id: '1',
      busId: 'b1',
      busLine: '4A',
      userId: 'user123',
      userName: 'Maya974',
      text: "Le bus 4A était à l'heure aujourd'hui, très propre.",
      createdAt: '2026-11-10T04:30:00Z',
    },
    {
      id: '2',
      busId: 'b2',
      busLine: '12',
      userId: 'user456',
      userName: 'JeanPaul',
      text: 'Chauffeur très sympa, mais le bus a mis 15 min de plus à cause des travaux à Rose-Hill.',
      createdAt: '2026-11-09T13:15:00Z',
    },
  ]);
  readonly reviews = this.items.asReadonly();
}
