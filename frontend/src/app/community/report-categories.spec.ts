import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from '../../environments/environment';

import { REPORT_API_TOKEN } from './api-session.service';
import { COMMUNITY_SESSION } from './community-session';
import { REPORT_CATEGORIES } from './report-categories';
import { ReportFormPage } from './report-form.page';
import { ReportService } from './report.service';

describe('SCRUM-65 — catégories de signalement', () => {
  const url = `${environment.apiUrl}/api/signalements`;
  const cle = '11111111-1111-4111-8111-111111111111';
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: COMMUNITY_SESSION, useValue: signal({ id: 'user123', pseudo: 'Maya974' }) },
        { provide: REPORT_API_TOKEN, useValue: 'jeton-test' },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it.each(REPORT_CATEGORIES)('enregistre $label depuis le référentiel', async (category) => {
    const promesse = TestBed.inject(ReportService).createReport({
      busId: 'b1',
      categoryId: category.id,
      commentaire: '',
      observeLe: '2026-11-19T08:00:00.000Z',
      cleIdempotence: cle,
    });

    await Promise.resolve();
    http.expectOne(url).flush({
      success: true,
      idempotent: false,
      data: {
        reference: `SIG-${category.id}`,
        auteurId: 'user123',
        busId: '1',
        categorie: category.id,
        statut: 'a_verifier',
        recuLe: '2026-11-19T08:01:00.000Z',
      },
    });

    const result = await promesse;
    expect(result.categoryId).toBe(category.id);
    expect(result.categoryLabel).toBe(category.label);
  });

  it('refuse les catégories absentes ou inconnues sans créer de signalement', async () => {
    const service = TestBed.inject(ReportService);
    const donnees = {
      busId: 'b1',
      commentaire: '',
      observeLe: '2026-11-19T08:00:00.000Z',
      cleIdempotence: cle,
    };
    await expect(service.createReport({ ...donnees, categoryId: '' })).rejects.toThrow('catégorie');
    await expect(service.createReport({ ...donnees, categoryId: 'inventee' })).rejects.toThrow('catégorie');
    http.expectNone(url);
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
