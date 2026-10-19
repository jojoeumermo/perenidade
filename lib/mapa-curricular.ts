// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O mapa curricular: cada aula ligada às habilidades da BNCC e à Matriz de Referência do Enem, em
// content/curriculo/<trilha>.yml. Só códigos oficiais, e cada ligação diz a sua situação: "confirmado" (alguém
// conferiu no documento oficial) ou "a-confirmar" (proposto, ainda sem conferência). O site mostra "a confirmar"
// ao lado do código. Aqui fica a conferência do formato; ela não sabe se o código existe, só se tem a forma certa.
// Sem os atalhos "@/" de propósito: `npm run testar:meu-estudo` roda este arquivo direto no Node.

export type Situacao = "confirmado" | "a-confirmar";

export interface HabilidadeBncc {
  codigo: string;
  /** Resumo da habilidade nas palavras da equipe (não é a redação oficial). */
  resumo: string;
  situacao: Situacao;
}

export interface HabilidadeEnem {
  area: AreaDoEnem;
  competencia: number;
  habilidade: number;
  resumo: string;
  situacao: Situacao;
}

export type AreaDoEnem = "matematica" | "linguagens" | "natureza" | "humanas";

/** Na Matriz de Referência do Enem, cada área tem 30 habilidades (H1 a H30), divididas entre as competências. */
export const COMPETENCIAS_DO_ENEM: Record<AreaDoEnem, number> = { matematica: 7, linguagens: 9, natureza: 8, humanas: 6 };

/** Matemática: as habilidades de cada competência de área (C1: H1–H5, C2: H6–H9 …). */
const FAIXAS_DE_MATEMATICA: [number, number][] = [
  [1, 5],
  [6, 9],
  [10, 14],
  [15, 18],
  [19, 23],
  [24, 26],
  [27, 30],
];

export interface MapaDaAula {
  bncc: HabilidadeBncc[];
  enem: HabilidadeEnem[];
}

export interface MapaDaTrilha {
  fontes: string[];
  aulas: Record<string, MapaDaAula>;
}

/** Ensino Fundamental (EF06MA07, EF69LP01, EF67EF01…) ou Médio (EM13MAT101, EM13LGG101…). */
export const CODIGO_BNCC = /^(EF(\d{2})[A-Z]{2}\d{2}|EM13[A-Z]{3}\d{3})$/;

function falhar(arquivo: string, mensagem: string): never {
  throw new Error(`Mapa curricular inválido em ${arquivo}: ${mensagem}`);
}

function situacaoDe(valor: unknown, onde: string, arquivo: string): Situacao {
  if (valor === "confirmado" || valor === "a-confirmar") return valor;
  falhar(arquivo, `${onde}: "situacao" deve ser confirmado ou a-confirmar`);
}

function resumoDe(valor: unknown, onde: string, arquivo: string): string {
  if (typeof valor !== "string" || !valor.trim() || valor.length > 300) falhar(arquivo, `${onde}: "resumo" é obrigatório (até 300 caracteres)`);
  return valor.trim();
}

export function validarMapa(bruto: unknown, arquivo: string): MapaDaTrilha {
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) falhar(arquivo, 'o arquivo precisa de "fontes" e "aulas"');
  const d = bruto as Record<string, unknown>;
  if (!Array.isArray(d.fontes) || d.fontes.length === 0 || !d.fontes.every((f) => typeof f === "string" && f.trim())) falhar(arquivo, '"fontes" é a lista dos documentos oficiais usados');
  if (!d.aulas || typeof d.aulas !== "object" || Array.isArray(d.aulas)) falhar(arquivo, '"aulas" liga cada aula (pelo slug) às habilidades');
  const aulas: Record<string, MapaDaAula> = {};
  for (const [aula, valor] of Object.entries(d.aulas as Record<string, unknown>)) {
    if (!/^[a-z0-9-]+$/.test(aula)) falhar(arquivo, `"${aula}" não é um slug de aula`);
    const m = (valor ?? {}) as Record<string, unknown>;
    const bncc = (Array.isArray(m.bncc) ? m.bncc : []).map((h: Record<string, unknown>, i): HabilidadeBncc => {
      const onde = `${aula}.bncc[${i}]`;
      const codigo = String(h?.codigo ?? "").trim();
      if (!CODIGO_BNCC.test(codigo)) falhar(arquivo, `${onde}: "${codigo}" não tem a forma de um código da BNCC`);
      const ano = /^EF(\d)(\d)/.exec(codigo);
      // Um ano só (EF06…) ou um intervalo crescente (EF67…, EF69…, EF15…).
      if (ano && ano[1] !== "0" && Number(ano[1]) >= Number(ano[2])) falhar(arquivo, `${onde}: "${codigo}" tem anos que não existem`);
      return { codigo, resumo: resumoDe(h?.resumo, onde, arquivo), situacao: situacaoDe(h?.situacao, onde, arquivo) };
    });
    const enem = (Array.isArray(m.enem) ? m.enem : []).map((h: Record<string, unknown>, i): HabilidadeEnem => {
      const onde = `${aula}.enem[${i}]`;
      const area = String(h?.area ?? "matematica") as AreaDoEnem;
      if (!(area in COMPETENCIAS_DO_ENEM)) falhar(arquivo, `${onde}: "area" deve ser matematica, linguagens, natureza ou humanas`);
      const competencia = Number(h?.competencia);
      const habilidade = Number(h?.habilidade);
      if (!Number.isInteger(competencia) || competencia < 1 || competencia > COMPETENCIAS_DO_ENEM[area]) falhar(arquivo, `${onde}: competência ${h?.competencia} não existe na matriz de ${area}`);
      if (!Number.isInteger(habilidade) || habilidade < 1 || habilidade > 30) falhar(arquivo, `${onde}: habilidade ${h?.habilidade} não existe (H1 a H30)`);
      if (area === "matematica") {
        const [de, ate] = FAIXAS_DE_MATEMATICA[competencia - 1];
        if (habilidade < de || habilidade > ate) falhar(arquivo, `${onde}: H${habilidade} não pertence à competência ${competencia} de Matemática (H${de} a H${ate})`);
      }
      return { area, competencia, habilidade, resumo: resumoDe(h?.resumo, onde, arquivo), situacao: situacaoDe(h?.situacao, onde, arquivo) };
    });
    aulas[aula] = { bncc, enem };
  }
  return { fontes: d.fontes as string[], aulas };
}
