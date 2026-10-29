// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useSyncExternalStore } from "react";

// Tudo o que o site guarda fica no navegador da pessoa, sob estas chaves. Não há servidor.
export const KEYS = {
  /** Menu do painel só com ícones (computador). */
  painelCompacto: "lucia:painel-compacto",
  /** Modo foco do painel: só as seções essenciais no menu. */
  painelFoco: "lucia:painel-foco",
  /** Modo leve do painel: sem animações, sombras nem texturas (aparelho fraco, internet ruim ou cansaço da vista). */
  painelLeve: "lucia:painel-leve",
  /** Depois de quantos minutos sem uso o painel se fecha neste aparelho ("0": nunca). */
  painelOcioso: "lucia:painel-ocioso",
  /** O último toque no painel, em qualquer aba deste navegador (uma aba esquecida não derruba a que está em uso). */
  painelUltimoUso: "lucia:painel-ultimo-uso",
  done: "lucia:concluidas",
  last: "lucia:ultima-aula",
  draft: "lucia:rascunho",
  theme: "lucia:tema",
  a11y: "lucia:acessibilidade",
  session: "lucia:sessao",
  // Primeiro nome da conta, para o cabeçalho dizer "Olá" sem esperar o serviço; sai junto com a sessão.
  name: "lucia:nome",
  // O ícone da conta (o de Minha conta), para o cabeçalho mostrar o rosto certo de imediato; sai junto com a sessão.
  avatar: "lucia:avatar",
  notes: "lucia:fichamento",
  radio: "lucia:radio",
  device: "lucia:aparelho",
  notice: "lucia:aviso",
  light: "lucia:leve",
  filter: "lucia:filtro",
  purge: "lucia:purga",
  seen: "lucia:visto",
  site: "lucia:site",
  passkey: "lucia:digital",
  // O rascunho da folha de redação e a última ferramenta aberta em cada disciplina (caixa de ferramentas das aulas).
  essay: "lucia:redacao",
  // Os itens já conferidos na revisão guiada da redação.
  essayCheck: "lucia:redacao-revisao",
  tools: "lucia:ferramentas",
  // A resposta do guia das disciplinas ("objetivo:etapa"), para o caminho sugerido continuar ali na próxima visita.
  guia: "lucia:guia",
  // O andamento e as respostas do teste dos 12 eixos (nivelamento), para continuar depois; nada sai do aparelho.
  eixos: "lucia:eixos",
  // Os grupos do menu do painel que a pessoa abriu ou fechou ({"Produção": true, ...}).
  painelGrupos: "lucia:painel-grupos",
} as const;

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

export function getItem(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

export function setItem(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Armazenamento indisponível (modo privado, cota): o site segue funcionando sem guardar nada.
  }
  listeners.forEach((listener) => listener());
}

/** Avisa os componentes de que algo mudou por fora de setItem (a sessão, gravada pelo cliente de contas). */
export function notifyStored() {
  listeners.forEach((listener) => listener());
}

export function parse<T>(raw: string, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function useStored(key: string): string {
  return useSyncExternalStore(
    subscribe,
    () => getItem(key),
    () => "",
  );
}

const noop = () => () => {};

/** false no servidor e na hidratação, true depois: para UI que depende do navegador. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
