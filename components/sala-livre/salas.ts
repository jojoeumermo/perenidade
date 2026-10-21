// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As salas da Sala livre: guardadas só no navegador do professor, cortadas em telas para projetar. Cada "## Título"
// começa uma tela; "## Título · 10 min" dá o tempo planejado da tela; linhas que começam com %% são notas do
// professor, que aparecem só no modo apresentador.

export interface Sala {
  id: string;
  titulo: string;
  para: string;
  objetivo: string;
  corpo: string;
  criada: string;
  atualizada: string;
}

export const CHAVE = "lucia:salas-livres";
export function lerSalas(): Sala[] {
  try {
    const lista = JSON.parse(window.localStorage.getItem(CHAVE) ?? "[]") as Sala[];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}
export function gravarSalas(salas: Sala[]) {
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(salas));
    return true;
  } catch {
    return false;
  }
}

export function telas(corpo: string) {
  const partes = corpo.split(/^(?=## )/m).map((p) => p.trim()).filter(Boolean);
  return partes.length ? partes : [corpo];
}

export interface Tela {
  titulo: string;
  minutos: number;
  texto: string;
  notas: string[];
}

const TEMPO = /\s*(?:[·•|(–—-]\s*)?(\d{1,3})\s*min(?:utos)?\)?\s*$/i;

/** Uma tela: o título sem o tempo, os minutos planejados, o texto para projetar (sem as notas) e as notas. */
export function separar(parte: string): Tela {
  const linhas = parte.split("\n");
  const nota = (l: string) => l.trimStart().startsWith("%%");
  const notas = linhas.filter(nota).map((l) => l.trimStart().slice(2).trim()).filter(Boolean);
  let texto = linhas.filter((l) => !nota(l)).join("\n");
  const cabeca = /^##\s+(.+)$/m.exec(texto);
  let titulo = "Abertura";
  let minutos = 0;
  if (cabeca) {
    const m = TEMPO.exec(cabeca[1]);
    minutos = m ? Math.min(240, Number(m[1])) : 0;
    titulo = cabeca[1].replace(TEMPO, "").trim() || cabeca[1].trim();
    texto = texto.replace(cabeca[0], `## ${titulo}`);
  }
  return { titulo, minutos, texto, notas };
}

export const roteiro = (corpo: string) => telas(corpo).map(separar);

/** O canal entre a tela projetada e a janela do apresentador (mesmo navegador, nada sai do aparelho). */
export const CANAL = "lucia-sala-livre";
export type Mensagem = { sala: string } & ({ tipo: "ir"; i: number } | { tipo: "estado"; i: number; inicio: number } | { tipo: "quem" });
