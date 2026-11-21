// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Item 70 (Prompt 4): baralhos de revisão na Alumia, reaproveitando a repetição espaçada que o site já tem (lib/estudo.ts: as caixas
// de Leitner, a chave "lucia:revisao" deste aparelho e o rodízio entre matérias). É o MESMO baralho do site: o que a pessoa guardou
// estudando no site aparece aqui e vice-versa. O progresso fica só no aparelho (o Sair rápido apaga). Sem "@/" de propósito.
import { hoje, intercalar, lerCartoes, paraHoje, type CartaoDeRevisao } from "../../estudo";

export interface Baralho {
  nome: string;
  total: number;
  hoje: number;
}

/** O baralho de um cartão é a "origem" dele (a aula, a fonte ou o nome que a pessoa deu). */
export const baralhoDe = (c: Pick<CartaoDeRevisao, "origem">): string => c.origem.trim() || "Sem baralho";

/** Os baralhos deste aparelho, com quantos cartões têm e quantos vencem hoje (só da própria pessoa). */
export function baralhos(lista: readonly CartaoDeRevisao[] = lerCartoes(), dia = hoje()): Baralho[] {
  const m = new Map<string, Baralho>();
  for (const c of lista) {
    const nome = baralhoDe(c);
    const b = m.get(nome) ?? { nome, total: 0, hoje: 0 };
    b.total++;
    if (c.proxima <= dia) b.hoje++;
    m.set(nome, b);
  }
  return [...m.values()].sort((a, b) => b.hoje - a.hoje || a.nome.localeCompare(b.nome, "pt-BR"));
}

/** A fila de hoje: de um baralho só, ou de todos, misturando os baralhos (o rodízio do site). */
export function filaDeHoje(lista: readonly CartaoDeRevisao[] = lerCartoes(), baralho: string | null = null, dia = hoje()): CartaoDeRevisao[] {
  const vencidos = paraHoje([...lista], dia).filter((c) => baralho === null || baralhoDe(c) === baralho);
  return intercalar(vencidos, baralhoDe);
}
