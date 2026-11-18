import type { Pool, PoolClient } from "pg";
import { ErreurApi, ErreurConflit } from "../commun/erreurs";
import {
  avecTransaction,
  codeErreurPostgres,
  ErreurBaseDeDonnees as ErreurConnexionBdd
} from "../configuration/baseDeDonnees";
import type { CompteAvecSecret, ProfilUtilisateur } from "./types";

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
  trouverCompteParIdentifiant(
    client: PoolClient,
    identifiant: string
  ): Promise<CompteAvecSecret | null>;
  creerCompteVoyageur(client: PoolClient, donnees: DonneesCreationCompte): Promise<ProfilUtilisateur>;
  creerSession(
    client: PoolClient,
    compteId: string,
    empreinteJeton: string,
    expireLe: Date
  ): Promise<string>;
  trouverSessionValide(client: PoolClient, empreinteJeton: string): Promise<SessionActive | null>;
  revoquerSession(client: PoolClient, empreinteJeton: string): Promise<boolean>;
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

  async trouverCompteParIdentifiant(
    client: PoolClient,
    identifiant: string
  ): Promise<CompteAvecSecret | null> {
    const parEmail = await client.query<LigneCompte>(
      `SELECT ${COLONNES_COMPTE} ${JOINTURES_PROFIL} WHERE lower(c.email) = lower($1) LIMIT 1`,
      [identifiant]
    );
    if (parEmail.rows[0]) {
      return versCompte(parEmail.rows[0]);
    }

    const parPseudo = await client.query<LigneCompte>(
      `SELECT ${COLONNES_COMPTE} ${JOINTURES_PROFIL} WHERE lower(v.pseudo) = lower($1) LIMIT 1`,
      [identifiant]
    );
    return parPseudo.rows[0] ? versCompte(parPseudo.rows[0]) : null;
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
}
