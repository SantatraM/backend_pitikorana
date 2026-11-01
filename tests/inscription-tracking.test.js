import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { generateCodeSuivi, generateReference, normalizeCodeSuivi, hashCodeSuivi, verifyCodeSuivi } from "../src/utils/suiviInscription.js";
import { insertWithUniqueTracking, consumeTrackingQuota, trackingDigest } from "../src/services/inscriptionTracking.service.js";
import { inscriptionTrackingLimit } from "../src/middlewares/inscriptionTracking.middleware.js";
import { runWithDatabaseClient } from "../src/config/db.js";
import { createDemandeInscription, getSuiviDemandeInscription } from "../src/services/demandeInscription.service.js";
import { createDemandesInscriptionRouter } from "../src/routes/demandesInscription.routes.js";
import { readFileSync } from "node:fs";
process.env.INSCRIPTION_TRACKING_SECRET = "test-secret-only-inscription-at-least-32-characters";
delete process.env.DATABASE_URL;
pg.Pool.prototype.query = pg.Pool.prototype.connect = () => { throw new Error("REAL_DATABASE_FORBIDDEN"); };
globalThis.fetch = () => { throw new Error("REMOTE_NETWORK_FORBIDDEN"); };
const reference = "PIT-2026-ABCDEFGH";
const legacy = "ABCD-EFGH-JKLM-NPQR";

