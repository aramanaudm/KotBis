// Ce fichier contient les tests HTTP du contrôleur de partage GPS.
// Il vérifie les réponses du contrôleur sans démarrer le serveur Express.
// Les tests utilisent un stockage temporaire indépendant de PostgreSQL.

// Importe les outils de test intégrés à Node.js.
import test from "node:test";
import assert from "node:assert/strict";

// Importe les types HTTP nécessaires pour simuler Express.
import type { Request, Response } from "express";

// Importe les composants du partage GPS.
import { PartagePositionController } from "../src/localisation/partage-position.controller";
import { PartagePositionService } from "../src/localisation/partage-position.service";

import type {
    SessionPartagePosition,
    StockageSessionPartage
} from "../src/localisation/partage-position.types";

// Ce stockage temporaire permet de tester le contrôleur
// sans utiliser la base de données PostgreSQL.
class StockageSessionMemoire implements StockageSessionPartage {

    // Conserve les sessions dans une collection temporaire.
    private sessions = new Map<string, SessionPartagePosition>();

    // Enregistre une nouvelle session GPS.
    async creer(session: SessionPartagePosition): Promise<void> {
        this.sessions.set(session.id, { ...session });
    }

    // Recherche une session à partir de son identifiant.
    async trouverParId(id: string): Promise<SessionPartagePosition | null> {
        const session = this.sessions.get(id);
        return session ? { ...session } : null;
    }

    // Modifie une session existante.
    async modifier(session: SessionPartagePosition): Promise<void> {
        this.sessions.set(session.id, { ...session });
    }

    // Retourne le nombre de sessions enregistrées.
    nombreSessions(): number {
        return this.sessions.size;
    }
}

// Vérifie qu'une demande de partage GPS sans authentification
// est refusée, même lorsque le consentement est fourni.
test("HTTP 401 - Refuser le démarrage GPS sans authentification", async () => {

    // Prépare le stockage et le service métier.
    const stockage = new StockageSessionMemoire();
    const service = new PartagePositionService(stockage);

    // Crée le contrôleur HTTP à tester.
    const controller = new PartagePositionController(service);

    // Simule une requête sans identifiant de compte authentifié.
    // Le consentement est volontairement valide.
    const req = {
        body: {
            consentement: true
        }
    } as Request;

    // Conserve le code HTTP et le contenu de la réponse.
    let statutHttp = 200;
    let reponseJson: unknown = null;

    // Simule les méthodes Express utilisées par le contrôleur.
    const res = {
        status(code: number) {
            statutHttp = code;
            return this;
        },

        json(data: unknown) {
            reponseJson = data;
            return this;
        }
    } as Response;

    // Exécute la méthode HTTP de démarrage.
    await controller.demarrerPartage(req, res);

    // Vérifie que le contrôleur refuse la demande.
    assert.equal(statutHttp, 401);

    // Vérifie que le message d'authentification est retourné.
    assert.deepEqual(reponseJson, {
        success: false,
        message: "Authentification requise."
    });

    // Vérifie qu'aucune session GPS n'a été créée.
    assert.equal(stockage.nombreSessions(), 0);
});

