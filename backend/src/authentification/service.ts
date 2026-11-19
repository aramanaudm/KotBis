import { randomUUID } from "node:crypto";
import {
  ErreurAuthentification,
  ErreurNonTrouve,
  ErreurTropDeRequetes,
  ErreurValidation
} from "../commun/erreurs";
import { LimiteurTentatives } from "../middlewares/limiteurTentatives";
import type { DepotAuthentification } from "./depot";
import {
  dateDansMinutes,
  genererCodeReinitialisation,
  genererJetonSession,
  hacherJeton,
  lireEntierPositif
} from "./jetons";
import { hacherMotDePasse, verifierMotDePasse } from "./motDePasse";
import type {
  ChampsProfilModifiables,
  CompteAvecSecret,
  DonneesInscription,
  ProfilUtilisateur,
  SessionCreee
} from "./types";

const HASH_FACTICE = "$argon2id$v=19$m=19456,t=2,p=1$Tzw5I9FgPyhm7gvVwRjTfQ$hviAw6ri6ZJcE0Rjjnq8YUKIWWkTxbELPDaaM2J7akI";

export interface OptionsServiceAuthentification {
  dureeSessionMinutes?: number;
  dureeCodeReinitialisationMinutes?: number;
  envoyerCodeReinitialisation?: (email: string, code: string) => Promise<void>;
  exposerCodeDeveloppement?: boolean;
  limiteurConnexion?: LimiteurTentatives;
  limiteurReinitialisation?: LimiteurTentatives;
  maintenant?: () => Date;
}

async function envoyerCodeParDefaut(email: string, code: string): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Canal de réinitialisation non configuré.");
  }
  console.info(`[DEV] Code de réinitialisation pour ${email} : ${code}`);
}

export interface ConnexionReussie extends SessionCreee {
  utilisateur: ProfilUtilisateur;
}

export interface SessionVerifiee {
  utilisateur: ProfilUtilisateur;
  empreinteJeton: string;
}

export class ServiceAuthentification {
  private readonly dureeSessionMinutes: number;
  private readonly dureeCodeReinitialisationMinutes: number;
  private readonly envoyerCodeReinitialisation: (email: string, code: string) => Promise<void>;
  private readonly exposerCodeDeveloppement: boolean;
  private readonly limiteurConnexion: LimiteurTentatives;
  private readonly limiteurReinitialisation: LimiteurTentatives;
  private readonly maintenant: () => Date;

  constructor(
    private readonly depot: DepotAuthentification,
    options: OptionsServiceAuthentification = {}
  ) {
    const fenetreMinutes = lireEntierPositif(process.env.FENETRE_TENTATIVES_MINUTES, 15);
    const maximumConnexion = lireEntierPositif(process.env.MAX_TENTATIVES_CONNEXION, 5);
    const maximumReinitialisation = lireEntierPositif(
      process.env.MAX_TENTATIVES_REINITIALISATION,
      5
    );

    this.dureeSessionMinutes =
      options.dureeSessionMinutes ?? lireEntierPositif(process.env.SESSION_DUREE_MINUTES, 1440);
    this.dureeCodeReinitialisationMinutes =
      options.dureeCodeReinitialisationMinutes ??
      lireEntierPositif(process.env.CODE_REINITIALISATION_DUREE_MINUTES, 15);
    this.envoyerCodeReinitialisation = options.envoyerCodeReinitialisation ?? envoyerCodeParDefaut;
    const autoriserCodeDeveloppement =
      options.exposerCodeDeveloppement ?? process.env.AUTH_EXPOSER_CODE_DEV === "true";
    this.exposerCodeDeveloppement =
      process.env.NODE_ENV !== "production" && autoriserCodeDeveloppement;
    this.limiteurConnexion =
      options.limiteurConnexion ?? new LimiteurTentatives(maximumConnexion, fenetreMinutes * 60_000);
    this.limiteurReinitialisation =
      options.limiteurReinitialisation ??
      new LimiteurTentatives(maximumReinitialisation, fenetreMinutes * 60_000);
    this.maintenant = options.maintenant ?? (() => new Date());
  }

  async inscrire(donnees: DonneesInscription): Promise<ProfilUtilisateur> {
    const motDePasseHash = await hacherMotDePasse(donnees.motDePasse);
    return this.depot.avecTransaction((client) =>
      this.depot.creerCompteVoyageur(client, {
        pseudo: donnees.pseudo,
        email: donnees.email,
        motDePasseHash,
        identifiantPublic: randomUUID(),
        zoneLibre: donnees.zoneLibre,
        telephone: donnees.telephone
      })
    );
  }

