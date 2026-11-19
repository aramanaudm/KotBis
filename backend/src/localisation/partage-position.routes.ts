// Ce fichier définit les routes HTTP du partage de position GPS.
// Il relie les URL de l'API aux méthodes du contrôleur.
// L'authentification sera intégrée avec le ticket KBE-23.

// Importe le routeur Express et le type Middleware.
import { Router, RequestHandler } from "express";

// Importe le contrôleur du partage GPS.
import { PartagePositionController } from "./partage-position.controller";

// Crée un routeur en recevant le contrôleur et le middleware d'authentification.
// Cette approche permet d'ajouter KBE-23 sans modifier les règles métier.
export function creerRoutesPartagePosition(
    controller: PartagePositionController,
    authentifier: RequestHandler
): Router {

    // Crée un routeur Express indépendant du serveur principal.
    const router = Router();

    // Démarre une session après vérification de l'authentification.
    // Le contrôleur vérifie ensuite le consentement du voyageur.
    router.post(
        "/demarrer",
        authentifier,
        controller.demarrerPartage
    );

    // Arrête une session après vérification de l'authentification.
    // Le service vérifie que la session appartient au voyageur.
    router.post(
        "/arreter",
        authentifier,
        controller.arreterPartage
    );

    // Retourne le routeur pour son intégration future dans index.ts.
    return router;
}