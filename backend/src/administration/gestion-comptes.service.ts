// Règles métier de gestion des comptes : suspension / réactivation
import { ErreurApi } from "../commun/erreur-api";
import type { DepotComptes, FiltresComptes, PageComptes, TransactionComptes } from "../utilisateurs/comptes.depot";
import type { CompteAuthentifie, CompteGere, RolePersonnel } from "../utilisateurs/comptes.types";
import { possedePermission, type Permission } from "./permissions";

export interface DemandeEtat {
  etat: "actif" | "inactif";
  motif?: string;
  version?: number;
}

export interface DemandeRole {
  role: RolePersonnel;
  version?: number;
}

export class GestionComptesService {
  constructor(private readonly depot: DepotComptes) {}

  lister(filtres: FiltresComptes): Promise<PageComptes> {
    return this.depot.lister(filtres);
  }

  async changerEtat(
    acteur: CompteAuthentifie,
    cibleId: number,
    demande: DemandeEtat,
    requeteId: string
  ): Promise<CompteGere> {
    if (cibleId === acteur.id) {
      throw new ErreurApi(403, "AUTO_MODIFICATION_INTERDITE", "Vous ne pouvez pas modifier l'état de votre propre compte.");
    }

    return this.depot.enTransaction(async (tx) => {
      await tx.verrouillerGouvernance();
      await this.reverifierActeur(tx, acteur, "comptes.suspendre");
      const cible = await this.chargerCible(tx, cibleId, demande.version);

      if (cible.etat === demande.etat) return cible;
      if (cible.etat === "invite") {
        throw new ErreurApi(409, "COMPTE_NON_ACTIVE", "Une invitation non acceptée ne peut pas être suspendue ou réactivée.");
      }
      if (demande.etat === "inactif" && cible.role === "administrateur") {
        await this.protegerDernierAdministrateur(tx);
      }

      const modifie = await tx.modifierEtat(cible.id, demande.etat, cible.version);
      if (!modifie) throw this.conflitVersion();

      if (demande.etat === "inactif") await tx.revoquerSessions(cible.id);

      await tx.ecrireAudit({
        acteurId: acteur.id,
        action: demande.etat === "inactif" ? "COMPTE_SUSPENDU" : "COMPTE_REACTIVE",
        tableCible: "comptes",
        cleCible: String(cible.id),
        avant: { etat: cible.etat },
        apres: { etat: modifie.etat, motif: demande.motif ?? null },
        requeteId
      });
      return modifie;
    });
  }

  async changerRole(
    acteur: CompteAuthentifie,
    cibleId: number,
    demande: DemandeRole,
    requeteId: string
  ): Promise<CompteGere> {
    // Personne ne modifie son propre rôle
    if (cibleId === acteur.id) {
      throw new ErreurApi(403, "AUTO_PROMOTION_INTERDITE", "Vous ne pouvez pas modifier votre propre rôle.");
    }

    return this.depot.enTransaction(async (tx) => {
      await tx.verrouillerGouvernance();
      await this.reverifierActeur(tx, acteur, "roles.modifier");
      const cible = await this.chargerCible(tx, cibleId, demande.version);

      if (cible.role === "voyageur") {
        throw new ErreurApi(
          422,
          "CHANGEMENT_FAMILLE_NON_SUPPORTE",
          "Un compte voyageur ne peut pas recevoir un rôle du personnel par cette opération."
        );
      }
      if (cible.role === demande.role) return cible;
      if (cible.role === "administrateur" && cible.etat === "actif") {
        await this.protegerDernierAdministrateur(tx);
      }

      const modifie = await tx.modifierRole(cible.id, demande.role, cible.version);
      if (!modifie) throw this.conflitVersion();

      await tx.ecrireAudit({
        acteurId: acteur.id,
        action: "ROLE_MODIFIE",
        tableCible: "comptes",
        cleCible: String(cible.id),
        avant: { role: cible.role },
        apres: { role: modifie.role },
        requeteId
      });
      return modifie;
    });
  }

  // L'acteur a pu être suspendu ou rétrogradé entre le middleware et le verrou 
  private async reverifierActeur(tx: TransactionComptes, acteur: CompteAuthentifie, permission: Permission): Promise<void> {
    const actuel = await tx.trouverPourMiseAJour(acteur.id);
    if (!actuel || actuel.etat !== "actif" || !possedePermission(actuel.role, permission)) {
      throw new ErreurApi(403, "ACCES_INTERDIT", "Vous n'avez pas les droits nécessaires.");
    }
  }

  private async chargerCible(tx: TransactionComptes, id: number, versionAttendue?: number): Promise<CompteGere> {
    const cible = await tx.trouverPourMiseAJour(id);
    if (!cible) throw new ErreurApi(404, "COMPTE_INTROUVABLE", "Compte introuvable.");
    if (versionAttendue !== undefined && versionAttendue !== cible.version) throw this.conflitVersion();
    return cible;
  }

  // EF-AUTH-014 / RG03 : exécuté sous le verrou de gouvernance, donc sérialisé
  private async protegerDernierAdministrateur(tx: TransactionComptes): Promise<void> {
    if ((await tx.compterAdministrateursActifs()) <= 1) {
      throw new ErreurApi(
        409,
        "DERNIER_ADMINISTRATEUR",
        "Le dernier administrateur actif ne peut pas être désactivé ni rétrogradé."
      );
    }
  }

  private conflitVersion(): ErreurApi {
    return new ErreurApi(409, "CONFLIT_VERSION", "Le compte a été modifié entre-temps. Rechargez puis réessayez.");
  }
}
