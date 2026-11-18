// KBE-45 : quota visiteur avec PostgreSQL.
// Exécuté seulement avec KOTBIS_TEST_DB=1, et ignoré tant que l'équipe BO/BDD
// n'a pas créé la table `quotas_visiteurs`.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { fermerConnexionBdd, obtenirPool } from "../../src/configuration/baseDeDonnees";
import { DepotQuotaVisiteursPostgres } from "../../src/trajets/quota-visiteur.depot.postgres";
import { ServiceQuotaVisiteur } from "../../src/trajets/quota-visiteur.service";

if (process.env.KOTBIS_TEST_DB === "1") {
  describe("KBE-45 quota visiteur avec PostgreSQL", () => {
    const depot = new DepotQuotaVisiteursPostgres(obtenirPool);
    // IP fictive propre à cette exécution, pour ne pas dépendre d'autres lignes.
    const ip = `test-kbe45-${Date.now()}`;
    const service = new ServiceQuotaVisiteur(depot, {
      secretEmpreinteIp: "secret-test-integration",
      plafondJetonsParIp: 2
    });
    const jetonsCrees: string[] = [];
    let tablePresente = false;

    before(async () => {
      const resultat = await obtenirPool().query<{ table: string | null }>(
        "SELECT to_regclass('public.quotas_visiteurs')::text AS table"
      );
      tablePresente = resultat.rows[0].table !== null;
    });

    after(async () => {
      if (tablePresente && jetonsCrees.length > 0) {
        await obtenirPool().query("DELETE FROM quotas_visiteurs WHERE id = ANY($1::uuid[])", [jetonsCrees]);
      }
      await fermerConnexionBdd();
    });

    it("compte 10 recherches, refuse la onzième et rend une recherche non aboutie", async (t) => {
      if (!tablePresente) {
        t.skip("table quotas_visiteurs absente : en attente de la migration BO/BDD");
        return;
      }

      const premiere = await service.reserver(undefined, ip);
      jetonsCrees.push(premiere.jeton);
      assert.equal(premiere.nouveauJeton, true);
      assert.equal(premiere.restant, 9);

      for (let i = 2; i <= 10; i += 1) {
        await service.reserver(premiere.jeton, ip);
      }
      await assert.rejects(service.reserver(premiere.jeton, ip), { code: "QUOTA_VISITEUR_ATTEINT" });

      await service.rendre(premiere.jeton);
      const apresRestitution = await service.reserver(premiere.jeton, ip);
      assert.equal(apresRestitution.restant, 0);

      const ligne = await obtenirPool().query<{ empreinte_ip: string }>(
        "SELECT empreinte_ip FROM quotas_visiteurs WHERE id = $1",
        [premiere.jeton]
      );
      assert.notEqual(ligne.rows[0].empreinte_ip, ip);
    });

    it("refuse les réservations simultanées au-delà de la limite", async (t) => {
      if (!tablePresente) {
        t.skip("table quotas_visiteurs absente : en attente de la migration BO/BDD");
        return;
      }

      const { jeton } = await service.reserver(undefined, ip);
      jetonsCrees.push(jeton);
      const resultats = await Promise.allSettled(
        Array.from({ length: 15 }, () => service.reserver(jeton, ip))
      );
      // 1 recherche déjà réservée + 9 acceptées = 10 ; les 6 autres sont refusées.
      assert.equal(resultats.filter((r) => r.status === "fulfilled").length, 9);
      const compteur = await obtenirPool().query<{ nombre_recherches: number }>(
        "SELECT nombre_recherches FROM quotas_visiteurs WHERE id = $1",
        [jeton]
      );
      assert.equal(compteur.rows[0].nombre_recherches, 10);
    });

    it("plafonne les nouveaux jetons par IP", async (t) => {
      if (!tablePresente) {
        t.skip("table quotas_visiteurs absente : en attente de la migration BO/BDD");
        return;
      }
      // Les deux tests précédents ont déjà émis 2 jetons pour cette IP.
      await assert.rejects(service.reserver(undefined, ip), { code: "TROP_DE_JETONS_VISITEUR" });
    });
  });
}
