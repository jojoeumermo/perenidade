// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os metadados da R2 contra quem tem o BANCO INTEIRO (dono do Postgres: uma cópia lida com xmin, um gatilho de auditoria ou o WAL,
// que guardam a ordem das transações). Cinco pessoas ativam o chat e abrem três conversas pelas rotas anônimas de verdade
// (app/api/alumia/*), com o install.sql do ramo no PGlite; o atacante tenta ligar caixa a conta, passe a conta e listar quem fala com
// quem. Revisão final da R2: antes do conserto, os ataques A1, A1b, A2, A3, B1 e B2 abaixo FUNCIONAVAM (a lista sincronizada era
// gravada com sessão logo depois de cada chamada anônima; a caixa de sincronia nascia colada à publicação da conta; a pré-chave
// entregue era a de menor número). Agora o chat grava com sessão só no relógio próprio (lib/rede/chat/r2/navegador.ts: período fixo,
// fase sorteada), simulado aqui por uma volta do relógio de um aparelho a cada passo, em rodízio, sem ligação com quem fez o passo.
// O que fica (dito no relatório e no CHAT-PRIVADO.md): com pouquíssimo tráfego, a coincidência ainda acerta por acaso; o servidor ao
// vivo vê IP e horário; o chat da equipe e a urna têm limites próprios.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-r2-metadados.mjs
import http from "node:http";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const imp = (f) => import(pathToFileURL(path.join(RAIZ, f)).href);
const { criarBanco } = await imp("scripts/banco-local.mjs");
const { motorNoNode } = await imp("scripts/cifra-no-node.mjs");
const { spqrNoNode } = await imp("scripts/spqr-no-node.mjs");

const SERVICO = "chave-de-servico-de-teste"; // gitleaks:allow (valor de teste)
const ANON = "chave-publica-de-teste"; // gitleaks:allow (valor de teste)
let rpcComo = null;
const servidorFalso = http.createServer(async (req, res) => {
  let corpo = "";
  for await (const p of req) corpo += p;
  const bearer = /^Bearer (.+)$/.exec(req.headers.authorization ?? "")?.[1];
  res.setHeader("Content-Type", "application/json");
  if (req.url === "/auth/v1/user") {
    if (bearer?.startsWith("conta.")) return res.end(JSON.stringify({ id: bearer.slice(6), email_confirmed_at: "2026-01-01" }));
    res.statusCode = 401;
    return res.end("{}");
  }
  const m = /^\/rest\/v1\/rpc\/([a-z_0-9]+)$/.exec(req.url ?? "");
  if (!m) { res.statusCode = 404; return res.end("{}"); }
  try {
    res.end(JSON.stringify(await rpcComo(bearer, m[1], corpo ? JSON.parse(corpo) : {})));
  } catch (erro) {
    if (process.env.DEPURA) console.log("DEPURA", m[1], erro.message);
    res.statusCode = /permission denied/.test(erro.message) ? 401 : 400;
    res.end(JSON.stringify({ message: erro.message }));
  }
});
await new Promise((r) => servidorFalso.listen(0, "127.0.0.1", r));
const SUPA = `http://127.0.0.1:${servidorFalso.address().port}`;
Object.assign(process.env, {
  NEXT_PUBLIC_SUPABASE_URL: SUPA, NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON, SUPABASE_SERVICE_ROLE_KEY: SERVICO,
  ALUMIA_PASSES_SEGREDO: "segredo-dos-passes-de-teste-com-mais-de-32", // gitleaks:allow (valor de teste)
  ALUMIA_FRANQUIA_SEGREDO: "segredo-da-franquia-de-teste-com-mais-de-32", // gitleaks:allow (valor de teste)
});
const banco = await criarBanco();
const { dono, criarUsuario } = banco;
const agoraS = () => Math.floor(Date.now() / 1000);
const sessoes = new Map();
rpcComo = (bearer, funcao, argumentos) =>
  banco.exclusivo(async () => {
    let claims;
    if (bearer === SERVICO) claims = { role: "service_role" };
    else if (bearer?.startsWith("conta.")) claims = { role: "authenticated", sub: bearer.slice(6), aal: "aal2", session_id: sessoes.get(bearer.slice(6)), iat: agoraS() - 30, exp: agoraS() + 3600 };
    else claims = { role: "anon" };
    await banco.pg.query("select set_config('request.jwt.claims', $1, false), set_config('request.headers', '{}', false)", [JSON.stringify(claims)]);
    await banco.pg.exec(`set role ${claims.role}`);
    try {
      const nomes = Object.keys(argumentos);
      const valores = nomes.map((n) => {
        const v = argumentos[n];
        if (typeof v === "string" && /^\\x[0-9a-f]*$/i.test(v)) return Buffer.from(v.slice(2), "hex");
        return v !== null && typeof v === "object" ? JSON.stringify(v) : v;
      });
      const r = (await banco.pg.query(`select public.${funcao}(${nomes.map((n, i) => `${n} => $${i + 1}`).join(", ")}) as r`, valores)).rows[0]?.r ?? null;
      return JSON.parse(JSON.stringify(r, (k, v) => (v?.type === "Buffer" && Array.isArray(v.data) ? `\\x${Buffer.from(v.data).toString("hex")}` : v)));
    } finally {
      await banco.pg.exec("reset role");
    }
  });
