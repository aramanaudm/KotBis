import { TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthError } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';

import { RegisterModalComponent } from './register-modal.component';

/** Accès aux membres protégés pour tester la logique sans rendre les web components Ionic. */
interface Internals {
  form: any;
  submit(): Promise<void>;
  dismiss(role: 'cancel' | 'login'): Promise<boolean>;
  serverError(): string | null;
}

describe('RegisterModalComponent (BUS-FE-028/029/030)', () => {
  const register = vi.fn();
  const dismiss = vi.fn().mockResolvedValue(true);
  let modal: Internals;

  const fill = (overrides: Record<string, unknown> = {}) =>
    modal.form.setValue({
      pseudo: 'Maya974',
      email: 'maya@email.com',
      city: '',
      phone: '',
      password: 'motdepasse1',
      confirmPassword: 'motdepasse1',
      terms: true,
      ...overrides,
    });

  beforeEach(() => {
    register.mockReset();
    dismiss.mockClear();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { register } },
        { provide: ModalController, useValue: { dismiss } },
      ],
    });
    modal = TestBed.runInInjectionContext(() => new RegisterModalComponent()) as unknown as Internals;
  });

  it('expose les champs de la maquette', () => {
    expect(Object.keys(modal.form.controls)).toEqual([
      'pseudo',
      'email',
      'city',
      'phone',
      'password',
      'confirmPassword',
      'terms',
    ]);
  });

  it('ne rend facultatifs que « Ville ou zone » et « Téléphone »', () => {
    fill(); // ville et téléphone vides
    expect(modal.form.valid).toBe(true);

    const blanks: Record<string, unknown> = {
      pseudo: '',
      email: '',
      password: '',
      confirmPassword: '',
      terms: false,
    };
    for (const [name, empty] of Object.entries(blanks)) {
      fill({ [name]: empty, ...(name === 'password' ? { confirmPassword: '' } : {}) });
      expect(modal.form.valid, `« ${name} » vide doit bloquer l’envoi`).toBe(false);
    }
  });

  it('empêche l’envoi d’un formulaire vide et fait apparaître les erreurs', async () => {
    await modal.submit();
    expect(register).not.toHaveBeenCalled();
    expect(modal.form.controls.pseudo.touched).toBe(true);
    expect(modal.form.controls.terms.touched).toBe(true);
  });

  it('refuse des mots de passe différents', async () => {
    fill({ confirmPassword: 'autrechose1' });
    await modal.submit();
    expect(register).not.toHaveBeenCalled();
    expect(modal.form.controls.confirmPassword.hasError('mismatch')).toBe(true);
  });

  it('refuse sans l’acceptation des conditions', async () => {
    fill({ terms: false });
    await modal.submit();
    expect(register).not.toHaveBeenCalled();
  });

  it('refuse un téléphone invalide mais accepte un numéro mauricien', async () => {
    fill({ phone: 'abc' });
    expect(modal.form.controls.phone.hasError('phone')).toBe(true);
    fill({ phone: '+230 5123 4567' });
    expect(modal.form.controls.phone.valid).toBe(true);
  });

  it('envoie les champs facultatifs puis ferme la carte avec « done »', async () => {
    register.mockResolvedValue({});
    fill({ city: 'Quatre Bornes', phone: '+230 5123 4567' });
    await modal.submit();
    expect(register).toHaveBeenCalledWith({
      pseudo: 'Maya974',
      email: 'maya@email.com',
      city: 'Quatre Bornes',
      phone: '+230 5123 4567',
      password: 'motdepasse1',
    });
    expect(dismiss).toHaveBeenCalledWith(null, 'done');
  });

  it('affiche l’erreur du service (pseudo pris) sans fermer la carte', async () => {
    register.mockRejectedValue(new AuthError('PSEUDO_TAKEN', 'Ce pseudo est déjà utilisé.'));
    fill();
    await modal.submit();
    expect(modal.serverError()).toBe('Ce pseudo est déjà utilisé.');
    expect(dismiss).not.toHaveBeenCalled();
  });

  it('se ferme avec le rôle « cancel » ou « login » pour enchaîner les cartes', async () => {
    await modal.dismiss('cancel');
    expect(dismiss).toHaveBeenLastCalledWith(null, 'cancel');
    await modal.dismiss('login');
    expect(dismiss).toHaveBeenLastCalledWith(null, 'login');
  });
});
