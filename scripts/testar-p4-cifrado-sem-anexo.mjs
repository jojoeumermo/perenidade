// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 4, item 136: o post cifrado da comunidade fechada não grava anexo legível.
//   · antes da migração: um áudio ligado a um post cifrado entrava (o vazamento);
//   · depois: rede_publicar recusa imagem e áudio no post cifrado, e as tabelas dos anexos recusam qualquer ligação a post cifrado;
//   · o post aberto continua aceitando anexo; a tela tira os botões de anexo no post cifrado e o pedido cifrado com anexo nem sai.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-p4-cifrado-sem-anexo.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { noFimDoInstall } from "./install-posteriores.mjs";
import { pedidoCifrado, temAnexoAberto } from "../components/rede/publicar/restrito/grupo.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");
const normal = (t) => t.replace(/^﻿/, "").replace(/\r\n/g, "\n").trim();

let certos = 0;
const falhas = [];
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
async function recusa(nome, fazer, codigo) {
  try {
    const v = await fazer();
    falhas.push(`${nome}: deveria recusar com "${codigo}", mas passou (${JSON.stringify(v)?.slice(0, 200)})`);
  } catch (erro) {
    if (String(erro.message).includes(codigo)) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${erro.message}"`);
  }
}
async function passa(nome, fazer) {
  try {
    const v = await fazer();
    certos++;
    return v;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
    return undefined;
  }
}

const SQL = normal(ler("supabase/migracoes/20261127-p4-cifrado-sem-anexo.sql"));
const semComentario = SQL.replace(/--.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
ok("a migração termina passando a porta", /select interno\.alumia_trancar\(\);$/.test(SQL));
ok("a migração não lê nem guarda endereço de rede", !/\binet\b|\bip\b|x-forwarded|cf-connecting|remote_addr/i.test(semComentario));
ok("a migração não apaga anexo nenhum (a decisão é da coordenação)", !/\bdelete from\b/i.test(semComentario));

async function montar(banco) {
  const { dono, criarUsuario, rpc } = banco;
  const P = {};
  for (const [i, nome] of ["ana", "bia"].entries()) {
    P[nome] = await criarUsuario(`${nome}@p4-136.local`, nome);
    await rpc({ papel: "authenticated", sub: P[nome], ip: `198.51.100.${i + 1}` }, "eu");
    await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1",
      [P[nome], `Pessoa ${i + 1}`, `pessoa_${nome}`]);
  }
  await dono("delete from interno.papeis");
  await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
  for (const id of Object.values(P)) await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [id]);
  await dono("update auth.users set created_at = now() - interval '30 days'");
  await dono("insert into interno.rede_comunidades (slug, nome, categoria, tipo) values ('roda-fechada', 'Roda fechada', 'lutas', 'fechada'), ('praca', 'Praça', 'lutas', 'aberta') on conflict do nothing");
  for (const id of Object.values(P)) {
    await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, situacao) values ('roda-fechada', $1, 'ativo'), ('praca', $1, 'ativo') on conflict do nothing", [id]);
  }
  const publicar = async (quem, pedido) => {
    await dono("delete from interno.limites");
    return rpc({ papel: "authenticated", sub: P[quem], ip: "198.51.100.9" }, "rede_publicar", { p: pedido });
  };
  return { P, publicar };
}

const CIFRA = "p2.3.dmV0b3I.Y2lmcmFkb3NlZ3JlZG9wYWxhdnJhdW5pY2E";
const CIFRADO = { comunidade: "roda-fechada", publico: "comunidade", grupo: "comunidade:roda-fechada", corpo_grupo: CIFRA };
const uuid = () => crypto.randomUUID();

// ═══ 1. Antes: o vazamento existia ═══
{
  const banco = await criarBanco({ antesDe: SQL });
  const { P, publicar } = await montar(banco);
  const post = await passa("antes: o post cifrado publica", () => publicar("ana", CIFRADO));
  if (post?.id) {
    await passa("antes: um áudio aberto se ligava ao post cifrado (o vazamento)", () =>
      banco.dono("insert into interno.rede_audios (post, caminho, tipo, duracao) values ($1, $2, 'audio/webm', 5)", [post.id, `${P.ana}/${uuid()}.webm`]));
  }
  await banco.pg.close?.();
}

// ═══ 2. Depois ═══
const banco = await criarBanco();
const { dono } = banco;
const install = normal(ler("supabase/install.sql"));
await passa("a migração roda por cima do install.sql", () => banco.exclusivo(() => banco.pg.exec(SQL)));
await passa("e de novo (idempotente)", () => banco.exclusivo(() => banco.pg.exec(SQL)));
if (install.includes(SQL)) ok("a migração está no fim do install.sql", noFimDoInstall(SQL, install));
{
  const r = (await dono("select interno.alumia_trancar() as r")).rows[0].r;
  ok(`trancar não acha nada aberto (${JSON.stringify(r.abertas)})`, r.abertas.length === 0);
  const n = (await dono("select count(*)::int n from pg_trigger where tgname = 'p4_anexo_sem_cifra'")).rows[0].n;
  ok(`a regra está nas quatro tabelas dos anexos (${n})`, n === 4);
}
const { P, publicar } = await montar(banco);
const audio = () => ({ caminho: `${P.ana}/${uuid()}.webm`, duracao: 5 });
const imagem = () => [{ caminho: `${P.ana}/${uuid()}.jpg`, tipo: "image/jpeg", largura: 10, altura: 10, alt: "" }];

