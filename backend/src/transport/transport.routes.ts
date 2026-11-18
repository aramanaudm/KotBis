
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
  obtenirArrets
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


// Exportation du routeur pour son utilisation
// dans le fichier principal index.ts.
export default routeurTransport;
