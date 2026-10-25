// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Dict } from "@/i18n/types";

/**
 * O texto da "Aula em 1 minuto" (components/Compartilhar.tsx): título, resumo, até três palavras da aula, uma pergunta
 * para pensar e o link, com a marcação do WhatsApp (*negrito*, _itálico_). Fica fora do componente para a página,
 * que roda no servidor, montar o texto com os dados da aula.
 */
export function aulaEmUmMinuto({ titulo, trilha, resumo, termos, pergunta, url, s }: { titulo: string; trilha: string; resumo: string; termos: { term: string; summary: string }[]; pergunta?: string; url: string; s: Dict["compartilhar"] }) {
  const partes = [`*${titulo}*`, `_${trilha}_`, "", resumo];
  if (termos.length > 0) partes.push("", `*${s.palavras}*`, ...termos.slice(0, 3).map((x) => `• *${x.term}*: ${x.summary}`));
  if (pergunta) partes.push("", `*${s.pergunta}*`, pergunta);
  partes.push("", `${s.aulaCompleta} ${url}`, s.siga);
  return partes.join("\n");
}
