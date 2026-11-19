import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { environment } from '../../../environments/environment';

import type { ApiUserProfile } from './auth.models';
import { AuthError } from './auth.models';
import { AuthService } from './auth.service';

const API = environment.apiUrl;
const alice = {
  pseudo: 'Alice',
  email: 'Alice@Exemple.com',
  password: 'motdepasse1',
  acceptTerms: true,
  city: 'Quatre Bornes',
  phone: '',
};

const profile: ApiUserProfile = {
  compteId: '42',
  identifiantPublic: 'b3a7c1e2-0000-4000-8000-000000000000',
  email: 'alice@exemple.com',
  role: 'voyageur',
  pseudo: 'Alice',
  avatarRef: null,
  zoneLibre: 'Quatre Bornes',
  telephone: null,
  creeLe: '2026-11-18T10:00:00.000Z',
};

const inOneDay = () => new Date(Date.now() + 86_400_000).toISOString();
const connexion = () => ({ jeton: 'jeton-1', expireLe: inOneDay(), utilisateur: profile });

/** Laisse s'exécuter les promesses en attente (enchaînement inscription → connexion, etc.). */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function apiError(status: number, code: string, message = 'Erreur') {
  return { body: { erreur: { code, message } }, init: { status, statusText: 'Erreur' } };
}

