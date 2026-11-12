import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { COMMUNITY_SESSION } from './community-session';
import type { CommunityUser } from './community-session';
import { ReviewService } from './review.service';

describe('SCRUM-61 — publication', () => {
  const session = signal<CommunityUser | null>(null);
  let service: ReviewService;
  beforeEach(() => {
    session.set({ id: 'new-user', pseudo: 'Nouvel usager' });
    TestBed.configureTestingModule({ providers: [{ provide: COMMUNITY_SESSION, useValue: session }] });
    service = TestBed.inject(ReviewService);
  });

  it("dérive l'auteur de la session et le nom de ligne du catalogue", async () => {
    await service.createReview({ busId: 'b2', text: '  Très pratique.  ' });
    expect(service.reviews()[0]).toMatchObject({
      userId: 'new-user',
      userName: 'Nouvel usager',
      busLine: '12',
      text: 'Très pratique.',
    });
  });

  it('refuse un visiteur sans ajouter un avis', async () => {
    session.set(null);
    await expect(service.createReview({ busId: 'b1', text: 'Merci' })).rejects.toThrow('connecté');
    expect(service.reviews()).toHaveLength(2);
  });

  it('refuse un bus inconnu et un texte vide', async () => {
    await expect(service.createReview({ busId: 'inconnu', text: 'Merci' })).rejects.toThrow('bus');
    await expect(service.createReview({ busId: 'b1', text: '   ' })).rejects.toThrow('texte');
    expect(service.reviews()).toHaveLength(2);
  });
});
