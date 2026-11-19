import type { Pool, QueryResultRow } from "pg";
import { ErreurApi } from "../commun/erreurs";
import { obtenirPool } from "../configuration/baseDeDonnees";
import type {
  DepotSignalements,
  FiltresAdminSignalements,
  PageSignalements,
  Signalement,
  SignalementAdmin,
  StatutSignalement,
  TypeSignalement
} from "./signalements.types";

interface LigneSignalement extends QueryResultRow {
  id: string;
  reference: string;
  auteur_id: string;
  bus_id: string | null;
  trajet_id: string | null;
  type: string;
  commentaire: string | null;
  statut: string;
  observe_le: Date | string;
  recu_le: Date | string;
  cle_idempotence: string;
  version: number;
  archive_le: Date | string | null;
  cree_le: Date | string;
  latitude: number | null;
  longitude: number | null;
}

interface LigneAdmin extends QueryResultRow {
  reference: string;
  bus: string;
  type: string;
  statut: string;
  recu_le: Date | string;
  observe_le: Date | string;
  commentaire: string | null;
  version: number;
}

const COLONNES_SIGNALEMENT = `
    s.id::text AS id,
    s.reference,
    s.auteur_id::text AS auteur_id,
    s.bus_id::text AS bus_id,
    s.trajet_id::text AS trajet_id,
    s.type,
    s.commentaire,
    s.statut,
    s.observe_le,
    s.recu_le,
    s.cle_idempotence,
    s.version,
    s.archive_le,
    s.cree_le,
    ST_X(s.position) AS longitude,
    ST_Y(s.position) AS latitude
`;

function enIso(valeur: Date | string): string {
  return valeur instanceof Date ? valeur.toISOString() : new Date(valeur).toISOString();
}

function enIsoNulle(valeur: Date | string | null): string | null {
  return valeur === null ? null : enIso(valeur);
}

function traduireErreur(erreur: unknown): never {
  if (erreur instanceof ErreurApi) throw erreur;
  if (erreur && typeof erreur === "object" && "code" in erreur) {
    const code = String((erreur as { code: unknown }).code);
    const contrainte =
      "constraint" in erreur ? String((erreur as { constraint: unknown }).constraint) : "";
    if (code === "23503") {
      throw new ErreurApi(400, "CIBLE_INEXISTANTE", "Le bus ou le trajet indiqué n'existe pas.");
    }
    if (code === "23514") {
      throw new ErreurApi(400, "DONNEES_INVALIDES", "Données de signalement invalides.");
    }
    if (code === "23505" && contrainte === "uq_signalements_idempotence") {
      throw new ErreurApi(409, "SIGNALEMENT_IDEMPOTENT", "Signalement déjà enregistré.");
    }
    if (code === "23505") {
      throw new ErreurApi(409, "REFERENCE_EXISTANTE", "Référence de signalement déjà utilisée.");
    }
  }
  throw erreur;
}

function mapperSignalement(ligne: LigneSignalement): Signalement {
  return {
    id: ligne.id,
    reference: ligne.reference,
    auteurId: ligne.auteur_id,
    busId: ligne.bus_id,
    trajetId: ligne.trajet_id,
    categorie: null,
    type: ligne.type as TypeSignalement,
    commentaire: ligne.commentaire,
    statut: ligne.statut as Signalement["statut"],
    observeLe: enIso(ligne.observe_le),
    recuLe: enIso(ligne.recu_le),
    position:
      ligne.latitude !== null && ligne.longitude !== null
        ? { latitude: Number(ligne.latitude), longitude: Number(ligne.longitude) }
        : null,
    cleIdempotence: ligne.cle_idempotence,
    version: ligne.version,
    archiveLe: enIsoNulle(ligne.archive_le),
    creeLe: enIso(ligne.cree_le)
  };
}

function mapperAdmin(ligne: LigneAdmin): SignalementAdmin {
  return {
    reference: ligne.reference,
    bus: ligne.bus,
    type: ligne.type as TypeSignalement,
    statut: ligne.statut as StatutSignalement,
    recuLe: enIso(ligne.recu_le),
    observeLe: enIso(ligne.observe_le),
    commentaire: ligne.commentaire,
    version: ligne.version
  };
}

export class DepotSignalementsPostgres implements DepotSignalements {
  constructor(private readonly obtenirPoolBdd: () => Pool = obtenirPool) {}

