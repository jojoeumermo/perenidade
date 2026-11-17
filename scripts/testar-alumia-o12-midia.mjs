// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a frente 12B da onda 12 (voz e vídeo):
//   · as contas da tela (lib/rede/midia/regras.ts e voz.ts): limites iguais aos do banco, a medida e a taxa do vídeo regravado,
//     o trecho de 60 s, a voz só do próprio aparelho, o texto que a voz lê e os trechos da fala;
//   · a segunda limpeza do vídeo no servidor (lib/rede/midia/limpar-video.ts): MP4 e WEBM montados aqui, com GPS, título e datas,
//     saem sem nada disso e do mesmo tamanho; imagem, Matroska geral e estrutura quebrada são recusados;
//   · o lote que junta os cartões numa chamada e o interruptor "alumia-video-post" (só pelo nome);
//   · o banco: a migração rodada TRÊS vezes sobre o install.sql num Postgres de verdade (scripts/banco-local.mjs), a porta, RLS sem
//     política, a transcrição só da autora e só depois de aprovada, o vídeo atrás do interruptor do painel (reservar, ligar, ver,
//     tirar), a fila de arquivos, o post apagado, a faxina das reservas, sair da Alumia e a cópia de "meus dados";
//   · nada de endereço de rede, nada de lista de pessoas, nenhum parâmetro do tipo linha com valor padrão, os textos nas seis
//     línguas e as pastas da outra faixa sem mudança.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-alumia-o12-midia.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import {
  escolherGravacao, formatoDoVideo, LIMITES_DA_MIDIA, medidaDoVideoDoPost, motivoSemVideo, relogioDoVideo, taxaDoVideoDoPost, TAXA_DO_AUDIO_DO_VIDEO,
  transcricaoLimpa, trechoDoVideo,
} from "../lib/rede/midia/regras.ts";
import { escolherVoz, textoParaOuvir, trechosParaFalar } from "../lib/rede/midia/voz.ts";
import { identificarVideo, limparVideo } from "../lib/rede/midia/limpar-video.ts";
import { criarLote } from "../lib/rede/midia/cliente.ts";
import { RECURSO_DO_VIDEO, videoNoPostLigado } from "../lib/rede/midia/ligado.ts";

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

// ═══════════════════ 0. O arquivo da migração ═══════════════════
const sql = ler("supabase/migracoes/20261118-alumia-o12-midia.sql");
ok("toda função nova é security definer com search_path fixo", (() => {
  const funcoes = sql.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
  return funcoes.length >= 18 && funcoes.every((f) => /security definer set search_path = interno, pg_temp/.test(f));
})());
const tabelas = [...sql.matchAll(/create table if not exists interno\.([a-z_]+)/g)].map((m) => m[1]);
ok("duas tabelas novas, com RLS e sem permissão para anon e authenticated", tabelas.length === 2
  && tabelas.every((t) => sql.includes(`alter table interno.${t} enable row level security`)) && !/grant [a-z, ]+ on (table )?interno\./i.test(sql));
ok("não mexe na versão da Alumia nem no install.sql e termina passando a porta em tudo", !/function public\.rede_alumia_versao/.test(sql) && /select interno\.alumia_trancar\(\);/.test(sql.slice(-400)));
ok("nenhum parâmetro do tipo linha de tabela com valor padrão", !/\b[a-z_]+ interno\.[a-z_]+ default\b/i.test(sql) && !/\brede_posts default\b/.test(sql));
ok("nenhuma tabela nova guarda endereço de rede", !(sql.match(/create table if not exists interno\.[a-z_]+ \([\s\S]*?\n\);/g) ?? []).some((t) => /\b(inet|cidr|ip|porta|endereco)\b/.test(t)));
ok("os limites da tela são os do banco", sql.includes(`bytes between 1 and ${LIMITES_DA_MIDIA.videoBytes}`) && sql.includes(`p_bytes not between 1 and ${LIMITES_DA_MIDIA.videoBytes}`)
  && sql.includes(`duracao_ms between ${LIMITES_DA_MIDIA.videoMinMs} and ${LIMITES_DA_MIDIA.videoMs + 500}`) && sql.includes(`largura between 2 and ${LIMITES_DA_MIDIA.ladoLongo}`)
  && sql.includes(`between 1 and ${LIMITES_DA_MIDIA.transcricao}`) && sql.includes(`char_length(alt) <= ${LIMITES_DA_MIDIA.alt}`)
  && sql.includes(`interval '${LIMITES_DA_MIDIA.janelaDeLigarMin} minutes'`) && sql.includes(`post is null) >= ${LIMITES_DA_MIDIA.reservasAbertas}`)
  && sql.includes(`file_size_limit, allowed_mime_types)\n    values ('rede-video', 'rede-video', false, ${LIMITES_DA_MIDIA.videoBytes}`));
ok("o interruptor entra no catálogo só pelo nome", sql.includes(`('${RECURSO_DO_VIDEO}', true)`));

