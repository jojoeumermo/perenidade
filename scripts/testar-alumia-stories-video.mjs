// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova os stories com vídeo e os destaques (supabase/migracoes/20261110-alumia-stories-video.sql) num Postgres de verdade dentro
// do Node, pelo MESMO cliente que a tela usa (lib/rede/cliente-stories.ts): vídeo até 60 s no depósito privado, sem som = sem
// áudio, estilo do texto só de lista fechada, menção de comunidade (o nome vem da comunidade), destaques no perfil com o MESMO
// público do story (bloqueio vale, retido some), nenhuma tabela de quem viu, a faxina que não leva o que está num destaque e que
// tira do ar vídeo com caixa de lugar (GPS), e a migração rodando duas vezes. Também as contas puras da mídia (lib/rede/stories/midia.ts).
// Uso: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --disable-warning=DEP0205 --import ./scripts/carregar-ts.mjs scripts/testar-alumia-stories-video.mjs
import fs from "node:fs";
import { criarBanco } from "./banco-local.mjs";
import { comEnderecos, capasAssinadas, criarClienteDeStories, extensaoDaImagem } from "../lib/rede/cliente-stories.ts";
import { conferirVideo, formatoDoCaminho, rodada } from "../supabase/functions/faxina-stories/faxina.mjs";
import { cortarTrecho, escolherFormatoDeVideo, FILTROS_DO_STORY, filtroEmCss, medidaDoVideo, taxaDoVideo, transformacaoValida } from "../lib/rede/stories/midia.ts";
import { criarClienteDaPrevia } from "../lib/rede/stories/exemplos.ts";