describe('AuthService (API KBE-22 / KBE-23)', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  function newService(): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  }

  async function loginAlice(): Promise<void> {
    const pending = auth.login('alice', alice.password);
    await settle();
    http.expectOne(`${API}/connexion`).flush(connexion());
    await pending;
  }

  beforeEach(() => {
    localStorage.clear();
    newService();
  });

  afterEach(() => http.verify());

  it('démarre en mode visiteur', () => {
    expect(auth.isLoggedIn()).toBe(false);
    expect(auth.user()).toBeNull();
    expect(auth.token()).toBeNull();
  });

  describe('inscription', () => {
    it('enregistre le compte via l’API, puis ouvre la session', async () => {
      const pending = auth.register(alice);
      await settle();

      const inscription = http.expectOne(`${API}/inscription`);
      expect(inscription.request.method).toBe('POST');
      expect(inscription.request.body).toEqual({
        pseudo: 'Alice',
        email: 'alice@exemple.com',
        motDePasse: 'motdepasse1',
        accepteConditions: true,
        zoneLibre: 'Quatre Bornes',
        telephone: null,
      });
      inscription.flush({ utilisateur: profile }, { status: 201, statusText: 'Created' });
      await settle();

      const login = http.expectOne(`${API}/connexion`);
      expect(login.request.body).toEqual({ identifiant: 'alice@exemple.com', motDePasse: 'motdepasse1' });
      login.flush(connexion());

      const user = await pending;
      expect(auth.isLoggedIn()).toBe(true);
      expect(user).toMatchObject({ id: '42', pseudo: 'Alice', email: 'alice@exemple.com', city: 'Quatre Bornes' });
      expect(user.counters).toEqual({ favoris: 0, alertes: 0, signalements: 0, avis: 0, points: 0 });
      expect(auth.token()).toBe('jeton-1');
    });

    it('ne conserve sur l’appareil ni mot de passe ni liste de comptes', async () => {
      const pending = auth.register(alice);
      await settle();
      http.expectOne(`${API}/inscription`).flush({ utilisateur: profile });
      await settle();
      http.expectOne(`${API}/connexion`).flush(connexion());
      await pending;

      const stored = JSON.stringify({ ...localStorage });
      expect(stored).not.toContain(alice.password);
      expect(stored).not.toContain('pmh.accounts');
      expect(stored).not.toMatch(/hash|salt/i);
    });

    it('traduit les conflits e-mail et pseudo, sans tenter de connexion', async () => {
      const email = auth.register(alice).catch((e: AuthError) => e);
      await settle();
      const emailError = apiError(409, 'EMAIL_DEJA_UTILISE');
      http.expectOne(`${API}/inscription`).flush(emailError.body, emailError.init);
      expect(await email).toMatchObject({ code: 'EMAIL_TAKEN' });

      const pseudo = auth.register(alice).catch((e: AuthError) => e);
      await settle();
      const pseudoError = apiError(409, 'PSEUDO_DEJA_UTILISE');
      http.expectOne(`${API}/inscription`).flush(pseudoError.body, pseudoError.init);
      expect(await pseudo).toMatchObject({ code: 'PSEUDO_TAKEN' });

      http.expectNone(`${API}/connexion`);
      expect(auth.isLoggedIn()).toBe(false);
    });

    it('affiche le message de validation du serveur (422)', async () => {
      const pending = auth.register(alice).catch((e: AuthError) => e);
      await settle();
      http
        .expectOne(`${API}/inscription`)
        .flush(
          {
            erreur: {
              code: 'DONNEES_INVALIDES',
              message: 'Données invalides',
              details: [{ champ: 'pseudo', message: 'Pseudo invalide.' }],
            },
          },
          { status: 422, statusText: 'Unprocessable' },
        );
      expect(await pending).toMatchObject({ code: 'INVALID_DATA', message: 'Pseudo invalide.' });
    });

    it('signale un serveur injoignable', async () => {
      const pending = auth.register(alice).catch((e: AuthError) => e);
      await settle();
      http.expectOne(`${API}/inscription`).error(new ProgressEvent('error'), { status: 0 });
      expect(await pending).toMatchObject({ code: 'NETWORK' });
    });
  });

  describe('connexion (BUS-FE-032 : e-mail ou pseudo)', () => {
    it('envoie l’identifiant tel quel au serveur', async () => {
      const pending = auth.login('  aLiCe ', alice.password);
      await settle();
      const request = http.expectOne(`${API}/connexion`);
      expect(request.request.body).toEqual({ identifiant: 'aLiCe', motDePasse: alice.password });
      request.flush(connexion());
      await pending;
      expect(auth.user()?.email).toBe('alice@exemple.com');
    });

    it('refuse des identifiants invalides avec un message générique', async () => {
      const pending = auth.login('alice', 'faux').catch((e: AuthError) => e);
      await settle();
      const error = apiError(401, 'IDENTIFIANTS_INVALIDES');
      http.expectOne(`${API}/connexion`).flush(error.body, error.init);
      const result = await pending;
      expect(result).toBeInstanceOf(AuthError);
      expect(result).toMatchObject({ code: 'INVALID_CREDENTIALS', message: 'Identifiant ou mot de passe incorrect.' });
      expect(auth.isLoggedIn()).toBe(false);
    });

    it('relaie le blocage après trop de tentatives (429)', async () => {
      const pending = auth.login('alice', 'faux').catch((e: AuthError) => e);
      await settle();
      const error = apiError(429, 'TROP_DE_TENTATIVES', 'Trop de tentatives.');
      http.expectOne(`${API}/connexion`).flush(error.body, error.init);
      expect(await pending).toMatchObject({ code: 'TOO_MANY_ATTEMPTS', message: 'Trop de tentatives.' });
    });
  });

  describe('session et déconnexion (BUS-FE-036)', () => {
    it('est restaurée au redémarrage puis renouvelée auprès du serveur', async () => {
      await loginAlice();
      newService();
      await auth.restore();
      expect(auth.user()?.pseudo).toBe('Alice');

      await settle();
      const renewal = http.expectOne(`${API}/renouvellement-session`);
      expect(renewal.request.headers.get('Authorization')).toBe('Bearer jeton-1');
      renewal.flush({ jeton: 'jeton-2', expireLe: inOneDay() });
      await settle();
      expect(auth.token()).toBe('jeton-2');
    });

    it('se ferme si le serveur refuse la session (révoquée ou expirée)', async () => {
      await loginAlice();
      newService();
      await auth.restore();
      await settle();
      const error = apiError(401, 'SESSION_INVALIDE');
      http.expectOne(`${API}/renouvellement-session`).flush(error.body, error.init);
      await settle();
      expect(auth.isLoggedIn()).toBe(false);
    });

    it('reste ouverte hors connexion jusqu’à son expiration', async () => {
      await loginAlice();
      newService();
      await auth.restore();
      await settle();
      http.expectOne(`${API}/renouvellement-session`).error(new ProgressEvent('error'), { status: 0 });
      await settle();
      expect(auth.isLoggedIn()).toBe(true);
    });

    it('ignore une session expirée sans appeler le serveur', async () => {
      localStorage.setItem(
        'CapacitorStorage.kotbis.session',
        JSON.stringify({ token: 'vieux', expiresAt: '2020-01-01T00:00:00.000Z', user: { id: '1' } }),
      );
      await auth.restore();
      expect(auth.isLoggedIn()).toBe(false);
      expect(localStorage.getItem('CapacitorStorage.kotbis.session')).toBeNull();
    });

    it('efface les comptes de l’ancienne implémentation locale', async () => {
      localStorage.setItem('CapacitorStorage.pmh.accounts', '[{"passwordHash":"x"}]');
      localStorage.setItem('CapacitorStorage.pmh.session', '"abc"');
      localStorage.setItem('CapacitorStorage.pmh.resets', '[]');
      await auth.restore();
      expect(Object.keys(localStorage).filter((key) => key.includes('pmh.'))).toEqual([]);
      expect(auth.isLoggedIn()).toBe(false);
    });

    it('révoque la session côté serveur et revient à l’état visiteur, y compris au redémarrage', async () => {
      await loginAlice();
      const pending = auth.logout();
      await settle();
      const request = http.expectOne(`${API}/deconnexion`);
      expect(request.request.headers.get('Authorization')).toBe('Bearer jeton-1');
      request.flush(null, { status: 204, statusText: 'No Content' });
      await pending;
      expect(auth.isLoggedIn()).toBe(false);

      newService();
      await auth.restore();
      expect(auth.isLoggedIn()).toBe(false);
    });
  });

  describe('récupération du mot de passe (BUS-FE-033, en attente de KBE-24)', () => {
    it('indique que le service n’est pas disponible et ne génère aucun code local', async () => {
      await expect(auth.requestPasswordReset('alice@exemple.com')).rejects.toMatchObject({ code: 'UNAVAILABLE' });
      await expect(auth.confirmPasswordReset('alice@exemple.com', '123456', 'nouveaupass9')).rejects.toMatchObject({
        code: 'UNAVAILABLE',
      });
      expect(Object.keys(localStorage)).toEqual([]);
    });
  });
});