// ═══════════════════ 1. As contas da tela ═══════════════════
{
  const t60 = taxaDoVideoDoPost(60_000, true);
  ok("60 s com som cabem em 16 MB com folga", (t60 + TAXA_DO_AUDIO_DO_VIDEO) * 60 / 8 <= LIMITES_DA_MIDIA.videoBytes * 0.85 && t60 >= 500_000);
  ok("vídeo curto não passa de 2,2 Mb/s; entrada torta vira o caso de 60 s", taxaDoVideoDoPost(5_000, false) === 2_200_000 && taxaDoVideoDoPost(Number.NaN, true) === t60);
  ok("a medida em 720p, deitado e em pé, sempre par", JSON.stringify(medidaDoVideoDoPost(1920, 1080)) === '{"largura":1280,"altura":720}'
    && JSON.stringify(medidaDoVideoDoPost(1080, 1920)) === '{"largura":720,"altura":1280}' && JSON.stringify(medidaDoVideoDoPost(640, 360)) === '{"largura":640,"altura":360}'
    && Object.values(medidaDoVideoDoPost(641, 361)).every((n) => n % 2 === 0) && medidaDoVideoDoPost(0, 100).largura === 0);
  ok("o trecho fica dentro do vídeo e em até 60 s", JSON.stringify(trechoDoVideo(0, 90_000)) === '{"inicio":0,"fim":60000}'
    && JSON.stringify(trechoDoVideo(80_000, 90_000)) === '{"inicio":30000,"fim":90000}' && JSON.stringify(trechoDoVideo(5_000, 30_000)) === '{"inicio":0,"fim":30000}'
    && JSON.stringify(trechoDoVideo(-5, 20_000)) === '{"inicio":0,"fim":20000}');
  ok("o relógio", relogioDoVideo(7_000) === "0:07" && relogioDoVideo(60_000) === "1:00" && relogioDoVideo(Number.NaN) === "0:00");
  ok("o formato do gravador vira o que o banco aceita", formatoDoVideo("video/webm;codecs=vp9,opus")?.ext === "webm" && formatoDoVideo("video/mp4")?.tipo === "video/mp4"
    && formatoDoVideo("video/quicktime") === null && formatoDoVideo("") === null);
  ok("o gravador prefere MP4, cai no WEBM, e navegador que lança erro não derruba", escolherGravacao((t) => t.startsWith("video/webm")) === "video/webm;codecs=vp9,opus"
    && escolherGravacao(() => true).startsWith("video/mp4") && escolherGravacao(() => { throw new Error("x"); }) === null);
  ok("um tipo de mídia por post e só no post de primeiro nível", motivoSemVideo({ resposta: true, imagens: 0, audio: false }) === "resposta"
    && motivoSemVideo({ resposta: false, imagens: 2, audio: false }) === "umTipo" && motivoSemVideo({ resposta: false, imagens: 0, audio: true }) === "umTipo"
    && motivoSemVideo({ resposta: false, imagens: 0, audio: false }) === null);
  ok("a transcrição limpa", transcricaoLimpa("  oi  \r\n\r\n\r\n\r\nmundo \n") === "oi\n\nmundo" && transcricaoLimpa("   ") === null && transcricaoLimpa("a".repeat(4001)) === null);
}
{
  const vozes = [
    { name: "Rede pt", lang: "pt-BR", localService: false, default: true },
    { name: "Portugal", lang: "pt_PT", localService: true },
    { name: "Brasil", lang: "pt-BR", localService: true },
    { name: "Brasil 2", lang: "pt-br", localService: true, default: true },
    { name: "English", lang: "en-US", localService: true },
  ];
  ok("a voz: só local, a etiqueta exata primeiro e, nela, a padrão", escolherVoz(vozes, "pt")?.name === "Brasil 2");
  ok("sem voz exata, a da mesma língua; sem local, nenhuma", escolherVoz(vozes.filter((v) => v.lang !== "pt-BR" && v.lang !== "pt-br"), "pt")?.name === "Portugal"
    && escolherVoz([{ name: "Rede", lang: "fr-FR", localService: false }], "fr") === null && escolherVoz(vozes, "ru") === null);
  const lido = textoParaOuvir({ titulo: "Assembleia", texto: "curto", corpo: "Veja **isto** em https://exemplo.org/a?b=1 e [a ata](https://x.org).", aviso: "violência" }, { aviso: "Aviso de conteúdo", link: "link" });
  ok("o texto que a voz lê: aviso, título, corpo, sem endereço nem marca", lido === "Aviso de conteúdo: violência. Assembleia. Veja isto em link e a ata.");
  const longo = "Primeira frase curta. " + "palavra ".repeat(120) + "fim. Outra frase.";
  const trechos = trechosParaFalar(longo, 220);
  ok("os trechos da fala: nenhum passa do limite e juntos são o texto inteiro", trechos.length > 3 && trechos.every((t) => t.length <= 220)
    && trechos.join(" ").replace(/\s+/g, " ") === longo.replace(/\s+/g, " ").trim() && trechosParaFalar("   ").length === 0);
}

