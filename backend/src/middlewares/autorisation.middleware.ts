// Middleware d'autorisation : refuse la requête si le rôle du compte n'a pas la permission demandée.
import type { RequestHandler } from "express";
import { envoyerErreur } from "../commun/erreur-api";
import { possedePermission, type Permission } from "../administration/permissions";

export function exigerPermission(permission: Permission): RequestHandler {
  return (req, res, next) => {
    if (!req.compte) {
      envoyerErreur(res, 401, "AUTHENTIFICATION_REQUISE", "Authentification requise.");
      return;
    }
    if (!possedePermission(req.compte.role, permission)) {
      envoyerErreur(res, 403, "ACCES_INTERDIT", "Vous n'avez pas les droits nécessaires.");
      return;
    }
    next();
  };
}
