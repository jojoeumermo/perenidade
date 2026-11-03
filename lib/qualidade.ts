// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O painel público de qualidade do conteúdo (R1-90, Etapa 4), mostrado em /status. Calculado na montagem do site, a
// partir dos mesmos arquivos e das mesmas regras que montam as aulas: só os originais em português (as traduções
// "x.en.md" não contam como aula a mais), sem o que tem "ativo: false" e sem as trilhas desligadas. A situação de cada
// aula vem de lib/pendencias.ts (a mesma do roteiro `npm run pendencias` e do campo "revisoes" que lib/revisoes-conteudo.ts
// mostra na aula). Só números do conteúdo: nada sobre pessoas, nenhum ranking.
// Sem os atalhos "@/": o teste (scripts/testar-acesso.mjs) roda este arquivo direto no Node.

import fs from "node:fs";
import path from "node:path";
import { parseFrontmatter } from "./frontmatter";
import { lerPendencias } from "./pendencias";

/** O que o painel precisa de cada aula. */
export interface AulaParaQualidade {
  trilha: string;
  aula: string;
  /** "revisada" (com histórico de revisão), "aprovada" (revisada: true, do painel) ou "em-revisao". */
  situacao: "revisada" | "aprovada" | "em-revisao";
  /** Quantas partes do modelo de aula (docs/MODELO-DE-AULA.md) ainda faltam. */
  faltam: number;
  fontes: number;
  quiz: number;
  /** Exercícios corrigidos com explicação do erro (content/exercicios/<trilha>/<aula>.yml). */
  exercicios: number;
}

export interface Qualidade {
  /** AAAA-MM-DD, no horário de Brasília. */
  data: string;
  aulas: number;
  /** Revisadas: com histórico de revisão ou aprovadas por alguém da equipe no painel. */
  revisadas: number;
  /** Em revisão, já com todas as partes do modelo: falta só quem revise. */
  emRevisaoProntas: number;
  /** Em revisão e ainda sem alguma parte do modelo. */
  emRevisaoFaltam: number;
  comFontes: number;
  comTeste: number;
  comExercicio: number;
  trilhas: number;
  trilhasComAula: number;
  trilhasSemAula: number;
}

/** A data de hoje em Brasília (AAAA-MM-DD). */
export function dataDeBrasilia(agora: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
}

/** A conta, sem ler arquivo nenhum: o teste a confere com uma contagem feita de outro jeito. */
export function resumirQualidade(aulas: AulaParaQualidade[], trilhas: { slug: string; aulas: number }[], agora: Date): Qualidade {
  const emRevisao = aulas.filter((a) => a.situacao === "em-revisao");
  return {
    data: dataDeBrasilia(agora),
    aulas: aulas.length,
    revisadas: aulas.length - emRevisao.length,
    emRevisaoProntas: emRevisao.filter((a) => a.faltam === 0).length,
    emRevisaoFaltam: emRevisao.filter((a) => a.faltam > 0).length,
    comFontes: aulas.filter((a) => a.fontes > 0).length,
    comTeste: aulas.filter((a) => a.quiz > 0).length,
    comExercicio: aulas.filter((a) => a.exercicios > 0).length,
    trilhas: trilhas.length,
    trilhasComAula: trilhas.filter((t) => t.aulas > 0).length,
    trilhasSemAula: trilhas.filter((t) => t.aulas === 0).length,
  };
}

/** Lê as aulas de content/trilhas como o site lê (lib/content.ts) e junta a situação de revisão de lib/pendencias.ts. */
export function lerAulasParaQualidade(raiz = process.cwd()): { aulas: AulaParaQualidade[]; trilhas: { slug: string; aulas: number }[] } {
  const pendencias = new Map(lerPendencias(raiz).aulas.map((a) => [`${a.trilha}/${a.aula}`, a]));
  const pasta = path.join(raiz, "content", "trilhas");
  const aulas: AulaParaQualidade[] = [];
  const trilhas: { slug: string; aulas: number }[] = [];
  if (!fs.existsSync(pasta)) return { aulas, trilhas };
  for (const dir of fs.readdirSync(pasta, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const base = path.join(pasta, dir.name);
    const arquivoDaTrilha = path.join(base, "_trilha.md");
    // Como em lib/content.ts: trilha sem _trilha.md não monta; com "ativo: false", sai do ar.
    if (!fs.existsSync(arquivoDaTrilha)) continue;
    if (parseFrontmatter(fs.readFileSync(arquivoDaTrilha, "utf8")).data.ativo === false) continue;
    let daTrilha = 0;
    for (const nome of fs.readdirSync(base)) {
      const achado = /^(?:\d+-)?([a-z0-9-]+)\.md$/.exec(nome);
      if (!achado || nome === "_trilha.md" || /\.[a-z]{2}\.md$/.test(nome)) continue;
      const { data } = parseFrontmatter(fs.readFileSync(path.join(base, nome), "utf8"));
      if (data.ativo === false) continue;
      const aula = achado[1];
      const p = pendencias.get(`${dir.name}/${aula}`);
      aulas.push({
        trilha: dir.name,
        aula,
        situacao: p?.situacao ?? "em-revisao",
        faltam: p?.faltam.length ?? 0,
        fontes: Array.isArray(data.fontes) ? data.fontes.length : 0,
        quiz: Array.isArray(data.quiz) ? data.quiz.length : 0,
        exercicios: p?.exercicios ?? 0,
      });
      daTrilha += 1;
    }
    trilhas.push({ slug: dir.name, aulas: daTrilha });
  }
  return { aulas, trilhas };
}

// Uma conta por processo: na montagem, as seis páginas de /status (uma por idioma) usam o mesmo resultado.
let guardada: Qualidade | null = null;

/** O painel inteiro. Roda no servidor, na montagem (a página /status é estática). */
export function calcularQualidade(raiz = process.cwd(), agora = new Date()): Qualidade {
  if (guardada) return guardada;
  const { aulas, trilhas } = lerAulasParaQualidade(raiz);
  guardada = resumirQualidade(aulas, trilhas, agora);
  return guardada;
}
