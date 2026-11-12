// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o back-end mínimo dos atos da Alumia (frente F2, PLANO-ALUMIA §5 e §8) num Postgres de verdade: a migração
// supabase/migracoes/20261109-alumia-f2.sql sobre o install.sql + a F0, rodada DUAS vezes (e uma terceira depois de haver chamados
// da Rede de hoje, para provar que eles migram sem perder dado). Matriz: visitante, membro, quem organizou (dono), bloqueado e conta
// sem consentimento. Regras: proporção nula abaixo de 3 e em passos de 10 % (a mesma de lib/rede/mosaico.ts), total só para quem
// organizou, nenhuma lista de pessoas, "era 12/11" guardado, aviso só a quem confirmou, palavra do mosaico com a regra do banco,
// limites de uso, tabelas fechadas.
// Uso: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --disable-warning=DEP0205 --import ./scripts/carregar-ts.mjs scripts/testar-alumia-f2.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizarPalavra, proporcaoDoMosaico } from "../lib/rede/mosaico.ts";
import { criarClienteDosAtos } from "../lib/rede/cliente-atos.ts";
import { criarBanco } from "./banco-local.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");

let certos = 0;
const falhas = [];
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 400)}`);
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

const f0 = ler("supabase/migracoes/20261109-alumia-f0-contrato.sql");
const f2 = ler("supabase/migracoes/20261109-alumia-f2.sql");
ok("a migração está colada no install.sql (o integrador colou)", ler("supabase/install.sql").includes("Alumia · Onda 5 · F2"));
ok("toda função nova é security definer com search_path fixo", (() => {
  const funcoes = f2.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
  return funcoes.length >= 10 && funcoes.every((f) => /set search_path = interno, pg_temp/.test(f) && (/security definer/.test(f) || /immutable/.test(f)));
})());
ok("nenhuma permissão direta nas tabelas para anon/authenticated", !/grant [a-z, ]+ on (table )?interno\./i.test(f2));

const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const um = async (texto, valores = []) => (await dono(texto, valores)).rows[0];
const exec = (sql) => banco.exclusivo(() => banco.pg.exec(sql));
await espera("a F0 instala", () => exec(f0));
await espera("a F2 instala sobre o install.sql + F0", () => exec(f2));
await espera("e instala de novo sem estrago (idempotente)", () => exec(f2));

// ── pessoas ──
let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++ % 250}` });
const visitante = () => ({ papel: "anon", ip: `203.0.113.${ip++ % 250}` });
const P = {};
const nomes = ["dono", "m1", "m2", "m3", "m4", "calado", "bloqueado", "semconsent"];
for (const [i, nome] of nomes.entries()) {
  P[nome] = await criarUsuario(`${nome}@f2.local`, nome);
  await rpc(como(P[nome]), "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome], `Pessoa ${i + 1} ${nome}`]);
}
await dono("delete from interno.papeis");
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of nomes.filter((n) => n !== "semconsent")) await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1)", [P[nome]]);
await dono("update auth.users set created_at = now() - interval '30 days'");
await dono("update interno.perfis set rede_handle = 'organiza_zl' where id = $1", [P.dono]);
await dono("insert into interno.rede_seguindo (quem, segue) values ($1, $2)", [P.m1, P.dono]); // m1 segue quem organiza
await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2)", [P.dono, P.bloqueado]);
await dono(`insert into interno.rede_comunidades (slug, nome, categoria, tipo, publico_padrao) values ('matematica', 'Matemática', 'disciplinas', 'aberta', 'internet') on conflict (slug) do update set categoria = 'disciplinas', tipo = 'aberta', publico_padrao = 'internet'`);
// "calado" desligou o aviso de ato mudado no site.
await dono("insert into interno.rede_avisos_prefs (usuario, tipo, canal, ligado) values ($1, 'ato_mudou', 'site', false)", [P.calado]);

