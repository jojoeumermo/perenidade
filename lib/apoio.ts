// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A página de Apoie e a prestação de contas: os tipos, a configuração inicial (os valores da campanha que já existe na
// Benfeitoria, os mesmos de interno.apoio_padrao no banco), o dinheiro escrito do jeito de cada idioma e o texto sugerido
// para a campanha. Nada aqui inventa número: o que não foi informado pela coordenação simplesmente não aparece.
import { htmlLang, type Locale } from "@/i18n/config";

export interface Faixa {
  valor: number;
  nome: string;
  descricao: string;
}
export interface Meta {
  alvo: number;
  texto: string;
}
export interface Custo {
  categoria: string;
  valor: number | null;
  dolar: boolean;
  descricao: string;
}
export interface Confirmavel {
  texto: string;
  confirmado: boolean;
}
export interface ConfigDoApoio {
  link: string;
  faixas: Faixa[];
  metas: { meta1: Meta; meta2: Meta | null; intermediaria: { texto: string; alvo: number; unidade: "apoiadores" | "reais" } | null };
  campanha: { mensal: number; apoiadores: number; em: string } | null;
  custos: Custo[];
  responsavel: Confirmavel;
  taxa: Confirmavel;
  cancelamento: Confirmavel;
  faq: { p: string; r: string }[];
}
export interface Relatorio {
  mes: string;
  dados: { entradas: Record<string, number>; saidas: Record<string, number>; total_entradas: number; total_saidas: number; saldo: number };
  nota?: string;
  publicado_em: string;
  historico?: { dados: Relatorio["dados"]; nota: string; publicado_em: string; corrigido_em: string; motivo: string }[];
}
/** O que a página pública recebe: os textos "a confirmar" já vêm só quando confirmados (texto ou null). */
export interface Vitrine extends Omit<ConfigDoApoio, "responsavel" | "taxa" | "cancelamento"> {
  responsavel: string | null;
  taxa: string | null;
  cancelamento: string | null;
  mural: { id: string; nome: string; mensagem: string }[];
  voluntarios: number;
  nomes_voluntarios: string[];
  contribuicoes_publicadas: number;
  relatorio: Relatorio | null;
  atualizado_em?: string | null;
  previa?: boolean;
}
/** Contagens do próprio site, feitas no build a partir do conteúdo publicado. */
export interface NumerosDoSite {
  obras: number;
  aulas: number;
  traducoes: number;
  idiomas: number;
}

export const LINK_DA_CAMPANHA = "https://benfeitoria.com/projeto/instituto-lucia-28cx";

export const CONFIG_INICIAL: ConfigDoApoio = {
  link: LINK_DA_CAMPANHA,
  faixas: [
    { valor: 10, nome: "Página", descricao: "" },
    { valor: 25, nome: "Capítulo", descricao: "" },
    { valor: 50, nome: "Livro", descricao: "" },
    { valor: 100, nome: "Estante", descricao: "" },
    { valor: 200, nome: "Biblioteca", descricao: "" },
  ],
  metas: { meta1: { alvo: 550, texto: "Cobre todas as contas fixas do site" }, meta2: { alvo: 1000, texto: "" }, intermediaria: null },
  campanha: null,
  custos: [],
  responsavel: { texto: "", confirmado: false },
  taxa: { texto: "", confirmado: false },
  cancelamento: { texto: "", confirmado: false },
  faq: [],
};

export const VITRINE_INICIAL: Vitrine = {
  ...CONFIG_INICIAL,
  responsavel: null,
  taxa: null,
  cancelamento: null,
  mural: [],
  voluntarios: 0,
  nomes_voluntarios: [],
  contribuicoes_publicadas: 0,
  relatorio: null,
};

/** Reais no formato de cada idioma ("R$ 10", "R$ 1.000,50"), sem centavos quando o valor é redondo. */
export function reais(valor: number, lang: Locale | string = "pt"): string {
  const tag = htmlLang[lang as Locale] ?? "pt-BR";
  const redondo = Math.round(valor * 100) % 100 === 0;
  return new Intl.NumberFormat(tag, { style: "currency", currency: "BRL", minimumFractionDigits: redondo ? 0 : 2, maximumFractionDigits: 2 }).format(valor);
}

