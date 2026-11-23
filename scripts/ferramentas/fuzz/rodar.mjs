// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Roda um alvo de fuzzing por um tempo e guarda cada falha (com a semente e o caso, para refazer). O alvo roda numa thread à parte
// (trabalhador.mjs): o banco local (PGlite) não tem tempo-limite de consulta, então quem vigia é esta thread. Caso que passa do
// tempo vira "travou", a thread é encerrada e outra começa no lugar.
//
// Uso:
//   node --import ./scripts/carregar-ts.mjs scripts/ferramentas/fuzz/rodar.mjs <alvo> [--minutos 20] [--semente <hex>]
//        [--saida <pasta>] [--limite-ms 15000]
//   Alvos: ls scripts/ferramentas/fuzz/alvos. Sai com 1 se houve falha (travamento, erro interno, exceção sem tratamento).
//   A pasta de saída padrão fica na pasta temporária do sistema (alumia-fuzz/<alvo>), fora do projeto: cada falha num arquivo
//   JSON (com a semente e o caso), mais o resumo.json da rodada.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opcao = (nome, padrao) => {
  const i = args.indexOf(`--${nome}`);
  return i >= 0 ? args[i + 1] : padrao;
};
const alvo = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
const disponiveis = fs.readdirSync(path.join(aqui, "alvos")).filter((f) => f.endsWith(".mjs")).map((f) => f.slice(0, -4));
if (!alvo || !disponiveis.includes(alvo)) {
  console.error(`Alvo desconhecido. Alvos: ${disponiveis.join(", ")}`);
  process.exit(2);
}
const minutos = Number(opcao("minutos", "1"));
const limiteMs = Number(opcao("limite-ms", "15000"));
const saida = path.resolve(opcao("saida", path.join(os.tmpdir(), "alumia-fuzz", alvo)));
let semente = opcao("semente", crypto.randomBytes(16).toString("hex"));
fs.mkdirSync(saida, { recursive: true });
// As falhas da rodada anterior saem (cada rodada guarda só as suas; quem quiser guardar copia antes).
for (const f of fs.readdirSync(saida)) if (/^falha-[0-9a-f]{12}\.json$/.test(f)) fs.unlinkSync(path.join(saida, f));

const fim = Date.now() + minutos * 60_000;
const falhas = new Map();
let casos = 0;
let reinicios = 0;
const extras = [];

function guardarFalha(f) {
  const chave = f.assinatura;
  const ja = falhas.get(chave);
  if (ja) {
    ja.vezes++;
    return;
  }
  falhas.set(chave, { ...f, vezes: 1 });
  const nome = `falha-${crypto.createHash("sha256").update(chave).digest("hex").slice(0, 12)}.json`;
  fs.writeFileSync(path.join(saida, nome), JSON.stringify({ alvo, ...f }, null, 2));
  console.log(`[${alvo}] FALHA ${f.tipo}: ${f.assinatura}`);
}

async function rodarUmaThread() {
  return new Promise((resolver) => {
    const w = new Worker(path.join(aqui, "trabalhador.mjs"), { workerData: { alvo, semente, fim } });
    let ultimo = null;
    let desde = 0;
    let pronto = false;
    const vigia = setInterval(() => {
      if (pronto && ultimo && Date.now() - desde > limiteMs) {
        guardarFalha({ tipo: "travou", assinatura: `travou: ${ultimo.resumo ?? "caso"}`, semente, caso: ultimo.caso, ms: Date.now() - desde });
        clearInterval(vigia);
        w.terminate().then(() => resolver("travou"));
      }
    }, 500);
    w.on("message", (m) => {
      if (m.tipo === "pronto") pronto = true;
      else if (m.tipo === "caso") {
        ultimo = m;
        desde = Date.now();
      } else if (m.tipo === "feito") {
        casos++;
        ultimo = null;
      } else if (m.tipo === "falha") guardarFalha({ ...m.falha, semente });
      else if (m.tipo === "fim") {
        if (m.extra) extras.push(m.extra);
        clearInterval(vigia);
        resolver("fim");
      }
    });
    w.on("error", (erro) => {
      clearInterval(vigia);
      if (!pronto) {
        // Caiu antes de começar: é o ambiente, não um caso. Para tudo (repetir só gastaria o tempo da rodada).
        console.error(`[${alvo}] o alvo não ficou pronto: ${erro?.stack ?? erro}`);
        process.exit(2);
      }
      guardarFalha({ tipo: "derrubou", assinatura: `derrubou: ${String(erro?.message ?? erro).split("\n")[0].slice(0, 160)}`, semente, caso: ultimo?.caso ?? null, pilha: String(erro?.stack ?? "").slice(0, 2000) });
      resolver("derrubou");
    });
    w.on("exit", () => {
      clearInterval(vigia);
      resolver("saiu");
    });
  });
}

const inicio = Date.now();
while (Date.now() < fim) {
  const como = await rodarUmaThread();
  if (como === "fim" || Date.now() >= fim) break;
  reinicios++;
  // A thread nova recomeça com outra semente derivada (a anterior está guardada na falha).
  semente = crypto.createHash("sha256").update(semente).digest("hex").slice(0, 32);
}
const resumo = {
  alvo,
  minutos: Math.round(((Date.now() - inicio) / 60_000) * 10) / 10,
  casos,
  por_segundo: Math.round((casos / ((Date.now() - inicio) / 1000)) * 10) / 10,
  reinicios,
  falhas: [...falhas.values()].map(({ tipo, assinatura, vezes }) => ({ tipo, assinatura, vezes })),
  // O que o alvo conta de si (quantas funções ou rotas, quantas chegaram ao fim sem erro), da última thread.
  cobertura: extras.at(-1) ?? null,
};
fs.writeFileSync(path.join(saida, "resumo.json"), JSON.stringify(resumo, null, 2));
console.log(JSON.stringify(resumo, null, 2));
process.exit(falhas.size ? 1 : 0);
