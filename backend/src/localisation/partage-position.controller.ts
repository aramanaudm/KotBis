// Ce fichier contient le contrôleur HTTP du partage de position GPS.
// Il reçoit les requêtes envoyées par l'application KotBis
// et transmet les opérations au service métier.

// Importe les types nécessaires pour traiter les requêtes HTTP Express.
import { Request, Response } from "express";

// Importe le service responsable de la logique métier du partage GPS.
import { PartagePositionService } from "./partage-position.service";

// Ce contrôleur fait le lien entre les routes HTTP et le service GPS.
// Il ne communique pas directement avec PostgreSQL.

// Représente une requête HTTP associée à un compte authentifié.
// Le middleware d'authentification devra renseigner cette propriété.
interface RequeteAuthentifiee extends Request {
    compteId?: number;
}

export class PartagePositionController {

    // Le service métier est fourni lors de la création du contrôleur.
    // Cela permet de réutiliser le contrôleur avec différentes
    // implémentations du stockage des sessions.
    constructor(
        private readonly service: PartagePositionService
    ) { }


    // Reçoit une demande de démarrage du partage GPS.
    // Vérifie l'authentification et le consentement avant
    // de transmettre la demande au service métier.
    demarrerPartage = async (
        req: RequeteAuthentifiee,
        res: Response
    ): Promise<void> => {

        // Récupère l'identifiant fourni par le middleware d'authentification.
        // Il ne doit jamais provenir directement du corps de la requête.
        const compteId = req.compteId;

        // Refuse la demande si aucun compte authentifié n'est disponible.
        if (!Number.isSafeInteger(compteId) || !compteId || compteId <= 0) {
            res.status(401).json({
                success: false,
                message: "Authentification requise."
            });
            return;
        }

        // Récupère le consentement explicite du voyageur.
        const { consentement } = req.body ?? {};

        // Refuse le démarrage lorsque le consentement est absent ou négatif.
        if (consentement !== true) {
            res.status(400).json({
                success: false,
                message: "Le consentement au partage GPS est obligatoire."
            });
            return;
        }

        // La durée du partage reste provisoire.
        // Elle devra être validée avec l'équipe avant la mise en production.
        const dateExpiration = new Date(Date.now() + 60 * 60 * 1000);

        try {
            // Demande au service métier de créer la session.
            const session = await this.service.demarrerPartage(
                compteId,
                consentement,
                dateExpiration
            );

            // Retourne la session créée avec le code HTTP 201.
            res.status(201).json({
                success: true,
                message: "Partage de position démarré.",
                data: session
            });

        } catch (error) {

            // Journalise l'erreur sans exposer les détails internes au client.
            console.error("Erreur lors du démarrage du partage GPS :", error);

            // Retourne une erreur serveur si la création échoue.
            res.status(500).json({
                success: false,
                message: "Impossible de démarrer le partage GPS."
            });
        }
    };


    // Reçoit une demande d'arrêt du partage GPS.
    // Vérifie l'authentification et transmet la demande au service métier.
    // Seul le propriétaire de la session peut arrêter son partage.
    arreterPartage = async (
        req: RequeteAuthentifiee,
        res: Response
    ): Promise<void> => {

        // Récupère l'identifiant du compte authentifié.
        // Cet identifiant devra être fourni par le middleware KBE-23.
        const compteId = req.compteId;

        // Refuse la demande si aucun compte authentifié n'est disponible.
        if (!Number.isSafeInteger(compteId) || !compteId || compteId <= 0) {
            res.status(401).json({
                success: false,
                message: "Authentification requise."
            });
            return;
        }

        // Récupère l'identifiant de session transmis par le client.
        const { sessionId } = req.body ?? {};

        // Vérifie que l'identifiant de session est renseigné.
        if (typeof sessionId !== "string" || sessionId.trim() === "") {
            res.status(400).json({
                success: false,
                message: "Identifiant de session invalide."
            });
            return;
        }

        try {

            // Demande au service métier d'arrêter la session.
            // Le service vérifie que le compte est bien propriétaire.
            const session = await this.service.arreterPartage(
                sessionId,
                compteId
            );

            // Retourne la session après son arrêt.
            res.status(200).json({
                success: true,
                message: "Partage de position arrêté.",
                data: session
            });

        } catch (error) {

            // Récupère le message d'erreur du service métier.
            const message = error instanceof Error
                ? error.message
                : "Erreur inconnue.";

            // Retourne une erreur 403 si le compte n'est pas propriétaire.
            if (message === "Accès non autorisé à cette session.") {
                res.status(403).json({
                    success: false,
                    message
                });
                return;
            }

            // Retourne une erreur 404 lorsque la session est introuvable.
            if (message === "Session de partage introuvable.") {
                res.status(404).json({
                    success: false,
                    message
                });
                return;
            }

            // Retourne une erreur 409 lorsque la session
            // est déjà arrêtée, expirée ou inactive.
            if (
                message === "Cette session est déjà arrêtée." ||
                message === "Cette session a expiré." ||
                message === "Cette session n'est plus active."
            ) {
                res.status(409).json({
                    success: false,
                    message
                });
                return;
            }

            // Journalise les erreurs inattendues côté serveur.
            console.error("Erreur lors de l'arrêt du partage GPS :", error);

            // Retourne une erreur serveur générique.
            res.status(500).json({
                success: false,
                message: "Impossible d'arrêter le partage GPS."
            });
        }
    };

}