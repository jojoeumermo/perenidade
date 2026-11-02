// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Vídeos curtos (docs/enem/video/RELATORIO.md, seção "Como manter"). Três comandos:
//   npm run video:narrar [id|--todos]   gera a narração com o Kokoro na máquina de quem produz (NÃO roda no CI)
//   npm run video:legendar [id]         monta legendas WebVTT, a tabela de tempos (pronto.json) e o índice
//   npm run video:conferir [id]         confere roteiros, contas, clichês, ritmo, duração, áudio (hash), legendas e peso
// A narração precisa dos modelos (npm run vozes:baixar) e do ffmpeg (no PATH ou na variável FFMPEG).
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CORE_SCHEMA, load } from "js-yaml";
import { validarEdicao } from "../lib/enem.ts";
import { conferirTexto, expandir, palavras, validarRoteiro } from "../lib/videos/roteiro.ts";
import { normalizar } from "../lib/vozes/normalizar.ts";

const RAIZ = path.resolve(import.meta.dirname, "..");
const PASTA = path.join(RAIZ, "content/enem/videos");
const SAIDA = path.join(RAIZ, "public/videos-curtos");
const INDICE = path.join(RAIZ, "lib/videos/indice.json");
const yaml = (arq) => load(fs.readFileSync(arq, "utf8"), { schema: CORE_SCHEMA });

export const edicao = () => validarEdicao(yaml(path.join(RAIZ, "content/enem/edicao.yml")));
export const configDaVoz = () => yaml(path.join(PASTA, "voz.yml"));
export function lexico() {
  const base = yaml(path.join(RAIZ, "content/vozes/lexico.yml"));
  const extra = yaml(path.join(PASTA, "lexico.yml")) ?? {};
  return { siglas: { ...base.siglas, ...extra.siglas }, palavras: { ...base.palavras, ...extra.palavras } };
}
export const ids = () => fs.readdirSync(PASTA).filter((a) => a.endsWith(".yml") && !["voz.yml", "lexico.yml"].includes(a)).map((a) => a.slice(0, -4)).sort();

export function carregar(id) {
  const arq = `content/enem/videos/${id}.yml`;
  const { roteiro, erros } = validarRoteiro(yaml(path.join(RAIZ, arq)), arq);
  if (!roteiro) return { erros };
  if (roteiro.id !== id) return { erros: [`${arq}: o id deve ser igual ao nome do arquivo`] };
  try {
    const cenas = expandir(roteiro, edicao());
    return { roteiro, cenas, erros: conferirTexto(roteiro, cenas) };
  } catch (e) {
    return { erros: [e.message] };
  }
}

/** O que a voz lê, frase a frase, e o hash disso (com a voz e a velocidade): mudou a fala, o áudio é recusado. */
export function plano(roteiro, cenas) {
  const cfg = configDaVoz();
  const voz = cfg.vozes[roteiro.voz];
  const lx = lexico();
  const frases = cenas.flatMap((c) => c.frases.map((f) => ({ cena: c.id, texto: f.texto, ler: normalizar(f.texto, lx), pausa: f.pausa })));
  const hash = crypto.createHash("sha256").update(JSON.stringify({ voz: voz.id, velocidade: voz.velocidade, frases: frases.map((f) => [f.ler, f.pausa]) })).digest("hex");
  return { cfg, voz, frases, hash };
}

function ffmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return "ffmpeg";
  } catch {
    // imageio-ffmpeg (pip) traz um ffmpeg pronto.
    return execFileSync("python", ["-I", "-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"], { encoding: "utf8" }).trim();
  }
}

/** Tira o silêncio do começo e do fim da frase (o roteiro é que coloca a pausa, não o motor). */
function aparar(pcm, taxa) {
  const lim = 0.012;
  let a = 0;
  let b = pcm.length - 1;
  while (a < b && Math.abs(pcm[a]) < lim) a++;
  while (b > a && Math.abs(pcm[b]) < lim) b--;
  const folga = Math.round(taxa * 0.04);
  return pcm.slice(Math.max(0, a - folga), Math.min(pcm.length, b + folga));
}