// Vérifie qu'un voyageur authentifié peut démarrer son partage GPS.
// Le contrôleur doit retourner HTTP 201 et enregistrer une session active.
test("HTTP 201 - Démarrer le partage GPS avec authentification", async () => {

    // Prépare le stockage temporaire et le service métier.
    const stockage = new StockageSessionMemoire();
    const service = new PartagePositionService(stockage);

    // Crée le contrôleur HTTP à tester.
    const controller = new PartagePositionController(service);

    // Simule une requête provenant d'un compte authentifié.
    // Le compte 15 représente un voyageur identifié par le middleware.
    const req = {
        compteId: 15,
        body: {
            consentement: true
        }
    } as Request & { compteId: number };

    // Prépare les variables pour récupérer la réponse HTTP.
    let statutHttp = 200;
    let reponseJson: unknown = null;

    // Simule les méthodes Express utilisées par le contrôleur.
    const res = {
        status(code: number) {
            statutHttp = code;
            return this;
        },

        json(data: unknown) {
            reponseJson = data;
            return this;
        }
    } as Response;

    // Exécute la méthode de démarrage du partage GPS.
    await controller.demarrerPartage(req, res);

    // Vérifie que la création retourne le code HTTP 201.
    assert.equal(statutHttp, 201);

    // Vérifie que la réponse indique une création réussie.
    assert.ok(reponseJson !== null);

    // Vérifie que la réponse contient une session GPS valide.
    const reponse = reponseJson as {
        success: boolean;
        message: string;
        data: SessionPartagePosition;
    };

    assert.equal(reponse.success, true);
    assert.equal(reponse.message, "Partage de position démarré.");

    // Vérifie que la session appartient au compte authentifié.
    assert.equal(reponse.data.compteId, 15);

    // Vérifie que la session est active après sa création.
    assert.equal(reponse.data.statut, "active");

    // Vérifie que la session possède un identifiant unique.
    assert.ok(reponse.data.id);

    // Vérifie qu'une seule session a été enregistrée.
    assert.equal(stockage.nombreSessions(), 1);

    // Recherche la session créée dans le stockage temporaire.
    const sessionEnregistree = await stockage.trouverParId(
        reponse.data.id
    );

    // Le test échoue si la session n'a pas été enregistrée.
    if (sessionEnregistree === null) {
        throw new Error("La session GPS n'a pas été enregistrée.");
    }

    // Vérifie que le compte enregistré correspond au compte authentifié.
    assert.equal(sessionEnregistree.compteId, 15);
});


// Vérifie qu'un voyageur authentifié ne peut pas démarrer
// le partage GPS sans avoir donné son consentement explicite.
test("HTTP 400 - Refuser le démarrage GPS sans consentement", async () => {

    // Prépare le stockage temporaire et le service métier.
    const stockage = new StockageSessionMemoire();
    const service = new PartagePositionService(stockage);

    // Crée le contrôleur HTTP à tester.
    const controller = new PartagePositionController(service);

    // Simule un voyageur authentifié qui refuse le partage GPS.
    // Le compte 15 est uniquement utilisé pour ce test.
    const req = {
        compteId: 15,
        body: {
            consentement: false
        }
    } as Request & { compteId: number };

    // Prépare les variables pour récupérer la réponse HTTP.
    let statutHttp = 200;
    let reponseJson: unknown = null;

    // Simule les méthodes Express utilisées par le contrôleur.
    const res = {
        status(code: number) {
            statutHttp = code;
            return this;
        },

        json(data: unknown) {
            reponseJson = data;
            return this;
        }
    } as Response;

    // Exécute la méthode HTTP de démarrage.
    await controller.demarrerPartage(req, res);

    // Vérifie que le contrôleur refuse la demande.
    assert.equal(statutHttp, 400);

    // Vérifie que le message correspond au refus du consentement.
    assert.deepEqual(reponseJson, {
        success: false,
        message: "Le consentement au partage GPS est obligatoire."
    });

    // Vérifie qu'aucune session GPS n'a été créée.
    assert.equal(stockage.nombreSessions(), 0);
});

