// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { TextosDaTelaDoNucleo } from "@/i18n/escola/nucleo";
import { linhaDaPresenca } from "@/lib/escola/nucleo";
import { preencher } from "@/lib/escola/textos";

/** "Presença das últimas 4 rodas: 9, 11, 8, 12 pessoas." Só números, nunca nomes (a presença é somada no banco). */
export function Presenca({ lista, t }: { lista: { quando: string; presenca: number | null }[]; t: TextosDaTelaDoNucleo["pauta"] }) {
  return <p className="en-presenca">{lista.length === 0 ? t.semPresenca : preencher(t.presenca, { n: lista.length, lista: linhaDaPresenca(lista) })}</p>;
}
