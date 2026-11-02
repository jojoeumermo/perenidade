// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prepara as vozes naturais do "Ouvir a aula" em public/vozes/ (pasta fora do Git: os modelos têm dezenas de MB).
//   1. Copia do node_modules, nas versões fixadas no package.json, o onnxruntime-web (roda o modelo) e o espeak-ng do
//      piper_phonemize (texto → fonemas). Do espeak, só os dados do português entram (de 18 MB para cerca de 1 MB).
//   2. Baixa os modelos do Hugging Face numa revisão (commit) FIXA e confere o sha256 de cada arquivo.
//   3. Escreve public/vozes/vozes.json, a lista que o site lê. Sem ela, o site mostra só a voz do aparelho.
// Arquivo que já está lá e confere não é baixado de novo. Detalhes, licenças e o passo do servidor: docs/VOZES.md.
//
// Uso: npm run vozes:baixar                      → as vozes liberadas (hoje: as duas do Kokoro)
//      npm run vozes:baixar -- --com-bloqueadas  → também as de licença incerta (Piper), SÓ para teste local
//      npm run vozes:baixar -- --amostras        → também gera as amostras (public/vozes-amostras/, essas vão para o Git)
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DESTINO = path.join(RAIZ, "public", "vozes");
const AMOSTRAS = path.join(RAIZ, "public", "vozes-amostras");
const require = createRequire(import.meta.url);
const args = new Set(process.argv.slice(2));

// Revisões fixas. Trocar é mudar o commit e os sha256 aqui, rodar de novo, ouvir e testar.
const KOKORO = { repo: "onnx-community/Kokoro-82M-v1.0-ONNX", rev: "1939ad2a8e416c0acfeecc08a694d14ef25f2231" };
const PIPER = { repo: "rhasspy/piper-voices", rev: "b4e358ffcb232591bf73a540e70f7de528e4174a" };
const hf = (fonte, arquivo) => `https://huggingface.co/${fonte.repo}/resolve/${fonte.rev}/${arquivo}`;

const MODELO_KOKORO = { papel: "modelo", origem: hf(KOKORO, "onnx/model_quantized.onnx"), nome: "kokoro-1939ad2/model_quantized.onnx", bytes: 92361116, sha256: "fbae9257e1e05ffc727e951ef9b9c98418e6d79f1c9b6b13bd59f5c9028a1478" };
const VOCAB_KOKORO = { papel: "vocabulario", origem: hf(KOKORO, "tokenizer.json"), nome: "kokoro-1939ad2/tokenizer.json", bytes: 3497, sha256: "77a02c8e164413299b4b4c403b14f8e0e1c1b727db4d46a09d6327b861060a34" };

/**
 * As vozes. "liberada: false" fica de fora do site (só entra com --com-bloqueadas, para teste local).
 * Nomes neutros na tela ("Voz 1", "Voz 2"): nenhuma imita pessoa real. Licenças conferidas em 02/11/2026 (docs/VOZES.md).
 */
const VOZES = [
  {
    id: "kokoro-f",
    motor: "kokoro",
    numero: 1,
    genero: "f",
    webgpu: false,
    liberada: true,
    modelo: "Kokoro-82M v1.0 (pf_dora, 8 bits)",
    licenca: "Apache-2.0",
    arquivos: [MODELO_KOKORO, VOCAB_KOKORO, { papel: "estilo", origem: hf(KOKORO, "voices/pf_dora.bin"), nome: "kokoro-1939ad2/pf_dora.bin", bytes: 522240, sha256: "3da7b5b2d91847ebf5646f57631af6ececae3c29a89cd300f06edf9aa6cfe9ee" }],
  },
  {
    id: "kokoro-m",
    motor: "kokoro",
    numero: 2,
    genero: "m",
    webgpu: false,
    liberada: true,
    modelo: "Kokoro-82M v1.0 (pm_alex, 8 bits)",
    licenca: "Apache-2.0",
    arquivos: [MODELO_KOKORO, VOCAB_KOKORO, { papel: "estilo", origem: hf(KOKORO, "voices/pm_alex.bin"), nome: "kokoro-1939ad2/pm_alex.bin", bytes: 522240, sha256: "0175c753f59c54e7fd5a995bedef0c5ff2fb67e0043dd3dcb2ae74ec2acbeb2a" }],
  },
  {
    // Os dados de treino em português são CC0, mas o modelo foi ajustado a partir da voz inglesa "lessac", cuja base
    // (Blizzard 2013) só permite pesquisa, sem uso comercial. Licença incerta: fora do site até o dono decidir.
    id: "piper-m",
    motor: "piper",
    numero: 3,
    genero: "m",
    webgpu: false,
    liberada: false,
    modelo: "Piper pt_BR faber (medium)",
    licenca: "MIT (código); dados CC0; ajustado de en_US-lessac (base só para pesquisa)",
    arquivos: [
      { papel: "modelo", origem: hf(PIPER, "pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx"), nome: "piper-b4e358f/pt_BR-faber-medium.onnx", bytes: 63201294, sha256: "858555e3a064209c57088fe6bd70c4c3dc54d03eaa00c45d5ecaf43a33f95aa7" },
      { papel: "configuracao", origem: hf(PIPER, "pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx.json"), nome: "piper-b4e358f/pt_BR-faber-medium.onnx.json", bytes: 4855, sha256: "7e694de195ae3fc36dd732c445eb04fb49b649854893cb5506b978f0d50a1d6f" },
    ],
  },
];

