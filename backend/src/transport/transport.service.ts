
/**
 * KBE-27 — Consulter les lignes et les arrêts
 *
 * Couche Service du module Transport.
 *
 * Elle fait le lien entre les routes HTTP
 * et les fonctions d'accès à la base de données.
 */

// Importation des fonctions du Repository.
import {
  lireLignes,
  lireArrets,
  lireArretsProches
} from "./transport.repository";

// Importation des types de données.
import type { Ligne, Arret, ArretProche } from "./transport.types";

/**
 * Retourne les lignes de bus disponibles.
 *
 * @returns Promise<Ligne[]>
 * Tableau des lignes actives et non archivées.
 */
export async function obtenirLignes(): Promise<Ligne[]> {

  // Délègue la lecture des données au Repository.
  return await lireLignes();

}


/**
 * Retourne les arrêts de bus disponibles.
 *
 * @returns Promise<Arret[]>
 * Tableau des arrêts actifs et non archivés.
 */
export async function obtenirArrets(): Promise<Arret[]> {

  // Délègue la lecture des données au Repository.
  return await lireArrets();

}

/**
 * KBE-28 — Trouver les arrêts proches
 *
 * Retourne les arrêts de bus situés à proximité
 * d'une position géographique.
 *
 * @param latitude Latitude de la position recherchée.
 * @param longitude Longitude de la position recherchée.
 * @param rayon Rayon de recherche exprimé en mètres.
 *
 * @returns Promise<ArretProche[]>
 * Tableau des arrêts proches avec leurs distances
 * en mètres, classés du plus proche au plus éloigné.
 *
 * Les paramètres seront validés par la couche Routes
 * avant l'appel de cette fonction.
 */
export async function obtenirArretsProches(
  latitude: number,
  longitude: number,
  rayon: number
): Promise<ArretProche[]> {

  // Délègue la recherche géographique au Repository.
  // Le Repository utilise PostGIS pour filtrer
  // les arrêts selon le rayon demandé.
  return await lireArretsProches(
    latitude,
    longitude,
    rayon
  );

}
