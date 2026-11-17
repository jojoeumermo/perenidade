// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// "Até onde li" nas conversas e nos tópicos do fórum (onda 10, frente 10A): pular para a primeira resposta nova. Fica SÓ neste
// aparelho (localStorage), nunca vai ao servidor: o que cada pessoa leu numa comunidade política é dado sensível (LGPD art. 5º,
// II, e art. 11), e um registro de quem leu o quê e quando seria um mapa de interesse. Por isso não acompanha a pessoa de um
// aparelho para outro.
//
// Guarda, por conversa (o id da raiz), o instante da resposta mais nova que já apareceu na tela. No máximo 300 conversas (as mais
// antigas saem). A chave começa com "lucia:rede", então o "Sair rápido" apaga junto (lib/rede/saida.ts).
// Sem "@/" de propósito: as funções puras rodam no Node nos testes.

export const CHAVE_DA_LEITURA = "lucia:rede:lido-ate";
export const MAX_CONVERSAS_LIDAS = 300;

/** O mínimo de um armazenamento (localStorage ou um falso nos testes). */
export interface ArmazemDeLeitura {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
}

/** O registro: conversa → instante (ISO) da resposta mais nova já vista. A ordem das chaves é a da última visita. */
export type RegistroDeLeitura = Record<string, string>;

const instanteOk = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v));

/** Lê o registro; qualquer coisa estranha (bloqueado, corrompido) vira registro vazio. */
export function lerRegistro(armazem: ArmazemDeLeitura | null | undefined): RegistroDeLeitura {
  if (!armazem) return {};
  try {
    const cru = JSON.parse(armazem.getItem(CHAVE_DA_LEITURA) ?? "{}") as unknown;
    if (!cru || typeof cru !== "object" || Array.isArray(cru)) return {};
    const limpo: RegistroDeLeitura = {};
    for (const [k, v] of Object.entries(cru as Record<string, unknown>)) if (k && instanteOk(v)) limpo[k] = v;
    return limpo;
  } catch {
    return {};
  }
}

/** Até onde a pessoa leu esta conversa neste aparelho (nulo: nunca abriu aqui). */
export function lidoAte(registro: RegistroDeLeitura, raiz: string): string | null {
  return registro[raiz] ?? null;
}

/**
 * Anota que a conversa foi vista até `instante` (nunca volta para trás) e a põe no fim da fila; acima do teto, saem as que foram
 * vistas há mais tempo. Puro: devolve o registro novo.
 */
export function anotar(registro: RegistroDeLeitura, raiz: string, instante: string, teto = MAX_CONVERSAS_LIDAS): RegistroDeLeitura {
  if (!raiz || !instanteOk(instante)) return registro;
  const antes = registro[raiz];
  const vale = antes && Date.parse(antes) > Date.parse(instante) ? antes : instante;
  const resto = Object.entries(registro).filter(([k]) => k !== raiz);
  const novo = [...resto, [raiz, vale] as [string, string]].slice(-Math.max(1, teto));
  return Object.fromEntries(novo);
}

/** Grava o registro; sem armazenamento (janela privada, bloqueado), não faz nada. */
export function gravarRegistro(armazem: ArmazemDeLeitura | null | undefined, registro: RegistroDeLeitura): void {
  if (!armazem) return;
  try {
    armazem.setItem(CHAVE_DA_LEITURA, JSON.stringify(registro));
  } catch {
    // cheio ou bloqueado: a régua só não aparece da próxima vez
  }
}

/** O instante mais novo de uma lista de respostas (o que vai ser anotado ao abrir). */
export function maisNova(respostas: readonly { criado_em: string }[]): string | null {
  let melhor: string | null = null;
  for (const r of respostas) if (instanteOk(r.criado_em) && (!melhor || Date.parse(r.criado_em) > Date.parse(melhor))) melhor = r.criado_em;
  return melhor;
}

/**
 * As respostas novas desde a última visita, na ORDEM DA TELA (a lista já vem na ordem de leitura): as que chegaram depois de
 * `desde` e não são da própria pessoa. Sem visita anterior (nulo), nada é "novo": tudo seria, e a régua não ajudaria.
 */
export function respostasNovas<T extends { id: string; criado_em: string; meu?: boolean }>(naOrdemDaTela: readonly T[], desde: string | null): T[] {
  if (!desde || !instanteOk(desde)) return [];
  const limite = Date.parse(desde);
  return naOrdemDaTela.filter((r) => !r.meu && instanteOk(r.criado_em) && Date.parse(r.criado_em) > limite);
}

/** O tópico teve resposta depois da última visita neste aparelho? (a marca "novas" da lista do fórum; nunca abriu: não marca) */
export function temNovidade(registro: RegistroDeLeitura, raiz: string, ultimaResposta: string): boolean {
  const visto = registro[raiz];
  return Boolean(visto) && instanteOk(ultimaResposta) && Date.parse(ultimaResposta) > Date.parse(visto);
}

/** O armazenamento do navegador, ou nulo (servidor, janela privada que bloqueia). */
export function armazemDoAparelho(): ArmazemDeLeitura | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}