await recusa("post cifrado com áudio: recusa", () => publicar("ana", { ...CIFRADO, audio: audio() }), "invalido:grupo");
await recusa("post cifrado com imagem sem descrição: recusa", () => publicar("ana", { ...CIFRADO, midia: imagem() }), "invalido:grupo");
const cifrado = await passa("post cifrado só com o texto cifrado: publica", () => publicar("ana", CIFRADO));
if (cifrado?.id) {
  await recusa("tabela: áudio ligado a post cifrado, recusa", () =>
    dono("insert into interno.rede_audios (post, caminho, tipo, duracao) values ($1, $2, 'audio/webm', 5)", [cifrado.id, audio().caminho]), "invalido:grupo");
  await recusa("tabela: imagem ligada a post cifrado, recusa", () =>
    dono("insert into interno.rede_midia (post, caminho, tipo, ordem) values ($1, $2, 'image/jpeg', 0)", [cifrado.id, imagem()[0].caminho]), "invalido:grupo");
  await recusa("tabela: transcrição ligada a post cifrado, recusa", () =>
    dono("insert into interno.rede_audio_transcricoes (post, texto) values ($1, 'texto aberto')", [cifrado.id]), "invalido:grupo");
  const reserva = await passa("tabela: reserva de vídeo sem post entra", () =>
    dono(`insert into interno.rede_post_videos (autor, caminho, tipo, bytes, duracao_ms, largura, altura) values ($1, $2, 'video/mp4', 100, 1000, 10, 10) returning id`,
      [P.ana, `${P.ana}/${uuid()}.mp4`]));
  if (reserva) {
    await recusa("tabela: ligar o vídeo ao post cifrado, recusa", () =>
      dono("update interno.rede_post_videos set post = $2, ligado_em = now() where id = $1", [reserva.rows[0].id, cifrado.id]), "invalido:grupo");
  }
  const sobra = (await dono("select interno.rede_p4_anexos_abertos_antigos() as r")).rows[0].r;
  ok(`nenhum anexo ficou ligado ao post cifrado (${JSON.stringify(sobra)})`, sobra.imagens === 0 && sobra.audios === 0 && sobra.videos === 0);
}
const aberto = await passa("post aberto da comunidade com texto: publica", () => publicar("ana", { comunidade: "praca", publico: "comunidade", texto: "Aberto." }));
if (aberto?.id) {
  await passa("tabela: áudio em post aberto continua entrando", () =>
    dono("insert into interno.rede_audios (post, caminho, tipo, duracao) values ($1, $2, 'audio/webm', 5)", [aberto.id, audio().caminho]));
}

// ═══ 3. O aparelho e a tela ═══
ok("temAnexoAberto: imagem, áudio e vídeo contam", temAnexoAberto({ midia: [{}] }) && temAnexoAberto({ audio: {} }) && temAnexoAberto({ video: "x" }));
ok("temAnexoAberto: sem anexo, não", !temAnexoAberto({ texto: "oi", midia: [] }) && !temAnexoAberto({ audio: null }));
{
  let lancou = false;
  try {
    pedidoCifrado({ texto: "oi", audio: { caminho: "a" } }, { grupo: "comunidade:x", corpo_grupo: "p2.1" });
  } catch (e) {
    lancou = e.message === "cifrado_com_anexo";
  }
  ok("o pedido cifrado com anexo nem sai do aparelho", lancou);
}
const escrever = ler("components/rede/publicar/alumia2/EscreverDaAlumia2.tsx");
const anexos = ler("components/rede/publicar/alumia2/AnexosDoEscrever.tsx");
ok("o Escrever passa semMidia no post cifrado e recusa com imagem ou áudio", escrever.includes("semMidia={grupoCifrado ?") && escrever.includes("grupoCifrado && (pub.imagens.length > 0 || pub.audio)"));
ok("os botões de imagem, áudio e vídeo somem no post cifrado", (anexos.match(/\{comMidia && /g) ?? []).length === 3 && anexos.includes("data-sem-midia"));
for (const l of ["pt", "en", "es", "fr", "ru", "zh"]) {
  const t = JSON.parse(ler(`i18n/rede/publicar/restrito/${l}.json`));
  ok(`${l}: o texto semAnexo existe`, typeof t.semAnexo === "string" && t.semAnexo.trim().length > 20);

}

console.log(`\n${certos} certos, ${falhas.length} falhas`);
if (falhas.length) {
  for (const f of falhas) console.log(`  ✗ ${f}`);
  process.exit(1);
}
process.exit(0);
