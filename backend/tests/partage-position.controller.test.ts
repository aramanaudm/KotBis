import test from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";

import { PartagePositionController } from "../src/localisation/partage-position.controller";
import { PartagePositionService } from "../src/localisation/partage-position.service";

import type {
    SessionPartagePosition,
    StockageSessionPartage
} from "../src/localisation/partage-position.types";

// STOCKAGE TEMPORAIRE POUR LES TESTS

class StockageSessionMemoire implements StockageSessionPartage {
    private sessions = new Map<string, SessionPartagePosition>();

    async creer(session: SessionPartagePosition): Promise<void> {
        this.sessions.set(session.id, { ...session });
    }

    async trouverParId(id: string): Promise<SessionPartagePosition | null> {
        const session = this.sessions.get(id);
        return session ? { ...session } : null;
    }

    async modifier(session: SessionPartagePosition): Promise<void> {
        this.sessions.set(session.id, { ...session });
    }

    nombreSessions(): number {
        return this.sessions.size;
    }
}

// SIMULATION DES REPONSES HTTP EXPRESS

function creerReponseTest() {
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

    return {
        res,
        obtenirStatut: () => statutHttp,
        obtenirJson: () => reponseJson
    };
}

// SIMULATION D'UNE REQUETE AUTHENTIFIEE

function creerRequete(
    body: Record<string, unknown>,
    compteId?: string
): Request {
    const req = {
        body,
        ...(compteId !== undefined
            ? { utilisateur: { compteId } }
            : {})
    };

    return req as Request;
}

// TEST 1 - REFUSER LE DEMARRAGE SANS AUTHENTIFICATION

test("HTTP 401 - Refuser le démarrage GPS sans authentification", async () => {
    const stockage = new StockageSessionMemoire();
    const service = new PartagePositionService(stockage);
    const controller = new PartagePositionController(service);

    const req = creerRequete({
        consentement: true
    });

    const reponse = creerReponseTest();

    await controller.demarrerPartage(req, reponse.res);

    assert.equal(reponse.obtenirStatut(), 401);

    assert.deepEqual(reponse.obtenirJson(), {
        success: false,
        message: "Authentification requise."
    });

    assert.equal(stockage.nombreSessions(), 0);
});

// TEST 2 - DEMARRER LE PARTAGE AVEC AUTHENTIFICATION

test("HTTP 201 - Démarrer le partage GPS avec authentification", async () => {
    const stockage = new StockageSessionMemoire();
    const service = new PartagePositionService(stockage);
    const controller = new PartagePositionController(service);

    const req = creerRequete(
        { consentement: true },
        "15"
    );

    const reponse = creerReponseTest();

    await controller.demarrerPartage(req, reponse.res);

    assert.equal(reponse.obtenirStatut(), 201);

    assert.ok(reponse.obtenirJson() !== null);

    const resultat = reponse.obtenirJson() as {
        success: boolean;
        message: string;
        data: SessionPartagePosition;
    };

    assert.equal(resultat.success, true);
    assert.equal(resultat.message, "Partage de position démarré.");

    assert.equal(resultat.data.compteId, "15");
    assert.equal(resultat.data.statut, "active");
    assert.ok(resultat.data.id);

    assert.equal(stockage.nombreSessions(), 1);

    const sessionEnregistree = await stockage.trouverParId(
        resultat.data.id
    );

    if (sessionEnregistree === null) {
        throw new Error("La session GPS n'a pas été enregistrée.");
    }

    assert.equal(sessionEnregistree.compteId, "15");
});

// TEST 3 - REFUSER LE DEMARRAGE SANS CONSENTEMENT

