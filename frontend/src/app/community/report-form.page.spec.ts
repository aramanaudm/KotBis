import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { REPORT_API_TOKEN } from './api-session.service';
import { COMMUNITY_SESSION } from './community-session';
import type { CommunityUser } from './community-session';
import { ReportFormPage } from './report-form.page';
import type { BusReport } from './report.model';
import { ReportService } from './report.service';

describe('SCRUM-64 — formulaire de signalement', () => {
  const session = signal<CommunityUser | null>(null);
  const rapport: BusReport = {
    id: 'SIG-ABC123',
    busId: 'b1',
    busLine: '4A',
    categoryId: 'c1',
    categoryLabel: 'Retard important',
    userId: 'user123',
    userName: 'Maya974',
    status: 'A_VERIFIER',
    createdAt: '2026-11-19T08:01:00.000Z',
  };

  beforeEach(() => {
    session.set({ id: 'user123', pseudo: 'Maya974' });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: COMMUNITY_SESSION, useValue: session },
        { provide: REPORT_API_TOKEN, useValue: 'jeton-test' },
      ],
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('bloque les visiteurs et propose une sortie vers la carte', () => {
    session.set(null);
    const fixture = TestBed.createComponent(ReportFormPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('a[aria-label="Retour"]').getAttribute('href')).toBe('/home');
  });

  it('affiche une erreur si aucun bus n’est sélectionné', async () => {
    const fixture = TestBed.createComponent(ReportFormPage);
    await fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#report-bus-error').textContent).toContain('Sélectionnez un bus.');
    expect(TestBed.inject(ReportService).reports()).toHaveLength(0);
  });

  it('envoie une seule fois et affiche le reçu', async () => {
    const fixture = TestBed.createComponent(ReportFormPage);
    const page = fixture.componentInstance;
    const create = vi.spyOn(TestBed.inject(ReportService), 'createReport').mockResolvedValue(rapport);
    page.form.setValue({
      busId: 'b1',
      categoryId: 'c1',
      commentaire: '',
      consentementGps: false,
    });

    await Promise.all([page.submit(), page.submit()]);
    fixture.detectChanges();

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toMatchObject({
      busId: 'b1',
      categoryId: 'c1',
      commentaire: '',
    });
    expect(fixture.nativeElement.textContent).toContain('Statut : À vérifier');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();

    page.startAgain();
    expect(page.form.controls.busId.value).toBe('');
    expect(page.cleIdempotence()).toBeNull();
    expect(page.receipt()).toBeNull();
  });

  it('réutilise la clé d’idempotence en cas de renvoi après erreur', async () => {
    const fixture = TestBed.createComponent(ReportFormPage);
    const page = fixture.componentInstance;
    const create = vi
      .spyOn(TestBed.inject(ReportService), 'createReport')
      .mockRejectedValueOnce(new Error('Indisponible'))
      .mockResolvedValue(rapport);
    page.form.setValue({
      busId: 'b1',
      categoryId: 'c1',
      commentaire: 'Bus bondé',
      consentementGps: false,
    });

    await page.submit();
    expect(page.error()).toBe('Indisponible');
    const cle = page.cleIdempotence();
    expect(cle).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

    await page.submit();
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][0].cleIdempotence).toBe(cle);
    expect(create.mock.calls[1][0].cleIdempotence).toBe(cle);
    expect(create.mock.calls[1][0].commentaire).toBe('Bus bondé');
    expect(page.error()).toBe('');
    expect(page.receipt()).toBe(rapport);
  });

  it('conserve la sélection lors d’une erreur', async () => {
    const fixture = TestBed.createComponent(ReportFormPage);
    const page = fixture.componentInstance;
    vi.spyOn(TestBed.inject(ReportService), 'createReport').mockRejectedValue(new Error('Indisponible'));
    page.form.setValue({
      busId: 'b1',
      categoryId: 'c1',
      commentaire: '',
      consentementGps: false,
    });

    await page.submit();
    expect(page.form.controls.busId.value).toBe('b1');
    expect(page.error()).toBe('Indisponible');
    expect(page.busy()).toBe(false);
  });
});
