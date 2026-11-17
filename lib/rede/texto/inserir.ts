// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os botões da barra de formatação (components/rede/texto/EditorDeTexto.tsx): cada um põe os sinais do texto formatado em volta do
// que está selecionado (ou de um exemplo, já selecionado para a pessoa escrever por cima). Puro: devolve o texto novo e a seleção.
// Sem "@/": roda no Node dos testes.

export type Marca = "negrito" | "italico" | "codigo" | "blocoDeCodigo" | "formula" | "titulo" | "lista" | "citacao" | "link" | `imagem${1 | 2 | 3 | 4}`;

export interface Edicao {
  valor: string;
  inicio: number;
  fim: number;
}

const ENVOLVE: Partial<Record<Marca, [string, string]>> = {
  negrito: ["**", "**"],
  italico: ["_", "_"],
  codigo: ["`", "`"],
  formula: ["$$", "$$"],
};
const PREFIXO: Partial<Record<Marca, string>> = { titulo: "## ", lista: "- ", citacao: "> " };

/** Garante que o trecho novo comece e termine numa linha só dele. */
function emLinhaPropria(antes: string, depois: string): [string, string] {
  const abre = antes === "" || antes.endsWith("\n\n") ? "" : antes.endsWith("\n") ? "\n" : "\n\n";
  const fecha = depois === "" || depois.startsWith("\n\n") ? "" : depois.startsWith("\n") ? "\n" : "\n\n";
  return [abre, fecha];
}

/** Aplica a marca à seleção [inicio, fim) de `valor`. `exemplo` entra quando nada está selecionado. */
export function aplicarMarca(valor: string, inicio: number, fim: number, marca: Marca, exemplo: string): Edicao {
  const a = Math.max(0, Math.min(inicio, valor.length));
  const b = Math.max(a, Math.min(fim, valor.length));
  const antes = valor.slice(0, a);
  const depois = valor.slice(b);
  const sel = valor.slice(a, b);
  const miolo = sel || exemplo;

  const envolve = ENVOLVE[marca];
  if (envolve) {
    const [abre, fecha] = envolve;
    const novo = `${antes}${abre}${miolo}${fecha}${depois}`;
    return { valor: novo, inicio: a + abre.length, fim: a + abre.length + miolo.length };
  }

  const prefixo = PREFIXO[marca];
  if (prefixo) {
    // A linha inteira onde está o cursor (ou todas as da seleção) ganha o prefixo; na lista numerada, cada uma o seu número.
    const comeco = antes.lastIndexOf("\n") + 1;
    const fimDaLinha = depois.indexOf("\n");
    const ate = fimDaLinha < 0 ? valor.length : b + fimDaLinha;
    const linhas = valor.slice(comeco, ate) || exemplo;
    const marcadas = linhas
      .split("\n")
      .map((l) => (l.startsWith(prefixo) ? l : `${prefixo}${l}`))
      .join("\n");
    const novo = `${valor.slice(0, comeco)}${marcadas}${valor.slice(ate)}`;
    return { valor: novo, inicio: comeco + prefixo.length, fim: comeco + marcadas.length };
  }

  if (marca === "blocoDeCodigo") {
    const [abre, fecha] = emLinhaPropria(antes, depois);
    const trecho = `\`\`\`\n${miolo}\n\`\`\``;
    const novo = `${antes}${abre}${trecho}${fecha}${depois}`;
    const i = a + abre.length + 4;
    return { valor: novo, inicio: i, fim: i + miolo.length };
  }

  if (marca === "link") {
    const trecho = `[${miolo}](https://)`;
    const i = a + miolo.length + 3;
    return { valor: `${antes}${trecho}${depois}`, inicio: i, fim: i + "https://".length };
  }

  // imagem1 a imagem4: a imagem anexada, numa linha só dela.
  const n = Number(marca.slice(-1));
  const [abre, fecha] = emLinhaPropria(antes, depois);
  const trecho = `![${miolo}](imagem:${n})`;
  const i = a + abre.length + 2;
  return { valor: `${antes}${abre}${trecho}${fecha}${depois}`, inicio: i, fim: i + miolo.length };
}
