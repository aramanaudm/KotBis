// Routes d'administration des comptes, à monter sur /api/administration (après KBE-23).
import { Router, type RequestHandler } from "express";
import { exigerPermission } from "../middlewares/autorisation.middleware";
import type { GestionComptesControleur } from "./gestion-comptes.controleur";

export function creerRoutesAdministrationComptes(
  authentifier: RequestHandler,
  controleur: GestionComptesControleur
): Router {
  const router = Router();

// EF-ADM-001 / CA-011 : toute route de ce routeur exige un compte du personnel actif
  router.use(authentifier, exigerPermission("administration.acceder"));

  router.get("/utilisateurs", exigerPermission("comptes.consulter"), controleur.lister); // API-ADM-012
  router.patch("/utilisateurs/:id/statut", exigerPermission("comptes.suspendre"), controleur.changerStatut); // API-ADM-013
  router.patch("/utilisateurs/:id/role", exigerPermission("roles.modifier"), controleur.changerRole); // API-ADM-014
  router.get("/personnel", exigerPermission("personnel.gerer"), controleur.listerPersonnel); // API-ADM-015

  return router;
}
