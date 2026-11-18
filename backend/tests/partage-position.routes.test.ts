// Ce fichier teste les routes HTTP du partage de position GPS.
// Il utilise un serveur Express temporaire et un stockage en mémoire.
// Aucun accès à PostgreSQL ni au serveur principal n'est nécessaire.

import test from "node:test";
import assert from "node:assert/strict";
import express, { type RequestHandler } from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

import { PartagePositionService } from "../src/localisation/partage-position.service";
import { PartagePositionController } from "../src/localisation/partage-position.controller";
import { creerRoutesPartagePosition } from "../src/localisation/partage-position.routes";

import type {
    SessionPartagePosition,
    StockageSessionPartage
} from "../src/localisation/partage-position.types";

// Ce stockage temporaire permet d'enregistrer les sessions GPS
// pendant les tests sans utiliser PostgreSQL.
class StockageSessionMemoire implements StockageSessionPartage {

    private sessions = new Map<string, SessionPartagePosition>();

    // Enregistre une nouvelle session GPS.
    async creer(session: SessionPartagePosition): Promise<void> {
        this.sessions.set(session.id, { ...session });
    }

    // Recherche une session par son identifiant.
    async trouverParId(id: string): Promise<SessionPartagePosition | null> {
        const session = this.sessions.get(id);
        return session ? { ...session } : null;
    }

    // Modifie une session existante.
    async modifier(session: SessionPartagePosition): Promise<void> {
        if (!this.sessions.has(session.id)) {
            throw new Error("Session de partage introuvable.");
        }

        this.sessions.set(session.id, { ...session });
    }

    // Retourne le nombre de sessions enregistrées.
    nombreSessions(): number {
        return this.sessions.size;
    }
}

// Représente le résultat d'une requête HTTP de test.
interface ReponseTest {
    statut: number;
    corps: any;
}

// Représente les ressources utilisées pendant chaque test.
interface EnvironnementTest {
    serveur: Server;
    urlBase: string;
    stockage: StockageSessionMemoire;
    service: PartagePositionService;
}

// Crée un serveur Express temporaire pour les tests.
// Le serveur utilise un port libre attribué automatiquement.
async function creerEnvironnementTest(): Promise<EnvironnementTest> {

    // Prépare le stockage, le service et le contrôleur.
    const stockage = new StockageSessionMemoire();
    const service = new PartagePositionService(stockage);
    const controller = new PartagePositionController(service);

    // Crée une application Express indépendante du serveur KotBis.
    const app = express();

    // Autorise Express à lire les requêtes JSON.
    app.use(express.json());

    // Ce middleware simule uniquement le résultat de l'authentification.
    // Dans l'application réelle, KBE-23 devra vérifier un jeton valide.
    // L'en-tête x-test-compte-id est réservé exclusivement aux tests.
    const authentifierTest: RequestHandler = (req, res, next) => {

        const valeur = req.header("x-test-compte-id");
        const compteId = valeur;

        // Refuse les requêtes sans identifiant de test valide.
        if (
            !compteId ||
            !/^[1-9]\d*$/.test(compteId) ||
            BigInt(compteId) > 9223372036854775807n
        ) {
            res.status(401).json({
                success: false,
                message: "Authentification requise."
            });
            return;
        }

        // Simule l'identité fournie par un middleware authentifié.
        // Cette affectation n'existe que dans le serveur temporaire.
        (req as typeof req & {
            utilisateur: { compteId: string }
        }).utilisateur = { compteId };

        next();
    };

    // Monte les routes GPS sous le préfixe prévu pour KotBis.
    app.use(
        "/api/localisation/partage",
        creerRoutesPartagePosition(controller, authentifierTest)
    );

    // Démarre le serveur sur un port libre de la machine.
    const serveur = await new Promise<Server>((resolve, reject) => {

        const instance = app.listen(0, "127.0.0.1", () => {
            resolve(instance);
        });

        instance.once("error", reject);
    });

    // Récupère le port réellement attribué au serveur.
    const adresse = serveur.address() as AddressInfo;

    return {
        serveur,
        urlBase: `http://127.0.0.1:${adresse.port}`,
        stockage,
        service
    };
}