// ═══════════════════ 2. A limpeza do vídeo no servidor ═══════════════════
const enc = new TextEncoder();
const junta = (...partes) => {
  const total = partes.reduce((n, p) => n + p.length, 0);
  const b = new Uint8Array(total);
  let i = 0;
  for (const p of partes) {
    b.set(p, i);
    i += p.length;
  }
  return b;
};
const u32 = (n) => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const caixa = (tipo, ...dados) => {
  const corpo = junta(...dados);
  return junta(u32(8 + corpo.length), enc.encode(tipo), corpo);
};
const temTexto = (b, t) => Buffer.from(b).includes(Buffer.from(t));
{
  const DATA = u32(0xdeadbeef);
  const cabecaComData = (n) => junta(new Uint8Array([0, 0, 0, 0]), DATA, DATA, new Uint8Array(n));
  const quadros = enc.encode("QUADROS-DO-VIDEO-".repeat(8));
  const mp4 = junta(
    caixa("ftyp", enc.encode("isom"), u32(512), enc.encode("isomiso2avc1mp41")),
    caixa("moov",
      caixa("mvhd", cabecaComData(88)),
      caixa("trak", caixa("tkhd", cabecaComData(72)), caixa("mdia", caixa("mdhd", cabecaComData(12)))),
      caixa("udta", caixa("©xyz", enc.encode("+12.3456-045.6789/")), caixa("©mod", enc.encode("Telefone Marca X"))),
      caixa("meta", u32(0), caixa("ilst", enc.encode("2026-11-16T10:00:00Z")))),
    caixa("uuid", enc.encode("XMP-AQUI-TEM-GPS")),
    caixa("mdat", quadros),
  );
  const copia = new Uint8Array(mp4);
  const limpo = limparVideo(mp4);
  ok("MP4: reconhecido pelos bytes e limpo", limpo?.tipo.ext === "mp4" && limpo.bytes.length === mp4.length);
  ok("MP4: sem GPS, sem modelo, sem data de texto, sem XMP", limpo && !temTexto(limpo.bytes, "+12.3456") && !temTexto(limpo.bytes, "Marca X")
    && !temTexto(limpo.bytes, "2026-11-16") && !temTexto(limpo.bytes, "XMP-AQUI") && !temTexto(limpo.bytes, "udta") && temTexto(limpo.bytes, "free"));
  ok("MP4: as datas de mvhd, tkhd e mdhd viram zero", limpo && !Buffer.from(limpo.bytes).includes(Buffer.from(DATA)));
  ok("MP4: os quadros e o original ficam intactos", limpo && temTexto(limpo.bytes, "QUADROS-DO-VIDEO-QUADROS") && Buffer.from(mp4).equals(Buffer.from(copia)));
  ok("MP4: caixa maior que o arquivo é recusada", limparVideo(mp4.subarray(0, mp4.length - 5)) === null);
  // Faixa de metadado com tempo (GoPro gpmd, Android camm, Apple mebx): o GPS fica no mdat. O arquivo é recusado.
  const comFaixa = (hdlr, entrada) => junta(
    caixa("ftyp", enc.encode("isom"), u32(512), enc.encode("isomiso2avc1mp41")),
    caixa("moov", caixa("mvhd", cabecaComData(88)),
      caixa("trak", caixa("tkhd", cabecaComData(72)), caixa("mdia", caixa("mdhd", cabecaComData(12)),
        caixa("hdlr", u32(0), u32(0), enc.encode(hdlr), new Uint8Array(12)),
        caixa("minf", caixa("stbl", caixa("stsd", u32(0), u32(1), caixa(entrada, new Uint8Array(16)))))))),
    caixa("mdat", enc.encode("GPS5 lat=-23.550520 lon=-46.633308 Av. Paulista")));
  ok("MP4 com faixa de metadado (hdlr meta, gpmd) é recusado", limparVideo(comFaixa("meta", "gpmd")) === null);
  ok("MP4 com entrada camm ou mebx, mesmo dizendo que é vídeo, é recusado", limparVideo(comFaixa("vide", "camm")) === null && limparVideo(comFaixa("vide", "mebx")) === null);
  ok("MP4 com faixa de texto ou de código de tempo é recusado", limparVideo(comFaixa("text", "tx3g")) === null && limparVideo(comFaixa("tmcd", "tmcd")) === null);
  ok("MP4 só com vídeo e som segue aceito", limparVideo(comFaixa("vide", "avc1"))?.tipo.ext === "mp4" && limparVideo(comFaixa("soun", "mp4a"))?.tipo.ext === "mp4");
  ok("HEIC (imagem com ftyp) não é vídeo", identificarVideo(caixa("ftyp", enc.encode("heic"), u32(0), enc.encode("mif1heic"))) === null);
  ok("bytes quaisquer e PNG não são vídeo", limparVideo(enc.encode("isto não é vídeo nenhum, só texto")) === null
    && limparVideo(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0])) === null);
}
{
  const vint = (n) => (n < 127 ? new Uint8Array([0x80 | n]) : new Uint8Array([0x40 | (n >> 8), n & 255]));
  const idB = (id) => {
    const b = [];
    for (let x = id; x > 0; x = Math.floor(x / 256)) b.unshift(x & 255);
    return new Uint8Array(b);
  };
  const el = (id, ...dados) => {
    const corpo = junta(...dados);
    return junta(idB(id), vint(corpo.length), corpo);
  };
  const DESCONHECIDO = new Uint8Array([0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
  const cabeca = (tipo) => el(0x1a45dfa3, el(0x4286, new Uint8Array([1])), el(0x4282, enc.encode(tipo)), el(0x4287, new Uint8Array([4])));
  const corpoDoSegmento = junta(
    el(0x1549a966, el(0x2ad7b1, u32(1000000).subarray(1)), el(0x4d80, enc.encode("Chrome")), el(0x4461, enc.encode("DATA-DA-GRAVACAO")), el(0x7ba9, enc.encode("Ato na praça da Sé"))),
    el(0x1654ae6b, el(0xae, el(0xd7, new Uint8Array([1])), el(0x536e, enc.encode("Camera de Fulana")), el(0x86, enc.encode("V_VP9")))),
    el(0x1254c367, el(0x7373, el(0x67c8, el(0x45a3, enc.encode("LOCATION")), el(0x4487, enc.encode("-23.55,-46.63"))))),
    junta(idB(0x1f43b675), DESCONHECIDO, el(0xe7, new Uint8Array([0])), el(0xa3, enc.encode("BLOCO-DE-VIDEO-1"))),
    junta(idB(0x1f43b675), DESCONHECIDO, el(0xe7, new Uint8Array([10])), el(0xa3, enc.encode("BLOCO-DE-VIDEO-2"))),
  );
  const webm = junta(cabeca("webm"), idB(0x18538067), DESCONHECIDO, corpoDoSegmento);
  const limpo = limparVideo(webm);
  ok("WEBM: reconhecido e limpo, do mesmo tamanho", limpo?.tipo.ext === "webm" && limpo.bytes.length === webm.length);
  ok("WEBM: sem data, título, nome da faixa nem etiquetas de lugar", limpo && !temTexto(limpo.bytes, "DATA-DA-GRAVACAO") && !temTexto(limpo.bytes, "praça")
    && !temTexto(limpo.bytes, "Fulana") && !temTexto(limpo.bytes, "-23.55") && !temTexto(limpo.bytes, "LOCATION"));
  ok("WEBM: os blocos e o resto do cabeçalho ficam", limpo && temTexto(limpo.bytes, "BLOCO-DE-VIDEO-1") && temTexto(limpo.bytes, "BLOCO-DE-VIDEO-2")
    && temTexto(limpo.bytes, "V_VP9") && temTexto(limpo.bytes, "Chrome"));
  ok("WEBM: limpar de novo não muda nada (o Void é válido)", limpo && Buffer.from(limparVideo(limpo.bytes)?.bytes ?? []).equals(Buffer.from(limpo.bytes)));
  const comTipo = (tipo) => junta(cabeca("webm"), idB(0x18538067), DESCONHECIDO,
    el(0x1654ae6b, el(0xae, el(0xd7, new Uint8Array([1])), el(0x83, new Uint8Array([tipo])), el(0x86, enc.encode("V_VP9")))),
    junta(idB(0x1f43b675), DESCONHECIDO, el(0xe7, new Uint8Array([0])), el(0xa3, enc.encode("BLOCO"))));
  ok("WEBM com faixa de vídeo ou de som segue aceito", limparVideo(comTipo(1))?.tipo.ext === "webm" && limparVideo(comTipo(2))?.tipo.ext === "webm");
  ok("WEBM com faixa de legenda ou de metadado é recusado", limparVideo(comTipo(0x11)) === null && limparVideo(comTipo(0x21)) === null);
  ok("Matroska geral (não webm) é recusado", limparVideo(junta(cabeca("matroska"), idB(0x18538067), DESCONHECIDO, corpoDoSegmento)) === null);
  ok("WEBM com elemento estranho no segmento é recusado", limparVideo(junta(cabeca("webm"), idB(0x18538067), DESCONHECIDO, el(0x4dbb, enc.encode("x")), corpoDoSegmento)) === null);
  ok("WEBM cortado no meio de um elemento é recusado", limparVideo(webm.subarray(0, webm.length - 3)) === null);
}

// ═══════════════════ 3. O lote e o interruptor ═══════════════════
{
  const chamadas = [];
  const lote = criarLote(async (ids) => (chamadas.push(ids), Object.fromEntries(ids.filter((i) => i !== "sem").map((i) => [i, `v-${i}`]))), 1);
  const ids = Array.from({ length: 70 }, (_, i) => `p${i}`);
  const r = await Promise.all([...ids, "p1", "sem"].map((i) => lote.pedir(i)));
  ok("o lote junta 71 pedidos em duas chamadas de até 50 ids, sem repetir", chamadas.length === 2 && chamadas.every((c) => c.length <= 50)
    && chamadas.flat().length === 71 && r[0] === "v-p0" && r[70] === "v-p1" && r[71] === null);
  const antes = chamadas.length;
  await lote.pedir("p3");
  ok("o que já veio não é pedido de novo", chamadas.length === antes);
  let falhar = true;
  const outro = criarLote(async (lista) => {
    if (falhar) throw new Error("caiu");
    return Object.fromEntries(lista.map((i) => [i, i]));
  }, 1);
  const primeiro = await outro.pedir("a");
  falhar = false;
  ok("falha da chamada: nulo, e o próximo pedido tenta de novo", primeiro === null && (await outro.pedir("a")) === "a");
}
ok("o vídeo só liga com o nome escrito (nunca por \"todos\"), e o sinal de menos desliga", [
  videoNoPostLigado(new Set(["todos"]), []) === false,
  videoNoPostLigado(new Set([RECURSO_DO_VIDEO]), []) === true,
  videoNoPostLigado(new Set([RECURSO_DO_VIDEO, `-${RECURSO_DO_VIDEO}`]), []) === false,
  videoNoPostLigado(new Set([RECURSO_DO_VIDEO]), [RECURSO_DO_VIDEO]) === true,
  videoNoPostLigado(new Set([]), [RECURSO_DO_VIDEO]) === false,
].every(Boolean));

// ═══════════════════ 4. O banco ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, aal: "aal2", ip: `198.51.100.${ip++ % 250}` });
const visitante = { papel: "anon", ip: "203.0.113.10" };
const zerar = () => dono("delete from interno.limites");

await espera("a migração instala sobre o install.sql", () => exec(sql));
await espera("de novo (idempotente)", () => exec(sql));
await espera("e uma terceira vez sem estrago", () => exec(sql));
await espera("a regra da porta não deixa nenhuma função aberta", async () => (await dono("select interno.alumia_trancar() as r")).rows[0].r, (r) => r.abertas.length === 0);
const PUBLICAS = ["rede_transcricao_aprovar", "rede_transcricao_tirar", "rede_transcricoes", "rede_video_reservar", "rede_video_ligar", "rede_video_tirar",
  "rede_video_dos_posts", "rede_video_caminho", "rede_video_pode", "rede_meusdados_voz_e_video"];
await espera("toda função pública nova passa pela porta", async () =>
  (await dono("select p.proname, p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any ($1)", [PUBLICAS])).rows,
(rs) => rs.length === PUBLICAS.length && rs.every((r) => /interno\.alumia_(porta|passa)\(\)/.test(r.prosrc)));
for (const t of tabelas) {
  await espera(`${t}: RLS ligada e nenhuma política`, async () => (await dono("select c.relrowsecurity as r, (select count(*)::int from pg_policies p where p.schemaname = 'interno' and p.tablename = $2) as n from pg_class c where c.oid = $1::regclass", [`interno.${t}`, t])).rows[0],
    (r) => r.r === true && r.n === 0);
}
await espera("as funções internas não abrem para anon nem para quem tem conta", async () =>
  (await dono(`select p.proname, has_function_privilege('anon', p.oid, 'execute') as a, has_function_privilege('authenticated', p.oid, 'execute') as b
               from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'interno' and (p.proname like 'rede\\_o12m\\_%' or p.proname = 'alumia_midia_uso')`)).rows,
(rs) => rs.length >= 7 && rs.every((r) => !r.a && !r.b));
await espera("as de escrita não abrem para o visitante", async () =>
  (await dono(`select p.proname, has_function_privilege('anon', p.oid, 'execute') as a from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = any (array['rede_transcricao_aprovar', 'rede_transcricao_tirar', 'rede_video_reservar', 'rede_video_ligar', 'rede_video_tirar', 'rede_meusdados_voz_e_video'])`)).rows,
(rs) => rs.length === 6 && rs.every((r) => !r.a));
ok("o depósito do vídeo não tem regra de envio para quem tem conta (só o servidor grava, com a chave de serviço)",
  !/for insert to authenticated/.test(sql) && !/create policy "rede_video_envio"/.test(sql) && sql.includes("drop function if exists public.rede_video_reservado(text)"));
await espera("a regra de envio de antes some do banco", async () => (await dono("select count(*)::int as n from pg_proc where proname = 'rede_video_reservado'")).rows[0].n, (n) => n === 0);
await espera("a fila de arquivos aceita o depósito do vídeo e continua aceitando os de antes", async () =>
  (await dono("select pg_get_constraintdef(oid) as d from pg_constraint where conrelid = 'interno.alumia_arquivos_a_apagar'::regclass and contype = 'c' and pg_get_constraintdef(oid) ~ 'deposito'")).rows,
(rs) => rs.length === 1 && ["rede-midia", "rede-stories", "rede-album", "rede-video"].every((d) => rs[0].d.includes(d)));
await espera("o interruptor está no catálogo, só pelo nome, e nasce desligado", async () =>
  (await dono("select c.so_pelo_nome, (select ligado from interno.recursos_vivos v where v.nome = c.nome) as ligado from interno.recursos_catalogo c where c.nome = $1", [RECURSO_DO_VIDEO])).rows,
(rs) => rs.length === 1 && rs[0].so_pelo_nome === true && rs[0].ligado === null);

const P = {};
const NOMES = ["ana", "bia", "caio", "menor", "fora"];
for (const nome of NOMES) {
  P[nome] = await criarUsuario(`${nome}@o12m.local`, `Pessoa ${nome}`);
  await rpc(como(P[nome]), "eu");
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of NOMES) {
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = $4, rede_consentimento = 1 where id = $1",
    [P[nome], `Codinome ${nome}`, `o12m_${nome}`, nome !== "menor"]);
  if (nome !== "fora") await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}
await dono("update auth.users set created_at = now() - interval '60 days'");
await dono(`insert into interno.rede_comunidades (slug, nome, categoria, tipo, publico_padrao) values ('o12m-fechada', 'Fechada do teste', 'lutas', 'fechada', 'membros') on conflict do nothing`);
await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, papel) values ('o12m-fechada', $1, 'membro')", [P.ana]);

