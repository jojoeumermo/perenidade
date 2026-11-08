// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As prateleiras "Por caderno" da Biblioteca da Escola (prancha Biblioteca, 07/11): os cadernos que já têm leituras e
// fontes escritas nas aulas, na ordem da prancha. O que cada prateleira diz ("Paulo Freire e as fontes das aulas" etc.)
// está nos textos (i18n/escola/biblioteca, "prateleiras") e foi conferido no conteúdo em 08/11: por exemplo, a Lei de
// Greve (7.783/1989) está em content/trilhas/organizacao-sindical-de-base/greve-na-pratica.md, e o Dieese e o IBGE nas
// aulas de content/trilhas/analise-de-conjuntura. Caderno sem leitura escrita não ganha prateleira (lista vazia se esconde).
// Puro e sem "@/" de propósito: scripts/testar-escola-frente.mjs roda este arquivo direto no Node.

import { CADERNOS_DA_ESCOLA, caminhoDoCaderno, type Degrau } from "../../../lib/escola/contratos";

/** Os números (com dois dígitos) dos cadernos que têm prateleira, na ordem da prancha. */
export const PRATELEIRAS = ["01", "03", "05", "06", "08", "09"] as const;
export type NumeroDaPrateleira = (typeof PRATELEIRAS)[number];

/** A cor do rótulo "Caderno NN" pelo degrau (as mesmas da prancha: ouro, vermelho-núcleo e laranja do Degrau 3). */
export const COR_DO_DEGRAU: Record<Degrau, string> = { 1: "#F2C94C", 2: "#E8604C", 3: "#EA7A24" };

export interface Prateleira {
  n: NumeroDaPrateleira;
  nome: string;
  itens: string;
  cor: string;
  caminho: string;
}

/**
 * As prateleiras prontas para a tela. `nomes` são os 11 nomes dos cadernos (i18n/escola/formacao-base, "hoje.cadernos");
 * `itens` é o texto de cada prateleira. Prateleira sem texto ou sem caderno fica de fora (nunca uma caixa vazia).
 */
export function prateleirasDaBiblioteca(nomes: readonly string[], itens: Partial<Record<string, string>>): Prateleira[] {
  return PRATELEIRAS.flatMap((n) => {
    const caderno = CADERNOS_DA_ESCOLA.find((c) => c.numero === Number(n));
    const texto = itens[n];
    const nome = caderno ? nomes[caderno.numero - 1] : undefined;
    if (!caderno || !texto || !nome) return [];
    return [{ n, nome, itens: texto, cor: COR_DO_DEGRAU[caderno.degrau], caminho: caminhoDoCaderno(caderno.slug) }];
  });
}
