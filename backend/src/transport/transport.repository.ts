
/**
 * KBE-27 — Consulter les lignes et les arrêts
 *
 * Ce fichier contient les fonctions permettant
 * de récupérer les lignes et les arrêts depuis
 * la base de données PostgreSQL.
 *
 * Il constitue la couche Repository (accès aux données).
 *
 * Les opérations sont en lecture seule (SELECT).
 */


// Importation de la fonction qui fournit le pool
// de connexions PostgreSQL partagé du projet.
import { obtenirPool } from "../configuration/baseDeDonnees";

// Importation des interfaces TypeScript.
// Le mot-clé "type" indique qu'elles servent
// uniquement à la vérification des types.
import type { Ligne, Arret } from "./transport.types";


/**
 * Récupère toutes les lignes de bus actives
 * et non archivées.
 *
 * @returns Promise<Ligne[]>
 * Une promesse contenant un tableau de lignes.
 *
 * Si aucune ligne n'est disponible,
 * la fonction retourne un tableau vide [].
 */
export async function lireLignes(): Promise<Ligne[]> {

  // Exécution d'une requête SQL sur PostgreSQL.
  // La fonction obtenirPool() réutilise le pool
  // de connexions existant dans baseDeDonnees.ts.
  const resultat = await obtenirPool().query<Ligne>(`

    SELECT

      -- Conversion de BIGINT vers TEXT.
      -- Cela garantit un identifiant JavaScript
      -- sans perte de précision.
      id::text AS id,

      -- Code ou numéro de la ligne.
      code,

      -- Libellé décrivant le trajet de la ligne.
      libelle

    FROM lignes

    -- On récupère uniquement les lignes actives.
    WHERE actif = TRUE

      -- On exclut les lignes archivées.
      AND archive_le IS NULL

    -- Classement des lignes par code.
    ORDER BY code

  `);

  // PostgreSQL retourne un objet contenant notamment
  // la propriété "rows", qui est un tableau de résultats.
  //
  // Si aucune ligne ne correspond aux conditions,
  // resultat.rows vaut [].
  return resultat.rows;

}


/**
 * Récupère tous les arrêts de bus actifs
 * et non archivés.
 *
 * @returns Promise<Arret[]>
 * Une promesse contenant un tableau d'arrêts.
 *
 * Les coordonnées géographiques sont extraites
 * de la colonne PostGIS "position".
 */
export async function lireArrets(): Promise<Arret[]> {

  // Exécution de la requête SQL.
  const resultat = await obtenirPool().query<Arret>(`

    SELECT

      -- Identifiant unique de l'arrêt.
      id::text AS id,

      -- Code unique de l'arrêt.
      code,

      -- Nom de l'arrêt.
      nom,

      -- Extraction de la latitude.
      -- ST_Y récupère la coordonnée Y du point.
      ST_Y(position) AS latitude,

      -- Extraction de la longitude.
      -- ST_X récupère la coordonnée X du point.
      ST_X(position) AS longitude,

      -- Conversion de la date de modification
      -- vers une chaîne ISO 8601 en UTC.
      --
      -- AT TIME ZONE 'UTC' convertit la date
      -- dans le fuseau horaire UTC.
      --
      -- to_char formate la date sous la forme :
      -- YYYY-MM-DDTHH:MM:SS.mmmZ
      to_char(
        modifie_le AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ) AS "dateMiseAJour"

    FROM arrets

    -- On récupère uniquement les arrêts actifs.
    WHERE actif = TRUE

      -- On exclut les arrêts archivés.
      AND archive_le IS NULL

    -- Classement alphabétique des arrêts.
    -- L'identifiant départage les noms identiques.
    ORDER BY nom, id

  `);

  // Retourne les arrêts récupérés.
  //
  // Si aucun arrêt n'existe,
  // PostgreSQL retourne un tableau vide [].
  return resultat.rows;

}
