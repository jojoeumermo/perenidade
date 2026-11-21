// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Testes de propriedade (fast-check) das regras que atravessam o código da Alumia (onda R3, parte 4). Cada propriedade roda com
// centenas de casos sorteados; quando uma falha, o fast-check encolhe o caso até o menor que ainda falha e o mostra com a semente.
//   1. Nunca aceitar repetição: a ordem da conversa a dois (o mesmo contador não é "nova" duas vezes, em qualquer ordem de chegada);
//      o passe gasto no banco (cada resumo vale uma vez, em qualquer mistura de repetidos, dentro do lote e entre lotes).
//   2. Nunca mostrar número abaixo de 3: os pisos do banco (toda função interno.*_piso) e as funções da tela que limpam o que o
//      servidor manda (atos: corrente, tarefas, petição).
//   3. Nunca ligar caixa a conta: toda rota anônima recusa pedido com sessão ANTES de chamar o banco; as tabelas das caixas não têm
//      coluna que guarde conta; depois de contas mexerem nas caixas, nenhuma linha delas tem o id de uma conta (em texto ou em bytes).
//   4. decifrar(cifrar(x)) == x: o bloco da conversa (ler ∘ montar), o envelope X-Wing (abrir ∘ selar), o embrulho de época dos
//      grupos (desembrulhar ∘ embrulhar) e o selado (abrirSelado ∘ selar); e com outra chave, outra amarra ou um byte trocado, nada abre.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-r3-propriedades.mjs   (FC_CASOS=1000 para mais casos; FC_SEMENTE=n)
import crypto from "node:crypto";
import fc from "fast-check";
import { montar, ler, NADA_ANTES } from "../lib/rede/chat/r2/bloco.ts";
import { abrir, novoParXWing, selar, semanaDe } from "../lib/rede/chat/r2/envelope.ts";
import { ESTADO_NOVO, julgar } from "../lib/rede/chat/r2/ordem.ts";
import { abrirSelado, desembrulhar, embrulhar, selar as selarGrupo, TIPO } from "../lib/rede/grupos/embrulho-da-epoca.ts";
import { elosDaCorrente, elosValidos } from "../lib/rede/atos/corrente.ts";
import { limparPeticao, limparTarefas } from "../lib/rede/atos/quadros.ts";
import { montarAmbiente } from "./ferramentas/fuzz/ambiente.mjs";

const CASOS = Number(process.env.FC_CASOS ?? 200);
const SEMENTE = process.env.FC_SEMENTE ? Number(process.env.FC_SEMENTE) : undefined;
let falhas = 0;
let passaram = 0;

async function propriedade(nome, arbitrario, predicado, casos = CASOS) {
  try {
    await fc.assert(fc.asyncProperty(arbitrario, async (x) => (await predicado(x)) !== false), { numRuns: casos, seed: SEMENTE, endOnFailure: false });
    passaram++;
    console.log(`  ok    ${nome} (${casos} casos)`);
  } catch (erro) {
    falhas++;
    console.log(`  FALHA ${nome}\n${String(erro?.message ?? erro).split("\n").slice(0, 12).join("\n")}`);
  }
}
const ok = (nome, cond, detalhe = "") => {
  if (cond) {
    passaram++;
    console.log(`  ok    ${nome}`);
  } else {
    falhas++;
    console.log(`  FALHA ${nome}${detalhe ? `: ${detalhe}` : ""}`);
  }
};
const bytes = (n) => fc.uint8Array({ minLength: n, maxLength: n });
const iguais = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// ── 1. Nunca aceitar repetição ────────────────────────────────────────────────────────────────────────────────────────────────
console.log("1. nunca aceitar repetição");

await propriedade(
  "conversa a dois: cada contador é 'nova' uma vez só, em qualquer ordem e com qualquer repetição",
  fc.array(fc.integer({ min: 1, max: 40 }), { minLength: 1, maxLength: 120 }),
  (chegadas) => {
    let estado = ESTADO_NOVO;
    const novas = new Set();
    for (const contador of chegadas) {
      const resumo = new Uint8Array(32).fill(contador & 0xff);
      const j = julgar(estado, contador, contador === 1 ? NADA_ANTES : new Uint8Array(32).fill((contador - 1) & 0xff), resumo);
      if (j.juizo === "nova") {
        if (novas.has(contador)) return false;
        novas.add(contador);
        estado = j.estado;
      } else if (!novas.has(contador)) return false; // "repetida" só para o que já chegou
    }
    return novas.size === new Set(chegadas).size;
  },
  CASOS * 5,
);

