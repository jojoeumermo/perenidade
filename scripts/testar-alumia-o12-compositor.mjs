// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o compositor da onda 12 (supabase/migracoes/20261118-alumia-o12-compositor.sql) num Postgres de verdade
// (scripts/banco-local.mjs), com a migração rodada DUAS vezes sobre o install.sql:
//   · até 10 imagens por post (eram 4), com legenda por imagem, e o arranjo (grade, carrossel, colagem); a legenda passa pela mesma
//     conferência de dado pessoal e pela triagem; o cartão recebe as escolhas por lote, só de post que a pessoa pode ver;
//   · figurinhas do pacote da casa em post e resposta, e só a figurinha;
//   · o fio de uma vez: de 2 a 10 blocos, cada um respondendo ao anterior; tudo ou nada; bloco segurado pela triagem faz os de baixo
//     esperarem e saírem quando a mediação libera (e sumirem quando o bloco é apagado); o Desfazer leva o fio inteiro;
//   · o agendar no fuso escolhido (o banco converte com pg_timezone_names) e as escolhas que saem junto com o agendado.
// Também confere as peças puras (lib/rede/publicar/compositor.ts e figurinhas.ts), os seis idiomas dos textos e as telas.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-alumia-o12-compositor.mjs
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import * as C from "../lib/rede/publicar/compositor.ts";
import { FIGURINHAS, eFigurinha, textoDaFigurinha } from "../lib/rede/publicar/figurinhas.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");

