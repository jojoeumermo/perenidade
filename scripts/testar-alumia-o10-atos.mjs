// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a frente 10F (atos e eventos):
//   cliente      as regras puras de lib/rede/atos/eventos.ts (datas da série, formulário, limpeza do que vem do servidor, a conferência
//                do rosto que ficou de fora do borrão);
//   textos       o bloco "eventos" de i18n/rede/atos nos seis idiomas, com as mesmas chaves e marcadores; nenhuma palavra proibida;
//   arquivo      a migração 20261116-alumia-o10-atos.sql: search_path fixo, termina nas portas, nada de endereço de rede nem GPS;
//   banco        a migração num Postgres de verdade (scripts/banco-local.mjs), rodada DUAS vezes: série (datas abertas, pular,
//                encerrar, rodada), convite entre organizações (aceite, recusa, só as aceitas aparecem), álbum (só quem confirmou,
//                sem quem mandou, só aparece depois da aprovação, caminho sem o id da pessoa), linha ao vivo (janela, ordem de
//                chegada, público de cada post, tirar).
// Uso: npm run testar:alumia-o10-atos
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import {
  conferirSerie,
  datasDaSerie,
  limparAlbum,
  limparLinhaDoAto,
  limparMaisDoAto,
  rostosDeFora,
} from "../lib/rede/atos/eventos.ts";
import { criarDuble } from "../lib/rede/atos/exemplos.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");

