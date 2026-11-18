import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { StorageService } from '../storage/storage.service';

import { AuthError } from './auth.models';
import { HttpAuthGateway } from './http-auth.gateway';

const api = 'http://localhost:3000/api';
const utilisateur = {
  id: 7,
  email: 'voyageur.test@kotbis.fr',
  pseudo: 'voyageur_test',
  city: 'Paris',
  phone: '+33 1 23 45 67 89',
  role: 'voyageur',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('HttpAuthGateway', () => {
  let gateway: HttpAuthGateway;
  let http: HttpTestingController;
  let storage: StorageService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), HttpAuthGateway],
    });
    gateway = TestBed.inject(HttpAuthGateway);
    http = TestBed.inject(HttpTestingController);
    storage = TestBed.inject(StorageService);
  });

  it('envoie la connexion au backend et expose le role', async () => {
    const connexion = gateway.login('VOYAGEUR_TEST', 'Voyageur123!');
    const requete = http.expectOne(`${api}/connexion`);
    expect(requete.request.body).toEqual({
      identifiant: 'voyageur_test',
      motDePasse: 'Voyageur123!',
    });
    requete.flush({ token: 'jeton-de-test', utilisateur });

    const user = await connexion;
    expect(user.id).toBe('7');
    expect(user.role).toBe('voyageur');
    expect(await gateway.token()).toBe('jeton-de-test');
    http.verify();
  });

  it('ignore les espaces copiés autour du mot de passe', async () => {
    const connexion = gateway.login(' admin.test@kotbis.fr ', ' Admin123! ');
    const requete = http.expectOne(`${api}/connexion`);
    expect(requete.request.body).toEqual({
      identifiant: 'admin.test@kotbis.fr',
      motDePasse: 'Admin123!',
    });
    requete.flush({
      token: 'jeton-admin',
      utilisateur: { ...utilisateur, role: 'administrateur', pseudo: 'Administrateur Test' },
    });

    expect((await connexion).role).toBe('administrateur');
    http.verify();
  });

  it('restaure la session et le role via le profil backend', async () => {
    await storage.set('pmh.session', {
      token: 'jeton-de-test',
      user: { ...utilisateur, id: '7' },
    });
    const restauration = gateway.restore();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const requete = http.expectOne(`${api}/utilisateurs/moi`);
    expect(requete.request.headers.get('Authorization')).toBe('Bearer jeton-de-test');
    requete.flush({
      utilisateur: { ...utilisateur, role: 'administrateur', pseudo: 'Administrateur Test' },
    });

    expect((await restauration)?.role).toBe('administrateur');
    http.verify();
  });

  it('mappe les erreurs d’identifiants en AuthError', async () => {
    const connexion = gateway.login('inconnu', 'mauvais');
    http
      .expectOne(`${api}/connexion`)
      .flush({ erreur: 'Identifiants invalides.' }, { status: 401, statusText: 'Unauthorized' });
    await expect(connexion).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      message: 'Identifiants invalides.',
    });
    http.verify();
  });

  it('envoie l’inscription avec les champs attendus par l’API', async () => {
    const inscription = gateway.register({
      pseudo: 'Alice',
      email: 'Alice@Exemple.com',
      city: 'Lyon',
      phone: '0600000000',
      password: 'motdepasse1',
    });
    const requete = http.expectOne(`${api}/inscription`);
    expect(requete.request.body).toEqual({
      pseudo: 'Alice',
      email: 'alice@exemple.com',
      city: 'Lyon',
      phone: '0600000000',
      password: 'motdepasse1',
    });
    requete.flush({ token: 'jeton-inscription', utilisateur: { ...utilisateur, pseudo: 'Alice' } });

    expect((await inscription).pseudo).toBe('Alice');
    http.verify();
  });

  it('mappe un code de reset invalide en AuthError', async () => {
    const confirmation = gateway.confirmPasswordReset('x@y.fr', '000000', 'nouveaupass9');
    http
      .expectOne(`${api}/mot-de-passe/reinitialiser`)
      .flush({ erreur: 'Code invalide ou expiré.' }, { status: 400, statusText: 'Bad Request' });
    const erreur = await confirmation.catch((e: unknown) => e);
    expect(erreur).toBeInstanceOf(AuthError);
    expect(erreur).toMatchObject({ code: 'INVALID_RESET_CODE' });
    http.verify();
  });
});