let certos = 0;
const falhas = [];
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
    falhas.push(`${nome}: deveria recusar com "${codigo}", mas passou (${JSON.stringify(valor)?.slice(0, 160)})`);
  } catch (erro) {
    if (String(erro.message).includes(codigo)) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${erro.message}"`);
  }
}
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
const ler = (rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

// ═══════════════════ 1. Contas puras (sem banco) ═══════════════════
{
  const txt = (s) => [...Buffer.from(s, "latin1")];
  const be = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const caixa = (tipo, dados) => [...be(8 + dados.length), ...txt(tipo), ...dados];
  const ftyp = caixa("ftyp", txt("isom\0\0\0\0isomavc1"));
  const limpo = Uint8Array.from([...ftyp, ...caixa("moov", [...caixa("mvhd", new Array(20).fill(0)), ...caixa("trak", caixa("tkhd", new Array(12).fill(0)))]), ...caixa("mdat", [1, 2, 3])]);
  const comGps = Uint8Array.from([...ftyp, ...caixa("moov", [...caixa("mvhd", new Array(20).fill(0)), ...caixa("udta", caixa("©xyz", txt("+23.55-046.63/")))]), ...caixa("mdat", [1])]);
  const quebrado = Uint8Array.from([...ftyp, ...be(9999), ...txt("moov"), 0, 0]);
  const webm = Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3, ...txt("\x42\x82\x84webm"), 0, 0, 0]);
  ok("MP4 limpo passa", conferirVideo(limpo) === "mp4");
  ok("MP4 com ©xyz (GPS da Apple) é recusado", conferirVideo(comGps) === null);
  ok("MP4 com caixa de tamanho impossível é recusado", conferirVideo(quebrado) === null);
  ok("WEBM do gravador passa", conferirVideo(webm) === "webm");
  ok("HTML fingindo vídeo é recusado", conferirVideo(Uint8Array.from(txt("<html>oi</html>"))) === null);
  ok("o formato pelo caminho reconhece .mp4 e .webm", formatoDoCaminho("a/b.mp4") === "mp4" && formatoDoCaminho("a/b.webm") === "webm" && formatoDoCaminho("a/b.mov") === null);
  ok("a extensão do gravador ignora os codecs", extensaoDaImagem("video/webm;codecs=vp9,opus").ext === "webm" && extensaoDaImagem("video/mp4;codecs=avc1.42E01E").tipo === "video/mp4");

  // A mídia (lib/rede/stories/midia.ts).
  const d = medidaDoVideo(1920, 1080);
  ok("vídeo deitado 1080p vira 720 de altura no máximo (sem esticar), em número par", d.largura === 1280 && d.altura === 720);
  const e = medidaDoVideo(1080, 1920);
  ok("vídeo em pé 1080 × 1920 vira 720 × 1280", e.largura === 720 && e.altura === 1280);
  ok("vídeo pequeno não cresce", medidaDoVideo(480, 640).largura === 480);
  ok("a taxa do vídeo cabe em 20 MB para 60 s, com folga", taxaDoVideo(60_000, true) * 60 / 8 < 20 * 1024 * 1024 * 0.9);
  ok("vídeo curto ganha taxa maior, mas nunca acima do teto", taxaDoVideo(5_000, false) <= 2_500_000 && taxaDoVideo(5_000, false) >= taxaDoVideo(60_000, false));
  ok("o formato prefere MP4 (H.264) quando o navegador grava", escolherFormatoDeVideo((t) => t.startsWith("video/mp4")) === "video/mp4;codecs=avc1.42E01F,mp4a.40.2");
  ok("sem MP4, cai no WEBM", escolherFormatoDeVideo((t) => t.startsWith("video/webm")).startsWith("video/webm"));
  ok("sem gravador nenhum, nulo", escolherFormatoDeVideo(() => false) === null);
  ok("o corte nunca passa de 60 s e tem pelo menos 1 s", JSON.stringify(cortarTrecho(0, 90_000, 90_000)) === JSON.stringify({ inicio: 0, fim: 60_000 }) && cortarTrecho(5000, 5100, 20_000).fim - cortarTrecho(5000, 5100, 20_000).inicio >= 1000);
  ok("o corte fica dentro do vídeo", cortarTrecho(-500, 4000, 3000).inicio === 0 && cortarTrecho(-500, 4000, 3000).fim === 3000);
  ok("os filtros são uma lista fechada e viram CSS conhecido", FILTROS_DO_STORY.length >= 6 && filtroEmCss("nenhum") === "none" && filtroEmCss("inventado") === "none" && /grayscale/.test(filtroEmCss("pb")));
  ok("giro e zoom ficam dentro dos limites", JSON.stringify(transformacaoValida({ x: 9, y: -9, escala: 40, giro: 7 })) === JSON.stringify({ x: 1, y: -1, escala: 5, giro: 7 - 2 * Math.PI }));

  const semUrl = await comEnderecos([{ id: "a", fundo: { tipo: "video", cor: "azul", caminho: "x/y.mp4", url: "", alt: "", duracao: 3000, som: false } }], async () => ({}));
  ok("vídeo sem endereço assinado vira fundo de cor (nunca um vídeo quebrado)", semUrl[0].fundo.tipo === "listras");
  const comUrl = await comEnderecos([{ id: "a", fundo: { tipo: "video", cor: "azul", caminho: "x/y.mp4", url: "", alt: "", duracao: 3000, som: true } }], async (cs) => Object.fromEntries(cs.map((c) => [c, `https://a/${c}`])));
  ok("vídeo com endereço assinado guarda duração e som", comUrl[0].fundo.url === "https://a/x/y.mp4" && comUrl[0].fundo.duracao === 3000 && comUrl[0].fundo.som === true);
  const capas = await capasAssinadas([{ id: "d", titulo: "x", cor: "azul", n: 1, capa: { caminho: "u/c.webp", tipo: "imagem" } }], async () => ({}));
  ok("capa de destaque sem endereço fica só com a cor", capas[0].capa === null);

  // O dublê da prévia (sem navegador: sem vídeo de exemplo, cai no mosaico).
  const p = criarClienteDaPrevia(() => Date.parse("2026-11-10T12:00:00Z"));
  const dce = await p.abrir("dcelivre");
  ok("prévia: o story de vídeo vira mosaico onde não há gravador", dce.some((s) => s.fundo.tipo === "mosaico") && !dce.some((s) => s.fundo.tipo === "video"));
  ok("prévia: os destaques de exemplo vêm com o número de stories, nunca de pessoas", (await p.destaques("rosavermelha")).every((x) => typeof x.n === "number" && !("vistos" in x)));
  const novo = await p.salvarDestaque({ destaque: null, titulo: "Greve", story: null, cor: "verde" });
  ok("prévia: criar destaque", novo.titulo === "Greve" && novo.cor === "verde");
  ok("prévia: as comunidades para mencionar", (await p.comunidades()).length > 0);
}

