import { ErreurValidation } from "../commun/erreurs";
import type {
  ChampsProfilModifiables,
  DonneesChangementEmail,
  DonneesChangementMotDePasse,
  DonneesConnexion,
  DonneesInscription,
  DonneesReinitialisation,
  DonneesSuppressionCompte
} from "./types";

const LONGUEUR_MAX_EMAIL = 254;
const LONGUEUR_MIN_MOT_DE_PASSE = 8;
const LONGUEUR_MAX_MOT_DE_PASSE = 128;
const LONGUEUR_MIN_PSEUDO = 3;
const LONGUEUR_MAX_PSEUDO = 20;
const LONGUEUR_MAX_ZONE = 60;
const LONGUEUR_MAX_TELEPHONE = 20;

const PSEUDO_VALIDE = /^[\p{L}\p{N}._-]+$/u;
const EMAIL_VALIDE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TELEPHONE_VALIDE = /^\+?[\d\s().-]{6,20}$/;
const LETTRE = /\p{L}/u;
const CHIFFRE = /\p{N}/u;
const CARACTERES_CONTROLE = /[\u0000-\u001F\u007F]/;

const CHAMPS_IDENTIFIANT = ["identifiant", "identifier", "email", "pseudo", "pseudonyme"] as const;
const CHAMPS_MOT_DE_PASSE = ["motDePasse", "password"] as const;
const CHAMPS_MOT_DE_PASSE_ACTUEL = ["motDePasseActuel", "currentPassword"] as const;
const CHAMPS_NOUVEAU_MOT_DE_PASSE = ["nouveauMotDePasse", "newPassword"] as const;
const CHAMPS_NOUVEAU_MOT_DE_PASSE_REINITIALISATION = [
  ...CHAMPS_NOUVEAU_MOT_DE_PASSE,
  "password"
] as const;
const CHAMPS_PSEUDO = ["pseudo", "pseudonyme"] as const;
const CHAMPS_ZONE = ["zoneLibre", "city", "ville"] as const;
const CHAMPS_TELEPHONE = ["telephone", "phone"] as const;
const CHAMPS_CONDITIONS = ["accepteConditions", "conditionsAcceptees"] as const;

function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return typeof valeur === "object" && valeur !== null && !Array.isArray(valeur);
}

function erreurChamp(champ: string, message: string): ErreurValidation {
  return new ErreurValidation(message, [{ champ, message }]);
}

function lireChamp(corps: Record<string, unknown>, noms: readonly string[]): unknown {
  for (const nom of noms) {
    if (nom in corps) {
      return corps[nom];
    }
  }
  return undefined;
}

function champFourni(corps: Record<string, unknown>, noms: readonly string[]): boolean {
  return noms.some((nom) => nom in corps);
}

function texteObligatoire(valeur: unknown, champ: string, longueurMax: number): string {
  if (typeof valeur !== "string") {
    throw erreurChamp(champ, `Le champ ${champ} est obligatoire.`);
  }

  const texte = valeur.trim();
  if (!texte) {
    throw erreurChamp(champ, `Le champ ${champ} est obligatoire.`);
  }
  if (texte.length > longueurMax) {
    throw erreurChamp(champ, `Le champ ${champ} ne doit pas dépasser ${longueurMax} caractères.`);
  }
  return texte;
}

function texteOptionnel(valeur: unknown, champ: string, longueurMax: number): string | null {
  if (valeur === undefined || valeur === null) {
    return null;
  }
  if (typeof valeur !== "string") {
    throw erreurChamp(champ, `Le champ ${champ} doit être un texte.`);
  }

  const texte = valeur.trim();
  if (!texte) {
    return null;
  }
  if (texte.length > longueurMax) {
    throw erreurChamp(champ, `Le champ ${champ} ne doit pas dépasser ${longueurMax} caractères.`);
  }
  return texte;
}

function validerEmail(valeur: unknown): string {
  const email = texteObligatoire(valeur, "email", LONGUEUR_MAX_EMAIL).toLowerCase();
  if (!EMAIL_VALIDE.test(email)) {
    throw erreurChamp("email", "L'adresse e-mail n'est pas valide.");
  }
  return email;
}

