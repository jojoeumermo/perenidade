// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// "Por onde andei" (Etapa 4, R1-21): as páginas que a pessoa viu nesta semana, guardadas só neste aparelho.
// COMEÇA DESLIGADO: num celular dividido ou vigiado, a lista mostraria os temas estudados (o modo seguro, R1-94, existe
// justamente para isso). Só grava depois que a pessoa aceita o convite ("lucia:historico-ligado"), nunca grava com o
// modo seguro ligado e nunca grava o painel, a entrada nem a própria página do modo seguro.
// As duas chaves ficam fora da cópia de segurança e saem no "apagar meus dados" (SO_APAGAR em lib/estudo.ts).
// Puro, com o armazenamento passado de fora: `npm run testar:busca-viva` roda este arquivo no Node.

export const CHAVE_HISTORICO = "lucia:historico";
export const CHAVE_LIGADO = "lucia:historico-ligado";
export const MAXIMO_DE_ITENS = 60;
export const DIAS_GUARDADOS = 7;
const DIA = 86_400_000;

export interface Visita {
  /** O caminho sem o idioma e sem a consulta ("/trilhas/x/y"). */
  caminho: string;
  titulo: string;
  /** Quando, em milissegundos. */
  em: number;
}

type Armazenamento = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const avisar = () => {
  try {
    globalThis.dispatchEvent?.(new Event("lucia:estudo"));
  } catch {
    // fora do navegador: nada a avisar
  }
};

/** Caminhos que nunca entram: o painel da equipe, a entrada, o modo seguro e esta própria lista. */
export function podeGuardar(caminho: string): boolean {
  return !/^\/(painel|entrar|modo-seguro|por-onde-andei)(\/|$)/.test(caminho);
}

/** O caminho sem o idioma do começo e sem consulta nem âncora: a consulta da busca nunca é guardada. */
export function semIdioma(caminho: string, idiomas: readonly string[]): string {
  const limpo = caminho.split(/[?#]/)[0] || "/";
  const [, primeiro] = limpo.split("/");
  if (primeiro && idiomas.includes(primeiro)) return limpo.slice(primeiro.length + 1) || "/";
  return limpo;
}

export function historicoLigado(armazenamento: Armazenamento): boolean {
  try {
    return armazenamento.getItem(CHAVE_LIGADO) === "1";
  } catch {
    return false;
  }
}

export function ligarHistorico(armazenamento: Armazenamento) {
  try {
    armazenamento.setItem(CHAVE_LIGADO, "1");
  } catch {
    // armazenamento cheio ou bloqueado: continua desligado
  }
  avisar();
}

/** "Não guardar mais": desliga e apaga o que havia. */
export function naoGuardarMais(armazenamento: Armazenamento) {
  try {
    armazenamento.removeItem(CHAVE_LIGADO);
    armazenamento.removeItem(CHAVE_HISTORICO);
  } catch {
    // nada guardado
  }
  avisar();
}

/** "Apagar tudo": apaga a lista e continua guardando. */
export function apagarHistorico(armazenamento: Armazenamento) {
  try {
    armazenamento.removeItem(CHAVE_HISTORICO);
  } catch {
    // nada guardado
  }
  avisar();
}

const valida = (v: unknown): v is Visita =>
  Boolean(v) && typeof (v as Visita).caminho === "string" && (v as Visita).caminho.startsWith("/") && typeof (v as Visita).titulo === "string" && Number.isFinite((v as Visita).em);

/** As visitas dos últimos 7 dias, da mais nova para a mais velha (no máximo 60). Forma errada vira lista vazia. */
export function lerHistorico(armazenamento: Armazenamento, agora = Date.now()): Visita[] {
  let bruto: unknown;
  try {
    bruto = JSON.parse(armazenamento.getItem(CHAVE_HISTORICO) ?? "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(bruto)) return [];
  return bruto
    .filter(valida)
    .filter((v) => agora - v.em < DIAS_GUARDADOS * DIA && v.em <= agora + DIA)
    .sort((a, b) => b.em - a.em)
    .slice(0, MAXIMO_DE_ITENS);
}

/**
 * Guarda uma visita, se o histórico estiver ligado, o modo seguro desligado e o caminho puder entrar. A mesma página
 * vista de novo sobe para o topo (não repete). Devolve se gravou.
 */
export function registrarVisita(armazenamento: Armazenamento, visita: { caminho: string; titulo: string }, opcoes: { agora?: number; seguro?: boolean } = {}): boolean {
  const agora = opcoes.agora ?? Date.now();
  if (opcoes.seguro || !historicoLigado(armazenamento) || !podeGuardar(visita.caminho)) return false;
  const titulo = visita.titulo.trim().slice(0, 160) || visita.caminho;
  const lista = [{ caminho: visita.caminho.slice(0, 300), titulo, em: agora }, ...lerHistorico(armazenamento, agora).filter((v) => v.caminho !== visita.caminho)].slice(0, MAXIMO_DE_ITENS);
  try {
    armazenamento.setItem(CHAVE_HISTORICO, JSON.stringify(lista));
  } catch {
    return false;
  }
  avisar();
  return true;
}

/** Separa em "Hoje" (desde a meia-noite deste aparelho) e "Esta semana" (o resto dos 7 dias). */
export function agrupar(visitas: readonly Visita[], agora = Date.now()): { hoje: Visita[]; semana: Visita[] } {
  const meiaNoite = new Date(agora);
  meiaNoite.setHours(0, 0, 0, 0);
  const inicio = meiaNoite.getTime();
  return { hoje: visitas.filter((v) => v.em >= inicio), semana: visitas.filter((v) => v.em < inicio) };
}
