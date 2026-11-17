// Ce fichier contient la logique métier du partage de position GPS
// dans l'application KotBis.
// Il permettra de démarrer et d'arrêter les sessions de partage
// tout en respectant les règles de sécurité et de confidentialité.

// Importe une fonction permettant de générer un identifiant unique
// pour chaque nouvelle session de partage GPS.
import { randomUUID } from "node:crypto";

// Importe les types nécessaires pour représenter les sessions GPS
// et communiquer avec le système de stockage.
import {
    SessionPartagePosition,
    StockageSessionPartage
} from "./partage-position.types";

// Ce service regroupe les opérations liées au partage GPS.
// Il ne dépend pas directement de PostgreSQL afin de pouvoir être
// testé indépendamment et adapté au futur schéma de la base de données.
export class PartagePositionService {

    // Le stockage est fourni au service lors de sa création.
    // Cela permet de choisir ultérieurement une implémentation PostgreSQL
    // sans modifier les règles métier.
    constructor(
        private readonly stockage: StockageSessionPartage
    ) { }

    // Vérifie si une session est encore autorisée à fonctionner.
    // Une session doit être active et sa date d'expiration
    // ne doit pas être dépassée.
    private estSessionActive(session: SessionPartagePosition): boolean {
        return (
            session.statut === "active" &&
            session.dateExpiration.getTime() > Date.now()
        );
    }

    // Cette méthode démarre une nouvelle session de partage GPS.
    // Elle reçoit l'identifiant du compte connecté, le consentement
    // explicite du voyageur et la date d'expiration autorisée.
    // Elle crée une session uniquement lorsque les conditions sont respectées.
    async demarrerPartage(
        compteId: number,
        consentement: boolean,
        dateExpiration: Date
    ): Promise<SessionPartagePosition> {

        // Vérifie que l'identifiant du compte est valide.
        // L'identité réelle devra être fournie par le middleware
        // d'authentification et non par une valeur libre envoyée par le client.
        if (!Number.isSafeInteger(compteId) || compteId <= 0) {
            throw new Error("Identifiant du compte invalide.");
        }

        // Vérifie que le voyageur a explicitement accepté le partage GPS.
        // Sans ce consentement, aucune session ne peut être créée.
        if (consentement !== true) {
            throw new Error("Le consentement au partage GPS est obligatoire.");
        }

        // Enregistre l'instant auquel la session commence.
        const dateDebut = new Date();

        // Vérifie que la date d'expiration est valide et future.
        // La durée autorisée sera déterminée avec l'équipe.
        if (
            !(dateExpiration instanceof Date) ||
            !Number.isFinite(dateExpiration.getTime()) ||
            dateExpiration.getTime() <= dateDebut.getTime()
        ) {
            throw new Error("La date d'expiration doit être valide et future.");
        }

        // Prépare une session avec un identifiant unique.
        // La session est associée au compte du voyageur connecté.
        const session: SessionPartagePosition = {
            id: randomUUID(),
            compteId,
            dateDebut,
            dateFin: null,
            dateExpiration,
            statut: "active"
        };

        // Demande au stockage d'enregistrer la nouvelle session.
        // Si l'enregistrement échoue, la méthode ne retourne pas
        // une session considérée comme créée.
        await this.stockage.creer(session);

        // Retourne les informations de la session enregistrée.
        return session;
    }

