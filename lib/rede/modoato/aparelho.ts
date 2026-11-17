// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O modo ato NESTE aparelho (frente 9C): ligado ou não, desde quando e qual assessoria jurídica a pessoa escolheu para o "Fui
// detido". Fica só no localStorage, nunca vai ao servidor: ninguém fica sabendo que a pessoa ligou o modo ato, nem quando. O
// pânico (lib/rede/saida.ts) apaga tudo junto com o resto do aparelho. Sem React e sem "@/": roda no navegador e no Node dos
// testes, com um armazém de mentira.

export interface EstadoDoModoAto {
  ligado: boolean;
  /** Quando foi ligado (milissegundos); nulo desligado. */
  desde: number | null;
  /** O @ da organização cuja assessoria jurídica a pessoa escolheu (sem o @); nulo = só os contatos. */
  org: string | null;
}

/** O pedaço de Storage de que o modo ato precisa (localStorage, ou um de mentira no teste). */
export type Armazem = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const CHAVE_DO_MODO_ATO = "alumia:modo-ato";
/** O evento que a página dispara quando o estado muda (as peças na tela escutam). */
export const EVENTO_DO_MODO_ATO = "alumia-modo-ato";
/** O modo ato desliga sozinho depois de 18 horas (um ato não dura mais que isso; ninguém fica com a tela pela metade dias depois). */
export const DURACAO_MAXIMA_MS = 18 * 60 * 60 * 1000;

export const DESLIGADO: EstadoDoModoAto = { ligado: false, desde: null, org: null };

const HANDLE = /^[a-z0-9_]{3,20}$/;

/** Lê o estado guardado; qualquer coisa torta, vencida ou do futuro vale "desligado" (mantendo a organização escolhida). */
export function lerModoAto(armazem: Armazem | null, agora = Date.now()): EstadoDoModoAto {
  if (!armazem) return DESLIGADO;
  let bruto: string | null = null;
  try {
    bruto = armazem.getItem(CHAVE_DO_MODO_ATO);
  } catch {
    return DESLIGADO;
  }
  if (!bruto) return DESLIGADO;
  try {
    const x = JSON.parse(bruto) as Partial<EstadoDoModoAto> | null;
    const org = typeof x?.org === "string" && HANDLE.test(x.org) ? x.org : null;
    const desde = typeof x?.desde === "number" && Number.isFinite(x.desde) ? x.desde : null;
    const vale = x?.ligado === true && desde !== null && desde <= agora + 60_000 && agora - desde < DURACAO_MAXIMA_MS;
    return vale ? { ligado: true, desde, org } : { ligado: false, desde: null, org };
  } catch {
    return DESLIGADO;
  }
}

/** Grava o estado (ou apaga, quando não sobra nada a lembrar). Sem armazenamento, só não lembra. */
export function gravarModoAto(armazem: Armazem | null, estado: EstadoDoModoAto): void {
  if (!armazem) return;
  try {
    if (!estado.ligado && !estado.org) armazem.removeItem(CHAVE_DO_MODO_ATO);
    else armazem.setItem(CHAVE_DO_MODO_ATO, JSON.stringify(estado));
  } catch {
    // sem espaço ou bloqueado: a tela continua, só não lembra depois
  }
}

/** Liga ou desliga, mantendo a organização escolhida. */
export function trocarModoAto(armazem: Armazem | null, ligar: boolean, agora = Date.now()): EstadoDoModoAto {
  const antes = lerModoAto(armazem, agora);
  const novo: EstadoDoModoAto = ligar ? { ligado: true, desde: antes.ligado ? antes.desde : agora, org: antes.org } : { ligado: false, desde: null, org: antes.org };
  gravarModoAto(armazem, novo);
  return novo;
}

/** Escolhe (ou tira, com nulo) a assessoria jurídica do "Fui detido". */
export function escolherOrg(armazem: Armazem | null, org: string | null, agora = Date.now()): EstadoDoModoAto {
  const limpo = org ? org.replace(/^@/, "").toLowerCase() : null;
  const novo = { ...lerModoAto(armazem, agora), org: limpo && HANDLE.test(limpo) ? limpo : null };
  gravarModoAto(armazem, novo);
  return novo;
}

/** O armazém do navegador, ou nulo (servidor, aba privada que bloqueia, prévia de miniatura). */
export function armazemDoNavegador(): Armazem | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
