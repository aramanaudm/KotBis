// Implémentation PostgreSQL du dépôt des comptes (tables comptes, roles, personnel, voyageurs,
// sessions, journal_audit). Utilise le pool partagé de configuration/baseDeDonnees.
import type { PoolClient } from "pg";
import { obtenirPool } from "../configuration/baseDeDonnees";
import { ErreurApi } from "../commun/erreur-api";
import type { DepotComptes, EntreeAudit, FiltresComptes, PageComptes, TransactionComptes } from "./comptes.depot";
import type { CompteAuthentifie, CompteGere, EtatCompte, RolePersonnel } from "./comptes.types";

// Clé du verrou consultatif de gouvernance (RG03 / EF-AUTH-014)
const VERROU_GOUVERNANCE_ADMIN = 46014;

const COLONNES = `c.id, c.email, COALESCE(p.nom_affiche, v.pseudo) AS nom, r.code AS role, c.etat, c.version`;
const JOINTURES = `JOIN roles r ON r.id = c.role_id
  LEFT JOIN personnel p ON p.compte_id = c.id
  LEFT JOIN voyageurs v ON v.compte_id = c.id`;

// BIGINT est renvoyé sous forme de chaîne par pg : conversion explicite
function versCompte(ligne: Record<string, unknown>): CompteGere {
  return {
    id: Number(ligne.id),
    email: String(ligne.email),
    nom: (ligne.nom as string | null) ?? null,
    role: ligne.role as CompteGere["role"],
    etat: ligne.etat as EtatCompte,
    version: Number(ligne.version)
  };
}

class TransactionPostgres implements TransactionComptes {
  constructor(private readonly client: PoolClient) {}

  async verrouillerGouvernance(): Promise<void> {
    await this.client.query("SELECT pg_advisory_xact_lock($1)", [VERROU_GOUVERNANCE_ADMIN]);
  }

  async trouverPourMiseAJour(id: number): Promise<CompteGere | null> {
    const { rows } = await this.client.query(
      `SELECT ${COLONNES} FROM comptes c ${JOINTURES} WHERE c.id = $1 FOR UPDATE OF c`,
      [id]
    );
    return rows[0] ? versCompte(rows[0]) : null;
  }

  async compterAdministrateursActifs(): Promise<number> {
    const { rows } = await this.client.query(
      `SELECT count(*)::int AS nombre FROM comptes c JOIN roles r ON r.id = c.role_id
       WHERE r.code = 'administrateur' AND c.etat = 'actif'`
    );
    return Number(rows[0].nombre);
  }

  async modifierEtat(id: number, etat: EtatCompte, versionAttendue: number): Promise<CompteGere | null> {
    const { rowCount } = await this.client.query(
      `UPDATE comptes SET etat = $2, version = version + 1, modifie_le = now()
       WHERE id = $1 AND version = $3`,
      [id, etat, versionAttendue]
    );
    return rowCount ? this.trouverPourMiseAJour(id) : null;
  }

  async modifierRole(id: number, role: RolePersonnel, versionAttendue: number): Promise<CompteGere | null> {
    // La table roles est alimentée à la main : on vérifie qu'elle l'a été
    const { rows } = await this.client.query("SELECT id FROM roles WHERE code = $1", [role]);
    if (!rows[0]) {
      throw new ErreurApi(500, "ROLES_NON_INITIALISES", "Les rôles ne sont pas initialisés dans la base.");
    }
    const { rowCount } = await this.client.query(
      `UPDATE comptes SET role_id = $2, version = version + 1, modifie_le = now()
       WHERE id = $1 AND version = $3`,
      [id, rows[0].id, versionAttendue]
    );
    return rowCount ? this.trouverPourMiseAJour(id) : null;
  }

  async revoquerSessions(compteId: number): Promise<void> {
    await this.client.query(
      "UPDATE sessions SET revoque_le = now() WHERE compte_id = $1 AND revoque_le IS NULL",
      [compteId]
    );
  }

  async ecrireAudit(e: EntreeAudit): Promise<void> {
    await this.client.query(
      `INSERT INTO journal_audit (acteur_id, action, table_cible, cle_cible, avant, apres, requete_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [e.acteurId, e.action, e.tableCible, e.cleCible, JSON.stringify(e.avant), JSON.stringify(e.apres), e.requeteId]
    );
  }
}

export class DepotComptesPostgres implements DepotComptes {
  async trouverCompteAuthentifie(id: number): Promise<CompteAuthentifie | null> {
    const { rows } = await obtenirPool().query(
      "SELECT c.id, r.code AS role, c.etat FROM comptes c JOIN roles r ON r.id = c.role_id WHERE c.id = $1",
      [id]
    );
    return rows[0] ? { id: Number(rows[0].id), role: rows[0].role, etat: rows[0].etat } : null;
  }

  async lister(f: FiltresComptes): Promise<PageComptes> {
    const { rows } = await obtenirPool().query(
      `SELECT ${COLONNES}, count(*) OVER()::int AS total FROM comptes c ${JOINTURES}
       WHERE ($1::text IS NULL OR r.code = $1)
         AND ($2::text IS NULL OR c.etat = $2)
         AND (NOT $3::boolean OR r.code <> 'voyageur')
       ORDER BY c.id
       LIMIT $4 OFFSET $5`,
      [f.role ?? null, f.etat ?? null, f.personnelSeulement ?? false, f.limite, (f.page - 1) * f.limite]
    );
    return { elements: rows.map(versCompte), total: rows[0] ? Number(rows[0].total) : 0 };
  }

  async enTransaction<T>(travail: (tx: TransactionComptes) => Promise<T>): Promise<T> {
    const client = await obtenirPool().connect();
    try {
      await client.query("BEGIN");
      const resultat = await travail(new TransactionPostgres(client));
      // Si l'audit échoue, l'exception provoque le ROLLBACK : l'opération n'est pas annoncée réussie
      await client.query("COMMIT");
      return resultat;
    } catch (erreur) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw erreur;
    } finally {
      client.release();
    }
  }
}
