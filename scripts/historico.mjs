// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O histórico do acervo (linha do tempo da página inicial, Histórico do acervo, data de cada página no mapa do site)
// vem do Git. Na Vercel o clone é raso e só traz os últimos registros; este roteiro grava o histórico inteiro, já
// resumido (data, arquivo e se foi criado, mudado ou apagado; sem autor, e-mail nem mensagem), em historico/acervo.json.
// O site junta esse arquivo com o que o clone raso enxerga. Roda na rotina do GitHub (.github/workflows/historico.yml),
// que tem o clone completo, a cada mudança em content/.
//
// Uso: node scripts/historico.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const raso = execFileSync("git", ["rev-parse", "--is-shallow-repository"], { cwd: raiz, encoding: "utf8" }).trim() === "true";
if (raso) {
  console.error("O clone é raso: o histórico gravado ficaria incompleto. Rode num clone completo (fetch-depth: 0).");
  process.exit(1);
}
const saida = execFileSync("git", ["-c", "core.quotepath=off", "log", "--no-merges", "--date=short", "--name-status", "--pretty=format:%x1e%H%x1f%ad", "--", "content"], { cwd: raiz, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
const registros = saida
  .split("\x1e")
  .filter(Boolean)
  .map((entrada) => {
    const [cabeca, ...linhas] = entrada.split("\n");
    const [hash, date] = cabeca.split("\x1f");
    const files = linhas
      .map((linha) => linha.split("\t"))
      .filter((colunas) => colunas.length >= 2)
      .map(([codigo, ...caminhos]) => ({ status: codigo[0] === "A" || codigo[0] === "C" ? "A" : codigo[0] === "D" ? "D" : "M", path: caminhos[caminhos.length - 1] }));
    return { hash, date, files };
  });
const pasta = path.join(raiz, "historico");
fs.mkdirSync(pasta, { recursive: true });
fs.writeFileSync(path.join(pasta, "acervo.json"), `${JSON.stringify(registros)}\n`);
console.log(`${registros.length} registros gravados em historico/acervo.json.`);