const daqui = (dias, hora = 18) => {
  const d = new Date(Date.now() + dias * 86_400_000);
  d.setUTCHours(hora, 0, 0, 0);
  return d.toISOString();
};
const pedido = (extra = {}) => ({
  titulo: "Passe Livre Já!", inicio: daqui(10), onde: "Praça da Sé · concentração na escadaria", cidade: "São Paulo",
  descricao: "Ato pelo passe livre estudantil. Leve água e cartaz.", ...extra,
});
const publicar = (quem, p) => rpc(como(P[quem]), "rede_ato_publicar", { p });

// ═══════════════════ 1. Chamar um ato ═══════════════════
await recusa("visitante não chama ato", () => rpc(visitante(), "rede_ato_publicar", { p: pedido() }), "permission denied");
await recusa("conta sem consentimento não chama ato", () => publicar("semconsent", pedido()), "consentimento");
await recusa("nome só de números não desenha a palavra", () => publicar("dono", pedido({ titulo: "2026 1999" })), "invalido:palavra");
await recusa("data no passado", () => publicar("dono", pedido({ inicio: daqui(-1) })), "invalido:inicio");
await recusa("data a mais de um ano", () => publicar("dono", pedido({ inicio: daqui(400) })), "invalido:inicio");
await recusa("link de apoio sem https", () => publicar("dono", pedido({ link_apoio: "http://vaquinha.exemplo/x" })), "invalido:link_apoio");
await recusa("e-mail no nome do ato é dado pessoal", () => publicar("dono", pedido({ titulo: "fala com a@b.com" })), "dado_pessoal");
await recusa("telefone no ponto é dado pessoal", () => publicar("dono", pedido({ onde: "liga (11) 98888-7777" })), "dado_pessoal");
await recusa("cidade vazia", () => publicar("dono", pedido({ cidade: " " })), "invalido:cidade");
const ato = await espera("quem organiza chama o ato", () => publicar("dono", pedido({ link_apoio: "https://vaquinha.exemplo/passe" })), (a) =>
  a.palavra === "PASSE LIVRE JA" && a.titulo === "Passe Livre Já!" && a.situacao === "confirmado" && a.acesos === null && a.total === 0 && a.meu === true
  && a.vou_eu === false && a.cidade === "São Paulo" && a.chamado_por === "organiza_zl" && a.inicio_anterior === null && a.link_apoio === "https://vaquinha.exemplo/passe");
const ID = ato?.id;
await espera("o chamado é o de sempre: rede_chamados + o JSON da Rede de hoje no post", () => um("select c.situacao, c.cancelado, c.palavra, p.tipo, p.chamado ->> 'onde' as onde, p.chamado ->> 'tipo' as tipo_chamado from interno.rede_chamados c join interno.rede_posts p on p.id = c.post where c.post = $1", [ID]), (r) =>
  r.situacao === "confirmado" && r.cancelado === false && r.palavra === "PASSE LIVRE JA" && r.tipo === "chamado" && r.tipo_chamado === "ato" && r.onde.startsWith("Praça da Sé"));
const pub = await espera("ato público na internet (comunidade de disciplina)", () => publicar("dono", pedido({ titulo: "Aula na praça", comunidade: "matematica", publico: "internet", cidade: "Recife", inicio: daqui(5) })), (a) => a.comunidade?.slug === "matematica" && a.palavra === "AULA NA PRACA");

