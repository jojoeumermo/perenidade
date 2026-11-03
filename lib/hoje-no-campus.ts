// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Hoje no campus (Etapa 4, pacote E4-06, ideia R1-74; docs/escola/som.md): um roteiro de rádio de uns dois minutos,
// montado no aparelho a cada dia, para ler na tela ou ouvir pela voz do aparelho. Puro: recebe a data, os fatos, a
// aula da semana, o idioma e as frases do idioma, e devolve o texto. Nada aqui inventa: sem fato, o roteiro fala só da
// aula; fato sem fonte (sem link) não entra; e cada fato diz a fonte em voz alta ("segundo a Wikipédia").
// Sem os atalhos "@/" de propósito (os testes rodam no Node).

/** Cerca de 2 minutos de fala: no máximo 300 palavras. */
export const LIMITE_DE_PALAVRAS = 300;
/** Palavras por minuto de uma leitura calma em voz alta (para o "cerca de N min"). */
export const PALAVRAS_POR_MINUTO = 150;
export const MAX_FATOS = 3;

export interface FatoDoRoteiro {
  ano: number;
  texto: string;
  /** O endereço da fonte (a página da Wikipédia de onde vem o fato). Sem ele, o fato não entra. */
  link: string;
}

export interface AulaDoRoteiro {
  titulo: string;
  /** O nome da trilha. */
  trilha: string;
  resumo: string;
  minutos: number;
}

/** As frases do roteiro num idioma (i18n/escola/som/<idioma>.json, hoje.roteiro). */
export interface FrasesDoRoteiro {
  saudacao: string;
  fatosAbre: string;
  fato: string;
  wikipedia: string;
  site: string;
  aula: string;
  fechamento: string;
}

export interface ParteDoRoteiro {
  tipo: "saudacao" | "fatosAbre" | "fato" | "aula" | "fechamento";
  texto: string;
  /** Só nos fatos: a fonte, para a tela mostrar o link. */
  link?: string;
}

export interface Roteiro {
  partes: ParteDoRoteiro[];
  texto: string;
  palavras: number;
  /** Os fatos que entraram (com a fonte). */
  fatos: FatoDoRoteiro[];
}

const preencher = (modelo: string, valores: Record<string, string | number>) => modelo.replace(/\{(\w+)\}/g, (inteiro, nome: string) => (nome in valores ? String(valores[nome]) : inteiro));

// Chinês e japonês não separam palavras com espaço: cada ideograma conta como 0,6 palavra (uns 500 caracteres em 2 min).
const IDEOGRAMA = /[぀-ヿ㐀-鿿豈-﫿]/gu;

/** Quantas palavras tem um texto (estimativa para o chinês, veja acima). */
export function contarPalavras(texto: string): number {
  const ideogramas = texto.match(IDEOGRAMA)?.length ?? 0;
  const resto = texto.replace(IDEOGRAMA, " ");
  const palavras = resto.split(/\s+/).filter((p) => /[\p{L}\p{N}]/u.test(p)).length;
  return palavras + Math.ceil(ideogramas * 0.6);
}

/** Como a fonte é dita em voz alta; null quando o fato não tem endereço https (e então não entra). */
export function fonteDe(link: string, frases: Pick<FrasesDoRoteiro, "wikipedia" | "site">): string | null {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  if (host === "wikipedia.org" || host.endsWith(".wikipedia.org")) return frases.wikipedia;
  return preencher(frases.site, { site: host.replace(/^www\./, "") });
}

/** O fato com ponto final (o texto da Wikipédia às vezes vem sem). */
const comPonto = (texto: string) => {
  const t = texto.trim().replace(/\s+/g, " ");
  return /[.!?。！？…]$/.test(t) ? t : `${t}${/[㐀-鿿]$/.test(t) ? "。" : "."}`;
};

