// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O que o site lê de content/enem/ (só no servidor, na montagem): a matriz, a edição corrente, as provas oficiais
// classificadas, a incidência e os dados da redação. Cada arquivo é conferido pelos validadores de lib/enem.ts;
// arquivo inválido para a montagem. Os formatos estão em docs/ENEM.md.

import fs from "node:fs";
import path from "node:path";
import { CORE_SCHEMA, load } from "js-yaml";
import {
  acharNaMatriz,
  type Classificacao,
  type Edicao,
  type Incidencia,
  type ItemDeRepertorio,
  type Matriz,
  type Proposta,
  type QuestaoImportada,
  type Simulados,
  substituirFatos,
  type TemaOficial,
  validarClassificacoes,
  validarEdicao,
  validarMatriz,
  validarPropostas,
  validarRepertorio,
  validarSimulados,
  validarTemasOficiais,
} from "./enem";

const RAIZ = path.join(process.cwd(), "content", "enem");
const producao = process.env.NODE_ENV === "production";
const yaml = (rel: string) => load(fs.readFileSync(path.join(RAIZ, rel), "utf8"), { schema: CORE_SCHEMA });
const existe = (rel: string) => fs.existsSync(path.join(RAIZ, rel));

// Na montagem o conteúdo não muda: lê uma vez por processo. No desenvolvimento lê de novo a cada chamada.
function guardado<T>(ler: () => T): () => T {
  let valor: T | undefined;
  return () => {
    if (!producao) return ler();
    valor ??= ler();
    return valor;
  };
}

export const matrizDoEnem = guardado<Matriz>(() => validarMatriz(yaml("matriz.yml")));
export const edicaoDoEnem = guardado<Edicao>(() => validarEdicao(yaml("edicao.yml")));

/** Troca os {{enem:<id>}} de um texto de conteúdo pelos fatos da edição corrente. */
export function comFatosDaEdicao(texto: string, arquivo: string): string {
  return texto.includes("{{enem:") ? substituirFatos(texto, edicaoDoEnem(), arquivo) : texto;
}

/** As questões importadas de um ano (public/questoes/enem-<ano>.json). */
export function questoesImportadas(ano: number): QuestaoImportada[] {
  const arquivo = path.join(process.cwd(), "public", "questoes", `enem-${ano}.json`);
  if (!fs.existsSync(arquivo)) return [];
  return (JSON.parse(fs.readFileSync(arquivo, "utf8")) as { questoes: QuestaoImportada[] }).questoes;
}

export const classificacoesDoEnem = guardado<Classificacao[]>(() => {
  const pasta = "questoes-oficiais";
  if (!existe(pasta)) return [];
  const matriz = matrizDoEnem();
  const todas: Classificacao[] = [];
  for (const nome of fs.readdirSync(path.join(RAIZ, pasta)).filter((n) => /^\d{4}(-[a-z]+)?\.yml$/.test(n)).sort()) {
    const ano = Number(nome.slice(0, 4));
    const importadas = new Map(questoesImportadas(ano).map((q) => [q.id, q]));
    todas.push(...validarClassificacoes(yaml(`${pasta}/${nome}`), `content/enem/${pasta}/${nome}`, importadas, (id) => acharNaMatriz(matriz, id)?.objeto ?? null));
  }
  return todas;
});

export const incidenciaDoEnem = guardado<Incidencia | null>(() => (existe("incidencia.yml") ? (yaml("incidencia.yml") as Incidencia) : null));

export const redacaoDoEnem = guardado<{ temas: TemaOficial[]; propostas: Proposta[]; repertorio: ItemDeRepertorio[] }>(() => ({
  temas: existe("redacao/temas-oficiais.yml") ? validarTemasOficiais(yaml("redacao/temas-oficiais.yml")) : [],
  propostas: existe("redacao/propostas.yml") ? validarPropostas(yaml("redacao/propostas.yml")) : [],
  repertorio: existe("redacao/repertorio.yml") ? validarRepertorio(yaml("redacao/repertorio.yml")) : [],
}));

/** As questões oficiais classificadas que citam uma aula ("trilha/aula") em `aulas`. */
export function questoesOficiaisDaAula(trilha: string, aula: string): Classificacao[] {
  const alvo = `${trilha}/${aula}`;
  return classificacoesDoEnem()
    .filter((c) => c.aulas.includes(alvo))
    .sort((a, b) => b.ano - a.ano || a.id.localeCompare(b.id, "pt", { numeric: true }));
}

/** O diagnóstico e os minissimulados (content/enem/simulados), conferidos contra as questões classificadas. */
export const simuladosDoEnem = guardado<Simulados | null>(() => {
  if (!existe("simulados/diagnostico.yml")) return null;
  const area = new Map(classificacoesDoEnem().map((c) => [c.id, c.area]));
  return validarSimulados(yaml("simulados/diagnostico.yml"), yaml("simulados/minissimulados.yml"), (id) => area.get(id) ?? null);
});
