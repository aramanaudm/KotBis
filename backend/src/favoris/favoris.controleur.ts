// Contrôleur HTTP des favoris : valide les entrées puis appelle le service.
import type { Request, Response } from "express";
import { ErreurApi, repondreErreur } from "../commun/erreur-api";
import type { FavorisService } from "./favoris.service";
import { LONGUEUR_MAX_LIBELLE, TYPES_FAVORI, type NouveauFavori, type TypeFavori } from "./favoris.types";

function invalide(message: string): ErreurApi {
  return new ErreurApi(422, "VALIDATION_INCORRECTE", message);
}

function idArret(valeur: unknown): number | undefined {
  return typeof valeur === "number" && Number.isSafeInteger(valeur) && valeur > 0 ? valeur : undefined;
}

// Corps attendu : { type, arretDepartId?, arretArriveeId, libelle? }
function lireNouveauFavori(corps: unknown): NouveauFavori {
  const c = (corps ?? {}) as Record<string, unknown>;

  if (!TYPES_FAVORI.includes(c.type as TypeFavori)) {
    throw invalide("Le type doit être « destination » ou « trajet ».");
  }
  const type = c.type as TypeFavori;

  const arretArriveeId = idArret(c.arretArriveeId);
  if (!arretArriveeId) throw invalide("arretArriveeId doit être un entier positif.");

  let arretDepartId: number | null = null;
  if (type === "trajet") {
    arretDepartId = idArret(c.arretDepartId) ?? null;
    if (!arretDepartId) throw invalide("Un favori de type trajet exige arretDepartId (entier positif).");
    if (arretDepartId === arretArriveeId) throw invalide("Le départ et l'arrivée doivent être différents.");
  } else if (c.arretDepartId !== undefined && c.arretDepartId !== null) {
    throw invalide("Un favori de type destination n'a pas d'arrêt de départ.");
  }

  let libelle: string | null = null;
  if (c.libelle !== undefined && c.libelle !== null) {
    if (typeof c.libelle !== "string" || c.libelle.trim().length > LONGUEUR_MAX_LIBELLE) {
      throw invalide(`Le libellé doit contenir au plus ${LONGUEUR_MAX_LIBELLE} caractères.`);
    }
    libelle = c.libelle.trim() || null;
  }

  return { type, arretDepartId, arretArriveeId, libelle };
}

export class FavorisControleur {
  constructor(private readonly service: FavorisService) {}

  // API-FAV-001 : GET /api/favoris
  lister = async (req: Request, res: Response): Promise<void> => {
    try {
      const elements = await this.service.lister(req.compte!);
      res.status(200).json({ elements });
    } catch (erreur) {
      repondreErreur(res, erreur);
    }
  };

  // API-FAV-002 : POST /api/favoris
  ajouter = async (req: Request, res: Response): Promise<void> => {
    try {
      const favori = await this.service.ajouter(req.compte!, lireNouveauFavori(req.body));
      res.status(201).json(favori);
    } catch (erreur) {
      repondreErreur(res, erreur);
    }
  };

  // API-FAV-003 : DELETE /api/favoris/:id
  supprimer = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      if (!/^\d+$/.test(String(req.params.id)) || !Number.isSafeInteger(id) || id <= 0) {
        throw new ErreurApi(400, "IDENTIFIANT_INVALIDE", "Identifiant de favori invalide.");
      }
      await this.service.supprimer(req.compte!, id);
      res.status(204).end();
    } catch (erreur) {
      repondreErreur(res, erreur);
    }
  };
}
