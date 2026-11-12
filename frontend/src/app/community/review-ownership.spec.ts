import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import { COMMUNITY_SESSION } from './community-session';
import type { CommunityUser } from './community-session';
import { ReviewActionsComponent } from './review-actions.component';
import { ReviewFormPage } from './review-form.page';
import { ReviewService } from './review.service';

describe('SCRUM-62 — propriétaire des avis', () => {
  const user = signal<CommunityUser | null>(null);
  beforeEach(() => {
    user.set({ id: 'user123', pseudo: 'Maya974' });
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: COMMUNITY_SESSION, useValue: user }],
    });
  });

  it('modifie le texte de son avis sans changer son auteur ou sa ligne', async () => {
    const service = TestBed.inject(ReviewService);
    await service.updateReview('1', 'Mon avis corrigé.');
    expect(service.reviews()[0]).toMatchObject({
      userId: 'user123',
      busLine: '4A',
      text: 'Mon avis corrigé.',
      updatedAt: expect.any(String),
    });
  });

  it('refuse toute modification ou suppression de l’avis d’un autre compte', async () => {
    const service = TestBed.inject(ReviewService);
    const before = service.reviews();
    await expect(service.updateReview('2', 'Modification interdite')).rejects.toThrow('propres avis');
    await expect(service.deleteReview('2')).rejects.toThrow('propres avis');
    expect(service.reviews()).toBe(before);
  });

  it('refuse un visiteur et un identifiant inconnu', async () => {
    const service = TestBed.inject(ReviewService);
    await expect(service.deleteReview('absent')).rejects.toThrow('propres avis');
    user.set(null);
    await expect(service.updateReview('1', 'Non autorisé')).rejects.toThrow('propres avis');
    await expect(service.deleteReview('1')).rejects.toThrow('propres avis');
  });

  it('affiche les actions uniquement au propriétaire', () => {
    const fixture = TestBed.createComponent(ReviewActionsComponent);
    fixture.componentRef.setInput('review', TestBed.inject(ReviewService).reviews()[0]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Modifier');
    user.set({ id: 'autre', pseudo: 'Autre' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });

  it('annule sans supprimer puis recontrôle la session lors de la confirmation', async () => {
    const service = TestBed.inject(ReviewService);
    const fixture = TestBed.createComponent(ReviewActionsComponent);
    fixture.componentRef.setInput('review', service.reviews()[0]);
    const component = fixture.componentInstance;
    component.confirming.set(true);
    component.cancel();
    expect(service.reviews()).toHaveLength(2);
    component.confirming.set(true);
    user.set(null);
    await component.remove();
    expect(component.error()).toContain('propres avis');
    expect(service.reviews()).toHaveLength(2);
  });

  it('supprime définitivement après confirmation du propriétaire', async () => {
    const service = TestBed.inject(ReviewService);
    const fixture = TestBed.createComponent(ReviewActionsComponent);
    fixture.componentRef.setInput('review', service.reviews()[0]);
    fixture.componentInstance.confirming.set(true);
    await fixture.componentInstance.remove();
    expect(service.reviews().map((review) => review.id)).toEqual(['2']);
  });

  it("n'affiche pas le formulaire d’édition d’un autre utilisateur par URL directe", () => {
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: { snapshot: { paramMap: convertToParamMap({ id: '2' }) } },
    });
    const fixture = TestBed.createComponent(ReviewFormPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('introuvable ou appartient');
  });
});