let certos = 0;
const falhas = [];
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 500)}`);
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
const sql = ler("supabase/migracoes/20261118-alumia-o12-compositor.sql");
const semComentario = sql.replace(/^\s*--.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
ok("toda função nova é security definer com search_path fixo (fora a lista imutável)", (() => {
  const funcoes = sql.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
  return funcoes.length >= 12 && funcoes.filter((f) => !/rede_o12_figurinhas\(\)/.test(f)).every((f) => /security definer set search_path = interno, pg_temp/.test(f));
})());
ok("quatro tabelas novas, todas em interno", (sql.match(/create table if not exists interno\./g) ?? []).length === 4 && (sql.match(/create table/gi) ?? []).length === 4);
ok("RLS ligada nas quatro e nenhuma política", (sql.match(/enable row level security/g) ?? []).length === 4 && !/create policy/i.test(sql));
ok("nenhuma permissão direta em tabela", !/grant [a-z, ]+ on (table )?interno\./i.test(sql));
ok("a porta passa em toda função nova (alumia_trancar no fim)", /select interno\.alumia_trancar\(\);\s*$/.test(sql));
ok("não mexe na versão da Alumia, em rede_ve nem na federação", !/rede_alumia_versao|function interno\.rede_ve\(|function interno\.rede2_pode_ver|function interno\.rede_fed_/.test(semComentario));
ok("nenhum endereço de rede", !/\bip\b|x-forwarded|cf-connecting|\binet\b/i.test(semComentario));
ok("nenhuma função com parâmetro do tipo linha de tabela", !/function [a-z_.]+\([^)]*interno\.rede_[a-z_]+\b(?!\()/i.test(sql.replace(/\$\$[\s\S]*?\$\$/g, "")));
ok("nenhum valor padrão em parâmetro", !/function [a-z_.]+\([^)]*\bdefault\b/i.test(sql));
ok("as figurinhas do banco são as do pacote (função e regra da tabela)", (() => {
  const daFuncao = /array\[([^\]]+)\]/.exec(sql.slice(sql.indexOf("interno.rede_o12_figurinhas()")))?.[1];
  const daTabela = /figurinha in \(([^)]+)\)/.exec(sql)?.[1];
  const lista = (x) => (x ?? "").replace(/\s+/g, " ").match(/'[^']+'/g)?.map((s) => s.slice(1, -1)) ?? [];
  return JSON.stringify(lista(daFuncao)) === JSON.stringify([...FIGURINHAS]) && JSON.stringify(lista(daTabela)) === JSON.stringify([...FIGURINHAS]);
})());

// ═══════════════════ 1. As peças puras ═══════════════════
ok("limites: 10 blocos de 500, 10 imagens, legenda de 280", C.LIMITE_DE_BLOCOS === 10 && C.LIMITE_DO_BLOCO === 500 && C.LIMITE_DE_IMAGENS === 10 && C.LIMITE_DA_LEGENDA === 280);
ok("fio: vazios do fim saem, vazio no meio impede", JSON.stringify(C.blocosDoFio(["a ", " b", "", "  "])) === '["a","b"]' && C.fioPronto(["a", "b", ""]) && !C.fioPronto(["a", "", "c"]) && !C.fioPronto(["a"]));
ok("fio: mais de 10 blocos ou bloco de 501 não vai", !C.fioPronto(Array.from({ length: 11 }, () => "x")) && !C.fioPronto(["a", "b".repeat(501)]));
await espera("dividir: texto curto fica num bloco; o longo vira blocos de até 500, sem perder palavra", async () => {
  const curto = C.dividirEmBlocos("Um texto curto.");
  const frase = "A greve dos metalúrgicos de 1980 parou o ABC por 41 dias. ";
  const longo = frase.repeat(30);
  const b = C.dividirEmBlocos(longo);
  return { curto, n: b.length, cabem: b.every((x) => x.length <= 500), palavras: b.join(" ").split(/\s+/).filter(Boolean).length === longo.split(/\s+/).filter(Boolean).length };
}, (r) => r.curto.length === 1 && r.n >= 4 && r.cabem && r.palavras);
ok("dividir: nunca passa de 10 blocos", C.dividirEmBlocos("palavra ".repeat(2000)).length === 10);
ok("dividir: palavra maior que o bloco é partida", C.dividirEmBlocos("x".repeat(1200)).every((b, i, l) => b.length <= 500 || i === l.length - 1));
ok("arranjo: com menos de 2 imagens é a grade", C.arranjoQueVale("carrossel", 1) === "grade" && C.arranjoQueVale("colagem", 3) === "colagem" && C.arranjoQueVale(null, 5) === "grade");
ok("colagem: cada grupo fecha as 6 colunas, um ladrilho por imagem", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].every((n) => {
  const l = C.ladrilhosDaColagem(n);
  if (l.length !== n) return false;
  const area = l.reduce((s, x) => s + x.colunas * x.linhas, 0);
  return area % 6 === 0;
}));
ok("carrossel: as setas param nas pontas", C.passoDoCarrossel(0, 5, -1) === 0 && C.passoDoCarrossel(4, 5, 1) === 4 && C.passoDoCarrossel(2, 5, 1) === 3);
ok("fuso: nomes de verdade valem, inventados não", C.fusoValido("America/Manaus") && C.fusoValido("Asia/Kolkata") && !C.fusoValido("Lua/Base") && !C.fusoValido("") && !C.fusoValido("America/Sao Paulo"));
ok("fuso: Brasília e Manaus convertem certo (sem horário de verão em 2026)", C.instanteNoFuso("2026-11-20T18:30", "America/Sao_Paulo")?.toISOString() === "2026-11-20T21:30:00.000Z" && C.instanteNoFuso("2026-11-20T18:30", "America/Manaus")?.toISOString() === "2026-11-20T22:30:00.000Z");
ok("fuso: com horário de verão (Lisboa no verão e no inverno)", C.instanteNoFuso("2026-07-01T12:00", "Europe/Lisbon")?.toISOString() === "2026-07-01T11:00:00.000Z" && C.instanteNoFuso("2026-12-01T12:00", "Europe/Lisbon")?.toISOString() === "2026-12-01T12:00:00.000Z");
ok("fuso: meia hora (Índia) e campo torto", C.instanteNoFuso("2026-11-20T10:00", "Asia/Kolkata")?.toISOString() === "2026-11-20T04:30:00.000Z" && C.instanteNoFuso("20/11/2026 10:00", "Asia/Kolkata") === null && C.instanteNoFuso("2026-13-01T10:00", "UTC") === null);
ok("fuso: de 5 minutos a 30 dias", (() => {
  const agora = Date.UTC(2026, 10, 16, 12, 0);
  return !C.agendaCabe("2026-11-16T09:02", "America/Sao_Paulo", agora) && C.agendaCabe("2026-11-16T09:10", "America/Sao_Paulo", agora) && !C.agendaCabe("2026-12-20T09:10", "America/Sao_Paulo", agora);
})());
ok("fuso: a parede de agora no fuso escolhido", C.paredeDeAgora("America/Rio_Branco", Date.UTC(2026, 10, 16, 12, 0)) === "2026-11-16T07:00");
ok("fuso: a lista do Brasil tem 12, todos válidos", C.FUSOS_DO_BRASIL.length === 12 && C.FUSOS_DO_BRASIL.every(C.fusoValido));
ok("fuso: a hora escrita leva a diferença", /GMT-4/.test(C.quandoNoFuso("2026-11-20T22:30:00Z", "America/Manaus", "pt")) && /18:30/.test(C.quandoNoFuso("2026-11-20T22:30:00Z", "America/Manaus", "pt")));
ok("fuso: cidade do nome", C.cidadeDoFuso("America/Porto_Velho") === "Porto Velho");
ok("figurinhas: 12 nomes, só eles valem", FIGURINHAS.length === 12 && eFigurinha("cravo") && !eFigurinha("caveira") && !eFigurinha(3));
ok("figurinhas: o texto do post só com figurinha", textoDaFigurinha("[Figurinha: {nome}]", "Cravo vermelho") === "[Figurinha: Cravo vermelho]");

// ═══════════════════ 2. Banco e pessoas ═══════════════════
// O álbum do prompt 4 (20261127-p4-compositor.sql) sobe o teto para 20 e redefine inteiras as funções que esta onda mexe por replace:
// depois que a junção o cola no install.sql, esta prova roda sobre o banco de antes dele (o que ela prova é a onda 12).
const p4c = ler("supabase/migracoes/20261127-p4-compositor.sql");
const semCr = (t) => t.replace(/\r\n/g, "\n");
const banco = await criarBanco(semCr(ler("supabase/install.sql")).includes(semCr(p4c).trim()) ? { antesDe: p4c } : {});
const { dono, criarUsuario, rpc } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
const um = async (texto, valores = []) => (await dono(texto, valores)).rows[0];

await espera("a migração instala sobre o install.sql", () => exec(sql));
await espera("de novo (idempotente)", () => exec(sql));

let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++ % 250}` });
const visitante = () => ({ papel: "anon", ip: `203.0.113.${ip++ % 250}` });
const P = {};
const nomes = ["ana", "bia", "caio", "duda"];
for (const [i, nome] of nomes.entries()) {
  P[nome] = await criarUsuario(`${nome}@o12.local`, nome);
  await rpc(como(P[nome]), "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3 where id = $1", [P[nome], `Pessoa ${i + 1}`, `pessoa_${nome}`]);
}
await dono("delete from interno.papeis");
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of nomes) {
  await dono("update interno.perfis set rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome]]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}
await dono("update auth.users set created_at = now() - interval '30 days'");
const zerar = () => dono("delete from interno.limites");
// Os níveis de confiança limitam as imagens por post: ana, bia e duda são de nível alto (líder); caio fica no nível que tem.
for (const nome of ["ana", "bia", "duda"]) await dono("insert into interno.rede_lideres (usuario) values ($1) on conflict do nothing", [P[nome]]);
const caminho = (quem, ext = "jpg") => `${P[quem]}/${randomUUID()}.${ext}`;
const imagens = (quem, n, legenda = (i) => `Legenda ${i + 1}`) =>
  Array.from({ length: n }, (_, i) => ({ caminho: caminho(quem), alt: `Foto ${i + 1} do ato`, largura: 800, altura: 600, ...(legenda ? { legenda: legenda(i) } : {}) }));
const pub = (quem, p) => rpc(como(P[quem]), "rede_pub_o12_publicar", { p });
const extras = (quem, ids) => rpc(quem ? como(P[quem]) : visitante(), "rede_pub_o12_extras", { p_ids: ids });

// ── Tabelas e funções ──
await espera("as quatro tabelas: RLS ligada e nenhuma política", async () => (await dono(`select c.relname, c.relrowsecurity as r,
  (select count(*)::int from pg_policies p where p.schemaname = 'interno' and p.tablename = c.relname) as n
  from pg_class c join pg_namespace s on s.oid = c.relnamespace where s.nspname = 'interno' and c.relname like 'rede\\_o12\\_%' and c.relkind = 'r'`)).rows,
(rs) => rs.length === 4 && rs.every((r) => r.r === true && r.n === 0));
await espera("as quatro tabelas: nenhuma permissão para anon/authenticated", async () =>
  (await um("select count(*)::int as n from information_schema.role_table_grants where table_schema = 'interno' and table_name like 'rede\\_o12\\_%' and grantee in ('anon', 'authenticated', 'PUBLIC')")).n, (n) => n === 0);
const daTela = ["rede_pub_o12_publicar", "rede_pub_o12_fio", "rede_pub_o12_fio_desfazer", "rede_pub_o12_agendar", "rede_pub_o12_agendados", "rede_pub_o12_extras"];
await espera("as da tela passam pela porta; só conta logada escreve; as escolhas dos posts também para visitante (a matriz decide)", async () => (await dono(`select p.proname, p.prosrc ~ 'interno\\.alumia_porta\\(\\)' as porta,
  has_function_privilege('anon', p.oid, 'execute') as anon, has_function_privilege('authenticated', p.oid, 'execute') as aut
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any ($1)`, [daTela])).rows,
(rs) => rs.length === daTela.length && rs.every((r) => r.porta && r.aut && r.anon === (r.proname === "rede_pub_o12_extras")));
await espera("as de dentro ninguém chama pela API", async () => (await um(`select bool_or(has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')) as alguma, count(*)::int as n
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'interno' and p.proname like 'rede\\_o12\\_%'`)), (r) => r.n >= 7 && r.alguma === false);
await espera("a porta continua sem nenhuma função aberta", async () => (await um("select interno.alumia_trancar() as r")).r, (r) => Array.isArray(r.abertas) ? r.abertas.length === 0 : true);
await recusa("visitante não publica", () => rpc(visitante(), "rede_pub_o12_publicar", { p: { texto: "x" } }), "permission denied");
await espera("a regra de ordem da tabela de imagens vai até 9", async () => (await um("select pg_get_constraintdef(oid) as d from pg_constraint where conrelid = 'interno.rede_midia'::regclass and conname = 'rede_midia_ordem_check'")).d,
  (d) => /ordem <= 9/.test(d));
await espera("os níveis: novo 1, básico 2, membro 6, regular e líder 10 (e o teto da tabela é 10)", async () => (await dono("select nivel, imagens from interno.rede_niveis order by nivel")).rows.map((r) => r.imagens),
  (v) => JSON.stringify(v) === "[1,2,6,10,10]");
await espera("um valor que a coordenação mudou não é atropelado ao rodar de novo", async () => {
  await dono("update interno.rede_niveis set imagens = 3 where nivel = 2");
  await exec(sql);
  const v = (await um("select imagens from interno.rede_niveis where nivel = 2")).imagens;
  await dono("update interno.rede_niveis set imagens = 6 where nivel = 2");
  return v;
}, (v) => v === 3);

// ═══════════════════ 3. Carrossel, colagem e legenda ═══════════════════
const dez = await espera("10 imagens com legenda em carrossel", () => pub("ana", { texto: "Fotos do ato de ontem", midia: imagens("ana", 10), arranjo: "carrossel" }),
  (r) => r?.id && r.o12?.arranjo === "carrossel" && Object.keys(r.o12.legendas ?? {}).length === 10);
await espera("no banco: 10 imagens na ordem de 0 a 9 e 10 legendas", async () => um(`select count(*)::int as n, min(ordem) as a, max(ordem) as b,
  (select count(*)::int from interno.rede_o12_midia l join interno.rede_midia m on m.id = l.midia where m.post = $1) as l from interno.rede_midia where post = $1`, [dez?.id]),
(r) => r.n === 10 && r.a === 0 && r.b === 9 && r.l === 10);
await recusa("11 imagens: recusa", () => pub("ana", { texto: "x", midia: imagens("ana", 11) }), "invalido:midia");
await recusa("11 imagens pela função de sempre: recusa", () => rpc(como(P.ana), "rede_publicar", { p: { texto: "x", midia: imagens("ana", 11, null) } }), "invalido:midia");
await zerar();
await espera("pela função de sempre, 6 imagens agora passam", () => rpc(como(P.ana), "rede_publicar", { p: { texto: "Seis fotos", midia: imagens("ana", 6, null) } }), (r) => r?.midia?.length === 6);
await recusa("o nível de confiança continua valendo: caio (nível baixo) não põe 10 imagens", () => pub("caio", { texto: "Muitas", midia: imagens("caio", 10, null) }), "nivel_imagens");
await recusa("legenda com telefone: dado pessoal", () => pub("ana", { texto: "x", midia: imagens("ana", 2, (i) => (i ? "Liga (11) 98765-4321" : "ok")) }), "dado_pessoal");
await recusa("legenda com CPF: dado pessoal", () => pub("ana", { texto: "x", midia: imagens("ana", 2, () => "CPF 529.982.247-25") }), "dado_pessoal");
await recusa("legenda com xingamento de ódio: vai para a leitura (a regra aberta)", () => pub("ana", { texto: "x", midia: imagens("ana", 2, () => "olha esse macaco") }), "legenda_revisar");
await recusa("legenda de 281 letras: recusa", () => pub("ana", { texto: "x", midia: imagens("ana", 2, () => "a".repeat(281)) }), "invalido:legenda");
await recusa("arranjo inventado: recusa", () => pub("ana", { texto: "x", midia: imagens("ana", 2), arranjo: "mosaico" }), "invalido:arranjo");
await espera("nada ficou dos que foram recusados (tudo ou nada)", async () => (await um("select count(*)::int as n from interno.rede_posts where autor = $1 and texto = 'x'", [P.ana])).n, (n) => n === 0);
const umaSo = await espera("uma imagem só em colagem: fica grade (não grava arranjo)", () => pub("ana", { texto: "Uma foto", midia: imagens("ana", 1), arranjo: "colagem" }), (r) => r?.o12?.arranjo === undefined);
await espera("colagem de 5", () => pub("ana", { texto: "Colagem", midia: imagens("ana", 5, null), arranjo: "colagem" }), (r) => r?.o12?.arranjo === "colagem" && !r.o12.legendas);

// As escolhas para quem lê.
await espera("bia (membro) vê as escolhas e as legendas pelo id da imagem", async () => {
  const r = await extras("bia", [dez.id, umaSo.id]);
  const midia = (await dono("select id::text from interno.rede_midia where post = $1 order by ordem", [dez.id])).rows.map((x) => x.id);
  return { r, midia };
}, ({ r, midia }) => r[dez.id]?.arranjo === "carrossel" && r[dez.id].legendas[midia[0]] === "Legenda 1" && r[dez.id].legendas[midia[9]] === "Legenda 10" && r[umaSo.id]?.arranjo === "grade");
await espera("visitante não vê as escolhas de post só para membros", () => extras(null, [dez.id]), (r) => Object.keys(r).length === 0);
await espera("as escolhas nunca trazem pessoa nenhuma", () => extras("bia", [dez.id]), (r) => !JSON.stringify(r).includes(P.ana) && !JSON.stringify(r).includes("pessoa_"));
await espera("tirar a imagem (corrigir) leva a legenda junto", async () => {
  const m = (await dono("select id::text from interno.rede_midia where post = $1 order by ordem", [dez.id])).rows.map((x) => x.id);
  await rpc(como(P.ana), "rede_pub_corrigir", { p_post: dez.id, p: { tirar: m.slice(0, 5), alts: m.slice(5).map((id) => ({ id, alt: "nova descrição" })) } });
  return um("select (select count(*)::int from interno.rede_midia where post = $1) as m, (select count(*)::int from interno.rede_o12_midia l join interno.rede_midia x on x.id = l.midia where x.post = $1) as l", [dez.id]);
}, (r) => r.m === 5 && r.l === 5);

// ═══════════════════ 4. Figurinhas ═══════════════════
await zerar();
const fig = await espera("post com figurinha", () => pub("bia", { texto: "Bom dia, camaradas", figurinha: "cafe" }), (r) => r?.o12?.figurinha === "cafe" && !r.o12.so_figurinha);
await espera("resposta só com a figurinha (o texto é o nome dela)", () => pub("caio", { texto: "[Figurinha: Punho erguido]", resposta_a: fig.id, figurinha: "punho", so_figurinha: true }),
  (r) => r?.resposta_a === fig.id && r.o12?.so_figurinha === true && r.o12.figurinha === "punho");
await recusa("figurinha fora do pacote: recusa", () => pub("bia", { texto: "x", figurinha: "caveira" }), "invalido:figurinha");
await recusa("só figurinha sem figurinha: recusa", () => pub("bia", { texto: "x", so_figurinha: true }), "invalido:figurinha");
await espera("a regra da tabela também barra nome de fora (mesmo pelo dono)", async () => {
  try {
    await dono("insert into interno.rede_o12_post (post, figurinha) values ($1, 'caveira')", [fig.id]);
    return false;
  } catch {
    return true;
  }
}, (x) => x === true);

// ═══════════════════ 5. O fio de uma vez ═══════════════════
await zerar();
const fio = (quem, p) => rpc(como(P[quem]), "rede_pub_o12_fio", { p });
await recusa("um bloco só não é fio", () => fio("duda", { blocos: [{ texto: "a" }] }), "invalido:fio");
await recusa("11 blocos: recusa", () => fio("duda", { blocos: Array.from({ length: 11 }, (_, i) => ({ texto: `bloco ${i}` })) }), "invalido:fio");
await recusa("bloco que responde a outro post: recusa", () => fio("duda", { blocos: [{ texto: "a" }, { texto: "b", resposta_a: fig.id }] }), "invalido:fio");
await recusa("fio como resposta: recusa", () => fio("duda", { resposta_a: fig.id, blocos: [{ texto: "a" }, { texto: "b" }] }), "invalido:fio");
await recusa("enquete não é fio", () => fio("duda", { tipo: "enquete", blocos: [{ texto: "a" }, { texto: "b" }] }), "invalido:fio");
const antes = (await um("select count(*)::int as n from interno.rede_posts where autor = $1", [P.duda])).n;
await recusa("tudo ou nada: o terceiro bloco com CPF derruba o fio inteiro", () => fio("duda", { blocos: [{ texto: "Primeiro" }, { texto: "Segundo" }, { texto: "Meu CPF 529.982.247-25" }] }), "dado_pessoal");
await espera("nenhum bloco ficou", async () => (await um("select count(*)::int as n from interno.rede_posts where autor = $1", [P.duda])).n, (n) => n === antes);
const f3 = await espera("fio de 4 blocos, com imagem e figurinha num bloco do meio", () => fio("duda", {
  aviso: "política",
  responde_quem: "seguindo",
  blocos: [{ texto: "1/4 Por que a tarifa zero importa" }, { texto: "2/4 O transporte é direito", midia: imagens("duda", 2), arranjo: "carrossel" }, { texto: "3/4 Quem paga hoje", figurinha: "megafone" }, { texto: "4/4 Vem pra plenária" }],
}), (r) => r?.ids?.length === 4 && r.esperando === 0 && r.posts?.[0]?.id === r.ids[0]);
await espera("no banco: cada bloco responde ao anterior, marcado como fio, com o mesmo aviso", async () => (await dono(`select x.id::text, x.resposta_a::text as r, x.aviso, coalesce(e.fio, false) as fio, e.responde_quem
  from unnest($1::uuid[]) with ordinality u(id, n) join interno.rede_posts x on x.id = u.id left join interno.rede_pub_extras e on e.post = x.id order by u.n`, [f3.ids])).rows,
(rs) => rs.length === 4 && rs[0].r === null && rs[1].r === rs[0].id && rs[2].r === rs[1].id && rs[3].r === rs[2].id && rs.slice(1).every((x) => x.fio) && rs.every((x) => x.aviso === "política") && rs[0].responde_quem === "seguindo");
await espera("o bloco do meio guardou o carrossel e a figurinha", () => extras("bia", f3.ids), (r) => r[f3.ids[1]]?.arranjo === "carrossel" && r[f3.ids[2]]?.figurinha === "megafone");
await espera("Desfazer leva o fio inteiro", async () => {
  await rpc(como(P.duda), "rede_pub_o12_fio_desfazer", { p_ids: f3.ids });
  return (await um("select count(*)::int as n from interno.rede_posts where id = any ($1::uuid[])", [f3.ids])).n;
}, (n) => n === 0);
await espera("fio com prazo para sumir: todos os blocos somem juntos", async () => {
  const r = await fio("duda", { some_em: "24h", blocos: [{ texto: "Some amanhã 1" }, { texto: "Some amanhã 2" }, { texto: "Some amanhã 3" }] });
  return (await dono("select expira_em from interno.rede_posts where id = any ($1::uuid[])", [r.ids])).rows.map((x) => String(x.expira_em));
}, (v) => v.length === 3 && v[0] !== "null" && new Set(v).size === 1);

// Bloco segurado pela triagem: os de baixo esperam.
await zerar();
const segurado = await espera("bloco do meio vai para a leitura da mediação: os de baixo esperam guardados", () => fio("duda", {
  blocos: [{ texto: "Abre o fio" }, { texto: "Aqui tem um viado no texto" }, { texto: "Depois 1" }, { texto: "Depois 2" }],
}), (r) => r?.ids?.length === 2 && r.esperando === 2);
await espera("no banco: o segundo bloco está retido e a espera guarda os outros dois", async () => um("select x.retido, (select jsonb_array_length(blocos) from interno.rede_o12_fio_espera w where w.post = x.id) as n from interno.rede_posts x where x.id = $1", [segurado.ids[1]]),
  (r) => r.retido === true && r.n === 2);
await espera("a espera não aparece para ninguém (nenhuma função da tela lê a tabela)", async () => !/rede_o12_fio_espera/.test(
  (await dono("select string_agg(prosrc, ' ') as s from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'rede\\_pub\\_o12\\_%' and p.proname <> 'rede_pub_o12_fio'")).rows[0].s), (x) => x === true);
await espera("a mediação libera: os dois saem, em ordem, respondendo ao bloco liberado", async () => {
  await dono("update interno.rede_posts set retido = false, oculto = false, avaliacao = 'publicada' where id = $1", [segurado.ids[1]]);
  const filhos = (await dono("with recursive c as (select id, 0 as n from interno.rede_posts where id = $1 union all select x.id, c.n + 1 from interno.rede_posts x join c on x.resposta_a = c.id where x.autor = $2) select x.texto from c join interno.rede_posts x on x.id = c.id order by c.n", [segurado.ids[1], P.duda])).rows.map((x) => x.texto);
  const espera = (await um("select count(*)::int as n from interno.rede_o12_fio_espera where autor = $1", [P.duda])).n;
  return { filhos, espera };
}, (r) => JSON.stringify(r.filhos) === JSON.stringify(["Aqui tem um viado no texto", "Depois 1", "Depois 2"]) && r.espera === 0);
await espera("bloco segurado e apagado: os que esperavam somem", async () => {
  const r = await fio("duda", { blocos: [{ texto: "Outro fio" }, { texto: "bicha no meio" }, { texto: "Nunca sai" }] });
  await dono("update interno.rede_posts set apagado_em = now() where id = $1", [r.ids[1]]);
  return [(await um("select count(*)::int as n from interno.rede_o12_fio_espera where autor = $1", [P.duda])).n, (await um("select count(*)::int as n from interno.rede_posts where texto = 'Nunca sai'")).n];
}, (v) => v[0] === 0 && v[1] === 0);

// ═══════════════════ 6. Agendar no fuso escolhido ═══════════════════
await zerar();
const ag = (quem, p, local, fuso, opcoes = {}) => rpc(como(P[quem]), "rede_pub_o12_agendar", { p, p_local: local, p_fuso: fuso, p_opcoes: opcoes });
const daqui = async (dias, fuso) => (await um(`select to_char((now() + make_interval(days => $1)) at time zone $2, 'YYYY-MM-DD"T"HH24:MI') as l`, [dias, fuso])).l;
await recusa("fuso inventado: recusa", async () => ag("ana", { texto: "x" }, await daqui(2, "UTC"), "Lua/Base"), "invalido:fuso");
await recusa("sem fuso: recusa", async () => ag("ana", { texto: "x" }, await daqui(2, "UTC"), null), "invalido:fuso");
await recusa("dia e hora tortos: recusa", () => ag("ana", { texto: "x" }, "20/11/2026 10h", "America/Manaus"), "invalido:quando");
await recusa("nem hora nem ato: recusa", () => ag("ana", { texto: "x" }, null, null), "invalido:quando");
const localManaus = await daqui(2, "America/Manaus");
const agendado = await espera("agenda às tantas de Manaus: o banco converte no fuso escolhido", () => ag("ana", { texto: "Plenária em Manaus", figurinha: "estrela" }, localManaus, "America/Manaus"),
  (r) => r?.id && r.fuso === "America/Manaus");
await espera("o instante guardado é a hora de Manaus (UTC-4), não a do servidor", async () => um("select to_char(quando at time zone 'America/Manaus', 'YYYY-MM-DD\"T\"HH24:MI') as l from interno.rede_agendados where id = $1", [agendado.id]),
  (r) => r.l === localManaus);
await recusa("hora no passado daquele fuso: recusa (a regra de 5 minutos a 30 dias)", async () => ag("ana", { texto: "x" }, await daqui(-1, "Asia/Tokyo"), "Asia/Tokyo"), "invalido:quando");
await espera("a fila mostra o fuso de cada agendado", () => rpc(como(P.ana), "rede_pub_o12_agendados", {}), (l) => l.find((x) => x.id === agendado.id)?.fuso === "America/Manaus");
await espera("a fila de outra pessoa não traz o agendado da ana", () => rpc(como(P.bia), "rede_pub_o12_agendados", {}), (l) => !l.some((x) => x.id === agendado.id));
await espera("quando sai, a figurinha vai junto para o post", async () => {
  await dono("update interno.rede_agendados set quando = now() - interval '1 minute' where id = $1", [agendado.id]);
  await dono("select interno.rede3_pub_rodar($1)", [P.ana]);
  const a = await um("select estado, post::text from interno.rede_agendados where id = $1", [agendado.id]);
  const o = a.post ? await um("select figurinha from interno.rede_o12_post where post = $1", [a.post]) : null;
  return { estado: a.estado, fig: o?.figurinha };
}, (r) => r.estado === "publicado" && r.fig === "estrela");
await espera("toda semana: a próxima vez leva o fuso e a figurinha", async () => {
  const r = await ag("bia", { texto: "Assembleia toda terça", figurinha: "livro" }, await daqui(1, "America/Rio_Branco"), "America/Rio_Branco", { repetir: "semanal", vezes: 3 });
  await dono("update interno.rede_agendados set quando = now() - interval '1 minute' where id = $1", [r.id]);
  await dono("select interno.rede3_pub_rodar($1)", [P.bia]);
  return (await dono("select g.fuso, g.extras ->> 'figurinha' as f, a.estado from interno.rede_agendados a join interno.rede_o12_agendado g on g.agendado = a.id where a.autor = $1 order by a.vezes", [P.bia])).rows;
}, (rs) => rs.length === 2 && rs.every((x) => x.fuso === "America/Rio_Branco" && x.f === "livro") && rs[1].estado === "pendente");
await recusa("legenda com dado pessoal também barra o agendar", async () => ag("ana", { texto: "x", midia: imagens("ana", 2, () => "zap (21) 99876-5432") }, await daqui(2, "UTC"), "UTC"), "dado_pessoal");

// ═══════════════════ 7. Textos e telas ═══════════════════
const idiomas = ["pt", "en", "es", "fr", "ru", "zh"];
const textos = Object.fromEntries(idiomas.map((l) => [l, JSON.parse(ler(`i18n/rede/publicar/compositor/${l}.json`))]));
const chaves = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? chaves(v, `${p}${k}.`) : [`${p}${k}`])).sort();
ok("os seis idiomas têm as mesmas chaves, nenhuma vazia", idiomas.every((l) => JSON.stringify(chaves(textos[l])) === JSON.stringify(chaves(textos.pt))) && idiomas.every((l) => !JSON.stringify(textos[l]).includes('""')));
ok("os marcadores {x} batem nos seis idiomas", (() => {
  const plano = (o, p = "", s = {}) => {
    for (const [k, v] of Object.entries(o)) {
      if (v && typeof v === "object") plano(v, `${p}${k}.`, s);
      else s[`${p}${k}`] = v;
    }
    return s;
  };
  const marcas = (t) => (String(t).match(/\{\w+\}/g) ?? []).sort().join();
  const pt = plano(textos.pt);
  return idiomas.every((l) => {
    const x = plano(textos[l]);
    return Object.keys(pt).every((k) => marcas(pt[k]) === marcas(x[k]));
  });
})());
ok("toda figurinha tem nome nos seis idiomas", idiomas.every((l) => FIGURINHAS.every((f) => textos[l].figurinhas.nomes[f])));
ok("todo erro desta frente tem texto", ["invalido_fio", "invalido_arranjo", "invalido_figurinha", "invalido_legenda", "legenda_revisar", "invalido_fuso"].every((k) => textos.pt.erros[k]));
ok("texto de tela novo sem palavra proibida", !/diploma|universidade|algoritmo/i.test(JSON.stringify(textos)));

