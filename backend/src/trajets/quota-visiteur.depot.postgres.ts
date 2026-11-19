// KBE-45 : stockage PostgreSQL du quota visiteur.
// Utilise la table `quotas_visiteurs` fournie par l'équipe BO/BDD :
//   id uuid PK, nombre_recherches integer >= 0, empreinte_ip text NULL,
//   cree_le timestamptz, derniere_recherche_le timestamptz NULL.
import type { Pool, QueryResultRow } from "pg";
import { codeErreurPostgres, ErreurBaseDeDonnees } from "../configuration/baseDeDonnees";
import type { DepotQuotaVisiteurs } from "./quota-visiteur.types";

export class DepotQuotaVisiteursPostgres implements DepotQuotaVisiteurs {
  constructor(private readonly obtenirPool: () => Pool) {}

  async creerJeton(empreinteIp: string, maintenant: Date): Promise<string> {
    const [ligne] = await this.executer<{ id: string }>(
      `INSERT INTO quotas_visiteurs (empreinte_ip, cree_le)
       VALUES ($1, $2)
       RETURNING id::text AS id`,
      [empreinteIp, maintenant]
    );
    return ligne.id;
  }

  async compterJetonsDepuis(empreinteIp: string, depuis: Date): Promise<number> {
    const [ligne] = await this.executer<{ nombre: number }>(
      `SELECT count(*)::int AS nombre
       FROM quotas_visiteurs
       WHERE empreinte_ip = $1 AND cree_le > $2`,
      [empreinteIp, depuis]
    );
    return ligne.nombre;
  }

  async existe(jeton: string): Promise<boolean> {
    const lignes = await this.executer(`SELECT 1 FROM quotas_visiteurs WHERE id = $1`, [jeton]);
    return lignes.length > 0;
  }

  // Mise à jour conditionnelle atomique : deux requêtes simultanées ne peuvent pas
  // dépasser la limite.
  async reserver(jeton: string, maximum: number, maintenant: Date): Promise<number | null> {
    const [ligne] = await this.executer<{ nombre_recherches: number }>(
      `UPDATE quotas_visiteurs
       SET nombre_recherches = nombre_recherches + 1,
           derniere_recherche_le = $3
       WHERE id = $1 AND nombre_recherches < $2
       RETURNING nombre_recherches`,
      [jeton, maximum, maintenant]
    );
    return ligne ? ligne.nombre_recherches : null;
  }

  async rendre(jeton: string): Promise<void> {
    await this.executer(
      `UPDATE quotas_visiteurs
       SET nombre_recherches = nombre_recherches - 1
       WHERE id = $1 AND nombre_recherches > 0`,
      [jeton]
    );
  }

  async effacerEmpreintesAvant(date: Date): Promise<void> {
    await this.executer(
      `UPDATE quotas_visiteurs
       SET empreinte_ip = NULL
       WHERE empreinte_ip IS NOT NULL AND cree_le <= $1`,
      [date]
    );
  }

  // Toute erreur PostgreSQL devient une ErreurBaseDeDonnees (HTTP 503, sans détail sensible).
  private async executer<T extends QueryResultRow>(texte: string, parametres: unknown[]): Promise<T[]> {
    try {
      const resultat = await this.obtenirPool().query<T>(texte, parametres);
      return resultat.rows;
    } catch (erreur) {
      throw new ErreurBaseDeDonnees(codeErreurPostgres(erreur));
    }
  }
}