const eu = (n) => como(P[n]);
const postar = (quem, texto, extra = {}) => rpc(eu(quem), "rede_publicar", { p: { texto, ...extra } });
const comAudio = async (quem, texto, extra = {}) => {
  const post = await postar(quem, texto, extra);
  await dono("insert into interno.rede_audios (post, caminho, tipo, duracao) values ($1, $2, 'audio/webm', 20)", [post.id, `${P[quem]}/${crypto.randomUUID()}.webm`]);
  return post.id;
};

// ── Transcrição ──
const raizA = await espera("Ana publica um post", () => postar("ana", "Assembleia da ocupação hoje às 19h"), (r) => r?.id);
const audioA = await comAudio("ana", "Áudio da assembleia");
const respostaB = await espera("Bia responde com áudio (áudio na resposta: a mesma regra do post)", async () => {
  const r = await postar("bia", "Minha fala sobre o áudio", { resposta_a: raizA.id });
  return comAudio("bia", "Resposta com áudio", { resposta_a: raizA.id }).then((id) => ({ r, id }));
}, (x) => x?.id);
await espera("sem aprovar, nada aparece", () => rpc(eu("bia"), "rede_transcricoes", { p_ids: [audioA] }), (r) => JSON.stringify(r) === "{}");
await recusa("post sem áudio não tem transcrição", () => rpc(eu("ana"), "rede_transcricao_aprovar", { p_post: raizA.id, p_texto: "texto", p_origem: "digitada" }), "sem_audio");
await recusa("quem não gravou não aprova", () => rpc(eu("bia"), "rede_transcricao_aprovar", { p_post: audioA, p_texto: "Inventado", p_origem: "digitada" }), "nao_encontrado");
await recusa("origem estranha", () => rpc(eu("ana"), "rede_transcricao_aprovar", { p_post: audioA, p_texto: "texto", p_origem: "servico" }), "invalido:origem");
await recusa("texto vazio", () => rpc(eu("ana"), "rede_transcricao_aprovar", { p_post: audioA, p_texto: "   ", p_origem: "digitada" }), "invalido:texto");
await recusa("telefone na transcrição", () => rpc(eu("ana"), "rede_transcricao_aprovar", { p_post: audioA, p_texto: "Liga no (11) 98888-1234", p_origem: "digitada" }), "dado_pessoal");
await recusa("xingamento de ódio na transcrição", () => rpc(eu("ana"), "rede_transcricao_aprovar", { p_post: audioA, p_texto: "Aquele macaco do síndico", p_origem: "digitada" }), "revisar");
await recusa("visitante não aprova", () => rpc(visitante, "rede_transcricao_aprovar", { p_post: audioA, p_texto: "x", p_origem: "digitada" }), "");
await espera("Ana aprova a transcrição ditada no aparelho", () => rpc(eu("ana"), "rede_transcricao_aprovar", { p_post: audioA, p_texto: "  A assembleia começa às 19h.  ", p_origem: "aparelho" }),
  (r) => r.texto === "A assembleia começa às 19h." && r.origem === "aparelho");