function validerMotDePasse(valeur: unknown, champ: string): string {
  if (typeof valeur !== "string") {
    throw erreurChamp(champ, `Le champ ${champ} est obligatoire.`);
  }
  if (valeur.length < LONGUEUR_MIN_MOT_DE_PASSE || valeur.length > LONGUEUR_MAX_MOT_DE_PASSE) {
    throw erreurChamp(
      champ,
      `Le mot de passe doit contenir entre ${LONGUEUR_MIN_MOT_DE_PASSE} et ${LONGUEUR_MAX_MOT_DE_PASSE} caractères.`
    );
  }
  if (CARACTERES_CONTROLE.test(valeur)) {
    throw erreurChamp(champ, "Le mot de passe contient des caractères non autorisés.");
  }
  if (!LETTRE.test(valeur) || !CHIFFRE.test(valeur)) {
    throw erreurChamp(champ, "Le mot de passe doit contenir au moins une lettre et un chiffre.");
  }
  return valeur;
}

function validerMotDePasseActuel(valeur: unknown, champ = "motDePasseActuel"): string {
  if (typeof valeur !== "string" || !valeur) {
    throw erreurChamp(champ, "Le mot de passe actuel est obligatoire.");
  }
  if (valeur.length > LONGUEUR_MAX_MOT_DE_PASSE) {
    throw erreurChamp(champ, "Le mot de passe actuel est trop long.");
  }
  return valeur;
}

function validerPseudo(valeur: unknown): string {
  const pseudo = texteObligatoire(valeur, "pseudo", LONGUEUR_MAX_PSEUDO);
  if (pseudo.length < LONGUEUR_MIN_PSEUDO || !PSEUDO_VALIDE.test(pseudo)) {
    throw erreurChamp(
      "pseudo",
      `Le pseudonyme doit contenir entre ${LONGUEUR_MIN_PSEUDO} et ${LONGUEUR_MAX_PSEUDO} caractères (lettres, chiffres, point, tiret ou underscore).`
    );
  }
  return pseudo;
}

function validerTelephone(valeur: unknown): string | null {
  if (valeur === undefined || valeur === null) {
    return null;
  }
  if (typeof valeur !== "string") {
    throw erreurChamp("telephone", "Le numéro de téléphone doit être un texte.");
  }

  const telephone = valeur.trim();
  if (!telephone) {
    return null;
  }
  const chiffres = telephone.match(/\d/g)?.length ?? 0;
  if (telephone.length > LONGUEUR_MAX_TELEPHONE || !TELEPHONE_VALIDE.test(telephone) || chiffres < 6) {
    throw erreurChamp("telephone", "Le numéro de téléphone n'est pas valide.");
  }
  return telephone;
}

function aAccepteConditions(corps: Record<string, unknown>): boolean {
  return CHAMPS_CONDITIONS.some((champ) => corps[champ] === true);
}

export function validerInscription(corps: unknown): DonneesInscription {
  if (!estObjet(corps)) {
    throw new ErreurValidation("Le corps de la requête doit être un objet JSON.");
  }

  const pseudo = validerPseudo(lireChamp(corps, CHAMPS_PSEUDO));
  const email = validerEmail(corps.email);
  const motDePasse = validerMotDePasse(lireChamp(corps, CHAMPS_MOT_DE_PASSE), "motDePasse");
  if (!aAccepteConditions(corps)) {
    throw erreurChamp("accepteConditions", "L'acceptation des conditions d'utilisation est obligatoire.");
  }
  const zoneLibre = texteOptionnel(lireChamp(corps, CHAMPS_ZONE), "zoneLibre", LONGUEUR_MAX_ZONE);
  const telephone = validerTelephone(lireChamp(corps, CHAMPS_TELEPHONE));

  return { pseudo, email, motDePasse, accepteConditions: true, zoneLibre, telephone };
}

export function validerDemandeReinitialisation(corps: unknown): string {
  if (!estObjet(corps)) {
    throw new ErreurValidation("Le corps de la requête doit être un objet JSON.");
  }
  return validerEmail(corps.email);
}

export function validerReinitialisation(corps: unknown): DonneesReinitialisation {
  if (!estObjet(corps)) {
    throw new ErreurValidation("Le corps de la requête doit être un objet JSON.");
  }

  const email = validerEmail(corps.email);
  if (typeof corps.code !== "string" || !/^\d{6}$/.test(corps.code)) {
    throw erreurChamp("code", "Le code de réinitialisation doit contenir six chiffres.");
  }
  const nouveauMotDePasse = validerMotDePasse(
    lireChamp(corps, CHAMPS_NOUVEAU_MOT_DE_PASSE_REINITIALISATION),
    "nouveauMotDePasse"
  );

  return { email, code: corps.code, nouveauMotDePasse };
}

