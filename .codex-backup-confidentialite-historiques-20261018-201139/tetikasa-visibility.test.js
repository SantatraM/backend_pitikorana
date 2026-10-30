import test from "node:test";
import assert from "node:assert/strict";
import { runWithDatabaseClient } from "../src/config/db.js";
import { getTetikasaList, getTetikasaById } from "../src/services/tetikasa.service.js";
import { getSosoKevitraById } from "../src/services/sosoKevitra.service.js";
import { getTetikasa } from "../src/controllers/tetikasa.controller.js";

const roles = ["ADMIN", "PASTEUR", "BUREAU_ZANAKA_AMPIELEZANA", "MEMBRE"];
const statuses = ["DRAFITRA", "EN_ATTENTE_VALIDATION", "VALIDE", "REFUSE"];
const auth = (role) => ({ personne: { id: "personne" }, compte: { role } });
const projectId = "11111111-1111-4111-8111-111111111111";
const project = (status) => ({ id: projectId, statut_code: status, created_by_id: "auteur", created_by_nom: "Nom", created_by_prenom: null });

function fakeDb(status = "DRAFITRA") {
  const calls = [];
  return { calls, async query(sql, params = []) {
    calls.push({ sql, params });
    if (sql.includes("FROM tetikasa t") && sql.includes("created_by_nom")) {
      const detail = sql.includes("WHERE t.id = $1");
      const canReadAll = params[detail ? 1 : 0];
      assert.match(sql, detail ? /WHERE t\.id = \$1 AND \(\$2::boolean OR statut\.code = 'VALIDE'\)/ : /WHERE \(\$1::boolean OR statut\.code = 'VALIDE'\)/);
      if (detail) return { rows: canReadAll || status === "VALIDE" ? [project(status)] : [] };
      return { rows: statuses.filter((s) => canReadAll || s === "VALIDE").map(project) };
    }
    if (sql.includes("FROM tetikasa\n")) {
      assert.match(sql, /\$2::boolean OR statut\.code = 'VALIDE'/);
      return { rows: params[1] || status === "VALIDE" ? [{ id: projectId, statut: status }] : [] };
    }
    if (sql.includes("SELECT s.*, statut.code AS statut_code")) return { rows: [{ id: "source", id_auteur: "auteur", statut_code: "ACCEPTE", id_statut_soso_kevitra: "statut" }] };
    if (sql.includes("AS nombre_soutiens")) return { rows: [{ nombre_soutiens: 0, utilisateur_soutient: false }] };
    if (sql.includes("COALESCE(SUM") && sql.includes("AS total")) return { rows: [{ total: "0", total_budget_calcule: "0" }] };
    return { rows: [] };
  } };
}

test("liste filtrée en SQL selon le rôle authentifié", async () => {
  for (const role of [...roles, "INCONNU"]) {
    const db = fakeDb();
    const data = await runWithDatabaseClient(db, () => getTetikasaList(auth(role)));
    assert.deepEqual(data.map((row) => row.statut.code), role === "MEMBRE" || role === "INCONNU" ? ["VALIDE"] : statuses);
    assert.match(db.calls[0].sql, /ORDER BY t\.date_creation DESC, t\.id DESC/);
  }
  await assert.rejects(getTetikasaList({ compte: { role: "ADMIN" } }), { code: "AUTH_REQUIRED" });
});

test("détail et UUID direct : 404 sans lecture des enfants pour les projets cachés", async () => {
  for (const role of roles) for (const status of statuses) {
    const db = fakeDb(status);
    const res = { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
    await runWithDatabaseClient(db, () => getTetikasa({ params: { id: projectId }, auth: auth(role) }, res));
    const visible = role !== "MEMBRE" || status === "VALIDE";
    assert.equal(res.statusCode, visible ? 200 : 404);
    if (!visible) { assert.deepEqual(res.body, { success: false, message: "Tetikasa introuvable" }); assert.equal(db.calls.length, 1); }
  }
  const db = fakeDb("DRAFITRA");
  assert.equal(await runWithDatabaseClient(db, () => getTetikasaById(projectId, auth("MEMBRE"))), null);
});

test("détail Soso-kevitra : projet associé filtré selon le même rôle", async () => {
  for (const role of roles) for (const status of statuses) {
    const db = fakeDb(status);
    const result = await runWithDatabaseClient(db, () => getSosoKevitraById("source", auth(role)));
    assert.deepEqual(result.tetikasa_associe, role !== "MEMBRE" || status === "VALIDE" ? { id: projectId, statut: status } : null);
  }
});