test("HTTP 400 - Refuser le démarrage GPS sans consentement", async () => {
    const stockage = new StockageSessionMemoire();
    const service = new PartagePositionService(stockage);
    const controller = new PartagePositionController(service);

    const req = creerRequete(
        { consentement: false },
        "15"
    );

    const reponse = creerReponseTest();

    await controller.demarrerPartage(req, reponse.res);

    assert.equal(reponse.obtenirStatut(), 400);

    assert.deepEqual(reponse.obtenirJson(), {
        success: false,
        message: "Le consentement au partage GPS est obligatoire."
    });

    assert.equal(stockage.nombreSessions(), 0);
});

// TEST 4 - ARRETER SA PROPRE SESSION GPS

test("HTTP 200 - Arrêter sa propre session GPS", async () => {
    const stockage = new StockageSessionMemoire();
    const service = new PartagePositionService(stockage);
    const controller = new PartagePositionController(service);

    const expiration = new Date(Date.now() + 60 * 60 * 1000);

    const session = await service.demarrerPartage(
        "15",
        true,
        expiration
    );

    const req = creerRequete(
        { sessionId: session.id },
        "15"
    );

    const reponse = creerReponseTest();

    await controller.arreterPartage(req, reponse.res);

    assert.equal(reponse.obtenirStatut(), 200);

    const resultat = reponse.obtenirJson() as {
        success: boolean;
        message: string;
        data: SessionPartagePosition;
    };

    assert.equal(resultat.success, true);
    assert.equal(resultat.message, "Partage de position arrêté.");
    assert.equal(resultat.data.statut, "arretee");

    assert.ok(resultat.data.dateFin instanceof Date);

    const sessionEnregistree = await stockage.trouverParId(
        session.id
    );

    if (sessionEnregistree === null) {
        throw new Error("La session GPS est introuvable.");
    }

    assert.equal(sessionEnregistree.statut, "arretee");
});

// TEST 5 - REFUSER L'ARRET SANS AUTHENTIFICATION

test("HTTP 401 - Refuser l'arrêt GPS sans authentification", async () => {
    const stockage = new StockageSessionMemoire();
    const service = new PartagePositionService(stockage);
    const controller = new PartagePositionController(service);

    const expiration = new Date(Date.now() + 60 * 60 * 1000);

    const session = await service.demarrerPartage(
        "15",
        true,
        expiration
    );

    const req = creerRequete({
        sessionId: session.id
    });

    const reponse = creerReponseTest();

    await controller.arreterPartage(req, reponse.res);

    assert.equal(reponse.obtenirStatut(), 401);

    assert.deepEqual(reponse.obtenirJson(), {
        success: false,
        message: "Authentification requise."
    });

    const sessionEnregistree = await stockage.trouverParId(
        session.id
    );

    assert.equal(sessionEnregistree?.statut, "active");
});

// TEST 6 - REFUSER L'ARRET SANS IDENTIFIANT DE SESSION

test("HTTP 400 - Refuser l'arrêt sans identifiant de session", async () => {
    const stockage = new StockageSessionMemoire();
    const service = new PartagePositionService(stockage);
    const controller = new PartagePositionController(service);

    const req = creerRequete({}, "15");

    const reponse = creerReponseTest();

    await controller.arreterPartage(req, reponse.res);

    assert.equal(reponse.obtenirStatut(), 400);

    assert.deepEqual(reponse.obtenirJson(), {
        success: false,
        message: "Identifiant de session invalide."
    });

    assert.equal(stockage.nombreSessions(), 0);
});

// TEST 7 - REFUSER L'ARRET DE LA SESSION D'UN AUTRE VOYAGEUR

test("HTTP 403 - Refuser l'arrêt GPS d'un autre voyageur", async () => {
    const stockage = new StockageSessionMemoire();
    const service = new PartagePositionService(stockage);
    const controller = new PartagePositionController(service);

    const expiration = new Date(Date.now() + 60 * 60 * 1000);

    const session = await service.demarrerPartage(
        "15",
        true,
        expiration
    );

    const req = creerRequete(
        { sessionId: session.id },
        "20"
    );

    const reponse = creerReponseTest();

    await controller.arreterPartage(req, reponse.res);

    assert.equal(reponse.obtenirStatut(), 403);

    assert.deepEqual(reponse.obtenirJson(), {
        success: false,
        message: "Accès non autorisé à cette session."
    });

    const sessionEnregistree = await stockage.trouverParId(
        session.id
    );

    assert.equal(sessionEnregistree?.statut, "active");
});

