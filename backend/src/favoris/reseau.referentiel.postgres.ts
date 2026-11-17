// Lecture du réseau pour les favoris, sur les tables existantes (arrets, trajet_arrets, trajets, lignes).
// Aucune modification du schéma.
import { obtenirPool } from "../configuration/baseDeDonnees";
import type { ReferentielReseau } from "./favoris.depot";
import type { ArretReseau } from "./favoris.types";

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

export class ReferentielReseauPostgres implements ReferentielReseau {
  async trouverArrets(ids: number[]): Promise<ArretReseau[]> {
    if (ids.length === 0) return [];
    const { rows } = await obtenirPool().query(SQL_ARRETS, [ids]);
    return rows.map((r) => ({
      id: Number(r.id),
      code: r.code,
      nom: r.nom,
      disponible: r.disponible === true
    }));
  }
}
