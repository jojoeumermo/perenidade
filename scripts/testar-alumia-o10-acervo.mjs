// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o acervo da onda 10 (supabase/migracoes/20261116-alumia-o10-acervo.sql) num Postgres de verdade (scripts/banco-local.mjs),
// com a migração rodada TRÊS vezes sobre o install.sql:
//   · coleções: só entra post de público aberto (ou "só a comunidade" da própria comunidade), na leitura cada post passa de novo
//     por quem vê, ordem escrita, a autora tira o post dela e ele não volta, sugestão sem quem sugeriu;
//   · documentos do núcleo: só quem é do núcleo lê e edita, conflito de versão, histórico, quem editou só para a mediação;
//   · arquivos do núcleo: cota, reserva, desfazer com o código por 15 minutos, mediação apaga, regra do depósito;
//   · arquivo por mês (número só a partir de 3) e exportar (só a moderação, só o público, só o codinome);
//   · wiki: quem pode editar e desfazer a última edição;
//   · as contas da tela (components/rede/comunidades/acervo/regras.ts): limpar o PDF, comparar versões, exportar em HTML escapado;
//   · os textos nas seis línguas.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-alumia-o10-acervo.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import {
  diferencaDeLinhas, exportacaoEmHtml, identificarArquivo, limparPdf, mesesPorAno, mover, nomeDoMes, postDoEndereco, tamanhoEscrito,
} from "../components/rede/comunidades/acervo/regras.ts";

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
const sql = ler("supabase/migracoes/20261116-alumia-o10-acervo.sql");
ok("toda função nova é security definer com search_path fixo", (() => {
  const funcoes = sql.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
  return funcoes.length >= 39 && funcoes.every((f) => /security definer set search_path = interno, pg_temp/.test(f));
})());
const tabelas = [...sql.matchAll(/create table if not exists interno\.([a-z_]+)/g)].map((m) => m[1]);
ok("as tabelas novas nascem com RLS e sem permissão direta", tabelas.length === 8
  && tabelas.every((t) => sql.includes(`alter table interno.${t} enable row level security`)) && !/grant [a-z, ]+ on (table )?interno\./i.test(sql));
ok("nenhuma tabela guarda endereço de rede", !(sql.match(/create table if not exists interno\.[a-z_]+ \([\s\S]*?\n\);/g) ?? []).some((t) => /\b(inet|cidr|endereco|ip|porta)\b/.test(t)));
ok("itens, sugestões e arquivos não têm coluna de pessoa (não guardam quem pôs, quem sugeriu, quem enviou)", ["rede_acervo_colecao_itens", "rede_acervo_sugestoes", "rede_acervo_arquivos", "rede_acervo_colecao_fora"].every((t) => {
  const corpo = sql.match(new RegExp(`create table if not exists interno\\.${t} \\([\\s\\S]*?\\n\\);`))?.[0] ?? "x usuario uuid";
  return !/\b(usuario|quem|autor|pessoa|conta|enviou|sugeriu)\s+uuid/.test(corpo);
}));
ok("não mexe na versão da Alumia, no install.sql e termina passando a porta em tudo", !/function public\.rede_alumia_versao/.test(sql) && /interno\.alumia_trancar\(\)/.test(sql.slice(-500)));
ok("nenhum registro de leitura (nada de 'leu', 'visto', 'abriu')", !/\b(leituras|vistos|abriu_em|leu_em)\b/.test(sql));

// ═══════════════════ 0b. As contas da tela ═══════════════════
const bytes = (t) => Uint8Array.from(Buffer.from(t, "latin1"));
const texto = (b) => Buffer.from(b).toString("latin1");
{
  const pdf = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R /Metadata 4 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n"
    + "3 0 obj\n<< /Author (Maria \\(da Silva\\)) /Creator (Editor 9.1) /Producer <4D61726961> /CreationDate (D:20261101120000-03'00') /Title (Plano do ato) >>\nendobj\n"
    + "4 0 obj\n<< /Type /Metadata /Subtype /XML /Length 120 >>\nstream\n<?xpacket begin=\"\" id=\"W5M0MpCehiHzreSzNTczkc9d\"?><x:xmpmeta xmlns:x=\"adobe:ns:meta/\"><dc:creator>Maria</dc:creator></x:xmpmeta><?xpacket end=\"w\"?>\nendstream\nendobj\n"
    + "xref\n0 5\ntrailer\n<< /Size 5 /Root 1 0 R /Info 3 0 R >>\nstartxref\n0\n%%EOF\n";
  const r = limparPdf(bytes(pdf));
  ok("o PDF é reconhecido pelos bytes", identificarArquivo(bytes(pdf))?.ext === "pdf" && identificarArquivo(bytes("GIF89a......"))  === null);
  ok("PDF limpo: mesmo tamanho (o índice continua certo), sem autor, programa, datas, título nem XMP", r.ok && r.bytes.length === pdf.length
    && !/Maria|Editor|4D61726961|2026|Plano do ato|xmpmeta|dc:creator/.test(texto(r.bytes)) && texto(r.bytes).includes("/Author (") && texto(r.bytes).includes("/Info 3 0 R"));
  ok("o conteúdo do PDF fica igual fora dos metadados", r.ok && texto(r.bytes).includes("<< /Type /Pages /Kids [] /Count 0 >>") && texto(r.bytes).endsWith("%%EOF\n"));
  const comprimido = "%PDF-1.5\n5 0 obj\n<< /Type /ObjStm /N 1 /First 4 /Filter /FlateDecode /Length 3 >>\nstream\nxyz\nendstream\nendobj\ntrailer\n<< /Info 7 0 R >>\n%%EOF";
  ok("informação guardada dentro de fluxo comprimido: recusa (não passa como limpo)", (() => { const x = limparPdf(bytes(comprimido)); return !x.ok && x.motivo === "comprimido"; })());
  const xmpComprimido = "%PDF-1.6\n4 0 obj\n<< /Type /Metadata /Subtype /XML /Filter /FlateDecode /Length 3 >>\nstream\nxyz\nendstream\nendobj\n%%EOF";
  ok("XMP comprimido: recusa", (() => { const x = limparPdf(bytes(xmpComprimido)); return !x.ok && x.motivo === "comprimido"; })());
  ok("PDF com programa ou anexo: recusa", ["/JavaScript", "/JS (app.alert(1))", "/EmbeddedFiles", "/Launch"].every((p) => {
    const x = limparPdf(bytes(`%PDF-1.4\n1 0 obj\n<< ${p} >>\nendobj\n%%EOF`));
    return !x.ok && x.motivo === "anexo_ou_programa";
  }));
  ok("o que não é PDF não passa pela limpeza de PDF", (() => { const x = limparPdf(bytes("\x89PNG\r\n\x1a\n000000000")); return !x.ok && x.motivo === "nao_e_pdf"; })());
  ok("imagem reconhecida pelos bytes", identificarArquivo(Uint8Array.of(0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0))?.ext === "jpg");
}
ok("comparar versões linha a linha", JSON.stringify(diferencaDeLinhas("a\nb\nc", "a\nc\nd")) === JSON.stringify([
  { tipo: "igual", texto: "a" }, { tipo: "saiu", texto: "b" }, { tipo: "igual", texto: "c" }, { tipo: "entrou", texto: "d" }]));