// ═══════════════════ 2. Ler: a matriz ═══════════════════
await espera("membro lê o ato: sem total, sem 'meu'", () => rpc(como(P.m4), "rede_ato", { p_id: ID }), (a) => a.total === null && a.meu === false && a.acesos === null && a.vou_eu === false);
await recusa("bloqueado não acha o ato", () => rpc(como(P.bloqueado), "rede_ato", { p_id: ID }), "nao_encontrado");
await recusa("visitante não acha ato só de membros", () => rpc(visitante(), "rede_ato", { p_id: ID }), "nao_encontrado");
await espera("visitante lê o ato público, sem total", () => rpc(visitante(), "rede_ato", { p_id: pub.id }), (a) => a.total === null && a.meu === false && a.vou_eu === false);
await espera("visitante: o próximo ato é nulo", () => rpc(visitante(), "rede_ato_proximo"), (r) => r === null);
await recusa("visitante: 'Seguindo' pede conta", () => rpc(visitante(), "rede_atos", { p_filtro: "seguindo" }), "entre_primeiro");
await espera("visitante: Perto em Recife só traz o público", () => rpc(visitante(), "rede_atos", { p_filtro: "perto", p_cidade: "recife" }), (r) => r.itens.length === 1 && r.itens[0].id === pub.id);
await espera("visitante: Perto em São Paulo não traz o de membros", () => rpc(visitante(), "rede_atos", { p_filtro: "perto", p_cidade: "São Paulo" }), (r) => r.itens.length === 0);
await espera("membro: Perto pela cidade escrita, sem acento e com espaço a mais", () => rpc(como(P.m4), "rede_atos", { p_filtro: "perto", p_cidade: "  sao   PAULO " }), (r) => r.itens.length === 1 && r.itens[0].id === ID && r.proximo === null);
await espera("Perto sem cidade: página vazia (nada de posição do aparelho)", () => rpc(como(P.m4), "rede_atos", { p_filtro: "perto", p_cidade: null }), (r) => r.itens.length === 0);
await espera("Seguindo: quem segue quem organiza vê", () => rpc(como(P.m1), "rede_atos", { p_filtro: "seguindo" }), (r) => r.itens.some((a) => a.id === ID));
await espera("Seguindo: quem não segue nem confirmou não vê", () => rpc(como(P.m4), "rede_atos", { p_filtro: "seguindo" }), (r) => !r.itens.some((a) => a.id === ID));
await espera("bloqueado: Perto em São Paulo vem vazio", () => rpc(como(P.bloqueado), "rede_atos", { p_filtro: "perto", p_cidade: "São Paulo" }), (r) => r.itens.length === 0);
await espera("a aba da comunidade", () => rpc(como(P.m4), "rede_atos", { p_filtro: "perto", p_comunidade: "matematica" }), (r) => r.itens.length === 1 && r.itens[0].id === pub.id);
await recusa("filtro inventado", () => rpc(como(P.m4), "rede_atos", { p_filtro: "mapa" }), "invalido:filtro");
await recusa("cursor estragado", () => rpc(como(P.m4), "rede_atos", { p_filtro: "perto", p_cidade: "x", p_cursor: "lixo" }), "invalido:cursor");

