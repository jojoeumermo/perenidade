// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O modelo único de aula (docs/MODELO-DE-AULA.md) e a conferência de uma aula contra ele: objetivo, explicação,
// exemplo resolvido, exercício, resumo e fontes. É um guia, não uma trava: o validador só aponta o que falta
// (npm run pendencias); as aulas que já existem continuam publicadas como estão.
// Também lê o histórico de revisões do cabeçalho da aula (campo "revisoes"), que alimenta a etiqueta de revisão.
// Sem os atalhos "@/" de propósito: os roteiros de conferência rodam este arquivo direto no Node.

export type ParteDoModelo = "objetivo" | "explicacao" | "exemplo" | "exercicio" | "resumo" | "fontes";
export const PARTES: ParteDoModelo[] = ["objetivo", "explicacao", "exemplo", "exercicio", "resumo", "fontes"];

/** Títulos (## ou ###) aceitos para cada parte que tem seção própria no texto. */
const TITULOS: Partial<Record<ParteDoModelo, RegExp>> = {
  objetivo: /^(o que (você|voce) vai aprender|objetivos?( da aula)?|nesta aula|ao fim desta aula|para que serve)/i,
  exemplo: /(exemplos? resolvidos?|resolvendo (um|o) exemplo|exemplo comentado|passo a passo)/i,
  resumo: /^(resumo|em resumo|para lembrar|recapitulando|s[ií]ntese|o essencial|o que fica)/i,
};

/** Quantas palavras de explicação, no mínimo, fora dos blocos de código e das outras partes. */
export const PALAVRAS_DE_EXPLICACAO = 250;

export interface ResultadoDoModelo {
  parte: ParteDoModelo;
  ok: boolean;
}

