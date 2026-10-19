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
