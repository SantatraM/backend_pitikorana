import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const service = await readFile(new URL("../src/services/personne.service.js", import.meta.url), "utf8");
const controller = await readFile(new URL("../src/controllers/personne.controller.js", import.meta.url), "utf8");
const routes = await readFile(new URL("../src/routes/personnes.routes.js", import.meta.url), "utf8");

assert.match(service, /export async function getPersonnesSansCompte/);
assert.match(service, /NOT EXISTS \(\s*SELECT 1\s*FROM compte_membre cm\s*WHERE cm\.id_personne = p\.id\s*\)/s);
assert.match(service, /LEFT JOIN contacts_personne cp ON cp\.id_personne = p\.id/);
assert.match(service, /p\.nom ILIKE/);
assert.match(service, /cp\.email/);
assert.match(service, /cp\.telephone/);
assert.match(service, /cp\.whatsapp/);
assert.match(service, /\[10, 20, 50\]/);
assert.match(service, /ORDER BY p\.nom ASC, p\.prenom ASC NULLS LAST, p\.id ASC/);
assert.match(service, /total_pages: Math\.ceil\(total \/ limit\)/);
assert.match(controller, /export async function sansCompte/);
assert.match(routes, /r\.get\("\/sans-compte", requireAuth, requireRole\("ADMIN", "PASTEUR"\), sansCompte\)/);
assert.ok(routes.indexOf('r.get("/sans-compte"') < routes.indexOf('r.get("/:id",'), "la route spécialisée doit précéder /:id");

console.log("personnes-sans-compte static checks: OK");
