// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os 11 cadernos da Escola de Formação (PLANO-ESCOLA.md, F2; tabela 1.6): o que a F1 não pôs no contrato
// (lib/escola/contratos.ts, CADERNOS_DA_ESCOLA, que dá a ordem, o degrau e a fonte de cada um). Aqui ficam o patrono, a
// divisão em lado A (teoria) e lado B (prática), e a contagem das aulas lida do conteúdo: as aulas escritas (arquivos .md)
// e as previstas (o plano.json de cada trilha). Os textos de cada caderno (tarefa no mundo, papel do treino) ficam nos 6
// idiomas em i18n/escola/formacao.
//
// É conteúdo público (as mesmas trilhas abertas em /trilhas): nada de militante passa por aqui.
// Sem os atalhos "@/" de propósito (scripts/testar-escola-cadernos.mjs importa este arquivo no Node).

import fs from "node:fs";
import path from "node:path";
import { CADERNOS_DA_ESCOLA, type CadernoDaEscola } from "./contratos";

/**
 * O que cada caderno tem além do contrato.
 * - patrono: só quando há base (o caderno 03 vem da prancha aprovada em 07/11). Nos outros fica nulo até a coordenação
 *   escolher: não se inventa patrono.
 * - ladoB: nas trilhas, o slug da primeira aula do lado B (a ordem do plano.json vai da teoria à prática; a regra é a
 *   metade, arredondada para cima, no lado A, como na prancha do caderno 03: 6 + 5). No Despertar (01), os ids das etapas
 *   que são prática; no Ano de formação (11), os índices dos módulos do 2º semestre.
 */
export interface CatalogoDoCaderno {
  numero: number;
  patrono: string | null;
  ladoB: { tipo: "aula"; comeca: string } | { tipo: "etapas"; ids: string[] } | { tipo: "modulos"; indices: number[] };
}

export const CATALOGO_DOS_CADERNOS: readonly CatalogoDoCaderno[] = [
  { numero: 1, patrono: null, ladoB: { tipo: "etapas", ids: ["organizar", "agir"] } },
  { numero: 2, patrono: null, ladoB: { tipo: "aula", comeca: "estudar-junto-o-primeiro-grupo-de-leitura" } },
  { numero: 3, patrono: "Paulo Freire", ladoB: { tipo: "aula", comeca: "a-familia-e-o-grupo-de-mensagens" } },
  { numero: 4, patrono: null, ladoB: { tipo: "aula", comeca: "planejar-uma-campanha-objetivo-alvo-tatica-e-calendario" } },
  { numero: 5, patrono: null, ladoB: { tipo: "aula", comeca: "greve-na-pratica" } },
  { numero: 6, patrono: null, ladoB: { tipo: "aula", comeca: "radio-comunitaria-e-podcast" } },
  { numero: 7, patrono: null, ladoB: { tipo: "aula", comeca: "rede-de-apoio-juridico-e-de-solidariedade" } },
  { numero: 8, patrono: null, ladoB: { tipo: "aula", comeca: "cenarios-e-hipoteses" } },
  { numero: 9, patrono: null, ladoB: { tipo: "aula", comeca: "mistica-na-luta-popular" } },
  { numero: 10, patrono: null, ladoB: { tipo: "aula", comeca: "historia-oral-como-gravar-uma-entrevista" } },
  { numero: 11, patrono: null, ladoB: { tipo: "modulos", indices: [3, 4, 5] } },
];

export const catalogoDe = (numero: number): CatalogoDoCaderno => CATALOGO_DOS_CADERNOS.find((c) => c.numero === numero)!;

export type Lado = "A" | "B";

/** O lado de uma aula de trilha, pela posição no plano (ordem do plano.json) e o slug onde o lado B começa. */
export function ladoNaTrilha(plano: readonly string[], comecaB: string, slug: string): Lado {
  const b = plano.indexOf(comecaB);
  const i = plano.indexOf(slug);
  return b >= 0 && i >= b ? "B" : "A";
}

// ───────────────────────────── Contagem lida do conteúdo ─────────────────────────────

const RAIZ_PADRAO = () => process.cwd();

/** O plano.json de uma trilha: a lista de slugs previstos, na ordem. */
export function planoDaTrilha(trilha: string, raiz = RAIZ_PADRAO()): string[] {
  const arquivo = path.join(raiz, "content", "trilhas", trilha, "plano.json");
  if (!fs.existsSync(arquivo)) return [];
  return (JSON.parse(fs.readFileSync(arquivo, "utf8")) as { slug: string }[]).map((p) => p.slug);
}

/** As aulas escritas de uma trilha (os .md em português, sem o _trilha.md). */
export function aulasEscritas(trilha: string, raiz = RAIZ_PADRAO()): string[] {
  const pasta = path.join(raiz, "content", "trilhas", trilha);
  if (!fs.existsSync(pasta)) return [];
  return fs
    .readdirSync(pasta)
    .filter((f) => /^[a-z0-9-]+\.md$/.test(f) && f !== "_trilha.md")
    .map((f) => f.slice(0, -3));
}

export type Contagem =
  | { tipo: "trilha"; prontas: number; previstas: number }
  | { tipo: "etapas"; etapas: number }
  | { tipo: "curso"; modulos: number };

/** A contagem que a prancha Formação mostra: "N de M aulas prontas", "12 etapas" ou "curso de um ano". */
export function contagemDoCaderno(c: CadernoDaEscola, raiz = RAIZ_PADRAO()): Contagem {
  if (c.fonte.tipo === "despertar") {
    const d = JSON.parse(fs.readFileSync(path.join(raiz, "content", "despertar.json"), "utf8")) as { etapas: unknown[] };
    return { tipo: "etapas", etapas: d.etapas.length };
  }
  if (c.fonte.tipo === "curso") {
    const d = JSON.parse(fs.readFileSync(path.join(raiz, "content", "escola", "cursos", `${c.fonte.curso}.json`), "utf8")) as { modulos: unknown[] };
    return { tipo: "curso", modulos: d.modulos.length };
  }
  const plano = planoDaTrilha(c.fonte.trilha, raiz);
  const escritas = new Set(aulasEscritas(c.fonte.trilha, raiz));
  // Aula escrita fora do plano também conta como pronta (e prevista): o plano é o mínimo, não um teto.
  const fora = [...escritas].filter((s) => !plano.includes(s)).length;
  return { tipo: "trilha", prontas: plano.filter((s) => escritas.has(s)).length + fora, previstas: plano.length + fora };
}

export { CADERNOS_DA_ESCOLA };
