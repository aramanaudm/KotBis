
/**
 * KBE-27 — Consulter les lignes et les arrêts
 *
 * Ce fichier définit les interfaces TypeScript utilisées
 * pour représenter les lignes de bus et les arrêts.
 *
 * Une interface décrit la structure d'un objet :
 * les propriétés qu'il doit contenir et leurs types.
 */


/**
 * Interface représentant une ligne de bus.
 *
 * Les informations proviennent de la table
 * "lignes" de la base de données PostgreSQL.
 */
export interface Ligne {

  // Identifiant unique de la ligne.
  // PostgreSQL utilise BIGINT ; le module "pg" le retourne
  // généralement sous forme de chaîne pour éviter
  // les problèmes de précision des grands nombres.
  id: string;

  // Numéro ou code de la ligne de bus.
  // Exemple : "3", "12A", "46".
  code: string;

  // Nom ou description de la ligne.
  // Exemple : "Port Louis - Vacoas".
  libelle: string;

}


/**
 * Interface représentant un arrêt de bus.
 *
 * Les informations proviennent de la table
 * "arrets" de la base de données PostgreSQL.
 */
export interface Arret {

  // Identifiant unique de l'arrêt.
  id: string;

  // Code unique permettant d'identifier l'arrêt.
  code: string;

  // Nom de l'arrêt de bus.
  nom: string;

  // Latitude géographique de l'arrêt.
  // Elle correspond à la coordonnée Y dans PostGIS.
  latitude: number;

  // Longitude géographique de l'arrêt.
  // Elle correspond à la coordonnée X dans PostGIS.
  longitude: number;

  // Date de la dernière modification de l'arrêt.
  // Format ISO 8601, par exemple :
  // "2026-11-18T10:30:00.000Z"
  dateMiseAJour: string;

}
/**
 * KBE-28 — Trouver les arrêts proches
 *
 * Interface représentant un arrêt de bus situé
 * à proximité d'une position géographique.
 *
 * Elle hérite de toutes les propriétés de
 * l'interface Arret définie pour KBE-27.
 */
export interface ArretProche extends Arret {

  // Distance entre la position recherchée
  // et l'arrêt de bus, exprimée en mètres.
  //
  // Cette distance sera calculée par PostGIS
  // à l'aide de la fonction ST_Distance.
  distanceMetres: number;

}