// Vérifie qu'un voyageur authentifié peut arrêter sa propre session GPS.
// Le contrôleur doit retourner HTTP 200 après l'arrêt du partage.
test("HTTP 200 - Arrêter sa propre session GPS", async () => {

    // Prépare le stockage temporaire et le service métier.
    const stockage = new StockageSessionMemoire();
    const service = new PartagePositionService(stockage);

    // Crée le contrôleur HTTP à tester.
    const controller = new PartagePositionController(service);

    // Crée une session GPS active appartenant au compte 15.
    const expiration = new Date(Date.now() + 60 * 60 * 1000);
    const session = await service.demarrerPartage(15, true, expiration);

    // Simule une demande d'arrêt provenant du propriétaire.
    const req = {
        compteId: 15,
        body: {
            sessionId: session.id
        }
    } as Request & { compteId: number };

    // Prépare les variables pour récupérer la réponse HTTP.
    let statutHttp = 200;
    let reponseJson: unknown = null;

    // Simule les méthodes Express utilisées par le contrôleur.
    const res = {
        status(code: number) {
            statutHttp = code;
            return this;
        },

        json(data: unknown) {
            reponseJson = data;
            return this;
        }
    } as Response;

    // Exécute la méthode HTTP d'arrêt.
    await controller.arreterPartage(req, res);

    // Vérifie que le contrôleur retourne HTTP 200.
    assert.equal(statutHttp, 200);

    // Vérifie le contenu de la réponse.
    const reponse = reponseJson as {
        success: boolean;
        message: string;
        data: SessionPartagePosition;
    };

    assert.equal(reponse.success, true);
    assert.equal(reponse.message, "Partage de position arrêté.");

    // Vérifie que la session est arrêtée.
    assert.equal(reponse.data.statut, "arretee");

    // Vérifie que la date de fin est renseignée.
    assert.ok(reponse.data.dateFin instanceof Date);

    // Vérifie que le nouveau statut est enregistré.
    const sessionEnregistree = await stockage.trouverParId(session.id);

    if (sessionEnregistree === null) {
        throw new Error("La session GPS est introuvable.");
    }

    assert.equal(sessionEnregistree.statut, "arretee");
});

// Vérifie qu'un utilisateur non authentifié ne peut pas
// arrêter une session GPS, même avec un identifiant valide.
test("HTTP 401 - Refuser l'arrêt GPS sans authentification", async () => {

    // Prépare le stockage et le service.
    const stockage = new StockageSessionMemoire();
    const service = new PartagePositionService(stockage);
    const controller = new PartagePositionController(service);

    // Crée une session appartenant au compte 15.
    const expiration = new Date(Date.now() + 60 * 60 * 1000);
    const session = await service.demarrerPartage(15, true, expiration);

    // Simule une requête sans identité authentifiée.
    const req = {
        body: {
            sessionId: session.id
        }
    } as Request;

    // Prépare la réponse HTTP simulée.
    let statutHttp = 200;
    let reponseJson: unknown = null;

    const res = {
        status(code: number) {
            statutHttp = code;
            return this;
        },

        json(data: unknown) {
            reponseJson = data;
            return this;
        }
    } as Response;

    // Tente d'arrêter la session sans authentification.
    await controller.arreterPartage(req, res);

    // Vérifie que l'accès est refusé.
    assert.equal(statutHttp, 401);

    assert.deepEqual(reponseJson, {
        success: false,
        message: "Authentification requise."
    });

    // Vérifie que la session reste active.
    const sessionEnregistree = await stockage.trouverParId(session.id);

    assert.equal(sessionEnregistree?.statut, "active");
});

// Vérifie qu'un voyageur authentifié doit fournir
// un identifiant de session valide pour arrêter son partage.
test("HTTP 400 - Refuser l'arrêt sans identifiant de session", async () => {

    // Prépare les composants nécessaires au test.
    const stockage = new StockageSessionMemoire();
    const service = new PartagePositionService(stockage);
    const controller = new PartagePositionController(service);

    // Simule une requête authentifiée sans sessionId.
    const req = {
        compteId: 15,
        body: {}
    } as Request & { compteId: number };

    // Prépare la réponse HTTP simulée.
    let statutHttp = 200;
    let reponseJson: unknown = null;

    const res = {
        status(code: number) {
            statutHttp = code;
            return this;
        },

        json(data: unknown) {
            reponseJson = data;
            return this;
        }
    } as Response;

    // Exécute la demande d'arrêt.
    await controller.arreterPartage(req, res);

    // Vérifie que la requête est refusée.
    assert.equal(statutHttp, 400);

    assert.deepEqual(reponseJson, {
        success: false,
        message: "Identifiant de session invalide."
    });

    // Vérifie qu'aucune session n'a été créée ou modifiée.
    assert.equal(stockage.nombreSessions(), 0);
});

