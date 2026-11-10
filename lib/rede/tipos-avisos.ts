// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os tipos do pacote avisos da Rede v2 (docs/rede/AVISOS.md). Sem "@/" de propósito (roda no Node nos testes).

/** Os tipos de aviso que a pessoa pode ligar e desligar. */
export const TIPOS_DE_AVISO = ["resposta", "mencao", "citacao", "seguidor", "chamado", "nucleo", "moderacao", "apoio"] as const;
export type TipoDeAviso = (typeof TIPOS_DE_AVISO)[number];

/** Os tipos que agrupam ("Ana e mais 3 responderam"); os outros trazem o próprio texto, escrito sem trecho de post. */
export const TIPOS_AGRUPADOS = ["resposta", "mencao", "citacao", "seguidor", "apoio"] as const;

/** Um grupo de avisos como `rede_aviso_listar` devolve. Nenhum trecho de post, nenhum nome em apoio. */
export interface ItemDeAviso {
  /** O aviso mais novo do grupo (serve para marcar o grupo como lido). */
  id: string;
  /** Nulo: aviso da conta ou antigo, sem estrutura (vem com `texto`). */
  tipo: TipoDeAviso | null;
  /** Quantos avisos o grupo junta. */
  total: number;
  /** Quantas pessoas diferentes. */
  pessoas: number;
  lido: boolean;
  criado_em: string;
  /** O post a que o grupo se refere, e (num aviso só) a resposta em si. */
  post: string | null;
  alvo: string | null;
  titulo: string | null;
  /** Até 2 codinomes, mais novo primeiro; nulo = pessoa fora do perfil visível. Sempre vazio em apoio. */
  atores: (string | null)[];
  texto: string | null;
}

export interface PaginaDeAvisos {
  itens: ItemDeAviso[];
  proximo: string | null;
  nao_lidos: number;
}

export interface PreferenciasDeAviso {
  /** Por tipo: ligado no site / no celular. */
  site: Record<TipoDeAviso, boolean>;
  push: Record<TipoDeAviso, boolean>;
  /** Resumo semanal por e-mail (desligado até a pessoa ligar). */
  resumo: boolean;
  push_aparelhos: number;
  /** Entrou na Rede (18+ com consentimento): só assim se liga e-mail ou celular. */
  membro: boolean;
}

export interface ResumoDeAviso {
  n: number;
  assunto?: string;
  texto?: string;
}

export type CanalDeAviso = "site" | "push" | "email";

/** As frases de um tipo agrupado, no idioma da pessoa. */
export interface FrasesDoTipo {
  um: string;
  vezes: string;
  varios: string;
  anonimo: string;
  anonimoVarios: string;
}

/**
 * Os textos fixos que o SERVIDOR grava em português (o aviso só guarda texto) e que a tela mostra no idioma de quem lê. A chave é
 * o texto exato gravado (a reserva para quem lê o aviso fora da Alumia); o valor, a frase em i18n/rede/avisos/*.json → "servidor".
 * O lembrete dos atos: supabase/migracoes/20261110-alumia-b1-atos.sql (interno.rede_ato_lembretes).
 */
export const TEXTOS_DO_SERVIDOR = {
  "Lembrete: um ato que você confirmou começa em menos de 24 horas.": "lembrete24h",
  "Lembrete: um ato que você confirmou começa em menos de 2 horas.": "lembrete2h",
} as const;
export type FraseDoServidor = (typeof TEXTOS_DO_SERVIDOR)[keyof typeof TEXTOS_DO_SERVIDOR];

const preencher = (texto: string, valores: Record<string, string | number>): string =>
  texto.replace(/\{(\w+)\}/g, (inteiro, nome: string) => (nome in valores ? String(valores[nome]) : inteiro));

/**
 * A frase de um grupo de avisos ("Ana e mais 3 responderam ao seu post."). Pura: recebe as frases do idioma. Apoio nunca tem nome
 * (só a quantidade), então cai sempre nas frases sem nome.
 */
export function fraseDoAviso(
  item: Pick<ItemDeAviso, "tipo" | "total" | "pessoas" | "atores" | "texto">,
  frases: Record<string, FrasesDoTipo>,
  reserva: string,
  doServidor?: Partial<Record<FraseDoServidor, string>>,
): string {
  const f = item.tipo ? frases[item.tipo] : undefined;
  if (!f) {
    const chave = item.texto ? (TEXTOS_DO_SERVIDOR as Record<string, FraseDoServidor>)[item.texto] : undefined;
    return (chave && doServidor?.[chave]) || item.texto || reserva;
  }
  const nome = item.tipo === "apoio" ? null : (item.atores[0] ?? null);
  if (nome) {
    if (item.pessoas > 1) return preencher(f.varios, { a: nome, n: item.pessoas - 1 });
    return item.total > 1 ? preencher(f.vezes, { a: nome, n: item.total }) : preencher(f.um, { a: nome });
  }
  return item.pessoas > 1 ? preencher(f.anonimoVarios, { n: item.pessoas }) : preencher(f.anonimo, {});
}

/** O endereço da tela de avisos. */
export const enderecoDosAvisos = (lang: string): string => `/${lang}/alumia/avisos`;