  async creer(signalement: Signalement): Promise<Signalement> {
    try {
      const { rows } = await this.obtenirPoolBdd().query<LigneSignalement>(
        `INSERT INTO signalements AS s
            (reference, auteur_id, bus_id, trajet_id, type, commentaire, statut,
             observe_le, recu_le, cle_idempotence, position, version)
         VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
             CASE WHEN $11::double precision IS NULL THEN NULL
                  ELSE ST_SetSRID(ST_MakePoint($11, $12), 4326) END,
             1)
         RETURNING ${COLONNES_SIGNALEMENT}`,
        [
          signalement.reference,
          signalement.auteurId,
          signalement.busId,
          signalement.trajetId,
          signalement.type,
          signalement.commentaire,
          signalement.statut,
          signalement.observeLe,
          signalement.recuLe,
          signalement.cleIdempotence,
          signalement.position?.longitude ?? null,
          signalement.position?.latitude ?? null
        ]
      );
      return mapperSignalement(rows[0]);
    } catch (erreur) {
      traduireErreur(erreur);
    }
  }

  async trouverParCleIdempotence(
    auteurId: string,
    cleIdempotence: string
  ): Promise<Signalement | null> {
    const { rows } = await this.obtenirPoolBdd().query<LigneSignalement>(
      `SELECT ${COLONNES_SIGNALEMENT}
         FROM signalements s
        WHERE s.auteur_id = $1
          AND s.cle_idempotence = $2
          AND s.archive_le IS NULL`,
      [auteurId, cleIdempotence]
    );
    return rows[0] ? mapperSignalement(rows[0]) : null;
  }

  async listerParAuteur(auteurId: string): Promise<Signalement[]> {
    const { rows } = await this.obtenirPoolBdd().query<LigneSignalement>(
      `SELECT ${COLONNES_SIGNALEMENT}
         FROM signalements s
        WHERE s.auteur_id = $1
          AND s.archive_le IS NULL
        ORDER BY s.recu_le DESC, s.id DESC`,
      [auteurId]
    );
    return rows.map(mapperSignalement);
  }

  async listerAdmin(filtres: FiltresAdminSignalements): Promise<PageSignalements> {
    const conditions = ["s.archive_le IS NULL"];
    const parametres: unknown[] = [];

    if (filtres.q) {
      parametres.push(`%${filtres.q}%`);
      const index = parametres.length;
      conditions.push(
        `(s.reference ILIKE $${index} OR b.plaque ILIKE $${index} OR t.nom ILIKE $${index} OR s.commentaire ILIKE $${index})`
      );
    }

    if (filtres.statut) {
      parametres.push(filtres.statut);
      const index = parametres.length;
      conditions.push(`s.statut = $${index}`);
    }

    const where = conditions.join(" AND ");
    const jointures = `
        FROM signalements s
        LEFT JOIN bus b ON b.id = s.bus_id
        LEFT JOIN trajets t ON t.id = s.trajet_id
    `;

    const { rows: comptes } = await this.obtenirPoolBdd().query<{ total: number }>(
      `SELECT count(*)::int AS total ${jointures} WHERE ${where}`,
      parametres
    );
    const total = comptes[0]?.total ?? 0;

    parametres.push(filtres.limit, (filtres.page - 1) * filtres.limit);
    const indexLimite = parametres.length - 1;
    const indexDecalage = parametres.length;

    const { rows } = await this.obtenirPoolBdd().query<LigneAdmin>(
      `SELECT s.reference,
              COALESCE(b.plaque, t.nom, '') AS bus,
              s.type,
              s.statut,
              s.recu_le,
              s.observe_le,
              s.commentaire,
              s.version
         ${jointures}
        WHERE ${where}
        ORDER BY s.recu_le DESC, s.id DESC
        LIMIT $${indexLimite} OFFSET $${indexDecalage}`,
      parametres
    );

    return {
      elements: rows.map(mapperAdmin),
      total,
      page: filtres.page,
      limit: filtres.limit,
      pages: total === 0 ? 1 : Math.ceil(total / filtres.limit)
    };
  }

  async mettreAJourStatut(
    reference: string,
    statut: StatutSignalement
  ): Promise<SignalementAdmin | null> {
    const { rows } = await this.obtenirPoolBdd().query<LigneAdmin>(
      `UPDATE signalements
          SET statut = $1,
              version = version + 1
        WHERE reference = $2
          AND archive_le IS NULL
        RETURNING reference, '' AS bus, type, statut, recu_le, observe_le, commentaire, version`,
      [statut, reference]
    );
    return rows[0] ? mapperAdmin(rows[0]) : null;
  }
}
