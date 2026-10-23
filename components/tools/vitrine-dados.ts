// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os dados da vitrine das ferramentas que o servidor também usa (ícones, frases): fora do módulo do navegador, para a
// página do servidor poder chamar.
import type { Dict } from "@/i18n/types";

/** Um selo desenhado para cada ferramenta (o nome do desenho em components/Selo.tsx). */
export const ICONES: Record<string, string> = {
  resolvedor: "abaco", calculadora: "calculadora", graficos: "grafico", estatistica: "barras", "conversor-de-unidades": "regua", "tabela-verdade": "check", "tabela-periodica": "frasco",
  "massa-molar": "balanca", balanceamento: "tubo", punnett: "dna", "sistema-solar": "planeta", python: "py", php: "php", html: "tags", "bases-numericas": "binario", cronometro: "cronometro",
  redacao: "caneta", silabario: "silabas", dicionario: "livro", pronuncia: "boca", frases: "balao", afinador: "diapasao", metronomo: "metronomo", teclado: "teclado", "leitura-de-notas": "nota",
  cores: "paleta", "escala-cartografica": "mapa", "fusos-horarios": "fuso", "juros-compostos": "moedas", "mais-valia": "fabrica", rcp: "coracao", "frequencia-cardiaca": "pulso",
  ide: "terminal", simulacoes: "microscopio", "fisica-simulada": "alvo", reacoes: "reacao",
  algoritmos: "fluxo", criptografia: "cadeado", grafos: "grafo", sudoku: "quebracabeca", "referencias-abnt": "livros", "palavras-geradoras": "tijolos", solidos: "cubo", "contas-do-dia-a-dia": "recibo", "tons-do-mandarim": "onda", alfabetos: "letras", ceu: "lua", "calculadoras-de-eletronica": "tomada", "direitos-trabalhistas": "balanca", "dicionario-chines": "hanzi", "escrita-chinesa": "pincel", "corretor-ortografico": "lapis",
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

