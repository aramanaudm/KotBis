// Tests d'intégration du dépôt PostgreSQL des favoris (KBE-40, table favoris de KB-48).
// Lancement : KOTBIS_TEST_DB=1 npm run test:integration
// Tout se passe dans une transaction annulée à la fin : aucune donnée n'est laissée en base.
// Ignorés si la table favoris est absente ou s'il manque deux voyageurs et deux arrêts.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Pool, PoolClient } from "pg";
import { fermerConnexionBdd, obtenirPool } from "../../src/configuration/baseDeDonnees";
import { FavoriExistantErreur } from "../../src/favoris/favoris.depot";
import { DepotFavorisPostgres } from "../../src/favoris/favoris.depot.postgres";
import { ReferentielReseauPostgres } from "../../src/favoris/reseau.referentiel.postgres";

if (process.env.KOTBIS_TEST_DB === "1") {
  describe("KBE-40 dépôt PostgreSQL des favoris", () => {
    let client: PoolClient;
    let depot: DepotFavorisPostgres;
    let pret = false;
    let alice = 0;
    let bob = 0;
    let arretA = 0;
    let arretB = 0;

    before(async () => {
      client = await obtenirPool().connect();
      await client.query("BEGIN");
      // Le dépôt utilise la connexion de la transaction (même méthode query que le pool)
      depot = new DepotFavorisPostgres(() => client as unknown as Pool);

      const { rows: table } = await client.query("SELECT to_regclass('public.favoris') IS NOT NULL AS existe");
      const { rows: voyageurs } = await client.query("SELECT compte_id FROM voyageurs ORDER BY compte_id LIMIT 2");
      const { rows: arrets } = await client.query("SELECT id FROM arrets ORDER BY id LIMIT 2");
      if (table[0].existe && voyageurs.length === 2 && arrets.length === 2) {
        [alice, bob] = voyageurs.map((v) => Number(v.compte_id));
        [arretA, arretB] = arrets.map((a) => Number(a.id));
        pret = true;
      }
    });

    after(async () => {
      await client.query("ROLLBACK");
      client.release();
      await fermerConnexionBdd();
    });

    it("ajoute, liste, compte et supprime (EF-FAV-001, 002, 004)", async (t) => {
      if (!pret) return t.skip("table favoris ou données de base absentes");
      const trajet = await depot.ajouter(alice, {
        type: "trajet",
        arretDepartId: arretA,
        arretArriveeId: arretB,
        libelle: "Travail"
      });
      assert.ok(trajet.id > 0);
      assert.equal(trajet.voyageurId, alice);
      assert.equal(trajet.arretDepartId, arretA);
      assert.ok(trajet.creeLe instanceof Date);

      const destination = await depot.ajouter(alice, {
        type: "destination",
        arretDepartId: null,
        arretArriveeId: arretB,
        libelle: null
      });
      assert.equal(destination.arretDepartId, null);

      const liste = await depot.lister(alice);
      assert.deepEqual(liste.slice(0, 2).map((f) => f.id), [destination.id, trajet.id]);
      assert.ok((await depot.compter(alice)) >= 2);

      assert.equal(await depot.supprimer(alice, trajet.id), true);
      assert.equal(await depot.supprimer(alice, trajet.id), false);
    });

    it("refuse un doublon, y compris pour une destination sans départ (EF-FAV-005)", async (t) => {
      if (!pret) return t.skip("table favoris ou données de base absentes");
      const nouveau = { type: "destination" as const, arretDepartId: null, arretArriveeId: arretA, libelle: null };
      await client.query("SAVEPOINT doublon");
      await depot.ajouter(alice, nouveau);
      await assert.rejects(depot.ajouter(alice, { ...nouveau, libelle: "Autre" }), FavoriExistantErreur);
      await client.query("ROLLBACK TO SAVEPOINT doublon");
    });

    it("ne liste ni ne supprime le favori d'un autre voyageur (CA-031)", async (t) => {
      if (!pret) return t.skip("table favoris ou données de base absentes");
      const favori = await depot.ajouter(alice, {
        type: "trajet",
        arretDepartId: arretB,
        arretArriveeId: arretA,
        libelle: null
      });
      assert.ok(!(await depot.lister(bob)).some((f) => f.id === favori.id));
      assert.equal(await depot.supprimer(bob, favori.id), false);
      assert.ok((await depot.lister(alice)).some((f) => f.id === favori.id));
    });

    it("propose les trajets de la table trajets, avec premier et dernier arrêt", async (t) => {
      const reseau = new ReferentielReseauPostgres();
      const trajets = await reseau.rechercherTrajets(null, 5);
      if (trajets.length === 0) return t.skip("aucun trajet actif en base");
      assert.ok(trajets.length <= 5);
      for (const trajet of trajets) {
        assert.ok(trajet.trajetId > 0 && trajet.nom.length > 0);
        assert.notEqual(trajet.depart.id, trajet.arrivee.id);
      }
      const [premier] = trajets;
      const filtres = await reseau.rechercherTrajets(premier.ligne, 20);
      assert.ok(filtres.some((x) => x.trajetId === premier.trajetId));
      // % est cherché comme un caractère, pas comme un joker
      assert.equal((await reseau.rechercherTrajets("%%%", 20)).length, 0);
    });
  });
}
