import { FormControl, FormGroup } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import {
  emailValidator,
  identifierValidator,
  matchFields,
  passwordValidator,
  pseudoValidator,
} from './auth.validators';

const run = (validator: (c: FormControl) => unknown, value: string) =>
  validator(new FormControl(value));

describe('emailValidator', () => {
  it.each(['nom@exemple.com', 'a.b-c@sub.domaine.mu'])('accepte %s', (value) => {
    expect(run(emailValidator, value)).toBeNull();
  });

  it.each(['nom', 'nom@', 'nom@exemple', '@exemple.com', 'no m@exemple.com'])('refuse %s', (value) => {
    expect(run(emailValidator, value)).toEqual({ email: true });
  });
});

describe('pseudoValidator', () => {
  it.each(['nathan', 'Jean_Luc-2', 'élodie.1'])('accepte %s', (value) => {
    expect(run(pseudoValidator, value)).toBeNull();
  });

  it('refuse un pseudo trop court ou trop long', () => {
    expect(run(pseudoValidator, 'ab')).toEqual({ pseudo: true });
    expect(run(pseudoValidator, 'a'.repeat(21))).toEqual({ pseudo: true });
  });

  it('refuse un « @ » pour ne pas le confondre avec un e-mail', () => {
    expect(run(pseudoValidator, 'jean@dupont')).toEqual({ pseudoAt: true });
  });
});

describe('identifierValidator (BUS-FE-032)', () => {
  it('accepte indifféremment un e-mail ou un pseudo', () => {
    expect(run(identifierValidator, 'nom@exemple.com')).toBeNull();
    expect(run(identifierValidator, 'nethaneel')).toBeNull();
  });

  it('refuse ce qui n’est ni l’un ni l’autre', () => {
    expect(run(identifierValidator, 'nom@')).toEqual({ identifier: true });
    expect(run(identifierValidator, 'a')).toEqual({ identifier: true });
  });
});

describe('passwordValidator', () => {
  it('accepte 8 caractères avec lettre et chiffre', () => {
    expect(run(passwordValidator, 'abcdefg1')).toBeNull();
  });

  it('signale une longueur insuffisante', () => {
    expect(run(passwordValidator, 'abc1')).toEqual({ minlength: true });
  });

  it('signale l’absence de chiffre ou de lettre', () => {
    expect(run(passwordValidator, 'abcdefgh')).toEqual({ weak: true });
    expect(run(passwordValidator, '12345678')).toEqual({ weak: true });
  });
});

describe('matchFields (BUS-FE-030)', () => {
  const build = (password: string, confirmPassword: string) => {
    const group = new FormGroup(
      { password: new FormControl(password), confirmPassword: new FormControl(confirmPassword) },
      { validators: matchFields('password', 'confirmPassword') },
    );
    return group;
  };

  it('pose « mismatch » sur la confirmation quand les valeurs diffèrent', () => {
    const group = build('abcdefg1', 'abcdefg2');
    expect(group.errors).toEqual({ mismatch: true });
    expect(group.controls['confirmPassword'].hasError('mismatch')).toBe(true);
  });

  it('retire l’erreur quand les valeurs correspondent', () => {
    const group = build('abcdefg1', 'abcdefg2');
    group.controls['confirmPassword'].setValue('abcdefg1');
    expect(group.errors).toBeNull();
    expect(group.controls['confirmPassword'].hasError('mismatch')).toBe(false);
  });

  it('ne signale rien tant que la confirmation est vide', () => {
    expect(build('abcdefg1', '').errors).toBeNull();
  });
});