const amb = await montarAmbiente({ contas: ["ana", "bia", "caio"] });
const { banco } = amb;
const um = async (sql, p = []) => (await banco.pg.query(sql, p)).rows[0];

await propriedade(
  "banco: cada resumo de passe gasto vale uma vez (interno.caixa_gastar), com repetidos misturados",
  fc.array(fc.integer({ min: 0, max: 15 }), { minLength: 1, maxLength: 40 }),
  async (escolhas) => {
    const prefixo = crypto.randomBytes(16);
    const vistos = new Set();
    for (const e of escolhas) {
      const resumo = Buffer.concat([prefixo, Buffer.alloc(16, e)]);
      const r = (await um("select interno.caixa_gastar($1) as ok", [resumo])).ok;
      if (r !== !vistos.has(e)) return false;
      vistos.add(e);
    }
    return true;
  },
  Math.max(50, CASOS / 2),
);

const b64 = (b) => Buffer.from(b).toString("base64");
const hoje = () => new Date().toISOString().slice(0, 10);
await propriedade(
  "banco: no lote (public.rede_caixa_lote), criar com um passe já gasto (no mesmo lote ou antes) é 'passe_usado'",
  fc.array(fc.integer({ min: 0, max: 5 }), { minLength: 1, maxLength: 12 }),
  async (escolhas) => {
    const prefixo = crypto.randomBytes(16);
    const passe = (e) => b64(Buffer.concat([prefixo, Buffer.alloc(16, e)]));
    const gastos = new Set();
    // Em lotes de até 4 itens, como chegam da rota (cada lote numa transação, os itens em ordem sorteada).
    for (let i = 0; i < escolhas.length; i += 4) {
      const parte = escolhas.slice(i, i + 4);
      const itens = parte.map((e) => ({ acao: "criar", id_h: b64(crypto.randomBytes(32)), pd_h: b64(crypto.randomBytes(32)), pl_h: b64(crypto.randomBytes(32)), multi: false, gastos: [passe(e)] }));
      const r = await amb.rpcComo("chave-de-servico-de-teste", "rede_caixa_lote", { p_itens: itens, p_dia: hoje() });
      const aceitos = r.resultados.filter((x) => x.ok).length;
      const novos = new Set(parte.filter((e) => !gastos.has(e)));
      if (aceitos !== novos.size) return false;
      parte.forEach((e) => gastos.add(e));
    }
    return true;
  },
  Math.max(40, CASOS / 4),
);

// ── 2. Nunca mostrar número abaixo de 3 ───────────────────────────────────────────────────────────────────────────────────────
console.log("2. nunca mostrar número abaixo de 3");

