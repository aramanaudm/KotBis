// Routes des favoris, à monter sur /api/favoris (après KBE-23).
import { Router, type RequestHandler } from "express";
import type { FavorisControleur } from "./favoris.controleur";

export function creerRoutesFavoris(authentifier: RequestHandler, controleur: FavorisControleur): Router {
  const router = Router();

  // EF-AUTH-017 : toutes les routes exigent un utilisateur connecté
  router.use(authentifier);

  router.get("/", controleur.lister); // API-FAV-001
  router.post("/", controleur.ajouter); // API-FAV-002
  router.delete("/:id", controleur.supprimer); // API-FAV-003

  return router;
}