// ═══════════════════ 3. "Você vai" e o mosaico ═══════════════════
const vou = (quem, sim = true, id = ID) => rpc(como(P[quem]), "rede_ato_vou", { p_id: id, p_sim: sim });
await recusa("visitante não confirma", () => rpc(visitante(), "rede_ato_vou", { p_id: ID, p_sim: true }), "permission denied");
await recusa("sem consentimento não confirma", () => vou("semconsent"), "consentimento");
await recusa("bloqueado não confirma", () => vou("bloqueado"), "nao_encontrado");
await espera("1 confirmação: nada acende", () => vou("m1"), (r) => r.vou_eu === true && r.acesos === null && r.total === null);
await espera("2 confirmações: nada acende", () => vou("m2"), (r) => r.acesos === null && r.total === null);
await espera("confirmar duas vezes não conta duas", () => vou("m2"), (r) => r.acesos === null);
await espera("3 confirmações: acende 10 %, e quem confirmou não vê número", () => vou("m3"), (r) => r.acesos === 0.1 && r.total === null);
await espera("quem desfaz volta a 2: apaga de novo", () => vou("m3", false), (r) => r.vou_eu === false && r.acesos === null);
await vou("m3").catch((e) => falhas.push(`vou m3: ${e.message}`));
await vou("calado").catch((e) => falhas.push(`vou calado: ${e.message}`));
await espera("quem organizou vê o total exato", () => rpc(como(P.dono), "rede_ato", { p_id: ID }), (a) => a.total === 4 && a.acesos === 0.1 && a.meu === true);
await espera("quem confirmou vê 'vou_eu' e a proporção, nunca o total", () => rpc(como(P.m1), "rede_ato", { p_id: ID }), (a) => a.vou_eu === true && a.total === null && a.acesos === 0.1);
await espera("nenhuma resposta traz id de quem confirmou", async () => {
  const tudo = JSON.stringify([await rpc(como(P.dono), "rede_ato", { p_id: ID }), await rpc(como(P.m4), "rede_atos", { p_filtro: "perto", p_cidade: "São Paulo" }), await vou("m1")]);
  return [P.m1, P.m2, P.m3, P.calado].some((id) => tudo.includes(id));
}, (vazou) => vazou === false);
await espera("a proporção do banco é a MESMA de lib/rede/mosaico.ts (0 a 400, com e sem meta)", async () => {
  const r = await dono("select n, m, interno.rede_ato_proporcao(n, m)::float8 as p from generate_series(0, 400) n, unnest(array[null, 10, 50, 200]::int[]) m");
  return r.rows.filter((x) => (x.p ?? null) !== proporcaoDoMosaico(x.n, x.m)).map((x) => `${x.n}/${x.m}:${x.p}`);
}, (dif) => dif.length === 0);
await espera("a palavra do banco é a MESMA de lib/rede/mosaico.ts", async () => {
  const casos = ["Passe Livre Já!", "  fora   temer ", "Ação já", "Ñandú über", "Moradia é direito de todos nós", "2026", "ok", "çÇãÃ-éÉ", "Greve!!! Geral", "a b c d e f g h i"];
  const r = await dono("select t, interno.rede_ato_palavra(t) as p from unnest($1::text[]) t", [casos]);
  return r.rows.filter((x) => x.p !== normalizarPalavra(x.t)).map((x) => `${x.t} → ${x.p} ≠ ${normalizarPalavra(x.t)}`);
}, (dif) => dif.length === 0);
await espera("o próximo ato de quem confirmou é este", () => rpc(como(P.m1), "rede_ato_proximo"), (a) => a?.id === ID);
await espera("o próximo ato de quem não confirmou e não segue: o que for das comunidades dele, ou nulo", () => rpc(como(P.m4), "rede_ato_proximo"), (a) => a === null);

// ═══════════════════ 4. Adiar, cancelar, confirmar de novo ═══════════════════
const mudar = (quem, situacao, inicio = null, motivo = "") => rpc(como(P[quem]), "rede_ato_mudar", { p_id: ID, p_situacao: situacao, p_inicio: inicio, p_motivo: motivo });
// Com a B1 da comunidade (20261110-alumia-b1-comunidade.sql), o aviso de ato pedido como 'chamado' fica gravado como 'ato'.
const avisos = async () => Object.fromEntries((await dono("select para, count(*)::int as n from interno.avisos where tipo = 'ato' and post = $1 group by para", [ID])).rows.map((r) => [r.para, r.n]));
const original = ato?.inicio;
await recusa("membro não adia o ato de outra pessoa", () => mudar("m1", "adiado", daqui(20)), "so_quem_organizou");
await recusa("bloqueado nem acha o ato para mudar", () => mudar("bloqueado", "cancelado"), "nao_encontrado");
await recusa("visitante não muda", () => rpc(visitante(), "rede_ato_mudar", { p_id: ID, p_situacao: "cancelado" }), "permission denied");
await recusa("adiar pede data nova", () => mudar("dono", "adiado"), "invalido:inicio");
await recusa("adiar para o passado", () => mudar("dono", "adiado", daqui(-2)), "invalido:inicio");
await recusa("situação inventada", () => mudar("dono", "suspenso"), "invalido:situacao");
await recusa("motivo com telefone", () => mudar("dono", "cancelado", null, "liga (11) 98888-7777"), "dado_pessoal");
const nova = daqui(17);
await espera("adiar guarda a data de antes ('era 12/11')", () => mudar("dono", "adiado", nova, "chuva forte"), (a) =>
  a.situacao === "adiado" && Date.parse(a.inicio) === Date.parse(nova) && Date.parse(a.inicio_anterior) === Date.parse(original) && a.motivo === "chuva forte");