const pisos = (await banco.pg.query(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'interno' and p.proname ~ '_piso$' and p.pronargs = 1`)).rows.map((x) => x.proname);
ok("o banco tem funções de piso para conferir", pisos.length >= 2, pisos.join(", "));
for (const nome of pisos) {
  await propriedade(
    `banco: interno.${nome}(n) nunca dá 1 nem 2 (e dá n quando n ≥ 3)`,
    fc.oneof(fc.integer({ min: -5, max: 10 }), fc.integer({ min: -(2 ** 31), max: 2 ** 31 - 1 }), fc.constant(null)),
    async (n) => {
      const r = (await um(`select interno.${nome}($1) as v`, [n])).v;
      if (r === 1 || r === 2) return false;
      return n !== null && n >= 3 ? r === n : true;
    },
  );
}

const quantidade = fc.oneof(fc.integer({ min: -3, max: 8 }), fc.constant(null), fc.constant(undefined), fc.double(), fc.string());
await propriedade(
  "tela: elosDaCorrente e elosValidos nunca mostram 1 ou 2 respostas (abaixo de 3, nada)",
  fc.record({ respostas: quantidade, meta: fc.oneof(fc.integer({ min: -2, max: 60 }), fc.double()) }),
  ({ respostas, meta }) => {
    const e = elosDaCorrente(respostas, meta);
    if (typeof respostas === "number" && respostas < 3 && e !== null) return false;
    const v = elosValidos(e);
    return v === null || (Number.isFinite(v) && v >= 0);
  },
  CASOS * 5,
);
await propriedade(
  "tela: limparTarefas e limparPeticao nunca deixam passar total 1 ou 2",
  fc.record({ assumidas: quantidade, total: quantidade, organiza: fc.oneof(fc.boolean(), fc.anything()), extra: fc.anything() }),
  (q) => {
    const t = limparTarefas({ organiza: q.organiza, tarefas: [{ id: "x", item: "água", quantos: 3, assumidas: q.assumidas, extra: q.extra }] });
    const p = limparPeticao({ id: "p", ato: "a", alvo: "Prefeitura", texto: "texto", prazo: null, aberta: true, total: q.total, assinei: false, organiza: q.organiza });
    const numeros = JSON.stringify([t, p]).match(/"(total|assumidas)":(-?\d+(\.\d+)?)/g) ?? [];
    return numeros.every((par) => {
      const v = Number(par.split(":")[1]);
      return !(v === 1 || v === 2);
    });
  },
  CASOS * 5,
);

// ── 3. Nunca ligar caixa a conta ──────────────────────────────────────────────────────────────────────────────────────────────
console.log("3. nunca ligar caixa a conta");

// A voz com um TURN próprio de mentira (sem ele, a rota responde "desligada" antes de olhar a sessão, e a propriedade não chegaria lá).
process.env.VOZ_TURN_URLS = "turn:turn.exemplo.invalid:3478";
process.env.VOZ_TURN_SEGREDO = "segredo-do-turn-de-teste"; // gitleaks:allow (valor de teste)
const ROTAS_ANONIMAS = ["caixa/lote", "caixa/buscar", "caixa/confirmar", "caixa/trocar", "caixa/apagar", "pedido", "diretorio/ler", "diretorio/reivindicar", "voz/retransmissao"];
const rotas = Object.fromEntries(Object.entries(await amb.importarRotas(ROTAS_ANONIMAS.map((r) => `alumia/${r}`))).map(([k, v]) => [k.slice(7), v]));
await propriedade(
  "rota anônima: pedido com cookie de sessão ou Authorization que não é passe é recusado SEM chamar o banco",
  fc.record({
    rota: fc.constantFrom(...ROTAS_ANONIMAS),
    sessao: fc.oneof(
      fc.string({ minLength: 1, maxLength: 12 }).map((s) => ({ cookie: `sb-${s.replace(/[=;\s]/g, "x") || "x"}-auth-token=algo` })),
      fc.constantFrom("Bearer abc.def.ghi", "Basic dXNlcjpzZW5oYQ==", "token", "bearer conta").map((a) => ({ authorization: a })), // gitleaks:allow (valor de teste)
      fc.string({ minLength: 1, maxLength: 12 }).map((s) => ({ cookie: `outro=1; sb-${s.replace(/[=;\s]/g, "x") || "x"}=2` })),
    ),
    corpo: fc.jsonValue(),
  }),
  async ({ rota, sessao, corpo }) => {
    amb.chamadas.length = 0;
    const cab = new Headers({ "content-type": "application/json" });
    for (const [k, v] of Object.entries(sessao)) cab.set(k, v);
    const r = await rotas[rota].POST(new Request(`http://alumia.test/api/alumia/${rota}`, { method: "POST", headers: cab, body: JSON.stringify(corpo) }));
    const j = await r.json();
    return r.status === 400 && j.erro === "sem_sessao_aqui" && amb.chamadas.length === 0;
  },
);