export function validerChangementMotDePasse(corps: unknown): DonneesChangementMotDePasse {
  if (!estObjet(corps)) {
    throw new ErreurValidation("Le corps de la requête doit être un objet JSON.");
  }

  const motDePasseActuel = validerMotDePasseActuel(lireChamp(corps, CHAMPS_MOT_DE_PASSE_ACTUEL));
  const nouveauMotDePasse = validerMotDePasse(
    lireChamp(corps, CHAMPS_NOUVEAU_MOT_DE_PASSE),
    "nouveauMotDePasse"
  );

  return { motDePasseActuel, nouveauMotDePasse };
}

export function validerChangementEmail(corps: unknown): DonneesChangementEmail {
  if (!estObjet(corps)) {
    throw new ErreurValidation("Le corps de la requête doit être un objet JSON.");
  }

  const motDePasse = validerMotDePasseActuel(lireChamp(corps, CHAMPS_MOT_DE_PASSE), "motDePasse");
  return { email: validerEmail(corps.email), motDePasse };
}

export function validerMiseAJourProfil(corps: unknown): ChampsProfilModifiables {
  if (!estObjet(corps)) {
    throw new ErreurValidation("Le corps de la requête doit être un objet JSON.");
  }

  const champs: ChampsProfilModifiables = {};
  if (champFourni(corps, CHAMPS_PSEUDO)) {
    champs.pseudo = validerPseudo(lireChamp(corps, CHAMPS_PSEUDO));
  }
  if (champFourni(corps, CHAMPS_ZONE)) {
    champs.zoneLibre = texteOptionnel(lireChamp(corps, CHAMPS_ZONE), "zoneLibre", LONGUEUR_MAX_ZONE);
  }
  if ("avatarRef" in corps) {
    champs.avatarRef = texteOptionnel(corps.avatarRef, "avatarRef", 120);
  }
  if (champFourni(corps, CHAMPS_TELEPHONE)) {
    champs.telephone = validerTelephone(lireChamp(corps, CHAMPS_TELEPHONE));
  }
  if (Object.keys(champs).length === 0) {
    throw new ErreurValidation("Aucun champ modifiable n'a été fourni.");
  }
  return champs;
}

export function validerAvatar(corps: unknown): string | null {
  if (!estObjet(corps)) {
    throw new ErreurValidation("Le corps de la requête doit être un objet JSON.");
  }
  if (!("avatarRef" in corps)) {
    throw new ErreurValidation("Le champ avatarRef est obligatoire.");
  }
  return texteOptionnel(corps.avatarRef, "avatarRef", 120);
}

export function validerDemandeSuppression(corps: unknown): DonneesSuppressionCompte {
  if (!estObjet(corps)) {
    throw new ErreurValidation("Le corps de la requête doit être un objet JSON.");
  }
  const motDePasse = lireChamp(corps, CHAMPS_MOT_DE_PASSE);
  if (typeof motDePasse !== "string" || !motDePasse) {
    throw erreurChamp("motDePasse", "Le mot de passe est obligatoire.");
  }
  if (motDePasse.length > LONGUEUR_MAX_MOT_DE_PASSE) {
    throw erreurChamp("motDePasse", "Le mot de passe est trop long.");
  }
  return {
    motDePasse,
    motif: texteOptionnel(lireChamp(corps, ["motif", "reason"]), "motif", 600)
  };
}

export function validerConnexion(corps: unknown): DonneesConnexion {
  if (!estObjet(corps)) {
    throw new ErreurValidation("Le corps de la requête doit être un objet JSON.");
  }

  const identifiantBrut = lireChamp(corps, CHAMPS_IDENTIFIANT);
  if (typeof identifiantBrut !== "string" || !identifiantBrut.trim()) {
    throw erreurChamp("identifiant", "L'identifiant (e-mail ou pseudonyme) est obligatoire.");
  }
  const identifiant = identifiantBrut.trim();
  if (identifiant.length > LONGUEUR_MAX_EMAIL) {
    throw erreurChamp(
      "identifiant",
      `L'identifiant ne doit pas dépasser ${LONGUEUR_MAX_EMAIL} caractères.`
    );
  }

  const motDePasse = lireChamp(corps, CHAMPS_MOT_DE_PASSE);
  if (typeof motDePasse !== "string" || !motDePasse) {
    throw erreurChamp("motDePasse", "Le mot de passe est obligatoire.");
  }
  if (motDePasse.length > LONGUEUR_MAX_MOT_DE_PASSE) {
    throw erreurChamp("motDePasse", "Le mot de passe est trop long.");
  }

  return { identifiant, motDePasse };
}
