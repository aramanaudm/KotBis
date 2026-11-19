// Dépôt PostgreSQL des favoris (table favoris, KB-48).
// Requêtes paramétrées ; chaque requête filtre sur voyageur_id (EF-AUTH-017, CA-031).
import type { Pool } from "pg";
import { codeErreurPostgres, ErreurBaseDeDonnees } from "../configuration/baseDeDonnees";
import { FavoriExistantErreur, type DepotFavoris } from "./favoris.depot";
import type { FavoriEnregistre, NouveauFavori, TypeFavori } from "./favoris.types";

// Violation de l'index unique uq_favoris (EF-FAV-005)
const VIOLATION_UNICITE = "23505";

const COLONNES = "id, voyageur_id, type, arret_depart_id, arret_arrivee_id, libelle, cree_le";

interface LigneFavori {
  id: string;
  voyageur_id: string;
  type: TypeFavori;
  arret_depart_id: string | null;
  arret_arrivee_id: string;
  libelle: string | null;
  cree_le: Date;
}

// pg renvoie les BIGINT en texte
function versFavori(l: LigneFavori): FavoriEnregistre {
  return {
    id: Number(l.id),
    voyageurId: Number(l.voyageur_id),
    type: l.type,
    arretDepartId: l.arret_depart_id === null ? null : Number(l.arret_depart_id),
    arretArriveeId: Number(l.arret_arrivee_id),
    libelle: l.libelle,
    creeLe: l.cree_le
  };
}

export class DepotFavorisPostgres implements DepotFavoris {
  constructor(private readonly obtenirPool: () => Pool) {}

  async lister(voyageurId: number): Promise<FavoriEnregistre[]> {
    const rows = await this.requete<LigneFavori>(
      `SELECT ${COLONNES} FROM favoris WHERE voyageur_id = $1 ORDER BY cree_le DESC, id DESC`,
      [voyageurId]
    );
    return rows.map(versFavori);
  }

  async compter(voyageurId: number): Promise<number> {
    const [ligne] = await this.requete<{ nombre: number }>(
      "SELECT count(*)::int AS nombre FROM favoris WHERE voyageur_id = $1",
      [voyageurId]
    );
    return ligne.nombre;
  }

  async ajouter(voyageurId: number, favori: NouveauFavori): Promise<FavoriEnregistre> {
    try {
      const { rows } = await this.obtenirPool().query<LigneFavori>(
        `INSERT INTO favoris (voyageur_id, type, arret_depart_id, arret_arrivee_id, libelle)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${COLONNES}`,
        [voyageurId, favori.type, favori.arretDepartId, favori.arretArriveeId, favori.libelle]
      );
      return versFavori(rows[0]);
    } catch (erreur) {
      if (codeErreurPostgres(erreur) === VIOLATION_UNICITE) throw new FavoriExistantErreur();
      throw new ErreurBaseDeDonnees(codeErreurPostgres(erreur));
    }
  }

  // CA-031 : le filtre voyageur_id empêche de supprimer le favori d'un autre compte
  async supprimer(voyageurId: number, id: number): Promise<boolean> {
    try {
      const { rowCount } = await this.obtenirPool().query(
        "DELETE FROM favoris WHERE id = $1 AND voyageur_id = $2",
        [id, voyageurId]
      );
      return (rowCount ?? 0) > 0;
    } catch (erreur) {
      throw new ErreurBaseDeDonnees(codeErreurPostgres(erreur));
    }
  }

  // Aucun détail PostgreSQL n'est renvoyé au client (503 via gestionnaireErreurs)
  private async requete<T extends object>(sql: string, params: unknown[]): Promise<T[]> {
    try {
      const { rows } = await this.obtenirPool().query(sql, params);
      return rows as T[];
    } catch (erreur) {
      throw new ErreurBaseDeDonnees(codeErreurPostgres(erreur));
    }
  }
}