// ═══════════════════ 2. O banco ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const um = async (texto, valores = []) => (await dono(texto, valores)).rows[0];
const todos = async (texto, valores = []) => (await dono(texto, valores)).rows;

await banco.exclusivo(() => banco.pg.exec(`
  create schema if not exists storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text,
    owner_id text default (auth.uid())::text, created_at timestamptz not null default now(), metadata jsonb, unique (bucket_id, name));
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;
  alter table storage.objects enable row level security;
  grant usage on schema storage to anon, authenticated, service_role;
  grant select, insert, delete on storage.objects to authenticated;
  grant execute on function storage.foldername(text) to anon, authenticated;
`));

const MIGRACAO = "supabase/migracoes/20261110-alumia-stories-video.sql";
ok("a migração está colada inteira no fim do install.sql", ler("supabase/install.sql").includes(ler(MIGRACAO).trim()));
await espera("a F0 instala", () => banco.exclusivo(() => banco.pg.exec(ler("supabase/migracoes/20261109-alumia-f0-contrato.sql"))));
await espera("a F5 instala (com o depósito)", () => banco.exclusivo(() => banco.pg.exec(ler("supabase/migracoes/20261109-alumia-f5.sql"))));
await espera("a de vídeo instala por cima", () => banco.exclusivo(() => banco.pg.exec(ler(MIGRACAO))));
await espera("e de novo sem estrago (idempotente)", () => banco.exclusivo(() => banco.pg.exec(ler(MIGRACAO))));
await espera("o depósito continua privado e aceita vídeo até 20 MB", () => um("select * from storage.buckets where id = 'rede-stories'"),
  (b) => b.public === false && Number(b.file_size_limit) === 20971520 && b.allowed_mime_types.includes("video/mp4") && b.allowed_mime_types.includes("video/webm"));

let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++ % 250}` });
const visitante = () => ({ papel: "anon", ip: `203.0.113.${ip++ % 250}` });
const servico = { papel: "service_role" };

const P = {};
const nomes = ["autora", "seguidor", "membro", "bloqueado", "outra"];
for (const [i, nome] of nomes.entries()) {
  P[nome] = await criarUsuario(`${nome}@video.local`, nome);
  await rpc(como(P[nome]), "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3 where id = $1", [P[nome], `Lutadora ${i + 1}`, `${nome}_vd`]);
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of nomes) {
  await dono("update interno.perfis set rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome]]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1)", [P[nome]]);
}
await dono("update auth.users set created_at = now() - interval '30 days'");
for (const nome of ["seguidor", "bloqueado"]) await dono("insert into interno.rede_seguindo (quem, segue) values ($1, $2)", [P[nome], P.autora]);
await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2)", [P.autora, P.bloqueado]);
// Comunidades: uma aberta (a autora é membro), uma fechada (a autora é membro, o seguidor não) e uma fechada sem a autora.
await dono(`insert into interno.rede_comunidades (slug, nome, categoria, tipo) values ('passe-livre', 'Passe Livre', 'lutas', 'aberta'),
  ('nucleo-leste', 'Núcleo Leste', 'lutas', 'fechada'), ('segredo', 'Segredo', 'lutas', 'fechada')`);
await dono("insert into interno.rede_comunidade_membros (comunidade, usuario) values ('passe-livre', $1), ('nucleo-leste', $1)", [P.autora]);

const cliente = (sub) =>
  criarClienteDeStories((f, a) => rpc(sub ? como(sub) : visitante(), f, a), async () => "", async (cs) => Object.fromEntries(cs.map((c) => [c, `https://assinado.local/${c}`])));
const C = Object.fromEntries(nomes.map((n) => [n, cliente(P[n])]));
const anon = cliente(null);

const comoNoBanco = async (sub, sql, valores = []) => banco.exclusivo(async () => {
  await banco.pg.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ role: "authenticated", sub })]);
  await banco.pg.exec("set role authenticated");
  try {
    return (await banco.pg.query(sql, valores)).rows;
  } finally {
    await banco.pg.exec("reset role");
  }
});
const enviar = (sub, nome, mime, size) => comoNoBanco(sub, "insert into storage.objects (bucket_id, name, metadata) values ('rede-stories', $1, $2) returning name", [`${sub}/${nome}`, JSON.stringify({ size, mimetype: mime })]);