// Vérifie qu'un voyageur ne peut pas arrêter
// une session GPS appartenant à un autre compte.
test("HTTP 403 - Refuser l'arrêt GPS d'un autre voyageur", async () => {

    // Prépare le stockage et les composants métier.
    const stockage = new StockageSessionMemoire();
    const service = new PartagePositionService(stockage);
    const controller = new PartagePositionController(service);

    // Le compte 15 démarre son partage GPS.
    const expiration = new Date(Date.now() + 60 * 60 * 1000);
    const session = await service.demarrerPartage(15, true, expiration);

    // Le compte 20 tente d'arrêter la session du compte 15.
    const req = {
        compteId: 20,
        body: {
            sessionId: session.id
        }
    } as Request & { compteId: number };

    // Prépare la réponse HTTP simulée.
    let statutHttp = 200;
    let reponseJson: unknown = null;

    const res = {
        status(code: number) {
            statutHttp = code;
            return this;
        },

        json(data: unknown) {
            reponseJson = data;
            return this;
        }
    } as Response;

    // Exécute la demande d'arrêt non autorisée.
    await controller.arreterPartage(req, res);

    // Vérifie que le contrôleur retourne HTTP 403.
    assert.equal(statutHttp, 403);

    assert.deepEqual(reponseJson, {
        success: false,
        message: "Accès non autorisé à cette session."
    });

    // Vérifie que la session du compte 15 reste active.
    const sessionEnregistree = await stockage.trouverParId(session.id);

    assert.equal(sessionEnregistree?.statut, "active");
});

// Vérifie que le contrôleur retourne HTTP 404
// lorsqu'un voyageur demande l'arrêt d'une session inexistante.
test("HTTP 404 - Refuser l'arrêt d'une session inexistante", async () => {

    // Prépare les composants nécessaires au test.
    const stockage = new StockageSessionMemoire();
    const service = new PartagePositionService(stockage);
    const controller = new PartagePositionController(service);

    // Simule une demande avec un identifiant de session inexistant.
    const req = {
        compteId: 15,
        body: {
            sessionId: "session-inexistante"
        }
    } as Request & { compteId: number };

    // Prépare la réponse HTTP simulée.
    let statutHttp = 200;
    let reponseJson: unknown = null;

    const res = {
        status(code: number) {
            statutHttp = code;
            return this;
        },

        json(data: unknown) {
            reponseJson = data;
            return this;
        }
    } as Response;

    // Tente d'arrêter la session inexistante.
    await controller.arreterPartage(req, res);

    // Vérifie que le contrôleur retourne HTTP 404.
    assert.equal(statutHttp, 404);

    assert.deepEqual(reponseJson, {
        success: false,
        message: "Session de partage introuvable."
    });

    // Vérifie qu'aucune session n'a été créée.
    assert.equal(stockage.nombreSessions(), 0);
});

