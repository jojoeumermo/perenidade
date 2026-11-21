// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As provas formais da onda R3 (item 2.5; provas/LEIA-ME.md): confere, SEM rodar o ProVerif (ele roda em contêiner: provas/rodar.sh),
// que o que está no repositório é coerente:
//   - cada modelo (provas/*.pv e provas/controles/*.pv) tem a saída da última rodada em provas/resultados/, e o SHA-256 gravado na
//     saída é o do modelo de AGORA (mudou o modelo sem rodar de novo: falha);
//   - a saída bate com provas/esperado.json, propriedade por propriedade (verdadeira, falsa, não provada) e com o rastro do ataque;
//   - todo modelo principal dá só "verdadeira", menos os ataques registrados (que precisam do rastro do ataque); todo controle
//     (a defesa tirada de propósito) dá ataque com rastro: os modelos não são vazios;
//   - o ProVerif é o 2.05, a imagem do roteiro está fixada pelo resumo, e nenhum arquivo traz endereço, caminho do computador ou
//     nome de máquina (repositório público).
// Uso: node scripts/testar-r3-provas.mjs
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pasta = path.join(raiz, "provas");
const ler = (c) => fs.readFileSync(path.join(pasta, c), "utf8");

let certos = 0;
const falhas = [];
const ok = (nome, cond, detalhe = "") => (cond ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));

const modelos = [
  ...fs.readdirSync(pasta).filter((n) => n.endsWith(".pv")),
  ...fs.readdirSync(path.join(pasta, "controles")).filter((n) => n.endsWith(".pv")).map((n) => `controles/${n}`),
].sort();
const esperado = JSON.parse(ler("esperado.json"));
// Os ataques que ficam registrados de propósito (com o conserto apontado), fora dos controles.
const ATAQUES_REGISTRADOS = new Set(["voto-sigilo-servidor-ativo.pv"]);

ok("há os modelos do item 2.5 (remetente selado e caixas, grupos e passes, voto, sem internet, camada pós-quântica)", [
  "remetente-selado.pv", "remetente-selado-anonimato.pv", "caixas-nao-ligacao.pv", "grupos-epoca.pv", "grupos-anonimato.pv", "passes-cegos.pv",
  "voto-limiar.pv", "voto-sigilo.pv", "sem-internet.pv", "sem-internet-nao-ligacao.pv", "sem-internet-remetente.pv", "sem-internet-cobertura.pv", "camada-pq.pv",
].every((m) => modelos.includes(m)));
ok("cada modelo tem a sua linha em esperado.json, e nada sobra lá", modelos.every((m) => esperado[m]) && Object.keys(esperado).every((m) => modelos.includes(m)));

const resumo = (texto) => createHash("sha256").update(texto.replace(/\r\n/g, "\n")).digest("hex");
for (const m of modelos) {
  const arquivo = `resultados/${m.replace(/\.pv$/, ".txt")}`;
  if (!fs.existsSync(path.join(pasta, arquivo))) {
    falhas.push(`${m}: sem a saída da rodada (${arquivo}); rode sh provas/rodar.sh`);
    continue;
  }
  const saida = ler(arquivo).replace(/\r\n/g, "\n");
  const gravado = /^sha256: ([0-9a-f]{64})$/m.exec(saida)?.[1];
  ok(`${m}: a saída é do modelo de agora (o SHA-256 bate)`, gravado === resumo(ler(m)), `gravado ${gravado?.slice(0, 12)}, agora ${resumo(ler(m)).slice(0, 12)}`);
  ok(`${m}: rodado com o ProVerif 2.05`, /^verificador: Proverif 2\.05$/m.test(saida));
  const resultados = saida.split("\n").filter((l) => l.startsWith("RESULT")).map((l) => (l.endsWith("is true.") ? "verdadeira" : l.endsWith("is false.") ? "falsa" : /cannot be proved/.test(l) ? "nao_provada" : "?"));
  const e = esperado[m];
  ok(`${m}: os resultados batem com o esperado`, JSON.stringify(resultados) === JSON.stringify(e?.resultados), `${resultados} × ${e?.resultados}`);
  const rastro = /^A trace has been found\.$/m.test(saida);
  ok(`${m}: o rastro do ataque bate com o esperado`, rastro === e?.rastro_de_ataque);
  if (m.startsWith("controles/")) {
    ok(`${m}: o controle dá ataque de verdade (com rastro): o modelo não é vazio`, rastro && resultados.some((r) => r !== "verdadeira"));
  } else if (ATAQUES_REGISTRADOS.has(m)) {
    ok(`${m}: ataque registrado, com rastro, e o texto diz o conserto`, rastro && /ATAQUE ESPERADO/.test(e.o_que_prova) && /verificação individual/.test(ler(m)));
  } else {
    ok(`${m}: tudo provado`, resultados.length > 0 && resultados.every((r) => r === "verdadeira"));
  }
}

// O roteiro e o repositório público.
const roteiro = ler("rodar.sh");
ok("o roteiro fixa a imagem pelo resumo", /ocaml\/opam:debian-12-ocaml-5\.3@sha256:[0-9a-f]{64}/.test(roteiro));
ok("o roteiro instala o ProVerif na versão exata", /opam install -y proverif\.2\.05/.test(ler("rodar-dentro.sh")));
const linhaDoDocker = roteiro.split(/\r?\n/).find((l) => /docker run/.test(l)) ?? "";
ok("o roteiro não publica porta nem monta pasta (o contêiner some no fim)", /docker run --rm -i "\$IMAGEM"/.test(linhaDoDocker) && !/\s-p\s|--publish|\s-v\s|--volume|--privileged|--network/.test(linhaDoDocker.split('"$IMAGEM"')[0]));
const todos = [...modelos, "rodar.sh", "rodar-dentro.sh", "LEIA-ME.md", "esperado.json", ...modelos.map((m) => `resultados/${m.replace(/\.pv$/, ".txt")}`)].filter((c) => fs.existsSync(path.join(pasta, c)));
const vazados = todos.filter((c) => /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b|[A-Z]:\\|\/home\/(?!opam)|\/opt\/|lucia-vps|site-a|site-b/.test(ler(c)));
ok("nenhum arquivo das provas traz endereço, caminho do computador ou nome de máquina", vazados.length === 0, vazados.join(", "));
ok("há o LEIA-ME com o que cada modelo prova e como rodar", fs.existsSync(path.join(pasta, "LEIA-ME.md")) && /sh provas\/rodar\.sh/.test(ler("LEIA-ME.md")));

console.log(`${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
