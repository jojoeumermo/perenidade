// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Tipos do pacote "consertos" da Rede (docs/rede/V2.md, itens 1 a 9 do R4). Valem para a Rede de hoje e para a v2.
// Sem "@/" de propósito (roda no Node nos testes).

/** Idade mínima da Rede. LGPD art. 14; ECA Digital (Lei 15.211/2025) art. 9º, §1º: a autodeclaração é trava de produto, não aferição. */
export const IDADE_MINIMA_REDE = 18;

/** Os modos da linha da Rede de hoje. */
export type ModoDaLinha = "tudo" | "seguindo" | "minhas" | "chamados" | "comunidade" | "perfil";
/** As abas que têm contador "N novos". */
export type AbaComContador = "seguindo" | "minhas" | "tudo";

export interface PaginaDaLinhaAntiga<P> {
  itens: P[];
  /** O cursor da próxima página; nulo quando acabou. */
  proximo: string | null;
}

/** O mais que o contador diz: 100 ("99+"). */
export const TETO_DOS_NOVOS = 100;
export const rotuloDosNovos = (n: number): string => (n >= TETO_DOS_NOVOS ? "99+" : String(n));

export interface ConviteCriado {
  id: string;
  /** O código aparece uma única vez; o banco guarda só o hash. */
  codigo: string;
  validade: string;
  usos_max: number;
  escopo: "membro" | "mediacao";
}
export interface ConviteDaLista {
  id: string;
  escopo: "membro" | "mediacao";
  validade: string;
  usos: number;
  usos_max: number;
  revogado: boolean;
  vencido: boolean;
  criado_em: string;
}
/** O que volta de um convite: entrou ({ok: true, ...}) ou não vale ({ok: false}: o banco não diz por quê). */
export type EntradaPorConvite =
  | { ok: true; tipo: "espaco"; slug: string; nome: string; antigo?: boolean }
  | { ok: true; tipo: "nucleo"; nucleo: string; nome: string }
  | { ok: false; erro: "convite_vencido" };

/** Um código novo de convite: 32 letras e números (aceita traços e espaços, que são tirados). */
export const normalizarConvite = (texto: string): string => texto.replace(/[^a-zA-Z0-9]/g, "");
export const conviteNovoOk = (texto: string): boolean => /^[a-fA-F0-9]{32}$/.test(normalizarConvite(texto));
/** O código antigo de espaço: 12 caracteres, valem só até a data de expiração. */
export const conviteAntigoOk = (texto: string): boolean => /^[A-Za-z0-9]{12}$/.test(texto.trim());
export const conviteOk = (texto: string): boolean => conviteNovoOk(texto) || conviteAntigoOk(texto);
/** O código em grupos de quatro, para ler e copiar sem erro. */
export const agruparConvite = (codigo: string): string => codigo.replace(/(.{4})(?=.)/g, "$1-");