    // Cette méthode permet à un voyageur d'arrêter une session de partage GPS.
    // Elle vérifie que la session existe, qu'elle appartient au compte connecté
    // et qu'elle est encore active avant d'enregistrer son arrêt.
    async arreterPartage(
        sessionId: string,
        compteId: number
    ): Promise<SessionPartagePosition> {

        // Vérifie que l'identifiant de la session est renseigné.
        // Une session sans identifiant ne peut pas être recherchée.
        if (typeof sessionId !== "string" || sessionId.trim() === "") {
            throw new Error("Identifiant de session invalide.");
        }

        // Vérifie que l'identifiant du compte est valide.
        // Cet identifiant devra provenir du système d'authentification.
        if (!Number.isSafeInteger(compteId) || compteId <= 0) {
            throw new Error("Identifiant du compte invalide.");
        }

        // Recherche la session demandée dans le système de stockage.
        // Si aucune session n'est trouvée, l'arrêt est refusé.
        const session = await this.stockage.trouverParId(sessionId);

        if (!session) {
            throw new Error("Session de partage introuvable.");
        }

        // Vérifie que la session appartient au voyageur connecté.
        // Cette vérification empêche un utilisateur d'arrêter
        // volontairement la session d'un autre utilisateur.
        if (session.compteId !== compteId) {
            throw new Error("Accès non autorisé à cette session.");
        }

        // Vérifie si la session a déjà été arrêtée.
        // Une session arrêtée ne doit pas être modifiée inutilement.
        if (session.statut === "arretee") {
            throw new Error("Cette session est déjà arrêtée.");
        }

        // Vérifie si la session a dépassé sa date d'expiration.
        // Une session expirée ne doit plus être considérée comme active.
        if (
            session.statut === "expiree" ||
            session.dateExpiration.getTime() <= Date.now()
        ) {
            throw new Error("Cette session a expiré.");
        }

        // Vérifie que la session est toujours autorisée à fonctionner.
        // Cette méthode tient compte du statut et de la date d'expiration.
        if (!this.estSessionActive(session)) {
            throw new Error("Cette session n'est plus active.");
        }

        // Prépare une nouvelle version de la session avec le statut arrêté.
        // La date de fin correspond au moment où l'arrêt est demandé.
        const sessionArretee: SessionPartagePosition = {
            ...session,
            statut: "arretee",
            dateFin: new Date()
        };

        // Enregistre le changement d'état dans le système de stockage.
        // L'implémentation définitive devra garantir un arrêt atomique,
        // même si plusieurs requêtes arrivent simultanément.
        await this.stockage.modifier(sessionArretee);

        // Retourne les informations de la session après son arrêt.
        return sessionArretee;
    }


    // Cette méthode vérifie si une session GPS a dépassé sa date d'expiration.
    // Lorsqu'une session active est expirée, elle met à jour son statut
    // dans le stockage afin qu'elle ne soit plus considérée comme utilisable.
    // Elle ne modifie pas les sessions déjà arrêtées volontairement.
    async verifierExpiration(
        sessionId: string
    ): Promise<SessionPartagePosition> {

        // Vérifie que l'identifiant de session est correctement renseigné.
        // Cela évite de rechercher une session avec un identifiant vide.
        if (typeof sessionId !== "string" || sessionId.trim() === "") {
            throw new Error("Identifiant de session invalide.");
        }

        // Recherche la session dans le système de stockage.
        // Si elle n'existe pas, aucune vérification ne peut être effectuée.
        const session = await this.stockage.trouverParId(sessionId);

        if (!session) {
            throw new Error("Session de partage introuvable.");
        }

        // Une session arrêtée volontairement doit conserver son statut.
        // Son expiration ne doit pas remplacer la décision du voyageur.
        if (session.statut === "arretee") {
            return session;
        }

        // Une session déjà marquée comme expirée ne nécessite
        // aucune nouvelle modification dans le stockage.
        if (session.statut === "expiree") {
            return session;
        }

        // Vérifie si la date d'expiration est atteinte ou dépassée.
        // Si la session est encore valide, elle est retournée sans modification.
        if (session.dateExpiration.getTime() > Date.now()) {
            return session;
        }

        // Prépare une nouvelle version de la session avec le statut expiré.
        // La date de fin correspond ici à la date d'expiration prévue,
        // et non à l'heure à laquelle le serveur constate l'expiration.
        const sessionExpiree: SessionPartagePosition = {
            ...session,
            statut: "expiree",
            dateFin: session.dateExpiration
        };

        // Enregistre le nouveau statut dans le système de stockage.
        // L'implémentation PostgreSQL devra garantir que cette mise à jour
        // ne remplace pas un arrêt volontaire effectué simultanément.
        await this.stockage.modifier(sessionExpiree);

        // Retourne les informations actualisées de la session.
        return sessionExpiree;
    }
}