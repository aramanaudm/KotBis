
/**
 * KBE-27 — Consulter les lignes et les arrêts
 *
 * Ce fichier définit les endpoints HTTP publics
 * permettant de consulter les données de transport.
 *
 * GET /api/lignes
 * GET /api/arrets
 */

import { Router } from "express";

// Importation des fonctions de la couche Service.
import {
  obtenirLignes,
  obtenirArrets,
  obtenirArretsProches
} from "./transport.service";

// Création du routeur Express.
const routeurTransport = Router();


/**
 * GET /api/lignes
 *
 * Retourne la liste des lignes de bus disponibles.
 *
 * Réponse en cas de succès :
 * HTTP 200
 * { "lignes": [...] }
 */
routeurTransport.get("/lignes", async (_req, res) => {

  try {

    // Récupération des lignes depuis le Service.
    const lignes = await obtenirLignes();

    // Retourne les lignes au format JSON.
    // Si aucune ligne n'existe, le tableau est vide.
    res.status(200).json({ lignes });

  } catch (_erreur) {

    // Ne pas exposer les détails internes
    // de PostgreSQL dans la réponse HTTP.
    console.error("[Transport] Échec de consultation des lignes", _erreur);

    res.status(500).json({
      erreur: "Impossible de récupérer les lignes."
    });

  }

});


/**
 * GET /api/arrets
 *
 * Retourne la liste des arrêts de bus disponibles.
 *
 * Réponse en cas de succès :
 * HTTP 200
 * { "arrets": [...] }
 */
routeurTransport.get("/arrets", async (_req, res) => {

  try {

    // Récupération des arrêts depuis le Service.
    const arrets = await obtenirArrets();

    // Retourne les arrêts au format JSON.
    res.status(200).json({ arrets });

  } catch (_erreur) {

    // Message générique pour éviter toute fuite
    // d'informations sensibles sur la base.
    console.error("[Transport] Échec de consultation des arrêts", _erreur);

    res.status(500).json({
      erreur: "Impossible de récupérer les arrêts."
    });

  }

});


/**
 * KBE-28 — Trouver les arrêts proches
 *
 * GET /api/arrets/proches
 *
 * Paramètres obligatoires :
 * - latitude : entre -90 et 90
 * - longitude : entre -180 et 180
 * - rayon : supérieur à 0 et inférieur ou égal à 10000 mètres
 *
 * Exemple :
 * /api/arrets/proches?latitude=-20.3162&longitude=57.5264&rayon=500
 *
 * Réponse en cas de succès :
 * HTTP 200
 * { "arrets": [...] }
 *
 * Réponse en cas de paramètres invalides :
 * HTTP 400
 */
routeurTransport.get("/arrets/proches", async (req, res) => {

  // Récupération des paramètres transmis dans l'URL.
  const {
    latitude: latitudeBrute,
    longitude: longitudeBrute,
    rayon: rayonBrut
  } = req.query;

  /**
   * Convertit un paramètre HTTP en nombre.
   *
   * Rejette notamment :
   * - les paramètres absents ;
   * - les chaînes vides ;
   * - les tableaux et objets ;
   * - les valeurs non numériques ;
   * - Infinity et NaN.
   */
  function convertirNombre(valeur: unknown): number | null {

    if (typeof valeur !== "string") {
      return null;
    }

    const texte = valeur.trim();

    // Accepte les nombres décimaux et la notation scientifique.
    // Refuse les formats hexadécimaux et les caractères parasites.
    const formatNumerique =
      /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

    if (!formatNumerique.test(texte)) {
      return null;
    }

    const nombre = Number(texte);

    if (!Number.isFinite(nombre)) {
      return null;
    }

    return nombre;
  }

  // Conversion des trois paramètres.
  const latitude = convertirNombre(latitudeBrute);
  const longitude = convertirNombre(longitudeBrute);
  const rayon = convertirNombre(rayonBrut);

  // Vérification de la latitude.
  if (latitude === null || latitude < -90 || latitude > 90) {

    res.status(400).json({
      erreur: "La latitude doit être comprise entre -90 et 90."
    });

    return;
  }

  // Vérification de la longitude.
  if (longitude === null || longitude < -180 || longitude > 180) {

    res.status(400).json({
      erreur: "La longitude doit être comprise entre -180 et 180."
    });

    return;
  }

  // Vérification du rayon de recherche.
  // Limite provisoire à confirmer avec l'équipe Front-End.
  const RAYON_MAXIMUM_METRES = 10000;

  if (
    rayon === null ||
    rayon <= 0 ||
    rayon > RAYON_MAXIMUM_METRES
  ) {

    res.status(400).json({
      erreur: "Le rayon doit être supérieur à 0 et inférieur ou égal à 10000 mètres."
    });

    return;
  }

  try {

    // Recherche des arrêts dans le rayon demandé.
    const arrets = await obtenirArretsProches(
      latitude,
      longitude,
      rayon
    );

    // Retourne les arrêts et leurs distances en mètres.
    // Si aucun arrêt n'est trouvé, arrets vaut [].
    res.status(200).json({ arrets });

  } catch (erreur) {

    // Journalisation côté serveur uniquement.
    // Les détails PostgreSQL ne sont pas exposés au client.
    console.error(
      "[Transport] Échec de recherche des arrêts proches",
      erreur
    );

    res.status(500).json({
      erreur: "Impossible de rechercher les arrêts proches."
    });

  }

});



// Exportation du routeur pour son utilisation
// dans le fichier principal index.ts.
export default routeurTransport;
