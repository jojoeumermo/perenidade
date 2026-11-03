// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Roda em sequência todos os testes da Etapa 4 (Escola Lúcia Maria, docs/ESCOLA.md) cujo arquivo já existe, diz quais
// ainda não existem e falha se algum falhar. A lista é a reservada no package.json pelo E4-01: cada pacote só escreve o
// seu arquivo. O de Playwright (testar:entrada) precisa do site no ar e fica de fora daqui (roda à parte).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const raiz = path.resolve(import.meta.dirname, "..");
const pacote = JSON.parse(fs.readFileSync(path.join(raiz, "package.json"), "utf8"));

/** Os testes da etapa, na ordem das ondas (o pacote dono entre parênteses). */
export const TESTES_DA_ETAPA = [
  ["testar:escola", "E4-01"],
  ["testar:textos-escola", "E4-01"],
  ["testar:escola-banco", "E4-02"],
  ["testar:aula-viva", "E4-03"],
  ["testar:acesso", "E4-04"],
  ["testar:busca-viva", "E4-05"],
  ["testar:som", "E4-06"],
  ["testar:escola-cursos", "E4-07"],
  ["testar:escola-matricula", "E4-08"],
  ["testar:escola-campus", "E4-09"],
  ["testar:acompanhante", "E4-10"],
  ["testar:escola-vida", "E4-11"],
  ["testar:escola-organizacao", "E4-12"],
  ["testar:escola-avaliacao", "E4-13"],
  ["testar:escola-formatura", "E4-14"],
  ["testar:escola-turma", "E4-15"],
  ["testar:agentes", "E4-16"],
  ["testar:leveza", "E4-17"],
];

const rodados = [];
const faltam = [];
const falharam = [];
for (const [nome, dono] of TESTES_DA_ETAPA) {
  const comando = pacote.scripts[nome];
  if (!comando) {
    falharam.push(`${nome}: não está reservado no package.json`);
    continue;
  }
  // O arquivo do teste é o último "scripts/*.mjs" do comando (o primeiro é o carregar-ts.mjs).
  const arquivo = comando.match(/scripts\/[\w.-]+\.mjs/g)?.at(-1);
  if (!arquivo || !fs.existsSync(path.join(raiz, arquivo))) {
    faltam.push(`${nome} (${dono})`);
    continue;
  }
  console.log(`\n── ${nome} (${dono})`);
  // Um texto só (o nome vem da lista fixa acima): no Windows o npm é um .cmd e precisa do shell.
  const r = spawnSync(`npm run --silent ${nome}`, { cwd: raiz, stdio: "inherit", shell: true });
  rodados.push(nome);
  if (r.status !== 0) falharam.push(`${nome} (${dono}) saiu com ${r.status ?? r.signal}`);
}

console.log(`\nEtapa 4: ${rodados.length} testes rodados${faltam.length ? `; ainda sem arquivo: ${faltam.join(", ")}` : ""}.`);
console.log("testar:entrada (E4-04) usa o Playwright com o site no ar e roda à parte.");
if (falharam.length) {
  console.error(`\nFalharam:\n- ${falharam.join("\n- ")}`);
  process.exit(1);
}
