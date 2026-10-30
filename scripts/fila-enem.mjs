// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A fila de revisão humana do curso ENEM: tudo o que está "em revisão" ou "a confirmar", separado por função
// (educador de matemática, revisor de redação…), para os voluntários dividirem o trabalho. Grava
// docs/enem/FILA-DE-REVISAO.md. Uso: npm run fila:enem. Nada aqui marca nada como revisado.
import fs from "node:fs";
import path from "node:path";
import { lerRevisoes } from "../lib/modelo-de-aula.ts";
import { carregarAulas, carregarClassificacoes, carregarExercicios, carregarMatriz, carregarRedacao, raiz } from "./enem-dados.mjs";

const matriz = carregarMatriz();
const trilhas = carregarAulas().filter((t) => t.slug.startsWith("enem-"));
const exercicios = carregarExercicios().filter((e) => e.trilha.startsWith("enem-"));
const oficiais = carregarClassificacoes(matriz);
const redacao = carregarRedacao();

const FUNCAO_DA_AREA = { matematica: "educador de matemática", natureza: "educador de ciências da natureza", linguagens: "educador de linguagens", humanas: "educador de ciências humanas" };
/** A função que revisa uma aula, pelo nome da trilha e da aula. */
function funcaoDaAula(trilha, aula) {
  if (/redacao/.test(trilha) || /^redacao-/.test(aula)) return "revisor de redação";
  if (/matematica/.test(trilha) || /^(matematica|formulario-de-matematica)/.test(aula)) return FUNCAO_DA_AREA.matematica;
  if (/(fisica|quimica|biologia|natureza)/.test(trilha) || /^(natureza|formulario-de-(fisica|quimica))/.test(aula)) return FUNCAO_DA_AREA.natureza;
  if (/(linguagens|ingles|espanhol)/.test(trilha) || /^linguagens/.test(aula)) return FUNCAO_DA_AREA.linguagens;
  if (/(historia|geografia|filosofia|sociologia|humanas)/.test(trilha) || /^humanas/.test(aula)) return FUNCAO_DA_AREA.humanas;
  return "coordenação pedagógica (orientação de estudo e fatos da prova)";
}

const fila = new Map();
const pôr = (funcao, item) => fila.set(funcao, [...(fila.get(funcao) ?? []), item]);
for (const t of trilhas)
  for (const a of t.aulas) {
    let revisoes = [];
    try {
      revisoes = lerRevisoes(a.revisoes, a.arquivo);
    } catch {
      revisoes = [];
    }
    if (!revisoes.length) pôr(funcaoDaAula(t.slug, a.slug), `aula \`${a.arquivo}\` (${a.titulo}): checklist de revisão (docs/CHECKLIST-DE-REVISAO.md)`);
  }
const exPorArquivo = new Map();
for (const e of exercicios) if (e.ex.revisao.status === "em-revisao") exPorArquivo.set(e.arquivo, [...(exPorArquivo.get(e.arquivo) ?? []), e]);
for (const [arquivo, lista] of exPorArquivo) pôr(lista[0].ex.enem ? FUNCAO_DA_AREA[lista[0].ex.enem.area] : funcaoDaAula(lista[0].trilha, lista[0].aula), `${lista.length} exercícios em \`${arquivo}\`: conferir gabarito, contas, enganos e etiquetas`);
const porArquivoOficial = new Map();
for (const c of oficiais) {
  const chave = `${c.ano} · ${c.area}`;
  porArquivoOficial.set(chave, (porArquivoOficial.get(chave) ?? 0) + 1);
}
for (const [chave, n] of porArquivoOficial) {
  const [ano, area] = chave.split(" · ");
  pôr(FUNCAO_DA_AREA[area], `${n} questões oficiais de ${ano} (\`content/enem/questoes-oficiais/${ano}-${area}.yml\`): confirmar habilidade, objeto e dificuldade, e revisar resolução e enganos`);
}
if (redacao.propostas.length) pôr("revisor de redação", `${redacao.propostas.length} propostas de treino (\`content/enem/redacao/propostas.yml\`)`);
if (redacao.repertorio.length) pôr("revisor de redação", `${redacao.repertorio.length} itens de repertório (\`content/enem/redacao/repertorio.yml\`): conferir cada fonte`);
if (redacao.temas.length) pôr("revisor de redação", `${redacao.temas.length} temas oficiais (\`content/enem/redacao/temas-oficiais.yml\`): conferir na página do Inep`);
pôr("curadoria", "fatos da edição (`content/enem/edicao.yml`): conferir cada trecho na fonte oficial; tabela em `docs/enem/FATOS.md`");
const objetosAConfirmar = Object.values(matriz.areas).flatMap((a) => a.objetos).filter((o) => o.situacao === "a-confirmar");
for (const [area, funcao] of Object.entries(FUNCAO_DA_AREA)) {
  const n = objetosAConfirmar.filter((o) => o.area === area).length;
  if (n) pôr(funcao, `${n} objetos de conhecimento de ${area} em \`content/enem/matriz.yml\`: confirmar a lista de habilidades de cada um`);
}

const L = ["# Fila de revisão do curso ENEM", "", "Gerado por `npm run fila:enem` (não edite à mão). Tudo aqui está **em revisão** ou **a confirmar**: só uma pessoa da equipe, depois de conferir, marca como revisado (aulas: `revisoes`; exercícios: `revisao.status: revisada`; mapa e classificações: `situacao: confirmado`). Revisão feita por IA não conta.", ""];
const ordem = [...fila.keys()].sort();
L.push("| Função | Itens |", "| --- | --- |");
for (const f of ordem) L.push(`| ${f} | ${fila.get(f).length} |`);
L.push("");
for (const f of ordem) {
  L.push(`## ${f}`, "");
  for (const item of fila.get(f)) L.push(`- [ ] ${item}`);
  L.push("");
}
fs.mkdirSync(path.join(raiz, "docs/enem"), { recursive: true });
fs.writeFileSync(path.join(raiz, "docs/enem/FILA-DE-REVISAO.md"), `${L.join("\n")}\n`);
console.log(`fila de revisão: ${[...fila.values()].reduce((s, l) => s + l.length, 0)} itens em ${ordem.length} funções; gravado docs/enem/FILA-DE-REVISAO.md`);
