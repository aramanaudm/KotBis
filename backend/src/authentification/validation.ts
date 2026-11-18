import { ErreurValidation } from "../commun/erreurs";
import type { DonneesConnexion } from "./types";

const LONGUEUR_MAX_IDENTIFIANT = 254;
const LONGUEUR_MAX_MOT_DE_PASSE = 128;
const CHAMPS_IDENTIFIANT = ["identifiant", "identifier", "email", "pseudo", "pseudonyme"] as const;
const CHAMPS_MOT_DE_PASSE = ["motDePasse", "password"] as const;

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

export function validerConnexion(corps: unknown): DonneesConnexion {
  if (!estObjet(corps)) {
    throw new ErreurValidation("Le corps de la requête doit être un objet JSON.");
  }

  const identifiantBrut = lireChamp(corps, CHAMPS_IDENTIFIANT);
  if (typeof identifiantBrut !== "string" || !identifiantBrut.trim()) {
    throw erreurChamp("identifiant", "L'identifiant (e-mail ou pseudonyme) est obligatoire.");
  }
  const identifiant = identifiantBrut.trim();
  if (identifiant.length > LONGUEUR_MAX_IDENTIFIANT) {
    throw erreurChamp(
      "identifiant",
      `L'identifiant ne doit pas dépasser ${LONGUEUR_MAX_IDENTIFIANT} caractères.`
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
