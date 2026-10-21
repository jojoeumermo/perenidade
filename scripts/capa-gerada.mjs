// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Reconhece a capa que o Project Gutenberg GERA quando a edição não tem capa de verdade: faixa branca em cima com o
// título e o autor, e embaixo um desenho geométrico de cores chapadas e vivas com "Project Gutenberg" no canto. Essas
// capas não são da obra: o acervo usa no lugar a capa tipográfica do próprio site. Capas de verdade (folhas de rosto
// escaneadas, encadernações, capas de editora) passam. Conferido à mão nas 640 capas de outubro de 2026: 426 geradas,
// nenhuma capa verdadeira marcada por engano.
//
// Uso: node scripts/capa-gerada.mjs --limpar   (apaga de public/capas as geradas e marca em content/capas.json)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

/** true quando a imagem é a capa automática do Gutenberg. */
export async function capaGerada(entrada) {
  const { data, info } = await sharp(entrada).removeAlpha().resize(120, 180, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const px = (x, y) => {
    const i = (y * w + x) * 3;
    return [data[i], data[i + 1], data[i + 2]];
  };
  // Faixa de cima: quanto é branco.
  let brancos = 0;
  let total = 0;
  for (let y = Math.floor(h * 0.04); y < h * 0.2; y++) {
    for (let x = 3; x < w - 3; x++) {
      const [r, g, b] = px(x, y);
      total++;
      if (r > 230 && g > 230 && b > 230) brancos++;
    }
  }
  // Faixa de baixo: a cor dominante e quanto dela é cor viva.
  const cores = new Map();
  let n = 0;
  let vivos = 0;
  for (let y = Math.floor(h * 0.45); y < h * 0.85; y++) {
    for (let x = 3; x < w - 3; x++) {
      const [r, g, b] = px(x, y);
      n++;
      if (Math.max(r, g, b) - Math.min(r, g, b) > 60) vivos++;
      const k = `${r >> 4},${g >> 4},${b >> 4}`;
      const c = cores.get(k) ?? { n: 0, r, g, b };
      c.n++;
      cores.set(k, c);
    }
  }
  const dom = [...cores.values()].sort((a, b) => b.n - a.n)[0];
  const croma = Math.max(dom.r, dom.g, dom.b) - Math.min(dom.r, dom.g, dom.b);
  const branco = brancos / total;
  const parte = dom.n / n;
  return (branco > 0.6 && ((parte > 0.3 && croma > 35) || vivos / n > 0.6)) || (branco > 0.5 && parte > 0.3 && croma > 100);
}

if (process.argv.includes("--limpar")) {
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const pasta = path.join(raiz, "public", "capas");
  const arquivoCreditos = path.join(raiz, "content", "capas.json");
  const creditos = JSON.parse(fs.readFileSync(arquivoCreditos, "utf8"));
  let tiradas = 0;
  for (const arq of fs.readdirSync(pasta).filter((f) => f.endsWith(".webp"))) {
    const id = arq.slice(0, -5);
    // Lido para a memória antes: no Windows o sharp segura o arquivo aberto e ele não sai.
    if (!(await capaGerada(fs.readFileSync(path.join(pasta, arq))))) continue;
    fs.rmSync(path.join(pasta, arq));
    creditos[id] = { ...(creditos[id] ?? {}), gerada: true };
    tiradas++;
  }
  fs.writeFileSync(arquivoCreditos, `${JSON.stringify(creditos, null, 2)}\n`);
  console.log(`${tiradas} capas geradas tiradas; ficam ${fs.readdirSync(pasta).filter((f) => f.endsWith(".webp")).length} capas de verdade.`);
}
