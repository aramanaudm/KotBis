import { ErreurApi } from "../commun/erreurs";
import {
  CATEGORIE_VERS_TYPE,
  CATEGORIES_MOBILES,
  STATUTS_SIGNALEMENT,
  type CategorieMobile,
  type DonneesCreationSignalement,
  type FiltresAdminSignalements,
  type PositionSignalement,
  type StatutSignalement,
  type TypeSignalement
} from "./signalements.types";

const LIMITE_COMMENTAIRE = 600;
const BIGINT_MAX = 9223372036854775807n;

function refuser(champ: string, message: string): never {
  throw new ErreurApi(400, "DONNEES_INVALIDES", "Données de signalement invalides.", [
    { champ, message }
  ]);
}

function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return typeof valeur === "object" && valeur !== null && !Array.isArray(valeur);
}

function lireChaine(valeur: unknown): string | null {
  if (typeof valeur === "string") return valeur;
  if (Array.isArray(valeur) && typeof valeur[0] === "string") return valeur[0];
  return null;
}

function lireId(valeur: unknown, champ: string): string | null {
  if (valeur === null || valeur === undefined || valeur === "") return null;
  if (typeof valeur === "number" && Number.isSafeInteger(valeur) && valeur > 0) return String(valeur);
  const texte = lireChaine(valeur)?.trim();
  if (!texte || !/^[1-9]\d*$/.test(texte)) refuser(champ, "Identifiant invalide.");
  if (BigInt(texte) > BIGINT_MAX) refuser(champ, "Identifiant trop grand.");
  return texte;
}

function lireCategorie(corps: Record<string, unknown>): {
  categorie: CategorieMobile | null;
  type: TypeSignalement;
} {
  const categorieBrute = lireChaine(corps.categorie)?.trim();
  const typeBrut = lireChaine(corps.type)?.trim();

  if (categorieBrute) {
    if (!CATEGORIES_MOBILES.includes(categorieBrute as CategorieMobile)) {
      refuser("categorie", "Catégorie inconnue.");
    }
    const categorie = categorieBrute as CategorieMobile;
    const type = CATEGORIE_VERS_TYPE[categorie];
    if (typeBrut && typeBrut !== type) {
      refuser("type", "Le type ne correspond pas à la catégorie choisie.");
    }
    return { categorie, type };
  }

  if (typeBrut === "en_panne" || typeBrut === "autre") {
    return { categorie: null, type: typeBrut };
  }

  refuser("categorie", "Choisissez une catégorie valide.");
}

function lireCommentaire(valeur: unknown): string | null {
  if (valeur === null || valeur === undefined) return null;
  const texte = lireChaine(valeur);
  if (texte === null) refuser("commentaire", "Le commentaire doit être une chaîne de caractères.");
  if (texte.length > LIMITE_COMMENTAIRE) {
    refuser("commentaire", `Le commentaire ne peut pas dépasser ${LIMITE_COMMENTAIRE} caractères.`);
  }
  const nettoye = texte.trim();
  return nettoye === "" ? null : nettoye;
}

function lireDate(valeur: unknown): Date {
  const texte = lireChaine(valeur);
  if (!texte) refuser("observeLe", "La date d'observation est obligatoire.");
  const date = new Date(texte);
  if (!Number.isFinite(date.getTime())) refuser("observeLe", "La date d'observation est invalide.");
  return date;
}

function lireCleIdempotence(valeur: unknown): string {
  const cle = lireChaine(valeur)?.trim();
  if (!cle || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cle)) {
    refuser("cleIdempotence", "Une clé d'idempotence UUID valide est obligatoire.");
  }
  return cle.toLowerCase();
}

function lirePosition(corps: Record<string, unknown>): PositionSignalement | null {
  const position = corps.position;
  const consentement = corps.consentementGps;
  if (position === null || position === undefined) return null;
  if (consentement !== true) {
    refuser("consentementGps", "Le partage de position doit être accepté explicitement.");
  }
  if (!estObjet(position)) refuser("position", "Position GPS invalide.");

  const latitude = position.latitude ?? position.lat;
  const longitude = position.longitude ?? position.lng;
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    refuser("position", "Coordonnées GPS invalides.");
  }

  return { latitude, longitude };
}

function lireEntierPositif(valeur: unknown, champ: string, defaut: number, maximum: number): number {
  const texte = lireChaine(valeur);
  if (texte === null || texte.trim() === "") return defaut;
  if (!/^[1-9]\d*$/.test(texte.trim())) refuser(champ, "Nombre entier positif attendu.");
  const nombre = Number(texte);
  if (nombre > maximum) refuser(champ, `La valeur maximale est ${maximum}.`);
  return nombre;
}

export function validerCreationSignalement(corps: unknown): DonneesCreationSignalement {
  if (!estObjet(corps)) refuser("corps", "Un corps JSON est attendu.");

  const busId = lireId(corps.busId, "busId");
  const trajetId = lireId(corps.trajetId, "trajetId");
  if (busId === null && trajetId === null) {
    refuser("busId", "Un bus ou un trajet est obligatoire.");
  }

  return {
    busId,
    trajetId,
    ...lireCategorie(corps),
    commentaire: lireCommentaire(corps.commentaire),
    observeLe: lireDate(corps.observeLe ?? corps.dateObservation),
    cleIdempotence: lireCleIdempotence(corps.cleIdempotence),
    position: lirePosition(corps)
  };
}

export function validerStatut(valeur: unknown): StatutSignalement {
  const statut = lireChaine(valeur);
  if (!statut || !STATUTS_SIGNALEMENT.includes(statut as StatutSignalement)) {
    refuser("statut", "Statut inconnu.");
  }
  return statut as StatutSignalement;
}

export function validerFiltresAdmin(valeur: unknown): FiltresAdminSignalements {
  const source = estObjet(valeur) ? valeur : {};
  const qBrute = lireChaine(source.q)?.trim() ?? "";
  const statutBrut = lireChaine(source.statut)?.trim() ?? "";

  let statut: StatutSignalement | null = null;
  if (statutBrut) statut = validerStatut(statutBrut);

  return {
    q: qBrute === "" ? null : qBrute.slice(0, 100),
    statut,
    page: lireEntierPositif(source.page, "page", 1, 100000),
    limit: lireEntierPositif(source.limit, "limit", 6, 50)
  };
}
