// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o servidor do chat separado da onda R3 (item 3.1; nativo/servidor-chat, docs/rede/CHAT-SEPARADO.md).
//   A. O banco próprio do chat (nativo/servidor-chat/banco/001-chat.sql) num Postgres local (PGlite), rodado DUAS vezes: o papel do
//      servidor só executa as funções (não lê tabela); as caixas fazem o que as da R2 fazem (criar, depositar, buscar, confirmar,
//      trocar, apagar; passe errado igual ao certo; bloqueio; teto; único; tamanho fixo; passe e desafio gastos uma vez; o lote com o
//      mesmo xmin e a posição sorteada); a caixa de pedidos só aceita o item "pedido"; o cofre anônimo; nenhuma coluna de conta ou hora.
//   B. Com CHAT_URL (o servidor de verdade, em contêiner): as mesmas rotas e o mesmo JSON da R2, pelo cliente das caixas da R2
//      (lib/rede/caixas/cliente.ts) com o endereço trocado (lib/rede/caixas/servidor-do-chat.ts); passes RSA emitidos pelo site e
//      conferidos lá só com a chave pública (repetido, de outra semana, adulterado: recusados); a prova de trabalho; a franquia pela
//      interface (token errado recusado; a marca confere; outra não).
//   C. O aceite do 3.1: um administrador da rede social, com a chave de serviço e o banco inteiro da rede (PGlite com o install.sql),
//      (a) não acha nenhuma linha do chat no banco da rede; (b) o servidor do chat recusa o JWT de serviço da rede e o cookie da sessão;
//      (c) não apaga nada sem o passe de leitura da caixa.
// As partes B e C pedem o servidor no ar: CHAT_URL, CHAT_INTERFACE_TOKEN e o par de chaves dos passes que a "rede de teste" publica
// (CHAT_TESTE_CHAVES, um JSON do scripts/r3-servidor-conteiner.mjs). Sem CHAT_URL, só a parte A roda (e diz que B e C não rodaram).
// Uso: npm run testar:r3-servidor (só a parte A); as partes B e C: R3_VPS=<apelido ssh> node --import ./scripts/carregar-ts.mjs scripts/r3-servidor-conteiner.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SQL = fs.readFileSync(path.join(raiz, "nativo/servidor-chat/banco/001-chat.sql"), "utf8");

let certos = 0;
const falhas = [];
const ok = (nome, cond, detalhe = "") => (cond ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 300)}`);
    certos++;
    return valor;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
    return undefined;
  }
}
async function recusa(nome, promessa, codigo) {
  try {
    const valor = await promessa();
    falhas.push(`${nome}: deveria recusar com "${codigo}", mas passou (${JSON.stringify(valor)?.slice(0, 200)})`);
  } catch (erro) {
    if (String(erro.message).includes(codigo)) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${erro.message}"`);
  }
}

const sorteio = (n) => crypto.randomBytes(n);
const b64 = (b) => Buffer.from(b).toString("base64");
const resumo = (rotulo, valor) => crypto.createHash("sha256").update(Buffer.concat([Buffer.from(rotulo, "utf8"), Buffer.from(valor)])).digest();
const caixaNova = (multi = false) => {
  const id = sorteio(32), pd = sorteio(32), pl = sorteio(32);
  return { id, pd, pl, multi, idH: resumo("alumia/r2/caixa", id), pdH: resumo("alumia/r2/passe-deposito", pd), plH: resumo("alumia/r2/passe-leitura", pl) };
};
const DUPLA = [2048, 4096, 8192, 16384, 24576, 32768].map((n) => 1120 + n + 16);
const GRUPO = [2048, 8192, 32768, 131072].map((n) => 34 + n + 16);
const PEDIDO = 1120 + 4096 + 16;
const LIGAR = 1120 + 65536 + 16;
const COFRE = [65536, 262144, 1048576, 4194304].map((f) => 33 + 24 + f + 17 * (f / 65536));

