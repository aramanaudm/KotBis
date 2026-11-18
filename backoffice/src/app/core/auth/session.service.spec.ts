import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { environment } from '../../../environments/environment';
import { SessionService } from './session.service';

describe('SessionService', () => {
  let session: SessionService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), SessionService],
    });
    session = TestBed.inject(SessionService);
    http = TestBed.inject(HttpTestingController);
  });

  it('récupère le administrateur depuis l’API et autorise le back-office', async () => {
    window.history.replaceState({}, '', '/?token=token-de-test');
    const restauration = session.restore();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const requete = http.expectOne(`${environment.apiBaseUrl}/utilisateurs/moi`);
    expect(requete.request.headers.get('Authorization')).toBe('Bearer token-de-test');
    requete.flush({
      utilisateur: {
        email: 'admin.test@kotbis.fr',
        pseudo: 'Administrateur Test',
        role: 'administrateur',
      },
    });

    await restauration;
    expect(session.isAuthenticated()).toBe(true);
    expect(session.isAdmin()).toBe(true);
    expect(session.currentUser()?.name).toBe('Administrateur Test');
    expect(window.location.search).toBe('');
    expect(localStorage.getItem('kotbis.token')).toBe('token-de-test');
    http.verify();
  });

  it('reste visiteur quand le jeton est refusé', async () => {
    localStorage.setItem('kotbis.token', 'jeton-expire');
    const restauration = session.restore();
    await new Promise((resolve) => setTimeout(resolve, 0));
    http
      .expectOne(`${environment.apiBaseUrl}/utilisateurs/moi`)
      .flush({ erreur: 'Token expiré ou invalide.' }, { status: 401, statusText: 'Unauthorized' });

    await restauration;
    expect(session.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('kotbis.token')).toBeNull();
    http.verify();
  });
});