// TEST 8 - REFUSER L'ARRET D'UNE SESSION INEXISTANTE

test("HTTP 404 - Refuser l'arrêt d'une session inexistante", async () => {
    const stockage = new StockageSessionMemoire();
    const service = new PartagePositionService(stockage);
    const controller = new PartagePositionController(service);

    const req = creerRequete(
        { sessionId: "session-inexistante" },
        "15"
    );

    const reponse = creerReponseTest();

    await controller.arreterPartage(req, reponse.res);

    assert.equal(reponse.obtenirStatut(), 404);

    assert.deepEqual(reponse.obtenirJson(), {
        success: false,
        message: "Session de partage introuvable."
    });

    assert.equal(stockage.nombreSessions(), 0);
});

// TEST 9 - REFUSER L'ARRET D'UNE SESSION DEJA ARRETEE

test("HTTP 409 - Refuser l'arrêt d'une session déjà arrêtée", async () => {
    const stockage = new StockageSessionMemoire();
    const service = new PartagePositionService(stockage);
    const controller = new PartagePositionController(service);

    const expiration = new Date(Date.now() + 60 * 60 * 1000);

    const session = await service.demarrerPartage(
        "15",
        true,
        expiration
    );

    await service.arreterPartage(session.id, "15");

    const req = creerRequete(
        { sessionId: session.id },
        "15"
    );

    const reponse = creerReponseTest();

    await controller.arreterPartage(req, reponse.res);

    assert.equal(reponse.obtenirStatut(), 409);

    assert.deepEqual(reponse.obtenirJson(), {
        success: false,
        message: "Cette session est déjà arrêtée."
    });

    const sessionEnregistree = await stockage.trouverParId(
        session.id
    );

    assert.equal(sessionEnregistree?.statut, "arretee");
});

// TEST 10 - REFUSER L'ARRET D'UNE SESSION EXPIREE

test("HTTP 409 - Refuser l'arrêt d'une session expirée", async () => {
    const stockage = new StockageSessionMemoire();
    const service = new PartagePositionService(stockage);
    const controller = new PartagePositionController(service);

    const expiration = new Date(Date.now() + 60 * 60 * 1000);

    const session = await service.demarrerPartage(
        "15",
        true,
        expiration
    );

    await stockage.modifier({
        ...session,
        statut: "expiree",
        dateFin: new Date()
    });

    const req = creerRequete(
        { sessionId: session.id },
        "15"
    );

    const reponse = creerReponseTest();

    await controller.arreterPartage(req, reponse.res);

    assert.equal(reponse.obtenirStatut(), 409);

    assert.deepEqual(reponse.obtenirJson(), {
        success: false,
        message: "Cette session a expiré."
    });

    const sessionEnregistree = await stockage.trouverParId(
        session.id
    );

    assert.equal(sessionEnregistree?.statut, "expiree");
});

// TEST 11 - IGNORER UN COMPTEID FOURNI DANS LE CORPS HTTP

test("HTTP 401 - Ignorer un compteId fourni dans le corps HTTP", async () => {
    const stockage = new StockageSessionMemoire();
    const service = new PartagePositionService(stockage);
    const controller = new PartagePositionController(service);

    // Le compteId est fourni par le client, pas par l'authentification.
    const req = creerRequete({
        compteId: 15,
        consentement: true
    });

    const reponse = creerReponseTest();

    await controller.demarrerPartage(req, reponse.res);

    assert.equal(reponse.obtenirStatut(), 401);

    assert.deepEqual(reponse.obtenirJson(), {
        success: false,
        message: "Authentification requise."
    });

    assert.equal(stockage.nombreSessions(), 0);
});