/** Frase das amostras: curta, sem número (a amostra é gerada antes de qualquer normalização). */
export const FRASE_DA_AMOSTRA = "Olá! Esta é a voz que vai ler as aulas para você. Ela roda no seu aparelho, sem internet.";

const sha = (dados) => createHash("sha256").update(dados).digest("hex");
const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;

function versao(pacote) {
  return JSON.parse(fs.readFileSync(path.join(RAIZ, "node_modules", pacote, "package.json"), "utf8")).version;
}

/** Copia um arquivo do node_modules e devolve a entrada do manifesto. */
function copiar(de, nome) {
  const dados = fs.readFileSync(de);
  const alvo = path.join(DESTINO, nome);
  fs.mkdirSync(path.dirname(alvo), { recursive: true });
  if (!fs.existsSync(alvo) || sha(fs.readFileSync(alvo)) !== sha(dados)) fs.writeFileSync(alvo, dados);
  return { url: `/vozes/${nome}`, bytes: dados.length, sha256: sha(dados) };
}

/** onnxruntime-web: o pacote só de WebAssembly (11 MB) e o que também usa a placa de vídeo, WebGPU (22 MB). */
function prepararOrt() {
  const v = versao("onnxruntime-web");
  const dist = path.join(RAIZ, "node_modules/onnxruntime-web/dist");
  const pasta = `ort-${v}`;
  const um = (arquivo) => copiar(path.join(dist, arquivo), `${pasta}/${arquivo}`);
  um("ort-wasm-simd-threaded.mjs");
  um("ort-wasm-simd-threaded.jsep.mjs");
  return {
    versao: v,
    wasm: { js: um("ort.wasm.min.js").url, pasta: `/vozes/${pasta}/`, wasm: um("ort-wasm-simd-threaded.wasm") },
    webgpu: { js: um("ort.webgpu.min.js").url, pasta: `/vozes/${pasta}/`, wasm: um("ort-wasm-simd-threaded.jsep.wasm") },
  };
}

/**
 * espeak-ng (dentro do piper_phonemize): o pacote de dados traz os dicionários de mais de cem línguas (18 MB). Fica só o
 * que o português usa: as tabelas de fonemas, as entonações, as definições de voz e o pt_dict. O JS que lê o pacote
 * aprende os novos endereços (a lista "files" do loadPackage).
 */
function prepararEspeak() {
  const build = path.join(RAIZ, "node_modules/@diffusionstudio/piper-wasm/build");
  const js = fs.readFileSync(path.join(build, "piper_phonemize.js"), "utf8");
  const achado = js.match(/loadPackage\((\{"files":\[.*?\],"remote_package_size":\d+\})\)/s);
  if (!achado) throw new Error("piper_phonemize.js mudou: não achei a lista de arquivos do pacote de dados");
  const meta = JSON.parse(achado[1]);
  const dados = fs.readFileSync(path.join(build, "piper_phonemize.data"));
  const fica = (nome) => !/_dict$/.test(nome) || /\/pt_dict$/.test(nome);
  const partes = [];
  const files = [];
  let pos = 0;
  for (const f of meta.files) {
    if (!fica(f.filename)) continue;
    const pedaco = dados.subarray(f.start, f.end);
    files.push({ ...f, start: pos, end: pos + pedaco.length });
    partes.push(pedaco);
    pos += pedaco.length;
  }
  const novo = Buffer.concat(partes);
  const novoJs = js.replace(achado[1], JSON.stringify({ ...meta, files, remote_package_size: novo.length }));
  const pasta = `espeak-${sha(novo).slice(0, 8)}`;
  for (const antigo of fs.existsSync(DESTINO) ? fs.readdirSync(DESTINO) : []) if (/^espeak-/.test(antigo) && antigo !== pasta) fs.rmSync(path.join(DESTINO, antigo), { recursive: true });
  fs.mkdirSync(path.join(DESTINO, pasta), { recursive: true });
  fs.writeFileSync(path.join(DESTINO, pasta, "piper_phonemize.js"), novoJs);
  fs.writeFileSync(path.join(DESTINO, pasta, "piper_phonemize.data"), novo);
  return {
    js: `/vozes/${pasta}/piper_phonemize.js`,
    wasm: copiar(path.join(build, "piper_phonemize.wasm"), `${pasta}/piper_phonemize.wasm`),
    dados: { url: `/vozes/${pasta}/piper_phonemize.data`, bytes: novo.length, sha256: sha(novo) },
  };
}