async function narrar(lista) {
  const { motorNoNode, wav } = await import("./vozes-baixar.mjs");
  const manifesto = JSON.parse(fs.readFileSync(path.join(RAIZ, "public/vozes/vozes.json"), "utf8"));
  const bin = ffmpeg();
  const motores = {};
  for (const id of lista) {
    const { roteiro, cenas, erros } = carregar(id);
    if (erros.length) {
      console.log(erros.join("\n"));
      process.exitCode = 1;
      continue;
    }
    const { cfg, voz, frases, hash } = plano(roteiro, cenas);
    const lateral = path.join(SAIDA, id, "voz.json");
    if (fs.existsSync(lateral) && JSON.parse(fs.readFileSync(lateral, "utf8")).hash === hash && !process.argv.includes("--refazer")) {
      console.log(`${id}: áudio em dia`);
      continue;
    }
    if (!motores[voz.id]) {
      motores[voz.id] = await motorNoNode(manifesto);
      await motores[voz.id].carregar(manifesto.vozes.find((v) => v.id === voz.id));
    }
    const motor = motores[voz.id];
    const t0 = performance.now();
    const pedacos = [];
    const tempos = [];
    let pos = 0;
    let taxa = 24000;
    const avisos = [];
    for (const [i, f] of frases.entries()) {
      const som = await motor.falar(f.ler, voz.velocidade);
      taxa = som.taxa;
      const pcm = aparar(som.pcm, taxa);
      const dur = pcm.length / taxa;
      const n = f.ler.split(/\s+/).length;
      let pico = 0;
      for (const x of pcm) pico = Math.max(pico, Math.abs(x));
      // Tomada ruim: curta ou longa demais para o tamanho da frase, ou quase muda. Vai para a lista de ajuste.
      if (dur < n * 0.15 || dur > n * 0.9 || pico < 0.05) avisos.push(`frase ${i + 1} suspeita (${dur.toFixed(1)} s para ${n} palavras): "${f.texto}"`);
      tempos.push({ cena: f.cena, ini: Math.round((pos / taxa) * 1000), fim: Math.round(((pos + pcm.length) / taxa) * 1000), texto: f.texto });
      const pausa = new Float32Array(Math.round((taxa * (i === frases.length - 1 ? 1200 : f.pausa)) / 1000));
      pedacos.push(pcm, pausa);
      pos += pcm.length + pausa.length;
    }
    const junto = new Float32Array(pos);
    let k = 0;
    for (const p of pedacos) {
      junto.set(p, k);
      k += p.length;
    }
    const dir = path.join(SAIDA, id);
    fs.mkdirSync(dir, { recursive: true });
    const bruto = path.join(os.tmpdir(), `lucia-video-${id}.wav`);
    fs.writeFileSync(bruto, wav(junto, taxa));
    // Passa-alta suave, menos sibilância, compressão leve (2:1) e -16 LUFS com pico até -1,5 dBTP, mono.
    const filtro = "highpass=f=70,deesser,acompressor=ratio=2:threshold=-20dB:attack=10:release=150,loudnorm=I=-16:TP=-1.5:LRA=11";
    execFileSync(bin, ["-y", "-loglevel", "error", "-i", bruto, "-af", filtro, "-ac", "1", "-ar", "48000", "-c:a", "libopus", "-b:a", "32k", path.join(dir, "voz.webm")]);
    execFileSync(bin, ["-y", "-loglevel", "error", "-i", bruto, "-af", filtro, "-ac", "1", "-ar", "24000", "-c:a", "aac", "-b:a", "40k", "-movflags", "+faststart", path.join(dir, "voz.m4a")]);
    fs.rmSync(bruto);
    const duracao = Math.round((pos / taxa) * 1000);
    fs.writeFileSync(
      lateral,
      JSON.stringify({ hash, motor: cfg.motor, modelo: cfg.modelo, licenca: cfg.licenca, voz: voz.id, nome: voz.nome, velocidade: voz.velocidade, data: new Date().toISOString().slice(0, 10), duracao, frases: tempos }, null, 1) + "\n",
    );
    const seg = (performance.now() - t0) / 1000;
    console.log(`${id}: ${(duracao / 1000).toFixed(1)} s de fala em ${seg.toFixed(0)} s${avisos.length ? `\n  ${avisos.join("\n  ")}` : ""}`);
  }
}

/** Quebra em linhas de até 42 caracteres, enchendo cada linha (sem cortar palavra). */
export function linhas42(texto) {
  const linhas = [];
  let atual = "";
  for (const p of texto.split(" ")) {
    if ((atual + " " + p).trim().length > 42 && atual) {
      linhas.push(atual);
      atual = p;
    } else atual = (atual + " " + p).trim();
  }
  if (atual) linhas.push(atual);
  return linhas;
}