await espera("e agora quem pode ver o post lê", () => rpc(eu("bia"), "rede_transcricoes", { p_ids: [audioA, raizA.id] }),
  (r) => Object.keys(r).length === 1 && r[audioA].texto === "A assembleia começa às 19h.");
await espera("aprovar de novo troca o texto (uma por post)", async () => {
  await rpc(eu("ana"), "rede_transcricao_aprovar", { p_post: audioA, p_texto: "A assembleia começa às 19h30.", p_origem: "digitada" });
  return (await dono("select count(*)::int as n, max(texto) as t, max(origem) as o from interno.rede_audio_transcricoes where post = $1", [audioA])).rows[0];
}, (r) => r.n === 1 && r.t.endsWith("19h30.") && r.o === "digitada");
await espera("na resposta também", () => rpc(eu("bia"), "rede_transcricao_aprovar", { p_post: respostaB.id, p_texto: "Eu concordo com a pauta.", p_origem: "digitada" }), (r) => r.post === respostaB.id);
await espera("Bia tira a própria; tirar a de outra pessoa não faz nada", async () => [
  (await rpc(eu("bia"), "rede_transcricao_tirar", { p_post: audioA })).tirada,
  (await rpc(eu("bia"), "rede_transcricao_tirar", { p_post: respostaB.id })).tirada,
], (r) => r[0] === false && r[1] === true);
const fechadoA = await comAudio("ana", "Áudio só da comunidade fechada", { comunidade: "o12m-fechada" });
await rpc(eu("ana"), "rede_transcricao_aprovar", { p_post: fechadoA, p_texto: "Só para a comunidade.", p_origem: "digitada" });
await espera("quem não pode ver o post não lê a transcrição", () => rpc(eu("bia"), "rede_transcricoes", { p_ids: [fechadoA] }), (r) => JSON.stringify(r) === "{}");
await espera("a lista de ids passa de 50 só até 50", () => rpc(eu("bia"), "rede_transcricoes", { p_ids: [...Array.from({ length: 60 }, () => crypto.randomUUID()), audioA] }), (r) => JSON.stringify(r) === "{}");

