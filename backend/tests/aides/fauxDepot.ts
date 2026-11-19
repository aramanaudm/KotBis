import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { ErreurConflit, ErreurNonTrouve } from "../../src/commun/erreurs";
import type {
  ChampsProfilModifiables,
  CompteAvecSecret,
  ProfilUtilisateur
} from "../../src/authentification/types";
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

interface CodeReinitialisationSimule {
  id: string;
  compteId: string;
  empreinteCode: string;
  expireLe: Date;
  utiliseLe: Date | null;
}

interface DemandeSuppressionSimulee {
  compteId: string;
  motif: string | null;
  statut: "en_attente";
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
  readonly codes = new Map<string, CodeReinitialisationSimule>();
  readonly demandesSuppression: DemandeSuppressionSimulee[] = [];
  private prochainId = 1;
  private prochainCodeId = 1;

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

  async trouverCompteParEmail(
    _client: PoolClient,
    email: string
  ): Promise<CompteAvecSecret | null> {
    const recherche = email.toLowerCase();
    for (const compte of this.comptes.values()) {
      if (compte.email === recherche) {
        return compte;
      }
    }
    return null;
  }

  async trouverCompteParId(
    _client: PoolClient,
    compteId: string
  ): Promise<CompteAvecSecret | null> {
    return this.comptes.get(compteId) ?? null;
  }

  async trouverProfilParId(
    _client: PoolClient,
    compteId: string
  ): Promise<ProfilUtilisateur | null> {
    const compte = this.comptes.get(compteId);
    return compte ? versProfil(compte) : null;
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

  async revoquerToutesSessions(
    _client: PoolClient,
    compteId: string,
    saufEmpreinte?: string
  ): Promise<void> {
    for (const [empreinte, session] of this.sessions) {
      if (session.compteId !== compteId || session.revoqueLe) {
        continue;
      }
      if (saufEmpreinte && empreinte === saufEmpreinte) {
        continue;
      }
      session.revoqueLe = new Date();
    }
  }

  async mettreAJourMotDePasse(
    _client: PoolClient,
    compteId: string,
    hash: string
  ): Promise<void> {
    const compte = this.comptes.get(compteId);
    if (!compte) {
      throw new ErreurNonTrouve("Compte introuvable.");
    }
    compte.motDePasseHash = hash;
  }

  async mettreAJourEmail(
    _client: PoolClient,
    compteId: string,
    email: string
  ): Promise<ProfilUtilisateur> {
    const compte = this.comptes.get(compteId);
    if (!compte) {
      throw new ErreurNonTrouve("Compte introuvable.");
    }

    const emailNormalise = email.toLowerCase();
    for (const autre of this.comptes.values()) {
      if (autre.compteId !== compteId && autre.email === emailNormalise) {
        throw new ErreurConflit("EMAIL_DEJA_UTILISE", "Cette adresse e-mail est déjà utilisée.");
      }
    }

    compte.email = emailNormalise;
    return versProfil(compte);
  }

  async mettreAJourProfil(
    _client: PoolClient,
    compteId: string,
    champs: ChampsProfilModifiables
  ): Promise<ProfilUtilisateur> {
    const compte = this.comptes.get(compteId);
    if (!compte) {
      throw new ErreurNonTrouve("Profil voyageur introuvable.");
    }

    if (champs.pseudo !== undefined) {
      const pseudo = champs.pseudo.toLowerCase();
      for (const autre of this.comptes.values()) {
        if (autre.compteId !== compteId && autre.pseudo?.toLowerCase() === pseudo) {
          throw new ErreurConflit("PSEUDO_DEJA_UTILISE", "Ce pseudonyme est déjà utilisé.");
        }
      }
      compte.pseudo = champs.pseudo;
    }
    if (champs.zoneLibre !== undefined) {
      compte.zoneLibre = champs.zoneLibre;
    }
    if (champs.avatarRef !== undefined) {
      compte.avatarRef = champs.avatarRef;
    }
    if (champs.telephone !== undefined) {
      compte.telephone = champs.telephone;
    }

    return versProfil(compte);
  }

  async creerCodeReinitialisation(
    _client: PoolClient,
    compteId: string,
    empreinteCode: string,
    expireLe: Date
  ): Promise<void> {
    for (const code of this.codes.values()) {
      if (code.compteId === compteId && !code.utiliseLe) {
        code.utiliseLe = new Date();
      }
    }

    const id = String(this.prochainCodeId++);
    this.codes.set(id, { id, compteId, empreinteCode, expireLe, utiliseLe: null });
  }

  async trouverCodeReinitialisationValide(
    _client: PoolClient,
    compteId: string,
    empreinteCode: string
  ): Promise<{ id: string } | null> {
    for (const code of this.codes.values()) {
      if (
        code.compteId === compteId &&
        code.empreinteCode === empreinteCode &&
        !code.utiliseLe &&
        code.expireLe.getTime() > Date.now()
      ) {
        return { id: code.id };
      }
    }
    return null;
  }

  async marquerCodeUtilise(_client: PoolClient, codeId: string): Promise<boolean> {
    const code = this.codes.get(codeId);
    if (!code || code.utiliseLe) {
      return false;
    }
    code.utiliseLe = new Date();
    return true;
  }

  async creerDemandeSuppression(
    _client: PoolClient,
    compteId: string,
    motif: string | null
  ): Promise<void> {
    if (!this.comptes.has(compteId)) {
      throw new ErreurNonTrouve("Compte introuvable.");
    }
    if (
      this.demandesSuppression.some(
        (demande) => demande.compteId === compteId && demande.statut === "en_attente"
      )
    ) {
      return;
    }
    this.demandesSuppression.push({ compteId, motif, statut: "en_attente" });
  }
}
