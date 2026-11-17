// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A comunicação da organização (onda 12, frente 12E; supabase/migracoes/20261118-alumia-o12-org.sql): os tipos do que as funções
// devolvem, os limites (os mesmos do banco: o teste confere) e as regras puras que a tela usa antes de mandar. O banco confere tudo
// de novo. Sem "@/" de propósito (roda no Node nos testes: scripts/testar-alumia-o12-org.mjs).
//
// Privacidade (LGPD art. 5º, II e art. 11): nenhum tipo aqui traz pessoa. Da fila vem só "meu" (fui eu que escrevi) e se eu posso
// decidir; do boletim, o número de quem assina só a partir de 3; do núcleo chamado, quantas pessoas foram avisadas só a partir de 3.

export type PublicoDaOrg = "internet" | "membros" | "seguidores";
export const PUBLICOS_DA_ORG: readonly PublicoDaOrg[] = ["membros", "seguidores", "internet"];

/** Os limites do banco (o teste confere que são os mesmos da migração). */
export const LIMITES_DA_COMUNICACAO = {
  texto: 500,
  modeloNomeMin: 2,
  modeloNome: 40,
  modelos: 20,
  esperando: 30,
  boletimPosts: 12,
  boletimDias: 8,
  boletimIntervaloDias: 6,
  chamadasPorSemana: 2,
  venceDias: 14,
} as const;

export type SituacaoNaFila = "esperando" | "aprovado" | "recusado" | "retirado" | "vencido";

export interface ItemDaFila {
  id: string;
  tipo: "post" | "boletim";
  texto: string;
  publico: PublicoDaOrg;
  situacao: SituacaoNaFila;
  motivo: string | null;
  criadoEm: string;
  decididoDia: string | null;
  /** Fui eu que escrevi (só enquanto espera: na decisão o banco esquece quem escreveu). */
  meu: boolean;
  /** Posso aprovar ou recusar: espera e não fui eu que escrevi. */
  possoDecidir: boolean;
  /** Os posts escolhidos para o boletim (só no tipo "boletim"). */
  boletim: { id: string; texto: string }[] | null;
  post: string | null;
  /** O post aprovado ficou retido pela triagem (vai para a mediação, como qualquer post). */
  retido: boolean | null;
}

export interface ModeloDaOrg { id: string; nome: string; texto: string; publico: PublicoDaOrg }

export interface NucleoParaChamar { id: string; nome: string; restam: number; volta: string | null }

export interface BoletimDaComunicacao {
  /** Quantas pessoas assinam (nulo abaixo de 3). */
  assinantes: number | null;
  porEmail: number | null;
  ultimo: string | null;
  /** Quando pode sair o próximo (nulo: já pode). */
  proximo: string | null;
  /** Os posts da organização dos últimos 8 dias que podem entrar. */
  posts: { id: string; texto: string; publico: string; criadoEm: string }[];
}

export interface DominioDaComunicacao {
  dominio: string;
  situacao: "esperando" | "verificado";
  metodo: "txt" | "arquivo" | null;
  verificadoEm: string | null;
  conferidoEm: string | null;
  txtNome: string;
  txtValor: string;
  arquivo: string;
  arquivoTexto: string;
}

export interface ComunicacaoDaOrg {
  comunico: boolean;
  gerencio: boolean;
  selo: boolean;
  fila: ItemDaFila[];
  modelos: ModeloDaOrg[];
  nucleos: NucleoParaChamar[];
  boletim: BoletimDaComunicacao | null;
  dominio: DominioDaComunicacao | null;
}

export interface MeuBoletim { assino: boolean; email: boolean; saidos: { post: string; saiuEm: string }[] }

export interface ResultadoDaChamada { post: string; retido: boolean; avisadas: number | null; restam: number; volta: string | null }

/** O domínio verificado que o perfil mostra. */
export interface DominioVerificado { dominio: string; desde: string }

/** O que a rota do servidor devolve depois de conferir o domínio. */
export type ConferenciaDoDominio = { ok: true; metodo: "txt" | "arquivo"; dominio: DominioDaComunicacao } | { ok: false; motivo: string; dominio: DominioDaComunicacao | null };

/** O texto cabe (1 a 500, sem só espaço)? Devolve o código do problema ou nulo. */
export function problemaDoTexto(texto: string): "vazio" | "longo" | null {
  const t = texto.trim();
  if (!t) return "vazio";
  if ([...t].length > LIMITES_DA_COMUNICACAO.texto) return "longo";
  return null;
}

/** Quantas letras ainda cabem (conta caractere, não unidade de código: emoji conta 1). */
export function restamLetras(texto: string): number {
  return LIMITES_DA_COMUNICACAO.texto - [...texto.trim()].length;
}

/** Separa a fila em "esperando" (o que pede ação) e "decididos" (o histórico curto). */
export function separarFila(fila: readonly ItemDaFila[]): { esperando: ItemDaFila[]; decididos: ItemDaFila[] } {
  return { esperando: fila.filter((i) => i.situacao === "esperando"), decididos: fila.filter((i) => i.situacao !== "esperando").slice(0, 20) };
}

/**
 * O domínio limpo como o banco aceita (interno.alumia_o12_dominio_limpo): minúsculas, sem esquema, sem caminho, sem porta, sem
 * "www." e sem ponto no fim; nome com acento vira a forma ASCII (xn--). Nulo se não serve (endereço numérico, nome reservado).
 */
export function dominioLimpo(entrada: string): string | null {
  let d = entrada.trim().toLowerCase();
  if (!d) return null;
  d = d.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  d = d.replace(/[/?#:].*$/, "");
  d = d.replace(/\.+$/, "");
  if (/[^\x20-\x7e]/.test(d)) {
    try {
      d = new URL(`https://${d}`).hostname;
    } catch {
      return null;
    }
  }
  d = d.replace(/^www\./, "");
  if (d.length < 4 || d.length > 253) return null;
  if (!/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,61}[a-z0-9]$/.test(d)) return null;
  if (/^[0-9.]+$/.test(d)) return null;
  if (dominioReservado(d)) return null;
  return d;
}

/** Nomes que nenhuma organização pode tomar (os mesmos de interno.alumia_o12_dominio_reservado, menos o endereço do site). */
export function dominioReservado(d: string): boolean {
  return (
    /\.(local|localhost|internal|intranet|lan|home|corp|onion|invalid|test|example|arpa|alt)$/.test(d) ||
    /^(localhost|example\.(com|org|net))$/.test(d) ||
    /(^|\.)institutolucia\.org$/.test(d)
  );
}