ok("texto enorme não trava a comparação", diferencaDeLinhas("x\n".repeat(1000), "y\n".repeat(1000)).length === 2002);
ok("os meses por ano, do mais novo", JSON.stringify(mesesPorAno([{ mes: "2025-12" }, { mes: "2026-02" }, { mes: "2026-11" }]).map((a) => [a.ano, a.meses.map((m) => m.mes)]))
  === JSON.stringify([["2026", ["2026-11", "2026-02"]], ["2025", ["2025-12"]]]));
ok("o nome do mês no idioma da tela", /novembro/.test(nomeDoMes("2026-11", "pt")) && /2026/.test(nomeDoMes("2026-11", "pt")) && nomeDoMes("x", "pt") === "x");
ok("tamanho escrito", tamanhoEscrito(512, "pt") === "512 B" && tamanhoEscrito(1536, "pt") === "1,5 KB" && /^200 MB$/.test(tamanhoEscrito(209715200, "pt")));
ok("o post achado no endereço colado", postDoEndereco("https://alumia.exemplo/pt/alumia/p/0A1B2C3D-0000-4000-8000-000000000001?x") === "0a1b2c3d-0000-4000-8000-000000000001" && postDoEndereco("nada") === null);
ok("mover na ordem escrita", JSON.stringify(mover(["a", "b", "c"], 2, 0)) === '["c","a","b"]' && JSON.stringify(mover(["a"], 0, 3)) === '["a"]');
{
  const html = exportacaoEmHtml({
    comunidade: { slug: "x", nome: "Moradia <script>", descricao: "d", categoria: "lutas", tipo: "aberta", criada_em: "2026-01-01T00:00:00Z" },
    regras: [{ numero: 1, titulo: "Respeito", texto: "" }], wiki: [], colecoes: [{ titulo: "Melhores", descricao: "", posts: ["p1"] }], exportado_em: "2026-11-13T00:00:00Z", regra: "",
    posts: [{ id: "p1", criado_em: "2026-11-01T00:00:00Z", tipo: "post", titulo: null, texto: "<img src=x onerror=alert(1)>", corpo: null, resposta_a: null, autor: "Codinome \"A\"" }],
  }, { titulo: "Exportação", exportadoEm: "Exportado em", regra: "só o público", regras: "Regras", wiki: "Wiki", colecoes: "Coleções", posts: "Posts", semPosts: "Nenhum", respostaA: "responde a" }, "pt");
  ok("a exportação em HTML escapa tudo e não chama nada de fora", !/<script|<img/.test(html) && html.includes("&lt;img src=x onerror=alert(1)&gt;")
    && html.includes("Codinome &quot;A&quot;") && !/https?:\/\//.test(html) && html.includes("default-src 'none'"));
}

// Os textos: as seis línguas com as mesmas chaves, listas e marcadores; nenhuma palavra proibida.
{
  const formas = (v, p = "", out = new Map()) => {
    if (Array.isArray(v)) { out.set(p, `lista:${v.length}`); v.forEach((x, i) => formas(x, `${p}[${i}]`, out)); }
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) formas(x, p ? `${p}.${k}` : k, out);
    else out.set(p, typeof v === "string" ? `texto:${(v.match(/\{\w+\}/g) ?? []).sort().join()}${v.trim() ? "" : ":vazio"}` : typeof v);
    return out;
  };
  const pt = JSON.parse(ler("i18n/rede/acervo/pt.json"));
  const base = formas(pt);
  for (const l of ["en", "es", "fr", "ru", "zh"]) {
    const outro = formas(JSON.parse(ler(`i18n/rede/acervo/${l}.json`)));
    const dif = [...base].filter(([k, v]) => outro.get(k) !== v).map(([k]) => k).concat([...outro.keys()].filter((k) => !base.has(k)));
    ok(`acervo/${l}.json tem as mesmas chaves, listas e marcadores do pt${dif.length ? ` (difere em ${dif.slice(0, 4).join(", ")})` : ""}`, dif.length === 0);
  }
  ok("nenhum texto vazio no pt", ![...base.values()].some((v) => v.endsWith(":vazio")));
  ok("os textos não usam \"diploma\", \"universidade\" nem \"algoritmo\"", ["pt", "en", "es", "fr", "ru", "zh"].every((l) => !/diploma|universidade|university|universidad|universit|algoritm|algorithm/i.test(ler(`i18n/rede/acervo/${l}.json`))));
  ok("todo erro novo do banco tem texto", ["publico_nao_permite", "autora_tirou", "cota_cheia", "conflito", "dado_pessoal", "sem_permissao", "nao_encontrado"].every((c) => typeof pt.erros[c] === "string"));
}

