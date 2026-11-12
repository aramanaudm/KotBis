import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { COMMUNITY_SESSION } from './community-session';
import { REPORT_CATEGORIES } from './report-categories';
import { ReportFormPage } from './report-form.page';
import { ReportService } from './report.service';

describe('SCRUM-65 — catégories de signalement', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: COMMUNITY_SESSION, useValue: signal({ id: 'user123', pseudo: 'Maya974' }) },
      ],
    }),
  );

  it.each(REPORT_CATEGORIES)('enregistre $label depuis le référentiel', async (category) => {
    const result = await TestBed.inject(ReportService).createReport({ busId: 'b1', categoryId: category.id });
    expect(result.categoryId).toBe(category.id);
    expect(result.categoryLabel).toBe(category.label);
  });

  it('refuse les catégories absentes ou inconnues sans créer de signalement', async () => {
    const service = TestBed.inject(ReportService);
    await expect(service.createReport({ busId: 'b1', categoryId: '' })).rejects.toThrow('catégorie');
    await expect(service.createReport({ busId: 'b1', categoryId: 'inventee' })).rejects.toThrow('catégorie');
    expect(service.reports()).toHaveLength(0);
  });

  it('permet de sélectionner une seule catégorie parmi les cinq', () => {
    const fixture = TestBed.createComponent(ReportFormPage);
    fixture.detectChanges();
    const radios: NodeListOf<HTMLInputElement> = fixture.nativeElement.querySelectorAll('input[type="radio"]');
    expect(radios).toHaveLength(5);
    radios[0].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.form.controls.categoryId.value).toBe('c1');
    radios[3].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.form.controls.categoryId.value).toBe('c4');
    expect([...radios].filter((radio) => radio.checked)).toHaveLength(1);
  });

  it('explique une catégorie manquante et conserve le bus choisi', async () => {
    const fixture = TestBed.createComponent(ReportFormPage);
    fixture.componentInstance.form.controls.busId.setValue('b1');
    await fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#report-category-error').textContent).toContain(
      'Choisissez une catégorie.',
    );
    expect(fixture.componentInstance.form.controls.busId.value).toBe('b1');
    expect(TestBed.inject(ReportService).reports()).toHaveLength(0);
  });
});
