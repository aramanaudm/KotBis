import type { Pool, PoolClient } from "pg";
import { ErreurApi, ErreurConflit, ErreurNonTrouve } from "../commun/erreurs";
import {
  avecTransaction,
  codeErreurPostgres,
  ErreurBaseDeDonnees as ErreurConnexionBdd
} from "../configuration/baseDeDonnees";
import type {
  ChampsProfilModifiables,
  CompteAvecSecret,
  ProfilUtilisateur
} from "./types";

interface LigneProfil {
  compte_id: string;
  identifiant_public: string;
  email: string;
  role: string;
  pseudo: string | null;
  avatar_ref: string | null;
  zone_libre: string | null;
  telephone: string | null;
  cree_le: Date;
}

interface LigneCompte extends LigneProfil {
  mot_de_passe_hash: string | null;
  etat: string;
}

interface LigneSession extends LigneProfil {
  session_id: string;
}

export interface DonneesCreationCompte {
  pseudo: string;
  email: string;
  motDePasseHash: string;
  identifiantPublic: string;
  zoneLibre: string | null;
  telephone: string | null;
}

export interface SessionActive extends ProfilUtilisateur {
  sessionId: string;
}

export interface DepotAuthentification {
  avecTransaction<T>(action: (client: PoolClient) => Promise<T>): Promise<T>;
  trouverCompteParEmail(client: PoolClient, email: string): Promise<CompteAvecSecret | null>;
  trouverCompteParIdentifiant(
    client: PoolClient,
    identifiant: string
  ): Promise<CompteAvecSecret | null>;
  trouverCompteParId(client: PoolClient, compteId: string): Promise<CompteAvecSecret | null>;
  trouverProfilParId(client: PoolClient, compteId: string): Promise<ProfilUtilisateur | null>;
  creerCompteVoyageur(client: PoolClient, donnees: DonneesCreationCompte): Promise<ProfilUtilisateur>;
  creerSession(
    client: PoolClient,
    compteId: string,
    empreinteJeton: string,
    expireLe: Date
  ): Promise<string>;
  trouverSessionValide(client: PoolClient, empreinteJeton: string): Promise<SessionActive | null>;
  revoquerSession(client: PoolClient, empreinteJeton: string): Promise<boolean>;
  revoquerToutesSessions(client: PoolClient, compteId: string, saufEmpreinte?: string): Promise<void>;
  mettreAJourMotDePasse(client: PoolClient, compteId: string, hash: string): Promise<void>;
  mettreAJourEmail(client: PoolClient, compteId: string, email: string): Promise<ProfilUtilisateur>;
  mettreAJourProfil(
    client: PoolClient,
    compteId: string,
    champs: ChampsProfilModifiables
  ): Promise<ProfilUtilisateur>;
  creerCodeReinitialisation(
    client: PoolClient,
    compteId: string,
    empreinteCode: string,
    expireLe: Date
  ): Promise<void>;
  trouverCodeReinitialisationValide(
    client: PoolClient,
    compteId: string,
    empreinteCode: string
  ): Promise<{ id: string } | null>;
  marquerCodeUtilise(client: PoolClient, codeId: string): Promise<boolean>;
}

const COLONNES_PROFIL = `
  c.id::text AS compte_id,
  c.identifiant_public,
  c.email,
  r.code AS role,
  v.pseudo,
  v.avatar_ref,
  v.zone_libre,
  to_jsonb(v) ->> 'telephone' AS telephone,
  c.cree_le
`;

const JOINTURES_PROFIL = `
  FROM comptes c
  JOIN roles r ON r.id = c.role_id
  LEFT JOIN voyageurs v ON v.compte_id = c.id
`;

const COLONNES_COMPTE = `
  ${COLONNES_PROFIL},
  c.mot_de_passe_hash,
  c.etat
`;

function versProfil(ligne: LigneProfil): ProfilUtilisateur {
  return {
    compteId: ligne.compte_id,
    identifiantPublic: ligne.identifiant_public,
    email: ligne.email,
    role: ligne.role,
    pseudo: ligne.pseudo,
    avatarRef: ligne.avatar_ref,
    zoneLibre: ligne.zone_libre,
    telephone: ligne.telephone,
    creeLe: ligne.cree_le.toISOString()
  };
}

