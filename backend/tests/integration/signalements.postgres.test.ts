import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { fermerConnexionBdd, obtenirPool } from "../../src/configuration/baseDeDonnees";
import { DepotSignalementsPostgres } from "../../src/signalements/signalements.depot";
import { ServiceSignalements } from "../../src/signalements/signalements.service";
import { validerCreationSignalement } from "../../src/signalements/signalements.validation";

after(async () => {
  await fermerConnexionBdd();
});

test("flux Signalements complet sur PostgreSQL", async () => {
  const pool = obtenirPool();
  const { rows: voyageurs } = await pool.query<{ compte_id: string }>(
    `SELECT v.compte_id
       FROM voyageurs v
       JOIN comptes c ON c.id = v.compte_id
      WHERE c.email = 'voyageur.test@kotbis.fr'
      LIMIT 1`
  );
  assert.ok(voyageurs[0], "Compte voyageur de test introuvable.");

  const plaque = `TEST-${randomUUID().slice(0, 8).toUpperCase()}`;
  const { rows: bus } = await pool.query<{ id: string }>(
    "INSERT INTO bus (plaque, etat, actif) VALUES ($1, 'actif', TRUE) RETURNING id::text AS id",
    [plaque]
  );
  const busId = bus[0].id;

  const depot = new DepotSignalementsPostgres(obtenirPool);
  const service = new ServiceSignalements(depot);
  const donnees = validerCreationSignalement({
    busId,
    categorie: "c3",
    commentaire: "Test intégration signalement.",
    observeLe: new Date(Date.now() - 60000).toISOString(),
    cleIdempotence: randomUUID()
  });

  let reference = "";
  try {
    const creation = await service.creer(voyageurs[0].compte_id, donnees);
    reference = creation.signalement.reference;
    assert.equal(creation.cree, true);
    assert.equal(creation.signalement.statut, "a_verifier");
    assert.equal(creation.signalement.type, "en_panne");

    const doublon = await service.creer(voyageurs[0].compte_id, donnees);
    assert.equal(doublon.cree, false);
    assert.equal(doublon.signalement.reference, reference);

    const personnels = await service.listerParAuteur(voyageurs[0].compte_id);
    assert.ok(personnels.some((item) => item.reference === reference));

    const admin = await service.listerAdmin({ q: reference, statut: null, page: 1, limit: 6 });
    assert.equal(admin.total, 1);
    assert.equal(admin.elements[0].reference, reference);

    const modification = await service.changerStatut(reference, "confirme");
    assert.equal(modification.statut, "confirme");
    assert.equal(modification.version, 2);
  } finally {
    if (reference) {
      await pool.query("UPDATE signalements SET archive_le = now() WHERE reference = $1", [reference]);
    }
    await pool.query("UPDATE bus SET archive_le = now() WHERE id = $1", [busId]);
  }
});
