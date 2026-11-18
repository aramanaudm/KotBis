// Routes des favoris, montées sur /api/favoris (index.ts).
import { Router, type RequestHandler } from "express";
import type { FavorisControleur } from "./favoris.controleur";

export function creerRoutesFavoris(authentifier: RequestHandler, controleur: FavorisControleur): Router {
  const router = Router();

  // EF-AUTH-017 : toutes les routes exigent un utilisateur connecté
  router.use(authentifier);

  router.get("/", controleur.lister); // API-FAV-001
  router.get("/trajets", controleur.listerTrajets); // trajets proposés à l'ajout
  router.post("/", controleur.ajouter); // API-FAV-002
  router.delete("/:id", controleur.supprimer); // API-FAV-003

  return router;
}
