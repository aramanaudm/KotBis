// KBE-45 : stockage du quota visiteur en mémoire, réservé aux tests.
// Reproduit le comportement attendu de la table `quotas_visiteurs`.
import { randomUUID } from "node:crypto";
import { ErreurBaseDeDonnees } from "../../src/configuration/baseDeDonnees";
import type { DepotQuotaVisiteurs } from "../../src/trajets/quota-visiteur.types";

interface LigneQuota {
  id: string;
  nombreRecherches: number;
  empreinteIp: string | null;
  creeLe: Date;
  derniereRechercheLe: Date | null;
}

export class DepotQuotaMemoire implements DepotQuotaVisiteurs {
  readonly lignes = new Map<string, LigneQuota>();
  // Simule une panne de PostgreSQL : chaque appel échoue.
  enPanne = false;

  async creerJeton(empreinteIp: string, maintenant: Date): Promise<string> {
    this.verifierDisponible();
    const id = randomUUID();
    this.lignes.set(id, {
      id,
      nombreRecherches: 0,
      empreinteIp,
      creeLe: maintenant,
      derniereRechercheLe: null
    });
    return id;
  }

  async compterJetonsDepuis(empreinteIp: string, depuis: Date): Promise<number> {
    this.verifierDisponible();
    return [...this.lignes.values()].filter(
      (ligne) => ligne.empreinteIp === empreinteIp && ligne.creeLe > depuis
    ).length;
  }

  async existe(jeton: string): Promise<boolean> {
    this.verifierDisponible();
    return this.lignes.has(jeton);
  }

  async reserver(jeton: string, maximum: number, maintenant: Date): Promise<number | null> {
    this.verifierDisponible();
    const ligne = this.lignes.get(jeton);
    if (!ligne || ligne.nombreRecherches >= maximum) {
      return null;
    }
    ligne.nombreRecherches += 1;
    ligne.derniereRechercheLe = maintenant;
    return ligne.nombreRecherches;
  }

  async rendre(jeton: string): Promise<void> {
    this.verifierDisponible();
    const ligne = this.lignes.get(jeton);
    if (ligne && ligne.nombreRecherches > 0) {
      ligne.nombreRecherches -= 1;
    }
  }

  async effacerEmpreintesAvant(date: Date): Promise<void> {
    this.verifierDisponible();
    for (const ligne of this.lignes.values()) {
      if (ligne.empreinteIp !== null && ligne.creeLe <= date) {
        ligne.empreinteIp = null;
      }
    }
  }

  compteur(jeton: string): number | undefined {
    return this.lignes.get(jeton)?.nombreRecherches;
  }

  private verifierDisponible(): void {
    if (this.enPanne) {
      throw new ErreurBaseDeDonnees("ECONNREFUSED");
    }
  }
}