await espera("o aviso vai SÓ a quem confirmou (e não a quem desligou 'ato_mudou')", avisos, (m) =>
  m[P.m1] === 1 && m[P.m2] === 1 && m[P.m3] === 1 && !m[P.calado] && !m[P.m4] && !m[P.dono] && !m[P.bloqueado]);
await espera("o texto do aviso não leva nome de ninguém nem o nome do ato", async () => (await dono("select distinct texto from interno.avisos where tipo = 'ato' and post = $1", [ID])).rows.map((r) => r.texto), (t) => t.length === 1 && !/Pessoa|organiza_zl|Passe/i.test(t[0]));
await espera("o JSON da Rede de hoje acompanha a data nova", () => um("select chamado ->> 'quando' as q from interno.rede_posts where id = $1", [ID]), (r) => Date.parse(r.q) === Date.parse(nova));
await espera("adiar de novo mantém o 'era' da primeira data", () => mudar("dono", "adiado", daqui(19)), (a) => Date.parse(a.inicio_anterior) === Date.parse(original));
await espera("cancelar", () => mudar("dono", "cancelado", null, "cancelada pela chuva · nova data em breve"), (a) => a.situacao === "cancelado" && a.motivo.startsWith("cancelada"));
await espera("a coluna 'cancelado' de antes continua certa", () => um("select cancelado from interno.rede_chamados where post = $1", [ID]), (r) => r.cancelado === true);
await recusa("ato cancelado não recebe confirmação nova", () => vou("m4"), "ato_cancelado");
await espera("mas quem confirmou pode desfazer", () => vou("m3", false), (r) => r.vou_eu === false);
await espera("o próximo ato não é um cancelado", () => rpc(como(P.m1), "rede_ato_proximo"), (a) => a === null || a.id !== ID);
await espera("confirmar de novo", () => mudar("dono", "confirmado"), (a) => a.situacao === "confirmado" && a.motivo === "");
await espera("cada mudança gera um aviso a quem ainda confirmou", avisos, (m) => m[P.m1] === 4 && m[P.m3] === 3 && !m[P.calado]);
await espera("confirmar o que já está confirmado não avisa de novo", async () => { await mudar("dono", "confirmado"); return avisos(); }, (m) => m[P.m1] === 4);

// ═══════════════════ 5. Tabelas fechadas e limites ═══════════════════
for (const tabela of ["rede_chamados", "rede_vou"]) {
  await recusa(`ninguém de fora lê interno.${tabela}`, () => banco.exclusivo(async () => {
    await banco.pg.exec("set role authenticated");
    try {
      return await banco.pg.query(`select * from interno.${tabela}`);
    } finally {
      await banco.pg.exec("reset role");
    }
  }), "permission denied");
}
await espera("RLS ligada em rede_chamados", () => um("select relrowsecurity from pg_class where oid = 'interno.rede_chamados'::regclass"), (r) => r.relrowsecurity === true);
await espera("até 10 atos por dia por pessoa", async () => {
  // já chamou 2; mais 8 passam e o 11º para
  for (let i = 0; i < 8; i++) await publicar("dono", pedido({ titulo: `Ato ${String.fromCharCode(65 + i)}${String.fromCharCode(65 + i)}`, inicio: daqui(30 + i) }));
  try {
    await publicar("dono", pedido({ titulo: "Mais um", inicio: daqui(60) }));
    return "passou";
  } catch (e) {
    return String(e.message);
  }
}, (m) => m.includes("muitos_pedidos"));
await espera("a página corta em p_limite e devolve o cursor; a seguinte continua sem repetir", async () => {
  const a = await rpc(como(P.m1), "rede_atos", { p_filtro: "seguindo", p_limite: 4 });
  const b = await rpc(como(P.m1), "rede_atos", { p_filtro: "seguindo", p_limite: 40, p_cursor: a.proximo });
  const ids = [...a.itens, ...b.itens].map((x) => x.id);
  return { n: a.itens.length, cursor: a.proximo, todos: ids.length, unicos: new Set(ids).size, fim: b.proximo };
}, (r) => r.n === 4 && typeof r.cursor === "string" && r.todos === r.unicos && r.todos >= 10 && r.fim === null);