// ── Vídeo ──
await zerar();
const reservar = (quem, extra = {}) => rpc(eu(quem), "rede_video_reservar", { p_ext: "mp4", p_bytes: 2_000_000, p_duracao_ms: 30_000, p_largura: 1280, p_altura: 720, p_som: true, ...extra });
await recusa("com o interruptor desligado, nada se reserva", () => reservar("ana"), "desligado");
await espera("com o interruptor desligado, nenhum vídeo aparece", () => rpc(eu("ana"), "rede_video_dos_posts", { p_ids: [raizA.id] }), (r) => JSON.stringify(r) === "{}");
await dono("insert into interno.recursos_vivos (nome, ligado) values ($1, true) on conflict (nome) do update set ligado = true", [RECURSO_DO_VIDEO]);
await recusa("menor de 18 não envia vídeo", () => reservar("menor"), "confirme_idade");
await recusa("sem consentimento da Rede, não envia", () => reservar("fora"), "consentimento");
await recusa("extensão estranha", () => reservar("ana", { p_ext: "mov" }), "invalido:arquivo");
await recusa("grande demais", () => reservar("ana", { p_bytes: LIMITES_DA_MIDIA.videoBytes + 1 }), "grande");
await recusa("longo demais", () => reservar("ana", { p_duracao_ms: 61_000 }), "longo");
await recusa("medida acima de 720p", () => reservar("ana", { p_largura: 1920 }), "invalido:video");
const r1 = await espera("Ana reserva o caminho na própria pasta", () => reservar("ana"), (r) => r.caminho === `${P.ana}/${r.id}.mp4`);
await espera("a reserva ainda não é de post: ninguém lê", () => rpc(eu("ana"), "rede_video_pode", { p_caminho: r1.caminho }), (r) => r === false);
const postV = await postar("ana", "Vídeo do ato de hoje");
const comFoto = await postar("ana", "Post com áudio já");
await dono("insert into interno.rede_audios (post, caminho, tipo, duracao) values ($1, $2, 'audio/webm', 10)", [comFoto.id, `${P.ana}/${crypto.randomUUID()}.webm`]);
await recusa("um tipo de mídia por post", () => rpc(eu("ana"), "rede_video_ligar", { p_post: comFoto.id, p_video: r1.id, p_alt: "" }), "invalido:midia");
await recusa("só no post de primeiro nível", () => rpc(eu("ana"), "rede_video_ligar", { p_post: respostaB.r.id, p_video: r1.id, p_alt: "" }), "nao_encontrado");
const respostaA = await postar("ana", "Resposta da Ana", { resposta_a: raizA.id });
await recusa("resposta da própria Ana também não leva vídeo", () => rpc(eu("ana"), "rede_video_ligar", { p_post: respostaA.id, p_video: r1.id, p_alt: "" }), "invalido:resposta");
await recusa("o vídeo de outra pessoa não entra", async () => {
  const rb = await reservar("bia");
  const pb = await postar("bia", "Post da Bia");
  return rpc(eu("bia"), "rede_video_ligar", { p_post: pb.id, p_video: r1.id, p_alt: "" }).finally(() => rb);
}, "invalido:video");
await recusa("descrição com CPF", () => rpc(eu("ana"), "rede_video_ligar", { p_post: postV.id, p_video: r1.id, p_alt: "Meu CPF 123.456.789-09" }), "dado_pessoal");
await espera("Ana liga o vídeo ao post, com a descrição", () => rpc(eu("ana"), "rede_video_ligar", { p_post: postV.id, p_video: r1.id, p_alt: "Faixas na porta da ocupação." }),
  (r) => r.id === r1.id && r.meu === true && r.alt === "Faixas na porta da ocupação." && !("caminho" in r));
await recusa("o mesmo vídeo não entra duas vezes", () => rpc(eu("ana"), "rede_video_ligar", { p_post: postV.id, p_video: r1.id, p_alt: "" }), "invalido:midia");
await espera("quem pode ver o post vê o vídeo, sem o caminho e sem dizer quem é a autora", () => rpc(eu("bia"), "rede_video_dos_posts", { p_ids: [postV.id, raizA.id] }),
  (r) => Object.keys(r).length === 1 && r[postV.id].meu === false && r[postV.id].duracao_ms === 30_000 && !("caminho" in r[postV.id]) && !("autor" in r[postV.id]));
await espera("o caminho só para quem pode ver, e a regra de leitura do depósito diz sim", async () => [
  await rpc(eu("bia"), "rede_video_caminho", { p_id: r1.id }),
  await rpc(eu("bia"), "rede_video_pode", { p_caminho: r1.caminho }),
], (r) => r[0].bucket === "rede-video" && r[0].caminho === r1.caminho && r[1] === true);
await dono("update interno.rede_posts set criado_em = now() - interval '20 minutes' where id = $1", [comFoto.id]);
await recusa("passou de 15 minutos depois de publicar", async () => {
  await dono("delete from interno.rede_audios where post = $1", [comFoto.id]);
  const r = await reservar("ana");
  return rpc(eu("ana"), "rede_video_ligar", { p_post: comFoto.id, p_video: r.id, p_alt: "" });
}, "tarde");
const vFechado = await espera("vídeo em post de comunidade fechada", async () => {
  const p = await postar("ana", "Vídeo só da comunidade", { comunidade: "o12m-fechada" });
  const r = await reservar("ana");
  await rpc(eu("ana"), "rede_video_ligar", { p_post: p.id, p_video: r.id, p_alt: "" });
  return { post: p.id, ...r };
}, (r) => r?.id);
await espera("quem não pode ver o post não vê o vídeo, nem o caminho, nem lê o arquivo", async () => [
  JSON.stringify(await rpc(eu("bia"), "rede_video_dos_posts", { p_ids: [vFechado.post] })),
  await rpc(eu("bia"), "rede_video_caminho", { p_id: vFechado.id }).then(() => "abriu", (e) => String(e.message)),
  await rpc(eu("bia"), "rede_video_pode", { p_caminho: vFechado.caminho }),
], (r) => r[0] === "{}" && r[1].includes("nao_encontrado") && r[2] === false);
await zerar();
await espera("no máximo 3 reservas abertas", async () => {
  await dono("delete from interno.rede_post_videos where autor = $1 and post is null", [P.caio]);
  for (let i = 0; i < 3; i++) await reservar("caio");
  return reservar("caio").then(() => "passou", (e) => String(e.message));
}, (r) => r.includes("muitos_pedidos"));
await espera("desligar o interruptor esconde tudo e não apaga nada", async () => {
  await dono("update interno.recursos_vivos set ligado = false where nome = $1", [RECURSO_DO_VIDEO]);
  const visto = await rpc(eu("bia"), "rede_video_dos_posts", { p_ids: [postV.id] });
  const pode = await rpc(eu("bia"), "rede_video_pode", { p_caminho: r1.caminho });
  const guardado = (await dono("select count(*)::int as n from interno.rede_post_videos where id = $1", [r1.id])).rows[0].n;
  await dono("update interno.recursos_vivos set ligado = true where nome = $1", [RECURSO_DO_VIDEO]);
  return [JSON.stringify(visto), pode, guardado];
}, (r) => r[0] === "{}" && r[1] === false && r[2] === 1);
await espera("a Alumia nova desligada no painel também desliga o vídeo", async () => {
  await dono("insert into interno.recursos_catalogo (nome, so_pelo_nome) values ('alumia-2', true) on conflict (nome) do nothing");
  await dono("insert into interno.recursos_vivos (nome, ligado) values ('alumia-2', false) on conflict (nome) do update set ligado = false");
  const x = (await dono("select interno.rede_o12m_video_ligado() as x")).rows[0].x;
  await dono("delete from interno.recursos_vivos where nome = 'alumia-2'");
  return [x, (await dono("select interno.rede_o12m_video_ligado() as x")).rows[0].x];
}, (r) => r[0] === false && r[1] === true);