// ═══════════════════ 3. Publicar vídeo ═══════════════════
const base = { publico: "seguidores", fundo: { tipo: "listras", cor: "vermelho" }, texto: "ATO NA REITORIA", legenda: null, imagem: null, alt: null, post_ref: null, figurinhas: [] };
const v1 = `${P.autora}/0123456789abcdef0123456789abcdef.mp4`;
await espera("a autora envia um vídeo de 8 MB para a própria pasta", () => enviar(P.autora, "0123456789abcdef0123456789abcdef.mp4", "video/mp4", 8_000_000), (l) => l.length === 1);
const sVid = await espera("publica o vídeo (12 s, com som, texto em fonte serifa e caixa)", () => C.autora.publicar({
  ...base, fundo: { tipo: "video", cor: "vermelho" }, imagem: v1, alt: "Gente na escadaria", video: { duracao_ms: 12_000, som: true },
  estilo: { fonte: "serifa", cor_texto: "dourado", alinhar: "centro", caixa: "caixa" },
}), (r) => r.id);
await espera("quem segue recebe o vídeo com endereço assinado, duração, som e o estilo", async () => (await C.seguidor.abrir("autora_vd")).find((s) => s.id === sVid?.id),
  (s) => s.fundo.tipo === "video" && s.fundo.url === `https://assinado.local/${v1}` && s.fundo.duracao === 12_000 && s.fundo.som === true && s.fundo.alt === "Gente na escadaria"
    && s.estilo.fonte === "serifa" && s.estilo.cor_texto === "dourado" && s.estilo.caixa === "caixa" && s.destaques == null);
await espera("o vídeo nasce sem conferir (a faxina confere)", () => um("select conferido from interno.rede_stories where id = $1", [sVid.id]), (r) => r.conferido === false);
await recusa("vídeo com mais de 60 s é recusado", async () => {
  await enviar(P.autora, "11111111111111111111111111111111.mp4", "video/mp4", 1000);
  return C.autora.publicar({ ...base, fundo: { tipo: "video", cor: "azul" }, imagem: `${P.autora}/11111111111111111111111111111111.mp4`, video: { duracao_ms: 61_000, som: false } });
}, "invalido:video");
await recusa("vídeo sem duração é recusado", () => C.autora.publicar({ ...base, fundo: { tipo: "video", cor: "azul" }, imagem: `${P.autora}/11111111111111111111111111111111.mp4` }), "invalido:video");
await recusa("vídeo com mais de 20 MB é recusado", async () => {
  await enviar(P.autora, "22222222222222222222222222222222.webm", "video/webm", 21_000_000);
  return C.autora.publicar({ ...base, fundo: { tipo: "video", cor: "azul" }, imagem: `${P.autora}/22222222222222222222222222222222.webm`, video: { duracao_ms: 5000, som: false } });
}, "invalido:video");
await recusa("arquivo .mp4 publicado como imagem é recusado", () => C.autora.publicar({ ...base, fundo: { tipo: "imagem", cor: "azul" }, imagem: `${P.autora}/11111111111111111111111111111111.mp4` }), "invalido:imagem");
await recusa("imagem publicada como vídeo é recusada", async () => {
  await enviar(P.autora, "33333333333333333333333333333333.webp", "image/webp", 1000);
  return C.autora.publicar({ ...base, fundo: { tipo: "video", cor: "azul" }, imagem: `${P.autora}/33333333333333333333333333333333.webp`, video: { duracao_ms: 5000, som: false } });
}, "invalido:video");
await recusa("vídeo com tipo de imagem no depósito é recusado", async () => {
  await enviar(P.autora, "44444444444444444444444444444444.mp4", "image/webp", 1000);
  return C.autora.publicar({ ...base, fundo: { tipo: "video", cor: "azul" }, imagem: `${P.autora}/44444444444444444444444444444444.mp4`, video: { duracao_ms: 5000, som: false } });
}, "invalido:video");
await recusa("som num story que não é vídeo é recusado pela tabela", () => dono("insert into interno.rede_stories (autor, texto, conferido, som) values ($1, 'x', true, true)", [P.autora]), "rede_stories_video");