// ═══════════════════ 6. Os chamados da Rede de hoje migram sem perder dado ═══════════════════
const legado = (await um(`insert into interno.rede_posts (autor, texto, chamado) values ($1, 'Mutirão na horta', jsonb_build_object('tipo', 'mutirao', 'quando', now() + interval '3 days', 'onde', 'Horta comunitária do bairro')) returning id`, [P.m2])).id;
const legadoRuim = (await um(`insert into interno.rede_posts (autor, texto, chamado) values ($1, 'sem data', jsonb_build_object('tipo', 'ato', 'onde', 'x')) returning id`, [P.m2])).id;
await dono("insert into interno.rede_vou (post, usuario) values ($1, $2), ($1, $3), ($1, $4) on conflict do nothing", [legado, P.m1, P.m3, P.m4]);
await espera("a migração roda de novo e acolhe o chamado de antes", () => exec(f2));
await espera("o chamado de antes virou ato, com data, ponto, tipo e cidade vazia", () => um("select tipo, ponto, situacao, cidade from interno.rede_chamados where post = $1", [legado]), (r) => r?.tipo === "mutirao" && r.ponto === "Horta comunitária do bairro" && r.situacao === "confirmado" && r.cidade === null);
await espera("o que não cabia nas regras fica só no JSON, como estava", () => um("select count(*)::int as n from interno.rede_chamados where post = $1", [legadoRuim]), (r) => r.n === 0);
await espera("as confirmações de antes viram o mosaico (3 → 10 %), e o JSON continua no post", async () => [await rpc(como(P.m1), "rede_ato", { p_id: legado }), await um("select chamado from interno.rede_posts where id = $1", [legado])], ([a, p]) =>
  a.acesos === 0.1 && a.vou_eu === true && a.total === null && a.palavra === "MUTIRAO NA HORTA".slice(0, 14).trim() && p.chamado.onde === "Horta comunitária do bairro");
await dono("update interno.rede_chamados set cancelado = true, situacao = 'confirmado' where post = $1", [legado]);
await espera("um 'cancelado' de antes vira situação cancelado na migração", async () => { await exec(f2); return um("select situacao from interno.rede_chamados where post = $1", [legado]); }, (r) => r.situacao === "cancelado");

// ═══════════════════ 7. O cliente do site sobre o banco de verdade ═══════════════════
{
  const chamarComo = (quem) => (funcao, argumentos = {}) => rpc(quem ? como(P[quem]) : visitante(), funcao, argumentos);
  const cDono = criarClienteDosAtos(chamarComo("dono"));
  const cM4 = criarClienteDosAtos(chamarComo("m4"));
  await dono("delete from interno.limites where chave like 'alumia_ato_chamar:%'");
  const novo = await espera("cliente: publicar devolve o ato limpo", () => cDono.publicar({ tipo: "ato", titulo: "Fica Esperança", palavra: "FICA ESPERANCA", quando: daqui(8), onde: "Ocupação Esperança", cidade: "Itaquera", descricao: "Vigília.", pronto: true, problemas: {} }), (a) => a.palavra === "FICA ESPERANCA" && a.total === 0);
  if (novo) {
    await espera("cliente: membro lista Perto em Itaquera", () => cM4.atos("perto", { cidade: "itaquera" }), (p) => p.itens.length === 1 && p.itens[0].total === null);
    await espera("cliente: 'Você vai' pelo cliente", () => cM4.vou(novo.id, true), (r) => r.vou_eu === true && r.acesos === null && r.total === null);
    await espera("cliente: adiar pelo cliente", () => cDono.mudar(novo.id, { situacao: "adiado", inicio: daqui(9), motivo: "" }), (a) => a.situacao === "adiado" && a.inicio_anterior !== null);
  }
}

await banco.pg.close?.();
console.log(`Alumia (F2, atos no banco): ${certos} certos, ${falhas.length} falhas.`);
for (const f of falhas) console.log("  ✗", f);
process.exit(falhas.length ? 1 : 0);
