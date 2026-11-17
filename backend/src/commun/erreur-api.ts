// Format d'erreur commun aux API { erreur: { code, message } }.
import type { Response } from "express";

export class ErreurApi extends Error {
  constructor(readonly statut: number, readonly code: string, message: string) {
    super(message);
    this.name = "ErreurApi";
  }
}

export function envoyerErreur(res: Response, statut: number, code: string, message: string): void {
  res.status(statut).json({ erreur: { code, message } });
}

// Transforme une erreur quelconque en réponse HTTP sûre
export function repondreErreur(res: Response, erreur: unknown): void {
  if (erreur instanceof ErreurApi) {
    envoyerErreur(res, erreur.statut, erreur.code, erreur.message);
    return;
  }
  console.error(`[API] Erreur interne (${(erreur as Error)?.name ?? "inconnue"})`);
  envoyerErreur(res, 500, "ERREUR_INTERNE", "Une erreur interne est survenue.");
}
