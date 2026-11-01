// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Liga as questões oficiais classificadas às aulas do percurso que ensinam o mesmo tópico: para cada questão com
// `topico` (ou só `objeto`), acrescenta em `aulas` as aulas de trilhas enem-* cujo mapa curricular
// (content/curriculo/enem-*.yml, campo `objetos`) cita aquele tópico. Só acrescenta; nunca tira. Mexe só na linha
// `aulas: [...]` de cada questão, para não mudar o resto do arquivo. Uso: npm run ligar:enem
import fs from "node:fs";
import path from "node:path";
import { carregarMapas, raiz } from "./enem-dados.mjs";

const porTopico = new Map();
for (const [trilha, mapa] of carregarMapas()) {
  if (!trilha.startsWith("enem-") || trilha === "enem-reta-final") continue;
  for (const [aula, m] of Object.entries(mapa.aulas)) for (const id of m.objetos) porTopico.set(id, [...(porTopico.get(id) ?? []), `${trilha}/${aula}`]);
}
const pasta = path.join(raiz, "content/enem/questoes-oficiais");
let ligadas = 0;
for (const nome of fs.readdirSync(pasta).filter((n) => n.endsWith(".yml"))) {
  const linhas = fs.readFileSync(path.join(pasta, nome), "utf8").split("\n");
  let topico = null;
  let objeto = null;
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    if (/^  - id: /.test(l)) (topico = null), (objeto = null);
    const t = /^    topico: (\S+)/.exec(l);
    if (t) topico = t[1];
    const o = /^    objeto: (\S+)/.exec(l);
    if (o) objeto = o[1];
    const a = /^    aulas: \[(.*)\]\s*$/.exec(l);
    if (!a) continue;
    const atuais = a[1].split(",").map((x) => x.trim()).filter(Boolean);
    const novas = [...new Set([...(topico ? porTopico.get(topico) ?? [] : porTopico.get(objeto) ?? [])])].filter((x) => !atuais.includes(x));
    if (novas.length) {
      linhas[i] = `    aulas: [${[...atuais, ...novas].join(", ")}]`;
      ligadas += novas.length;
    }
  }
  fs.writeFileSync(path.join(pasta, nome), linhas.join("\n"));
}
console.log(`questões oficiais: ${ligadas} ligações novas às aulas do percurso`);
