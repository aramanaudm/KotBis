import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { ErreurConflit } from "../../src/commun/erreurs";
import type { CompteAvecSecret, ProfilUtilisateur } from "../../src/authentification/types";
import type {
  DepotAuthentification,
  DonneesCreationCompte,
  SessionActive
} from "../../src/authentification/depot";

interface SessionSimulee {
  id: string;
  compteId: string;
  expireLe: Date;
  revoqueLe: Date | null;
}

function versProfil(compte: CompteAvecSecret): ProfilUtilisateur {
  return {
    compteId: compte.compteId,
    identifiantPublic: compte.identifiantPublic,
    email: compte.email,
    role: compte.role,
    pseudo: compte.pseudo,
    avatarRef: compte.avatarRef,
    zoneLibre: compte.zoneLibre,
    telephone: compte.telephone,
    creeLe: compte.creeLe
  };
}

export class FauxDepot implements DepotAuthentification {
  readonly comptes = new Map<string, CompteAvecSecret>();
  readonly sessions = new Map<string, SessionSimulee>();
  private prochainId = 1;

  async avecTransaction<T>(action: (client: PoolClient) => Promise<T>): Promise<T> {
    return action({} as PoolClient);
  }

  ajouterCompte(donnees: {
    email: string;
    pseudo: string;
    motDePasseHash: string;
    etat?: string;
  }): CompteAvecSecret {
    const compteId = String(this.prochainId++);
    const compte: CompteAvecSecret = {
      compteId,
      identifiantPublic: randomUUID(),
      email: donnees.email.toLowerCase(),
      role: "voyageur",
      pseudo: donnees.pseudo,
      avatarRef: null,
      zoneLibre: null,
      telephone: null,
      creeLe: new Date().toISOString(),
      motDePasseHash: donnees.motDePasseHash,
      etat: donnees.etat ?? "actif"
    };
    this.comptes.set(compteId, compte);
    return compte;
  }

  async trouverCompteParIdentifiant(
    _client: PoolClient,
    identifiant: string
  ): Promise<CompteAvecSecret | null> {
    const recherche = identifiant.toLowerCase();
    for (const compte of this.comptes.values()) {
      if (compte.email === recherche || compte.pseudo?.toLowerCase() === recherche) {
        return compte;
      }
    }
    return null;
  }

  async creerCompteVoyageur(
    _client: PoolClient,
    donnees: DonneesCreationCompte
  ): Promise<ProfilUtilisateur> {
    const email = donnees.email.toLowerCase();
    const pseudo = donnees.pseudo.toLowerCase();
    for (const compte of this.comptes.values()) {
      if (compte.email === email) {
        throw new ErreurConflit("EMAIL_DEJA_UTILISE", "Cette adresse e-mail est déjà utilisée.");
      }
      if (compte.pseudo?.toLowerCase() === pseudo) {
        throw new ErreurConflit("PSEUDO_DEJA_UTILISE", "Ce pseudonyme est déjà utilisé.");
      }
    }

    const compteId = String(this.prochainId++);
    const compte: CompteAvecSecret = {
      compteId,
      identifiantPublic: donnees.identifiantPublic,
      email,
      role: "voyageur",
      pseudo: donnees.pseudo,
      avatarRef: null,
      zoneLibre: donnees.zoneLibre,
      telephone: donnees.telephone,
      creeLe: new Date().toISOString(),
      motDePasseHash: donnees.motDePasseHash,
      etat: "actif"
    };
    this.comptes.set(compteId, compte);
    return versProfil(compte);
  }

  async creerSession(
    _client: PoolClient,
    compteId: string,
    empreinteJeton: string,
    expireLe: Date
  ): Promise<string> {
    const id = randomUUID();
    this.sessions.set(empreinteJeton, { id, compteId, expireLe, revoqueLe: null });
    return id;
  }

  async trouverSessionValide(
    _client: PoolClient,
    empreinteJeton: string
  ): Promise<SessionActive | null> {
    const session = this.sessions.get(empreinteJeton);
    if (!session || session.revoqueLe || session.expireLe.getTime() <= Date.now()) {
      return null;
    }
    const compte = this.comptes.get(session.compteId);
    if (!compte || compte.etat !== "actif") {
      return null;
    }
    return { ...versProfil(compte), sessionId: session.id };
  }

  async revoquerSession(_client: PoolClient, empreinteJeton: string): Promise<boolean> {
    const session = this.sessions.get(empreinteJeton);
    if (!session || session.revoqueLe) {
      return false;
    }
    session.revoqueLe = new Date();
    return true;
  }
}
