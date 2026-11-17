// Ce fichier contient les tests du service de partage de position GPS
// de l'application KotBis.
// Il permet de vérifier les règles métier de KBE-32 sans utiliser
// directement PostgreSQL ni dépendre du système d'authentification.

// Importe le module de test intégré à Node.js.
// Il permet de définir et d'exécuter les tests automatiquement.
import test from "node:test";

// Importe les fonctions de vérification utilisées dans les tests.
// Elles permettent de comparer les résultats obtenus aux résultats attendus.
import assert from "node:assert/strict";

// Importe les types nécessaires pour représenter les sessions GPS
// et respecter le contrat de stockage défini dans le module localisation.
import {
    SessionPartagePosition,
    StockageSessionPartage
} from "../src/localisation/partage-position.types";

// Importe le service qui contient les méthodes de démarrage et d'arrêt.
// Ce service sera testé avec un stockage temporaire en mémoire.
import { PartagePositionService } from "../src/localisation/partage-position.service";

// Cette classe simule le stockage des sessions GPS pendant les tests.
// Elle utilise une Map pour associer chaque identifiant de session
// aux informations correspondantes.
// Les données sont conservées uniquement pendant l'exécution des tests.
class StockageSessionMemoire implements StockageSessionPartage {

    // La Map conserve les sessions avec leur identifiant comme clé.
    // Elle permet de retrouver rapidement une session enregistrée.
    private sessions = new Map<string, SessionPartagePosition>();

    // Enregistre une nouvelle session dans la mémoire.
    // Cette méthode simule l'insertion d'une session dans PostgreSQL.
    async creer(session: SessionPartagePosition): Promise<void> {
        this.sessions.set(session.id, { ...session });
    }

    // Recherche une session à partir de son identifiant.
    // Si elle n'existe pas, la méthode retourne null.
    // Une copie est retournée pour éviter de modifier directement
    // les informations conservées dans le stockage.
    async trouverParId(id: string): Promise<SessionPartagePosition | null> {
        const session = this.sessions.get(id);

        return session ? { ...session } : null;
    }

    // Met à jour les informations d'une session existante.
    // Cette méthode permettra notamment de vérifier que le service
    // enregistre correctement l'arrêt du partage GPS.
    async modifier(session: SessionPartagePosition): Promise<void> {
        if (!this.sessions.has(session.id)) {
            throw new Error("Session introuvable dans le stockage.");
        }

        this.sessions.set(session.id, { ...session });
    }

    // Retourne le nombre de sessions actuellement enregistrées.
    // Cette méthode sert uniquement aux tests pour vérifier
    // qu'aucune session n'est créée lorsque le consentement est refusé.
    nombreSessions(): number {
        return this.sessions.size;
    }
}

// Ce test vérifie qu'un voyageur ayant donné son consentement
// peut démarrer une session de partage GPS.
// Il contrôle également que la session est associée au bon compte.
test("Démarrer le partage GPS avec consentement", async () => {

    // Crée un stockage temporaire indépendant pour ce test.
    const stockage = new StockageSessionMemoire();

    // Crée le service de partage GPS avec le stockage temporaire.
    const service = new PartagePositionService(stockage);

    // Définit une date d'expiration future pour la session de test.
    // Cette durée est utilisée uniquement pour le test et ne représente
    // pas une règle définitive de l'application KotBis.
    const expiration = new Date(Date.now() + 60 * 60 * 1000);

    // Simule la demande d'un voyageur connecté dont l'ID est 15.
    // La valeur true indique qu'il accepte explicitement le partage.
    const session = await service.demarrerPartage(
        15,
        true,
        expiration
    );

    // Vérifie que la session appartient au compte 15.
    assert.equal(session.compteId, 15);

    // Vérifie que le statut initial de la session est actif.
    assert.equal(session.statut, "active");

    // Vérifie que la date de fin est vide au démarrage.
    assert.equal(session.dateFin, null);

    // Vérifie que la session possède un identifiant.
    assert.ok(session.id);

    // Recherche la session enregistrée dans le stockage temporaire.
    const sessionEnregistree = await stockage.trouverParId(session.id);

    // Vérifie que la session existe réellement dans le stockage.
    // Si aucune session n'est trouvée, le test échoue immédiatement
    // avec un message permettant de comprendre le problème.
    if (sessionEnregistree === null) {
        throw new Error("La session GPS n'a pas été enregistrée.");
    }

    // Vérifie que la session enregistrée appartient bien au compte 15.
    // Cette vérification est effectuée uniquement après avoir confirmé
    // que la session existe dans le stockage.
    assert.equal(sessionEnregistree.compteId, 15);
});


