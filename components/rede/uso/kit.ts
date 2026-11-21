// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O kit de bolso do ato (R1): os contatos da assessoria jurídica que a pessoa escolheu, as anotações dela e o dia em que
// guardou, num pedaço só do armazenamento do navegador. Fica SÓ no aparelho: é montado com a lista que o modo ato já lê
// (public.alumia_ato_assessorias), não há chamada própria para "baixar o kit" e nada sobre ele vai ao servidor, então a Alumia
// não tem como saber quem guardou. A chave começa com o prefixo da Alumia (lib/rede/saida.ts, PREFIXO_DA_REDE): o "Sair rápido"
// e os três Esc apagam o kit junto com o resto.
// Sem "@/" de propósito: roda no Node nos testes (scripts/testar-r1-uso-telas.mjs).

/** A chave do kit no localStorage (com o prefixo que o "Sair rápido" apaga). */
export const CHAVE_DO_KIT = "lucia:rede:kit-do-ato";
/** Tetos: o banco já limita cada plantão a 400 letras; aqui também, para um armazenamento adulterado não encher a tela. */
export const MAXIMO_DE_ASSESSORIAS = 20;
export const MAXIMO_DO_TEXTO = 400;

export interface AssessoriaNoKit {
  nome: string;
  texto: string;
}

export interface KitDoAto {
  versao: 1;
  /** O dia e a hora em que a pessoa guardou (ISO), para ela saber se o kit está velho. */
  guardado_em: string;
  assessorias: AssessoriaNoKit[];
  notas: string;
}

/** O mínimo de um armazenamento (localStorage, ou um falso nos testes). */
export interface ArmazemDoKit {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
  removeItem(chave: string): void;
}

const limpar = (x: unknown, max: number) =>
  typeof x === "string"
    ? x
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
        .trim()
        .slice(0, max)
    : "";

/** Monta o kit com as assessorias escolhidas (pelo nome da organização, sem o @ de ninguém) e as anotações. */
export function montarKit(assessorias: readonly { nome: string; texto: string | null }[], notas: string, agora: Date = new Date()): KitDoAto {
  return {
    versao: 1,
    guardado_em: agora.toISOString(),
    assessorias: assessorias
      .map((a) => ({ nome: limpar(a.nome, 120), texto: limpar(a.texto, MAXIMO_DO_TEXTO) }))
      .filter((a) => a.nome && a.texto)
      .slice(0, MAXIMO_DE_ASSESSORIAS),
    notas: limpar(notas, MAXIMO_DO_TEXTO),
  };
}

/** Lê o kit guardado; nulo se não houver, se o armazenamento estiver bloqueado ou se o conteúdo não for um kit. */
export function lerKit(armazem: ArmazemDoKit | null | undefined): KitDoAto | null {
  if (!armazem) return null;
  try {
    const bruto = armazem.getItem(CHAVE_DO_KIT);
    if (!bruto) return null;
    const x = JSON.parse(bruto) as Partial<KitDoAto>;
    if (!x || x.versao !== 1 || typeof x.guardado_em !== "string" || Number.isNaN(Date.parse(x.guardado_em)) || !Array.isArray(x.assessorias)) return null;
    const kit = montarKit(
      x.assessorias.filter((a): a is AssessoriaNoKit => !!a && typeof a === "object"),
      typeof x.notas === "string" ? x.notas : "",
      new Date(x.guardado_em),
    );
    return kit;
  } catch {
    return null;
  }
}

/** Guarda o kit. Falso quando o aparelho não deixa (modo privado, sem espaço). */
export function guardarKit(armazem: ArmazemDoKit | null | undefined, kit: KitDoAto): boolean {
  if (!armazem) return false;
  try {
    armazem.setItem(CHAVE_DO_KIT, JSON.stringify(kit));
    return true;
  } catch {
    return false;
  }
}

/** Apaga o kit deste aparelho. Nunca lança. */
export function apagarKit(armazem: ArmazemDoKit | null | undefined): void {
  try {
    armazem?.removeItem(CHAVE_DO_KIT);
  } catch {
    // armazenamento bloqueado: não há o que apagar
  }
}

/** O localStorage, ou nulo quando o navegador o bloqueia. */
export function armazemDoAparelho(): ArmazemDoKit | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}
