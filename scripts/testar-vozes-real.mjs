// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Teste de verdade das vozes naturais, nesta máquina, com os modelos já baixados (npm run vozes:baixar). Não roda no
// CI: precisa dos arquivos de public/vozes/. Para cada voz, mede o tempo para abrir o modelo e para a primeira frase
// (o "tempo para começar a falar"), a velocidade de geração (segundos de som por segundo de conta) e grava os WAV numa
// pasta para ouvir. Usa o mesmo motor do navegador (public/workers/voz-motor.js) e o mesmo normalizador do site.
//
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-vozes-real.mjs [pasta-de-saída]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { motorNoNode, wav } from "./vozes-baixar.mjs";
import { normalizar } from "../lib/vozes/normalizar.ts";

const raiz = path.resolve(import.meta.dirname, "..");
const manifestoArq = path.join(raiz, "public/vozes/vozes.json");
if (!fs.existsSync(manifestoArq)) {
  console.log("Sem public/vozes/vozes.json: rode npm run vozes:baixar antes.");
  process.exit(0);
}
const manifesto = JSON.parse(fs.readFileSync(manifestoArq, "utf8"));
const saida = process.argv[2] ?? path.join(os.tmpdir(), "lucia-vozes-teste");
fs.mkdirSync(saida, { recursive: true });

const FRASES = [
  "O produto custou R$ 162,00 e teve desconto de 19%.",
  "Em 1822, Dom Pedro I proclamou a independência do Brasil.",
  "Segundo o IBGE, a área é de 8,5 milhões de km².",
  "Você já parou para pensar nisso? Então vamos lá!",
];

let falhas = 0;
for (const voz of manifesto.vozes) {
  const inicio = performance.now();
  const motor = await motorNoNode(manifesto);
  await motor.carregar(voz);
  const aberto = performance.now();
  let primeira = 0;
  let somTotal = 0;
  let contaTotal = 0;
  const pedacos = [];
  for (const [i, frase] of FRASES.entries()) {
    const texto = normalizar(frase);
    const t0 = performance.now();
    const som = await motor.falar(texto, 1);
    const dt = (performance.now() - t0) / 1000;
    if (i === 0) primeira = performance.now() - inicio;
    const dur = som.pcm.length / som.taxa;
    somTotal += dur;
    contaTotal += dt;
    let rms = 0;
    for (const x of som.pcm) rms += x * x;
    rms = Math.sqrt(rms / Math.max(1, som.pcm.length));
    // Som de verdade: duração razoável para o tamanho da frase e volume acima do silêncio.
    const palavras = texto.split(/\s+/).length;
    const ok = dur > palavras * 0.18 && dur < palavras * 1.2 && rms > 0.01;
    if (!ok) falhas++;
    console.log(`${ok ? "ok  " : "FALHA"} ${voz.id} · ${dur.toFixed(1)} s de som em ${dt.toFixed(1)} s · "${texto}"`);
    pedacos.push(som.pcm, new Float32Array(Math.round(som.taxa * 0.35)));
    if (i === FRASES.length - 1) {
      const junto = new Float32Array(pedacos.reduce((s, p) => s + p.length, 0));
      let pos = 0;
      for (const p of pedacos) {
        junto.set(p, pos);
        pos += p.length;
      }
      fs.writeFileSync(path.join(saida, `${voz.id}.wav`), wav(junto, som.taxa));
    }
  }
  console.log(`== ${voz.id}: abre em ${((aberto - inicio) / 1000).toFixed(1)} s; começa a falar em ${(primeira / 1000).toFixed(1)} s; gera ${(somTotal / contaTotal).toFixed(2)}× o tempo real`);
}
console.log(`Áudios em ${saida}`);
process.exitCode = falhas ? 1 : 0;
