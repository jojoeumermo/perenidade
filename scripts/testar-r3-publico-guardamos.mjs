// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Item 3.2 (onda R3): a lista do que o servidor guarda e o que foi tirado.
//   1. A lista pública (content/transparencia/o-que-o-servidor-guarda.json) bate com o banco montado: toda tabela e toda coluna.
//   2. Ela PEGA o que entra sem avisar: uma coluna nova numa tabela que existe, e uma tabela nova sem comentário dizendo o que guarda.
//   3. O "user agent" (supabase/migracoes/20261125-r3-publico-ferramentas.sql): antes, auth.sessions e interno.termos_aceites guardavam o
//      texto inteiro (o teste mostra); depois, só o nome do navegador e do sistema, e a lista "seus aparelhos" e o aviso de entrada
//      nova dão o mesmo resultado de antes (fast-check: para qualquer texto, alumia_navegador(mínimo(x)) = alumia_navegador(x)).
//   4. A migração roda duas vezes sem erro, e os aceites antigos continuam imutáveis.
// Uso: node scripts/testar-r3-publico-guardamos.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fc from "fast-check";
import { criarBanco } from "./banco-local.mjs";
import { ARQUIVO, diferencas, montarInventario } from "./ferramentas/inventario-do-banco.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIGRACAO = fs.readFileSync(path.join(raiz, "supabase/migracoes/20261125-r3-publico-ferramentas.sql"), "utf8");
let falhas = 0;
const ok = (nome, cond, detalhe = "") => {
  if (cond) console.log(`  ok    ${nome}`);
  else {
    falhas++;
    console.log(`  FALHA ${nome}${detalhe ? `\n        ${detalhe}` : ""}`);
  }
};

console.log("1. a lista pública bate com o banco montado");
const gravado = JSON.parse(fs.readFileSync(ARQUIVO, "utf8"));
const atual = await montarInventario();
const d = diferencas(gravado, atual);
ok(`nenhuma diferença (${atual.total.tabelas} tabelas, ${atual.total.colunas} colunas)`, d.length === 0, d.slice(0, 10).join("; "));
ok("toda tabela do esquema interno tem área e lista de colunas", gravado.tabelas.every((t) => t.area && t.colunas.length > 0));
ok("o serviço de contas (auth) está na lista, com o que guarda e o prazo", gravado.servico_de_contas.length >= 6 && gravado.servico_de_contas.every((s) => s.guarda && s.prazo));
{
  // Auditoria interna da R3: a lista dizia menos que o banco justamente nas tabelas do chat e dos passes.
  const m = new Map(gravado.tabelas.map((t) => [t.tabela.replace("interno.", ""), t]));
  const DO_CHAT = ["caixas", "pacotes", "caixa_contagem", "passes_gastos", "passes_emitidos", "diretorio_contas", "diretorio_aparelhos", "diretorio_pre_chaves", "diretorio_pacotes_mls", "rede_kt"];
  ok("ATAQUE as tabelas do chat e dos passes dizem o que guardam", DO_CHAT.every((t) => (m.get(t)?.o_que_e ?? "").length > 20), DO_CHAT.filter((t) => !m.get(t)?.o_que_e).join(", "));
  ok("ATAQUE a lista diz que pacotes, passes e contagens se apagam sozinhos (a rotina das caixas conta em dias)", ["pacotes", "passes_emitidos", "passes_gastos", "caixa_contagem", "caixas"].every((t) => (m.get(t)?.apaga_sozinho ?? []).length > 0));
  ok("passes_emitidos diz que quem tem o segredo liga a marca à conta", /quem opera a rede, com o segredo, liga/.test(m.get("passes_emitidos")?.o_que_e ?? ""));
  const semDizer = gravado.tabelas.filter((t) => !t.o_que_e && t.aponta_para_conta.length).length;
  ok(`limite conhecido: tabelas ligadas a conta ainda sem "o que é" (${semDizer}) não crescem`, semDizer <= 112, String(semDizer));
}

