// Dépôt des comptes en mémoire, réservé aux tests (aucun PostgreSQL).
// Les transactions sont sérialisées (comme le verrou de gouvernance) et annulées en cas d'erreur.
import type {
  DepotComptes,
  EntreeAudit,
  FiltresComptes,
  PageComptes,
  TransactionComptes
} from "../../src/utilisateurs/comptes.depot";
import type { CompteAuthentifie, CompteGere, EtatCompte, RolePersonnel } from "../../src/utilisateurs/comptes.types";

export class DepotComptesMemoire implements DepotComptes {
  comptes = new Map<number, CompteGere>();
  audits: EntreeAudit[] = [];
  sessionsRevoquees: number[] = [];
  // Permet de simuler un état de la base pour tester la règle du dernier administrateur
  nombreAdministrateursForce?: number;
  // Simule une panne de l'écriture d'audit
  echecAudit = false;

  private file: Promise<unknown> = Promise.resolve();

  constructor(comptes: Array<Omit<CompteGere, "version" | "nom"> & Partial<CompteGere>> = []) {
    for (const c of comptes) this.comptes.set(c.id, { nom: null, version: 1, ...c });
  }

  async trouverCompteAuthentifie(id: number): Promise<CompteAuthentifie | null> {
    const c = this.comptes.get(id);
    return c ? { id: c.id, role: c.role, etat: c.etat } : null;
  }

  async lister(f: FiltresComptes): Promise<PageComptes> {
    const tous = [...this.comptes.values()]
      .filter((c) => (!f.role || c.role === f.role) && (!f.etat || c.etat === f.etat))
      .filter((c) => !f.personnelSeulement || c.role !== "voyageur")
      .sort((a, b) => a.id - b.id);
    const debut = (f.page - 1) * f.limite;
    return { elements: tous.slice(debut, debut + f.limite).map((c) => ({ ...c })), total: tous.length };
  }

  enTransaction<T>(travail: (tx: TransactionComptes) => Promise<T>): Promise<T> {
    const execution = this.file.then(async () => {
      const sauvegarde = {
        comptes: new Map([...this.comptes].map(([id, c]) => [id, { ...c }])),
        audits: [...this.audits],
        sessions: [...this.sessionsRevoquees]
      };
      try {
        return await travail(this.creerTransaction());
      } catch (erreur) {
        this.comptes = sauvegarde.comptes;
        this.audits = sauvegarde.audits;
        this.sessionsRevoquees = sauvegarde.sessions;
        throw erreur;
      }
    });
    this.file = execution.catch(() => undefined);
    return execution;
  }

  private creerTransaction(): TransactionComptes {
    const modifier = (id: number, versionAttendue: number, changement: Partial<CompteGere>) => {
      const c = this.comptes.get(id);
      if (!c || c.version !== versionAttendue) return null;
      const modifie = { ...c, ...changement, version: c.version + 1 };
      this.comptes.set(id, modifie);
      return { ...modifie };
    };

    return {
      verrouillerGouvernance: async () => undefined,
      trouverPourMiseAJour: async (id) => {
        const c = this.comptes.get(id);
        return c ? { ...c } : null;
      },
      compterAdministrateursActifs: async () =>
        this.nombreAdministrateursForce ??
        [...this.comptes.values()].filter((c) => c.role === "administrateur" && c.etat === "actif").length,
      modifierEtat: async (id, etat: EtatCompte, v) => modifier(id, v, { etat }),
      modifierRole: async (id, role: RolePersonnel, v) => modifier(id, v, { role }),
      revoquerSessions: async (id) => {
        this.sessionsRevoquees.push(id);
      },
      ecrireAudit: async (entree) => {
        if (this.echecAudit) throw new Error("Échec simulé de l'audit");
        this.audits.push(entree);
      }
    };
  }
}