// Ferme le serveur HTTP après chaque test.
// Cela évite de laisser des ports ouverts.
async function fermerEnvironnementTest(
    environnement: EnvironnementTest
): Promise<void> {

    await new Promise<void>((resolve, reject) => {

        environnement.serveur.close((erreur) => {
            if (erreur) {
                reject(erreur);
                return;
            }

            resolve();
        });
    });
}

// Envoie une requête POST au serveur temporaire.
// L'identifiant de compte est transmis uniquement par un en-tête de test.
async function envoyerPost(
    urlBase: string,
    chemin: string,
    corps: object,
    compteId?: string
): Promise<ReponseTest> {

    // Prépare les en-têtes de la requête.
    const headers: Record<string, string> = {
        "Content-Type": "application/json"
    };

    // Ajoute l'identifiant simulé uniquement lorsqu'il est fourni.
    if (compteId !== undefined) {
        headers["x-test-compte-id"] = String(compteId);
    }

    // Envoie une véritable requête HTTP au serveur Express.
    const reponse = await fetch(`${urlBase}${chemin}`, {
        method: "POST",
        headers,
        body: JSON.stringify(corps)
    });

    // Retourne le code HTTP et le contenu JSON.
    return {
        statut: reponse.status,
        corps: await reponse.json()
    };
}

// Vérifie le démarrage du partage avec authentification et consentement.
test("ROUTE HTTP 201 - Démarrer le partage GPS", async () => {

    const env = await creerEnvironnementTest();

    try {
        // Envoie une demande de démarrage pour le compte 15.
        const reponse = await envoyerPost(
            env.urlBase,
            "/api/localisation/partage/demarrer",
            { consentement: true },
            "15"
        );

        // Vérifie le code HTTP et les informations de session.
        assert.equal(reponse.statut, 201);
        assert.equal(reponse.corps.success, true);
        assert.equal(reponse.corps.data.compteId, "15");
        assert.equal(reponse.corps.data.statut, "active");

        // Vérifie qu'une session a été enregistrée.
        assert.equal(env.stockage.nombreSessions(), 1);

    } finally {
        await fermerEnvironnementTest(env);
    }
});

// Vérifie que le démarrage est refusé sans authentification.
test("ROUTE HTTP 401 - Refuser le démarrage sans authentification", async () => {

    const env = await creerEnvironnementTest();

    try {
        const reponse = await envoyerPost(
            env.urlBase,
            "/api/localisation/partage/demarrer",
            { consentement: true }
        );

        assert.equal(reponse.statut, 401);
        assert.equal(env.stockage.nombreSessions(), 0);

    } finally {
        await fermerEnvironnementTest(env);
    }
});

// Vérifie que le consentement explicite est obligatoire.
test("ROUTE HTTP 400 - Refuser le démarrage sans consentement", async () => {

    const env = await creerEnvironnementTest();

    try {
        const reponse = await envoyerPost(
            env.urlBase,
            "/api/localisation/partage/demarrer",
            { consentement: false },
            "15"
        );

        assert.equal(reponse.statut, 400);
        assert.equal(env.stockage.nombreSessions(), 0);

    } finally {
        await fermerEnvironnementTest(env);
    }
});

// Vérifie que le propriétaire peut arrêter sa session GPS.
test("ROUTE HTTP 200 - Arrêter sa propre session GPS", async () => {

    const env = await creerEnvironnementTest();

    try {
        // Crée une session active appartenant au compte 15.
        const expiration = new Date(Date.now() + 60 * 60 * 1000);
        const session = await env.service.demarrerPartage(
            "15",
            true,
            expiration
        );

        // Envoie une demande d'arrêt depuis le compte propriétaire.
        const reponse = await envoyerPost(
            env.urlBase,
            "/api/localisation/partage/arreter",
            { sessionId: session.id },
            "15"
        );

        // Vérifie que la session est arrêtée.
        assert.equal(reponse.statut, 200);
        assert.equal(reponse.corps.data.statut, "arretee");

        // Vérifie que le stockage conserve le statut arrêté.
        const sessionEnregistree = await env.stockage.trouverParId(
            session.id
        );

        assert.equal(sessionEnregistree?.statut, "arretee");

    } finally {
        await fermerEnvironnementTest(env);
    }
});