test("secure short alphabet, fixed format, reference unchanged", () => {
  const codes = Array.from({length: 3000}, generateCodeSuivi);
  assert(codes.every(code => /^[A-HJ-NP-Z]{3}-[2-9]{5}$/.test(code)));
  assert(codes.some(code => /2/.test(code)) && codes.some(code => /9/.test(code)));
  assert.match(generateReference(), /^PIT-\d{4}-[A-HJ-NP-Z2-9]{8}$/);
  const source = readFileSync(new URL("../src/utils/suiviInscription.js", import.meta.url), "utf8");
  assert.match(source, /randomInt\(letters.length\)/);assert.doesNotMatch(source, /Math.random/);
});
test("short normalization and legacy codes without invalidating hashes", async () => {
  for(const value of ["KRM-58329", "krm58329", " krm-58329 "]) assert.equal(normalizeCodeSuivi(value), "KRM-58329");
  for(const value of [null, "KRM-58320", "IRM-58329", "ORM-58329", "KRM--58329", "KRM 58329", "KRM-12345", "KRM-583299"]) assert.equal(normalizeCodeSuivi(value), null);
  for(const code of ["KRM-58329",legacy]) { const hash = await hashCodeSuivi(code);assert(await verifyCodeSuivi(normalizeCodeSuivi(code.toLowerCase()),hash));assert(!await verifyCodeSuivi("BAD-22222",hash));assert(!hash.includes(code)); }
});
test("creation: code and scrypt verifier, private fingerprint and reference inserted together", async () => {
  const sql=[];const client={query:async(q,p)=>{sql.push([q,p]);return {rows:[]};}};
  let saved;
  const created = await insertWithUniqueTracking(async candidate=>{saved=candidate;return {id:"request-test",reference:candidate.reference};},client);
  assert.match(created.code,/^[A-HJ-NP-Z]{3}-[2-9]{5}$/);assert.equal(created.row.reference,saved.reference);assert(await verifyCodeSuivi(created.code,saved.hash));
  assert.equal(sql[1][1][0],trackingDigest(`code:${created.code}`));assert.equal(sql[1][1][1],"request-test");assert.match(sql.at(-1)[0],/RELEASE SAVEPOINT/);
});
test("reference and code collisions rollback to savepoint before retry", async () => {
  for(const collision of ["demande_inscription_reference_key", "inscription_code_suivi_pkey"]) {
    const commands=[];let count=0;let generated=0;
    const client={query:async sql=>{commands.push(sql);if(sql.startsWith("INSERT")&&collision.endsWith("pkey")&&++count===1)throw Object.assign(new Error("duplicate"),{code:"23505",constraint:collision});return {rows:[]};}};
    let inserts=0;
    const result=await insertWithUniqueTracking(async()=>{if(collision.endsWith("reference_key")&&++inserts===1)throw Object.assign(new Error("duplicate"),{code:"23505",constraint:collision});return{id:"new-request"};},client,()=>({reference,code:++generated===1?"KRM-58329":"ABC-22222"}));
    assert.equal(result.code,"ABC-22222");assert.equal(commands.filter(s=>s.startsWith("ROLLBACK TO")).length,1);assert.equal(commands.filter(s=>s.startsWith("SAVEPOINT")).length,2);
  }
});
test("five attempts maximum, unrelated uniqueness errors are never retried", async () => {
  const client={query:async()=>({rows:[]})};let count=0;
  await assert.rejects(()=>insertWithUniqueTracking(async()=>{count++;throw Object.assign(new Error("collision"),{code:"23505",constraint:"demande_inscription_reference_key"});},client),{code:"TRACKING_GENERATION_FAILED"});assert.equal(count,5);
  count=0;await assert.rejects(()=>insertWithUniqueTracking(async()=>{count++;throw Object.assign(new Error("unrelated"),{code:"23505",constraint:"other_key"});},client),{constraint:"other_key"});assert.equal(count,1);
});
test("tracking requires reference AND code; short, unhyphenated and legacy values", async () => {
  for(const code of ["KRM-58329",legacy]){
    const hash=await hashCodeSuivi(code);let calls=0;
    const client={query:async(sql,p)=>{calls++;assert.match(sql,/WHERE di.reference = \$1/);assert.deepEqual(p,[reference]);return {rows:[{reference,token_suivi_hash:hash,code_statut_demande:"EN_ATTENTE",date_demande:"2026-11-01"}]};}};
    const input=code===legacy?code:code.replace("-","");
    const result=await runWithDatabaseClient(client,()=>getSuiviDemandeInscription(reference,input));assert.equal(result.statut,"EN_ATTENTE");assert(!("token_suivi_hash" in result));assert(!("email" in result));assert(!("code_suivi_empreinte" in result));
    await assert.rejects(()=>runWithDatabaseClient(client,()=>getSuiviDemandeInscription(reference,"ABC-22222")),{code:"SUIVI_INVALID"});
    const before=calls;await assert.rejects(()=>getSuiviDemandeInscription("",input));assert.equal(calls,before);
    const missing={query:async()=>({rows:[]})};await assert.rejects(()=>runWithDatabaseClient(missing,()=>getSuiviDemandeInscription(reference,input)),{code:"SUIVI_INVALID"});
  }
});
test("shared atomic quotas across instances and window reset", async()=>{
  const counters=new Map();const subjects=[];const client={query:async(sql,p)=>{
    if(sql.startsWith("DELETE"))return {rows:[]};assert.match(sql,/ON CONFLICT/);const key=p[0]+p[1].toISOString();subjects.push(p[0]);const count=counters.get(key)??0;if(count>=p[3])return {rows:[]};counters.set(key,count+1);return {rows:[{nombre:count+1}]};
  }};
  const results=await Promise.allSettled(Array.from({length:25},()=>consumeTrackingQuota("reference:"+reference,10,client,1000000)));
  assert.equal(results.filter(r=>r.status==="fulfilled").length,10);assert(results.filter(r=>r.status==="rejected").every(r=>r.reason.status===429&&r.reason.retryAfter>0));
  await consumeTrackingQuota("reference:"+reference,10,client,2000000);assert(subjects.every(s=>/^[a-f0-9]{64}$/.test(s)&&!s.includes(reference)));
});
function response(){return {headers:{},set(k,v){this.headers[k]=v;return this;},status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}};}
test("middleware: both public routes protected, spoofed headers ignored, closed on missing schema/secret", async()=>{
  const router=createDemandesInscriptionRouter();for(const path of ["/suivi","/creer-compte"]){const route=router.stack.find(layer=>layer.route?.path===path);assert.equal(route.route.stack[0].handle,inscriptionTrackingLimit);}
  const observed=[];const client={query:async(sql,p)=>{if(sql.startsWith("INSERT"))observed.push(p[0]);return {rows:[{}]};}};const req={socket:{remoteAddress:"127.0.0.1"},body:{reference},headers:{"x-forwarded-for":"attacker"}};let next=0;
  const res=response();await runWithDatabaseClient(client,()=>inscriptionTrackingLimit(req,res,()=>next++));assert.equal(next,1);assert.equal(res.headers["Cache-Control"],"no-store");assert.equal(observed[0],trackingDigest("quota:network:127.0.0.1"));
  for(const error of [Object.assign(new Error("private table detail"),{code:"42P01"}),Object.assign(new Error("rate"),{code:"TRACKING_RATE_LIMIT",retryAfter:30})]){
    const failing={query:async()=>{throw error;}};const reply=response();await runWithDatabaseClient(failing,()=>inscriptionTrackingLimit(req,reply,()=>assert.fail("must not continue")));assert.equal(reply.statusCode,error.code==="42P01"?503:429);assert(!JSON.stringify(reply.body).includes("private"));if(reply.statusCode===429)assert.equal(reply.headers["Retry-After"],"30");
  }
  const saved=process.env.INSCRIPTION_TRACKING_SECRET;delete process.env.INSCRIPTION_TRACKING_SECRET;assert.throws(()=>trackingDigest("anything"),{code:"TRACKING_UNAVAILABLE"});process.env.INSCRIPTION_TRACKING_SECRET=saved;
});
test("manual SQL: private registry uniqueness, RLS, old requests/hashes not updated",()=>{
  const sql=readFileSync(new URL("../database/25_inscription_code_suivi.sql",import.meta.url),"utf8");assert.match(sql,/empreinte text primary key/);assert.match(sql,/id_demande uuid not null unique references/);assert.match(sql,/revoke all/);assert.equal((sql.match(/enable row level security/g)??[]).length,2);assert.doesNotMatch(sql,/\b(update|delete from|alter table public.demande_inscription)\b/i);
});