// ── A fila, o post apagado, a faxina, a cota ──
const naFila = async (caminho) => (await dono("select count(*)::int as n from interno.alumia_arquivos_a_apagar where deposito = 'rede-video' and caminho = $1", [caminho])).rows[0].n;
await espera("Bia não tira o vídeo da Ana; Ana tira e o arquivo vai para a fila", async () => {
  const dela = (await rpc(eu("bia"), "rede_video_tirar", { p_post: postV.id })).tirado;
  const meu = (await rpc(eu("ana"), "rede_video_tirar", { p_post: postV.id })).tirado;
  return [dela, meu, await naFila(r1.caminho)];
}, (r) => r[0] === false && r[1] === true && r[2] === 1);
await espera("o post apagado leva o vídeo e a transcrição (e o arquivo vai para a fila)", async () => {
  await dono("update interno.rede_posts set apagado_em = now() where id = any ($1)", [[vFechado.post, audioA]]);
  return [
    (await dono("select count(*)::int as n from interno.rede_post_videos where post = $1", [vFechado.post])).rows[0].n,
    (await dono("select count(*)::int as n from interno.rede_audio_transcricoes where post = $1", [audioA])).rows[0].n,
    await naFila(vFechado.caminho),
  ];
}, (r) => r[0] === 0 && r[1] === 0 && r[2] === 1);
await espera("a faxina tira as reservas com mais de 24 horas (e só elas)", async () => {
  await dono("update interno.rede_post_videos set criado_em = now() - interval '25 hours' where autor = $1 and post is null", [P.caio]);
  const velhas = (await dono("select array_agg(caminho) as c from interno.rede_post_videos where autor = $1 and post is null", [P.caio])).rows[0].c;
  const n = (await dono("select interno.rede_o12m_faxina(100) as n")).rows[0].n;
  const naFilaTodas = (await Promise.all(velhas.map(naFila))).every((x) => x === 1);
  return [n, naFilaTodas];
}, (r) => r[0] === 3 && r[1] === true);
await espera("sem depósito (teste local), a cota de mídia conta zero e não quebra", async () => (await dono("select interno.alumia_midia_uso($1) as n", [P.ana])).rows[0].n, (n) => Number(n) === 0);

await espera("o painel do espaço mostra o depósito do vídeo (só totais)", async () => {
  await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao') on conflict do nothing", [P.caio]);
  return rpc(eu("caio"), "alumia_painel_espaco");
}, (r) => r?.depositos?.["rede-video"]?.arquivos === 0 && r.depositos["rede-album"] && r.depositos["rede-midia"]);

// ── Meus dados ──
const agora = () => Math.floor(Date.now() / 1000);
const comFator = (quem, funcao) =>
  banco.exclusivo(async () => {
    const claims = JSON.stringify({ role: "authenticated", sub: P[quem], aal: "aal2", amr: [{ method: "totp", timestamp: agora() - 30 }] });
    await banco.pg.query("select set_config('request.jwt.claims', $1, false), set_config('request.headers', $2, false)", [claims, JSON.stringify({ "x-forwarded-for": "198.51.100.200" })]);
    await banco.pg.exec("set role authenticated");
    try {
      return (await banco.pg.query(`select public.${funcao}() as r`)).rows[0]?.r ?? null;
    } finally {
      await banco.pg.exec("reset role");
    }
  });
await zerar();
const pMeu = await postar("bia", "Post da Bia com vídeo");
const rMeu = await reservar("bia");
await rpc(eu("bia"), "rede_video_ligar", { p_post: pMeu.id, p_video: rMeu.id, p_alt: "Descrição" });
await rpc(eu("bia"), "rede_transcricao_aprovar", { p_post: respostaB.id, p_texto: "Eu concordo com a pauta.", p_origem: "digitada" });
await recusa("meus dados sem o segundo fator recente: nada", () => rpc(eu("bia"), "rede_meusdados_voz_e_video"), "confirme_segundo_fator");
await espera("meus dados: os vídeos, as transcrições e os arquivos da própria pessoa", () => comFator("bia", "rede_meusdados_voz_e_video"),
  (r) => r.videos_dos_posts.length === 1 && r.videos_dos_posts[0].post === pMeu.id && r.transcricoes_dos_audios.length === 1
    && r.midias.length === 1 && r.midias[0].deposito === "rede-video" && r.midias[0].caminho.startsWith(`${P.bia}/`));
await espera("meus dados de outra pessoa não traz nada da Bia", () => comFator("caio", "rede_meusdados_voz_e_video"),
  (r) => r.videos_dos_posts.length === 0 && r.transcricoes_dos_audios.length === 0 && r.midias.length === 0);