/** Cada legenda: no máximo duas linhas de 42 caracteres e de 1 a 7 s; corta de preferência depois de vírgula. */
export function legendasDe(frases) {
  const saida = [];
  for (const f of frases) {
    const dur = f.fim - f.ini;
    const maxPorTempo = Math.max(20, Math.floor((f.texto.length * 6500) / Math.max(1, dur)));
    const limite = Math.min(78, maxPorTempo);
    const blocos = [];
    let atual = "";
    for (const p of f.texto.split(" ")) {
      const junto = (atual + " " + p).trim();
      if (atual && (linhas42(junto).length > 2 || junto.length > limite)) {
        blocos.push(atual);
        atual = p;
      } else atual = junto;
      // Vírgula depois da metade do bloco: bom lugar para trocar de legenda.
      if (/[,;:]$/.test(atual) && atual.length > limite * 0.55) {
        blocos.push(atual);
        atual = "";
      }
    }
    if (atual) blocos.push(atual);
    const total = blocos.reduce((s, b) => s + b.length, 0);
    let ini = f.ini;
    blocos.forEach((b, i) => {
      const fim = i === blocos.length - 1 ? f.fim : Math.round(ini + (dur * b.length) / total);
      saida.push({ ini, fim: Math.max(fim, ini + 1000), texto: b });
      ini = fim;
    });
  }
  return saida;
}
const hora = (ms) => new Date(ms).toISOString().slice(11, 23);
export const vtt = (cues) => "WEBVTT\n\n" + cues.map((c, i) => `${i + 1}\n${hora(c.ini)} --> ${hora(c.fim)}\n${linhas42(c.texto).join("\n")}\n`).join("\n");

/** pronto.json: o que o tocador e o palco usam (cenas com tempo, marcas, frases e legendas). */
export function montarPronto(roteiro, cenas, voz) {
  const prontas = cenas.map((c) => {
    const fr = voz.frases.filter((f) => f.cena === c.id);
    const marcas = {};
    c.frases.forEach((f, i) => f.marcas.forEach((m) => (marcas[m] = fr[i]?.ini ?? 0)));
    return { id: c.id, visual: c.visual, ini: fr[0]?.ini ?? 0, fim: 0, marcas, frases: fr.map(({ ini, fim, texto }) => ({ ini, fim, texto })) };
  });
  prontas[0].ini = 0;
  prontas.forEach((c, i) => (c.fim = prontas[i + 1]?.ini ?? voz.duracao));
  return {
    id: roteiro.id,
    titulo: roteiro.titulo,
    aula: roteiro.aula,
    duracao: voz.duracao,
    narracao: `Narração: voz sintética (${voz.nome}, ${voz.modelo}, licença ${voz.licenca})`,
    cenas: prontas,
    legendas: legendasDe(voz.frases),
  };
}

function legendar(lista) {
  for (const id of lista) {
    const { roteiro, cenas, erros } = carregar(id);
    if (erros.length) {
      console.log(erros.join("\n"));
      process.exitCode = 1;
      continue;
    }
    const arq = path.join(SAIDA, id, "voz.json");
    if (!fs.existsSync(arq)) {
      console.log(`${id}: sem áudio; rode npm run video:narrar ${id}`);
      continue;
    }
    const voz = JSON.parse(fs.readFileSync(arq, "utf8"));
    if (voz.hash !== plano(roteiro, cenas).hash) {
      console.log(`${id}: a fala mudou depois do áudio; rode npm run video:narrar ${id}`);
      process.exitCode = 1;
      continue;
    }
    const pronto = montarPronto(roteiro, cenas, voz);
    fs.writeFileSync(path.join(SAIDA, id, "pronto.json"), JSON.stringify(pronto) + "\n");
    fs.writeFileSync(path.join(SAIDA, id, "legendas.vtt"), vtt(pronto.legendas));
    console.log(`${id}: legendas e tempos prontos`);
  }
  fs.writeFileSync(INDICE, JSON.stringify(indice(), null, 1) + "\n");
}

/** Índice pequeno que vai para o navegador: título, aula e duração de cada vídeo com áudio pronto. */
export function indice() {
  const saida = {};
  for (const id of ids()) {
    const arq = path.join(SAIDA, id, "voz.json");
    const { roteiro } = carregar(id);
    if (!roteiro || !fs.existsSync(arq)) continue;
    saida[id] = { titulo: roteiro.titulo, aula: roteiro.aula, segundos: Math.round(JSON.parse(fs.readFileSync(arq, "utf8")).duracao / 1000) };
  }
  return saida;
}

