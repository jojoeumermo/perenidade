// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Refaz content/enem/incidencia.yml: quantas questões oficiais caem em cada objeto de conhecimento e em cada
// habilidade, por área, nas últimas 10 edições classificadas em content/enem/questoes-oficiais. É contagem nossa,
// feita só a partir das classificações (nada estimado). O método está em docs/ENEM.md.
//
//   npm run incidencia:enem                grava o arquivo
//   npm run incidencia:enem -- --conferir  só confere se o arquivo está em dia (falha se não estiver)
import fs from "node:fs";
import path from "node:path";
import { raiz, textoDaIncidencia } from "./enem-dados.mjs";

const arquivo = path.join(raiz, "content/enem/incidencia.yml");
const novo = textoDaIncidencia();
if (process.argv.includes("--conferir")) {
  const atual = fs.existsSync(arquivo) ? fs.readFileSync(arquivo, "utf8") : "";
  if (atual !== novo) {
    console.log("content/enem/incidencia.yml está desatualizado: rode npm run incidencia:enem");
    process.exit(1);
  }
  console.log("incidência: em dia");
} else {
  fs.writeFileSync(arquivo, novo);
  console.log("content/enem/incidencia.yml gravado");
}
