import test from "node:test";
import assert from "node:assert/strict";
import { listContributorSelection, normalizeContributorSearch } from "../src/services/fandraisanAnjaraSelection.service.js";
import { searchFandraisanAnjaraContributors } from "../src/controllers/fandraisanAnjara.controller.js";
import { runWithDatabaseClient } from "../src/config/db.js";
import router from "../src/routes/fandraisanAnjara.routes.js";

const id = "11111111-1111-4111-8111-111111111111";
const response = () => ({ statusCode: 200, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } });
function db(rows = []) {
  return { calls: [], async query(sql, params) { this.calls.push({ sql, params }); return { rows }; } };
}

for (const type of ["RAZAMBE", "TARANAKA", "SAMPANA", "FOYER", "PERSONNE"]) {
  test(`${type}: recherche accentuée paramétrée, deux noms similaires et identifiants préservés`, async () => {
    const rows = [{ id, libelle: "Rabe José" }, { id: "22222222-2222-4222-8222-222222222222", libelle: "Rabe Josette" }];
    const client = db(rows);
    const result = await listContributorSelection({ type, recherche: " RABÉ José " }, client);
    assert.deepEqual(result.contributeurs, rows);
    const { sql, params } = client.calls[0];
    assert.match(sql, /normalize\(libelle, NFD\)/);
    assert.match(sql, /regexp_replace/);
    assert.match(sql, /ORDER BY .*?, id/s);
    assert.deepEqual(params.slice(-4), ["rabe", "jose", 21, 0]);
    if (["RAZAMBE", "TARANAKA", "SAMPANA"].includes(type)) {
      assert.match(sql, /te.code = \$1/); assert.equal(params[0], type);
    }
    if (type === "FOYER") {
      assert.match(sql, /f.statut = 'ACTIF'/);
      assert.match(sql, /f.type_foyer IN \('COUPLE', 'MONOPARENTAL'\)/);
      assert.match(sql, /p2.id IS NOT NULL/);
    }
    assert.doesNotMatch(sql, /INSERT|UPDATE|DELETE|CREATE /);
  });
  test(`${type}: liste volumineuse bornée à 20, page suivante et absence de résultat`, async () => {
    const client = db(Array.from({ length: 21 }, (_, n) => ({ id: `${id}-${n}`, libelle: `Rabe ${n}` })));
    const result = await listContributorSelection({ type, page: 250 }, client);
    assert.equal(result.contributeurs.length, 20);
    assert.deepEqual(result.pagination, { page: 250, limit: 20, has_more: true });
    assert.deepEqual(client.calls[0].params.slice(-2), [21, 4980]);
    assert.match(client.calls[0].sql, /LIMIT \$\d+ OFFSET \$\d+/);
    const empty = await listContributorSelection({ type, recherche: "introuvable" }, db());
    assert.deepEqual(empty.contributeurs, []); assert.equal(empty.pagination.has_more, false);
  });
}

test("normalisation majuscules, accents composés / décomposés, ligatures", () => {
  assert.equal(normalizeContributorSearch(" ÉLÈNE Jose\u0301 Œ Æ "), "elene jose oe ae");
});
test("joker SQL et apostrophe restent des valeurs littérales paramétrées", async () => {
  const client = db();
  await listContributorSelection({ type: "PERSONNE", recherche: "D'André %_\\" }, client);
  assert.deepEqual(client.calls[0].params, ["d'andre", "\\%\\_\\\\", 21, 0]);
  assert.doesNotMatch(client.calls[0].sql, /d'andre/);
});
test("restauration du libellé par identifiant exact", async () => {
  const client = db([{ id, libelle: "Rabe José" }]);
  await listContributorSelection({ type: "PERSONNE", id }, client);
  assert.match(client.calls[0].sql, /id = \$1::uuid/);
  assert.deepEqual(client.calls[0].params, [id, 21, 0]);
});
test("paramètres invalides refusés avant toute requête", async () => {
  for (const query of [{}, { type: "INCONNU" }, { type: "PERSONNE", page: 0 }, { type: "PERSONNE", page: 1.5 }, { type: "PERSONNE", page: 1000001 }, { type: "PERSONNE", id: "bad" }, { type: "PERSONNE", recherche: ["x"] }, { type: "PERSONNE", recherche: "x".repeat(101) }]) {
    const client = db();
    await assert.rejects(listContributorSelection(query, client), { code: "FANDRAISAN_ANJARA_INVALID" });
    assert.equal(client.calls.length, 0);
  }
});
test("route en lecture seule protégée comme la création, contrôleur et erreur 400", async () => {
  const route = router.stack.find(layer => layer.route?.path === "/contributeurs/selection").route;
  assert.deepEqual(Object.keys(route.methods), ["get"]);
  const [auth, role, handler] = route.stack.map(layer => layer.handle);
  assert.equal(handler, searchFandraisanAnjaraContributors);
  const unauth = response(); await auth({ headers: {} }, unauth, () => assert.fail()); assert.equal(unauth.statusCode, 401);
  const forbidden = response(); role({ auth: { compte: { role: "MEMBRE" } } }, forbidden, () => assert.fail()); assert.equal(forbidden.statusCode, 403);
  for (const allowed of ["ADMIN", "PASTEUR", "BUREAU_ZANAKA_AMPIELEZANA"]) {
    let passed = false; role({ auth: { compte: { role: allowed } } }, response(), () => { passed = true; }); assert.equal(passed, true);
  }
  const ok = response();
  await runWithDatabaseClient(db([{ id, libelle: "Rabe José" }]), () => handler({ query: { type: "PERSONNE" } }, ok));
  assert.equal(ok.body.success, true); assert.equal(ok.body.data.contributeurs[0].id, id);
  const invalid = response(); await handler({ query: { type: "bad" } }, invalid); assert.equal(invalid.statusCode, 400);
});
