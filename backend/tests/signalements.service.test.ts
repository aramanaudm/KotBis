import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { ServiceSignalements } from "../src/signalements/signalements.service";
import { validerCreationSignalement } from "../src/signalements/signalements.validation";
import { FauxDepotSignalements } from "./aides/fauxDepotSignalements";

const MAINTENANT = new Date("2026-11-19T10:00:00.000Z");

function corpsValide(surcharges: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    busId: "1",
    categorie: "c3",
    commentaire: "Panne moteur constatée à l'arrêt.",
    observeLe: "2026-11-19T09:00:00.000Z",
    cleIdempotence: randomUUID(),
    ...surcharges
  };
}

describe("ServiceSignalements", () => {
  it("crée un signalement avec le statut initial et les dates distinctes", async () => {
    const depot = new FauxDepotSignalements();
    const service = new ServiceSignalements(depot);

    const resultat = await service.creer(
      "7",
      validerCreationSignalement(corpsValide()),
      MAINTENANT
    );

    assert.equal(resultat.cree, true);
    assert.equal(resultat.signalement.auteurId, "7");
    assert.equal(resultat.signalement.statut, "a_verifier");
    assert.equal(resultat.signalement.type, "en_panne");
    assert.equal(resultat.signalement.observeLe, "2026-11-19T09:00:00.000Z");
    assert.equal(resultat.signalement.recuLe, MAINTENANT.toISOString());
    assert.equal(resultat.signalement.version, 1);
  });

  it("retourne le signalement existant pour la même clé d'idempotence", async () => {
    const depot = new FauxDepotSignalements();
    const service = new ServiceSignalements(depot);
    const donnees = validerCreationSignalement(corpsValide());

    const premier = await service.creer("7", donnees, MAINTENANT);
    const second = await service.creer("7", donnees, new Date(MAINTENANT.getTime() + 5000));

    assert.equal(premier.cree, true);
    assert.equal(second.cree, false);
    assert.equal(second.signalement.reference, premier.signalement.reference);
    assert.equal(depot.signalements.length, 1);
  });

  it("refuse une date d'observation dans le futur", async () => {
    const depot = new FauxDepotSignalements();
    const service = new ServiceSignalements(depot);
    const donnees = validerCreationSignalement(
      corpsValide({ observeLe: "2026-11-19T10:00:01.000Z" })
    );

    await assert.rejects(service.creer("7", donnees, MAINTENANT), {
      code: "DATE_OBSERVATION_FUTURE"
    });
    assert.equal(depot.signalements.length, 0);
  });
});
