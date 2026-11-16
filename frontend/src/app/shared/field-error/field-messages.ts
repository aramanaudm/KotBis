/** Messages d'erreur partagés par les formulaires d'authentification (ordre = priorité). */

export const PSEUDO_MESSAGES: Record<string, string> = {
  required: 'Le pseudo est obligatoire.',
  pseudoAt: 'Le pseudo ne peut pas contenir « @ ».',
  pseudo: '3 à 20 caractères : lettres, chiffres, point, tiret ou underscore.',
};

export const EMAIL_MESSAGES: Record<string, string> = {
  required: "L'e-mail est obligatoire.",
  email: 'Saisissez un e-mail valide, par exemple nom@exemple.com.',
};

export const PHONE_MESSAGES: Record<string, string> = {
  phone: 'Saisissez un numéro valide, par exemple +230 5123 4567.',
};

export const CITY_MESSAGES: Record<string, string> = {
  maxlength: 'La ville ou la zone ne peut pas dépasser 60 caractères.',
};

export const PASSWORD_MESSAGES: Record<string, string> = {
  required: 'Le mot de passe est obligatoire.',
  minlength: 'Le mot de passe doit contenir au moins 8 caractères.',
  weak: 'Le mot de passe doit contenir au moins une lettre et un chiffre.',
};

export const CONFIRM_PASSWORD_MESSAGES: Record<string, string> = {
  required: 'Confirmez votre mot de passe.',
  mismatch: 'Les mots de passe ne correspondent pas.',
};

export const IDENTIFIER_MESSAGES: Record<string, string> = {
  required: 'Saisissez votre e-mail ou votre pseudo.',
  identifier: 'Saisissez un e-mail valide ou un pseudo (3 à 20 caractères, sans « @»).',
};

export const LOGIN_PASSWORD_MESSAGES: Record<string, string> = {
  required: 'Le mot de passe est obligatoire.',
};

export const RESET_CODE_MESSAGES: Record<string, string> = {
  required: 'Saisissez le code reçu.',
  pattern: 'Le code est composé de 6 chiffres.',
};

export const TERMS_MESSAGES: Record<string, string> = {
  required: "Vous devez accepter les conditions d'utilisation.",
};
