import type { Pool } from "pg";

import {
  SessionPartagePosition,
  StatutPartage,
  StockageSessionPartage,
} from "./partage-position.types";

interface LigneSessionPartage {
  id: string;
  compte_id: string;
  date_debut: Date;
  date_fin: Date | null;
  date_expiration: Date;
  statut: StatutPartage;
}

export class StockagePartagePostgres implements StockageSessionPartage {
  constructor(private readonly pool: Pool) {}

  private convertir(ligne: LigneSessionPartage): SessionPartagePosition {
    return {
      id: ligne.id,
      compteId: String(ligne.compte_id),
      dateDebut: ligne.date_debut,
      dateFin: ligne.date_fin,
      dateExpiration: ligne.date_expiration,
      statut: ligne.statut,
    };
  }

  async creer(session: SessionPartagePosition): Promise<void> {
    await this.pool.query(
      `
      INSERT INTO sessions_partage_position (
        id,
        compte_id,
        date_debut,
        date_fin,
        date_expiration,
        statut
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        session.id,
        session.compteId,
        session.dateDebut,
        session.dateFin,
        session.dateExpiration,
        session.statut,
      ],
    );
  }

  async trouverParId(id: string): Promise<SessionPartagePosition | null> {
    const resultat = await this.pool.query<LigneSessionPartage>(
      `
      SELECT
        id,
        compte_id,
        date_debut,
        date_fin,
        date_expiration,
        statut
      FROM sessions_partage_position
      WHERE id = $1
      `,
      [id],
    );

    const ligne = resultat.rows[0];

    return ligne ? this.convertir(ligne) : null;
  }

  async modifier(session: SessionPartagePosition): Promise<void> {
    const resultat = await this.pool.query(
      `
      UPDATE sessions_partage_position
      SET
        date_fin = $3,
        statut = $4
      WHERE id = $1
        AND compte_id = $2
        AND statut = 'active'
      `,
      [
        session.id,
        session.compteId,
        session.dateFin,
        session.statut,
      ],
    );

    if (resultat.rowCount !== 1) {
      throw new Error(
        "Impossible de modifier cette session : elle est inexistante ou n'est plus active.",
      );
    }
  }
}