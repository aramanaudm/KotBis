import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { COMMUNITY_SESSION } from './community-session';
import { ReviewFormPage } from './review-form.page';
import { ReviewService } from './review.service';

describe('SCRUM-63 — longueur des avis', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: COMMUNITY_SESSION, useValue: signal({ id: 'user123', pseudo: 'Maya974' }) },
      ],
    }),
  );

  it('accepte 600 caractères en publication et modification', async () => {
    const service = TestBed.inject(ReviewService);
    const text = 'a'.repeat(600);
    await service.createReview({ busId: 'b1', text });
    await service.updateReview('1', text);
    expect(service.reviews().filter((review) => review.text.length === 600)).toHaveLength(2);
  });

  it('refuse 601 caractères dans les deux opérations sans modifier les avis', async () => {
    const service = TestBed.inject(ReviewService);
    const initial = service.reviews();
    await expect(service.createReview({ busId: 'b1', text: 'a'.repeat(601) })).rejects.toThrow('600');
    await expect(service.updateReview('1', 'a'.repeat(600) + ' ')).rejects.toThrow('600');
    expect(service.reviews()).toBe(initial);
  });

  it('actualise le compteur depuis la saisie et explique la limite', () => {
    const fixture = TestBed.createComponent(ReviewFormPage);
    fixture.detectChanges();
    const textarea: HTMLTextAreaElement = fixture.nativeElement.querySelector('textarea');
    expect(textarea.maxLength).toBe(600);
    textarea.value = 'Bus très propre.';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#review-text-count').textContent).toContain('16 / 600');
    expect(fixture.nativeElement.textContent).toContain('espaces compris');
  });

  it('annonce la limite atteinte, puis explique un dépassement et bloque la publication', async () => {
    const fixture = TestBed.createComponent(ReviewFormPage);
    const page = fixture.componentInstance;
    fixture.detectChanges();
    page.form.setValue({ busId: 'b1', text: 'a'.repeat(600) });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Limite atteinte');
    page.form.controls.text.setValue('a'.repeat(601));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Raccourcissez-le');
    await page.submit();
    expect(TestBed.inject(ReviewService).reviews()).toHaveLength(2);
    expect(page.form.controls.text.value.length).toBe(601);
  });
});