function versCompte(ligne: LigneCompte): CompteAvecSecret {
  return {
    ...versProfil(ligne),
    motDePasseHash: ligne.mot_de_passe_hash,
    etat: ligne.etat
  };
}

function contrainteUnique(erreur: unknown): string | undefined {
  if (erreur && typeof erreur === "object" && "constraint" in erreur) {
    return String((erreur as { constraint: unknown }).constraint);
  }
  return undefined;
}

function mapperErreur(erreur: unknown): unknown {
  if (erreur instanceof ErreurApi || erreur instanceof ErreurConnexionBdd) {
    return erreur;
  }

  const code = codeErreurPostgres(erreur);
  if (code === "23505") {
    const contrainte = contrainteUnique(erreur);
    if (contrainte === "uq_comptes_email") {
      return new ErreurConflit("EMAIL_DEJA_UTILISE", "Cette adresse e-mail est déjà utilisée.");
    }
    if (contrainte === "uq_voyageurs_pseudo") {
      return new ErreurConflit("PSEUDO_DEJA_UTILISE", "Ce pseudonyme est déjà utilisé.");
    }
    return new ErreurConflit("VALEUR_DEJA_UTILISEE", "Une valeur unique est déjà utilisée.");
  }
  if (code) {
    return new ErreurConnexionBdd(code);
  }
  if (erreur instanceof Error && erreur.message.startsWith("Configuration BDD")) {
    return new ErreurConnexionBdd();
  }
  return erreur;
}

export class DepotAuthentificationPostgres implements DepotAuthentification {
  constructor(private readonly fournirPool: () => Pool) {}

  async avecTransaction<T>(action: (client: PoolClient) => Promise<T>): Promise<T> {
    try {
      return await avecTransaction(this.fournirPool(), action);
    } catch (erreur) {
      throw mapperErreur(erreur);
    }
  }

  async trouverCompteParEmail(client: PoolClient, email: string): Promise<CompteAvecSecret | null> {
    const resultat = await client.query<LigneCompte>(
      `SELECT ${COLONNES_COMPTE} ${JOINTURES_PROFIL} WHERE lower(c.email) = lower($1) LIMIT 1`,
      [email]
    );
    return resultat.rows[0] ? versCompte(resultat.rows[0]) : null;
  }

  async trouverCompteParIdentifiant(
    client: PoolClient,
    identifiant: string
  ): Promise<CompteAvecSecret | null> {
    const parEmail = await this.trouverCompteParEmail(client, identifiant);
    if (parEmail) {
      return parEmail;
    }

    const parPseudo = await client.query<LigneCompte>(
      `SELECT ${COLONNES_COMPTE} ${JOINTURES_PROFIL} WHERE lower(v.pseudo) = lower($1) LIMIT 1`,
      [identifiant]
    );
    return parPseudo.rows[0] ? versCompte(parPseudo.rows[0]) : null;
  }

  async trouverCompteParId(client: PoolClient, compteId: string): Promise<CompteAvecSecret | null> {
    const resultat = await client.query<LigneCompte>(
      `SELECT ${COLONNES_COMPTE} ${JOINTURES_PROFIL} WHERE c.id = $1 LIMIT 1`,
      [compteId]
    );
    return resultat.rows[0] ? versCompte(resultat.rows[0]) : null;
  }

  async trouverProfilParId(
    client: PoolClient,
    compteId: string
  ): Promise<ProfilUtilisateur | null> {
    const resultat = await client.query<LigneProfil>(
      `SELECT ${COLONNES_PROFIL} ${JOINTURES_PROFIL} WHERE c.id = $1 LIMIT 1`,
      [compteId]
    );
    return resultat.rows[0] ? versProfil(resultat.rows[0]) : null;
  }