async function baixar(arquivo) {
  const alvo = path.join(DESTINO, arquivo.nome);
  if (fs.existsSync(alvo) && fs.statSync(alvo).size === arquivo.bytes && sha(fs.readFileSync(alvo)) === arquivo.sha256) return;
  console.log(`[vozes] baixando ${arquivo.nome} (${mb(arquivo.bytes)})`);
  const resposta = await fetch(arquivo.origem);
  if (!resposta.ok) throw new Error(`${arquivo.origem}: ${resposta.status}`);
  const dados = Buffer.from(await resposta.arrayBuffer());
  if (sha(dados) !== arquivo.sha256) throw new Error(`${arquivo.nome}: o sha256 não confere (esperado ${arquivo.sha256}, veio ${sha(dados)})`);
  fs.mkdirSync(path.dirname(alvo), { recursive: true });
  fs.writeFileSync(`${alvo}.parcial`, dados);
  fs.renameSync(`${alvo}.parcial`, alvo);
}

/** Som em WAV (PCM 16 bits, mono), com o volume acertado para o pico ficar em -1 dB. */
export function wav(pcm, taxa) {
  let pico = 0;
  for (const x of pcm) pico = Math.max(pico, Math.abs(x));
  const ganho = pico > 0 ? 0.89 / pico : 1;
  const b = Buffer.alloc(44 + pcm.length * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + pcm.length * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(taxa, 24);
  b.writeUInt32LE(taxa * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(pcm.length * 2, 40);
  for (let i = 0; i < pcm.length; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(pcm[i] * ganho * 32767))), 44 + i * 2);
  return b;
}

/** O motor do navegador (public/workers/voz-motor.js), aqui no Node, lendo os arquivos de public/. */
export async function motorNoNode(manifesto) {
  const ort = await import("onnxruntime-web");
  ort.env.wasm.numThreads = Number(process.env.VOZES_LINHAS ?? 1);
  const { criarMotor } = require(path.join(RAIZ, "public/workers/voz-motor.js"));
  const criarFonemas = require(path.join(RAIZ, "public", manifesto.fonemas.js));
  const ler = async (arquivo) => {
    const b = fs.readFileSync(path.join(RAIZ, "public", arquivo.url));
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  };
  return criarMotor({ ort, buscar: ler, criarFonemas, fonemas: manifesto.fonemas });
}

async function principal() {
  fs.mkdirSync(DESTINO, { recursive: true });
  const ort = prepararOrt();
  const fonemas = prepararEspeak();
  const escolhidas = VOZES.filter((v) => v.liberada || args.has("--com-bloqueadas"));
  for (const voz of escolhidas) for (const arquivo of voz.arquivos) await baixar(arquivo);
  const comum = ort.wasm.wasm.bytes + fonemas.wasm.bytes + fonemas.dados.bytes;
  const manifesto = {
    formato: 1,
    gerado: new Date().toISOString().slice(0, 10),
    ort,
    fonemas,
    vozes: escolhidas.map((v) => ({
      id: v.id,
      motor: v.motor,
      numero: v.numero,
      genero: v.genero,
      webgpu: v.webgpu,
      espeak: "pt-br",
      modelo: v.modelo,
      licenca: v.licenca,
      ...(v.liberada ? {} : { bloqueada: true }),
      amostra: fs.existsSync(path.join(AMOSTRAS, `${v.id}.wav`)) ? `/vozes-amostras/${v.id}.wav` : null,
      bytes: comum + v.arquivos.reduce((s, a) => s + a.bytes, 0),
      arquivos: v.arquivos.map((a) => ({ papel: a.papel, url: `/vozes/${a.nome}`, bytes: a.bytes, sha256: a.sha256 })),
    })),
  };
  fs.writeFileSync(path.join(DESTINO, "vozes.json"), JSON.stringify(manifesto, null, 1));
  for (const v of manifesto.vozes) console.log(`[vozes] ${v.id}: ${mb(v.bytes)}${v.bloqueada ? " (bloqueada: só teste local)" : ""}`);

  if (args.has("--amostras")) {
    fs.mkdirSync(AMOSTRAS, { recursive: true });
    for (const v of manifesto.vozes) {
      if (v.bloqueada) continue;
      const motor = await motorNoNode(manifesto);
      await motor.carregar(v);
      const som = await motor.falar(FRASE_DA_AMOSTRA, 1);
      fs.writeFileSync(path.join(AMOSTRAS, `${v.id}.wav`), wav(som.pcm, som.taxa));
      v.amostra = `/vozes-amostras/${v.id}.wav`;
      console.log(`[vozes] amostra ${v.id}.wav (${(som.pcm.length / som.taxa).toFixed(1)} s)`);
    }
    fs.writeFileSync(path.join(DESTINO, "vozes.json"), JSON.stringify(manifesto, null, 1));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal().catch((erro) => {
    // Sem internet ou com o Hugging Face fora do ar, o site continua montando: só fica sem as vozes naturais.
    console.warn(`[vozes] ${erro.message}. O site segue com a voz do aparelho.`);
    process.exitCode = args.has("--estrito") ? 1 : 0;
  });
}
