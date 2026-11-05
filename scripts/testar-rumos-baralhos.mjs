// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere os 8 baralhos novos do Rumos (Etapa 5): arquivos, tamanho, fontes oficiais com link, aulas que existem,
// palavras proibidas e registro em lib/laboratorios.ts e na página de jogos. A validação do motor fica em testar:jogos.
// Uso: npm run testar:rumos-baralhos
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let ok = 0;
const falhas = [];
const conferir = (nome, cond, detalhe = "") => (cond ? ok++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
const ler = (rel) => fs.readFileSync(path.join(raiz, rel), "utf8");

const IDS = ["eletricista-autonomo", "costureira-e-cooperativa", "desenvolvedor-de-software-livre", "sindicato-de-bairro", "radio-comunitaria", "cursinho-popular", "reforma-agraria-e-mutirao", "coletivo-de-artes-e-hip-hop"];
const lab = ler("lib/laboratorios.ts");
const pagina = ler("app/[lang]/jogos/page.tsx");
const conteudo = (b) => JSON.stringify(b);

for (const id of IDS) {
  const rel = `content/jogos/rumos-${id}.json`;
  conferir(`${id}: arquivo existe`, fs.existsSync(path.join(raiz, rel)));
  if (!fs.existsSync(path.join(raiz, rel))) continue;
  const b = JSON.parse(ler(rel));
  conferir(`${id}: id bate com o arquivo`, b.id === id);
  conferir(`${id}: 4 medidores`, b.medidores?.length === 4);
  conferir(`${id}: ao menos 12 cartas`, b.cartas?.length >= 12, String(b.cartas?.length));
  conferir(`${id}: registrado em lib/laboratorios.ts`, lab.includes(`"${id}"`));
  conferir(`${id}: importado na página de jogos`, pagina.includes(`rumos-${id}.json`) && pagina.includes(`"${id}":`));
  conferir(`${id}: sem "universidade" nem "diploma"`, !/universidade|diploma/i.test(conteudo(b)));
  const semFonte = b.cartas.filter((c) => !c.historia?.fonte?.titulo || !c.historia?.fonte?.autor);
  conferir(`${id}: toda carta com fonte`, semFonte.length === 0, semFonte.map((c) => c.id).join(", "));
  const semLink = b.cartas.filter((c) => !/^https:\/\//.test(c.historia?.fonte?.url ?? ""));
  conferir(`${id}: toda fonte com link https`, semLink.length === 0, semLink.map((c) => c.id).join(", "));
  const aulas = [...b.cartas.map((c) => c.aula), ...b.finais.map((f) => f.aula).filter(Boolean)];
  const faltam = aulas.filter((a) => !fs.existsSync(path.join(raiz, "content", `${a.href.slice(1)}.md`)));
  conferir(`${id}: todas as aulas existem`, faltam.length === 0, faltam.map((a) => a.href).join(", "));
  const efeitos = b.cartas.flatMap((c) => [c.esquerda, c.direita]).map((l) => Object.keys(l.efeito).length);
  conferir(`${id}: toda escolha mexe em ao menos 2 medidores`, efeitos.every((n) => n >= 2));
  const fases = b.fases.reduce((s, f) => s + f.cartas, 0);
  conferir(`${id}: partida de 8 a 12 cartas`, fases >= 8 && fases <= 12, String(fases));
}
conferir("são 8 baralhos novos", IDS.length === 8);

console.log(`${ok} conferências certas, ${falhas.length} com problema.`);
for (const f of falhas) console.log(`  FALHOU  ${f}`);
process.exit(falhas.length ? 1 : 0);