// ═══════════════════ 1. Banco e pessoas ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, aal: "aal2", ip: `198.51.100.${ip++ % 250}` });
const visitante = { papel: "anon", ip: "203.0.113.10" };
const zerar = () => dono("delete from interno.limites");

// Este teste prova o código da onda 10 como ela o escreveu (rodando a migração dela de novo por cima do banco montado). Desde a R2
// (membros escondidos) o banco não guarda quem é de qual núcleo nem aceita post de núcleo, e o acervo do núcleo fechou no servidor
// (o que vale hoje está em scripts/testar-r2-membros-banco.mjs); o que a onda 10 pressupõe volta só neste banco de teste.
await espera("o legado dos núcleos que a onda 10 pressupõe (só neste banco de teste)", () => banco.legadoDosNucleos());
await espera("a migração instala sobre o install.sql", () => exec(sql));
await espera("de novo (idempotente)", () => exec(sql));
await espera("e uma terceira vez sem estrago", () => exec(sql));
await espera("a regra da porta não deixa nenhuma função aberta", async () => (await dono("select interno.alumia_trancar() as r")).rows[0].r, (r) => r.abertas.length === 0);
await espera("toda função pública nova passa pela porta (ou pela entrada, a do depósito); a dos órfãos é só da chave de serviço", async () =>
  (await dono(`select p.proname, p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'rede\\_acervo\\_%' and p.proname <> 'rede_acervo_orfaos'`)).rows,
(rs) => rs.length === 27 && rs.every((r) => /interno\.alumia_(porta|passa)\(\)/.test(r.prosrc)));
for (const t of tabelas) {
  await espera(`${t}: RLS ligada e nenhuma política`, async () => (await dono("select c.relrowsecurity as r, (select count(*)::int from pg_policies p where p.schemaname = 'interno' and p.tablename = $2) as n from pg_class c where c.oid = $1::regclass", [`interno.${t}`, t])).rows[0],
    (r) => r.r === true && r.n === 0);
}
await espera("as funções internas não abrem para anon nem para quem tem conta", async () =>
  (await dono(`select p.proname, has_function_privilege('anon', p.oid, 'execute') as a, has_function_privilege('authenticated', p.oid, 'execute') as b
               from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'interno' and p.proname like 'rede\\_acervo\\_%'`)).rows,
(rs) => rs.length === 11 && rs.every((r) => !r.a && !r.b));
await espera("escrever não abre para visitante", async () =>
  (await dono(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'rede\\_acervo\\_%' and has_function_privilege('anon', p.oid, 'execute')`)).rows.map((r) => r.proname).sort(),
(r) => JSON.stringify(r) === JSON.stringify(["rede_acervo_colecao", "rede_acervo_colecoes", "rede_acervo_mes", "rede_acervo_meses", "rede_acervo_wiki_regras"]));

const P = {};
const NOMES = ["mod", "membro", "membro2", "autora", "fora", "media", "nucleado", "estranho"];
for (const nome of NOMES) {
  P[nome] = await criarUsuario(`${nome}@o10.local`, `Pessoa ${nome}`);
  await rpc(como(P[nome]), "eu");
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of NOMES) {
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome], `Codinome ${nome}`, `o10_${nome}`]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}
await dono("update auth.users set created_at = now() - interval '90 days'");
await dono(`insert into interno.rede_comunidades (slug, nome, categoria, tipo, publico_padrao) values
  ('o10-moradia', 'Moradia do teste', 'lutas', 'aberta', 'membros'),
  ('o10-fechada', 'Fechada do teste', 'lutas', 'fechada', 'membros') on conflict do nothing`);
await dono(`insert into interno.rede_comunidade_membros (comunidade, usuario, papel) values
  ('o10-moradia', $1, 'moderacao'), ('o10-moradia', $2, 'membro'), ('o10-moradia', $3, 'membro'), ('o10-moradia', $4, 'membro'),
  ('o10-fechada', $1, 'moderacao'), ('o10-fechada', $4, 'membro')`, [P.mod, P.membro, P.membro2, P.autora]);
const nucleo = (await dono("insert into interno.rede_nucleos (nome, cidade) values ('Núcleo do teste', 'Recife') returning id")).rows[0].id;
const outroNucleo = (await dono("insert into interno.rede_nucleos (nome, cidade) values ('Outro núcleo', 'Natal') returning id")).rows[0].id;
await dono("insert into interno.rede_nucleo_membros (nucleo, usuario, papel) values ($1, $2, 'mediacao'), ($1, $3, 'membro'), ($4, $5, 'membro')", [nucleo, P.media, P.nucleado, outroNucleo, P.estranho]);

// Posts entram direto na tabela com a sessão da pessoa (os gatilhos rodam com o auth.uid() dela), com o público escolhido.
const inserir = (quem, texto, extra = {}) => banco.exclusivo(() => banco.pg.transaction(async (tx) => {
  await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "authenticated", sub: P[quem], aal: "aal2" })]);
  return (await tx.query("insert into interno.rede_posts (autor, texto, comunidade, publico, nucleo, resposta_a, criado_em) values ($1, $2, $3, $4, $5, $6, coalesce($7, now())) returning id",
    [P[quem], texto, extra.comunidade ?? null, extra.publico ?? null, extra.nucleo ?? null, extra.resposta_a ?? null, extra.criado_em ?? null])).rows[0].id;
}));
const M = como(P.mod);
const postAberto = await inserir("autora", "Como escrever a introdução da redação", { comunidade: "o10-moradia", publico: "membros" });
const postAberto2 = await inserir("membro", "Proposta de intervenção com os cinco elementos", { comunidade: "o10-moradia", publico: "membros" });
const postAberto3 = await inserir("membro2", "Repertório sociocultural sem decoreba", { publico: "membros" });
const postComunidade = await inserir("membro", "Só para quem é da moradia", { comunidade: "o10-moradia", publico: "comunidade" });
const postSeguidores = await inserir("membro", "Só para quem me segue", { publico: "seguidores" });
const postNucleo = await inserir("nucleado", "Plano do núcleo", { nucleo, publico: "nucleo" });
const postFechada = await inserir("autora", "Dentro da fechada", { comunidade: "o10-fechada", publico: "membros" });

// ═══════════════════ 2. Coleções ═══════════════════
await zerar();
await recusa("quem não modera não cria coleção da comunidade", () => rpc(como(P.membro), "rede_acervo_colecao_salvar", { p_id: null, p_slug: "o10-moradia", p_titulo: "Minha", p_descricao: "" }), "sem_permissao");
const col = await espera("a moderação cria a coleção da comunidade", () => rpc(M, "rede_acervo_colecao_salvar", { p_id: null, p_slug: "o10-moradia", p_titulo: "Melhores explicações de redação", p_descricao: "Escolhidas pela moderação." }),
  (r) => r.id && r.titulo === "Melhores explicações de redação");
const C = col?.id;
await espera("post aberto entra, no fim da ordem", async () => {
  await rpc(M, "rede_acervo_colecao_por", { p_id: C, p_post: postAberto, p_sim: true, p_nota: "Começa por aqui." });
  await rpc(M, "rede_acervo_colecao_por", { p_id: C, p_post: postAberto2, p_sim: true });
  return rpc(M, "rede_acervo_colecao_por", { p_id: C, p_post: postAberto3, p_sim: true });
}, (r) => r.na_colecao === true);
await espera("o post 'só a comunidade' da própria comunidade também entra", () => rpc(M, "rede_acervo_colecao_por", { p_id: C, p_post: postComunidade, p_sim: true }), (r) => r.na_colecao);
await recusa("post só para seguidores não entra", () => rpc(M, "rede_acervo_colecao_por", { p_id: C, p_post: postSeguidores, p_sim: true }), "nao_encontrado");
await recusa("post de núcleo não entra (nem quem é do núcleo consegue pôr numa coleção aberta)", async () => {
  const minha = await rpc(como(P.nucleado), "rede_acervo_colecao_salvar", { p_id: null, p_slug: null, p_titulo: "Do núcleo?", p_descricao: "" });
  return rpc(como(P.nucleado), "rede_acervo_colecao_por", { p_id: minha.id, p_post: postNucleo, p_sim: true });
}, "publico_nao_permite");
await recusa("post de comunidade fechada não entra na coleção de outra comunidade", () => rpc(M, "rede_acervo_colecao_por", { p_id: C, p_post: postFechada, p_sim: true }), "publico_nao_permite");
await espera("a coleção na ordem escrita, com a nota e sem quem pôs", () => rpc(como(P.membro), "rede_acervo_colecao", { p_id: C }),
  (r) => r.itens.map((i) => i.post.id).join() === [postAberto, postAberto2, postAberto3, postComunidade].join() && r.itens[0].nota === "Começa por aqui."
    && r.pode_editar === false && r.sugestoes == null && r.dono.tipo === "comunidade" && !JSON.stringify(r).includes(P.mod));
await espera("quem não é da comunidade não vê o post 'só a comunidade' pela coleção", () => rpc(como(P.fora), "rede_acervo_colecao", { p_id: C }),
  (r) => r.itens.length === 3 && !r.itens.some((i) => i.post.id === postComunidade));
await espera("a lista das coleções conta posts, não pessoas", () => rpc(como(P.fora), "rede_acervo_colecoes", { p_slug: "o10-moradia" }),
  (r) => r.itens.length === 1 && r.itens[0].posts === 3 && r.pode_criar === false && r.itens[0].sugestoes === null);
await espera("a moderação reordena", () => rpc(M, "rede_acervo_colecao_ordem", { p_id: C, p_posts: [postAberto3, postAberto, postComunidade, postAberto2] }), (r) => r.ordem.length === 4);
await recusa("ordem com post a menos é recusada", () => rpc(M, "rede_acervo_colecao_ordem", { p_id: C, p_posts: [postAberto3, postAberto] }), "invalido:ordem");
await espera("a ordem nova vale na leitura", () => rpc(M, "rede_acervo_colecao", { p_id: C }), (r) => r.itens[0].post.id === postAberto3 && r.itens[3].post.id === postAberto2);
await recusa("quem não é autora não tira o post dos outros", () => rpc(como(P.membro), "rede_acervo_colecao_tirar_meu", { p_id: C, p_post: postAberto }), "nao_encontrado");
await espera("a autora tira o post dela", () => rpc(como(P.autora), "rede_acervo_colecao_tirar_meu", { p_id: C, p_post: postAberto }), (r) => r.na_colecao === false);
await recusa("e ele não volta", () => rpc(M, "rede_acervo_colecao_por", { p_id: C, p_post: postAberto, p_sim: true }), "autora_tirou");
await espera("membro sugere um post", () => rpc(como(P.membro2), "rede_acervo_sugerir", { p_id: C, p_post: postAberto2 }), (r) => r.sugerido);
const postNovo = await inserir("membro2", "Como revisar a redação em dez minutos", { comunidade: "o10-moradia", publico: "membros" });
await espera("sugestão de post novo fica para a moderação, sem quem sugeriu", async () => {
  await rpc(como(P.membro), "rede_acervo_sugerir", { p_id: C, p_post: postNovo });
  return dono("select * from interno.rede_acervo_sugestoes where colecao = $1", [C]);
}, (r) => r.rows.length === 1 && Object.keys(r.rows[0]).sort().join() === "colecao,criado_em,post");
await espera("quem cuida vê a sugestão e o número dela", async () => ({ c: await rpc(M, "rede_acervo_colecao", { p_id: C }), l: await rpc(M, "rede_acervo_colecoes", { p_slug: "o10-moradia" }) }),
  ({ c, l }) => c.sugestoes.length === 1 && c.sugestoes[0].id === postNovo && l.itens[0].sugestoes === 1);
await espera("aceitar é pôr na coleção (a sugestão some)", async () => {
  await rpc(M, "rede_acervo_colecao_por", { p_id: C, p_post: postNovo, p_sim: true });
  return dono("select count(*)::int as n from interno.rede_acervo_sugestoes where colecao = $1", [C]);
}, (r) => r.rows[0].n === 0);
await espera("coleção de pessoa: a dona cria e põe post aberto dela ou de outra pessoa", async () => {
  const k = await rpc(como(P.membro), "rede_acervo_colecao_salvar", { p_id: null, p_slug: null, p_titulo: "Para estudar", p_descricao: "" });
  await rpc(como(P.membro), "rede_acervo_colecao_por", { p_id: k.id, p_post: postAberto3, p_sim: true });
  return rpc(visitante, "rede_acervo_colecoes", { p_handle: "@o10_membro" });
}, (r) => r.itens.length === 1 && r.itens[0].titulo === "Para estudar" && r.pode_criar === false);
await recusa("perfil invisível: as coleções dele não aparecem", async () => {
  await dono("update interno.perfis set rede_invisivel = true where id = $1", [P.membro]);
  try { return await rpc(como(P.fora), "rede_acervo_colecoes", { p_handle: "o10_membro" }); } finally { await dono("update interno.perfis set rede_invisivel = false where id = $1", [P.membro]); }
}, "nao_encontrado");
await espera("a dona apaga a coleção (os posts continuam)", async () => {
  const k = (await rpc(como(P.membro), "rede_acervo_colecoes", { p_handle: "o10_membro" })).itens[0];
  await rpc(como(P.membro), "rede_acervo_colecao_apagar", { p_id: k.id });
  return dono("select count(*)::int as n from interno.rede_posts where id = $1", [postAberto3]);
}, (r) => r.rows[0].n === 1);

// ═══════════════════ 3. Documentos do núcleo ═══════════════════
await zerar();
const N = como(P.nucleado);
await recusa("quem não é do núcleo não lê", () => rpc(como(P.estranho), "rede_acervo_docs", { p_nucleo: nucleo }), "nao_encontrado");
const doc = await espera("quem é do núcleo cria um documento", () => rpc(N, "rede_acervo_doc_salvar", { p_nucleo: nucleo, p_id: null, p_titulo: "Pauta da assembleia", p_corpo: "1. Informes\n2. Ato do dia 20", p_resumo: "primeira versão", p_base: null }),
  (r) => r.id && r.versao === 1);
await espera("outra pessoa do núcleo edita em cima da versão 1", () => rpc(como(P.media), "rede_acervo_doc_salvar", { p_nucleo: nucleo, p_id: doc.id, p_titulo: "Pauta da assembleia", p_corpo: "1. Informes\n2. Ato do dia 20\n3. Finanças", p_resumo: "", p_base: 1 }),
  (r) => r.versao === 2);
await recusa("salvar em cima da versão velha dá conflito (nada se perde)", () => rpc(N, "rede_acervo_doc_salvar", { p_nucleo: nucleo, p_id: doc.id, p_titulo: "Pauta", p_corpo: "outra coisa", p_resumo: "", p_base: 1 }), "conflito");
await recusa("CPF não entra", () => rpc(N, "rede_acervo_doc_salvar", { p_nucleo: nucleo, p_id: null, p_titulo: "Lista", p_corpo: "123.456.789-00", p_resumo: "", p_base: null }), "dado_pessoal");
await espera("o histórico para quem é do núcleo: sem quem editou", () => rpc(N, "rede_acervo_doc_historico", { p_id: doc.id }),
  (r) => r.media === false && r.versoes.length === 2 && r.versoes.every((v) => v.editou === null));
await espera("para a mediação: com o codinome de quem editou", () => rpc(como(P.media), "rede_acervo_doc_historico", { p_id: doc.id }),
  (r) => r.media === true && r.versoes[0].editou === "Codinome media" && r.versoes[1].editou === "Codinome nucleado");
await espera("ler uma versão antiga", () => rpc(N, "rede_acervo_doc", { p_id: doc.id, p_versao: 1 }), (r) => r.versao === 1 && r.atual === 2 && !r.corpo.includes("Finanças") && r.editou === null);
await espera("quem é do núcleo volta para a versão 1 (vira a versão 3)", () => rpc(N, "rede_acervo_doc_restaurar", { p_id: doc.id, p_versao: 1 }), (r) => r.versao === 3);
await espera("a lista dos documentos", () => rpc(N, "rede_acervo_docs", { p_nucleo: nucleo }), (r) => r.itens.length === 1 && r.itens[0].versao === 3 && r.media === false);
await recusa("só a mediação apaga", () => rpc(N, "rede_acervo_doc_apagar", { p_id: doc.id }), "sem_permissao");
await recusa("quem é de outro núcleo nem sabe que existe", () => rpc(como(P.estranho), "rede_acervo_doc", { p_id: doc.id }), "nao_encontrado");

// ═══════════════════ 4. Arquivos do núcleo ═══════════════════
await zerar();
await recusa("tipo que não é PDF nem imagem", () => rpc(N, "rede_acervo_arquivo_reservar", { p_nucleo: nucleo, p_nome: "x.exe", p_ext: "exe", p_tamanho: 10 }), "invalido:tipo");
await recusa("arquivo maior que 10 MB", () => rpc(N, "rede_acervo_arquivo_reservar", { p_nucleo: nucleo, p_nome: "grande.pdf", p_ext: "pdf", p_tamanho: 10485761 }), "invalido:tamanho");
const res = await espera("reserva: caminho na pasta do núcleo (nunca da pessoa) e código de desfazer", () => rpc(N, "rede_acervo_arquivo_reservar", { p_nucleo: nucleo, p_nome: "cartilha/../de direitos.pdf", p_ext: "pdf", p_tamanho: 2048 }),
  (r) => r.caminho === `${nucleo}/${r.id}.pdf` && !r.caminho.includes(P.nucleado) && /^[0-9a-f]{32}$/.test(r.desfazer));
await espera("o banco guarda só o hash do código, e o nome sem barra", () => dono("select * from interno.rede_acervo_arquivos where id = $1", [res.id]),
  (r) => r.rows[0].desfazer_hash.length === 64 && r.rows[0].desfazer_hash !== res.desfazer && !r.rows[0].nome.includes("/"));
await espera("a regra do depósito: ninguém com conta envia, nem no caminho reservado (só o servidor grava, depois de limpar)", async () => {
  const pode = async (quem, nome, acao) => (await banco.exclusivo(async () => {
    await banco.pg.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ role: "authenticated", sub: P[quem], aal: "aal2" })]);
    try { return (await banco.pg.query("select public.rede_acervo_deposito_pode($1, $2) as r", [nome, acao])).rows[0].r; } finally { await banco.pg.query("select set_config('request.jwt.claims', '', false)"); }
  }));
  return [await pode("nucleado", res.caminho, "enviar"), await pode("estranho", res.caminho, "enviar"), await pode("nucleado", res.caminho, "ler"), await pode("nucleado", `${nucleo}/outro.pdf`, "enviar"), await pode("nucleado", res.caminho, "apagar")];
}, (r) => JSON.stringify(r) === "[false,false,false,false,false]");
await espera("confirmar deixa o arquivo pronto (sem depósito no teste, vale o tamanho dado)", () => rpc(N, "rede_acervo_arquivo_confirmar", { p_id: res.id, p_tamanho: 2048 }), (r) => r.tamanho === 2048);
await espera("a lista: nome, tipo, tamanho, uso e cota; sem quem enviou", () => rpc(N, "rede_acervo_arquivos", { p_nucleo: nucleo }),
  (r) => r.itens.length === 1 && r.itens[0].ext === "pdf" && Number(r.usado) === 2048 && Number(r.cota) === 209715200 && r.media === false && !JSON.stringify(r).includes(P.nucleado));
await recusa("quem não é da mediação e não tem o código não apaga", () => rpc(como(P.nucleado), "rede_acervo_arquivo_apagar", { p_id: res.id, p_desfazer: "0".repeat(32) }), "sem_permissao");
await espera("com o código, nos 15 minutos, quem enviou desfaz", () => rpc(N, "rede_acervo_arquivo_apagar", { p_id: res.id, p_desfazer: res.desfazer }), (r) => r.caminho === res.caminho);
await espera("e a linha some quando o depósito apaga", async () => { await rpc(N, "rede_acervo_arquivo_sumiu", { p_id: res.id }); return dono("select count(*)::int as n from interno.rede_acervo_arquivos where id = $1", [res.id]); }, (r) => r.rows[0].n === 0);
const res2 = await rpc(N, "rede_acervo_arquivo_reservar", { p_nucleo: nucleo, p_nome: "cartaz.png", p_ext: "png", p_tamanho: 4096 });
await rpc(N, "rede_acervo_arquivo_confirmar", { p_id: res2.id, p_tamanho: 4096 });
await recusa("passados os 15 minutos, o código não vale mais", async () => {
  await dono("update interno.rede_acervo_arquivos set desfazer_ate = now() - interval '1 second' where id = $1", [res2.id]);
  return rpc(N, "rede_acervo_arquivo_apagar", { p_id: res2.id, p_desfazer: res2.desfazer });
}, "sem_permissao");
await espera("a mediação apaga a qualquer hora", () => rpc(como(P.media), "rede_acervo_arquivo_apagar", { p_id: res2.id }), (r) => r.id === res2.id);
await recusa("a cota do núcleo vale", async () => {
  await dono("insert into interno.configuracoes (chave, valor) values ('acervo_nucleo_cota', '{\"bytes\": 10485760}') on conflict (chave) do update set valor = excluded.valor");
  await rpc(N, "rede_acervo_arquivo_reservar", { p_nucleo: nucleo, p_nome: "a.pdf", p_ext: "pdf", p_tamanho: 6000000 });
  return rpc(N, "rede_acervo_arquivo_reservar", { p_nucleo: nucleo, p_nome: "b.pdf", p_ext: "pdf", p_tamanho: 6000000 });
}, "cota_cheia");
await dono("update interno.configuracoes set valor = '{\"bytes\": 209715200}' where chave = 'acervo_nucleo_cota'");
await espera("a faxina tira o envio que nunca chegou", async () => {
  await dono("update interno.rede_acervo_arquivos set criado_em = now() - interval '2 days' where situacao = 'reservado'");
  return dono("select interno.rede_acervo_faxina() as n");
}, (r) => r.rows[0].n === 1);
await espera("a faxina tira também a linha apagada de mais de um dia (sem depósito no teste, não há arquivo para esperar)", async () => {
  await dono("update interno.rede_acervo_arquivos set mudou_em = now() - interval '2 days' where id = $1", [res2.id]);
  await dono("select interno.rede_acervo_faxina()");
  return dono("select count(*)::int as n from interno.rede_acervo_arquivos where id = $1", [res2.id]);
}, (r) => r.rows[0].n === 0);
await recusa("a lista dos arquivos órfãos é só da chave de serviço", () => rpc(N, "rede_acervo_orfaos", { p_limite: 10 }), "");

// ═══════════════════ 5. Arquivo por mês e exportar ═══════════════════
await zerar();
for (let i = 0; i < 3; i++) await inserir("membro", `post de março ${i}`, { comunidade: "o10-moradia", publico: "membros", criado_em: `2026-03-1${i}T15:00:00Z` });
await inserir("membro", "único de abril", { comunidade: "o10-moradia", publico: "membros", criado_em: "2026-04-10T15:00:00Z" });
await espera("os meses: número só a partir de 3", () => rpc(como(P.fora), "rede_acervo_meses", { p_slug: "o10-moradia" }),
  (r) => r.meses.find((m) => m.mes === "2026-03")?.posts === 3 && r.meses.find((m) => m.mes === "2026-04")?.posts === null);
await espera("os posts de um mês, do primeiro ao último", () => rpc(como(P.fora), "rede_acervo_mes", { p_slug: "o10-moradia", p_mes: "2026-03" }),
  (r) => r.itens.length === 3 && r.itens[0].texto === "post de março 0" && r.proximo === null);
await recusa("mês que não é mês", () => rpc(como(P.fora), "rede_acervo_mes", { p_slug: "o10-moradia", p_mes: "2026-13" }), "invalido:mes");
await recusa("comunidade fechada: quem é de fora não vê o arquivo", () => rpc(como(P.fora), "rede_acervo_meses", { p_slug: "o10-fechada" }), "nao_encontrado");
await recusa("só a moderação exporta", () => rpc(como(P.membro), "rede_acervo_exportar", { p_slug: "o10-moradia" }), "sem_permissao");
await espera("a exportação: regras, wiki, coleções e só os posts públicos, com o codinome e nada mais de pessoa", () => rpc(M, "rede_acervo_exportar", { p_slug: "o10-moradia" }),
  (r) => r.comunidade.slug === "o10-moradia" && Array.isArray(r.regras) && r.colecoes.length === 1 && r.posts.length >= 6
    && !r.posts.some((p) => p.id === postComunidade) && r.posts.every((p) => typeof p.autor === "string" && Object.keys(p).sort().join() === "autor,corpo,criado_em,id,resposta_a,texto,tipo,titulo")
    && !NOMES.some((n) => JSON.stringify(r).includes(P[n])) && !JSON.stringify(r).includes("@o10.local"));
await espera("comunidade fechada exporta sem posts", () => rpc(M, "rede_acervo_exportar", { p_slug: "o10-fechada" }), (r) => r.posts.length === 0 && r.comunidade.tipo === "fechada");
await espera("a exportação fica no registro da equipe", () => dono("select count(*)::int as n from interno.auditoria where acao = 'alumia_acervo_exportar'"), (r) => r.rows[0].n === 2);

// ═══════════════════ 6. Wiki: quem edita e desfazer ═══════════════════
await zerar();
// Nível de confiança: quem edita a wiki por padrão precisa de nível 1 (aqui, as duas pessoas entram como referência da rede).
await dono("insert into interno.rede_lideres (usuario) values ($1), ($2) on conflict do nothing", [P.membro, P.membro2]);
await rpc(como(P.membro), "rede_alumia_wiki_salvar", { p_slug: "o10-moradia", p_pagina: null, p_titulo: "Cartilha de direitos", p_corpo: "Peça a ordem judicial.", p_resumo: "", p_base: null });
await espera("a regra começa em 'membros'", () => rpc(como(P.membro), "rede_acervo_wiki_regras", { p_slug: "o10-moradia", p_pagina: "cartilha-de-direitos" }), (r) => r.quem === "membros" && r.modera === false && r.pode_desfazer === false);
await rpc(como(P.membro2), "rede_alumia_wiki_salvar", { p_slug: "o10-moradia", p_pagina: "cartilha-de-direitos", p_titulo: "Cartilha de direitos", p_corpo: "Texto apagado por engano.", p_resumo: "", p_base: 1 });
await espera("quem editou por último pode desfazer; outra pessoa não", async () => ({
  a: await rpc(como(P.membro2), "rede_acervo_wiki_regras", { p_slug: "o10-moradia", p_pagina: "cartilha-de-direitos" }),
  b: await rpc(como(P.membro), "rede_acervo_wiki_regras", { p_slug: "o10-moradia", p_pagina: "cartilha-de-direitos" }),
}), ({ a, b }) => a.pode_desfazer === true && b.pode_desfazer === false);
await recusa("outra pessoa não desfaz a edição alheia", () => rpc(como(P.membro), "rede_acervo_wiki_desfazer", { p_slug: "o10-moradia", p_pagina: "cartilha-de-direitos" }), "sem_permissao");
await espera("desfazer: o texto anterior volta como versão nova", async () => {
  await rpc(como(P.membro2), "rede_acervo_wiki_desfazer", { p_slug: "o10-moradia", p_pagina: "cartilha-de-direitos" });
  return rpc(como(P.membro), "rede_alumia_wiki", { p_slug: "o10-moradia", p_pagina: "cartilha-de-direitos" });
}, (r) => r.pagina.versao === 3 && r.pagina.corpo === "Peça a ordem judicial.");
await espera("depois de 30 minutos, só a moderação desfaz", async () => {
  await dono("update interno.rede_alumia_wiki_versoes set criado_em = now() - interval '31 minutes' where comunidade = 'o10-moradia'");
  return { a: await rpc(como(P.membro2), "rede_acervo_wiki_regras", { p_slug: "o10-moradia", p_pagina: "cartilha-de-direitos" }), m: await rpc(M, "rede_acervo_wiki_regras", { p_slug: "o10-moradia", p_pagina: "cartilha-de-direitos" }) };
}, ({ a, m }) => a.pode_desfazer === false && m.pode_desfazer === true && m.modera === true);
await recusa("quem não modera não muda a regra", () => rpc(como(P.membro), "rede_acervo_wiki_quem", { p_slug: "o10-moradia", p_quem: "moderacao" }), "sem_permissao");
await recusa("regra desconhecida", () => rpc(M, "rede_acervo_wiki_quem", { p_slug: "o10-moradia", p_quem: "todo-mundo" }), "invalido:quem");
await espera("só a moderação edita: membro perde a edição, a moderação continua", async () => {
  await rpc(M, "rede_acervo_wiki_quem", { p_slug: "o10-moradia", p_quem: "moderacao" });
  return { m: await rpc(como(P.membro), "rede_alumia_wiki", { p_slug: "o10-moradia" }), d: await rpc(M, "rede_alumia_wiki", { p_slug: "o10-moradia" }) };
}, ({ m, d }) => m.pode_editar === false && m.pode_criar === false && d.pode_editar === true);
await recusa("e o banco barra a edição do membro", () => rpc(como(P.membro), "rede_alumia_wiki_salvar", { p_slug: "o10-moradia", p_pagina: "cartilha-de-direitos", p_titulo: "Cartilha de direitos", p_corpo: "x", p_resumo: "", p_base: 3 }), "sem_permissao");
await espera("de volta a 'membros', o membro edita de novo", async () => {
  await rpc(M, "rede_acervo_wiki_quem", { p_slug: "o10-moradia", p_quem: "membros" });
  return rpc(como(P.membro), "rede_alumia_wiki", { p_slug: "o10-moradia" });
}, (r) => r.pode_editar === true);

// ═══════════════════ 7. Nada de endereço de rede ═══════════════════
await espera("nenhuma coluna nova guarda endereço", async () =>
  (await dono("select table_name, column_name, data_type from information_schema.columns where table_schema = 'interno' and table_name = any($1)", [tabelas])).rows,
(rs) => rs.length > 0 && !rs.some((c) => c.data_type === "inet" || /(^|_)(ip|endereco|porta)($|_)/.test(c.column_name)));

if (falhas.length) {
  console.error(`\n${falhas.length} falha(s), ${certos} certo(s):`);
  for (const f of falhas) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`acervo da comunidade e do núcleo (onda 10): ${certos} conferências certas.`);
process.exit(0);