const telas = ["components/rede/figurinhas/PacoteDaCasa.tsx", "components/rede/publicar/compositor/FioDoEscrever.tsx", "components/rede/publicar/compositor/ImagensDoPost.tsx",
  "components/rede/publicar/compositor/FusoDoAgendar.tsx", "components/rede/publicar/compositor/CartaoDoLink.tsx", "components/rede/publicar/compositor/textos.ts"].map(ler);
ok("as telas novas não buscam nada de fora (sem fetch, sem endereço http fixo, sem fonte de fora)", !/\bfetch\(|https?:\/\/(?!www\.w3\.org)|fonts\.googleapis/.test(telas.join("\n")));
ok("as telas novas (fora o desenho das figurinhas) não usam cor literal", !/#[0-9a-fA-F]{3,6}\b|rgb\(/.test(telas.slice(1).join("\n")));
const escrever = ler("components/rede/publicar/alumia2/EscreverDaAlumia2.tsx");
ok("o Escrever publica o fio pela função nova e desfaz o fio inteiro", escrever.includes("redeCompositor.fio(") && escrever.includes("redeCompositor.desfazerFio("));
ok("o Escrever agenda com o fuso escolhido (sem new Date(pub.agendar))", escrever.includes("redeCompositor.agendar(") && !escrever.includes("new Date(pub.agendar)"));
const extrasTs = ler("components/rede/publicar/ExtrasDoEscrever.tsx");
ok("o agendar não usa mais a hora do aparelho para conferir (usa o fuso escolhido)", extrasTs.includes("agendaCabe(") && !/new Date\(valor\)\.getTime\(\)/.test(extrasTs));
const cartaoLink = ler("components/rede/publicar/compositor/CartaoDoLink.tsx");
ok("o cartão do link só usa a imagem do proxy do nosso servidor", cartaoLink.includes("/api/rede/previa/imagem"));

if (falhas.length) {
  console.error(`\n${falhas.length} falha(s), ${certos} certo(s):`);
  for (const f of falhas) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`compositor (onda 12, 12A): ${certos} conferências certas`);