// As tabelas das caixas e dos passes: nenhuma coluna uuid, nenhuma chave estrangeira, nenhum nome de coluna que diga conta.
const TABELAS_ANONIMAS = ["caixas", "pacotes", "caixa_contagem", "passes_gastos"];
const colunas = (await banco.pg.query(`select table_name t, column_name c, data_type d from information_schema.columns where table_schema = 'interno' and table_name = any($1)`, [TABELAS_ANONIMAS])).rows;
ok("as tabelas das caixas existem e têm colunas", new Set(colunas.map((x) => x.t)).size === TABELAS_ANONIMAS.length);
ok("nenhuma coluna das caixas é uuid nem tem nome de conta", colunas.every((x) => x.d !== "uuid" && !/usuario|conta|autor|perfil|quem|email|sessao/.test(x.c)), colunas.filter((x) => x.d === "uuid" || /usuario|conta|autor|perfil|quem|email|sessao/.test(x.c)).map((x) => `${x.t}.${x.c}`).join(", "));
const estrangeiras = (await banco.pg.query(`select conrelid::regclass::text r, confrelid::regclass::text a from pg_constraint where contype = 'f' and conrelid::regclass::text = any($1) and not (confrelid::regclass::text = any($1))`, [TABELAS_ANONIMAS.map((t) => `interno.${t}`)])).rows;
ok("nenhuma chave estrangeira sai das tabelas das caixas para fora delas", estrangeiras.length === 0, estrangeiras.map((x) => `${x.r} → ${x.a}`).join(", "));

await propriedade(
  "banco: depois de contas mexerem nas caixas (pelo lote, em qualquer mistura), nenhuma linha das caixas tem o id de uma conta",
  fc.array(fc.record({ quem: fc.constantFrom("ana", "bia", "caio"), acao: fc.constantFrom("criar", "depositar") }), { minLength: 1, maxLength: 10 }),
  async (passos) => {
    const minhas = new Map();
    for (const p of passos) {
      // A conta faz algo COM sessão (o que deixaria rastro, se algum gatilho gravasse quem) e logo depois mexe nas caixas.
      await amb.rpcComo(`conta.${amb.ids[p.quem]}`, "eu", {}).catch(() => undefined);
      const id_h = minhas.get(p.quem) ?? b64(crypto.randomBytes(32));
      const item = p.acao === "criar" || !minhas.has(p.quem)
        ? { acao: "criar", id_h, pd_h: b64(crypto.randomBytes(32)), pl_h: b64(crypto.randomBytes(32)), multi: true, gastos: [b64(crypto.randomBytes(32))] }
        : { acao: "depositar", id_h, pd: b64(crypto.randomBytes(32)), envelope: b64(crypto.randomBytes(3184)) };
      await amb.rpcComo("chave-de-servico-de-teste", "rede_caixa_lote", { p_itens: [item], p_dia: hoje() });
      minhas.set(p.quem, id_h);
    }
    const ids = Object.values(amb.ids);
    for (const t of TABELAS_ANONIMAS) {
      const linhas = (await banco.pg.query(`select to_jsonb(x)::text as j, (select string_agg(encode(v, 'hex'), '') from jsonb_each(to_jsonb(x)) e(k, w), lateral (select case when jsonb_typeof(w) = 'string' and w #>> '{}' ~ '^\\\\x' then decode(substr(w #>> '{}', 3), 'hex') end as v) z) as h from interno.${t} x`)).rows;
      for (const l of linhas) {
        for (const id of ids) {
          if (l.j.includes(id) || (l.h ?? "").includes(id.replace(/-/g, ""))) return false;
        }
      }
    }
    return true;
  },
  Math.max(20, CASOS / 10),
);

// ── 4. decifrar(cifrar(x)) == x ──────────────────────────────────────────────────────────────────────────────────────────────
console.log("4. decifrar(cifrar(x)) == x");

