import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import express from "express";
import { once } from "node:events";
import { createApp } from "../src/app.js";
import router from "../src/routes/demandesInformation.routes.js";
import { runWithDatabaseClient } from "../src/config/db.js";
import { runWithRequestContext } from "../src/config/requestContext.js";
import { createInformation, normalizeInformationInput, listInformation, getInformation, informationStats, updateInformationStatus } from "../src/services/demandeInformation.service.js";
import { prepareInformationForm, verifyInformationToken, consumeInformationQuota, assertInformationOrigin, informationNetwork } from "../src/services/demandeInformationProtection.service.js";

process.env.DEMANDE_INFORMATION_SECRET = "test-only-secret-do-not-use-in-production-123456789";
process.env.FRONTEND_URL = "https://pitikorana.test";
const account = "11111111-1111-4111-8111-111111111111";
const id = "22222222-2222-4222-8222-222222222222";
const auth = role => ({ compte: { id: account, role } });
const content = { nom: "Rabe", prenom: "José", contact: "+261 34 12 345 67", message: "Bonjour, je souhaite avoir des informations." };
const draft = (ticket = prepareInformationForm()) => ({ ticket, body: { ...content, token: ticket.token, website: "" } });
function mockDb() {
  const store = new Map(); const quota = new Map(); let lock = Promise.resolve();
  const client = {
    calls: [], store, quota,
    async transaction(work) {
      let release; const previous = lock; lock = new Promise(resolve => { release = resolve; });
      await previous;
      const oldStore = new Map(store); const oldQuota = new Map(quota);
      try { return await work(client); } catch (error) { store.clear(); oldStore.forEach((v,k) => store.set(k,v)); quota.clear(); oldQuota.forEach((v,k) => quota.set(k,v)); throw error; } finally { release(); }
    },
    async query(sql, params = []) {
      this.calls.push({ sql, params });
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [] };
      assert.doesNotMatch(sql, /pg_advisory|hashtextextended/);
      if (sql.startsWith("INSERT INTO demande_information_quota")) {
        const key = `${params[0]}:${+params[1]}`; const value = quota.get(key) ?? 0;
        if (value >= params[3]) return { rows: [] }; quota.set(key, value + 1); return { rows: [{ nombre: value + 1 }] };
      }
      if (sql.startsWith("DELETE FROM demande_information_quota")) return { rows: [] };
      if (sql.startsWith("SELECT empreinte_contenu")) return { rows: store.has(params[0]) ? [{ empreinte_contenu: store.get(params[0]).empreinte_contenu }] : [] };
      if (sql.startsWith("INSERT INTO demande_information")) {
        if (store.has(params[7])) return { rows: [] };
        assert.match(sql, /ON CONFLICT \(cle_idempotence\) DO NOTHING RETURNING id/);
        store.set(params[7], { id: params[0], nom: params[1], prenom: params[2], contact: params[3], message: params[4], origine: params[5], id_compte_membre: params[6], empreinte_contenu: params[8], statut: "NOUVELLE", revision: 1 }); return { rows: [{ id: params[0] }] };
      }
      if (sql.startsWith("SELECT count(*)::integer AS total")) return { rows: [{ total: 123 }] };
      if (sql.startsWith("SELECT count(*)::integer AS nouvelles")) return { rows: [{ nouvelles: 4 }] };
      if (sql.startsWith("SELECT id, nom")) return { rows: [...store.values()].map(({ id,nom,prenom,contact,message,origine,statut,revision }) => ({ id,nom,prenom,contact,message,origine,statut,revision })) };
      if (sql.startsWith("UPDATE demande_information")) return { rows: params[3] === 1 ? [{ id: params[2], statut: params[0], revision: 2 }] : [] };
      throw new Error(`Unexpected mock query: ${sql.slice(0,80)}`);
    },
  };
  return client;
}

