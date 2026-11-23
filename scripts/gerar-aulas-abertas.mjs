// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As trilhas que moram na Escola (P5, B2): as de Teoria revolucionária e de Lutas do povo, lidas de content/trilhas/*/_trilha.md
// (o campo "area"), em lib/escola/aulas-abertas.json. O proxy (proxy.ts) e os links do site usam esse arquivo para mandar os
// endereços antigos (/estantes, /trilhas) à Escola sem ler o disco a cada pedido. Roda antes da montagem (prebuild);
// `npm run testar:escola-aulas-abertas` confere que o arquivo guardado bate com o conteúdo.
// Uso: node scripts/gerar-aulas-abertas.mjs [--conferir]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SAIDA = path.join(raiz, "lib/escola/aulas-abertas.json");

/** As disciplinas dos dois grupos, na ordem de lib/areas.ts (lida do próprio arquivo, sem importar TypeScript). */
export function areasDaEscola() {
  const fonte = fs.readFileSync(path.join(raiz, "lib/areas.ts"), "utf8");
  const grupo = (id) => {
    const m = new RegExp(String.raw`id: "${id}",\s*areas: \[([^\]]*)\]`).exec(fonte);
    if (!m) throw new Error(`grupo "${id}" não achado em lib/areas.ts`);
    return [...m[1].matchAll(/"([a-z0-9-]+)"/g)].map((x) => x[1]);
  };
  return { teoria: grupo("teoria"), lutas: grupo("lutas") };
}

export function montar() {
  const grupos = areasDaEscola();
  const areas = [...grupos.teoria, ...grupos.lutas];
  const trilhas = {};
  const pasta = path.join(raiz, "content/trilhas");
  for (const nome of fs.readdirSync(pasta).sort()) {
    const arquivo = path.join(pasta, nome, "_trilha.md");
    if (!fs.existsSync(arquivo)) continue;
    const cabeca = /^---\r?\n([\s\S]*?)\r?\n---/.exec(fs.readFileSync(arquivo, "utf8"))?.[1] ?? "";
    if (/^ativo:\s*false\s*$/m.test(cabeca)) continue;
    const area = /^area:\s*["']?([a-z0-9-]+)["']?\s*$/m.exec(cabeca)?.[1];
    if (area && areas.includes(area)) trilhas[nome] = area;
  }
  return { grupos, trilhas };
}

const texto = (dados) => `${JSON.stringify(dados, null, 2)}\n`;

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const novo = texto(montar());
  if (process.argv.includes("--conferir")) {
    const velho = fs.existsSync(SAIDA) ? fs.readFileSync(SAIDA, "utf8").replace(/\r\n/g, "\n") : "";
    if (velho !== novo) {
      console.error("lib/escola/aulas-abertas.json está desatualizado: rode node scripts/gerar-aulas-abertas.mjs");
      process.exit(1);
    }
    console.log("aulas-abertas: em dia");
  } else {
    fs.writeFileSync(SAIDA, novo);
    console.log(`aulas-abertas: ${Object.keys(montar().trilhas).length} trilhas`);
  }
}