  async creerCompteVoyageur(
    client: PoolClient,
    donnees: DonneesCreationCompte
  ): Promise<ProfilUtilisateur> {
    const comptes = await client.query<{
      compte_id: string;
      email: string;
      identifiant_public: string;
      cree_le: Date;
    }>(
      `INSERT INTO comptes (email, mot_de_passe_hash, role_id, etat, identifiant_public)
       SELECT $1, $2, r.id, 'actif', $3
       FROM roles r
       WHERE r.code = 'voyageur'
       RETURNING id::text AS compte_id, email, identifiant_public, cree_le`,
      [donnees.email, donnees.motDePasseHash, donnees.identifiantPublic]
    );

    const compte = comptes.rows[0];
    if (!compte) {
      throw new ErreurConnexionBdd("ROLE_VOYAGEUR_ABSENT");
    }

    const voyageurs = await client.query<{
      pseudo: string;
      avatar_ref: string | null;
      zone_libre: string | null;
      telephone: string | null;
    }>(
      `INSERT INTO voyageurs (compte_id, pseudo, zone_libre, telephone)
       VALUES ($1, $2, $3, $4)
       RETURNING pseudo, avatar_ref, zone_libre, telephone`,
      [compte.compte_id, donnees.pseudo, donnees.zoneLibre, donnees.telephone]
    );

    const voyageur = voyageurs.rows[0];
    if (!voyageur) {
      throw new ErreurConnexionBdd("VOYAGEUR_NON_CREE");
    }

    return {
      compteId: compte.compte_id,
      identifiantPublic: compte.identifiant_public,
      email: compte.email,
      role: "voyageur",
      pseudo: voyageur.pseudo,
      avatarRef: voyageur.avatar_ref,
      zoneLibre: voyageur.zone_libre,
      telephone: voyageur.telephone,
      creeLe: compte.cree_le.toISOString()
    };
  }

  async creerSession(
    client: PoolClient,
    compteId: string,
    empreinteJeton: string,
    expireLe: Date
  ): Promise<string> {
    const resultat = await client.query<{ id: string }>(
      `INSERT INTO sessions (compte_id, empreinte_jeton, expire_le)
       VALUES ($1, $2, $3)
       RETURNING id::text`,
      [compteId, empreinteJeton, expireLe]
    );
    const ligne = resultat.rows[0];
    if (!ligne) {
      throw new ErreurConnexionBdd("SESSION_NON_CREEE");
    }
    return ligne.id;
  }

  async trouverSessionValide(
    client: PoolClient,
    empreinteJeton: string
  ): Promise<SessionActive | null> {
    const resultat = await client.query<LigneSession>(
      `SELECT ${COLONNES_PROFIL}, s.id::text AS session_id
       FROM sessions s
       JOIN comptes c ON c.id = s.compte_id
       JOIN roles r ON r.id = c.role_id
       LEFT JOIN voyageurs v ON v.compte_id = c.id
       WHERE s.empreinte_jeton = $1
         AND s.revoque_le IS NULL
         AND s.expire_le > now()
         AND c.etat = 'actif'
       LIMIT 1`,
      [empreinteJeton]
    );

    if (!resultat.rows[0]) {
      return null;
    }
    return { ...versProfil(resultat.rows[0]), sessionId: resultat.rows[0].session_id };
  }

  async revoquerSession(client: PoolClient, empreinteJeton: string): Promise<boolean> {
    const resultat = await client.query(
      `UPDATE sessions
       SET revoque_le = now()
       WHERE empreinte_jeton = $1 AND revoque_le IS NULL`,
      [empreinteJeton]
    );
    return (resultat.rowCount ?? 0) > 0;
  }

  async revoquerToutesSessions(
    client: PoolClient,
    compteId: string,
    saufEmpreinte?: string
  ): Promise<void> {
    if (saufEmpreinte) {
      await client.query(
        `UPDATE sessions
         SET revoque_le = now()
         WHERE compte_id = $1 AND revoque_le IS NULL AND empreinte_jeton <> $2`,
        [compteId, saufEmpreinte]
      );
      return;
    }

    await client.query(
      `UPDATE sessions
       SET revoque_le = now()
       WHERE compte_id = $1 AND revoque_le IS NULL`,
      [compteId]
    );
  }