test("validation serveur: espaces, accents, champs obligatoires, formats et bornes", () => {
  assert.equal(normalizeInformationInput({ ...content, nom: " Rabe " }).nom, "Rabe");
  for (const contact of ["membre@example.mg", "+261 34 12 345 67", "0341234567"]) assert.equal(normalizeInformationInput({ ...content, contact }).contact, contact);
  for (const body of [null, [], {}, { ...content, nom: " " }, { ...content, prenom: "" }, { ...content, contact: "bad" }, { ...content, contact: "x@y" }, { ...content, contact: "123" }, { ...content, message: "court" }, { ...content, message: "x".repeat(5001) }, { ...content, nom: "x".repeat(101) }, { ...content, prenom: "X\nY" }, { ...content, message: "bad\u0000message" }, { ...content, origine: "MEMBRE" }, { ...content, id_compte_membre: account }, { ...content, statut: "TRAITEE" }]) assert.throws(() => normalizeInformationInput(body));
});
test("jeton signé: falsification, expiration, clé différente, signature malformée et secret absent", () => {
  const now = Date.now(); const ticket = prepareInformationForm(now);
  verifyInformationToken(ticket.token, ticket.key, now);
  for (const [token,key,time] of [[ticket.token + 'x',ticket.key,now],[ticket.token,account,now],[ticket.token,ticket.key,now+1800001],[ticket.token,ticket.key,now-1],['bad',ticket.key,now]]) assert.throws(() => verifyInformationToken(token,key,time));
  verifyInformationToken(ticket.token,ticket.key,now+1800001,true);
  assert.throws(() => runWithRequestContext({ env: { DEMANDE_INFORMATION_SECRET: "short" } }, () => prepareInformationForm()), { code: "INFORMATION_UNAVAILABLE" });
});
test("création visiteur et membre: origine fiable, aucun mot de passe, instantané indépendant", async () => {
  for (const context of [undefined,auth("MEMBRE"),auth("ADMIN")]) {
    const client=mockDb(); const { ticket,body }=draft();
    assert.deepEqual(await createInformation(body,context,ticket.key,client), { accepted:true });
    const row=client.store.get(ticket.key); assert.equal(row.origine,context?'MEMBRE':'VISITEUR'); assert.equal(row.id_compte_membre,context?account:null);
    assert.equal(row.message,content.message); assert.equal(row.statut,'NOUVELLE');
    assert.equal(client.calls.some(c=>/UPDATE personne|INSERT INTO personne|UPDATE compte_membre/.test(c.sql)),false);
  }
});
test("envois concurrents et reprise après réponse perdue: une seule insertion et conflit de contenu", async () => {
  const client=mockDb(); const { ticket,body }=draft();
  await Promise.all(Array.from({length:10},()=>createInformation(body,undefined,ticket.key,client)));
  assert.equal(client.store.size,1); assert.equal(client.calls.filter(c=>c.sql.startsWith('INSERT INTO demande_information\n')).length,10);
  assert.equal(client.calls.filter(c=>c.sql.startsWith('INSERT INTO demande_information_quota')).length,1);
  assert.equal(client.calls.some(c=>c.sql.includes('pg_advisory')),false);
  await assert.rejects(createInformation({...body,message:'Un autre contenu ici.'},undefined,ticket.key,client),{code:'INFORMATION_IDEMPOTENCY_CONFLICT'});
});
test("un jeton expiré accepte uniquement la reprise exacte d'un envoi déjà enregistré", async () => {
  const client=mockDb();const old=prepareInformationForm(Date.now()-1800001);const body={...content,token:old.token};
  await assert.rejects(createInformation(body,undefined,old.key,client),{code:'INFORMATION_TOKEN_INVALID'});
  const fresh=draft();await createInformation(fresh.body,undefined,fresh.ticket.key,client);
  const original=Date.now;Date.now=()=>original()+1800001;
  try { assert.deepEqual(await createInformation(fresh.body,undefined,fresh.ticket.key,client),{accepted:true}); } finally { Date.now=original; }
});
test("champ piège: confirmation générique sans stockage",async()=>{
  const client=mockDb();const {ticket,body}=draft();await createInformation({...body,website:'robot.test'},undefined,ticket.key,client);assert.equal(client.calls.length,0);
});
test("limitation partagée et atomique: deux instances, fenêtre suivante, identifiants pseudonymisés",async()=>{
  const a=mockDb();const b={query:a.query.bind(a)};const now=Date.now();
  await consumeInformationQuota('test','192.0.2.1',2,900,a,now);await consumeInformationQuota('test','192.0.2.1',2,900,b,now);
  await assert.rejects(consumeInformationQuota('test','192.0.2.1',2,900,b,now),{status:429});
  await consumeInformationQuota('test','192.0.2.1',2,900,b,now+900000);
  assert.equal(JSON.stringify(a.calls).includes('192.0.2.1'),false);assert.match(a.calls[0].sql,/ON CONFLICT.*DO UPDATE/s);
});
test("quota contact: refus et rollback sans nouvelle demande",async()=>{
  const client=mockDb();for(let n=0;n<3;n++){const {ticket,body}=draft();await createInformation(body,undefined,ticket.key,client);}
  const {ticket,body}=draft();await assert.rejects(createInformation(body,undefined,ticket.key,client),{status:429});assert.equal(client.store.size,3);
});
test("requêtes intersites et adresses réseau: refus sans Origin, en-têtes de proxy ignorés sous Node",()=>{
  const request=origin=>({get:()=>origin});assertInformationOrigin(request('https://pitikorana.test'));
  assert.throws(()=>assertInformationOrigin(request()),{status:403});assert.throws(()=>assertInformationOrigin(request('https://evil.test')),{status:403});
  const req={get:()=> '198.51.100.2',socket:{remoteAddress:'192.0.2.1'}};assert.equal(informationNetwork(req),'192.0.2.1');
  assert.equal(runWithRequestContext({env:{}},()=>informationNetwork(req)),'198.51.100.2');
});
for (const role of [undefined,'MEMBRE','BUREAU_ZANAKA_AMPIELEZANA']) test(`toutes les opérations de gestion refusent ${role??'VISITEUR'}`,async()=>{
  const client=mockDb();const context=role?auth(role):undefined;
  for (const work of [()=>listInformation({},context,client),()=>getInformation(id,context,client),()=>informationStats(context,client),()=>updateInformationStatus(id,{statut:'TRAITEE',revision:1},context,client)]) await assert.rejects(work(),{status:role?403:401});
  assert.equal(client.calls.length,0);
});
for (const role of ['ADMIN','PASTEUR']) test(`${role}: recherche paramétrée, filtre, pagination serveur, détail, compteur et statut`,async()=>{
  const client=mockDb();const {ticket,body}=draft();await createInformation(body,undefined,ticket.key,client);
  const list=await listInformation({recherche:"JOSÉ %_",statut:'NOUVELLE',page:2,limit:20},auth(role),client);assert.equal(list.pagination.total,123);
  const query=client.calls.find(c=>c.sql.includes('ORDER BY date_creation DESC'));
  assert.deepEqual(query.params,['NOUVELLE','jose','\\%\\_',20,20]);assert.match(query.sql,/LIMIT \$4 OFFSET \$5/);assert.doesNotMatch(query.sql,/SELECT \*/);
  assert.equal((await informationStats(auth(role),client)).nouvelles,4);
  assert.equal((await getInformation(id,auth(role),client)).message,content.message);
  for(const statut of ['NOUVELLE','EN_COURS','TRAITEE'])assert.equal((await updateInformationStatus(id,{statut,revision:1},auth(role),client)).statut,statut);
  await assert.rejects(updateInformationStatus(id,{statut:'TRAITEE',revision:9},auth(role),client),{status:409});
});
test("paramètres de gestion invalides, identifiant inconnu et statuts forgés",async()=>{
  const client=mockDb();for(const q of [{page:0},{page:1.5},{limit:5000},{statut:'BAD'},{recherche:'x'.repeat(101)}])await assert.rejects(listInformation(q,auth('ADMIN'),client),{status:400});
  await assert.rejects(getInformation('bad',auth('ADMIN'),client),{status:400});await assert.rejects(getInformation(id,auth('ADMIN'),client),{status:404});
  await assert.rejects(updateInformationStatus(id,{statut:'BAD',revision:1},auth('ADMIN'),client),{status:400});
  await assert.rejects(updateInformationStatus(id,{statut:'TRAITEE',revision:1,nom:'x'},auth('ADMIN'),client),{status:400});
});
test("chaque route de gestion porte explicitement les middlewares auth et rôle",()=>{
  const managed=router.stack.filter(layer=>layer.route&&!['/preparation'].includes(layer.route.path)&&!layer.route.methods.post);
  assert.equal(managed.length,4);
  for(const layer of managed){assert.equal(layer.route.stack[0].handle.name,'requireAuth');for(const role of ['MEMBRE','BUREAU_ZANAKA_AMPIELEZANA']){
    const res={status(n){this.statusCode=n;return this;},json(){return this;}};layer.route.stack[1].handle({auth:auth(role)},res,()=>assert.fail());assert.equal(res.statusCode,403);
  }}
});
test("HTTP réel local: public, idempotence, JSON invalide, taille, protection des lectures et absence de fuite",async()=>{
  const client=mockDb();const app=express();app.use((req,res,next)=>runWithDatabaseClient(client,next));app.use(createApp());
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}/api/demandes-information`;
  try{
    const prepared=await fetch(base+'/preparation');assert.equal(prepared.status,200);assert.equal(prepared.headers.get('cache-control'),'no-store');const ticket=(await prepared.json()).data;
    const options={method:'POST',headers:{Origin:'https://pitikorana.test','Content-Type':'application/json','Idempotency-Key':ticket.key},body:JSON.stringify({...content,token:ticket.token})};
    const sent=await fetch(base,options);assert.equal(sent.status,201);assert.deepEqual(await sent.json(),{success:true,data:{accepted:true}});
    assert.equal((await fetch(base,options)).status,201);assert.equal(client.store.size,1);
    assert.equal((await fetch(base,{...options,headers:{...options.headers,Origin:'https://evil.test'}})).status,403);
    assert.equal((await fetch(base,{...options,headers:{'Content-Type':'application/json'},body:'{}'})).status,403);
    const bad=await fetch(base,{...options,body:'{'});assert.equal(bad.status,400);assert.equal((await bad.json()).code,'INFORMATION_INVALID');
    const upper=await fetch(base.replace('/api/demandes-information','/API/DEMANDES-INFORMATION'),{...options,body:JSON.stringify({message:'x'.repeat(17000)})});assert.equal(upper.status,413);
    const large=await fetch(base,{...options,body:JSON.stringify({message:'x'.repeat(17000)})});assert.equal(large.status,413);assert.equal((await large.json()).code,'INFORMATION_TOO_LARGE');
    for(const path of ['',`/${id}`,'/statistiques']){const response=await fetch(base+path);assert.equal(response.status,401);assert.equal((await response.text()).includes(content.contact),false);}
    assert.equal((await fetch(base+`/${id}/statut`,{method:'PATCH',headers:{Origin:'https://pitikorana.test','Content-Type':'application/json'},body:'{}'})).status,401);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
test("SQL préparé uniquement: contraintes, index, références facultatives et verrouillage RLS",async()=>{
  const sql=await readFile(new URL('../database/24_demande_information.sql',import.meta.url),'utf8');
  assert.match(sql,/cle_idempotence uuid not null unique/);assert.match(sql,/id_compte_membre uuid references public\.compte_membre\(id\) on delete set null/);
  assert.match(sql,/demande_information_compte_membre_idx/);
  assert.match(sql,/demande_information_compte_modificateur_idx/);
  assert.match(sql,/set local search_path = pg_catalog, public/);
  assert.match(sql,/enable row level security/);assert.match(sql,/from public, anon, authenticated/);assert.doesNotMatch(sql,/alter table personne|alter table compte_membre|alter table fandraisan/i);
});
