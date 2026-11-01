import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import pg from "pg";
import { createApp } from "../src/app.js";
import { runWithDatabaseClient } from "../src/config/db.js";
import { setAuthSessionCookies } from "../src/config/authCookies.js";
import { sendInformationError } from "../src/controllers/demandeInformation.controller.js";

// Never load .env here. All remote services and database access are intercepted.
process.env.NODE_ENV = "development";
process.env.FRONTEND_URL = "http://localhost:5173";
process.env.AUTH_COOKIE_SECURE = "false";
process.env.DEMANDE_INFORMATION_SECRET = "local-http-test-secret-never-use-in-real-environment";
process.env.SUPABASE_URL = "https://auth.pitikorana.invalid";
process.env.SUPABASE_ANON_KEY = "test-placeholder-not-a-real-key";
delete process.env.DATABASE_URL;
const originalConnect = pg.Pool.prototype.connect;
const originalQuery = pg.Pool.prototype.query;
pg.Pool.prototype.connect = () => { throw new Error("REAL_DATABASE_ACCESS_FORBIDDEN_IN_TEST"); };
pg.Pool.prototype.query = () => { throw new Error("REAL_DATABASE_ACCESS_FORBIDDEN_IN_TEST"); };
const realFetch = globalThis.fetch;
const roles = ["ADMIN", "PASTEUR", "MEMBRE", "BUREAU_ZANAKA_AMPIELEZANA"];
const users = roles.map((role, n) => ({ role, userId: `20000000-0000-4000-8000-${String(n+1).padStart(12,"0")}`, accountId: `10000000-0000-4000-8000-${String(n+1).padStart(12,"0")}`, personId: `30000000-0000-4000-8000-${String(n+1).padStart(12,"0")}`, token: `test-token-${role}` }));
let providerChecks = 0;
globalThis.fetch = async (input, options) => {
  const target = new URL(input instanceof Request ? input.url : String(input));
  if (["127.0.0.1", "localhost", "[::1]"].includes(target.hostname)) return realFetch(input, options);
  assert.equal(target.origin, "https://auth.pitikorana.invalid", "unexpected external request blocked");
  assert.equal(target.pathname, "/auth/v1/user");
  providerChecks++;
  const token = new Headers(options?.headers ?? (input instanceof Request ? input.headers : undefined)).get("Authorization")?.replace(/^Bearer /i, "");
  const user = users.find(u => u.token === token);
  return new Response(JSON.stringify(user ? { id: user.userId, aud: "authenticated", role: "authenticated", email: "test@example.invalid", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" } : { message: "Invalid token" }), { status: user ? 200 : 401, headers: { "Content-Type": "application/json" } });
};

const normalize = value => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
function memoryDatabase() {
  const records = new Map(); const quotas = new Map(); const statements = []; let snapshot;
  const filtered = (sql, params) => {
    let list = [...records.values()]; let start = 0;
    if (/WHERE statut = \$1/.test(sql)) { list = list.filter(r => r.statut === params[0]); start = 1; }
    const searchParams = /LIMIT \$/.test(sql) ? params.slice(start, -2) : params.slice(start);
    for (const word of searchParams) list = list.filter(r => normalize(`${r.nom} ${r.prenom} ${r.contact}`).includes(String(word).replace(/\\([\\%_])/g,"$1")));
    return list.sort((a,b) => b.date_creation.localeCompare(a.date_creation) || b.id.localeCompare(a.id));
  };
  return {
    records, quotas, statements,
    async query(sql, params = []) {
      statements.push(sql);
      assert.doesNotMatch(sql, /pg_advisory/);
      if (sql === "BEGIN") { snapshot={records:new Map([...records].map(([key,row])=>[key,{...row}])),quotas:new Map(quotas)};return {rows:[]}; }
      if (sql === "COMMIT") {snapshot=undefined;return {rows:[]};}
      if (sql === "ROLLBACK") {if(snapshot){records.clear();snapshot.records.forEach((value,key)=>records.set(key,value));quotas.clear();snapshot.quotas.forEach((value,key)=>quotas.set(key,value));snapshot=undefined;}return {rows:[]};}
      if (sql.includes("FROM compte_membre cm")) {
        const user = users.find(u => u.userId === params[0]);
        return { rows: user ? [{ id: user.accountId, id_personne: user.personId, code_role: user.role, code_statut_compte: "ACTIF", nom: "ProfilTest", prenom: user.role, nom_usage: null }] : [] };
      }
      if (sql.startsWith("INSERT INTO demande_information_quota")) {
        const key = `${params[0]}:${+params[1]}`; const current = quotas.get(key) ?? 0;
        if (current >= params[3]) return { rows: [] };
        quotas.set(key,current+1);return { rows: [{ nombre: current+1 }] };
      }
      if (sql.startsWith("DELETE FROM demande_information_quota")) return { rows: [] };
      if (sql.startsWith("INSERT INTO demande_information")) {
        if (records.has(params[7])) return { rows: [] };
        const now = new Date().toISOString();
        records.set(params[7],{ id:params[0],nom:params[1],prenom:params[2],contact:params[3],message:params[4],origine:params[5],id_compte_membre:params[6],empreinte_contenu:params[8],statut:"NOUVELLE",revision:1,date_creation:now,date_modification:now });
        return { rows: [{ id:params[0] }] };
      }
      if (sql.startsWith("SELECT empreinte_contenu")) return { rows: records.has(params[0]) ? [{ empreinte_contenu:records.get(params[0]).empreinte_contenu }] : [] };
      if (sql.startsWith("SELECT count(*)::integer AS nouvelles")) return { rows:[{ nouvelles:[...records.values()].filter(r=>r.statut==="NOUVELLE").length }] };
      if (sql.startsWith("SELECT count(*)::integer AS total")) return { rows:[{total:filtered(sql,params).length}] };
      if (sql.startsWith("UPDATE demande_information")) {
        const row=[...records.values()].find(r=>r.id===params[2]);
        if(!row||row.revision!==params[3])return {rows:[]};
        Object.assign(row,{statut:params[0],revision:row.revision+1,date_modification:new Date().toISOString()});return {rows:[{...row}]};
      }
      if (sql.startsWith("SELECT id, nom")) {
        if (sql.includes("WHERE id = $1")) { const row=[...records.values()].find(r=>r.id===params[0]);return {rows:row?[{...row}]:[]}; }
        const list=filtered(sql,params);const limit=params.at(-2);const offset=params.at(-1);
        return {rows:list.slice(offset,offset+limit).map(({message,empreinte_contenu,id_compte_membre,...row})=>{void message;void empreinte_contenu;void id_compte_membre;return row})};
      }
      throw new Error("Unrecognized simulated statement");
    },
  };
}

test("HTTP local: Node, CORS, vrais middlewares de session/rôle, API du module et base simulée", async t => {
  const db=memoryDatabase();const app=express();
  app.use((req,res,next)=>runWithDatabaseClient(db,next));
  // This fixture-only endpoint uses the existing cookie helper. It is never
  // added to production routes or backed by a real account.
  app.get("/__fixture/session/:role",(req,res)=>{
    const user=users.find(u=>u.role===req.params.role);assert.ok(user);
    setAuthSessionCookies(res,{access_token:user.token,refresh_token:"fake-refresh-token",expires_in:3600});res.json({success:true});
  });
  app.use(createApp());
  const server=app.listen(0,"127.0.0.1");await once(server,"listening");
  const root=`http://127.0.0.1:${server.address().port}`;const base=root+"/api/demandes-information";
  const origin={Origin:process.env.FRONTEND_URL};const cookies={};let visitorId;let memberId;
  const body={nom:"TESTLOCAL",prenom:"José",contact:"visiteur@example.invalid",message:"Demande fictive pour les tests locaux."};
  const ticket=async()=>{const r=await fetch(base+"/preparation",{headers:origin});assert.equal(r.status,200);return (await r.json()).data;};
  const send=async(input,prepared,cookie)=>fetch(base,{method:"POST",headers:{...origin,"Content-Type":"application/json","Idempotency-Key":prepared.key,...(cookie?{Cookie:cookie}:{})},body:JSON.stringify({...input,token:prepared.token})});
  try {
    await t.test("démarrage Node et réponse racine sans connexion PostgreSQL",async()=>{
      const before=db.statements.length;const response=await fetch(root);assert.equal(response.status,200);assert.equal((await response.json()).success,true);assert.equal(db.statements.length,before);
      const sharp=await import("sharp");assert.equal(typeof sharp.default,"function");
    });
    await t.test("CORS, prérequête et en-tête d'idempotence",async()=>{
      const response=await fetch(base,{method:"OPTIONS",headers:{...origin,"Access-Control-Request-Method":"POST","Access-Control-Request-Headers":"content-type,idempotency-key"}});
      assert.equal(response.status,204);assert.equal(response.headers.get("access-control-allow-origin"),process.env.FRONTEND_URL);assert.equal(response.headers.get("access-control-allow-credentials"),"true");assert.match(response.headers.get("access-control-allow-headers"),/idempotency-key/i);
      assert.equal((await fetch(base,{method:"POST",headers:{Origin:"https://evil.invalid","Content-Type":"application/json"},body:"{}"})).status,403);
    });
    await t.test("visiteur et double envoi: confirmation sans données privées, une seule demande",async()=>{
      const prepared=await ticket();for(let n=0;n<2;n++){const response=await send(body,prepared);assert.equal(response.status,201);assert.deepEqual(await response.json(),{success:true,data:{accepted:true}});}
      assert.equal(db.records.size,1);const row=[...db.records.values()][0];visitorId=row.id;assert.equal(row.origine,"VISITEUR");assert.equal(row.id_compte_membre,null);
    });
    await t.test("cookies HTTP locaux et vérification réelle du middleware avec fournisseur simulé",async()=>{
      for(const role of roles){const response=await fetch(root+"/__fixture/session/"+role);const headers=response.headers.getSetCookie();assert.ok(headers.every(h=>/; HttpOnly/i.test(h)&&/; SameSite=Lax/i.test(h)&&! /; Secure/i.test(h)));cookies[role]=headers.map(h=>h.split(";")[0]).join("; ");
        const me=await fetch(root+"/api/auth/me",{headers:{...origin,Cookie:cookies[role]}});assert.equal(me.status,200);assert.equal((await me.json()).data.compte.role,role);
      }
      assert.ok(providerChecks>=4);
    });
    await t.test("membre connecté: envoi associé au compte du contexte serveur",async()=>{
      const response=await send({...body,prenom:"Membre",contact:"membre@example.invalid"},await ticket(),cookies.MEMBRE);assert.equal(response.status,201);
      const row=[...db.records.values()].find(r=>r.origine==="MEMBRE");memberId=row.id;assert.equal(row.id_compte_membre,users.find(u=>u.role==="MEMBRE").accountId);
    });
    await t.test("session expirée: refus 401 puis envoi visiteur explicite avec la même clé",async()=>{
      const prepared=await ticket();const payload={...body,prenom:"SessionExpiree",contact:"session@example.invalid"};
      assert.equal((await send(payload,prepared,"pitikorana_access_token=expired-test-token")).status,401);
      assert.equal((await send(payload,prepared)).status,201);
      const row=[...db.records.values()].find(r=>r.contact===payload.contact);assert.equal(row.origine,"VISITEUR");assert.equal(row.id_compte_membre,null);
    });
    await t.test("refus backend pour visiteur, membre et bureau, y compris détail/statistiques/statut",async()=>{
      for(const role of [null,"MEMBRE","BUREAU_ZANAKA_AMPIELEZANA"]){const headers={...origin,...(role?{Cookie:cookies[role]}:{})};const expected=role?403:401;
        for(const path of ["","/statistiques","/"+visitorId])assert.equal((await fetch(base+path,{headers})).status,expected);
        assert.equal((await fetch(base+"/"+visitorId+"/statut",{method:"PATCH",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({statut:"TRAITEE",revision:1})})).status,expected);
      }
    });
    await t.test("ADMIN et PASTEUR: recherche, filtre, pagination, détail et trois statuts",async()=>{
      for(const role of ["ADMIN","PASTEUR"]){const headers={...origin,Cookie:cookies[role]};const listed=await fetch(base+"?recherche=Jose&statut=NOUVELLE&page=1&limit=20",{headers});assert.equal(listed.status,200);const list=(await listed.json()).data;assert.equal(list.pagination.page,1);assert.equal(list.pagination.total,1);assert.ok(list.demandes.every(r=>!("message" in r)));
        const detail=await fetch(base+"/"+memberId,{headers});assert.equal(detail.status,200);let row=(await detail.json()).data;
        for(const statut of ["EN_COURS","TRAITEE","NOUVELLE"]){const response=await fetch(base+"/"+memberId+"/statut",{method:"PATCH",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({statut,revision:row.revision})});assert.equal(response.status,200);row=(await response.json()).data;assert.equal(row.statut,statut);}
      }
    });
    await t.test("limitation anti-spam HTTP: refus 429 et Retry-After",async()=>{
      for(let n=0;n<3;n++)assert.equal((await send({...body,contact:"quota@example.invalid"},await ticket())).status,201);
      const before=db.records.size;const response=await send({...body,contact:"quota@example.invalid"},await ticket());assert.equal(response.status,429);assert.equal(db.records.size,before);assert.ok(Number(response.headers.get("retry-after"))>0);assert.equal((await response.json()).code,"INFORMATION_RATE_LIMIT");
    });
    await t.test("absence simulée des tables: erreur d'activation sans fuite SQL",()=>{
      const res={status(n){this.code=n;return this;},json(payload){this.payload=payload;return this;}};
      sendInformationError(res,{code:"42P01",message:'relation "demande_information" does not exist'});assert.equal(res.code,503);assert.equal(res.payload.code,"INFORMATION_SCHEMA_REQUIRED");assert.equal(JSON.stringify(res.payload).includes("relation"),false);
    });
  } finally {
    await new Promise(resolve=>server.close(resolve));globalThis.fetch=realFetch;pg.Pool.prototype.connect=originalConnect;pg.Pool.prototype.query=originalQuery;
  }
});
