
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
import type { Ligne, Arret, ArretProche } from "./transport.types";

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


/**
 * KBE-28 — Trouver les arrêts proches
 *
 * Recherche les arrêts de bus situés dans un rayon
 * donné autour d'une position géographique.
 *
 * @param latitude Latitude de la position recherchée.
 * @param longitude Longitude de la position recherchée.
 * @param rayon Rayon de recherche exprimé en mètres.
 *
 * @returns Promise<ArretProche[]>
 * Tableau des arrêts proches, triés par distance croissante.
 *
 * Si aucun arrêt ne se trouve dans le rayon,
 * la fonction retourne un tableau vide [].
 */
export async function lireArretsProches(
  latitude: number,
  longitude: number,
  rayon: number
): Promise<ArretProche[]> {

  // Exécution d'une requête SQL paramétrée.
  // Les paramètres $1, $2 et $3 empêchent
  // l'insertion directe de valeurs dans le SQL.
  const resultat = await obtenirPool().query<ArretProche>(`

    SELECT

      -- Identifiant de l'arrêt converti en texte.
      id::text AS id,

      -- Code et nom de l'arrêt.
      code,
      nom,

      -- Coordonnées géographiques de l'arrêt.
      ST_Y(position) AS latitude,
      ST_X(position) AS longitude,

      -- Date de dernière modification au format ISO 8601.
      to_char(
        modifie_le AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ) AS "dateMiseAJour",

      -- Distance entre l'arrêt et la position recherchée.
      -- Le type geography permet un calcul en mètres.
      ST_Distance(
        position::geography,
        ST_SetSRID(
          ST_MakePoint($2, $1),
          4326
        )::geography
      ) AS "distanceMetres"

    FROM arrets

    WHERE actif = TRUE

      -- Exclusion des arrêts archivés.
      AND archive_le IS NULL

      -- Vérification de la présence des coordonnées.
      AND position IS NOT NULL

      -- Recherche uniquement les arrêts dans le rayon.
      -- ST_DWithin retourne TRUE si la distance
      -- est inférieure ou égale au rayon demandé.
      AND ST_DWithin(
        position::geography,
        ST_SetSRID(
          ST_MakePoint($2, $1),
          4326
        )::geography,
        $3
      )

    -- Les arrêts les plus proches apparaissent en premier.
    -- L'identifiant départage les distances identiques.
    ORDER BY "distanceMetres" ASC, id ASC

  `, [latitude, longitude, rayon]);

  // Retourne les arrêts trouvés.
  return resultat.rows;

}
