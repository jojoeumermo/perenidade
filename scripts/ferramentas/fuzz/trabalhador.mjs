// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A thread que roda um alvo de fuzzing (chamada por rodar.mjs). Prepara o alvo uma vez, e então: gera um caso (às vezes do zero,
// quase sempre mutando um caso bom do corpus), avisa a thread de cima ANTES de rodar (para ela saber qual caso travou), roda e
// devolve a falha, se houver. Casos que andaram por um caminho novo (assinatura de resultado nova) entram no corpus.
import { parentPort, workerData } from "node:worker_threads";
import { criarSorteio, mutar } from "./gerador.mjs";

const { alvo: nome, semente, fim } = workerData;
const alvo = await import(`./alvos/${nome}.mjs`);
const r = criarSorteio(semente);
const ctx = await alvo.preparar();
parentPort.postMessage({ tipo: "pronto" });

const corpus = [...alvo.sementes(ctx)];
const vistos = new Set();
while (Date.now() < fim) {
  const base = r.escolher(corpus);
  let caso = r.chance(0.15) ? alvo.gerar(r, ctx) : mutar(r, r.chance(0.3) ? mutar(r, base) : base);
  if (alvo.completar) caso = alvo.completar(caso, r, ctx);
  parentPort.postMessage({ tipo: "caso", caso, resumo: alvo.resumir?.(caso) });
  let resultado;
  try {
    resultado = await alvo.executar(caso, ctx);
  } catch (erro) {
    resultado = { falha: { tipo: "excecao", assinatura: `exceção: ${String(erro?.message ?? erro).split("\n")[0].slice(0, 160)}`, caso, pilha: String(erro?.stack ?? "").slice(0, 2000) } };
  }
  if (resultado?.falha) parentPort.postMessage({ tipo: "falha", falha: { caso, ...resultado.falha } });
  // Caminho novo (pela assinatura que o alvo devolve): o caso entra no corpus, até um teto.
  const marca = resultado?.caminho;
  if (marca && !vistos.has(marca)) {
    vistos.add(marca);
    if (corpus.length < 2000) corpus.push(caso);
  }
  parentPort.postMessage({ tipo: "feito" });
}
const extra = alvo.relatorio?.(ctx) ?? null;
await alvo.encerrar?.(ctx);
parentPort.postMessage({ tipo: "fim", extra });