console.log("2. a lista pega o que entra sem avisar");
const extra = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "alumia-guardamos-")), "extra.sql");
fs.writeFileSync(extra, "alter table interno.perfis add column if not exists teste_espiao text;\ncreate table if not exists interno.teste_sem_comentario (id uuid primary key, usuario uuid);\n");
const antesExtras = process.env.ALUMIA_BANCO_EXTRAS;
process.env.ALUMIA_BANCO_EXTRAS = extra;
const comExtra = await montarInventario();
if (antesExtras === undefined) delete process.env.ALUMIA_BANCO_EXTRAS;
else process.env.ALUMIA_BANCO_EXTRAS = antesExtras;
const dExtra = diferencas(gravado, comExtra);
ok("coluna nova numa tabela que existe é pega", dExtra.includes("coluna nova fora da lista: interno.perfis.teste_espiao"), dExtra.join("; "));
ok("tabela nova é pega, e sem comentário também", dExtra.includes("tabela nova fora da lista: interno.teste_sem_comentario") && dExtra.some((x) => x.startsWith("tabela nova sem comentário")), dExtra.join("; "));
ok("a tabela nova aparece como ligada a uma conta (coluna usuario)", comExtra.tabelas.find((t) => t.tabela === "interno.teste_sem_comentario")?.aponta_para_conta.includes("usuario"));

console.log("3. o 'user agent' guarda só o navegador e o sistema");
const UA_CELULAR = "Mozilla/5.0 (Linux; Android 14; SM-A546E Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.6778.135 Mobile Safari/537.36";
const UA_COMPUTADOR = "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0";
// Depois da junção, a migração já está colada no install.sql: o banco de "antes" é o install.sql até o começo dela.
const semCr = (t) => t.replace(/\r\n/g, "\n");
const jaColada = semCr(fs.readFileSync(path.join(raiz, "supabase/install.sql"), "utf8")).includes(semCr(MIGRACAO).trim().slice(0, 400));
const banco = await criarBanco(jaColada ? { antesDe: MIGRACAO } : {});
const { pg, dono, criarUsuario } = banco;
// O esquema auth do PGlite é só um esboço: a tabela de sessões do serviço de contas, com as colunas que importam aqui.
await dono(`create table auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid, created_at timestamptz default now(),
  updated_at timestamptz default now(), refreshed_at timestamp, aal text default 'aal1', user_agent text, ip inet)`);
const ana = await criarUsuario("ana@guardamos.local", "Ana");
const aceitar = async (agente, versao) => {
  await dono("select set_config('request.jwt.claims', $1, false), set_config('request.headers', $2, false)", [
    JSON.stringify({ role: "authenticated", sub: ana, aal: "aal2" }),
    JSON.stringify({ "user-agent": agente, "x-forwarded-for": "127.0.0.1" }),
  ]);
  await pg.exec("set role authenticated");
  try {
    await pg.query("select public.eu()");
    return (await pg.query("select public.termo_registrar('voluntario', $1, $2) as r", [versao, "Termo de voluntário para o teste. ".repeat(3)])).rows[0].r;
  } finally {
    await pg.exec("reset role");
    await pg.query("select set_config('request.jwt.claims', '', false)");
  }
};
const navegadorDe = async (texto) => (await dono("select interno.alumia_navegador($1) as n", [texto])).rows[0].n;

// Antes da migração: o texto inteiro fica (é o que a migração tira).
await dono("insert into auth.sessions (user_id, user_agent, ip) values ($1, $2, '10.1.2.3')", [ana, UA_CELULAR]);
await aceitar(UA_CELULAR, "antes");
const sessaoAntes = (await dono("select user_agent from auth.sessions where user_id = $1", [ana])).rows[0].user_agent;
const termoAntes = (await dono("select navegador from interno.termos_aceites where versao = 'antes'")).rows[0].navegador;
ok("antes: a sessão guardava o 'user agent' inteiro (modelo do celular e versões)", sessaoAntes === UA_CELULAR);
ok("antes: o aceite do termo guardava o 'user agent' inteiro", termoAntes === UA_CELULAR);
const aparelhosAntes = await navegadorDe(sessaoAntes);

await pg.exec(MIGRACAO);
await pg.exec(MIGRACAO);
ok("a migração roda duas vezes sem erro", true);

