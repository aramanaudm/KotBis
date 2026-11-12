import { Injectable, inject, signal } from '@angular/core';

import { COMMUNITY_BUSES } from './community-buses';
import { COMMUNITY_SESSION } from './community-session';
import type { Review } from './review.model';

/** Source de démonstration en mémoire. À remplacer par le dépôt HTTP de l'équipe. */
@Injectable({ providedIn: 'root' })
export class ReviewService {
  private readonly session = inject(COMMUNITY_SESSION);
  readonly notice = signal('');
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

  async createReview(draft: { busId: string; text: string }): Promise<void> {
    const user = this.session();
    if (!user) throw new Error('Vous devez être connecté pour publier un avis.');
    const bus = COMMUNITY_BUSES.find((item) => item.id === draft.busId);
    if (!bus) throw new Error('Sélectionnez un bus valide.');
    const text = this.validateText(draft.text);
    this.items.update((items) => [
      {
        id: crypto.randomUUID(),
        busId: bus.id,
        busLine: bus.line,
        userId: user.id,
        userName: user.pseudo,
        text,
        createdAt: new Date().toISOString(),
      },
      ...items,
    ]);
    this.notice.set('Votre avis a été publié dans cette session de démonstration.');
  }

  private validateText(value: string): string {
    const text = value.trim();
    if (!text) throw new Error('Votre avis doit contenir du texte.');
    return text;
  }
}
