
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
  lireArrets
} from "./transport.repository";

// Importation des types de données.
import type { Ligne, Arret } from "./transport.types";


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