// ═══════════════════ 4. Estilo e comunidade ═══════════════════
await recusa("fonte fora da lista é recusada", () => C.autora.publicar({ ...base, estilo: { fonte: "Comic Sans" } }), "invalido:estilo");
await recusa("CSS livre no estilo é recusado", () => C.autora.publicar({ ...base, estilo: { fonte: "serifa", css: "background:url(x)" } }), "invalido:estilo");
await recusa("cor de letra fora da lista é recusada", () => C.autora.publicar({ ...base, estilo: { cor_texto: "#ff0000" } }), "invalido:estilo");
const sCom = await espera("menção a comunidade aberta (o nome vem da comunidade, não do pedido)", () => C.autora.publicar({ ...base, figurinhas: [{ tipo: "comunidade", slug: "passe-livre", nome: "Nome inventado" }] }), (r) => r.id);
await espera("quem vê recebe o nome certo e o atalho", async () => (await C.seguidor.abrir("autora_vd")).find((s) => s.id === sCom?.id).figurinhas[0], (f) => f.tipo === "comunidade" && f.slug === "passe-livre" && f.nome === "Passe Livre");
const sFech = await espera("a autora menciona a comunidade fechada dela", () => C.autora.publicar({ ...base, figurinhas: [{ tipo: "comunidade", slug: "nucleo-leste", nome: "" }] }), (r) => r.id);
await espera("quem não é membro da fechada vê o nome, sem o atalho", async () => (await C.seguidor.abrir("autora_vd")).find((s) => s.id === sFech?.id).figurinhas[0], (f) => f.slug === null && f.nome === "Núcleo Leste");
await recusa("menção a comunidade fechada de que a autora não é membro é recusada", () => C.autora.publicar({ ...base, figurinhas: [{ tipo: "comunidade", slug: "segredo", nome: "" }] }), "invalido:comunidade");
await recusa("menção a comunidade que não existe é recusada", () => C.autora.publicar({ ...base, figurinhas: [{ tipo: "comunidade", slug: "nao-existe", nome: "" }] }), "invalido:comunidade");
await recusa("duas menções num story é recusado", () => C.autora.publicar({ ...base, figurinhas: [{ tipo: "comunidade", slug: "passe-livre", nome: "" }, { tipo: "comunidade", slug: "nucleo-leste", nome: "" }] }), "invalido:figurinhas");
await espera("as comunidades para mencionar são as minhas, sem número de membros", () => C.autora.comunidades(), (l) => l.map((c) => c.slug).sort().join() === "nucleo-leste,passe-livre" && l.every((c) => Object.keys(c).sort().join() === "nome,slug"));
await espera("quem não é membro de nada não tem o que mencionar", () => C.seguidor.comunidades(), (l) => l.length === 0);
await recusa("visitante não lista comunidades", () => rpc(visitante(), "rede_story_comunidades", {}), "permission denied");

// ═══════════════════ 5. Destaques ═══════════════════
const sTexto = await C.autora.publicar({ ...base, texto: "GREVE GERAL", publico: "membros" });
const sProx = await C.autora.publicar({ ...base, texto: "SÓ PRA QUEM É PERTO", publico: "proximos" });
const d1 = await espera("a autora cria um destaque com o vídeo", () => C.autora.salvarDestaque({ destaque: null, titulo: "Greve 2026", story: sVid.id, cor: "vermelho" }), (r) => r.id && r.titulo === "Greve 2026");
await espera("e guarda mais dois stories nele", async () => {
  await C.autora.salvarDestaque({ destaque: d1.id, titulo: null, story: sTexto.id });
  return C.autora.salvarDestaque({ destaque: d1.id, titulo: null, story: sProx.id });
}, (r) => r.id === d1.id);
await espera("a autora vê em quais destaques o story está", async () => (await C.autora.meus()).find((s) => s.id === sVid.id).destaques, (l) => JSON.stringify(l) === JSON.stringify([d1.id]));
await recusa("título com telefone é recusado", () => C.autora.salvarDestaque({ destaque: null, titulo: "11 98765-4321", story: null }), "dado_pessoal");
await recusa("destaque novo sem título é recusado", () => C.autora.salvarDestaque({ destaque: null, titulo: null, story: sVid.id }), "invalido:titulo");
await recusa("guardar story de outra pessoa é recusado", async () => {
  const s = await C.outra.publicar({ ...base, publico: "membros" });
  return C.autora.salvarDestaque({ destaque: d1.id, titulo: null, story: s.id });
}, "nao_encontrado");
await recusa("mexer no destaque de outra pessoa é recusado", () => C.outra.salvarDestaque({ destaque: d1.id, titulo: "Meu agora", story: null }), "nao_encontrado");
await recusa("visitante não cria destaque", () => rpc(visitante(), "rede_story_destaque_salvar", { p_destaque: null, p_titulo: "x", p_story: null, p_cor: null }), "permission denied");