const blocoArb = fc.record({
  tipo: fc.constantFrom("texto", "controle", "anexo", "caixas"),
  conversa: bytes(16),
  id: bytes(16),
  contador: fc.integer({ min: 1, max: Number.MAX_SAFE_INTEGER }),
  anterior: bytes(32),
  prazo: fc.constantFrom(1, 7, 30),
  kf: bytes(32),
  corpo: fc.uint8Array({ maxLength: 4096 }),
});
await propriedade("bloco da conversa: ler(montar(b)) == b, e um byte a mais ou a menos não lê", blocoArb, (b) => {
  const m = montar(b);
  const l = ler(m);
  if (!l || l.tipo !== b.tipo || l.contador !== b.contador || l.prazo !== b.prazo) return false;
  for (const k of ["conversa", "id", "anterior", "kf", "corpo"]) if (!iguais(l[k], b[k])) return false;
  const maior = new Uint8Array(m.length + 1);
  maior.set(m);
  return ler(maior) === null && ler(m.subarray(0, m.length - 1)) === null;
}, CASOS * 5);
await propriedade("bloco da conversa: bytes quaisquer nunca derrubam o ler (null ou um bloco)", fc.uint8Array({ maxLength: 400 }), (x) => {
  const l = ler(x);
  return l === null || typeof l.contador === "number";
}, CASOS * 10);

const parA = await novoParXWing();
const parB = await novoParXWing();
await propriedade(
  "envelope X-Wing: abrir(selar(d)) == d; com a outra chave, outra semana, outro c ou um byte trocado, null",
  // O de dentro da R3 (frente pq-trafego-mixnet): a camada pós-quântica (com o Proteus dentro) e, no começo da sessão, a auth_key do SPQR.
  fc.record({ tipo: fc.constantFrom("mensagem", "sincronia"), aparelho: bytes(32), camada: fc.uint8Array({ minLength: 1, maxLength: 2900 }), inicio: fc.option(bytes(32), { nil: null }), idH: bytes(32), c: bytes(32), troca: fc.nat() }),
  async ({ tipo, aparelho, camada, inicio, idH, c, troca }) => {
    const semana = semanaDe();
    const pacote = await selar(parA.publica, semana, idH, c, { tipo, aparelho, inicio, camada });
    const d = await abrir(parA.privada, semana, idH, c, pacote);
    if (!d || d.tipo !== tipo || !iguais(d.aparelho, aparelho) || !iguais(d.camada, camada)) return false;
    if (inicio === null ? d.inicio !== null : !d.inicio || !iguais(d.inicio, inicio)) return false;
    if ((await abrir(parB.privada, semana, idH, c, pacote)) !== null) return false;
    if ((await abrir(parA.privada, semana - 1, idH, c, pacote)) !== null) return false;
    const outroC = Uint8Array.from(c);
    outroC[0] ^= 1;
    if ((await abrir(parA.privada, semana, idH, outroC, pacote)) !== null) return false;
    const mexido = Uint8Array.from(pacote);
    mexido[troca % mexido.length] ^= 0x80;
    return (await abrir(parA.privada, semana, idH, c, mexido)) === null;
  },
  Math.max(30, CASOS / 4),
);

await propriedade(
  "embrulho de época (grupos): desembrulhar(embrulhar(x)) == x; outra chave, outra amarra, outro tipo ou um byte trocado, null",
  fc.record({ chave: bytes(32), amarra: bytes(32), epoca: fc.bigInt({ min: 0n, max: 2n ** 64n - 1n }), tipo: fc.constantFrom(TIPO.commit, TIPO.aplicacao), x: fc.uint8Array({ maxLength: 9000 }), troca: fc.nat() }),
  async ({ chave, amarra, epoca, tipo, x, troca }) => {
    const e = await embrulhar(chave, amarra, epoca, tipo, x);
    const d = await desembrulhar(chave, amarra, e, tipo);
    if (!d || d.epoca !== epoca || !iguais(d.bytes, x)) return false;
    const outra = Uint8Array.from(chave);
    outra[0] ^= 1;
    const outraAmarra = Uint8Array.from(amarra);
    outraAmarra[31] ^= 1;
    if ((await desembrulhar(outra, amarra, e, tipo)) !== null || (await desembrulhar(chave, outraAmarra, e, tipo)) !== null) return false;
    if ((await desembrulhar(chave, amarra, e, tipo === TIPO.commit ? TIPO.aplicacao : TIPO.commit)) !== null) return false;
    const mexido = Uint8Array.from(e);
    mexido[troca % mexido.length] ^= 0x01;
    return (await desembrulhar(chave, amarra, mexido, tipo)) === null;
  },
  CASOS,
);

