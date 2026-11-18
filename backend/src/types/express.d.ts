import type { ProfilUtilisateur, SessionAuthentification } from "../authentification/types";

declare global {
  namespace Express {
    interface Request {
      utilisateur?: ProfilUtilisateur;
      sessionAuthentification?: SessionAuthentification;
    }
  }
}

export {};
