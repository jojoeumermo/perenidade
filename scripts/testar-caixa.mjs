// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Confere o mapa ferramenta ↔ disciplina da caixa das aulas (lib/ferramentas/caixa.ts): toda disciplina tem caixa,
// só com ferramentas que existem, sem repetir, e os casos combinados (Trancista sem calculadora; IA no Python, sem
// tabela-verdade nem estatística por padrão). Uso:
// node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/carregar-ts.mjs scripts/testar-caixa.mjs
import { areaSlugs, groups, tools } from "../lib/areas.ts";
import { caixaPorDisciplina, ferramentasDaCaixa } from "../lib/ferramentas/caixa.ts";

let ok = 0;
const falhas = [];
const conferir = (nome, cond, detalhe = "") => (cond ? ok++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));

for (const area of areaSlugs) {
  const lista = caixaPorDisciplina[area];
  conferir(`${area} tem caixa`, Array.isArray(lista) && lista.length > 0);
  if (!lista) continue;
  const inexistentes = lista.filter((id) => !tools.includes(id));
  conferir(`${area} só com ferramentas que existem`, inexistentes.length === 0, inexistentes.join(", "));
  conferir(`${area} sem repetir`, new Set(lista).size === lista.length, lista.join(", "));
}
const sobrando = Object.keys(caixaPorDisciplina).filter((a) => !areaSlugs.includes(a));
conferir("nenhuma disciplina inventada no mapa", sobrando.length === 0, sobrando.join(", "));

const trancista = ferramentasDaCaixa("trancista");
conferir("Trancista sem calculadora científica", !trancista.includes("calculadora"), trancista.join(", "));
conferir("Trancista com cronômetro", trancista.includes("cronometro"));
conferir("Manicure entre os Ofícios", groups.find((g) => g.id === "oficios")?.areas.includes("manicure"));
for (const oficio of ["barbeiro", "costureira", "manicure"]) conferir(`${oficio} sem calculadora científica`, !ferramentasDaCaixa(oficio).includes("calculadora"));

const ia = ferramentasDaCaixa("inteligencia-artificial");
conferir("IA abre no Python", ia[0] === "python", ia.join(", "));
conferir("IA sem tabela-verdade por padrão", !ia.includes("tabela-verdade"));
conferir("IA sem estatística por padrão", !ia.includes("estatistica"));
conferir("IA com estatística quando a aula pede", ferramentasDaCaixa("inteligencia-artificial", ["estatistica"])[0] === "estatistica");

conferir("Matemática com calculadora", ferramentasDaCaixa("matematica").includes("calculadora"));
conferir("Português sem calculadora", !ferramentasDaCaixa("portugues").includes("calculadora"));
conferir("sugerida da aula vem primeiro e não repete", JSON.stringify(ferramentasDaCaixa("musica", ["metronomo"]).slice(0, 2)) === JSON.stringify(["metronomo", "afinador"]));
conferir("sugerida que não existe fica de fora", !ferramentasDaCaixa("musica", ["nao-existe"]).includes("nao-existe"));
conferir("disciplina desconhecida cai no padrão", ferramentasDaCaixa("nao-existe").length > 0);

if (falhas.length) {
  console.error(`✗ ${falhas.length} falha(s), ${ok} ok:\n  - ${falhas.join("\n  - ")}`);
  process.exit(1);
}
console.log(`✓ caixa das aulas: ${ok} conferências`);