/** "2026-09-01" → "setembro de 2026" (no idioma da página). */
export function nomeDoMes(mes: string, lang: Locale | string = "pt"): string {
  const [ano, m] = mes.slice(0, 7).split("-").map(Number);
  return new Intl.DateTimeFormat(htmlLang[lang as Locale] ?? "pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(ano, m - 1, 1)));
}

/** "2026-10-10" (ou um instante) → data curta no idioma da página, sem escorregar de dia pelo fuso. */
export function dataCurta(iso: string, lang: Locale | string = "pt"): string {
  const so = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const d = so ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
  return new Intl.DateTimeFormat(htmlLang[lang as Locale] ?? "pt-BR", { dateStyle: "long", ...(so ? { timeZone: "UTC" } : {}) }).format(d);
}

/** Quantos apoios de uma faixa cobrem a Meta 1 (as contas fixas). */
export const apoiosParaAMeta = (meta: number, faixa: number) => Math.max(1, Math.ceil(meta / faixa));

/**
 * O texto sugerido para a descrição da campanha e para a atualização mensal na Benfeitoria, montado só com números
 * reais: contagens do site, dados da campanha informados pela coordenação e o último relatório publicado.
 */
export function textoParaBenfeitoria(numeros: NumerosDoSite & { voluntarios: number }, config: ConfigDoApoio, relatorio: Relatorio | null): { descricao: string; atualizacao: string } {
  const r = (v: number) => reais(v, "pt");
  const metas = [`Meta 1: ${r(config.metas.meta1.alvo)} por mês${config.metas.meta1.texto ? ` (${config.metas.meta1.texto.toLowerCase()})` : ""}.`];
  if (config.metas.meta2) metas.push(`Meta 2: ${r(config.metas.meta2.alvo)} por mês${config.metas.meta2.texto ? ` (${config.metas.meta2.texto.toLowerCase()})` : ""}.`);
  const faixas = config.faixas.map((f) => `${f.nome}: ${r(f.valor)} por mês`).join("; ");
  const descricao = [
    "O Instituto Lúcia é uma escola e biblioteca comunitária, gratuita e sem anúncios, mantida por trabalho voluntário (institutolucia.org).",
    `Hoje o site tem ${numeros.obras.toLocaleString("pt-BR")} obras no acervo, ${numeros.aulas.toLocaleString("pt-BR")} aulas publicadas e ${numeros.traducoes.toLocaleString("pt-BR")} traduções de aulas, em ${numeros.idiomas} idiomas, com ${numeros.voluntarios.toLocaleString("pt-BR")} voluntários ativos.`,
    "O acervo continua gratuito para todo mundo, com ou sem apoio, e não há conteúdo exclusivo para quem apoia.",
    `O apoio é mensal: ${faixas}.`,
    ...metas,
    "As contas de cada mês são publicadas em institutolucia.org/pt/apoie/contas.",
  ].join("\n\n");
  const linhas = relatorio
    ? [
        `Contas de ${nomeDoMes(relatorio.mes)}: entraram ${r(Number(relatorio.dados.total_entradas))} e saíram ${r(Number(relatorio.dados.total_saidas))} (saldo de ${r(Number(relatorio.dados.saldo))}).`,
        Object.keys(relatorio.dados.saidas).length ? `Para onde foi: ${Object.entries(relatorio.dados.saidas).map(([c, v]) => `${c.toLowerCase()} (${r(Number(v))})`).join(", ")}.` : "",
      ]
    : ["O primeiro relatório mensal de contas ainda vai ser publicado."];
  const atualizacao = [
    ...linhas.filter(Boolean),
    `No site: ${numeros.obras.toLocaleString("pt-BR")} obras, ${numeros.aulas.toLocaleString("pt-BR")} aulas e ${numeros.traducoes.toLocaleString("pt-BR")} traduções, com ${numeros.voluntarios.toLocaleString("pt-BR")} voluntários ativos.`,
    config.campanha ? `A campanha somava ${r(config.campanha.mensal)} por mês, de ${config.campanha.apoiadores} apoios, em ${dataCurta(config.campanha.em)}.` : "",
    "Obrigado a quem apoia, e a quem estuda, compartilha e trabalha com a gente. Prestação de contas completa: institutolucia.org/pt/apoie/contas",
  ]
    .filter(Boolean)
    .join("\n\n");
  return { descricao, atualizacao };
}
