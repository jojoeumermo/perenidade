// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o fórum da comunidade da onda 10 (supabase/migracoes/20261116-alumia-o10-forum.sql) num Postgres de verdade
// (scripts/banco-local.mjs), com a migração rodada TRÊS vezes sobre o install.sql:
//   · a lista: só tópicos (discussão, dúvida ou levado ao fórum), as três ordens cronológicas com a regra igual para todos, os
//     filtros de situação e etiqueta, os fixados à parte, a página de 30 sem repetir nem pular, e só o que quem lê pode ver;
//   · a situação do tópico (aberto, encaminhado, resolvido): quem abriu ou a moderação; a dúvida com resposta marcada já resolvida;
//   · o resumo de uma linha: até 140, numa linha, sem dado pessoal, e só o papel de quem escreveu (nunca a pessoa);
//   · virar tópico: a autora ou a moderação dos dois lugares, o tópico novo cita o original, a marca "continua em" só para quem
//     pode ver, uma vez por comunidade, e o aviso à autora sem dizer quem levou;
//   · "até onde li" no aparelho (lib/rede/leitura-conversa.ts) e as contas da tela (lib/rede/forum-conversa.ts);
//   · os textos nas seis línguas.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-alumia-o10-forum.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { ESTADOS_DO_TOPICO, LIMITES_DO_FORUM, ORDENS_DO_FORUM, resumoCabe, resumoEmUmaLinha, topicosDeExemplo, tituloSugerido } from "../lib/rede/forum-conversa.ts";
import { anotar, CHAVE_DA_LEITURA, gravarRegistro, lerRegistro, lidoAte, maisNova, MAX_CONVERSAS_LIDAS, respostasNovas, temNovidade } from "../lib/rede/leitura-conversa.ts";
import { PREFIXO_DA_REDE } from "../lib/rede/saida.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");

