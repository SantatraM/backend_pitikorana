import test from "node:test";
import assert from "node:assert/strict";
import { listFoyersSelection } from "../src/services/foyer.service.js";
import { selection } from "../src/controllers/foyer.controller.js";
import router from "../src/routes/foyers.routes.js";

const foyerCouple = {
  id: "11111111-1111-4111-8111-111111111111", type_foyer: "COUPLE",
  personne_1_id: "22222222-2222-4222-8222-222222222222", personne_1_nom: "Rabe", personne_1_prenom: "Jean",
  personne_2_id: "33333333-3333-4333-8333-333333333333", personne_2_nom: "Rasoa", personne_2_prenom: "Marie",
};
const foyerMono = {
  id: "44444444-4444-4444-8444-444444444444", type_foyer: "MONOPARENTAL",
  personne_1_id: "22222222-2222-4222-8222-222222222222", personne_1_nom: "Rabe", personne_1_prenom: "Jean",
  personne_2_id: null, personne_2_nom: null, personne_2_prenom: null,
};

function mockDb({ rows = [foyerCouple, foyerMono], total = rows.length } = {}) {
  const calls = [];
  return {
    calls,
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (sql.includes("COUNT(*)::integer AS total")) return { rows: [{ total }] };
      if (sql.includes("ORDER BY p1.nom")) return { rows };
      throw new Error(`Requête inattendue : ${sql}`);
    },
  };
}

test("liste séparément un foyer couple et un foyer monoparental, y compris avec une personne commune", async () => {
  const result = await listFoyersSelection({}, mockDb());
  assert.equal(result.foyers.length, 2);
  assert.deepEqual(result.foyers[0], {
    id: foyerCouple.id, type_foyer: "COUPLE", libelle: "Rabe Jean / Rasoa Marie",
    personnes: [
      { id: foyerCouple.personne_1_id, nom: "Rabe", prenom: "Jean" },
      { id: foyerCouple.personne_2_id, nom: "Rasoa", prenom: "Marie" },
    ],
  });
  assert.deepEqual(result.foyers[1].personnes, [{ id: foyerMono.personne_1_id, nom: "Rabe", prenom: "Jean" }]);
  assert.deepEqual(result.pagination, { page: 1, limit: 20, total: 2, total_pages: 1 });
});

test("recherche et pagination restent paramétrées", async () => {
  const db = mockDb({ rows: [foyerCouple], total: 3 });
  const result = await listFoyersSelection({ recherche: " Rabe ", page: "2", limit: "1" }, db);
  assert.deepEqual(result.pagination, { page: 2, limit: 1, total: 3, total_pages: 3 });
  assert.deepEqual(db.calls[0].params, ["%Rabe%"]);
  assert.deepEqual(db.calls[1].params, ["%Rabe%", 1, 1]);
  assert.match(db.calls[1].sql, /ILIKE \$1/);
});

test("résultat vide et pagination invalide sont traités explicitement", async () => {
  assert.deepEqual(await listFoyersSelection({}, mockDb({ rows: [], total: 0 })), {
    foyers: [], pagination: { page: 1, limit: 20, total: 0, total_pages: 0 },
  });
  for (const query of [{ page: "0" }, { limit: "51" }, { recherche: "x".repeat(101) }]) {
    await assert.rejects(listFoyersSelection(query, mockDb()), { code: "FOYER_SELECTION_INVALID" });
  }
});

test("route GET impose l'authentification et le contrôleur répond selon la convention API", async () => {
  const route = router.stack.find((layer) => layer.route?.path === "/selection").route;
  assert.equal(route.methods.get, true);
  const [requireAuth, controller] = route.stack.map((layer) => layer.handle);
  assert.equal(controller, selection);
  const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
  const unauthenticated = response();
  await requireAuth({ headers: {} }, unauthenticated, () => assert.fail("authentification contournée"));
  assert.equal(unauthenticated.statusCode, 401);
});