const guardado = new Map();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (k) => guardado.get(k) ?? null, setItem: (k, v) => guardado.set(k, String(v)), removeItem: (k) => guardado.delete(k) } });
const ROTAS = {};
for (const r of ["caixa/lote", "caixa/buscar", "caixa/confirmar", "caixa/trocar", "caixa/apagar", "pedido", "pedido/desafio", "diretorio/ler", "diretorio/reivindicar", "passes/chave", "passes/emitir"]) {
  ROTAS[`/api/alumia/${r}`] = await imp(`app/api/alumia/${r}/route.ts`);
}
const fetchDoAparelho = async (url, init = {}) => {
  const caminho = String(url);
  const modulo = ROTAS[caminho];
  if (!modulo) throw new Error(`rota desconhecida ${caminho}`);
  return modulo[init.method === "GET" ? "GET" : "POST"](new Request(`http://alumia.test${caminho}`, init));
};
let contaAtual = null;
const { configurarTransporte } = await imp("lib/rede/caixas/transporte.ts");
configurarTransporte({
  fetch: fetchDoAparelho, base: "",
  tokenDaConta: async () => (contaAtual ? `conta.${contaAtual}` : null),
  rpcComSessao: async (funcao, argumentos) => {
    const r = await fetch(`${SUPA}/rest/v1/rpc/${funcao}`, { method: "POST", headers: { Authorization: `Bearer ${contaAtual ? `conta.${contaAtual}` : ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(argumentos) });
    const corpo = await r.json();
    if (!r.ok) throw Object.assign(new Error(corpo.message), { code: corpo.message });
    return corpo;
  },
});
const NOMES = ["ana", "bia", "caio", "duda", "eva"];
const P = {};
for (const nome of NOMES) {
  P[nome] = await criarUsuario(`${nome}@meta.local`, `Pessoa ${nome}`);
  sessoes.set(P[nome], crypto.randomUUID());
  await rpcComo(`conta.${P[nome]}`, "eu", {}).catch(() => undefined);
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of NOMES) {
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome], `Codinome ${nome}`, `meta_${nome}`]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}
await dono("update auth.users set created_at = now() - interval '30 days'");
await dono("select interno.alumia_entrada_ligar(true)");
for (const nome of NOMES) await dono("insert into interno.alumia_entrada (usuario, situacao) values ($1, 'aprovada') on conflict (usuario) do update set situacao = 'aprovada'", [P[nome]]);

const { transporteDasCaixas } = await imp("lib/rede/chat/r2/transporte-das-caixas.ts");
const { ChatDoAparelho } = await imp("lib/rede/chat/r2/servico.ts");
const { cofreDaLista } = await imp("lib/rede/aparelhos/sincronia.ts");
const { resumoDaCaixa } = await imp("lib/rede/chat/r2/conversa.ts");
const M = await motorNoNode();
const SPQR = await spqrNoNode();
async function aparelho(usuario, codinome, chaves) {
  const historico = [];
  const deps = {
    motor: M.CoreCrypto.new(M.Database.inMemory()), spqr: SPQR, transporte: transporteDasCaixas(),
    historico: { async guardar(m) { if (!historico.some((x) => x.id === m.id && x.conversa === m.conversa)) historico.push(m); }, async apagar() {}, async apagarConversa() {} },
    cofre: cofreDaLista, persistir: async () => undefined, sigo: async () => false, conferirRegistro: async () => "confere",
  };
  contaAtual = usuario;
  const chat = await ChatDoAparelho.nascer(deps, usuario, codinome, chaves);
  contaAtual = null;
  return { chat, historico, usuario, como: async (f) => { contaAtual = usuario; try { return await f(chat); } finally { contaAtual = null; } } };
}


// ════════════════════ O ATACANTE COM O BANCO INTEIRO (dono do Postgres) ════════════════════
// "Acesso total ao banco" inclui o que o dono do Postgres faz sem pedir licença: ler xmin de qualquer linha (um SELECT traz) e
// instalar um gatilho de auditoria (ou ler o WAL/PITR, que guarda a mesma ordem, com a hora do commit). O gatilho abaixo NÃO muda nada
// do que a Alumia faz: só anota, por transação, a tabela, a chave da linha e a sessão que o PostgREST pôs em request.jwt.claims
// (auth.uid(); nula nas chamadas anônimas das caixas, que vão com a chave de serviço).
let certos = 0;
const falhas = [];
const ok = (nome, cond, detalhe = "") => {
  if (cond) certos++;
  else falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`);
};
const executar = (sql) => banco.exclusivo(() => banco.pg.exec(sql));
await executar(`
  create schema atacante;
  create table atacante.log (id bigserial primary key, xid bigint not null, tabela text not null, op text not null, chave text, quem uuid);
  create function atacante.anotar() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $f$
  declare r jsonb := to_jsonb(coalesce(new, old)); k text;
  begin
    k := case tg_table_name
      when 'caixas' then r ->> 'id_h'
      when 'pacotes' then r ->> 'caixa_h'
      when 'rede_cofres_da_conta' then r ->> 'usuario'
      when 'limites' then r ->> 'chave'
      when 'rede_consulta_votantes' then r ->> 'usuario'
      when 'rede_consulta_cifradas' then r ->> 'resumo'
      else null end;
    insert into atacante.log (xid, tabela, op, chave, quem) values (txid_current(), tg_table_name, tg_op, k, auth.uid());
    return coalesce(new, old);
  end $f$;
  create trigger z_atacante after insert or update or delete on interno.caixas for each row execute function atacante.anotar();
  create trigger z_atacante after insert on interno.pacotes for each row execute function atacante.anotar();
  create trigger z_atacante after insert or update on interno.rede_cofres_da_conta for each row execute function atacante.anotar();
  create trigger z_atacante after insert or update on interno.limites for each row execute function atacante.anotar();
`);
const semX = (s) => String(s ?? "").replace(/^\\x/, "");

// O dono também olha o diretório (pré-chaves e contas): toda gravação com sessão entra na linha do tempo.
await executar(`
  create trigger z_atacante after insert or update or delete on interno.diretorio_pre_chaves for each row execute function atacante.anotar();
  create trigger z_atacante after insert or update on interno.diretorio_contas for each row execute function atacante.anotar();
`);

// ════════════════════ 1. Dados de teste realistas (beta fechado, pouco tráfego) ════════════════════
// Cinco pessoas ativam o chat; três conversas (Ana↔Bia, Caio↔Duda, Eva↔Ana): pedidos, aceites e mensagens nos dois sentidos,
// intercalados entre as conversas. Entre um passo e outro, o relógio de UM aparelho dá uma volta (rodízio fixo, sem ligação com
// quem fez o passo): a parte com sessão de um, a sem sessão de outro (as fases sorteadas de cada aparelho não coincidem).
const D = {};
for (const n of NOMES) D[n] = await aparelho(P[n], `Codinome ${n}`);
const RODIZIO = ["eva", "caio", "ana", "duda", "bia"];
let volta = 0;
async function relogio() {
  const anonimo = D[RODIZIO[(volta + 2) % RODIZIO.length]];
  const comSessao = D[RODIZIO[volta % RODIZIO.length]];
  volta++;
  await anonimo.como((c) => c.rotinaAnonima());
  await comSessao.como((c) => c.rotinaComSessao());
}
for (let i = 0; i < RODIZIO.length * 2; i++) await relogio();
const C = {};
const passos = [
  async () => { C.AB = await D.ana.como((c) => c.pedirConversa("Codinome bia", "oi")); },
  async () => { C.CD = await D.caio.como((c) => c.pedirConversa("Codinome duda", "oi")); },
  () => D.bia.como((c) => c.receberPedidos()),
  () => D.bia.como((c) => c.aceitar(C.AB)),
  async () => { C.EA = await D.eva.como((c) => c.pedirConversa("Codinome ana", "oi")); },
  () => D.duda.como((c) => c.receberPedidos()),
  () => D.duda.como((c) => c.aceitar(C.CD)),
  () => D.ana.como((c) => c.receber()),
  () => D.ana.como((c) => c.receberPedidos()),
  () => D.ana.como((c) => c.aceitar(C.EA)),
  ...["caio", "eva", "bia", "duda"].map((n) => () => D[n].como((c) => c.receber())),
  () => D.ana.como((c) => c.mandarTexto(C.AB, "msg ana->bia")),
  () => D.caio.como((c) => c.mandarTexto(C.CD, "msg caio->duda")),
  () => D.eva.como((c) => c.mandarTexto(C.EA, "msg eva->ana")),
  () => D.bia.como((c) => c.receber()),
  () => D.bia.como((c) => c.mandarTexto(C.AB, "msg bia->ana")),
  () => D.duda.como((c) => c.receber()),
  () => D.ana.como((c) => c.receber()),
  () => D.ana.como((c) => c.mandarTexto(C.EA, "msg ana->eva")),
];
for (const p of passos) {
  await p();
  await relogio();
}

// A verdade (só o teste sabe; o atacante não usa): de quem é cada caixa.
const hex = (b) => Buffer.from(b).toString("hex");
const b64u = (s) => Buffer.from(s, "base64url");
const nomeDe = new Map(Object.entries(P).map(([n, u]) => [u, n]));
const verdade = new Map();
for (const [nome, d] of Object.entries(D)) {
  const e = d.chat.estado;
  verdade.set(hex(resumoDaCaixa(b64u(e.aparelho.sincronia.id))), { dono: nome, papel: "sincronia" });
  for (const [id, a] of Object.entries(e.porConversa)) verdade.set(hex(resumoDaCaixa(b64u(a.caixa.id))), { dono: nome, papel: "entrada", com: nomeDe.get(e.lista.conversas[id].com) });
}
const PARES = new Set(["ana|bia", "caio|duda", "ana|eva"]);
const par = (a, b) => [a, b].sort().join("|");
ok("(verdade) as conversas abriram nos cinco aparelhos", NOMES.every((n) => Object.values(D[n].chat.estado.lista.conversas).some((c) => c.situacao === "aberta")));
ok("(verdade) as mensagens chegaram", D.bia.historico.some((m) => m.texto === "msg ana->bia") && D.ana.historico.some((m) => m.texto === "msg bia->ana") && D.duda.historico.some((m) => m.texto === "msg caio->duda"));
ok("(verdade) as caixas de sincronia foram criadas pela rotina sem sessão", NOMES.every((n) => D[n].chat.estado.aparelho.sincroniaCriada === true));

// ════════════════════ 2. Uma cópia do banco (um SELECT; nada instalado antes) ════════════════════
const pedidosH = new Map((await dono("select usuario, encode(interno.caixa_resumo('alumia/r2/caixa', pedidos_caixa), 'hex') as h from interno.diretorio_contas")).rows.map((r) => [r.h, nomeDe.get(r.usuario)]));
{
  // A1. Antes: a caixa de sincronia nascia colada à publicação da conta (xmin da caixa = xmin de diretorio_contas − 1), 5 de 5.
  const contas = (await dono("select usuario, xmin::text::bigint as x from interno.diretorio_contas")).rows;
  const caixas = (await dono("select encode(id_h, 'hex') as h, xmin::text::bigint as x from interno.caixas")).rows;
  let acertos = 0;
  for (const c of contas) {
    const achada = caixas.filter((k) => Number(k.x) === Number(c.x) - 1 && !pedidosH.has(k.h));
    const v = achada.length === 1 ? verdade.get(achada[0].h) : null;
    if (v && v.dono === nomeDe.get(c.usuario) && v.papel === "sincronia") acertos++;
  }
  ok("A1 (era ataque) caixa ↔ conta pelo xmin vizinho ao do diretório: não acha nenhuma caixa de sincronia", acertos === 0, `${acertos} de ${contas.length}`);
  const gastos = (await dono("select xmin::text::bigint as x from interno.passes_gastos")).rows.map((r) => Number(r.x));
  const ligados = contas.filter((c) => gastos.includes(Number(c.x) - 1)).length;
  ok("A1b (era ataque) passe ↔ conta pelo mesmo xmin: nenhum", ligados === 0, `${ligados} de ${contas.length}`);
  // A2. Antes: a pré-chave entregue era a de menor número; o menor que sobra − 1 = quantas conversas a conta começou (5 de 5).
  const pre = (await dono("select a.usuario, min(p.id) as menor from interno.diretorio_pre_chaves p join interno.diretorio_aparelhos a using (aparelho) where not p.ultima group by a.usuario")).rows;
  const comecou = { ana: 1, bia: 0, caio: 1, duda: 0, eva: 1 };
  const comecaram = pre.filter((r) => comecou[nomeDe.get(r.usuario)] > 0);
  const certosA2 = comecaram.filter((r) => Number(r.menor) - 1 === comecou[nomeDe.get(r.usuario)]).length;
  ok("A2 (era ataque) quantas conversas cada conta começou pelo menor número de pré-chave: não acerta todas as que começaram", certosA2 < comecaram.length,
    JSON.stringify(Object.fromEntries(pre.map((r) => [nomeDe.get(r.usuario), Number(r.menor) - 1]))));
  // A3. A caixa de conversa mexida logo antes de uma gravação com sessão (lista, limites) é de uma das pontas?
  const sessao = [
    ...(await dono("select usuario, xmin::text::bigint as x from interno.rede_cofres_da_conta")).rows.map((r) => ({ x: Number(r.x), u: r.usuario })),
    ...(await dono("select chave, xmin::text::bigint as x from interno.limites")).rows.map((r) => ({ x: Number(r.x), u: /[0-9a-f-]{36}/.exec(r.chave)?.[0] })),
  ].filter((s) => s.u);
  const atribuidas = [];
  for (const k of caixas) {
    const s = sessao.filter((s) => s.x > Number(k.x) && s.x <= Number(k.x) + 2).sort((a, b) => a.x - b.x)[0];
    const v = verdade.get(k.h);
    if (s && v && v.papel === "entrada") atribuidas.push({ quem: nomeDe.get(s.u), v });
  }
  const certasA3 = atribuidas.filter((a) => a.quem === a.v.dono || a.quem === a.v.com).length;
  ok("A3 (era ataque) caixa de conversa ↔ uma das contas dela, só com a cópia: o vizinho com sessão não é sempre uma das pontas", atribuidas.length === 0 || certasA3 < atribuidas.length,
    JSON.stringify(atribuidas.map((a) => `${a.quem} → caixa de ${a.v.dono} (conversa com ${a.v.com})`)));
  // A rotina diária do banco regrava as caixas e os passes gastos numa transação só: a cópia tirada depois não tem ordem nenhuma.
  await dono("select interno.rede_caixas_limpeza()");
  const xc = (await dono("select count(distinct xmin::text)::int as n, count(*)::int as total from interno.caixas")).rows[0];
  const xp = (await dono("select count(distinct xmin::text)::int as n, count(*)::int as total from interno.passes_gastos")).rows[0];
  ok("limpeza diária: todas as caixas com o mesmo xmin (e nenhuma perdida)", xc.n === 1 && xc.total === caixas.length, JSON.stringify(xc));
  ok("limpeza diária: todos os passes gastos com o mesmo xmin (e nenhum perdido)", xp.n === 1 && xp.total === gastos.length, JSON.stringify(xp));
  const pacotes = (await dono("select count(*)::int as n from interno.pacotes")).rows[0].n;
  ok("limpeza diária: as caixas reescritas no lugar não levam os pacotes junto", pacotes > 0);
}

// ════════════════════ 3. O banco olhado enquanto roda (gatilho do dono, ou o WAL/PITR) ════════════════════
{
  const log = (await dono("select xid, tabela, op, chave, quem from atacante.log order by id")).rows.map((r) => ({ ...r, xid: Number(r.xid), chave: semX(r.chave) }));
  const proximaSessao = (i) => {
    for (let j = i + 1; j < log.length; j++) if (log[j].quem && log[j].xid > log[i].xid) return nomeDe.get(log[j].quem);
    return null;
  };
  // B1. Antes: o pedido cai na caixa de pedidos (que é da conta) e quem pediu gravava a lista logo depois: as 3 conversas, sem erro.
  const inferidos = new Set();
  const detalhe = [];
  log.forEach((e, i) => {
    if (e.tabela === "pacotes" && e.op === "INSERT" && !e.quem && pedidosH.has(e.chave)) {
      const quem = proximaSessao(i);
      const alvo = pedidosH.get(e.chave);
      if (quem && quem !== alvo) {
        inferidos.add(par(quem, alvo));
        detalhe.push(`${quem} pediu a ${alvo}?`);
      }
    }
  });
  const certosB1 = [...inferidos].filter((p) => PARES.has(p)).length;
  ok("B1 (era ataque) quem fala com quem pela sessão seguinte ao pedido: não acha as 3 conversas", certosB1 < PARES.size, `${certosB1} certas de ${inferidos.size} inferidas; ${detalhe.join("; ")}`);
  // B2. Antes: quem criou cada caixa de conversa era a sessão logo depois da criação anônima (6 de 6).
  const criador = new Map();
  log.forEach((e, i) => {
    if (!e.quem && e.tabela === "caixas" && e.op === "INSERT") criador.set(e.chave, proximaSessao(i));
  });
  let caixasDeConversa = 0;
  let criadorCerto = 0;
  for (const [h, v] of verdade) {
    if (v.papel !== "entrada") continue;
    caixasDeConversa++;
    if (criador.get(h) === v.dono) criadorCerto++;
  }
  ok("B2 (era ataque) quem criou cada caixa de conversa pela sessão seguinte: erra a maioria", caixasDeConversa === 6 && criadorCerto <= caixasDeConversa / 2, `${criadorCerto} de ${caixasDeConversa}`);
  // Nenhum evento grava com sessão: depois de nascer, toda gravação com sessão é da rotina (lista, o limite dela e pré-chaves).
  const nasceu = log.findIndex((e) => e.tabela === "rede_cofres_da_conta");
  const comSessao = log.slice(Math.max(nasceu, 0)).filter((e) => e.quem).map((e) => e.tabela);
  ok("com sessão, depois de nascer, só a lista, o limite dela e as pré-chaves (a rotina)", comSessao.every((t) => ["rede_cofres_da_conta", "limites", "diretorio_pre_chaves"].includes(t)), [...new Set(comSessao)].join());
}

servidorFalso.close();
console.log(`r2-metadados: ${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