// Vérifie qu'une session GPS déjà arrêtée
// ne peut pas être arrêtée une deuxième fois.
test("HTTP 409 - Refuser l'arrêt d'une session déjà arrêtée", async () => {

    // Prépare le stockage et les composants métier.
    const stockage = new StockageSessionMemoire();
    const service = new PartagePositionService(stockage);
    const controller = new PartagePositionController(service);

    // Crée une session active appartenant au compte 15.
    const expiration = new Date(Date.now() + 60 * 60 * 1000);
    const session = await service.demarrerPartage(15, true, expiration);

    // Arrête volontairement la session une première fois.
    await service.arreterPartage(session.id, 15);

    // Simule une deuxième demande d'arrêt.
    const req = {
        compteId: 15,
        body: {
            sessionId: session.id
        }
    } as Request & { compteId: number };

    // Prépare la réponse HTTP simulée.
    let statutHttp = 200;
    let reponseJson: unknown = null;

    const res = {
        status(code: number) {
            statutHttp = code;
            return this;
        },

        json(data: unknown) {
            reponseJson = data;
            return this;
        }
    } as Response;

    // Tente d'arrêter une deuxième fois la session.
    await controller.arreterPartage(req, res);

    // Vérifie que le contrôleur retourne HTTP 409.
    assert.equal(statutHttp, 409);

    assert.deepEqual(reponseJson, {
        success: false,
        message: "Cette session est déjà arrêtée."
    });

    // Vérifie que la session reste arrêtée.
    const sessionEnregistree = await stockage.trouverParId(session.id);

    assert.equal(sessionEnregistree?.statut, "arretee");
});

// Vérifie qu'une session expirée ne peut pas
// être arrêtée comme une session encore active.
test("HTTP 409 - Refuser l'arrêt d'une session expirée", async () => {

    // Prépare le stockage et les composants métier.
    const stockage = new StockageSessionMemoire();
    const service = new PartagePositionService(stockage);
    const controller = new PartagePositionController(service);

    // Crée une session valide pour le compte 15.
    const expiration = new Date(Date.now() + 60 * 60 * 1000);
    const session = await service.demarrerPartage(15, true, expiration);

    // Simule une session dont l'expiration a déjà été enregistrée.
    await stockage.modifier({
        ...session,
        statut: "expiree",
        dateFin: new Date()
    });

    // Simule une demande d'arrêt du propriétaire.
    const req = {
        compteId: 15,
        body: {
            sessionId: session.id
        }
    } as Request & { compteId: number };

    // Prépare la réponse HTTP simulée.
    let statutHttp = 200;
    let reponseJson: unknown = null;

    const res = {
        status(code: number) {
            statutHttp = code;
            return this;
        },

        json(data: unknown) {
            reponseJson = data;
            return this;
        }
    } as Response;

    // Tente d'arrêter la session expirée.
    await controller.arreterPartage(req, res);

    // Vérifie que le contrôleur retourne HTTP 409.
    assert.equal(statutHttp, 409);

    assert.deepEqual(reponseJson, {
        success: false,
        message: "Cette session a expiré."
    });

    // Vérifie que le statut expiré est conservé.
    const sessionEnregistree = await stockage.trouverParId(session.id);

    assert.equal(sessionEnregistree?.statut, "expiree");
});

// Vérifie que le contrôleur ne considère pas un compteId
// envoyé dans le corps HTTP comme une authentification valide.
test("HTTP 401 - Ignorer un compteId fourni dans le corps HTTP", async () => {

    // Prépare le stockage et les composants métier.
    const stockage = new StockageSessionMemoire();
    const service = new PartagePositionService(stockage);
    const controller = new PartagePositionController(service);

    // Simule une requête sans identité authentifiée.
    // Le client tente de fournir lui-même un identifiant de compte.
    const req = {
        body: {
            compteId: 15,
            consentement: true
        }
    } as Request;

    // Prépare la réponse HTTP simulée.
    let statutHttp = 200;
    let reponseJson: unknown = null;

    const res = {
        status(code: number) {
            statutHttp = code;
            return this;
        },

        json(data: unknown) {
            reponseJson = data;
            return this;
        }
    } as Response;

    // Tente de démarrer le partage avec un identifiant non authentifié.
    await controller.demarrerPartage(req, res);

    // Vérifie que le contrôleur refuse la demande.
    assert.equal(statutHttp, 401);

    assert.deepEqual(reponseJson, {
        success: false,
        message: "Authentification requise."
    });

    // Vérifie qu'aucune session GPS n'a été créée.
    assert.equal(stockage.nombreSessions(), 0);
});