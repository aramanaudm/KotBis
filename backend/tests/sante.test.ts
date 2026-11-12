import test from "node:test";
import assert from "node:assert/strict";

test("GET /api/sante retourne HTTP 200 et le bon JSON", async () => {
    const reponse = await fetch("http://localhost:3000/api/sante");

    assert.equal(reponse.status, 200);

    const donnees = await reponse.json();

    assert.equal(donnees.statut, "OK");
    assert.equal(donnees.service, "KotBis Back-End");
    assert.ok(donnees.horodatage);
    assert.ok(!Number.isNaN(Date.parse(donnees.horodatage)));
});