// Ce test vérifie qu'une session GPS ne peut pas être créée
// lorsque le voyageur n'a pas donné son consentement.
// Cette règle protège la confidentialité des utilisateurs.
test("Refuser le partage GPS sans consentement", async () => {

    // Prépare un stockage temporaire et le service à tester.
    const stockage = new StockageSessionMemoire();
    const service = new PartagePositionService(stockage);

    // Définit une date d'expiration future pour la simulation.
    const expiration = new Date(Date.now() + 60 * 60 * 1000);

    // Vérifie que le service refuse la création de la session
    // lorsque le consentement est false.
    await assert.rejects(
        service.demarrerPartage(15, false, expiration),
        {
            message: "Le consentement au partage GPS est obligatoire."
        }
    );

    // Vérifie qu'aucune session n'a été enregistrée après le refus.
    // Le stockage doit rester vide.
    assert.equal(stockage.nombreSessions(), 0);
});


// Ce test vérifie qu'un voyageur peut arrêter sa propre session GPS.
// Il contrôle que le statut et la date de fin sont correctement enregistrés.
test("Arrêter sa propre session de partage GPS", async () => {

    // Prépare un stockage temporaire et le service à tester.
    const stockage = new StockageSessionMemoire();
    const service = new PartagePositionService(stockage);

    // Définit une expiration future uniquement pour ce test.
    const expiration = new Date(Date.now() + 60 * 60 * 1000);

    // Crée une session active appartenant au compte 15.
    const session = await service.demarrerPartage(15, true, expiration);

    // Simule la demande d'arrêt effectuée par le propriétaire.
    const sessionArretee = await service.arreterPartage(session.id, 15);

    // Vérifie que le statut de la session est devenu "arretee".
    assert.equal(sessionArretee.statut, "arretee");

    // Vérifie que la date de fin a été renseignée.
    assert.ok(sessionArretee.dateFin instanceof Date);

    // Recherche la session pour vérifier que l'arrêt a été enregistré.
    const sessionEnregistree = await stockage.trouverParId(session.id);

    // Le test échoue si la session n'existe plus dans le stockage.
    if (sessionEnregistree === null) {
        throw new Error("La session GPS est introuvable.");
    }

    // Vérifie que le stockage conserve bien le nouveau statut.
    assert.equal(sessionEnregistree.statut, "arretee");

    // Vérifie que la date de fin est également conservée.
    assert.ok(sessionEnregistree.dateFin instanceof Date);
});


// Ce test vérifie qu'un voyageur ne peut pas arrêter
// une session GPS appartenant à un autre compte.
// Cette règle protège les sessions contre les accès non autorisés.
test("Refuser l'arrêt de la session d'un autre voyageur", async () => {

    // Prépare un stockage temporaire et le service.
    const stockage = new StockageSessionMemoire();
    const service = new PartagePositionService(stockage);

    // Définit une expiration future pour la session de test.
    const expiration = new Date(Date.now() + 60 * 60 * 1000);

    // Le compte 15 démarre sa session de partage GPS.
    const session = await service.demarrerPartage(15, true, expiration);

    // Le compte 20 tente d'arrêter la session du compte 15.
    // Le service doit refuser cette opération.
    await assert.rejects(
        service.arreterPartage(session.id, 20),
        {
            message: "Accès non autorisé à cette session."
        }
    );

    // Recherche la session après la tentative non autorisée.
    const sessionEnregistree = await stockage.trouverParId(session.id);

    // Vérifie que la session existe toujours.
    if (sessionEnregistree === null) {
        throw new Error("La session GPS est introuvable.");
    }

    // Vérifie que la tentative n'a pas arrêté le partage.
    assert.equal(sessionEnregistree.statut, "active");
});


// Ce test vérifie qu'une session déjà arrêtée
// ne peut pas être arrêtée une deuxième fois.
// Il évite les modifications inutiles d'une session terminée.
test("Refuser l'arrêt d'une session déjà arrêtée", async () => {

    // Prépare le stockage et le service.
    const stockage = new StockageSessionMemoire();
    const service = new PartagePositionService(stockage);

    // Définit une date d'expiration future pour le test.
    const expiration = new Date(Date.now() + 60 * 60 * 1000);

    // Crée une session appartenant au compte 15.
    const session = await service.demarrerPartage(15, true, expiration);

    // Le propriétaire arrête une première fois sa session.
    await service.arreterPartage(session.id, 15);

    // Vérifie qu'une deuxième demande d'arrêt est refusée.
    await assert.rejects(
        service.arreterPartage(session.id, 15),
        {
            message: "Cette session est déjà arrêtée."
        }
    );

    // Vérifie que le stockage contient toujours une seule session.
    assert.equal(stockage.nombreSessions(), 1);
});