// ═══════════════════ A. O banco próprio do chat ═══════════════════
ok("o SQL do chat tem cabeçalho com a função e a lei", /O banco PRÓPRIO do servidor do chat/.test(SQL) && /Leis: LGPD/.test(SQL));
ok("o SQL do chat não tem endereço de rede nem caminho do computador", !/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b|[A-Z]:\\|\/home\/|\/opt\//.test(SQL));
ok("o SQL do chat não fala de conta, perfil, sessão nem do esquema da rede", !/\binterno\.|auth\.uid|perfis|usuario|conta\b/.test(SQL.replace(/^--.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "")));
ok("nada de random() (sorteio só com gen_random_bytes)", !/\brandom\(\)/.test(SQL));

const pg = new PGlite({ extensions: { pgcrypto } });
await espera("o banco do chat instala", () => pg.exec(SQL));
await espera("de novo (idempotente)", () => pg.exec(SQL));
let fila = Promise.resolve();
const exclusivo = (t) => {
  const r = fila.then(t, t);
  fila = r.catch(() => {});
  return r;
};
/** Chama como o servidor do chat (o papel chat_servidor). */
const servidor = (sql, valores = []) =>
  exclusivo(async () => {
    await pg.exec("set role chat_servidor");
    try {
      return (await pg.query(sql, valores)).rows[0]?.r ?? null;
    } finally {
      await pg.exec("reset role");
    }
  });
const dono = (sql, valores = []) => exclusivo(() => pg.query(sql, valores));
const hoje = (await dono("select chat.hoje()::text as d")).rows[0].d;
const lote = (itens, dia = hoje) => servidor("select chat.caixa_lote($1::jsonb, $2::date) as r", [JSON.stringify(itens), dia]);
const criar = (c, gasto = sorteio(32), extra = {}) => ({ acao: "criar", id_h: b64(c.idH), pd_h: b64(c.pdH), pl_h: b64(c.plH), multi: c.multi, gastos: [b64(gasto)], ...extra });
const depositar = (c, tamanho = DUPLA[0], extra = {}) => ({ acao: "depositar", id_h: b64(c.idH), pd: b64(c.pd), envelope: b64(sorteio(tamanho)), ...extra });
const buscar = (c, cursor = 0) => servidor("select chat.caixa_buscar($1, $2, $3) as r", [c.idH, c.pl, cursor]);
const contar = async (c) => (await dono("select count(*)::int as n from chat.pacotes where caixa_h = $1", [c.idH])).rows[0].n;

// Quem chama o quê.
await recusa("o servidor não lê tabela direto", () => servidor("select count(*) as r from chat.pacotes"), "permission denied");
await recusa("o servidor não chama as peças de dentro", () => servidor("select chat.gastar($1) as r", [sorteio(32)]), "permission denied");
const funcoes = (await dono(`select p.proname, has_function_privilege('chat_servidor', p.oid, 'execute') as pode, p.prosecdef as definer,
  coalesce(array_to_string(p.proconfig, ','), '') as config from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'chat'`)).rows;
const DE_FORA = ["caixa_lote", "caixa_buscar", "caixa_confirmar", "caixa_trocar", "caixa_apagar", "cofre_ler", "cofre_gravar", "cofre_apagar", "limpeza"];
ok("o servidor executa só as funções de fora", funcoes.every((f) => f.pode === DE_FORA.includes(f.proname)), JSON.stringify(funcoes.filter((f) => f.pode !== DE_FORA.includes(f.proname)).map((f) => f.proname)));
ok("as de fora são security definer com search_path fixo", funcoes.filter((f) => DE_FORA.includes(f.proname)).every((f) => f.definer && /search_path=chat, pg_temp/.test(f.config)));
await recusa("um papel qualquer não entra no esquema", () => exclusivo(async () => {
  await pg.exec("create role r3sc_qualquer; set role r3sc_qualquer");
  try {
    return await pg.query("select chat.caixa_buscar($1, $2, 0)", [sorteio(32), sorteio(32)]);
  } finally {
    await pg.exec("reset role");
  }
}), "permission denied");

// Criar e depositar (os casos da R2).
const daAna = caixaNova(), daBia = caixaNova();
const passeA = sorteio(32);
await espera("criar duas caixas num lote", () => lote([criar(daAna, passeA), criar(daBia)]), (r) => r.resultados.every((x) => x.ok));
await espera("criar de novo com os mesmos resumos: ok (idempotente)", () => lote([criar(daAna)]), (r) => r.resultados[0].ok === true);
await espera("criar com o mesmo id e outros passes: 'existe'", () => lote([criar({ ...caixaNova(), idH: daAna.idH })]), (r) => r.resultados[0].erro === "existe");
await espera("o mesmo passe numa caixa nova: 'passe_usado'", () => lote([criar(caixaNova(), passeA)]), (r) => r.resultados[0].erro === "passe_usado");
await espera("criar sem gasto: 'invalido'", () => lote([{ ...criar(caixaNova()), gastos: [] }]), (r) => r.resultados[0].erro === "invalido");
await espera("caixa de pedidos de vários leitores: 'invalido'", () => lote([criar(caixaNova(true), sorteio(32), { pedidos: true })]), (r) => r.resultados[0].erro === "invalido");
for (const t of [...DUPLA, ...GRUPO, PEDIDO, LIGAR]) await espera(`depositar ${t} bytes`, () => lote([depositar(daAna, t)]), (r) => r.resultados[0].ok === true);
await espera("tamanho fora da lista: 'tamanho'", () => lote([depositar(daAna, 3000)]), (r) => r.resultados[0].erro === "tamanho");
const antes = await contar(daAna);
await espera("passe de depósito errado responde igual ao certo", () => lote([{ ...depositar(daAna), pd: b64(sorteio(32)) }]), (r) => JSON.stringify(r.resultados[0]) === JSON.stringify({ ok: true }));
await espera("caixa que não existe responde igual", () => lote([depositar(caixaNova())]), (r) => JSON.stringify(r.resultados[0]) === JSON.stringify({ ok: true }));
ok("e nada foi gravado", (await contar(daAna)) === antes);
const pacotes = await buscar(daAna);
ok("buscar devolve os pacotes em ordem, com o dia só", pacotes.pacotes.length === antes && pacotes.pacotes.every((p, i) => p.ordem === i + 1 && p.dia === hoje));
ok("passe de leitura errado: lista vazia (igual à caixa vazia)", (await buscar({ ...daAna, pl: sorteio(32) })).pacotes.length === 0);
ok("o cursor anda", (await buscar(daAna, 3)).pacotes[0]?.ordem === 4);
await servidor("select chat.caixa_confirmar($1, $2, $3) as r", [daAna.idH, daAna.pl, 3]);
ok("confirmar até 3: os 3 primeiros saem do banco", (await contar(daAna)) === antes - 3);
await servidor("select chat.caixa_confirmar($1, $2, $3) as r", [daAna.idH, sorteio(32), 100]);
ok("confirmar com passe errado: nada sai", (await contar(daAna)) === antes - 3);

// Bloqueio e troca.
const pdNovo = sorteio(32);
await espera("trocar o passe de depósito com bloqueio", () => servidor("select chat.caixa_trocar($1, $2, $3, null, true) as r", [daBia.idH, daBia.pl, resumo("alumia/r2/passe-deposito", pdNovo)]), (r) => r.ok === true);
await lote([depositar(daBia)]);
ok("bloqueio: o passe velho para na hora (responde ok, nada entra)", (await contar(daBia)) === 0);
await lote([{ ...depositar(daBia), pd: b64(pdNovo) }]);
ok("o passe novo entra", (await contar(daBia)) === 1);
const pdTroca = sorteio(32);
await servidor("select chat.caixa_trocar($1, $2, $3, null, false) as r", [daBia.idH, daBia.pl, resumo("alumia/r2/passe-deposito", pdTroca)]);
await lote([{ ...depositar(daBia), pd: b64(pdNovo) }]);
ok("troca sem bloqueio: o passe anterior ainda vale 7 dias", (await contar(daBia)) === 2);
await espera("trocar com o passe de leitura errado: 'nao_encontrada'", () => servidor("select chat.caixa_trocar($1, $2, $3, null, false) as r", [daBia.idH, sorteio(32), sorteio(32)]), (r) => r.erro === "nao_encontrada");

// Único e teto.
const unica = caixaNova();
await lote([criar(unica)]);
await espera("o primeiro depósito 'único' entra", () => lote([depositar(unica, DUPLA[0], { unico: true })]), (r) => r.resultados[0].ok === true);
await espera("o segundo 'único': 'ocupada'", () => lote([depositar(unica, DUPLA[0], { unico: true })]), (r) => r.resultados[0].erro === "ocupada");
await dono("insert into chat.caixa_contagem (caixa_h, dia, n) values ($1, chat.hoje(), 1000) on conflict (caixa_h, dia) do update set n = 1000", [unica.idH]);
await espera("o teto do dia: 'cheia'", () => lote([depositar(unica)]), (r) => r.resultados[0].erro === "cheia");
await recusa("dia fora de ontem/hoje/amanhã: recusado", () => lote([depositar(daAna)], "2020-01-01"), "invalido:dia");
await recusa("lote vazio: recusado", () => lote([]), "invalido:itens");

// A caixa de pedidos.
const pedidos = caixaNova();
await espera("criar a caixa de pedidos", () => lote([criar(pedidos, sorteio(32), { pedidos: true })]), (r) => r.resultados[0].ok);
await espera("depósito comum na caixa de pedidos: 'pedido'", () => lote([depositar(pedidos, PEDIDO)]), (r) => r.resultados[0].erro === "pedido");
const pedido = (c, gastos, tamanho = PEDIDO) => ({ acao: "pedido", id_h: b64(c.idH), pd: b64(c.pd), envelope: b64(sorteio(tamanho)), gastos: gastos.map(b64) });
const gastoP = sorteio(32), gastoD = sorteio(32);
await espera("o pedido com passe e desafio entra", () => lote([pedido(pedidos, [gastoP, gastoD])]), (r) => r.resultados[0].ok === true);
await espera("o mesmo passe de novo: 'passe_usado'", () => lote([pedido(pedidos, [gastoP, sorteio(32)])]), (r) => r.resultados[0].erro === "passe_usado");
await espera("o pedido de fora (só a prova) entra", () => lote([pedido(pedidos, [sorteio(32)])]), (r) => r.resultados[0].ok === true);
await espera("pedido de outro tamanho: 'tamanho'", () => lote([pedido(pedidos, [sorteio(32)], DUPLA[0])]), (r) => r.resultados[0].erro === "tamanho");
await espera("pedido numa caixa comum: 'invalido'", () => lote([pedido(daAna, [sorteio(32)], PEDIDO)]), (r) => r.resultados[0].erro === "invalido");
await espera("pedido sem gasto: 'passe_usado' (não grava)", () => lote([pedido(pedidos, [])]), (r) => r.resultados[0].erro === "passe_usado");
ok("a caixa de pedidos tem os 2 pedidos", (await contar(pedidos)) === 2);
// ATAQUE (auditoria interna da R3): o operador do chat liga a caixa de pedidos à conta lendo o diretório público pelo codinome; a
// contagem por dia diria quantos pedidos cada conta recebeu em cada dia. A caixa de pedidos não grava contagem; o teto é o que espera.
ok("ATAQUE a caixa de pedidos não deixa contagem por dia (quantos pedidos a conta recebeu hoje)", (await dono("select count(*)::int as n from chat.caixa_contagem where caixa_h = $1", [pedidos.idH])).rows[0].n === 0);
await dono("insert into chat.pacotes (id, caixa_h, ordem, envelope, dia) select gen_random_bytes(16), $1, 1000 + g, gen_random_bytes(10), current_date from generate_series(1, 298) g", [pedidos.idH]);
await espera("com 300 pedidos esperando leitura, o seguinte é recusado ('cheia')", () => lote([pedido(pedidos, [sorteio(32)])]), (r) => r.resultados[0].erro === "cheia");
await dono("delete from chat.pacotes where caixa_h = $1 and ordem > 999", [pedidos.idH]);

// O lote: uma transação, a posição sorteada.
const muitas = Array.from({ length: 12 }, () => caixaNova());
await lote(muitas.map((c) => criar(c)));
await lote(muitas.map((c) => depositar(c)));
const xmins = (await dono("select distinct xmin::text as x from chat.pacotes where caixa_h = any($1)", [muitas.map((c) => c.idH)])).rows;
ok("o lote inteiro tem o mesmo xmin (uma transação só)", xmins.length === 1);
const ordemNoDisco = (await dono("select caixa_h from chat.pacotes where caixa_h = any($1) order by ctid", [muitas.map((c) => c.idH)])).rows.map((r) => b64(r.caixa_h));
ok("a posição no disco não é a ordem de chegada", ordemNoDisco.join() !== muitas.map((c) => b64(c.idH)).join());

// O cofre anônimo.
const cofre = { id: sorteio(32), pd: sorteio(32), pl: sorteio(32) };
const idCofre = resumo("alumia/r3/cofre-anonimo/caixa/v1", cofre.id);
const pdCofreH = resumo("alumia/r3/cofre-anonimo/deposito/v1", cofre.pd), plCofreH = resumo("alumia/r3/cofre-anonimo/leitura/v1", cofre.pl);
const gravar = (versao, tamanho = COFRE[0], gasto = sorteio(32), pd = cofre.pd) =>
  servidor("select chat.cofre_gravar($1, $2, $3, $4, $5, $6, $7) as r", [idCofre, pd, pdCofreH, plCofreH, versao, sorteio(tamanho), gasto]);
await espera("criar o cofre (versão 0, gasta um passe)", () => gravar(0), (r) => r.ok && r.versao === 1);
await espera("gravar com a versão lida", () => gravar(1, COFRE[1], null), (r) => r.ok && r.versao === 2);
await espera("gravar com versão velha: 'versao_ocupada'", () => gravar(1, COFRE[0], null), (r) => r.erro === "versao_ocupada");
await espera("gravar com outro passe de gravação: 'nao_encontrado'", () => gravar(2, COFRE[0], null, sorteio(32)), (r) => r.erro === "nao_encontrado");
await espera("tamanho fora das faixas: 'tamanho'", () => gravar(2, 1000, null), (r) => r.erro === "tamanho");
await espera("ler com o passe de leitura", () => servidor("select chat.cofre_ler($1, $2) as r", [idCofre, cofre.pl]), (r) => r.versao === 2 && Buffer.from(r.blob, "base64").length === COFRE[1]);
await espera("ler com outro passe: nulo, igual ao cofre que não existe", () => servidor("select chat.cofre_ler($1, $2) as r", [idCofre, sorteio(32)]), (r) => r === null);
await espera("criar outro cofre com um passe gasto: 'passe'", async () => {
  const g = sorteio(32);
  await servidor("select chat.cofre_gravar($1, $2, $3, $4, 0, $5, $6) as r", [sorteio(32), cofre.pd, pdCofreH, plCofreH, sorteio(COFRE[0]), g]);
  return servidor("select chat.cofre_gravar($1, $2, $3, $4, 0, $5, $6) as r", [sorteio(32), cofre.pd, pdCofreH, plCofreH, sorteio(COFRE[0]), g]);
}, (r) => r.erro === "passe");
await servidor("select chat.cofre_apagar($1, $2) as r", [idCofre, sorteio(32)]);
ok("apagar o cofre com o passe errado: fica", (await dono("select count(*)::int as n from chat.cofres where id_h = $1", [idCofre])).rows[0].n === 1);
await servidor("select chat.cofre_apagar($1, $2) as r", [idCofre, cofre.pl]);
ok("com o passe de leitura: sai", (await dono("select count(*)::int as n from chat.cofres where id_h = $1", [idCofre])).rows[0].n === 0);

// Apagar a caixa.
await servidor("select chat.caixa_apagar($1, $2) as r", [daAna.idH, sorteio(32)]);
ok("apagar a caixa com o passe errado: nada sai", (await contar(daAna)) > 0);
await servidor("select chat.caixa_apagar($1, $2) as r", [daAna.idH, daAna.pl]);
ok("com o passe de leitura: a caixa e os pacotes saem", (await contar(daAna)) === 0 && (await dono("select count(*)::int as n from chat.caixas where id_h = $1", [daAna.idH])).rows[0].n === 0);

// Quem tem o banco inteiro.
const colunas = (await dono("select table_name, column_name, data_type from information_schema.columns where table_schema = 'chat'")).rows;
ok("nenhuma coluna de conta, de hora ou de endereço no banco do chat",
  colunas.every((c) => !/uuid|timestamp|time|inet/.test(c.data_type) && !/usuario|conta|quem|autor|ip|endereco|criado/.test(c.column_name)),
  JSON.stringify(colunas.filter((c) => /uuid|timestamp|time|inet/.test(c.data_type) || /usuario|conta|quem|autor|ip|endereco|criado/.test(c.column_name))));
const tudo = JSON.stringify((await dono("select (select json_agg(c) from chat.caixas c) as a, (select json_agg(p) from chat.pacotes p) as b")).rows[0]);
ok("o id cru e os passes crus das caixas não estão no banco", ![daBia.id, daBia.pl, unica.id, pedidos.pl].some((x) => tudo.includes(Buffer.from(x).toString("hex"))));
await espera("a limpeza roda", () => servidor("select chat.limpeza() as r"), (r) => typeof r.pacotes === "number");
await pg.close();

// ═══════════════════ B e C. O servidor de verdade (em contêiner) ═══════════════════
const URL_CHAT = (process.env.CHAT_URL ?? "").replace(/\/$/, "");
if (!URL_CHAT) {
  console.log("\n(partes B e C NÃO rodaram: sem CHAT_URL. Rode pelo scripts/r3-servidor-conteiner.mjs, que sobe o servidor em contêiner.)");
} else {
  await import("./testar-r3-servidor-vivo.mjs").then((m) => m.testarVivo({ URL_CHAT, ok, espera, recusa, raiz }));
}

console.log(`\nServidor do chat separado (R3): ${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