const sessaoDepois = (await dono("select user_agent from auth.sessions where user_id = $1", [ana])).rows[0].user_agent;
ok("depois: a sessão que já estava gravada guarda só 'Chrome/ Android'", sessaoDepois === "Chrome/ Android", sessaoDepois);
ok("depois: a lista 'seus aparelhos' dá o mesmo navegador e sistema", JSON.stringify(await navegadorDe(sessaoDepois)) === JSON.stringify(aparelhosAntes));
await dono("insert into auth.sessions (user_id, user_agent) values ($1, $2)", [ana, UA_COMPUTADOR]);
const nova = (await dono("select user_agent from auth.sessions where user_id = $1 order by created_at desc, user_agent limit 1", [ana])).rows;
ok("depois: sessão nova já entra só com 'Firefox/ Linux'", (await dono("select count(*)::int as n from auth.sessions where user_agent = 'Firefox/ Linux'")).rows[0].n === 1, JSON.stringify(nova));
await dono("update auth.sessions set user_agent = $1, refreshed_at = now() where user_agent = 'Firefox/ Linux'", [UA_COMPUTADOR]);
ok("depois: a renovação (update) também não regrava o texto inteiro", (await dono("select count(*)::int as n from auth.sessions where user_agent = $1", [UA_COMPUTADOR])).rows[0].n === 0);
await dono("insert into auth.sessions (user_id, user_agent) values ($1, null)", [ana]);
ok("depois: sessão sem 'user agent' continua sem (nulo não vira texto)", (await dono("select count(*)::int as n from auth.sessions where user_agent is null")).rows[0].n === 1);

await aceitar(UA_CELULAR, "depois");
const termoDepois = (await dono("select navegador from interno.termos_aceites where versao = 'depois'")).rows[0].navegador;
ok("depois: o aceite novo do termo guarda só 'Chrome/ Android'", termoDepois === "Chrome/ Android", termoDepois);
ok("depois: o aceite antigo não muda (prova do voluntariado; reescrever é decisão do dono)", (await dono("select navegador from interno.termos_aceites where versao = 'antes'")).rows[0].navegador === UA_CELULAR);
let imutavel = false;
try {
  await dono("update interno.termos_aceites set navegador = '' where versao = 'antes'");
} catch {
  imutavel = true;
}
ok("depois: o aceite continua imutável (o gatilho de antes segue recusando update)", imutavel);

// Para qualquer texto (e para os de verdade), o mínimo dá o mesmo navegador e o mesmo sistema, e aplicar de novo não muda nada.
const pedacos = ["Mozilla/5.0", "Firefox/", "Edg/", "OPR/", "Chrome/", "Safari/", "Android", "iPhone", "iPad", "Windows", "Mac OS X", "Linux", "X11", "Mobile", " ", ";", "(", ")", "14", "rv:133.0"];
const agente = fc.oneof(fc.string({ maxLength: 120 }), fc.array(fc.constantFrom(...pedacos), { maxLength: 14 }).map((x) => x.join("")));
let propriedade = true;
let contra = "";
try {
  await fc.assert(
    fc.asyncProperty(agente, async (x) => {
      const r = (await dono("select interno.alumia_navegador($1) as a, interno.alumia_navegador(interno.alumia_agente_minimo($1)) as b, interno.alumia_agente_minimo(interno.alumia_agente_minimo($1)) = interno.alumia_agente_minimo($1) as idem, interno.alumia_agente_minimo($1) as m", [x])).rows[0];
      return JSON.stringify(r.a) === JSON.stringify(r.b) && r.idem && r.m.length <= 20;
    }),
    { numRuns: 400 },
  );
} catch (erro) {
  propriedade = false;
  contra = String(erro.message).split("\n").slice(0, 3).join(" ");
}
ok("fast-check: alumia_navegador(mínimo(x)) = alumia_navegador(x), mínimo(mínimo(x)) = mínimo(x) e cabe em 20 letras (400 casos)", propriedade, contra);
await pg.close();

console.log(`\n${falhas ? `${falhas} falha(s)` : "tudo ok"}`);
process.exit(falhas ? 1 : 0);