// Vérifie qu'une session ne peut pas être créée
// avec une date d'expiration déjà dépassée.
test("Refuser une date d'expiration passée", async () => {

    // Prépare le stockage temporaire et le service.
    const stockage = new StockageSessionMemoire();
    const service = new PartagePositionService(stockage);

    // Définit une date d'expiration située dans le passé.
    const expiration = new Date(Date.now() - 60 * 1000);

    // Vérifie que le service refuse cette date.
    await assert.rejects(
        service.demarrerPartage(15, true, expiration),
        {
            message: "La date d'expiration doit être valide et future."
        }
    );

    // Vérifie qu'aucune session n'a été enregistrée.
    assert.equal(stockage.nombreSessions(), 0);
});


// Vérifie qu'une session devient expirée
// lorsque sa date d'expiration est dépassée.
test("Enregistrer l'expiration d'une session GPS", async () => {

    // Prépare le stockage temporaire et le service.
    const stockage = new StockageSessionMemoire();
    const service = new PartagePositionService(stockage);

    // Crée une session qui expirera dans 50 millisecondes.
    const expiration = new Date(Date.now() + 50);
    const session = await service.demarrerPartage(15, true, expiration);

    // Attend suffisamment pour dépasser la date d'expiration.
    await new Promise<void>((resolve) => {
        setTimeout(resolve, 100);
    });

    // Demande au service de vérifier l'expiration.
    const sessionExpiree = await service.verifierExpiration(session.id);

    // Vérifie que la session est maintenant expirée.
    assert.equal(sessionExpiree.statut, "expiree");

    // Vérifie que la date de fin correspond à la date d'expiration.
    assert.deepEqual(sessionExpiree.dateFin, expiration);

    // Recherche la session enregistrée dans le stockage.
    const sessionEnregistree = await stockage.trouverParId(session.id);

    if (sessionEnregistree === null) {
        throw new Error("La session GPS est introuvable.");
    }

    // Vérifie que le nouveau statut a bien été enregistré.
    assert.equal(sessionEnregistree.statut, "expiree");
});


// Vérifie qu'une session encore valide
// conserve son statut actif après vérification.
test("Conserver une session GPS non expirée", async () => {

    // Prépare le stockage temporaire et le service.
    const stockage = new StockageSessionMemoire();
    const service = new PartagePositionService(stockage);

    // Définit une expiration dans une heure.
    const expiration = new Date(Date.now() + 60 * 60 * 1000);

    // Crée une session active.
    const session = await service.demarrerPartage(15, true, expiration);

    // Vérifie son expiration avant la date limite.
    const sessionVerifiee = await service.verifierExpiration(session.id);

    // Vérifie que le statut reste actif.
    assert.equal(sessionVerifiee.statut, "active");

    // Vérifie qu'aucune date de fin n'a été enregistrée.
    assert.equal(sessionVerifiee.dateFin, null);
});


// Vérifie qu'une session arrêtée volontairement
// ne devient pas expirée lors d'une vérification ultérieure.
test("Conserver le statut d'une session arrêtée", async () => {

    // Prépare le stockage temporaire et le service.
    const stockage = new StockageSessionMemoire();
    const service = new PartagePositionService(stockage);

    // Définit une expiration dans une heure.
    const expiration = new Date(Date.now() + 60 * 60 * 1000);

    // Crée une session GPS appartenant au compte 15.
    const session = await service.demarrerPartage(15, true, expiration);

    // Le propriétaire arrête volontairement son partage.
    const sessionArretee = await service.arreterPartage(session.id, 15);

    // Vérifie de nouveau la session.
    const sessionVerifiee = await service.verifierExpiration(session.id);

    // Vérifie que le statut reste "arretee".
    assert.equal(sessionVerifiee.statut, "arretee");

    // Vérifie que la date de fin n'a pas été modifiée.
    assert.deepEqual(sessionVerifiee.dateFin, sessionArretee.dateFin);
});