/** Todas as conferências. Devolve a lista de erros e um resumo. */
export function conferir(lista) {
  const erros = [];
  let bytes = 0;
  let ms = 0;
  const aberturas = new Map();
  for (const id of lista) {
    const { roteiro, cenas, erros: e } = carregar(id);
    erros.push(...e);
    if (!roteiro) continue;
    const abre = cenas[0].frases[0].texto.toLowerCase().split(/\s+/).slice(0, 4).join(" ");
    if (aberturas.has(abre)) erros.push(`${id}: abre igual a ${aberturas.get(abre)} ("${abre}")`);
    aberturas.set(abre, id);
    const dir = path.join(SAIDA, id);
    const arq = path.join(dir, "voz.json");
    if (!fs.existsSync(arq)) {
      erros.push(`${id}: sem áudio (npm run video:narrar ${id})`);
      continue;
    }
    const voz = JSON.parse(fs.readFileSync(arq, "utf8"));
    if (voz.hash !== plano(roteiro, cenas).hash) {
      erros.push(`${id}: a fala mudou (roteiro, edicao.yml, léxico ou voz) e o áudio ficou desatualizado; rode npm run video:narrar ${id}`);
      continue;
    }
    for (const a of ["voz.webm", "voz.m4a"]) {
      const f = path.join(dir, a);
      if (!fs.existsSync(f)) erros.push(`${id}: falta ${a}`);
      else {
        const b = fs.statSync(f).size;
        bytes += b;
        if (b > 700_000) erros.push(`${id}: ${a} com ${(b / 1e6).toFixed(2)} MB (máximo 0,7 MB)`);
      }
    }
    const s = voz.duracao / 1000;
    ms += voz.duracao;
    if (s < 40 || s > 125) erros.push(`${id}: ${s.toFixed(0)} s (de 45 a 120 s)`);
    const pps = cenas.flatMap((c) => c.frases).reduce((n, f) => n + palavras(f.texto), 0) / s;
    if (pps < 2.2 || pps > 3.1) erros.push(`${id}: ${pps.toFixed(2)} palavras por segundo (de 2,4 a 3,0)`);
    const esperado = JSON.stringify(montarPronto(roteiro, cenas, voz)) + "\n";
    const pronto = path.join(dir, "pronto.json");
    if (!fs.existsSync(pronto) || fs.readFileSync(pronto, "utf8") !== esperado) erros.push(`${id}: pronto.json desatualizado (npm run video:legendar ${id})`);
    const p = JSON.parse(esperado);
    for (const c of p.legendas) {
      if (c.fim - c.ini < 1000 || c.fim - c.ini > 7000) erros.push(`${id}: legenda de ${((c.fim - c.ini) / 1000).toFixed(1)} s ("${c.texto.slice(0, 30)}…")`);
      if (linhas42(c.texto).some((l) => l.length > 42)) erros.push(`${id}: legenda com linha acima de 42 caracteres`);
    }
    for (const c of p.cenas) for (const f of c.frases) if (f.fim > c.fim) erros.push(`${id}/${c.id}: a cena acaba antes da fala`);
    // Sincronia: toda marca cai no começo de uma legenda (diferença de no máximo 120 ms).
    for (const c of p.cenas) for (const [m, t] of Object.entries(c.marcas)) if (!p.legendas.some((l) => Math.abs(l.ini - t) <= 120)) erros.push(`${id}: a marca ${m} não casa com nenhuma legenda`);
    if (fs.readFileSync(path.join(dir, "legendas.vtt"), "utf8") !== vtt(p.legendas)) erros.push(`${id}: legendas.vtt desatualizado`);
  }
  if (lista.length === ids().length && fs.readFileSync(INDICE, "utf8") !== JSON.stringify(indice(), null, 1) + "\n") erros.push("lib/videos/indice.json desatualizado (npm run video:legendar)");
  if (bytes > 150e6) erros.push(`áudio total de ${(bytes / 1e6).toFixed(0)} MB passa de 150 MB: pare e proponha outra hospedagem`);
  return { erros, resumo: `${lista.length} vídeos, ${(ms / 60000).toFixed(1)} min, ${(bytes / 1e6).toFixed(1)} MB de áudio (webm + m4a)` };
}

if (import.meta.main) {
  const [cmd, alvo] = process.argv.slice(2);
  const lista = alvo && alvo !== "--todos" && !alvo.startsWith("--") ? [alvo] : ids();
  if (cmd === "narrar") await narrar(lista);
  else if (cmd === "legendar") legendar(lista);
  else if (cmd === "conferir") {
    const { erros, resumo } = conferir(lista);
    console.log(erros.length ? erros.join("\n") : "Vídeos curtos: tudo certo.");
    console.log(resumo);
    process.exitCode = erros.length ? 1 : 0;
  } else console.log("Uso: node scripts/video.mjs narrar|legendar|conferir [id]");
}