// Venceu: o story some da faixa, mas fica no destaque com o mesmo público.
await dono("update interno.rede_stories set expira_em = now() - interval '1 minute' where id = any ($1)", [[sVid.id, sTexto.id, sProx.id]]);
await espera("vencido, o vídeo sai da faixa de quem segue", async () => (await C.seguidor.abrir("autora_vd")).some((s) => s.id === sVid.id), (x) => x === false);
await espera("os destaques no perfil: o seguidor vê 2 (o 'próximos' não), com a capa de cor (vídeo não vira capa)", () => C.seguidor.destaques("autora_vd"),
  (l) => l.length === 1 && l[0].n === 2 && l[0].titulo === "Greve 2026" && l[0].capa == null);
await espera("o membro de fora vê só o story para membros", () => C.membro.destaques("autora_vd"), (l) => l.length === 1 && l[0].n === 1);
await espera("o bloqueado não vê destaque nenhum", () => C.bloqueado.destaques("autora_vd"), (l) => l.length === 0);
await recusa("visitante não lê destaques (nem chama a função)", () => anon.destaques("autora_vd"), "permission denied");
await espera("a dona vê os 3", () => C.autora.destaques("autora_vd"), (l) => l[0].n === 3);
await espera("abrir o destaque: o seguidor recebe o vídeo assinado, na ordem", () => C.seguidor.destaque(d1.id), (l) => l.length === 2 && l[0].id === sVid.id && l[0].fundo.url === `https://assinado.local/${v1}`);
await espera("o bloqueado abre e não recebe nada", () => C.bloqueado.destaque(d1.id), (l) => l.length === 0);
await espera("a regra do depósito deixa o seguidor ler o vídeo guardado; o bloqueado não", async () => [
  (await comoNoBanco(P.seguidor, "select name from storage.objects where bucket_id = 'rede-stories' and name = $1", [v1])).length,
  (await comoNoBanco(P.bloqueado, "select name from storage.objects where bucket_id = 'rede-stories' and name = $1", [v1])).length,
], (r) => r.join() === "1,0");
await espera("responder a um story guardado chega só à autora", () => C.seguidor.responder(sVid.id, "Que ato bonito"), (r) => r.ok);
await espera("nada de quem viu nas tabelas novas", () => todos(`select table_name, column_name from information_schema.columns where table_schema = 'interno' and table_name like 'rede_story_%destaque%'
  and (column_name ~* '(vist|visualiz|viu|view|seen|leitor|abriu)')`), (l) => l.length === 0);
const antes = await um("select (select count(*) from interno.limites where chave like 'rede5%') as n");
await C.seguidor.destaques("autora_vd");
await C.seguidor.destaque(d1.id);
await espera("ver destaques não grava nada", () => um("select (select count(*) from interno.limites where chave like 'rede5%') as n"), (r) => r.n === antes.n);

// Retido some do destaque também.
await dono("update interno.rede_stories set retido = true where id = $1", [sTexto.id]);
await espera("story retido some do destaque para os outros", () => C.membro.destaques("autora_vd"), (l) => l.length === 0);
await dono("update interno.rede_stories set retido = false where id = $1", [sTexto.id]);