await propriedade(
  "selado (XChaCha20-Poly1305): abrirSelado(selar(x)) == x; outro aad ou um byte trocado, null",
  fc.record({ chave: bytes(32), x: fc.uint8Array({ maxLength: 2000 }), aad: fc.uint8Array({ maxLength: 64 }), troca: fc.nat() }),
  async ({ chave, x, aad, troca }) => {
    const s = await selarGrupo(chave, x, aad);
    const a = await abrirSelado(chave, s, aad);
    if (!a || !iguais(a, x)) return false;
    const outroAad = new Uint8Array([...aad, 1]);
    if ((await abrirSelado(chave, s, outroAad)) !== null) return false;
    const mexido = Uint8Array.from(s);
    mexido[troca % mexido.length] ^= 0x04;
    return (await abrirSelado(chave, mexido, aad)) === null;
  },
  CASOS * 2,
);

// ── 5. As propriedades pegam o erro (o teste falharia antes) ──────────────────────────────────────────────────────────────────
// Cada propriedade de cima, contra uma versão QUEBRADA de propósito do que ela protege: tem de achar um contraexemplo. Assim o teste
// prova que não passaria com o defeito (o "falha antes" de cada item).
console.log("5. as propriedades pegam a versão quebrada");
const achaContraexemplo = async (arbitrario, predicado) => (await fc.check(fc.asyncProperty(arbitrario, async (x) => (await predicado(x)) !== false), { numRuns: 300, seed: SEMENTE })).failed;

ok(
  "ordem sem a lista do que já chegou acima (aceita o mesmo contador duas vezes) é pega",
  await achaContraexemplo(fc.array(fc.integer({ min: 1, max: 10 }), { minLength: 2, maxLength: 30 }), (chegadas) => {
    let estado = ESTADO_NOVO;
    const novas = new Set();
    for (const contador of chegadas) {
      const j = julgar({ ...estado, acima: [] }, contador, contador === 1 ? NADA_ANTES : new Uint8Array(32), new Uint8Array(32));
      if (j.juizo === "nova") {
        if (novas.has(contador)) return false;
        novas.add(contador);
        estado = j.estado;
      }
    }
    return true;
  }),
);
await banco.pg.exec("create or replace function pg_temp.piso_quebrado(p_n bigint) returns integer language sql immutable as $$ select case when p_n >= 1 then p_n::integer end $$");
ok(
  "um piso de 1 em vez de 3 é pego",
  await achaContraexemplo(fc.integer({ min: -5, max: 10 }), async (n) => {
    const r = (await um("select pg_temp.piso_quebrado($1) as v", [n])).v;
    return !(r === 1 || r === 2);
  }),
);
ok(
  "um selado que abre com qualquer aad é pego",
  await achaContraexemplo(fc.record({ chave: bytes(32), x: fc.uint8Array({ maxLength: 64 }), aad: fc.uint8Array({ maxLength: 8 }) }), async ({ chave, x, aad }) => {
    const s = await selarGrupo(chave, x, aad);
    const abrirQuebrado = (k, sel) => abrirSelado(k, sel, aad); // ignora o aad que pedem
    return (await abrirQuebrado(chave, s, new Uint8Array([...aad, 1]))) === null;
  }),
);
ok(
  "uma rota anônima que não olha a sessão é pega",
  await achaContraexemplo(fc.record({ corpo: fc.jsonValue() }), async ({ corpo }) => {
    amb.chamadas.length = 0;
    // A rota de buscar, chamada como se o pedido não tivesse cookie (o que uma rota sem trazSessao faria): chega ao banco.
    const r = await rotas["caixa/buscar"].POST(new Request("http://alumia.test/api/alumia/caixa/buscar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: Buffer.alloc(32, 1).toString("base64url"), pl: Buffer.alloc(32, 2).toString("base64url"), cursor: 0, corpo }) }));
    await r.text();
    return amb.chamadas.length === 0;
  }),
);

await amb.fechar();
console.log(`\n${passaram} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