// ── Sair da Alumia ──
await espera("sair só da Alumia leva vídeos, reservas e transcrições (e os arquivos vão para a fila)", async () => {
  await reservar("bia");
  await dono("select interno.alumia_md_sair_de_vez($1)", [P.bia]);
  return [
    (await dono("select count(*)::int as n from interno.rede_post_videos where autor = $1", [P.bia])).rows[0].n,
    (await dono("select count(*)::int as n from interno.rede_audio_transcricoes where post = $1", [respostaB.id])).rows[0].n,
    await naFila(rMeu.caminho),
  ];
}, (r) => r[0] === 0 && r[1] === 0 && r[2] === 1);

// ── Nada de endereço, nada de lista ──
await espera("nenhuma coluna nova guarda endereço de rede", async () =>
  (await dono("select table_name, column_name, data_type from information_schema.columns where table_schema = 'interno' and table_name = any($1)", [tabelas])).rows,
(rs) => rs.length > 0 && !rs.some((c) => c.data_type === "inet" || /(^|_)(ip|endereco|porta)($|_)/.test(c.column_name)));
await espera("nenhuma função pública nova devolve quem viu ou quem ouviu", async () =>
  (await dono("select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname ~ '^rede_(video|transcri)' and p.proname ~ '(quem|lista|pessoas|viu|ouviu|vistos)'")).rows,
(rs) => rs.length === 0);

// ═══════════════════ 5. A rota, os textos e as pastas ═══════════════════
{
  const rota = ler("app/api/rede/video/route.ts");
  ok("a rota do vídeo não lê endereço de rede e limpa antes de reservar", !/x-forwarded-for|x-real-ip|cf-connecting-ip|\.ip\b/i.test(rota)
    && rota.indexOf("limparVideo(cru)") > 0 && rota.indexOf("limparVideo(cru)") < rota.indexOf("rede_video_reservar"));
  const guarda = ler("lib/rede/midia/servidor.ts");
  ok("o vídeo limpo vai para o depósito pela chave de serviço, só no caminho que o banco reserva, e nunca com o token da pessoa",
    /SUPABASE_SERVICE_ROLE_KEY/.test(guarda) && guarda.includes("caminhoDoVideoOk(caminho)") && !rota.includes("guardarVideo(token") && rota.indexOf("guardarVideo(") > rota.indexOf("rede_video_reservar"));
  const telas = ["components/rede/midia", "lib/rede/midia"].flatMap((d) => fs.readdirSync(path.join(raiz, d)).map((f) => ler(`${d}/${f}`))).join("\n");
  ok("nenhum serviço de fora nas telas da voz e do vídeo (nem script, nem fonte, nem transcrição)", !/https?:\/\/(?!exemplo)/.test(telas.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "")));
  ok("o ditado só no modo local e a voz só local", /processLocally = true/.test(ler("lib/rede/midia/reconhecer.ts")) && /localService === true/.test(ler("lib/rede/midia/voz.ts")));
  const formas = (v, p = "", out = new Map()) => {
    if (typeof v === "string") out.set(p, (v.match(/\{[a-z]+\}/g) ?? []).sort().join());
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { if (k !== "_rascunho") formas(x, p ? `${p}.${k}` : k, out); }
    return out;
  };
  const pt = JSON.parse(ler("i18n/rede/midia/pt.json"));
  const base = formas(pt);
  for (const l of ["en", "es", "fr", "ru", "zh"]) {
    const outro = formas(JSON.parse(ler(`i18n/rede/midia/${l}.json`)));
    const dif = [...base].filter(([k, v]) => outro.get(k) !== v).map(([k]) => k).concat([...outro.keys()].filter((k) => !base.has(k)));
    ok(`textos em ${l}: as mesmas chaves e os mesmos espaços para preencher${dif.length ? ` (difere: ${dif.slice(0, 5).join(", ")})` : ""}`, dif.length === 0);
  }
  const todos = ["pt", "en", "es", "fr", "ru", "zh"].map((l) => ler(`i18n/rede/midia/${l}.json`)).join("\n");
  ok("nenhuma palavra proibida nos textos", !/diploma|universidade|algoritmo/i.test(todos));
  ok("todo código de erro do banco tem texto", ["desligado", "midia_cheia", "grande", "longo", "invalido", "nao_encontrado", "tarde", "sem_audio", "dado_pessoal", "revisar", "muitos_pedidos"]
    .every((c) => typeof pt.erros[c] === "string"));
}
// Só no ramo da frente: depois da junta (o fim da onda 12 já existe), quem junta mexe nesses arquivos de propósito.
if (!fs.existsSync(path.join(raiz, "supabase", "migracoes", "20261118-alumia-onda12-fim.sql"))) {
  let mudados = [];
  try {
    mudados = execFileSync("git", ["diff", "--name-only", "alumia-onda11"], { cwd: raiz, encoding: "utf8" }).split("\n").filter(Boolean);
    mudados = mudados.concat(execFileSync("git", ["ls-files", "--others", "--exclude-standard"], { cwd: raiz, encoding: "utf8" }).split("\n").filter(Boolean));
  } catch {
    mudados = null;
  }
  if (mudados) {
    const PROIBIDOS = [/^lib\/rede\/fediverso\//, /^app\/api\/fediverso\//, /^app\/\.well-known\//, /^components\/rede\/fediverso\//, /^lib\/rede\/chat\//, /^components\/rede\/chat\//,
      /^lib\/sigilo\.ts$/, /^supabase\/install\.sql$/, /^lib\/recursos\.ts$/, /^components\/rede\/registro\.tsx$/, /^components\/rede\/encaixes\.tsx$/, /^lib\/rede\/rotas-novas\.ts$/,
      /^lib\/interdicao\.ts$/, /^docs\/plano-2026-11\//, /fediverso.*\.sql$/, /chat.*\.sql$/];
    const fora = mudados.filter((f) => PROIBIDOS.some((r) => r.test(f)));
    ok(`a frente não mexe nos arquivos da outra faixa nem nos de quem junta${fora.length ? ` (${fora.join(", ")})` : ""}`, fora.length === 0);
  }
}

if (falhas.length) {
  console.error(`\n${falhas.length} falha(s), ${certos} certo(s):`);
  for (const f of falhas) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`voz e vídeo (onda 12, frente 12B): ${certos} conferências certas.`);
process.exit(0);