  async mettreAJourMotDePasse(client: PoolClient, compteId: string, hash: string): Promise<void> {
    const resultat = await client.query(
      `UPDATE comptes
       SET mot_de_passe_hash = $2, modifie_le = now(), version = version + 1
       WHERE id = $1`,
      [compteId, hash]
    );
    if (resultat.rowCount === 0) {
      throw new ErreurNonTrouve("Compte introuvable.");
    }
  }

  async mettreAJourEmail(
    client: PoolClient,
    compteId: string,
    email: string
  ): Promise<ProfilUtilisateur> {
    const resultat = await client.query(
      `UPDATE comptes
       SET email = $2, modifie_le = now(), version = version + 1
       WHERE id = $1`,
      [compteId, email]
    );
    if (resultat.rowCount === 0) {
      throw new ErreurNonTrouve("Compte introuvable.");
    }
    return this.exigerProfil(client, compteId);
  }

  async mettreAJourProfil(
    client: PoolClient,
    compteId: string,
    champs: ChampsProfilModifiables
  ): Promise<ProfilUtilisateur> {
    const affectations: string[] = [];
    const valeurs: unknown[] = [compteId];

    if (champs.pseudo !== undefined) {
      valeurs.push(champs.pseudo);
      affectations.push(`pseudo = $${valeurs.length}`);
    }
    if (champs.zoneLibre !== undefined) {
      valeurs.push(champs.zoneLibre);
      affectations.push(`zone_libre = $${valeurs.length}`);
    }
    if (champs.avatarRef !== undefined) {
      valeurs.push(champs.avatarRef);
      affectations.push(`avatar_ref = $${valeurs.length}`);
    }
    if (champs.telephone !== undefined) {
      valeurs.push(champs.telephone);
      affectations.push(`telephone = $${valeurs.length}`);
    }

    affectations.push("modifie_le = now()", "version = version + 1");

    const resultat = await client.query(
      `UPDATE voyageurs
       SET ${affectations.join(", ")}
       WHERE compte_id = $1`,
      valeurs
    );
    if (resultat.rowCount === 0) {
      throw new ErreurNonTrouve("Profil voyageur introuvable.");
    }
    return this.exigerProfil(client, compteId);
  }

  async creerCodeReinitialisation(
    client: PoolClient,
    compteId: string,
    empreinteCode: string,
    expireLe: Date
  ): Promise<void> {
    await client.query(
      `UPDATE codes_reinitialisation
       SET utilise_le = now()
       WHERE compte_id = $1 AND utilise_le IS NULL`,
      [compteId]
    );
    await client.query(
      `INSERT INTO codes_reinitialisation (compte_id, empreinte_code, expire_le)
       VALUES ($1, $2, $3)`,
      [compteId, empreinteCode, expireLe]
    );
  }

  async trouverCodeReinitialisationValide(
    client: PoolClient,
    compteId: string,
    empreinteCode: string
  ): Promise<{ id: string } | null> {
    const resultat = await client.query<{ id: string }>(
      `SELECT id::text AS id
       FROM codes_reinitialisation
       WHERE compte_id = $1
         AND empreinte_code = $2
         AND utilise_le IS NULL
         AND expire_le > now()
       LIMIT 1`,
      [compteId, empreinteCode]
    );
    return resultat.rows[0] ?? null;
  }

  async marquerCodeUtilise(client: PoolClient, codeId: string): Promise<boolean> {
    const resultat = await client.query(
      `UPDATE codes_reinitialisation
       SET utilise_le = now()
       WHERE id = $1 AND utilise_le IS NULL`,
      [codeId]
    );
    return (resultat.rowCount ?? 0) > 0;
  }

  private async exigerProfil(client: PoolClient, compteId: string): Promise<ProfilUtilisateur> {
    const profil = await this.trouverProfilParId(client, compteId);
    if (!profil) {
      throw new ErreurNonTrouve("Compte introuvable.");
    }
    return profil;
  }
}
