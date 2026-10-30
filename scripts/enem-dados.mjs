// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Leitura de tudo o que o curso ENEM usa, para os roteiros testar:enem, cobertura:enem, fila:enem e incidencia:enem.
// Lê os arquivos direto (sem passar pelo site) e confere cada formato com lib/enem.ts. Rode com
// `node --import ./scripts/carregar-ts.mjs` (os scripts do package.json já fazem isso).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CORE_SCHEMA, dump, load } from "js-yaml";
import { acharNaMatriz, calcularIncidencia, validarClassificacoes, validarEdicao, validarMatriz, validarPropostas, validarRepertorio, validarTemasOficiais } from "../lib/enem.ts";
import { validarExercicios } from "../lib/exercicios.ts";
import { parseFrontmatter } from "../lib/frontmatter.ts";
import { validarMapa } from "../lib/mapa-curricular.ts";

export const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (rel) => fs.readFileSync(path.join(raiz, rel), "utf8");
const yaml = (rel) => load(ler(rel), { schema: CORE_SCHEMA });
const existe = (rel) => fs.existsSync(path.join(raiz, rel));

export const carregarMatriz = () => validarMatriz(yaml("content/enem/matriz.yml"));
export const carregarEdicao = () => validarEdicao(yaml("content/enem/edicao.yml"));

/** As questões importadas de um ano (public/questoes/enem-<ano>.json), pelo id. */
export function importadasDe(ano) {
  const rel = `public/questoes/enem-${ano}.json`;
  if (!existe(rel)) return new Map();
  return new Map(JSON.parse(ler(rel)).questoes.map((q) => [q.id, q]));
}

/** Os anos com prova importada. */
export const anosImportados = () =>
  fs
    .readdirSync(path.join(raiz, "public/questoes"))
    .map((n) => /^enem-(\d{4})\.json$/.exec(n)?.[1])
    .filter(Boolean)
    .map(Number)
    .sort();

/** Todas as classificações de content/enem/questoes-oficiais/<ano>.yml. */
export function carregarClassificacoes(matriz) {
  const pasta = "content/enem/questoes-oficiais";
  if (!existe(pasta)) return [];
  const todas = [];
  const onde = new Map();
  for (const nome of fs.readdirSync(path.join(raiz, pasta)).filter((n) => /^\d{4}(-[a-z]+)?\.yml$/.test(n)).sort()) {
    const ano = Number(nome.slice(0, 4));
    for (const c of validarClassificacoes(yaml(`${pasta}/${nome}`), `${pasta}/${nome}`, importadasDe(ano), (id) => acharNaMatriz(matriz, id)?.objeto ?? null)) {
      if (onde.has(c.id)) throw new Error(`Conteúdo do ENEM inválido: ${c.id} está em ${onde.get(c.id)} e em ${nome}`);
      onde.set(c.id, nome);
      todas.push(c);
    }
  }
  return todas;
}

/** As trilhas e as aulas escritas (com título, área da trilha e o texto), lidas de content/trilhas. */
export function carregarAulas() {
  const pasta = path.join(raiz, "content/trilhas");
  const trilhas = [];
  for (const d of fs.readdirSync(pasta, { withFileTypes: true }).filter((x) => x.isDirectory())) {
    const base = path.join(pasta, d.name);
    if (!fs.existsSync(path.join(base, "_trilha.md"))) continue;
    const cab = parseFrontmatter(fs.readFileSync(path.join(base, "_trilha.md"), "utf8")).data;
    if (cab.ativo === false) continue;
    const plano = fs.existsSync(path.join(base, "plano.json")) ? JSON.parse(fs.readFileSync(path.join(base, "plano.json"), "utf8")) : [];
    const aulas = [];
    for (const nome of fs.readdirSync(base)) {
      const m = /^(?:\d+-)?([a-z0-9-]+)\.md$/.exec(nome);
      if (!m || nome === "_trilha.md" || /\.[a-z]{2}\.md$/.test(nome)) continue;
      const { data, content } = parseFrontmatter(fs.readFileSync(path.join(base, nome), "utf8"));
      if (data.ativo === false) continue;
      aulas.push({ slug: m[1], arquivo: `content/trilhas/${d.name}/${nome}`, titulo: String(data.titulo ?? m[1]), quiz: Array.isArray(data.quiz) ? data.quiz : [], fontes: Array.isArray(data.fontes) ? data.fontes : [], revisoes: data.revisoes, corpo: content });
    }
    trilhas.push({ slug: d.name, titulo: String(cab.titulo ?? d.name), area: String(cab.area ?? ""), etapa: String(cab.etapa ?? ""), plano, aulas });
  }
  return trilhas;
}

/** Mapa curricular de todas as trilhas (content/curriculo/<trilha>.yml). */
export function carregarMapas() {
  const pasta = "content/curriculo";
  const mapas = new Map();
  if (!existe(pasta)) return mapas;
  for (const nome of fs.readdirSync(path.join(raiz, pasta)).filter((n) => n.endsWith(".yml"))) mapas.set(nome.slice(0, -4), validarMapa(yaml(`${pasta}/${nome}`), `${pasta}/${nome}`));
  return mapas;
}

/** Todos os exercícios (content/exercicios/<trilha>/<aula>.yml), com a trilha e a aula. */
export function carregarExercicios() {
  const pasta = path.join(raiz, "content/exercicios");
  const saida = [];
  if (!fs.existsSync(pasta)) return saida;
  for (const t of fs.readdirSync(pasta, { withFileTypes: true }).filter((x) => x.isDirectory()))
    for (const nome of fs.readdirSync(path.join(pasta, t.name)).filter((n) => n.endsWith(".yml"))) {
      const rel = `content/exercicios/${t.name}/${nome}`;
      for (const ex of validarExercicios(yaml(rel), rel)) saida.push({ trilha: t.name, aula: nome.slice(0, -4), arquivo: rel, ex });
    }
  return saida;
}

/** Os dados da redação que já existirem (cada arquivo é opcional até a onda dele). */
export function carregarRedacao() {
  const r = "content/enem/redacao";
  return {
    temas: existe(`${r}/temas-oficiais.yml`) ? validarTemasOficiais(yaml(`${r}/temas-oficiais.yml`)) : [],
    propostas: existe(`${r}/propostas.yml`) ? validarPropostas(yaml(`${r}/propostas.yml`)) : [],
    repertorio: existe(`${r}/repertorio.yml`) ? validarRepertorio(yaml(`${r}/repertorio.yml`)) : [],
  };
}

export const lerYaml = yaml;
export const existeArquivo = existe;

const METODO =
  "Contagem das questões classificadas em content/enem/questoes-oficiais (área auditada pela numeração do caderno, habilidade e objeto de conhecimento), " +
  "nas últimas 10 edições que têm classificação. A parte é a porcentagem sobre as questões classificadas daquela área. " +
  "Enquanto houver poucas edições classificadas, a contagem é parcial: veja base.anos e base.classificadas.";

/** O texto de content/enem/incidencia.yml, refeito a partir das classificações (sempre igual para a mesma entrada). */
export function textoDaIncidencia() {
  const matriz = carregarMatriz();
  const r = calcularIncidencia(carregarClassificacoes(matriz), 10);
  const cabecalho = '# GERADO por `npm run incidencia:enem` a partir de content/enem/questoes-oficiais. NÃO edite à mão.\n# Método: docs/ENEM.md, seção "Incidência".\n';
  return cabecalho + dump({ gerado: "npm run incidencia:enem", metodo: METODO, ...r }, { lineWidth: 140, noRefs: true });
}
