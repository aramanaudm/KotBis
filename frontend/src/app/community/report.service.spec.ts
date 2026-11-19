import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../environments/environment';

import { REPORT_API_TOKEN } from './api-session.service';
import { COMMUNITY_SESSION } from './community-session';
import type { CommunityUser } from './community-session';
import { ReportService } from './report.service';

describe('SCRUM-64 — envoi des signalements à l’API', () => {
  const session = signal<CommunityUser | null>(null);
  const url = `${environment.apiUrl}/api/signalements`;
  const cle = '11111111-1111-4111-8111-111111111111';
  let http: HttpTestingController;

  beforeEach(() => {
    session.set({ id: 'user123', pseudo: 'Maya974' });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: COMMUNITY_SESSION, useValue: session },
        { provide: REPORT_API_TOKEN, useValue: 'jeton-test' },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('envoie le payload attendu avec la clé d’idempotence et le jeton', async () => {
    const service = TestBed.inject(ReportService);
    const promesse = service.createReport({
      busId: 'b2',
      categoryId: 'c1',
      commentaire: 'Bus bondé',
      observeLe: '2026-11-19T08:00:00.000Z',
      cleIdempotence: cle,
      position: { latitude: -20.16, longitude: 57.5 },
    });

    await Promise.resolve();
    const requete = http.expectOne(url);
    expect(requete.request.method).toBe('POST');
    expect(requete.request.headers.get('Authorization')).toBe('Bearer jeton-test');
    expect(requete.request.body).toMatchObject({
      busId: '2',
      categorie: 'c1',
      commentaire: 'Bus bondé',
      observeLe: '2026-11-19T08:00:00.000Z',
      cleIdempotence: cle,
      consentementGps: true,
      position: { latitude: -20.16, longitude: 57.5 },
    });

    requete.flush({
      success: true,
      idempotent: false,
      data: {
        reference: 'SIG-ABC123',
        auteurId: 'user123',
        busId: '2',
        categorie: 'c1',
        statut: 'a_verifier',
        recuLe: '2026-11-19T08:01:00.000Z',
      },
    });

    const rapport = await promesse;
    expect(rapport).toMatchObject({
      id: 'SIG-ABC123',
      busId: '2',
      busLine: '12',
      categoryLabel: 'Retard important',
      userName: 'Maya974',
      status: 'A_VERIFIER',
    });
    expect(service.reports()).toEqual([rapport]);
  });

  it('n’envoie ni position ni consentement sans GPS autorisé', async () => {
    const service = TestBed.inject(ReportService);
    const promesse = service.createReport({
      busId: 'b1',
      categoryId: 'c3',
      commentaire: '',
      observeLe: '2026-11-19T08:00:00.000Z',
      cleIdempotence: cle,
    });

    await Promise.resolve();
    const requete = http.expectOne(url);
    expect(requete.request.body).not.toHaveProperty('position');
    expect(requete.request.body).not.toHaveProperty('consentementGps');
    requete.flush({
      success: true,
      idempotent: false,
      data: {
        reference: 'SIG-DEF456',
        auteurId: 'user123',
        busId: '1',
        categorie: 'c3',
        statut: 'a_verifier',
        recuLe: '2026-11-19T08:01:00.000Z',
      },
    });

    await expect(promesse).resolves.toMatchObject({ status: 'A_VERIFIER' });
  });

  it('refuse un visiteur et un bus inconnu sans appel réseau', async () => {
    const service = TestBed.inject(ReportService);
    const donnees = {
      busId: 'absent',
      categoryId: 'c1',
      commentaire: '',
      observeLe: '2026-11-19T08:00:00.000Z',
      cleIdempotence: cle,
    };

    await expect(service.createReport(donnees)).rejects.toThrow('bus');
    session.set(null);
    await expect(service.createReport({ ...donnees, busId: 'b1' })).rejects.toThrow('connecté');
    http.expectNone(url);
    expect(service.reports()).toHaveLength(0);
  });
});