  async connecter(
    identifiant: string,
    motDePasse: string,
    adresseIp: string
  ): Promise<ConnexionReussie> {
    const cle = `connexion:${adresseIp}:${identifiant.toLowerCase()}`;
    const maintenant = this.maintenant().getTime();
    if (this.limiteurConnexion.estBloque(cle, maintenant)) {
      throw new ErreurTropDeRequetes();
    }

    const compte = await this.depot.avecTransaction((client) =>
      this.depot.trouverCompteParIdentifiant(client, identifiant)
    );
    const hash = compte?.motDePasseHash ?? HASH_FACTICE;
    const motDePasseValide = await verifierMotDePasse(hash, motDePasse);

    if (!compte || !motDePasseValide || compte.etat !== "actif") {
      this.limiteurConnexion.enregistrerEchec(cle, maintenant);
      throw new ErreurAuthentification(
        "IDENTIFIANTS_INVALIDES",
        "Identifiant ou mot de passe incorrect."
      );
    }

    this.limiteurConnexion.reinitialiser(cle);
    const session = await this.creerSession(compte);
    return { ...session, utilisateur: this.profilDepuisCompte(compte) };
  }

  async deconnecter(empreinteJeton: string): Promise<void> {
    await this.depot.avecTransaction((client) => this.depot.revoquerSession(client, empreinteJeton));
  }

  async renouvelerSession(
    utilisateur: ProfilUtilisateur,
    empreinteActuelle: string
  ): Promise<SessionCreee> {
    const jeton = genererJetonSession();
    const empreinteJeton = hacherJeton(jeton);
    const expireLe = dateDansMinutes(this.dureeSessionMinutes, this.maintenant());

    await this.depot.avecTransaction(async (client) => {
      const revoquee = await this.depot.revoquerSession(client, empreinteActuelle);
      if (!revoquee) {
        throw new ErreurAuthentification(
          "SESSION_INVALIDE",
          "Session absente, expirée ou révoquée."
        );
      }
      await this.depot.creerSession(client, utilisateur.compteId, empreinteJeton, expireLe);
    });

    return { jeton, expireLe: expireLe.toISOString() };
  }

  async verifierSession(jeton: string): Promise<SessionVerifiee | null> {
    const empreinteJeton = hacherJeton(jeton);
    const session = await this.depot.avecTransaction((client) =>
      this.depot.trouverSessionValide(client, empreinteJeton)
    );
    if (!session) {
      return null;
    }
    return {
      utilisateur: {
        compteId: session.compteId,
        identifiantPublic: session.identifiantPublic,
        email: session.email,
        role: session.role,
        pseudo: session.pseudo,
        avatarRef: session.avatarRef,
        zoneLibre: session.zoneLibre,
        telephone: session.telephone,
        creeLe: session.creeLe
      },
      empreinteJeton
    };
  }

  async demanderReinitialisation(email: string): Promise<{ devCode?: string }> {
    const compte = await this.depot.avecTransaction((client) =>
      this.depot.trouverCompteParEmail(client, email)
    );
    if (!compte || compte.etat !== "actif") {
      return {};
    }

    const code = genererCodeReinitialisation();
    const empreinteCode = hacherJeton(code);
    const expireLe = dateDansMinutes(this.dureeCodeReinitialisationMinutes, this.maintenant());

    await this.depot.avecTransaction((client) =>
      this.depot.creerCodeReinitialisation(client, compte.compteId, empreinteCode, expireLe)
    );

    try {
      await this.envoyerCodeReinitialisation(compte.email, code);
    } catch (erreur) {
      console.error(
        `[AUTH] Échec de l'envoi du code de réinitialisation : ${
          erreur instanceof Error ? erreur.message : "inconnue"
        }`
      );
    }

    return this.exposerCodeDeveloppement ? { devCode: code } : {};
  }

