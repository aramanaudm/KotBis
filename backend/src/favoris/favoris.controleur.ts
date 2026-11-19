// Contrôleur HTTP des favoris : valide les entrées puis appelle le service.
import type { NextFunction, Request, Response } from "express";
import { ErreurApi } from "../commun/erreurs";
import { obtenirUtilisateurCourant } from "../middlewares/authentification";
import type { FavorisService } from "./favoris.service";
import {
  LIMITE_TRAJETS_PROPOSES,
  LONGUEUR_MAX_LIBELLE,
  LONGUEUR_MAX_RECHERCHE,
  TYPES_FAVORI,
  type NouveauFavori,
  type TypeFavori
} from "./favoris.types";

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

// Requête attendue : ?recherche=texte (facultatif) & limite=1..LIMITE_TRAJETS_PROPOSES
function lireRechercheTrajets(requete: Request["query"]): { recherche: string | null; limite: number } {
  const brut = requete.recherche;
  if (brut !== undefined && typeof brut !== "string") throw invalide("recherche doit être un texte.");
  const recherche = brut?.trim() || null;
  if (recherche && recherche.length > LONGUEUR_MAX_RECHERCHE) {
    throw invalide(`La recherche doit contenir au plus ${LONGUEUR_MAX_RECHERCHE} caractères.`);
  }

  let limite = LIMITE_TRAJETS_PROPOSES;
  if (requete.limite !== undefined) {
    limite = Number(requete.limite);
    if (!Number.isInteger(limite) || limite < 1 || limite > LIMITE_TRAJETS_PROPOSES) {
      throw invalide(`limite doit être un entier entre 1 et ${LIMITE_TRAJETS_PROPOSES}.`);
    }
  }
  return { recherche, limite };
}

export class FavorisControleur {
  constructor(private readonly service: FavorisService) {}

  // API-FAV-001 : GET /api/favoris
  lister = async (req: Request, res: Response, suivant: NextFunction): Promise<void> => {
    try {
      const elements = await this.service.lister(obtenirUtilisateurCourant(req));
      res.status(200).json({ elements });
    } catch (erreur) {
      suivant(erreur);
    }
  };

  // GET /api/favoris/trajets : trajets du réseau proposés à l'ajout
  listerTrajets = async (req: Request, res: Response, suivant: NextFunction): Promise<void> => {
    try {
      const { recherche, limite } = lireRechercheTrajets(req.query);
      const elements = await this.service.listerTrajets(obtenirUtilisateurCourant(req), recherche, limite);
      res.status(200).json({ elements });
    } catch (erreur) {
      suivant(erreur);
    }
  };

  // API-FAV-002 : POST /api/favoris
  ajouter = async (req: Request, res: Response, suivant: NextFunction): Promise<void> => {
    try {
      const favori = await this.service.ajouter(obtenirUtilisateurCourant(req), lireNouveauFavori(req.body));
      res.status(201).json(favori);
    } catch (erreur) {
      suivant(erreur);
    }
  };

  // API-FAV-003 : DELETE /api/favoris/:id
  supprimer = async (req: Request, res: Response, suivant: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      if (!/^\d+$/.test(String(req.params.id)) || !Number.isSafeInteger(id) || id <= 0) {
        throw new ErreurApi(400, "IDENTIFIANT_INVALIDE", "Identifiant de favori invalide.");
      }
      await this.service.supprimer(obtenirUtilisateurCourant(req), id);
      res.status(204).end();
    } catch (erreur) {
      suivant(erreur);
    }
  };
}