let certos = 0;
const falhas = [];
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 600)}`);
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

// ═══════════════════ 0. O arquivo ═══════════════════
const sql = ler("supabase/migracoes/20261116-alumia-o10-forum.sql");
ok("toda função nova é security definer com search_path fixo", (() => {
  const funcoes = sql.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
  return funcoes.length === 9 && funcoes.every((f) => /security definer set search_path = interno, pg_temp/.test(f));
})());
const tabelas = [...sql.matchAll(/create table if not exists interno\.([a-z_]+)/g)].map((m) => m[1]);
ok("a tabela nova nasce com RLS e sem permissão para anon e authenticated", tabelas.length === 1
  && tabelas.every((t) => sql.includes(`alter table interno.${t} enable row level security`)) && !/grant [a-z, ]+ on (table )?interno\./i.test(sql));
ok("nenhuma tabela guarda endereço de rede", !(sql.match(/create table if not exists interno\.[a-z_]+ \([\s\S]*?\n\);/g) ?? []).some((t) => /\b(inet|cidr|endereco|ip|porta)\b/.test(t)));
ok("a tabela não tem coluna de pessoa (o resumo guarda só o papel)", (() => {
  const t = sql.match(/create table if not exists interno\.alumia_forum_topicos \([\s\S]*?\n\);/)?.[0] ?? "";
  return t.length > 0 && !/\b(usuario|quem|autor|pessoa|conta|por)\s+uuid/.test(t) && /resumo_de text/.test(t);
})());
ok("não mexe na versão da Alumia nem no install.sql, e termina passando a porta em tudo", !/function public\.rede_alumia_versao/.test(sql) && /select interno\.alumia_trancar\(\);\s*$/.test(sql));
ok("os limites da tela são os do banco", sql.includes(`char_length(resumo) between 1 and ${LIMITES_DO_FORUM.resumo}`)
  && sql.includes(`'resumo', 1, ${LIMITES_DO_FORUM.resumo}`) && sql.includes(`limit ${LIMITES_DO_FORUM.pagina + 1}`)
  && sql.includes(`> ${LIMITES_DO_FORUM.pagina}`) && sql.includes(`char_length(v_etiqueta) > ${LIMITES_DO_FORUM.etiqueta}`));
ok("as situações e as ordens da tela são as do banco", ESTADOS_DO_TOPICO.every((e) => sql.includes(`'${e}'`))
  && sql.includes(`estado in (${ESTADOS_DO_TOPICO.map((e) => `'${e}'`).join(", ")})`)
  && sql.includes(`v_ordem not in (${ORDENS_DO_FORUM.map((o) => `'${o}'`).join(", ")})`));
ok("a ordem da lista não usa reação, apoio nem nada de quem lê", (() => {
  const lista = sql.slice(sql.indexOf("function public.alumia_forum_lista"), sql.indexOf("-- ── 4."));
  return lista.length > 0 && !/rede_reacoes|rede_apoios|util|apoio|seguindo/.test(lista);
})());

// ═══════════════════ 0b. As contas da tela ═══════════════════
ok("resumo numa linha só", resumoEmUmaLinha("  um\nresumo\t com   quebras  ") === "um resumo com quebras");
ok("resumo de 140 cabe; de 141 não; vazio cabe (tira)", resumoCabe("a".repeat(140)) && !resumoCabe("a".repeat(141)) && resumoCabe("   "));
ok("título sugerido: curto fica, longo corta na palavra e cabe entre 5 e 140", (() => {
  const curto = tituloSugerido("Assembleia na terça");
  const longo = tituloSugerido("Precisamos combinar quem leva a faixa, quem leva água e quem fica no ponto de encontro da estação até o fim do ato de quinta");
  return curto === "Assembleia na terça" && longo.endsWith("…") && longo.length <= 82 && longo.length >= 5 && !/\s…$/.test(longo);
})());
ok("a prévia ordena como o banco: última resposta, mais novos e sem resposta", (() => {
  const u = topicosDeExemplo("x", { ordem: "ultima" }).itens;
  const n = topicosDeExemplo("x", { ordem: "novos" }).itens;
  const s = topicosDeExemplo("x", { ordem: "sem_resposta" }).itens;
  const desc = (l, k) => l.every((t, i) => i === 0 || l[i - 1][k] >= t[k]);
  return desc(u, "ultima_em") && desc(n, "criado_em") && s.length > 0 && s.every((t) => t.respostas === 0) && topicosDeExemplo("x").fixados.every((t) => t.fixado);
})());

// "Até onde li": só no aparelho.
{
  const falso = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), mapa: m }; };
  ok("a chave da leitura começa com o prefixo que o Sair rápido apaga", CHAVE_DA_LEITURA.startsWith(PREFIXO_DA_REDE));
  ok("registro vazio, corrompido ou sem armazenamento vira vazio", JSON.stringify(lerRegistro(null)) === "{}" && (() => {
    const a = falso(); a.setItem(CHAVE_DA_LEITURA, "{quebrado"); return JSON.stringify(lerRegistro(a)) === "{}";
  })() && (() => { const a = falso(); a.setItem(CHAVE_DA_LEITURA, '{"x":"não é data","y":"2026-11-10T10:00:00Z"}'); return JSON.stringify(lerRegistro(a)) === '{"y":"2026-11-10T10:00:00Z"}'; })());
  ok("anotar nunca volta para trás", lidoAte(anotar({ a: "2026-11-10T12:00:00Z" }, "a", "2026-11-10T09:00:00Z"), "a") === "2026-11-10T12:00:00Z"
    && lidoAte(anotar({ a: "2026-11-10T12:00:00Z" }, "a", "2026-11-10T13:00:00Z"), "a") === "2026-11-10T13:00:00Z");
  ok(`no máximo ${MAX_CONVERSAS_LIDAS} conversas; saem as vistas há mais tempo`, (() => {
    let r = {};
    for (let i = 0; i < MAX_CONVERSAS_LIDAS + 5; i++) r = anotar(r, `c${i}`, "2026-11-10T10:00:00Z");
    r = anotar(r, "c6", "2026-11-11T10:00:00Z");
    const k = Object.keys(r);
    return k.length === MAX_CONVERSAS_LIDAS && !k.includes("c0") && !k.includes("c4") && k.includes("c5") && k[k.length - 1] === "c6";
  })());
  ok("gravar e ler de novo devolve o mesmo", (() => { const a = falso(); const r = anotar({}, "z", "2026-11-10T10:00:00Z"); gravarRegistro(a, r); return lidoAte(lerRegistro(a), "z") === "2026-11-10T10:00:00Z"; })());
  const resp = [
    { id: "1", criado_em: "2026-11-10T10:00:00Z" }, { id: "2", criado_em: "2026-11-10T12:00:00Z", meu: true },
    { id: "3", criado_em: "2026-11-10T13:00:00Z" }, { id: "4", criado_em: "2026-11-10T11:30:00Z" },
  ];
  ok("novas na ordem da tela, sem as da própria pessoa", JSON.stringify(respostasNovas(resp, "2026-11-10T11:00:00Z").map((r) => r.id)) === '["3","4"]');
  ok("primeira visita: nada é novo", respostasNovas(resp, null).length === 0);
  ok("a mais nova é a mais nova", maisNova(resp) === "2026-11-10T13:00:00Z" && maisNova([]) === null);
  ok("marca de novidade na lista só depois de uma visita", temNovidade({ t: "2026-11-10T10:00:00Z" }, "t", "2026-11-10T11:00:00Z")
    && !temNovidade({ t: "2026-11-10T10:00:00Z" }, "t", "2026-11-10T09:00:00Z") && !temNovidade({}, "t", "2026-11-10T11:00:00Z"));
}

// Os textos: as seis línguas com as mesmas chaves e os mesmos marcadores {x}; nenhuma palavra proibida.
{
  const formas = (v, p = "", out = new Map()) => {
    if (Array.isArray(v)) { out.set(p, `lista:${v.length}`); v.forEach((x, i) => formas(x, `${p}[${i}]`, out)); }
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { if (k !== "_rascunho") formas(x, p ? `${p}.${k}` : k, out); }
    else out.set(p, typeof v === "string" ? `texto:${(v.match(/\{\w+\}/g) ?? []).sort().join()}${v.trim() ? "" : ":vazio"}` : typeof v);
    return out;
  };
  const pt = JSON.parse(ler("i18n/rede/forum/pt.json"));
  const base = formas(pt);
  for (const l of ["en", "es", "fr", "ru", "zh"]) {
    const outro = JSON.parse(ler(`i18n/rede/forum/${l}.json`));
    const f = formas(outro);
    const dif = [...base].filter(([k, v]) => f.get(k) !== v).map(([k]) => k).concat([...f.keys()].filter((k) => !base.has(k)));
    ok(`forum/${l}.json tem as mesmas chaves e marcadores do pt${dif.length ? ` (difere em ${dif.slice(0, 4).join(", ")})` : ""}`, dif.length === 0);
    ok(`forum/${l}.json está marcado como rascunho`, outro._rascunho === true);
  }
  ok("nenhum texto vazio no pt", ![...base.values()].some((v) => v.endsWith(":vazio")));
  ok("os textos novos não usam \"diploma\", \"universidade\" nem \"algoritmo\"", !/diploma|universidade|algoritmo/i.test(JSON.stringify(pt)));
  ok("toda situação e toda ordem têm texto e regra", ESTADOS_DO_TOPICO.every((e) => pt.estado[e] && pt.estado.regra[e] && pt.estado.filtro[e])
    && ORDENS_DO_FORUM.every((o) => pt.ordem[o] && pt.ordem.regra[o]));
  ok("todo erro novo do banco tem texto", ["ja_virou", "invalido:topico", "invalido:estado", "invalido:resumo"].every((c) => typeof pt.erros[c] === "string"));
}

// ═══════════════════ 1. Banco e pessoas ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
const como = (sub) => ({ papel: "authenticated", sub, aal: "aal2" });
const visitante = { papel: "anon" };
const zerar = () => dono("delete from interno.limites");

await espera("a migração instala sobre o install.sql", () => exec(sql));
await espera("de novo (idempotente)", () => exec(sql));
await espera("e uma terceira vez sem estrago", () => exec(sql));
await espera("a regra da porta não deixa nenhuma função aberta", async () => (await dono("select interno.alumia_trancar() as r")).rows[0].r, (r) => r.abertas.length === 0);
await espera("toda função pública nova passa pela porta", async () =>
  (await dono(`select p.proname, p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'alumia\\_forum\\_%'`)).rows,
(rs) => rs.length === 5 && rs.every((r) => /interno\.alumia_porta\(\)/.test(r.prosrc)));
for (const t of tabelas) {
  await espera(`${t}: RLS ligada e nenhuma política`, async () => (await dono("select c.relrowsecurity as r, (select count(*)::int from pg_policies p where p.schemaname = 'interno' and p.tablename = $2) as n from pg_class c where c.oid = $1::regclass", [`interno.${t}`, t])).rows[0],
    (r) => r.r === true && r.n === 0);
}
await espera("as funções internas não abrem para anon nem para quem tem conta", async () =>
  (await dono(`select p.proname, has_function_privilege('anon', p.oid, 'execute') as a, has_function_privilege('authenticated', p.oid, 'execute') as b
               from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'interno' and p.proname like 'alumia\\_o10\\_%'`)).rows,
(rs) => rs.length >= 4 && rs.every((r) => !r.a && !r.b)); // o prefixo alumia_o10_ é de todas as frentes da onda 10: depois da junta são mais
await espera("mudar o fórum não abre para visitante", async () =>
  (await dono(`select p.proname, has_function_privilege('anon', p.oid, 'execute') as a from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname in ('alumia_forum_estado', 'alumia_forum_resumo', 'alumia_forum_virar')`)).rows,
(rs) => rs.length === 3 && rs.every((r) => !r.a));

const P = {};
const NOMES = ["coord", "mod", "mod2", "autora", "membro2", "fora"];
for (const nome of NOMES) {
  P[nome] = await criarUsuario(`${nome}@o10.local`, `Pessoa ${nome}`);
  await rpc(como(P[nome]), "eu");
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
await dono("delete from interno.papeis");
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao')", [P.coord]);
for (const nome of NOMES) {
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome], `Codinome ${nome}`, `o10_${nome}`]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}
await dono("update auth.users set created_at = now() - interval '60 days'");
await dono(`insert into interno.rede_comunidades (slug, nome, categoria, tipo, publico_padrao) values
  ('o10-moradia', 'Moradia do teste', 'lutas', 'aberta', 'membros'),
  ('o10-estudo', 'Estudo do teste', 'lutas', 'aberta', 'membros'),
  ('o10-fechada', 'Fechada do teste', 'lutas', 'fechada', 'comunidade') on conflict do nothing`);
await dono(`insert into interno.rede_comunidade_membros (comunidade, usuario, papel) values
  ('o10-moradia', $1, 'moderacao'), ('o10-moradia', $2, 'moderacao'), ('o10-estudo', $2, 'moderacao'),
  ('o10-moradia', $3, 'membro'), ('o10-moradia', $4, 'membro'), ('o10-estudo', $3, 'membro'), ('o10-fechada', $3, 'membro')`,
  [P.mod, P.mod2, P.autora, P.membro2]);
await dono("insert into interno.rede_comunidade_flairs (comunidade, nome) values ('o10-moradia', 'Mutirão'), ('o10-moradia', 'Estudo') on conflict do nothing");

const A = como(P.autora);
const M = como(P.mod);
const M2 = como(P.mod2);
const B = como(P.membro2);
const publicar = async (quem, pedido) => { await zerar(); return rpc(quem, "rede_publicar", { p: pedido }); };
const topico = (quem, titulo, extra = {}) => publicar(quem, { tipo: "discussao", titulo, corpo: `${titulo}: corpo do tópico para o teste.`, comunidade: "o10-moradia", ...extra });
const responder = (quem, a, texto) => publicar(quem, { texto, resposta_a: a });
const lista = (quem, p = {}) => rpc(quem, "alumia_forum_lista", { p_slug: "o10-moradia", p });
const ids = (r) => r.itens.map((t) => t.id);
const passar = (ms) => new Promise((pronto) => setTimeout(pronto, ms));

// ═══════════════════ 2. A lista ═══════════════════
const tA = await espera("a autora abre uma dúvida", () => topico(A, "Como organizar a assembleia?", { tipo: "duvida", flair: "Estudo" }), (r) => r.id);
await passar(15);
const tB = await espera("outra pessoa abre uma discussão", () => topico(B, "Mutirão de sábado", { flair: "Mutirão" }), (r) => r.id);
await passar(15);
const pC = await espera("um post comum na comunidade", () => publicar(B, { texto: "um post comum, não é tópico", comunidade: "o10-moradia" }), (r) => r.id);
await passar(15);
const rA = await espera("uma resposta à dúvida (a mais antiga sobe na última resposta)", () => responder(B, tA.id, "Pauta curta e ata no mesmo dia."), (r) => r.id);

await espera("a lista traz só os tópicos, na ordem da última resposta", () => lista(A),
  (r) => JSON.stringify(ids(r)) === JSON.stringify([tA.id, tB.id]) && r.ordem === "ultima" && r.modero === false && r.pode_abrir === true
    && r.itens[0].respostas === 1 && r.itens[0].ultima_em > r.itens[0].criado_em && r.itens[1].respostas === 0 && !ids(r).includes(pC.id));
await espera("mais novos: pela abertura", () => lista(A, { ordem: "novos" }), (r) => JSON.stringify(ids(r)) === JSON.stringify([tB.id, tA.id]));
await espera("sem resposta: só quem espera a primeira", () => lista(A, { ordem: "sem_resposta" }), (r) => JSON.stringify(ids(r)) === JSON.stringify([tB.id]));
await espera("filtro por etiqueta", () => lista(A, { etiqueta: "Mutirão" }), (r) => JSON.stringify(ids(r)) === JSON.stringify([tB.id]));
await espera("as etiquetas da comunidade vêm junto, e a moderação se vê como moderação", () => lista(M), (r) => JSON.stringify(r.etiquetas) === '["Estudo","Mutirão"]' && r.modero === true);
await espera("o item não traz o id de ninguém: só o codinome de quem abriu", () => lista(B), (r) => {
  const texto = JSON.stringify(r);
  return r.itens.find((t) => t.id === tA.id).autor === "Codinome autora" && !NOMES.some((n) => texto.includes(P[n]));
});
await espera("visitante não vê o que é só de membros (lista vazia, sem erro)", () => lista(visitante), (r) => r.itens.length === 0 && r.pode_abrir === false);
await recusa("ordem desconhecida é recusada", () => lista(A, { ordem: "em_alta" }), "invalido:ordem");
await recusa("situação desconhecida é recusada", () => lista(A, { estado: "arquivado" }), "invalido:estado");
await recusa("marcador quebrado é recusado", () => lista(A, { depois: { t: "ontem", id: "x" } }), "invalido:depois");
await recusa("comunidade que não existe", () => rpc(A, "alumia_forum_lista", { p_slug: "nao-existe", p: {} }), "nao_encontrado");
await espera("quem silenciou uma pessoa não vê os tópicos dela", async () => {
  await dono("insert into interno.rede_silenciados (usuario, pessoa) values ($1, $2)", [P.mod2, P.membro2]);
  return lista(M2);
}, (r) => !ids(r).includes(tB.id) && ids(r).includes(tA.id));
await dono("delete from interno.rede_silenciados where usuario = $1", [P.mod2]);
await espera("o fixado vem à parte, só na primeira página", async () => {
  await dono("update interno.rede_posts set fixado = true where id = $1", [tB.id]);
  return lista(A);
}, (r) => r.fixados.length === 1 && r.fixados[0].id === tB.id && !ids(r).includes(tB.id));
await dono("update interno.rede_posts set fixado = false where id = $1", [tB.id]);

// A página de 30: 31 tópicos a mais (direto na tabela, como o dono), sem repetir nem pular.
await dono(`insert into interno.rede_posts (autor, texto, titulo, corpo, tipo, comunidade, publico, criado_em)
  select $1, 'tópico ' || g, 'Tópico em lote ' || g, 'corpo do tópico em lote ' || g, 'discussao', 'o10-moradia', 'membros', now() - (g || ' minutes')::interval
  from generate_series(1, 31) g`, [P.membro2]);
await espera("a página tem 30 e o marcador da próxima; a segunda traz o resto, sem repetir", async () => {
  const p1 = await lista(A, { ordem: "novos" });
  const p2 = await lista(A, { ordem: "novos", depois: p1.proximo });
  const todos = [...ids(p1), ...ids(p2)];
  return { n1: p1.itens.length, prox: p1.proximo, n2: p2.itens.length, fim: p2.proximo, unicos: new Set(todos).size, total: todos.length, fixados2: p2.fixados.length };
}, (r) => r.n1 === 30 && r.prox && r.n2 === 3 && r.fim === null && r.unicos === 33 && r.total === 33 && r.fixados2 === 0);

// ═══════════════════ 3. A situação do tópico ═══════════════════
await recusa("quem não abriu nem modera não muda a situação", () => rpc(B, "alumia_forum_estado", { p_post: tA.id, p_estado: "resolvido" }), "sem_permissao");
await recusa("post comum não é tópico", () => rpc(como(P.membro2), "alumia_forum_estado", { p_post: pC.id, p_estado: "resolvido" }), "invalido:topico");
await recusa("resposta não é tópico", () => rpc(A, "alumia_forum_estado", { p_post: rA.id, p_estado: "resolvido" }), "invalido:topico");
await recusa("situação desconhecida", () => rpc(A, "alumia_forum_estado", { p_post: tA.id, p_estado: "fechado" }), "invalido:estado");
await espera("a dúvida com a resposta marcada já aparece resolvida", async () => {
  await zerar();
  await rpc(A, "rede_conv_aceitar", { p_resposta: rA.id, p_sim: true });
  return lista(A);
}, (r) => r.itens.find((t) => t.id === tA.id)?.estado === "resolvido");
await espera("quem abriu reabre à mão (vale a escolha, mesmo com a resposta marcada)", async () => { await zerar(); return rpc(A, "alumia_forum_estado", { p_post: tA.id, p_estado: "aberto" }); },
  (r) => r.estado === "aberto" && r.id === tA.id);
await espera("a moderação encaminha", async () => { await zerar(); return rpc(M, "alumia_forum_estado", { p_post: tB.id, p_estado: "encaminhado" }); }, (r) => r.estado === "encaminhado");
await espera("filtro por situação", () => lista(A, { estado: "encaminhado" }), (r) => JSON.stringify(ids(r)) === JSON.stringify([tB.id]));
await espera("visitante não chama a mudança", () => rpc(visitante, "alumia_forum_estado", { p_post: tA.id, p_estado: "resolvido" }).then(() => false, () => true), (r) => r === true);

// ═══════════════════ 4. O resumo de uma linha ═══════════════════
await recusa("mais de 140 é recusado", async () => { await zerar(); return rpc(A, "alumia_forum_resumo", { p_post: tA.id, p_texto: "a".repeat(141) }); }, "invalido:resumo");
await recusa("dado pessoal não entra no resumo", async () => { await zerar(); return rpc(A, "alumia_forum_resumo", { p_post: tA.id, p_texto: "escreva para alguem@exemplo.org" }); }, "dado_pessoal");
await recusa("quem não abriu nem modera não escreve resumo", async () => { await zerar(); return rpc(B, "alumia_forum_resumo", { p_post: tA.id, p_texto: "Resumo de fora." }); }, "sem_permissao");
await espera("a autora escreve, e quebras viram uma linha", async () => { await zerar(); return rpc(A, "alumia_forum_resumo", { p_post: tA.id, p_texto: "Pauta curta,\n ata no mesmo dia." }); },
  (r) => r.resumo === "Pauta curta, ata no mesmo dia." && r.resumo_de === "autora");
await espera("a moderação troca: fica só o papel, nunca quem", async () => { await zerar(); return rpc(M, "alumia_forum_resumo", { p_post: tA.id, p_texto: "Pauta curta e rodízio de quem coordena." }); },
  (r) => r.resumo_de === "moderacao" && !JSON.stringify(r).includes(P.mod));
await espera("o resumo aparece na lista", () => lista(B), (r) => r.itens.find((t) => t.id === tA.id)?.resumo === "Pauta curta e rodízio de quem coordena.");
await espera("texto vazio tira o resumo", async () => { await zerar(); return rpc(A, "alumia_forum_resumo", { p_post: tA.id, p_texto: "   " }); }, (r) => r.resumo === null && r.resumo_de === null);

// ═══════════════════ 5. O tópico aberto ═══════════════════
await espera("de uma resposta, o fórum acha a raiz e diz que é tópico", () => rpc(A, "alumia_forum_topico", { p_post: rA.id }),
  (r) => r.raiz === tA.id && r.topico === true && r.item.id === tA.id && r.pode_mudar === true && r.modero === false && r.veio_de === null && r.continua.length === 0);
await espera("quem não abriu nem modera não muda; a moderação muda e se vê", async () => [await rpc(B, "alumia_forum_topico", { p_post: tA.id }), await rpc(M, "alumia_forum_topico", { p_post: tA.id })],
  ([b, m]) => b.pode_mudar === false && b.modero === false && m.pode_mudar === true && m.modero === true);
await espera("post comum: não é tópico", () => rpc(A, "alumia_forum_topico", { p_post: pC.id }), (r) => r.topico === false && r.item === null && r.pode_mudar === false);

// ═══════════════════ 6. Virar tópico ═══════════════════
const pL = await espera("a autora escreve na linha (fora de comunidade)", () => publicar(A, { texto: "Alguém sabe como funciona o fundo de greve do bloco?" }), (r) => r.id);
const pidVirar = (quem, post, extra = {}) => rpc(quem, "alumia_forum_virar", { p_post: post, p: { comunidade: "o10-moradia", titulo: "Fundo de greve do bloco", corpo: "Este assunto começou numa conversa e continua aqui.", ...extra } });
await recusa("quem não escreveu nem modera não leva", async () => { await zerar(); return pidVirar(B, pL.id); }, "sem_permissao");
await recusa("a moderação de uma comunidade não leva o que está fora dela", async () => { await zerar(); return pidVirar(M, pL.id); }, "sem_permissao");
await recusa("comunidade que não existe", async () => { await zerar(); return pidVirar(A, pL.id, { comunidade: "nao-existe" }); }, "invalido:comunidade");
await recusa("título curto demais (as conferências de publicar valem)", async () => { await zerar(); return pidVirar(A, pL.id, { titulo: "oi" }); }, "invalido:titulo");
await recusa("etiqueta que a comunidade não tem", async () => { await zerar(); return pidVirar(A, pL.id, { etiqueta: "Inventada" }); }, "invalido:flair");
const vL = await espera("a autora leva o próprio post para o fórum (e cita o que é dela)", async () => { await zerar(); return pidVirar(A, pL.id, { etiqueta: "Mutirão" }); }, (r) => r.topico && r.avaliar === false && r.citou === true);
await espera("o tópico novo cita o original e está no fórum como levado", async () => {
  const linha = (await dono("select quote_of, comunidade, tipo, flair, autor from interno.rede_posts where id = $1", [vL.topico])).rows[0];
  const l = await lista(B);
  return { linha, item: l.itens.find((t) => t.id === vL.topico) };
}, (r) => r.linha.quote_of === pL.id && r.linha.comunidade === "o10-moradia" && r.linha.tipo === "discussao" && r.linha.flair === "Mutirão" && r.linha.autor === P.autora && r.item?.veio === true);
await espera("ela não recebe aviso de si mesma", async () => (await dono("select count(*)::int as n from interno.avisos where para = $1 and texto like '%fórum%'", [P.autora])).rows[0].n, (n) => n === 0);
await recusa("o mesmo post não vira dois tópicos na mesma comunidade", async () => { await zerar(); return pidVirar(A, pL.id); }, "ja_virou");
await espera("a marca: do original, o fórum diz onde continua; do tópico, de onde veio", async () => [await rpc(B, "alumia_forum_topico", { p_post: pL.id }), await rpc(B, "alumia_forum_topico", { p_post: vL.topico })],
  ([o, n]) => o.topico === false && o.continua.length === 1 && o.continua[0].de === pL.id && o.continua[0].topico === vL.topico && o.continua[0].comunidade === "o10-moradia"
    && n.topico === true && n.veio_de === pL.id);

const vR = await espera("a moderação leva uma resposta de um tópico da comunidade que ela cuida", async () => {
  await zerar();
  return rpc(M, "alumia_forum_virar", { p_post: rA.id, p: { comunidade: "o10-moradia", titulo: "Rodízio de quem coordena", corpo: "Saiu da conversa da assembleia para ter tópico próprio.", tipo: "duvida" } });
}, (r) => r.topico && r.citou === true);
await espera("quem escreveu recebe um aviso da moderação, sem o nome de quem levou", async () =>
  (await dono("select texto, ator, tipo from interno.avisos where para = $1 and texto like '%fórum%' order by criado_em desc", [P.membro2])).rows,
(rs) => rs.length === 1 && rs[0].ator === null && rs[0].tipo === "moderacao" && !rs[0].texto.includes("Codinome mod") && rs[0].texto.includes("Rodízio de quem coordena"));
await espera("a conversa de origem mostra a resposta que continua no fórum", () => rpc(A, "alumia_forum_topico", { p_post: tA.id }),
  (r) => r.continua.some((c) => c.de === rA.id && c.topico === vR.topico));
await recusa("a moderação não leva para uma comunidade que ela não cuida", async () => {
  await zerar();
  return rpc(M, "alumia_forum_virar", { p_post: tB.id, p: { comunidade: "o10-estudo", titulo: "Mutirão no estudo", corpo: "Levado para outra comunidade pela moderação." } });
}, "sem_permissao");
await espera("quem cuida dos dois lugares leva de um para o outro", async () => {
  await zerar();
  return rpc(M2, "alumia_forum_virar", { p_post: tB.id, p: { comunidade: "o10-estudo", titulo: "Mutirão no estudo", corpo: "Levado para outra comunidade pela moderação." } });
}, (r) => r.topico && r.citou === false);
await espera("sem a citação (a autora não abriu o citar), o vínculo fica", async () => [
  (await dono("select n.quote_of, t.veio_de from interno.alumia_forum_topicos t join interno.rede_posts n on n.id = t.post where t.veio_de = $1 and n.comunidade = 'o10-estudo'", [tB.id])).rows[0],
  await rpc(M2, "alumia_forum_topico", { p_post: tB.id })],
([linha, o]) => linha && linha.quote_of === null && linha.veio_de === tB.id && o.continua.some((c) => c.comunidade === "o10-estudo"));

// A marca "continua em" só aparece para quem pode ver o tópico novo.
const pF = await espera("a autora abre outra conversa na moradia", () => publicar(A, { texto: "Uma conversa que vai continuar num lugar fechado.", comunidade: "o10-moradia" }), (r) => r.id);
await espera("e leva para a comunidade fechada dela", async () => { await zerar(); return rpc(A, "alumia_forum_virar", { p_post: pF.id, p: { comunidade: "o10-fechada", titulo: "Continuação fechada", corpo: "Só quem é da fechada lê esta continuação." } }); }, (r) => r.topico);
await espera("quem é da fechada vê a marca; quem não é, não vê nem o título", async () => [await rpc(A, "alumia_forum_topico", { p_post: pF.id }), await rpc(B, "alumia_forum_topico", { p_post: pF.id })],
  ([a, b]) => a.continua.length === 1 && b.continua.length === 0 && !JSON.stringify(b).includes("Continuação fechada"));

// ═══════════════════ 7. Apagar e nada de endereço de rede ═══════════════════
await espera("apagar o original tira o vínculo e não apaga o tópico", async () => {
  await dono("delete from interno.rede_posts where id = $1", [pL.id]);
  return (await dono("select veio_de from interno.alumia_forum_topicos where post = $1", [vL.topico])).rows[0];
}, (r) => r && r.veio_de === null);
await espera("nenhuma coluna nova guarda endereço", async () =>
  (await dono("select column_name, data_type from information_schema.columns where table_schema = 'interno' and table_name = any($1)", [tabelas])).rows,
(rs) => rs.length > 0 && !rs.some((c) => c.data_type === "inet" || /(^|_)(ip|endereco|porta)($|_)/.test(c.column_name)));

if (falhas.length) {
  console.error(`\n${falhas.length} falha(s), ${certos} certo(s):`);
  for (const f of falhas) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`fórum da comunidade (onda 10): ${certos} conferências certas.`);
process.exit(0);
