import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** E-mail avec domaine et extension obligatoires (Validators.email accepte « a@b »). */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Pseudo : 3 à 20 caractères, lettres/chiffres/._- ; jamais de « @ » pour ne pas le confondre avec un e-mail. */
export const PSEUDO_PATTERN = /^[\p{L}\p{N}._-]{3,20}$/u;

export const PASSWORD_MIN_LENGTH = 8;

/** Téléphone facultatif : chiffres, espaces, « + », tirets, points et parenthèses (6 à 20 caractères). */
export const PHONE_PATTERN = /^\+?[\d\s().-]{6,20}$/;

export function isEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export function isPseudo(value: string): boolean {
  return PSEUDO_PATTERN.test(value.trim());
}

const isBlank = (value: unknown): boolean => value === null || value === undefined || String(value).trim() === '';

export const emailValidator: ValidatorFn = (control) =>
  isBlank(control.value) || isEmail(String(control.value)) ? null : { email: true };

/** Champ facultatif : vide = valide ; sinon doit ressembler à un numéro (avec au moins 6 chiffres). */
export const phoneValidator: ValidatorFn = (control) => {
  if (isBlank(control.value)) return null;
  const value = String(control.value).trim();
  const digits = value.replace(/\D/g, '').length;
  return PHONE_PATTERN.test(value) && digits >= 6 ? null : { phone: true };
};

export const pseudoValidator: ValidatorFn = (control) => {
  if (isBlank(control.value)) return null;
  const value = String(control.value).trim();
  if (value.includes('@')) return { pseudoAt: true };
  return isPseudo(value) ? null : { pseudo: true };
};

/** BUS-FE-032 : le champ identifiant accepte un e-mail OU un pseudo valides. */
export const identifierValidator: ValidatorFn = (control) => {
  if (isBlank(control.value)) return null;
  const value = String(control.value).trim();
  return isEmail(value) || isPseudo(value) ? null : { identifier: true };
};

/** Mot de passe : longueur minimale, au moins une lettre et un chiffre. */
export const passwordValidator: ValidatorFn = (control) => {
  if (isBlank(control.value)) return null;
  const value = String(control.value);
  const errors: ValidationErrors = {};
  if (value.length < PASSWORD_MIN_LENGTH) errors['minlength'] = true;
  if (!/\p{L}/u.test(value) || !/\p{N}/u.test(value)) errors['weak'] = true;
  return Object.keys(errors).length ? errors : null;
};

/** Validateur de groupe : pose l'erreur « mismatch » sur le champ de confirmation (BUS-FE-030). */
export function matchFields(source: string, confirmation: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const sourceControl = group.get(source);
    const confirmationControl = group.get(confirmation);
    if (!sourceControl || !confirmationControl) return null;

    const mismatch =
      !isBlank(confirmationControl.value) && sourceControl.value !== confirmationControl.value;

    const current = confirmationControl.errors ?? {};
    if (mismatch) {
      confirmationControl.setErrors({ ...current, mismatch: true });
    } else if ('mismatch' in current) {
      const { mismatch: _removed, ...rest } = current;
      confirmationControl.setErrors(Object.keys(rest).length ? rest : null);
    }
    return mismatch ? { mismatch: true } : null;
  };
}
