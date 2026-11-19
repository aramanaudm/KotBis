import {
  SessionPartagePosition,
  StockageSessionPartage,
} from "./partage-position.types";

// Stockage temporaire pour l'intégration et les tests
export class StockagePartageMemoire implements StockageSessionPartage {
  private readonly sessions = new Map<string, SessionPartagePosition>();

  async creer(session: SessionPartagePosition): Promise<void> {
    if (this.sessions.has(session.id)) {
      throw new Error("Cette session existe déjà.");
    }

    this.sessions.set(session.id, { ...session });
  }

  async trouverParId(id: string): Promise<SessionPartagePosition | null> {
    const session = this.sessions.get(id);
    return session ? { ...session } : null;
  }

  async modifier(session: SessionPartagePosition): Promise<void> {
    const existante = this.sessions.get(session.id);

    if (!existante) {
      throw new Error("Session de partage introuvable.");
    }

    if (existante.compteId !== session.compteId) {
      throw new Error("Accès non autorisé à cette session.");
    }

    if (existante.statut !== "active") {
      throw new Error("Cette session n'est plus active.");
    }

    this.sessions.set(session.id, { ...session });
  }
}