function titulos(corpo: string): string[] {
  return corpo
    .replace(/```[\s\S]*?```/g, "")
    .split("\n")
    .map((linha) => /^#{2,3}\s+(.+?)\s*$/.exec(linha)?.[1]?.replace(/[*_`]/g, "").trim() ?? "")
    .filter(Boolean);
}

/** Confere uma aula: que partes do modelo ela tem. `quiz` e `fontes` são as quantidades do cabeçalho. */
export function conferirModelo(aula: { corpo: string; quiz: number; fontes: number; exercicios?: number }): ResultadoDoModelo[] {
  const lista = titulos(aula.corpo);
  const tem = (parte: ParteDoModelo) => lista.some((t) => TITULOS[parte]!.test(t));
  const palavras = aula.corpo
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`|-]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return [
    { parte: "objetivo", ok: tem("objetivo") },
    { parte: "explicacao", ok: palavras >= PALAVRAS_DE_EXPLICACAO },
    { parte: "exemplo", ok: tem("exemplo") || /```conta\b/.test(aula.corpo) },
    { parte: "exercicio", ok: aula.quiz >= 3 || (aula.exercicios ?? 0) > 0 || /```verificar\b/.test(aula.corpo) },
    { parte: "resumo", ok: tem("resumo") },
    { parte: "fontes", ok: aula.fontes >= 1 },
  ];
}

// ───────────── As 3 partes novas do modelo de 9 partes (Etapa 3, R3) ─────────────
// Na sua realidade (a pergunta sobre o trabalho ou o bairro, ANTES da explicação), O outro lado (o argumento mais forte
// de quem discorda + treino de resposta) e Agir (uma tarefa pequena; a aula seguinte pergunta "como foi"). São opcionais
// nas aulas antigas (conferirModelo continua devolvendo só as 6 de sempre) e obrigatórias nas aulas novas das trilhas de
// entrada e de militância, que declaram `modelo: 9` no cabeçalho (docs/CHECKLIST-DE-REVISAO.md).

export type ParteNova = "na-sua-realidade" | "outro-lado" | "agir";
export const PARTES_NOVAS: ParteNova[] = ["na-sua-realidade", "outro-lado", "agir"];
/** As 9 partes, na ordem em que o modelo as apresenta. */
export const PARTES_DO_MODELO_DE_9: (ParteDoModelo | ParteNova)[] = [...PARTES, ...PARTES_NOVAS];

/** O bloco de código (```nome) que cada parte nova usa na aula; o título `## ...` equivalente também vale na conferência. */
export const BLOCO_DA_PARTE_NOVA: Record<ParteNova, string> = { "na-sua-realidade": "suarealidade", "outro-lado": "outrolado", agir: "agir" };
const TITULOS_NOVOS: Record<ParteNova, RegExp> = {
  "na-sua-realidade": /^na sua realidade/i,
  "outro-lado": /^o outro lado/i,
  agir: /^agir\b/i,
};

export interface ResultadoDaParteNova {
  parte: ParteNova;
  ok: boolean;
  /** Quando não está ok: "falta" (não há) ou "ordem" (Na sua realidade veio depois da explicação) ou "treino" (O outro lado sem o treino de resposta). */
  motivo?: "falta" | "ordem" | "treino";
}

type Evento = { tipo: "titulo"; texto: string } | { tipo: "bloco"; nome: string; spec: string };

/** Os títulos `##` e os blocos de código da aula, na ordem em que aparecem. */
function eventos(corpo: string): Evento[] {
  const saida: Evento[] = [];
  const linhas = corpo.split("\n");
  for (let i = 0; i < linhas.length; i++) {
    const abre = /^```([a-z0-9-]+)\s*$/.exec(linhas[i]);
    if (abre) {
      const dentro: string[] = [];
      i++;
      while (i < linhas.length && !/^```\s*$/.test(linhas[i])) dentro.push(linhas[i++]);
      saida.push({ tipo: "bloco", nome: abre[1], spec: dentro.join("\n") });
      continue;
    }
    if (/^```/.test(linhas[i])) {
      i++;
      while (i < linhas.length && !/^```\s*$/.test(linhas[i])) i++;
      continue;
    }
    const t = /^##\s+(.+?)\s*$/.exec(linhas[i]);
    if (t) saida.push({ tipo: "titulo", texto: t[1].replace(/[*_`]/g, "").trim() });
  }
  return saida;
}

/** O bloco ```outrolado: argumento, `---`, pergunta do treino, (opcional) `---` e uma resposta possível. */
export function partesDoOutroLado(spec: string): { argumento: string; treino: string; resposta: string } {
  const [argumento = "", treino = "", ...resto] = spec.split(/^\s*---\s*$/m).map((p) => p.trim());
  return { argumento, treino, resposta: resto.join("\n\n").trim() };
}

/** Confere as 3 partes novas. Não entra em conferirModelo de propósito: nas aulas antigas elas são opcionais. */
export function conferirPartesNovas(corpo: string): ResultadoDaParteNova[] {
  const ev = eventos(corpo);
  const achar = (parte: ParteNova) => ev.findIndex((e) => (e.tipo === "bloco" ? e.nome === BLOCO_DA_PARTE_NOVA[parte] : TITULOS_NOVOS[parte].test(e.texto)));
  return PARTES_NOVAS.map((parte): ResultadoDaParteNova => {
    const i = achar(parte);
    if (i < 0) return { parte, ok: false, motivo: "falta" };
    const e = ev[i];
    if (parte === "na-sua-realidade") {
      // Só o objetivo pode vir antes: a pergunta precisa chegar antes da explicação.
      const antes = ev.slice(0, i).some((x) => x.tipo === "titulo" && !TITULOS.objetivo!.test(x.texto));
      if (antes) return { parte, ok: false, motivo: "ordem" };
    }
    if (parte === "outro-lado") {
      const temTreino = e.tipo === "bloco" ? Boolean(partesDoOutroLado(e.spec).treino) : /\b(treino|treine|como voc[êe] responderia)\b/i.test(corpo);
      if (!temTreino) return { parte, ok: false, motivo: "treino" };
    }
    return { parte, ok: true };
  });
}

/** O texto da tarefa do bloco ```agir (ou da seção `## Agir`), para a aula seguinte perguntar "como foi". Nulo se não há. */
export function tarefaDoAgir(corpo: string): string | null {
  const linhas = corpo.split("\n");
  const i = linhas.findIndex((l) => /^```agir\s*$/.test(l));
  if (i >= 0) {
    const dentro: string[] = [];
    for (let k = i + 1; k < linhas.length && !/^```\s*$/.test(linhas[k]); k++) dentro.push(linhas[k]);
    const texto = dentro.join("\n").trim();
    return texto || null;
  }
  const h = linhas.findIndex((l) => /^##\s+agir\b/i.test(l));
  if (h < 0) return null;
  const dentro: string[] = [];
  for (let k = h + 1; k < linhas.length && !/^##\s/.test(linhas[k]); k++) dentro.push(linhas[k]);
  const texto = dentro.join("\n").trim();
  return texto || null;
}

/** Trilha em que as 3 partes são obrigatórias nas aulas novas: as de entrada (etapa fundamental e alfabetização) e as de formação militante. */
export const exigeAsPartesNovas = (trilha: { stage?: string; area?: string }) => trilha.stage === "fundamental" || trilha.area === "alfabetizacao" || trilha.area === "formacao-militante";

// ───────────── As seções a mais da aula do percurso ENEM (docs/ENEM.md) ─────────────

export type SecaoDoEnem = "como-cai" | "questao-comentada" | "aprofundar";
export const SECOES_DO_ENEM: SecaoDoEnem[] = ["como-cai", "questao-comentada", "aprofundar"];
const TITULOS_DO_ENEM: Record<SecaoDoEnem, RegExp> = {
  "como-cai": /^como (isso |esse conte[uú]do )?cai no enem/i,
  "questao-comentada": /^quest(ã|a)o comentada/i,
  aprofundar: /^para aprofundar/i,
};
/** Trilhas do percurso que são de orientação (como a prova funciona, estratégia): não levam as seções de conteúdo. */
export const TRILHAS_DE_ORIENTACAO = ["enem-como-funciona", "enem-estrategia-de-prova"];
/** Aulas de orientação dentro de trilhas de conteúdo ("trilha/aula"). */
export const AULAS_DE_ORIENTACAO = ["enem-reta-final/como-usar-a-reta-final", "enem-reta-final/a-vespera-e-o-dia-da-prova"];
/** Aula de orientação: não ensina conteúdo da Matriz (nem leva as etiquetas de área nos exercícios). */
export const ehOrientacao = (trilha: string, aula: string) => TRILHAS_DE_ORIENTACAO.includes(trilha) || AULAS_DE_ORIENTACAO.includes(`${trilha}/${aula}`);
/** Aula de redação: não há questão de múltipla escolha (a "questão comentada" é o trecho de redação comentado) nem área da Matriz. */
export const ehRedacao = (trilha: string, aula: string) => /^enem-redacao/.test(trilha) || /^redacao-/.test(aula);

/** Que seções do percurso ENEM faltam numa aula (vazio para trilhas fora do percurso ou de orientação). */
export function conferirSecoesDoEnem(trilha: string, corpo: string, aula = ""): SecaoDoEnem[] {
  if (!trilha.startsWith("enem-") || ehOrientacao(trilha, aula)) return [];
  const lista = titulos(corpo);
  return SECOES_DO_ENEM.filter((s) => !(s === "questao-comentada" && ehRedacao(trilha, aula)) && !lista.some((t) => TITULOS_DO_ENEM[s].test(t)));
}

// ───────────── Revisões ─────────────

export interface Revisao {
  /** Quem revisou, pela função ("educador de matemática", "revisão"). O nome é opcional. */
  funcao: string;
  nome?: string;
  /** AAAA-MM-DD */
  data: string;
  nota?: string;
}

/**
 * Lê o campo "revisoes" do cabeçalho de uma aula. Lista de { funcao, data, nome?, nota? }; ausente, a aula está em
 * revisão. Nada é escrito aqui por rotina nenhuma: só quem revisou acrescenta a linha. Erro de formato para a montagem.
 */
export function lerRevisoes(bruto: unknown, arquivo: string): Revisao[] {
  if (bruto === undefined || bruto === null) return [];
  if (!Array.isArray(bruto)) throw new Error(`Conteúdo inválido em ${arquivo}: "revisoes" deve ser uma lista`);
  return bruto
    .map((item: unknown, i) => {
      const onde = `revisoes[${i}]`;
      if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`Conteúdo inválido em ${arquivo}: ${onde} precisa de "funcao" e "data"`);
      const r = item as Record<string, unknown>;
      const funcao = typeof r.funcao === "string" ? r.funcao.trim() : "";
      const data = r.data instanceof Date ? r.data.toISOString().slice(0, 10) : String(r.data ?? "").trim();
      if (!funcao || funcao.length > 120) throw new Error(`Conteúdo inválido em ${arquivo}: ${onde}.funcao é obrigatório (a função de quem revisou)`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error(`Conteúdo inválido em ${arquivo}: ${onde}.data deve ser AAAA-MM-DD`);
      const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 300) : undefined);
      return { funcao, data, nome: texto(r.nome), nota: texto(r.nota) };
    })
    .sort((a, b) => b.data.localeCompare(a.data));
}
