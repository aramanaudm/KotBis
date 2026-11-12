import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ReviewListPage } from './review-list.page';
import { ReviewService } from './review.service';

describe('SCRUM-60 — avis publics', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('présente auteur, date, texte et bus', () => {
    const fixture = TestBed.createComponent(ReviewListPage);
    fixture.detectChanges();
    const page: HTMLElement = fixture.nativeElement;
    expect(page.querySelectorAll('li')).toHaveLength(2);
    expect(page.textContent).toContain('Maya974');
    expect(page.textContent).toContain('10/11/2026');
    expect(page.textContent).toContain('Bus 4A');
    expect(page.textContent).toContain('très propre');
    expect(page.textContent).not.toContain('Supprimer');
  });

  it('explique une liste vide', () => {
    TestBed.overrideProvider(ReviewService, { useValue: { reviews: signal([]), notice: signal('') } });
    const fixture = TestBed.createComponent(ReviewListPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Aucun avis pour le moment.');
  });
});
