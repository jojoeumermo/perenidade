// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 4, item 133 (atrás de "alumia-p4-pontes"): o leitor de fios. O banco (public.rede_p4_fio_texto) já junta só o que quem lê
// pode ver; aqui ficam as regras puras da tela: os parágrafos do fio e o texto para ouvir (a voz é a do aparelho, como o "Ouvir" da
// aula: lib/rede/midia/voz.ts; nada vai à rede). Sem "@/" de propósito.
import type { FioComoTexto } from "./cliente";

export interface ParagrafoDoFio {
  id: string;
  titulo: string | null;
  linhas: string[];
}

/** Cada parte do fio vira um bloco: o título (se houver) e o texto em parágrafos (as linhas vazias separam). */
export function paragrafosDoFio(fio: FioComoTexto | null | undefined): ParagrafoDoFio[] {
  return (fio?.itens ?? []).map((p) => {
    const bruto = [p.texto, p.corpo].filter((x): x is string => typeof x === "string" && x.trim().length > 0).join("\n\n");
    const linhas = bruto.split(/\n\s*\n/).map((x) => x.replace(/\s+/g, " ").trim()).filter(Boolean);
    return { id: p.id, titulo: p.titulo?.trim() ? p.titulo.trim() : null, linhas };
  });
}

/** O fio inteiro como um texto só, para a voz do aparelho ler do começo ao fim. */
export function textoDoFioParaOuvir(fio: FioComoTexto | null | undefined): string {
  return paragrafosDoFio(fio)
    .map((b) => [b.titulo, ...b.linhas].filter(Boolean).join(". "))
    .join(". ")
    .replace(/\.\s*\./g, ".")
    .trim();
}
