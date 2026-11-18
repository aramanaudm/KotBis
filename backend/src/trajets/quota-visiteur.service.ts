// KBE-45 : règles du quota de recherches des visiteurs.
import { createHmac } from "node:crypto";
import { lireEntierPositif } from "../authentification/jetons";
import { ErreurApi } from "../commun/erreurs";
import type { DepotQuotaVisiteurs, OptionsQuotaVisiteur, ReservationQuota } from "./quota-visiteur.types";

export const QUOTA_VISITEUR_MAX_DEFAUT = 10;
export const PLAFOND_JETONS_PAR_IP_DEFAUT = 20;
const FENETRE_JETONS_MS = 24 * 60 * 60 * 1000;
const FORMAT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// EF-VIS-006 : dépassement signalé par un code dédié, distinct de TROP_DE_TENTATIVES.
export function erreurQuotaAtteint(quotaMax: number): ErreurApi {
  return new ErreurApi(
    429,
    "QUOTA_VISITEUR_ATTEINT",
    `Vous avez utilisé vos ${quotaMax} recherches gratuites. Connectez-vous pour continuer à rechercher.`
  );
}

export function erreurTropDeJetons(): ErreurApi {
  return new ErreurApi(
    429,
    "TROP_DE_JETONS_VISITEUR",
    "Trop de nouvelles sessions visiteur depuis ce réseau. Connectez-vous ou réessayez plus tard."
  );
}

// Lit la configuration depuis l'environnement (variables documentées dans la PR).
export function lireOptionsQuotaVisiteur(env: NodeJS.ProcessEnv = process.env): OptionsQuotaVisiteur {
  return {
    quotaMax: lireEntierPositif(env.QUOTA_VISITEUR_MAX, QUOTA_VISITEUR_MAX_DEFAUT),
    plafondJetonsParIp: lireEntierPositif(env.PLAFOND_JETONS_PAR_IP, PLAFOND_JETONS_PAR_IP_DEFAUT),
    secretEmpreinteIp: env.SECRET_EMPREINTE_IP ?? ""
  };
}

export class ServiceQuotaVisiteur {
  readonly quotaMax: number;
  private readonly plafondJetonsParIp: number;
  private readonly secretEmpreinteIp: string;
  private readonly maintenant: () => Date;

  constructor(
    private readonly depot: DepotQuotaVisiteurs,
    options: OptionsQuotaVisiteur
  ) {
    if (!options.secretEmpreinteIp) {
      // Sans secret, l'empreinte d'une IPv4 serait réversible par force brute.
      throw new Error("Configuration du quota visiteur incomplète : SECRET_EMPREINTE_IP");
    }
    this.quotaMax = options.quotaMax ?? QUOTA_VISITEUR_MAX_DEFAUT;
    this.plafondJetonsParIp = options.plafondJetonsParIp ?? PLAFOND_JETONS_PAR_IP_DEFAUT;
    this.secretEmpreinteIp = options.secretEmpreinteIp;
    this.maintenant = options.maintenant ?? (() => new Date());
  }

  // Empreinte HMAC-SHA256 de l'adresse IP : l'IP n'est jamais stockée en clair.
  empreinteIp(adresseIp: string): string {
    return createHmac("sha256", this.secretEmpreinteIp).update(adresseIp).digest("hex");
  }

  // Réserve une recherche pour le visiteur. Un jeton absent, mal formé ou inconnu
  // conduit à l'émission d'un nouveau jeton, dans la limite du plafond par IP.
  async reserver(jeton: string | undefined, adresseIp: string): Promise<ReservationQuota> {
    const maintenant = this.maintenant();

    if (jeton && FORMAT_UUID.test(jeton)) {
      const compteur = await this.depot.reserver(jeton, this.quotaMax, maintenant);
      if (compteur !== null) {
        return { jeton, nouveauJeton: false, restant: this.quotaMax - compteur };
      }
      // Jeton connu mais limite atteinte : pas de nouveau jeton (EF-VIS-002).
      if (await this.depot.existe(jeton)) {
        throw erreurQuotaAtteint(this.quotaMax);
      }
    }

    return this.emettreEtReserver(adresseIp, maintenant);
  }

  // EF-VIS-004 / EF-VIS-005 : une recherche invalide ou en échec ne consomme pas le quota.
  async rendre(jeton: string): Promise<void> {
    await this.depot.rendre(jeton);
  }

  private async emettreEtReserver(adresseIp: string, maintenant: Date): Promise<ReservationQuota> {
    const empreinte = this.empreinteIp(adresseIp);
    const debutFenetre = new Date(maintenant.getTime() - FENETRE_JETONS_MS);

    // Les empreintes de plus de 24 h ne servent plus : elles sont effacées.
    await this.depot.effacerEmpreintesAvant(debutFenetre);

    const jetonsRecents = await this.depot.compterJetonsDepuis(empreinte, debutFenetre);
    if (jetonsRecents >= this.plafondJetonsParIp) {
      throw erreurTropDeJetons();
    }

    const jeton = await this.depot.creerJeton(empreinte, maintenant);
    const compteur = await this.depot.reserver(jeton, this.quotaMax, maintenant);
    if (compteur === null) {
      throw erreurQuotaAtteint(this.quotaMax);
    }
    return { jeton, nouveauJeton: true, restant: this.quotaMax - compteur };
  }
}