let certos = 0;
const falhas = [];
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 700)}`);
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

// ═══════════════════ 1. Cliente ═══════════════════
{
  const o = { timeZone: "America/Sao_Paulo" };
  const d = datasDaSerie("2026-11-20T21:00:00Z", { frequencia: "semanal", ate: "2026-12-11", excecoes: ["2026-12-04"] }, 10, o);
  ok("série: semanal até 11/12 sem a exceção", d.map((x) => x.data).join() === "2026-11-20,2026-11-27,2026-12-04,2026-12-11" && d[2].pulada && !d[1].pulada && d[1].inicio === "2026-11-27T21:00:00.000Z");
  const q = datasDaSerie("2026-11-20T21:00:00Z", { frequencia: "quinzenal", ate: "2027-01-31", excecoes: [] }, 3, o);
  ok("série: quinzenal com teto", q.length === 3 && q[1].data === "2026-12-04");
  const m = datasDaSerie("2026-01-31T12:00:00Z", { frequencia: "mensal", ate: "2026-04-30", excecoes: [] }, 10, o);
  ok("série: mensal no dia 31 cai no último dia do mês", m.map((x) => x.data).join() === "2026-01-31,2026-02-28,2026-03-31,2026-04-30");
  ok("série: formulário bom", conferirSerie({ frequencia: "semanal", ate: "2026-12-20", excecoes: [] }, "2026-11-20T21:00:00Z", o).ok);
  ok("série: até antes do ato é recusado", conferirSerie({ frequencia: "semanal", ate: "2026-11-19", excecoes: [] }, "2026-11-20T21:00:00Z", o).problema === "ate");
  ok("série: mais de um ano é recusado", conferirSerie({ frequencia: "mensal", ate: "2027-12-01", excecoes: [] }, "2026-11-20T21:00:00Z", o).problema === "ate");
  ok("série: frequência torta é recusada", conferirSerie({ frequencia: "diaria", ate: "2026-12-20", excecoes: [] }, "2026-11-20T21:00:00Z", o).problema === "frequencia");
  ok("série: 25 exceções é demais", conferirSerie({ frequencia: "semanal", ate: "2027-06-20", excecoes: Array.from({ length: 25 }, (_, i) => `2027-01-${String(i + 1).padStart(2, "0")}`) }, "2026-11-20T21:00:00Z", o).problema === "excecoes");
  const mais = limparMaisDoAto({ organiza: false, chamou: false, coletivos: [{ handle: "faisca", nome: "Coletivo Faísca", selo: true, quem: "x" }, { handle: "<b>", nome: "x" }], convites: [{ handle: "zl", nome: "ZL" }], meus_convites: [], minhas_orgs: [], serie: null, pode_repetir: true, album: { aprovadas: 2.7, pendentes: 4, pode_enviar: true }, linha: { aberta: true, pode_escrever: true, desde: "x", ate: "y" } });
  ok("mais: quem não organiza não recebe convites nem pendentes; @ torto some; nada de campo de pessoa", mais.convites.length === 0 && mais.album.pendentes === null && mais.coletivos.length === 1 && !("quem" in mais.coletivos[0]) && mais.album.aprovadas === 2 && mais.pode_repetir === false);
  const alb = limparAlbum({ organiza: false, pode_enviar: true, fotos: [{ id: "a", largura: 10, altura: 10, legenda: "Faixa", minha: false, estado: "pendente", quem: "x" }], pendentes: [{ id: "b" }] });
  ok("álbum: quem não modera não recebe pendentes, nem foto pendente de outra pessoa, nem campo de pessoa", alb.pendentes.length === 0 && alb.fotos.length === 0);
  const alb2 = limparAlbum({ organiza: false, pode_enviar: true, fotos: [{ id: "a", largura: 10, altura: 10, legenda: "Faixa", minha: true, estado: "pendente", quem: "x" }], pendentes: [] });
  ok("álbum: a própria foto pendente aparece, sem campo de pessoa", alb2.fotos.length === 1 && !("quem" in alb2.fotos[0]));
  const lin = limparLinhaDoAto({ itens: [{ id: "b", criado_em: "2026-11-20T21:05:00Z", texto: "dois" }, { id: "a", criado_em: "2026-11-20T21:01:00Z", texto: "um" }], proximo: "x" });
  ok("linha: sempre em ordem de chegada", lin.itens.map((p) => p.id).join() === "a,b");
  ok("rostos: o rosto coberto pelo borrão não conta", rostosDeFora([{ x: 0.1, y: 0.1, w: 0.2, h: 0.2 }], [{ x: 0.05, y: 0.05, w: 0.35, h: 0.35 }]) === 0);
  ok("rostos: o rosto fora do borrão conta", rostosDeFora([{ x: 0.6, y: 0.6, w: 0.2, h: 0.2 }, { x: 0.1, y: 0.1, w: 0.1, h: 0.1 }], [{ x: 0.05, y: 0.05, w: 0.2, h: 0.2 }]) === 1);
  ok("rostos: meio coberto ainda conta", rostosDeFora([{ x: 0.1, y: 0.1, w: 0.4, h: 0.4 }], [{ x: 0.1, y: 0.1, w: 0.2, h: 0.4 }]) === 1);
  const duble = criarDuble();
  const idAto = "0e1b6c1a-5d1f-4c3e-9a51-6f3a2b1c0d01";
  ok("dublê: o álbum de exemplo não traz quem mandou", JSON.stringify(duble.rede_ato_album({ p_ato: idAto })).indexOf("quem") < 0);
  ok("dublê: a linha ao vivo de exemplo vem em ordem de chegada", (() => { const l = duble.rede_ato_linha({ p_ato: idAto }); return l.itens.length > 1 && l.itens.every((p, i, a) => i === 0 || a[i - 1].criado_em <= p.criado_em); })());
  ok("dublê: o rede_ato_mais de exemplo tem coletivos e série", (() => { const x = duble.rede_ato_mais({ p_ato: idAto }); return x.coletivos.length >= 1 && x.serie && x.serie.datas.length >= 2; })());
}

// ═══════════════════ 2. Textos ═══════════════════
{
  const chaves = (v, p = "", s = new Map()) => {
    if (Array.isArray(v)) { s.set(p, `lista:${v.length}`); v.forEach((x, i) => chaves(x, `${p}[${i}]`, s)); }
    else if (v && typeof v === "object") for (const [k, f] of Object.entries(v)) chaves(f, p ? `${p}.${k}` : k, s);
    else s.set(p, typeof v === "string" && v.trim() ? (v.match(/\{\w+\}/g) ?? []).sort().join() : "VAZIO");
    return s;
  };
  const bloco = (l) => JSON.parse(ler(`i18n/rede/atos/${l}.json`)).eventos;
  const pt = chaves(bloco("pt"));
  ok("textos: o bloco eventos existe no pt", pt.size > 40);
  for (const lang of ["en", "es", "fr", "ru", "zh"]) {
    const outro = chaves(bloco(lang));
    const dif = [...pt].filter(([k, v]) => outro.get(k) !== v).concat([...outro].filter(([k]) => !pt.has(k)));
    ok(`textos: ${lang} com as mesmas chaves e marcadores do pt${dif.length ? ` (${dif.slice(0, 3).map(([k]) => k).join(", ")})` : ""}`, dif.length === 0);
  }
  const tudo = ["pt", "en", "es", "fr", "ru", "zh"].map((l) => JSON.stringify(bloco(l))).join("\n").toLowerCase();
  ok("textos: nenhuma palavra proibida", !/diploma|universidade|algoritmo|university|algorithm|universidad|université|алгоритм|университет|算法|大学/.test(tudo));
}

// ═══════════════════ 3. O arquivo da migração ═══════════════════
const sql = ler("supabase/migracoes/20261116-alumia-o10-atos.sql");
ok("toda função security definer tem search_path fixo", (() => {
  const funcoes = sql.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
  return funcoes.length >= 30 && funcoes.filter((f) => /security definer/.test(f)).every((f) => /security definer set search_path = interno, pg_temp/.test(f));
})());
ok("a migração termina chamando as portas", sql.trimEnd().endsWith("select interno.alumia_trancar();"));
ok("a migração não apaga tabela nem coluna", !/drop table|drop column/i.test(sql));
ok("nenhum endereço de rede é lido nem guardado", !/x-forwarded-for|cf-connecting-ip|\binet\b|interno\.origem\(\)|request\.headers/i.test(sql));
ok("nenhuma localização", !/latitude|longitude|geolocal|\bgps\b/i.test(sql.replace(/nada de GPS/g, "")));

// ═══════════════════ 4. Banco ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const um = async (texto, valores = []) => (await dono(texto, valores)).rows[0];
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
await espera("a migração instala sobre o install.sql", () => exec(sql));
await espera("e de novo, sem estrago (idempotente)", () => exec(sql));
await espera("as portas: nenhuma função public.rede_ato_* nova ficou aberta", async () => (await um("select interno.alumia_trancar() as r")).r,
  (r) => Array.isArray(r?.abertas) && !r.abertas.some((x) => /^rede_ato_(mais|serie|coletivo|album|linha)/.test(x)));
await espera("as três tabelas com RLS ligada, sem política e sem coluna de rede", async () => um(`select
    (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'interno' and c.relname in ('rede_ato_series', 'rede_ato_coletivos', 'rede_ato_album') and c.relrowsecurity)::int as rls,
    (select count(*) from pg_policies where schemaname = 'interno' and tablename in ('rede_ato_series', 'rede_ato_coletivos', 'rede_ato_album'))::int as politicas,
    (select count(*) from information_schema.columns where table_schema = 'interno' and table_name in ('rede_ato_series', 'rede_ato_coletivos', 'rede_ato_album') and (data_type = 'inet' or column_name ~ '(^ip|_ip$|endereco|lat|lon)'))::int as rede`),
  (r) => r.rls === 3 && r.politicas === 0 && r.rede === 0);
await espera("as de dentro não são da API; ler é aberto a visitante; escrever não", async () => um(`select
    has_function_privilege('authenticated', 'interno.rede_ato_serie_gerar(uuid)', 'execute') as gerar,
    has_function_privilege('authenticated', 'interno.rede_ato_series_rodar()', 'execute') as rodar,
    has_function_privilege('anon', 'public.rede_ato_linha(uuid, text)', 'execute') as anon_le,
    has_function_privilege('anon', 'public.rede_ato_linha_publicar(uuid, text)', 'execute') as anon_escreve,
    has_function_privilege('anon', 'public.rede_ato_album_reservar(uuid, text, integer, integer, text, boolean)', 'execute') as anon_envia,
    pg_get_functiondef('public.rede_ato_album_reservar(uuid, text, integer, integer, text, boolean)'::regprocedure) as def`),
  (r) => !r.gerar && !r.rodar && r.anon_le && !r.anon_escreve && !r.anon_envia && r.def.includes("alumia_porta"));

let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, aal: "aal2", ip: `198.51.100.${ip++ % 250}` });
const visitante = () => ({ papel: "anon", ip: `203.0.113.${ip++ % 250}` });
const chamar = (quem, funcao, args = {}) => rpc(como(quem), funcao, args);

const P = {};
const nomes = ["dona", "faisca", "gestora", "zl", "gestor_zl", "militante", "curiosa", "fora"];
for (const [i, nome] of nomes.entries()) {
  P[nome] = await criarUsuario(`${nome}@o10.local`, `Nome Civil ${nome}`);
  await rpc({ papel: "authenticated", sub: P[nome] }, "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_18 = true, rede_consentimento = 1, rede_handle = $3 where id = $1", [P[nome], `Codinome ${i + 1}`, `${nome}_o10`]);
}
await dono("delete from interno.papeis");
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of nomes) await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
await dono("update auth.users set created_at = now() - interval '30 days'");
await dono("insert into interno.rede_orgs (perfil, tipo, verificada_em) values ($1, 'coletivo', now()), ($2, 'movimento', null) on conflict do nothing", [P.faisca, P.zl]);
await dono("insert into interno.rede_org_gestores (org, gestor, papel) values ($1, $2, 'dono'), ($3, $4, 'dono') on conflict do nothing", [P.faisca, P.gestora, P.zl, P.gestor_zl]);
await dono("insert into interno.rede_comunidades (slug, nome, categoria, tipo, publico_padrao) values ('matematica', 'Matemática', 'disciplinas', 'aberta', 'internet') on conflict (slug) do update set categoria = 'disciplinas', tipo = 'aberta', publico_padrao = 'internet'");

const daqui = (horas) => new Date(Date.now() + horas * 3_600_000).toISOString();
const diaSP = (iso, mais = 0) => new Date(new Date(iso).getTime() + mais * 86_400_000).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const ato = await espera("a dona chama um ato público", () => chamar(P.dona, "rede_ato_publicar", { p: {
  titulo: "Assembleia do Passe", inicio: daqui(50), onde: "Praça da Sé", cidade: "São Paulo", descricao: "Assembleia aberta toda semana.", comunidade: "matematica", publico: "internet",
} }), (a) => typeof a?.id === "string");
const ID = ato?.id;
const semIds = (s) => !Object.values(P).some((id) => JSON.stringify(s).includes(id));

// ── Mais ──
await espera("o rede_ato_mais de um ato sem nada", () => chamar(P.curiosa, "rede_ato_mais", { p_ato: ID }),
  (m) => m.organiza === false && m.coletivos.length === 0 && m.serie === null && m.pode_repetir === false && m.album.pode_enviar === false && m.album.pendentes === null && m.linha.aberta === false);
await espera("visitante lê o rede_ato_mais de ato público", () => rpc(visitante(), "rede_ato_mais", { p_ato: ID }), (m) => m.organiza === false && m.pode_repetir === false);
await espera("quem chamou pode repetir", () => chamar(P.dona, "rede_ato_mais", { p_ato: ID }), (m) => m.organiza === true && m.chamou === true && m.pode_repetir === true);

// ── Série ──
const ate = diaSP(ato.inicio, 28);
await recusa("só quem chamou cria a série", () => chamar(P.curiosa, "rede_ato_serie_criar", { p_ato: ID, p: { frequencia: "semanal", ate } }), "so_quem_organizou");
await recusa("frequência torta", () => chamar(P.dona, "rede_ato_serie_criar", { p_ato: ID, p: { frequencia: "diaria", ate } }), "invalido:frequencia");
await recusa("até depois de um ano", () => chamar(P.dona, "rede_ato_serie_criar", { p_ato: ID, p: { frequencia: "semanal", ate: diaSP(ato.inicio, 400) } }), "invalido:ate");
const pulo = diaSP(ato.inicio, 14);
const mais1 = await espera("a dona cria a série semanal com uma exceção", () => chamar(P.dona, "rede_ato_serie_criar", { p_ato: ID, p: { frequencia: "semanal", ate, excecoes: [pulo, "lixo-nao"] } }).catch(() =>
  chamar(P.dona, "rede_ato_serie_criar", { p_ato: ID, p: { frequencia: "semanal", ate, excecoes: [pulo] } })),
  (m) => m.serie && m.serie.frequencia === "semanal" && m.serie.modelo === true && m.serie.datas[0].atual === true && m.pode_repetir === false);
void mais1;
await espera("abre só as datas dos próximos 35 dias, sem a exceção, com hora certa", async () => (await dono(`select c.serie_data::text d, c.inicio, p.autor, p.comunidade, p.publico, p.tipo from interno.rede_chamados c join interno.rede_posts p on p.id = c.post
    where c.serie = (select serie from interno.rede_chamados where post = $1) order by c.inicio`, [ID])).rows,
  (r) => r.length === 4 && !r.some((x) => x.d === pulo) && r.every((x) => x.autor === P.dona && x.comunidade === "matematica" && x.publico === "internet" && x.tipo === "chamado")
    && new Date(r[1].inicio).getTime() - new Date(r[0].inicio).getTime() === 7 * 86_400_000);
await recusa("a mesma série não nasce duas vezes", () => chamar(P.dona, "rede_ato_serie_criar", { p_ato: ID, p: { frequencia: "semanal", ate } }), "serie_existe");
await espera("a rodada não abre nada a mais (idempotente)", async () => (await um("select interno.rede_ato_series_rodar() as r")).r, (r) => r.abertas === 0);
const datas = await espera("quem vê lê as datas da série com o link de cada ato e a pulada marcada", () => chamar(P.curiosa, "rede_ato_mais", { p_ato: ID }),
  (m) => m.serie.datas.length === 5 && m.serie.datas.filter((d) => d.situacao === "pulada").length === 1 && m.serie.datas.filter((d) => d.id).length === 4);
const segunda = datas?.serie.datas[1].id;
await espera("cada data é um ato de verdade (Você vai separado)", async () => {
  await chamar(P.militante, "rede_ato_vou", { p_id: segunda, p_sim: true });
  return um("select (select count(*) from interno.rede_vou where post = $1)::int a, (select count(*) from interno.rede_vou where post = $2)::int b", [ID, segunda]);
}, (r) => r.a === 0 && r.b === 1);
await espera("pular uma data aberta cancela aquele ato e avisa só quem confirmou", async () => {
  const m = await chamar(P.dona, "rede_ato_serie_pular", { p_ato: ID, p_data: diaSP(ato.inicio, 7) });
  const c = await um("select situacao, motivo from interno.rede_chamados where post = $1", [segunda]);
  const a = await um("select count(*)::int n from interno.avisos where para = $1 and texto like '%cancelado%'", [P.militante]);
  return { m, c, a };
}, ({ m, c, a }) => c.situacao === "cancelado" && c.motivo === "Data pulada na série" && a.n === 1 && m.serie.excecoes.length === 2);
await recusa("outra pessoa não pula data", () => chamar(P.curiosa, "rede_ato_serie_pular", { p_ato: ID, p_data: diaSP(ato.inicio, 21) }), "so_quem_organizou");
await espera("a rodada abre a data nova quando ela entra nos 35 dias", async () => {
  // Uma semana passa: o relógio anda 7 dias (aqui, as datas da série e as exceções recuam 7 dias).
  await dono(`update interno.rede_ato_series set ate = ate + 21, excecoes = (select array_agg(d - 7) from unnest(excecoes) d) where modelo = $1`, [ID]);
  await dono("update interno.rede_chamados set inicio = inicio - interval '7 days', serie_data = serie_data - 7 where serie = (select serie from interno.rede_chamados where post = $1)", [ID]);
  return (await um("select interno.rede_ato_series_rodar() as r")).r;
}, (r) => r.abertas === 1);
await espera("encerrar a série cancela as datas futuras abertas", async () => {
  const outras = (await dono("select post from interno.rede_chamados where serie = (select serie from interno.rede_chamados where post = $1) and post <> $1", [ID])).rows.map((r) => r.post);
  const m = await chamar(P.dona, "rede_ato_serie_encerrar", { p_ato: outras[outras.length - 1] });
  const n = await um("select count(*)::int n from interno.rede_chamados where serie = (select serie from interno.rede_chamados where post = $1) and situacao <> 'cancelado' and inicio > now()", [ID]);
  return { m, n };
}, ({ m, n }) => m.serie.encerrada === true && n.n === 0);
await espera("a rodada não abre nada numa série encerrada", async () => (await um("select interno.rede_ato_series_rodar() as r")).r, (r) => r.abertas === 0);

// ── Um ato novo para o resto ──
const ato2 = await espera("a dona chama outro ato, que começa em 1 hora", () => chamar(P.dona, "rede_ato_publicar", { p: {
  titulo: "Ato do Passe", inicio: daqui(1), onde: "Praça da Sé", cidade: "São Paulo", descricao: "Ato pelo passe livre.", comunidade: "matematica", publico: "internet",
} }), (a) => typeof a?.id === "string");
const A2 = ato2?.id;

// ── Coletivos ──
await recusa("só quem chamou convida", () => chamar(P.curiosa, "rede_ato_coletivo_convidar", { p_ato: A2, p_handle: "faisca_o10" }), "so_quem_organizou");
await recusa("convidar quem não é organização", () => chamar(P.dona, "rede_ato_coletivo_convidar", { p_ato: A2, p_handle: "curiosa_o10" }), "nao_encontrado");
await espera("convidar o Faísca e a ZL", async () => {
  await chamar(P.dona, "rede_ato_coletivo_convidar", { p_ato: A2, p_handle: "@Faisca_O10" });
  return chamar(P.dona, "rede_ato_coletivo_convidar", { p_ato: A2, p_handle: "zl_o10" });
}, (m) => m.convites.length === 2 && m.coletivos.length === 0);
await recusa("convidar de novo", () => chamar(P.dona, "rede_ato_coletivo_convidar", { p_ato: A2, p_handle: "faisca_o10" }), "ja_convidada");
await espera("a gestora recebe um aviso sem nome de ninguém", async () => um("select texto, ator from interno.avisos where para = $1 and texto like '%convidada%'", [P.gestora]),
  (r) => r && r.ator === null && !r.texto.includes("Codinome") && !r.texto.includes("dona_o10"));
await espera("o convite pendente não aparece para quem só vê", () => chamar(P.curiosa, "rede_ato_mais", { p_ato: A2 }), (m) => m.convites.length === 0 && m.coletivos.length === 0 && m.meus_convites.length === 0);
await espera("a gestora vê o convite da organização que gere", () => chamar(P.gestora, "rede_ato_mais", { p_ato: A2 }), (m) => m.meus_convites.length === 1 && m.meus_convites[0].handle === "faisca_o10");
await recusa("quem não gere não responde pela organização", () => chamar(P.curiosa, "rede_ato_coletivo_responder", { p_ato: A2, p_handle: "faisca_o10", p_aceito: true }), "nao_encontrado");
await espera("o Faísca aceita; a ZL recusa", async () => {
  await chamar(P.gestora, "rede_ato_coletivo_responder", { p_ato: A2, p_handle: "faisca_o10", p_aceito: true });
  await chamar(P.gestor_zl, "rede_ato_coletivo_responder", { p_ato: A2, p_handle: "zl_o10", p_aceito: false });
  return chamar(P.curiosa, "rede_ato_mais", { p_ato: A2 });
}, (m) => m.coletivos.length === 1 && m.coletivos[0].handle === "faisca_o10" && m.coletivos[0].selo === true && semIds(m));
await espera("visitante também vê quem chamou junto", () => rpc(visitante(), "rede_ato_mais", { p_ato: A2 }), (m) => m.coletivos.length === 1);
await espera("a gestora do Faísca passa a moderar o ato", () => chamar(P.gestora, "rede_ato_mais", { p_ato: A2 }), (m) => m.organiza === true && m.chamou === false && m.minhas_orgs.length === 1);

// ── Álbum ──
await recusa("quem não confirmou não manda foto", () => chamar(P.curiosa, "rede_ato_album_reservar", { p_ato: A2, p_ext: "webp", p_largura: 800, p_altura: 600, p_legenda: "", p_conferida: true }), "album_fechado");
await chamar(P.militante, "rede_ato_vou", { p_id: A2, p_sim: true });
await recusa("sem declarar que conferiu os rostos, nada sobe", () => chamar(P.militante, "rede_ato_album_reservar", { p_ato: A2, p_ext: "webp", p_largura: 800, p_altura: 600, p_legenda: "", p_conferida: false }), "rostos_nao_conferidos");
await recusa("legenda com telefone", () => chamar(P.militante, "rede_ato_album_reservar", { p_ato: A2, p_ext: "webp", p_largura: 800, p_altura: 600, p_legenda: "liga 11 98765-4321", p_conferida: true }), "dado_pessoal");
await recusa("extensão que não é imagem", () => chamar(P.militante, "rede_ato_album_reservar", { p_ato: A2, p_ext: "gif", p_largura: 800, p_altura: 600, p_legenda: "", p_conferida: true }), "invalido:arquivo");
const reserva = await espera("quem confirmou reserva o lugar da foto; o caminho não tem o id da pessoa", () => chamar(P.militante, "rede_ato_album_reservar", { p_ato: A2, p_ext: "webp", p_largura: 800, p_altura: 600, p_legenda: "A faixa na escadaria", p_conferida: true }),
  (r) => r.caminho.startsWith(`${A2}/`) && !r.caminho.includes(P.militante));
await espera("a reserva ainda não aparece para ninguém", () => chamar(P.militante, "rede_ato_album", { p_ato: A2 }), (a) => a.fotos.length === 0);
await espera("depois do envio, a foto vai para a fila: quem mandou vê a dela como pendente", async () => {
  await chamar(P.militante, "rede_ato_album_enviada", { p_id: reserva.id });
  return chamar(P.militante, "rede_ato_album", { p_ato: A2 });
}, (a) => a.fotos.length === 1 && a.fotos[0].minha === true && a.fotos[0].estado === "pendente" && a.organiza === false && a.pendentes.length === 0);
await espera("quem chamou recebe o aviso da fila, sem nome de ninguém", async () => um("select texto, ator from interno.avisos where para = $1 and texto like '%fotos novas%'", [P.dona]), (r) => r && r.ator === null);
await espera("quem só vê o ato não vê a foto pendente nem o caminho", async () => {
  const a = await chamar(P.curiosa, "rede_ato_album", { p_ato: A2 });
  let caminho = "passou";
  try { await chamar(P.curiosa, "rede_ato_album_caminho", { p_id: reserva.id }); } catch (e) { caminho = String(e.message); }
  return { a, caminho };
}, ({ a, caminho }) => a.fotos.length === 0 && caminho.includes("nao_encontrado"));
await espera("a moderação (o Faísca também) vê a pendente sem saber quem mandou", () => chamar(P.gestora, "rede_ato_album", { p_ato: A2 }),
  (a) => a.organiza === true && a.pendentes.length === 1 && a.pendentes[0].minha === false && semIds(a));
await recusa("quem não modera não aprova", () => chamar(P.curiosa, "rede_ato_album_decidir", { p_id: reserva.id, p_aprovar: true }), "nao_encontrado");
await espera("a moderação aprova e a foto aparece para quem vê o ato (e para visitante, que o ato é público)", async () => {
  await chamar(P.gestora, "rede_ato_album_decidir", { p_id: reserva.id, p_aprovar: true });
  return { c: await chamar(P.curiosa, "rede_ato_album", { p_ato: A2 }), v: await rpc(visitante(), "rede_ato_album", { p_ato: A2 }), k: await chamar(P.curiosa, "rede_ato_album_caminho", { p_id: reserva.id }) };
}, ({ c, v, k }) => c.fotos.length === 1 && c.fotos[0].estado === "aprovada" && c.fotos[0].minha === false && v.fotos.length === 1 && k.bucket === "rede-album" && semIds(c));
const r2 = await chamar(P.militante, "rede_ato_album_reservar", { p_ato: A2, p_ext: "jpg", p_largura: 600, p_altura: 600, p_legenda: "", p_conferida: true });
await chamar(P.militante, "rede_ato_album_enviada", { p_id: r2.id });
await espera("recusar apaga o registro e vai à auditoria sem quem mandou", async () => {
  await chamar(P.dona, "rede_ato_album_decidir", { p_id: r2.id, p_aprovar: false });
  return um("select (select count(*) from interno.rede_ato_album where id = $1)::int n, (select detalhes::text from interno.auditoria where acao = 'ato_foto_tirada' order by id desc limit 1) d", [r2.id]);
}, (r) => r.n === 0 && !Object.values(P).some((id) => r.d.includes(id)));
await espera("quem mandou apaga a própria foto", async () => {
  const r3 = await chamar(P.militante, "rede_ato_album_reservar", { p_ato: A2, p_ext: "png", p_largura: 600, p_altura: 600, p_legenda: "", p_conferida: true });
  await chamar(P.militante, "rede_ato_album_enviada", { p_id: r3.id });
  await chamar(P.militante, "rede_ato_album_apagar", { p_id: r3.id });
  return um("select count(*)::int n from interno.rede_ato_album where id = $1", [r3.id]);
}, (r) => r.n === 0);
await recusa("ninguém apaga a foto de outra pessoa", () => chamar(P.curiosa, "rede_ato_album_apagar", { p_id: reserva.id }), "nao_encontrado");
const r4 = await chamar(P.dona, "rede_ato_album_reservar", { p_ato: A2, p_ext: "webp", p_largura: 600, p_altura: 600, p_legenda: "", p_conferida: true });
await espera("nem a foto de quem organiza sai aprovada sozinha: entra na fila e visitante não a vê", async () => ({
  f: await chamar(P.dona, "rede_ato_album_enviada", { p_id: r4.id }),
  v: await rpc(visitante(), "rede_ato_album_pode_ver", { p_caminho: r4.caminho }),
}), ({ f, v }) => f.estado === "pendente" && v === false);
await espera("a regra antiga de envio do depósito responde não, até no lugar reservado pela própria pessoa", async () => {
  const r6 = await chamar(P.militante, "rede_ato_album_reservar", { p_ato: A2, p_ext: "webp", p_largura: 600, p_altura: 600, p_legenda: "", p_conferida: true });
  return chamar(P.militante, "rede_ato_album_pode_enviar", { p_caminho: r6.caminho });
}, (r) => r === false);
await recusa("a lista dos arquivos órfãos é só da chave de serviço", () => chamar(P.dona, "rede_ato_album_orfas", { p_limite: 10 }), "");
await espera("a faxina leva a reserva que nunca virou foto", async () => {
  const r5 = await chamar(P.militante, "rede_ato_album_reservar", { p_ato: A2, p_ext: "webp", p_largura: 600, p_altura: 600, p_legenda: "", p_conferida: true });
  await dono("update interno.rede_ato_album set criado_em = now() - interval '2 days' where id = $1", [r5.id]);
  await dono("select interno.rede_ato_album_faxina()");
  return um("select count(*)::int n from interno.rede_ato_album where id = $1", [r5.id]);
}, (r) => r.n === 0);

// ── Linha ao vivo ──
await recusa("visitante não escreve na linha", () => rpc(visitante(), "rede_ato_linha_publicar", { p_ato: A2, p_texto: "oi" }), "");
await recusa("fora da janela, a linha está fechada", () => chamar(P.militante, "rede_ato_linha_publicar", { p_ato: ID, p_texto: "Chegando!" }), "linha_fechada");
const l1 = await espera("na janela, quem é membro escreve; o post fica marcado com o ato", () => chamar(P.militante, "rede_ato_linha_publicar", { p_ato: A2, p_texto: "Concentração cheia na escadaria." }),
  (p) => p.id && p.comunidade === "matematica");
await espera("o post da linha é um post comum, com o ato marcado", async () => um("select ato, resposta_a from interno.rede_posts where id = $1", [l1?.id]), (r) => r.ato === A2 && r.resposta_a === null);
await recusa("dado pessoal na linha é recusado (as regras de sempre do publicar)", () => chamar(P.curiosa, "rede_ato_linha_publicar", { p_ato: A2, p_texto: "liga 11 98765-4321" }), "dado_pessoal");
await dono("delete from interno.limites");
const l2 = await chamar(P.curiosa, "rede_ato_linha_publicar", { p_ato: A2, p_texto: "Saindo do metrô agora." });
await dono("update interno.rede_posts set criado_em = criado_em - interval '5 minutes' where id = $1", [l1?.id]);
const linha = await espera("a linha vem em ordem de chegada (o mais antigo primeiro), também para visitante", async () => ({ m: await chamar(P.fora, "rede_ato_linha", { p_ato: A2 }), v: await rpc(visitante(), "rede_ato_linha", { p_ato: A2 }) }),
  ({ m, v }) => m.itens.map((p) => p.id).join() === [l1?.id, l2?.id].join() && v.itens.length === 2 && typeof m.proximo === "string");
await espera("com o cursor, só o que chegou depois", async () => {
  const l3 = await chamar(P.militante, "rede_ato_linha_publicar", { p_ato: A2, p_texto: "Ato saindo em caminhada." });
  const r = await chamar(P.fora, "rede_ato_linha", { p_ato: A2, p_depois: linha.m.proximo });
  return { r, l3 };
}, ({ r, l3 }) => r.itens.length === 1 && r.itens[0].id === l3.id);
await espera("bloqueio vale na linha", async () => {
  await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2)", [P.curiosa, P.fora]);
  return chamar(P.fora, "rede_ato_linha", { p_ato: A2 });
}, (r) => !r.itens.some((p) => p.id === l2.id));
await recusa("quem não escreveu nem modera não tira da linha", () => chamar(P.fora, "rede_ato_linha_tirar", { p_post: l1.id }), "nao_encontrado");
await espera("quem escreveu tira o próprio post da linha (o post continua)", async () => {
  await chamar(P.curiosa, "rede_ato_linha_tirar", { p_post: l2.id });
  return um("select ato, apagado_em from interno.rede_posts where id = $1", [l2.id]);
}, (r) => r.ato === null && r.apagado_em === null);
await espera("a moderação do ato tira um post da linha e fica na auditoria", async () => {
  await chamar(P.gestora, "rede_ato_linha_tirar", { p_post: l1.id });
  return um("select (select ato from interno.rede_posts where id = $1) ato, (select count(*)::int from interno.auditoria where acao = 'ato_linha_tirada') n", [l1.id]);
}, (r) => r.ato === null && r.n === 1);
await espera("cancelar o ato fecha a linha e o álbum", async () => {
  await chamar(P.dona, "rede_ato_mudar", { p_id: A2, p_situacao: "cancelado", p_inicio: null, p_motivo: "" });
  return chamar(P.militante, "rede_ato_mais", { p_ato: A2 });
}, (m) => m.linha.pode_escrever === false && m.album.pode_enviar === false);

// ── Tirar organização e conta apagada ──
await espera("a organização sai do ato", async () => {
  await chamar(P.gestora, "rede_ato_coletivo_tirar", { p_ato: A2, p_handle: "faisca_o10" });
  return chamar(P.gestora, "rede_ato_mais", { p_ato: A2 });
}, (m) => m.coletivos.length === 0 && m.organiza === false);
await espera("a conta apagada leva as fotos dela (cascata)", async () => {
  await dono("delete from auth.users where id = $1", [P.militante]);
  return um("select count(*)::int n from interno.rede_ato_album where quem = $1", [P.militante]);
}, (r) => r.n === 0);

// ═══════════════════ Resultado ═══════════════════
console.log(`\nAtos e eventos (frente 10F): ${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
