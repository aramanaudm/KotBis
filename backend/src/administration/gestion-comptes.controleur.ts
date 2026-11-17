// Contrôleur HTTP de la gestion des comptes : valide les entrées puis appelle le service.

import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { ErreurApi, repondreErreur } from "../commun/erreur-api";
import {
  CODES_ROLES,
  ETATS_COMPTE,
  ROLES_PERSONNEL,
  type CodeRole,
  type EtatCompte,
  type RolePersonnel
} from "../utilisateurs/comptes.types";
import type { GestionComptesService } from "./gestion-comptes.service";

const LIMITE_PAR_DEFAUT = 20;
const LIMITE_MAXIMALE = 100;
const LONGUEUR_MAX_MOTIF = 500;

function invalide(message: string): ErreurApi {
  return new ErreurApi(422, "VALIDATION_INCORRECTE", message);
}

function entierPositif(valeur: unknown): number | undefined {
  if (typeof valeur !== "string" && typeof valeur !== "number") return undefined;
  const nombre = Number(valeur);
  return Number.isSafeInteger(nombre) && nombre > 0 ? nombre : undefined;
}

function lireIdCompte(valeur: unknown): number {
  const id = entierPositif(valeur);
  if (!id) throw new ErreurApi(400, "IDENTIFIANT_INVALIDE", "Identifiant de compte invalide.");
  return id;
}

function lireVersion(valeur: unknown): number | undefined {
  if (valeur === undefined) return undefined;
  const version = typeof valeur === "number" ? entierPositif(valeur) : undefined;
  if (!version) throw invalide("La version doit être un entier positif.");
  return version;
}

export class GestionComptesControleur {
  constructor(private readonly service: GestionComptesService) {}

  // EF-ADM-009 : GET /api/administration/utilisateurs
  lister = (req: Request, res: Response): Promise<void> => this.listerAvec(req, res, false);

  // EF-ADM-010 : GET /api/administration/personnel
  listerPersonnel = (req: Request, res: Response): Promise<void> => this.listerAvec(req, res, true);

  // EF-AUTH-012 : PATCH /api/administration/utilisateurs/:id/statut
  changerStatut = async (req: Request, res: Response): Promise<void> => {
    try {
      const cibleId = lireIdCompte(req.params.id);
      const { etat, motif } = req.body ?? {};
      if (etat !== "actif" && etat !== "inactif") {
        throw invalide("L'état doit être « actif » ou « inactif ».");
      }
      if (motif !== undefined && (typeof motif !== "string" || !motif.trim() || motif.length > LONGUEUR_MAX_MOTIF)) {
        throw invalide(`Le motif doit contenir entre 1 et ${LONGUEUR_MAX_MOTIF} caractères.`);
      }
      const compte = await this.service.changerEtat(
        req.compte!,
        cibleId,
        { etat, motif: motif?.trim(), version: lireVersion(req.body?.version) },
        randomUUID()
      );
      res.status(200).json(compte);
    } catch (erreur) {
      repondreErreur(res, erreur);
    }
  };

  // EF-AUTH-013 : PATCH /api/administration/utilisateurs/:id/role
  changerRole = async (req: Request, res: Response): Promise<void> => {
    try {
      const cibleId = lireIdCompte(req.params.id);
      const role = req.body?.role;
      if (!ROLES_PERSONNEL.includes(role)) {
        throw invalide("Le rôle doit être operateur, moderateur ou administrateur.");
      }
      const compte = await this.service.changerRole(
        req.compte!,
        cibleId,
        { role: role as RolePersonnel, version: lireVersion(req.body?.version) },
        randomUUID()
      );
      res.status(200).json(compte);
    } catch (erreur) {
      repondreErreur(res, erreur);
    }
  };

  private async listerAvec(req: Request, res: Response, personnelSeulement: boolean): Promise<void> {
    try {
      const role = req.query.role;
      const etat = req.query.etat;
      if (role !== undefined && !CODES_ROLES.includes(role as CodeRole)) throw invalide("Rôle inconnu.");
      if (etat !== undefined && !ETATS_COMPTE.includes(etat as EtatCompte)) throw invalide("État inconnu.");

      const page = entierPositif(req.query.page) ?? 1;
      const limite = Math.min(entierPositif(req.query.limite) ?? LIMITE_PAR_DEFAUT, LIMITE_MAXIMALE);
      const { elements, total } = await this.service.lister({
        page,
        limite,
        role: role as CodeRole | undefined,
        etat: etat as EtatCompte | undefined,
        personnelSeulement
      });
      res.status(200).json({ elements, pagination: { page, limite, total } });
    } catch (erreur) {
      repondreErreur(res, erreur);
    }
  }
}
