import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { COMMUNITY_SESSION } from './community-session';
import type { CommunityUser } from './community-session';
import { ReviewFormPage } from './review-form.page';
import { ReviewService } from './review.service';

describe('SCRUM-61 — formulaire', () => {
  const session = signal<CommunityUser | null>(null);
  beforeEach(() => {
    session.set({ id: 'new-user', pseudo: 'Usager' });
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: COMMUNITY_SESSION, useValue: session }],
    });
  });

  it('bloque le bouton de publication pour un visiteur', () => {
    session.set(null);
    const fixture = TestBed.createComponent(ReviewFormPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Vous devez être connecté');
  });

  it('publie une seule fois et revient aux avis', async () => {
    const fixture = TestBed.createComponent(ReviewFormPage);
    const page = fixture.componentInstance;
    const service = TestBed.inject(ReviewService);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    page.form.setValue({ busId: 'b1', text: 'Bus ponctuel.' });
    await Promise.all([page.submit(), page.submit()]);
    expect(service.reviews()).toHaveLength(3);
    expect(navigate).toHaveBeenCalledWith('/home/avis');
  });

  it('garde le texte et présente une erreur si le service échoue', async () => {
    const fixture = TestBed.createComponent(ReviewFormPage);
    const page = fixture.componentInstance;
    page.form.setValue({ busId: 'b1', text: 'Bus ponctuel.' });
    vi.spyOn(TestBed.inject(ReviewService), 'createReview').mockRejectedValue(new Error('Service indisponible'));
    await page.submit();
    expect(page.error()).toBe('Service indisponible');
    expect(page.form.controls.text.value).toBe('Bus ponctuel.');
    expect(page.busy()).toBe(false);
  });
});
