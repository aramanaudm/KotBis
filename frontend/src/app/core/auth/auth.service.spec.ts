import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthError } from './auth.models';
import { AuthService } from './auth.service';

const alice = { pseudo: 'Alice', email: 'alice@exemple.com', password: 'motdepasse1' };
const bob = { pseudo: 'Bob', email: 'bob@exemple.com', password: 'autrepasse2' };

function newService(): AuthService {
  TestBed.resetTestingModule();
  return TestBed.inject(AuthService);
}

describe('AuthService', () => {
  let auth: AuthService;

  beforeEach(() => {
    localStorage.clear();
    auth = newService();
  });

  it('démarre en mode visiteur', () => {
    expect(auth.isLoggedIn()).toBe(false);
    expect(auth.user()).toBeNull();
  });

  describe('inscription', () => {
    it('crée le compte, ouvre la session et n’expose aucun secret', async () => {
      const user = await auth.register(alice);
      expect(auth.isLoggedIn()).toBe(true);
      expect(user.pseudo).toBe('Alice');
      expect(user.counters).toEqual({ favoris: 0, alertes: 0, signalements: 0, avis: 0, points: 0 });
      expect(Object.keys(user)).not.toContain('passwordHash');
      expect(Object.keys(user)).not.toContain('salt');
    });

    it('ne stocke pas le mot de passe en clair', async () => {
      await auth.register(alice);
      expect(JSON.stringify({ ...localStorage })).not.toContain(alice.password);
    });

    it('refuse un pseudo ou un e-mail déjà pris (sans tenir compte de la casse)', async () => {
      await auth.register(alice);
      await auth.logout();
      await expect(auth.register({ ...bob, pseudo: 'ALICE' })).rejects.toMatchObject({ code: 'PSEUDO_TAKEN' });
      await expect(auth.register({ ...bob, email: 'Alice@Exemple.com' })).rejects.toMatchObject({
        code: 'EMAIL_TAKEN',
      });
    });
  });

  describe('connexion (BUS-FE-032 : e-mail ou pseudo)', () => {
    beforeEach(async () => {
      await auth.register(alice);
      await auth.logout();
    });

    it('accepte l’e-mail', async () => {
      await auth.login('alice@exemple.com', alice.password);
      expect(auth.user()?.pseudo).toBe('Alice');
    });

    it('accepte le pseudo, sans tenir compte de la casse', async () => {
      await auth.login('aLiCe', alice.password);
      expect(auth.user()?.email).toBe('alice@exemple.com');
    });

    it('donne le même message pour un mauvais mot de passe et un compte inconnu', async () => {
      const wrongPassword = await auth.login('alice', 'faux').catch((e: AuthError) => e);
      const unknown = await auth.login('inconnu', alice.password).catch((e: AuthError) => e);
      expect(wrongPassword).toBeInstanceOf(AuthError);
      expect(unknown).toBeInstanceOf(AuthError);
      expect((wrongPassword as AuthError).message).toBe((unknown as AuthError).message);
      expect(auth.isLoggedIn()).toBe(false);
    });
  });

  describe('session et déconnexion (BUS-FE-036)', () => {
    it('est restaurée au redémarrage de l’application', async () => {
      await auth.register(alice);
      const restarted = newService();
      expect(restarted.isLoggedIn()).toBe(false);
      await restarted.restore();
      expect(restarted.user()?.pseudo).toBe('Alice');
    });

    it('revient à l’état visiteur après déconnexion, y compris au redémarrage', async () => {
      await auth.register(alice);
      await auth.logout();
      expect(auth.isLoggedIn()).toBe(false);
      expect(auth.user()).toBeNull();

      const restarted = newService();
      await restarted.restore();
      expect(restarted.isLoggedIn()).toBe(false);
    });
  });

  describe('isolation des comptes (BUS-FE-035)', () => {
    it('n’expose que le compte connecté', async () => {
      await auth.register(alice);
      await auth.logout();
      await auth.register(bob);
      expect(auth.user()?.pseudo).toBe('Bob');
      expect(JSON.stringify(auth.user())).not.toContain('alice');
    });
  });

  describe('récupération du mot de passe (BUS-FE-033)', () => {
    beforeEach(async () => {
      await auth.register(alice);
      await auth.logout();
    });

    it('fournit un code (mode développement) pour un e-mail connu', async () => {
      const { devCode } = await auth.requestPasswordReset('alice@exemple.com');
      expect(devCode).toMatch(/^\d{6}$/);
    });

    it('ne révèle pas si l’e-mail existe', async () => {
      await expect(auth.requestPasswordReset('inconnu@exemple.com')).resolves.toEqual({});
    });

    it('change le mot de passe avec le bon code', async () => {
      const { devCode } = await auth.requestPasswordReset('alice@exemple.com');
      await auth.confirmPasswordReset('alice@exemple.com', devCode!, 'nouveaupass9');
      await expect(auth.login('alice', alice.password)).rejects.toBeInstanceOf(AuthError);
      await auth.login('alice', 'nouveaupass9');
      expect(auth.isLoggedIn()).toBe(true);
    });

    it('refuse un mauvais code, puis ne permet pas de réutiliser un code consommé', async () => {
      const { devCode } = await auth.requestPasswordReset('alice@exemple.com');
      await expect(
        auth.confirmPasswordReset('alice@exemple.com', '000000', 'nouveaupass9'),
      ).rejects.toMatchObject({ code: 'INVALID_RESET_CODE' });

      await auth.confirmPasswordReset('alice@exemple.com', devCode!, 'nouveaupass9');
      await expect(
        auth.confirmPasswordReset('alice@exemple.com', devCode!, 'encoreautre3'),
      ).rejects.toMatchObject({ code: 'INVALID_RESET_CODE' });
    });
  });
});