/** A data por extenso no idioma, no fuso de Brasília ("segunda-feira, 3 de novembro"). */
export function dataPorExtenso(data: Date, idioma: string): string {
  const local = idioma === "pt" ? "pt-BR" : idioma;
  try {
    return new Intl.DateTimeFormat(local, { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" }).format(data);
  } catch {
    return data.toISOString().slice(0, 10);
  }
}

/** Corta o texto em `max` palavras (para o resumo da aula caber no limite), com reticências. */
function cortarPalavras(texto: string, max: number): string {
  if (max <= 0) return "";
  if (contarPalavras(texto) <= max) return texto;
  const ideografico = (texto.match(IDEOGRAMA)?.length ?? 0) > texto.length / 3;
  if (ideografico) return `${[...texto].slice(0, Math.floor(max / 0.6)).join("")}…`;
  return `${texto.split(/\s+/).slice(0, max).join(" ")}…`;
}

/**
 * Monta o roteiro do dia: a saudação com a data; de 1 a 3 fatos do dia, cada um com a fonte dita em voz alta; a aula
 * da semana; e o fechamento. Sem fato, fala só da aula; sem aula, só dos fatos. Fica sempre em até 300 palavras:
 * passando, sai o último fato (até sobrar um) e, se ainda passar, o resumo da aula é encurtado.
 */
export function montarRoteiro({
  data,
  fatos,
  aulaDaSemana,
  idioma,
  frases,
}: {
  data: Date;
  fatos: readonly FatoDoRoteiro[];
  aulaDaSemana: AulaDoRoteiro | null;
  idioma: string;
  frases: FrasesDoRoteiro;
}): Roteiro {
  const comFonte = fatos
    .filter((f) => Number.isInteger(f.ano) && typeof f.texto === "string" && f.texto.trim().length > 0)
    .map((f) => ({ fato: f, fonte: fonteDe(f.link, frases) }))
    .filter((x): x is { fato: FatoDoRoteiro; fonte: string } => x.fonte !== null)
    .slice(0, MAX_FATOS);

  const montar = (quantos: number, resumo: string | null): ParteDoRoteiro[] => {
    const partes: ParteDoRoteiro[] = [{ tipo: "saudacao", texto: preencher(frases.saudacao, { data: dataPorExtenso(data, idioma) }) }];
    const usados = comFonte.slice(0, quantos);
    if (usados.length) {
      partes.push({ tipo: "fatosAbre", texto: frases.fatosAbre });
      for (const { fato, fonte } of usados) partes.push({ tipo: "fato", texto: preencher(frases.fato, { fonte, ano: fato.ano, texto: comPonto(fato.texto) }), link: fato.link });
    }
    if (aulaDaSemana) {
      const r = resumo === null ? comPonto(aulaDaSemana.resumo) : resumo;
      const texto = preencher(frases.aula, { titulo: aulaDaSemana.titulo, trilha: aulaDaSemana.trilha, resumo: r, minutos: aulaDaSemana.minutos })
        .replace(/\s{2,}/g, " ")
        .trim();
      partes.push({ tipo: "aula", texto });
    }
    partes.push({ tipo: "fechamento", texto: frases.fechamento });
    return partes;
  };
  const contar = (partes: ParteDoRoteiro[]) => contarPalavras(partes.map((p) => p.texto).join(" "));

  let quantos = comFonte.length;
  let partes = montar(quantos, null);
  while (contar(partes) > LIMITE_DE_PALAVRAS && quantos > 1) partes = montar(--quantos, null);
  if (contar(partes) > LIMITE_DE_PALAVRAS && aulaDaSemana) {
    const semResumo = contar(montar(quantos, ""));
    partes = montar(quantos, cortarPalavras(comPonto(aulaDaSemana.resumo), LIMITE_DE_PALAVRAS - semResumo));
  }
  // Ainda passando (fato enorme, título enorme): fica o que cabe, sem cortar frase no meio de um fato.
  while (contar(partes) > LIMITE_DE_PALAVRAS && quantos > 0) partes = montar(--quantos, aulaDaSemana ? "" : null);
  if (contar(partes) > LIMITE_DE_PALAVRAS) partes = partes.filter((p) => p.tipo !== "aula");

  const texto = partes.map((p) => p.texto).join("\n\n");
  return { partes, texto, palavras: contarPalavras(texto), fatos: comFonte.slice(0, quantos).map((x) => x.fato) };
}

/** Os fatos curados de um dia (content/neste-dia.json usa "MM-DD"). */
export function fatosCuradosDoDia<T extends { dia: string }>(curados: readonly T[], data: Date): T[] {
  const [, mes, dia] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(data).split("-");
  return curados.filter((f) => f.dia === `${mes}-${dia}`);
}
