// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As figuras da entrada da Alumia (as silhuetas do fundo): a lista de configuração (silhuetas.json) cruzada com os créditos que o
// roteiro scripts/alumia-silhuetas.mjs gravou (creditos.json). Só entra a figura ligada, com arquivo e crédito; pessoa viva só com
// a autorização dela anotada (Código Civil art. 20; LGPD art. 7º). Sem "@/" de propósito (o teste roda no Node).
import creditos from "./creditos.json";
import lista from "./silhuetas.json";

export interface CreditoDaFigura {
  autor: string;
  licenca: string;
  licencaUrl: string | null;
  fonte: string;
  derivada: string;
  cuidado?: string;
}

export interface FiguraDaEntrada {
  id: string;
  nome: string;
  /** Caminho público da silhueta (sem a barra do começo). */
  src: string;
  credito: CreditoDaFigura;
}

interface ItemDaLista {
  id: string;
  nome: string;
  viva: boolean;
  ligada: boolean;
  autorizacao?: string;
}

export function figurasDaEntrada(): FiguraDaEntrada[] {
  const porId = new Map((creditos as (CreditoDaFigura & { id: string })[]).map((c) => [c.id, c]));
  return (lista.figuras as ItemDaLista[])
    .filter((f) => f.ligada && (!f.viva || Boolean(f.autorizacao?.trim())) && porId.has(f.id))
    .map((f) => {
      const c = porId.get(f.id)!;
      return {
        id: f.id,
        nome: f.nome,
        src: `alumia/entrada/${f.id}.webp`,
        credito: { autor: c.autor, licenca: c.licenca, licencaUrl: c.licencaUrl, fonte: c.fonte, derivada: c.derivada, ...(c.cuidado ? { cuidado: c.cuidado } : {}) },
      };
    });
}