test("new member request: real service transaction with fake photo storage and fake SQL",async()=>{
  const path="demandes-inscription/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp";
  process.env.SUPABASE_URL="https://registration-storage.invalid";process.env.SUPABASE_SERVICE_ROLE_KEY="fixture-only";
  const blockedFetch=globalThis.fetch;globalThis.fetch=async(url)=>{assert.equal(url,`https://registration-storage.invalid/storage/v1/object/photos_personne/${path}`);return new Response(new Uint8Array([1,2,3]));};
  let inserted;let reservation;const commands=[];
  const client={query:async(sql,p)=>{commands.push(sql);
    if(sql.includes("FROM statut_demande_inscription"))return {rows:[{id:"pending",code:"EN_ATTENTE"}]};
    if(sql.startsWith("INSERT INTO demande_inscription")){inserted=p;return {rows:[{id:"new-request",reference:p[3],date_demande:"2026-11-01"}]};}
    if(sql.startsWith("INSERT INTO public.inscription_code_suivi")){reservation=p;return {rows:[]};}
    if(sql.includes("FROM demande_inscription"))return {rows:[]};
    assert(/^(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)/.test(sql),sql);return {rows:[]};
  }};
  try{
    const created=await runWithDatabaseClient(client,()=>createDemandeInscription({email:"test@example.invalid",donnees:{personne:{nom:"TEST LOCAL"},photo_temporaire:path}}));
    assert.match(created.code_suivi,/^[A-HJ-NP-Z]{3}-[2-9]{5}$/);assert.equal(created.demande.reference,inserted[3]);assert(await verifyCodeSuivi(created.code_suivi,inserted[4]));assert.deepEqual(reservation,[trackingDigest(`code:${created.code_suivi}`),"new-request"]);assert.equal(commands[0],"BEGIN");assert.equal(commands.at(-1),"COMMIT");
  }finally{globalThis.fetch=blockedFetch;delete process.env.SUPABASE_URL;delete process.env.SUPABASE_SERVICE_ROLE_KEY;}
});
test("two concurrent creators: private database uniqueness forces fresh code",async()=>{
  const reserved=new Set();const created=new Map();let ids=0;
  const makeClient=()=>{let pending;return {async query(sql,p){
    if(sql.startsWith("INSERT")){if(reserved.has(p[0]))throw Object.assign(new Error("duplicate"),{code:"23505",constraint:"inscription_code_suivi_pkey"});reserved.add(p[0]);}
    if(sql.startsWith("ROLLBACK TO")){created.delete(pending);pending=null;}
    return {rows:[]};
  },insert:async()=>{pending=++ids;created.set(pending,true);await new Promise(resolve=>setTimeout(resolve,5));return {id:pending};}};};
  const clients=[makeClient(),makeClient()];const results=await Promise.all(clients.map((client,n)=>{let calls=0;return insertWithUniqueTracking(client.insert,client,()=>({reference,code:++calls===1?"ABC-22222":n?"KRM-58329":"XYZ-99999"}));}));
  assert.equal(new Set(results.map(r=>r.code)).size,2);assert.equal(reserved.size,2);assert.equal(created.size,2);
});
