// Lecture du réseau pour les favoris, sur les tables existantes (arrets, trajet_arrets, trajets, lignes).
// Aucune modification du schéma.
import { codeErreurPostgres, ErreurBaseDeDonnees, obtenirPool } from "../configuration/baseDeDonnees";
import type { ReferentielReseau } from "./favoris.depot";
import type { ArretReseau, TrajetPropose } from "./favoris.types";

// EF-FAV-006 : un arrêt est disponible s'il est actif, non archivé et desservi
// par au moins un trajet actif d'une ligne active (aucun des deux archivé).
const SQL_ARRETS = `
  SELECT a.id, a.code, a.nom,
         (a.actif AND a.archive_le IS NULL AND EXISTS (
            SELECT 1
              FROM trajet_arrets ta
              JOIN trajets t ON t.id = ta.trajet_id
              JOIN lignes l ON l.id = t.ligne_id
             WHERE ta.arret_id = a.id
               AND t.actif AND t.archive_le IS NULL
               AND l.actif AND l.archive_le IS NULL
         )) AS disponible
    FROM arrets a
   WHERE a.id = ANY($1::bigint[])`;

// Trajets proposés à l'ajout : trajet et ligne actifs, non archivés ; le départ est le premier
// arrêt (plus petit ordre) et l'arrivée le dernier, tous deux disponibles et différents.
// $1 : motif ILIKE (null = pas de filtre) sur le nom, la direction, la ligne et les arrêts.
const SQL_TRAJETS = `
  SELECT t.id, l.code AS ligne, t.nom, t.direction,
         d.id AS depart_id, d.nom AS depart_nom,
         a.id AS arrivee_id, a.nom AS arrivee_nom
    FROM trajets t
    JOIN lignes l ON l.id = t.ligne_id AND l.actif AND l.archive_le IS NULL
    JOIN LATERAL (SELECT arret_id FROM trajet_arrets WHERE trajet_id = t.id ORDER BY ordre ASC LIMIT 1) premier ON TRUE
    JOIN LATERAL (SELECT arret_id FROM trajet_arrets WHERE trajet_id = t.id ORDER BY ordre DESC LIMIT 1) dernier ON TRUE
    JOIN arrets d ON d.id = premier.arret_id AND d.actif AND d.archive_le IS NULL
    JOIN arrets a ON a.id = dernier.arret_id AND a.actif AND a.archive_le IS NULL
   WHERE t.actif AND t.archive_le IS NULL
     AND d.id <> a.id
     AND ($1::text IS NULL
          OR t.nom ILIKE $1 OR t.direction ILIKE $1 OR l.code ILIKE $1
          OR d.nom ILIKE $1 OR a.nom ILIKE $1)
   ORDER BY l.code, t.direction, t.id
   LIMIT $2`;

// Le texte saisi est cherché tel quel : % et _ ne sont pas des jokers
function motifRecherche(recherche: string | null): string | null {
  return recherche === null ? null : `%${recherche.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export class ReferentielReseauPostgres implements ReferentielReseau {
  async rechercherTrajets(recherche: string | null, limite: number): Promise<TrajetPropose[]> {
    let rows;
    try {
      ({ rows } = await obtenirPool().query(SQL_TRAJETS, [motifRecherche(recherche), limite]));
    } catch (erreur) {
      throw new ErreurBaseDeDonnees(codeErreurPostgres(erreur));
    }
    return rows.map((r) => ({
      trajetId: Number(r.id),
      ligne: r.ligne,
      nom: r.nom,
      direction: r.direction,
      depart: { id: Number(r.depart_id), nom: r.depart_nom },
      arrivee: { id: Number(r.arrivee_id), nom: r.arrivee_nom }
    }));
  }

  async trouverArrets(ids: number[]): Promise<ArretReseau[]> {
    if (ids.length === 0) return [];
    let rows;
    try {
      ({ rows } = await obtenirPool().query(SQL_ARRETS, [ids]));
    } catch (erreur) {
      throw new ErreurBaseDeDonnees(codeErreurPostgres(erreur));
    }
    return rows.map((r) => ({
      id: Number(r.id),
      code: r.code,
      nom: r.nom,
      disponible: r.disponible === true
    }));
  }
}