  async reinitialiserMotDePasse(
    email: string,
    code: string,
    nouveauMotDePasse: string
  ): Promise<void> {
    const cle = `reinitialisation:${email.toLowerCase()}`;
    const maintenant = this.maintenant().getTime();
    if (this.limiteurReinitialisation.estBloque(cle, maintenant)) {
      throw new ErreurTropDeRequetes();
    }

    const compte = await this.depot.avecTransaction((client) =>
      this.depot.trouverCompteParEmail(client, email)
    );
    if (!compte || compte.etat !== "actif") {
      this.limiteurReinitialisation.enregistrerEchec(cle, maintenant);
      throw new ErreurValidation("Code invalide ou expiré.");
    }

    const empreinteCode = hacherJeton(code);
    const motDePasseHash = await hacherMotDePasse(nouveauMotDePasse);
    const reussi = await this.depot.avecTransaction(async (client) => {
      const codeValide = await this.depot.trouverCodeReinitialisationValide(
        client,
        compte.compteId,
        empreinteCode
      );
      if (!codeValide) {
        return false;
      }
      const marque = await this.depot.marquerCodeUtilise(client, codeValide.id);
      if (!marque) {
        return false;
      }
      await this.depot.mettreAJourMotDePasse(client, compte.compteId, motDePasseHash);
      await this.depot.revoquerToutesSessions(client, compte.compteId);
      return true;
    });

    if (!reussi) {
      this.limiteurReinitialisation.enregistrerEchec(cle, maintenant);
      throw new ErreurValidation("Code invalide ou expiré.");
    }
    this.limiteurReinitialisation.reinitialiser(cle);
  }

  async changerMotDePasse(
    compteId: string,
    empreinteActuelle: string,
    motDePasseActuel: string,
    nouveauMotDePasse: string
  ): Promise<void> {
    const compte = await this.exigerCompte(compteId);
    if (!(await verifierMotDePasse(compte.motDePasseHash, motDePasseActuel))) {
      throw new ErreurAuthentification(
        "MOT_DE_PASSE_INCORRECT",
        "Le mot de passe actuel est incorrect."
      );
    }

    const motDePasseHash = await hacherMotDePasse(nouveauMotDePasse);
    await this.depot.avecTransaction(async (client) => {
      await this.depot.mettreAJourMotDePasse(client, compteId, motDePasseHash);
      await this.depot.revoquerToutesSessions(client, compteId, empreinteActuelle);
    });
  }

  async changerEmail(
    compteId: string,
    email: string,
    motDePasse: string
  ): Promise<ProfilUtilisateur> {
    const compte = await this.exigerCompte(compteId);
    if (!(await verifierMotDePasse(compte.motDePasseHash, motDePasse))) {
      throw new ErreurAuthentification(
        "MOT_DE_PASSE_INCORRECT",
        "Le mot de passe actuel est incorrect."
      );
    }
    return this.depot.avecTransaction((client) =>
      this.depot.mettreAJourEmail(client, compteId, email)
    );
  }

  async mettreAJourProfil(
    compteId: string,
    champs: ChampsProfilModifiables
  ): Promise<ProfilUtilisateur> {
    return this.depot.avecTransaction((client) =>
      this.depot.mettreAJourProfil(client, compteId, champs)
    );
  }

  private async exigerCompte(compteId: string): Promise<CompteAvecSecret> {
    const compte = await this.depot.avecTransaction((client) =>
      this.depot.trouverCompteParId(client, compteId)
    );
    if (!compte) {
      throw new ErreurNonTrouve("Compte introuvable.");
    }
    return compte;
  }

  async demanderSuppression(
    compteId: string,
    motDePasse: string,
    motif: string | null
  ): Promise<{ statut: "en_attente" }> {
    const compte = await this.exigerCompte(compteId);
    if (!(await verifierMotDePasse(compte.motDePasseHash, motDePasse))) {
      throw new ErreurAuthentification(
        "MOT_DE_PASSE_INCORRECT",
        "Le mot de passe actuel est incorrect."
      );
    }
    await this.depot.avecTransaction((client) =>
      this.depot.creerDemandeSuppression(client, compteId, motif)
    );
    return { statut: "en_attente" };
  }

  private async creerSession(compte: CompteAvecSecret): Promise<SessionCreee> {
    const jeton = genererJetonSession();
    const empreinteJeton = hacherJeton(jeton);
    const expireLe = dateDansMinutes(this.dureeSessionMinutes, this.maintenant());
    await this.depot.avecTransaction((client) =>
      this.depot.creerSession(client, compte.compteId, empreinteJeton, expireLe)
    );
    return { jeton, expireLe: expireLe.toISOString() };
  }

  private profilDepuisCompte(compte: CompteAvecSecret): ProfilUtilisateur {
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
}
