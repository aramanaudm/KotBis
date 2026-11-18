import { randomUUID } from "node:crypto";
import { ErreurAuthentification, ErreurTropDeRequetes } from "../commun/erreurs";
import { LimiteurTentatives } from "../middlewares/limiteurTentatives";
import type { DepotAuthentification } from "./depot";
import { dateDansMinutes, genererJetonSession, hacherJeton, lireEntierPositif } from "./jetons";
import { hacherMotDePasse, verifierMotDePasse } from "./motDePasse";
import type { CompteAvecSecret, DonneesInscription, ProfilUtilisateur, SessionCreee } from "./types";

const HASH_FACTICE = "$argon2id$v=19$m=19456,t=2,p=1$Tzw5I9FgPyhm7gvVwRjTfQ$hviAw6ri6ZJcE0Rjjnq8YUKIWWkTxbELPDaaM2J7akI";

export interface OptionsServiceAuthentification {
  dureeSessionMinutes?: number;
  limiteurConnexion?: LimiteurTentatives;
  maintenant?: () => Date;
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
  private readonly limiteurConnexion: LimiteurTentatives;
  private readonly maintenant: () => Date;

  constructor(
    private readonly depot: DepotAuthentification,
    options: OptionsServiceAuthentification = {}
  ) {
    const fenetreMinutes = lireEntierPositif(process.env.FENETRE_TENTATIVES_MINUTES, 15);
    const maximumConnexion = lireEntierPositif(process.env.MAX_TENTATIVES_CONNEXION, 5);

    this.dureeSessionMinutes =
      options.dureeSessionMinutes ?? lireEntierPositif(process.env.SESSION_DUREE_MINUTES, 1440);
    this.limiteurConnexion =
      options.limiteurConnexion ?? new LimiteurTentatives(maximumConnexion, fenetreMinutes * 60_000);
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
