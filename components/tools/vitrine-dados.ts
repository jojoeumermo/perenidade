// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os dados da vitrine das ferramentas que o servidor também usa (ícones, frases): fora do módulo do navegador, para a
// página do servidor poder chamar.
import type { Dict } from "@/i18n/types";

/** Um ícone para cada ferramenta (emoji: leve, sem arquivo e legível em qualquer tela). */
export const ICONES: Record<string, string> = {
  resolvedor: "🧮", calculadora: "🔢", graficos: "📈", estatistica: "📊", "conversor-de-unidades": "📏", "tabela-verdade": "✅", "tabela-periodica": "⚗️",
  "massa-molar": "⚖️", balanceamento: "🧪", punnett: "🧬", "sistema-solar": "🪐", python: "🐍", php: "🐘", html: "🌐", "bases-numericas": "💾", cronometro: "⏱️",
  redacao: "✍️", silabario: "🔤", dicionario: "📖", pronuncia: "🗣️", frases: "💬", afinador: "🎸", metronomo: "🥁", teclado: "🎹", "leitura-de-notas": "🎼",
  cores: "🎨", "escala-cartografica": "🗺️", "fusos-horarios": "🌍", "juros-compostos": "💰", "mais-valia": "🏭", rcp: "❤️‍🩹", "frequencia-cardiaca": "💓",
  ide: "💻", simulacoes: "🔬", "fisica-simulada": "🎯", reacoes: "💥",
};

export interface ItemDaVitrine {
  id: string;
  nome: string;
  descricao: string;
  grupo: string;
  materias: string;
  offline: boolean;
}

/** Só as frases que a vitrine e a moldura usam (o dicionário inteiro das ferramentas é grande demais para mandar). */
export type Textos = Pick<Dict["tools"], "findTool" | "allGroups" | "favorites" | "recent" | "favorite" | "unfavorite" | "focus" | "noResults" | "labsTitle" | "labsText" | "countTools" | "copyLink" | "linkCopied" | "localNote"> & { offline: string };
export const textosDe = (t: Dict): Textos => ({
  findTool: t.tools.findTool, allGroups: t.tools.allGroups, favorites: t.tools.favorites, recent: t.tools.recent, favorite: t.tools.favorite, unfavorite: t.tools.unfavorite,
  focus: t.tools.focus, noResults: t.tools.noResults, labsTitle: t.tools.labsTitle, labsText: t.tools.labsText, countTools: t.tools.countTools, copyLink: t.tools.copyLink,
  linkCopied: t.tools.linkCopied, localNote: t.tools.localNote, offline: t.lists.offline,
});