// Vérifie que l'arrêt est refusé sans authentification.
test("ROUTE HTTP 401 - Refuser l'arrêt sans authentification", async () => {

    const env = await creerEnvironnementTest();

    try {
        const expiration = new Date(Date.now() + 60 * 60 * 1000);
        const session = await env.service.demarrerPartage(
            "15",
            true,
            expiration
        );

        const reponse = await envoyerPost(
            env.urlBase,
            "/api/localisation/partage/arreter",
            { sessionId: session.id }
        );

        assert.equal(reponse.statut, 401);

        // Vérifie que la session n'a pas été arrêtée.
        const sessionEnregistree = await env.stockage.trouverParId(
            session.id
        );

        assert.equal(sessionEnregistree?.statut, "active");

    } finally {
        await fermerEnvironnementTest(env);
    }
});

// Vérifie qu'un voyageur ne peut pas arrêter la session d'un autre.
test("ROUTE HTTP 403 - Refuser l'arrêt d'un autre voyageur", async () => {

    const env = await creerEnvironnementTest();

    try {
        // Le compte 15 crée une session.
        const expiration = new Date(Date.now() + 60 * 60 * 1000);
        const session = await env.service.demarrerPartage(
            "15",
            true,
            expiration
        );

        // Le compte 20 tente d'arrêter cette session.
        const reponse = await envoyerPost(
            env.urlBase,
            "/api/localisation/partage/arreter",
            { sessionId: session.id },
            "20"
        );

        assert.equal(reponse.statut, 403);

        // Vérifie que la session reste active.
        const sessionEnregistree = await env.stockage.trouverParId(
            session.id
        );

        assert.equal(sessionEnregistree?.statut, "active");

    } finally {
        await fermerEnvironnementTest(env);
    }
});

// Vérifie que l'arrêt d'une session inexistante retourne HTTP 404.
test("ROUTE HTTP 404 - Refuser une session inexistante", async () => {

    const env = await creerEnvironnementTest();

    try {
        const reponse = await envoyerPost(
            env.urlBase,
            "/api/localisation/partage/arreter",
            { sessionId: "session-inexistante" },
            "15"
        );

        assert.equal(reponse.statut, 404);

    } finally {
        await fermerEnvironnementTest(env);
    }
});

// Vérifie qu'une session déjà arrêtée ne peut pas être arrêtée de nouveau.
test("ROUTE HTTP 409 - Refuser une session déjà arrêtée", async () => {

    const env = await creerEnvironnementTest();

    try {
        const expiration = new Date(Date.now() + 60 * 60 * 1000);
        const session = await env.service.demarrerPartage(
            "15",
            true,
            expiration
        );

        // Arrête la session une première fois.
        await env.service.arreterPartage(session.id, "15");

        // Tente de l'arrêter une deuxième fois via HTTP.
        const reponse = await envoyerPost(
            env.urlBase,
            "/api/localisation/partage/arreter",
            { sessionId: session.id },
            "15"
        );

        assert.equal(reponse.statut, 409);

    } finally {
        await fermerEnvironnementTest(env);
    }
});

// Vérifie qu'un compteId fourni uniquement dans le corps HTTP
// ne permet pas de contourner l'authentification.
test("ROUTE HTTP 401 - Ignorer le compteId fourni par le client", async () => {

    const env = await creerEnvironnementTest();

    try {
        const reponse = await envoyerPost(
            env.urlBase,
            "/api/localisation/partage/demarrer",
            {
                compteId: 15,
                consentement: true
            }
        );

        assert.equal(reponse.statut, 401);
        assert.equal(env.stockage.nombreSessions(), 0);

    } finally {
        await fermerEnvironnementTest(env);
    }
});