// ═══════════════════ 6. A faxina e os destaques ═══════════════════
await espera("a rodada do banco não leva os stories vencidos que estão num destaque", async () => {
  await um("select interno.rede5_story_faxina() as r");
  return todos("select id from interno.rede_stories where id = any ($1)", [[sVid.id, sTexto.id, sProx.id]]);
}, (l) => l.length === 3);
await espera("a lista da faxina não pede para apagar o vídeo guardado, mas pede para conferir", () => rpc(servico, "rede_story_faxina_lista", {}),
  (r) => !r.apagar.some((x) => x.id === sVid.id) && r.conferir.some((x) => x.id === sVid.id));
await espera("tirar do destaque devolve o story vencido à faxina", async () => {
  await C.autora.tirarDoDestaque(d1.id, sProx.id);
  await um("select interno.rede5_story_faxina() as r");
  return todos("select id from interno.rede_stories where id = $1", [sProx.id]);
}, (l) => l.length === 0);

// A Edge Function confere o vídeo: um com GPS sai do ar E do destaque.
const v2 = `${P.autora}/55555555555555555555555555555555.mp4`;
await enviar(P.autora, "55555555555555555555555555555555.mp4", "video/mp4", 5000);
const sGps = await C.autora.publicar({ ...base, fundo: { tipo: "video", cor: "azul" }, imagem: v2, video: { duracao_ms: 4000, som: false } });
await C.autora.salvarDestaque({ destaque: d1.id, titulo: null, story: sGps.id });
const be = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const caixa = (tipo, dados) => [...be(8 + dados.length), ...Buffer.from(tipo, "latin1"), ...dados];
const mp4Limpo = Uint8Array.from([...caixa("ftyp", [...Buffer.from("isom")]), ...caixa("moov", caixa("mvhd", [0, 0, 0, 0])), ...caixa("mdat", [1])]);
const mp4Gps = Uint8Array.from([...caixa("ftyp", [...Buffer.from("isom")]), ...caixa("moov", caixa("udta", caixa("©xyz", [...Buffer.from("+23-46/")]))), ...caixa("mdat", [1])]);
const removidos = [];
await espera("a Edge Function confere os vídeos: o limpo fica, o com GPS sai do ar", () => rodada({
  chamar: (f, a) => rpc(servico, f, a),
  baixar: async (c) => (c === v1 ? mp4Limpo : c === v2 ? mp4Gps : new Uint8Array()),
  subir: async () => undefined,
  remover: async (cs) => removidos.push(...cs),
}), (x) => x.conferidos >= 1 && x.ruins >= 1);
await espera("o vídeo limpo ficou conferido; o com GPS saiu do destaque e do ar", async () => ({
  limpo: (await um("select conferido from interno.rede_stories where id = $1", [sVid.id])).conferido,
  noDestaque: (await todos("select 1 from interno.rede_story_no_destaque where story = $1", [sGps.id])).length,
  fora: (await um("select expira_em <= now() as fora from interno.rede_stories where id = $1", [sGps.id])).fora,
}), (x) => x.limpo === true && x.noDestaque === 0 && x.fora === true);
await espera("apagar o destaque devolve os vencidos à faxina", async () => {
  await C.autora.apagarDestaque(d1.id);
  await um("select interno.rede5_story_faxina() as r");
  return todos("select id from interno.rede_stories where id = any ($1)", [[sTexto.id]]);
}, (l) => l.length === 0);
await espera("a lista da faxina agora pede o vídeo vencido", () => rpc(servico, "rede_story_faxina_lista", {}), (r) => r.apagar.some((x) => x.id === sVid.id));
await recusa("apagar destaque de novo dá nao_encontrado", () => C.autora.apagarDestaque(d1.id), "nao_encontrado");

// Limite de 6 destaques.
await recusa("no máximo 6 destaques", async () => {
  for (let k = 0; k < 7; k++) await C.outra.salvarDestaque({ destaque: null, titulo: `Destaque ${k + 1}`, story: null });
}, "limite:destaques");

// ═══════════════════ 7. Nunca federa ═══════════════════
await espera("nenhuma função da federação lê as tabelas de stories ou destaques", () => todos(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where (p.proname like 'rede_fed%' or p.proname like 'fed_%') and p.prosrc ~ 'rede_stor'`), (l) => l.length === 0);

console.log(`\n${certos} certos, ${falhas.length} falhas`);
if (falhas.length) {
  for (const f of falhas) console.log(`  ✗ ${f}`);
  process.exit(1);
}
process.exit(0);
