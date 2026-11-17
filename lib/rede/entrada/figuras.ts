// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As figuras da entrada da Alumia (as silhuetas da parede de ladrilhos): a lista de configuração (silhuetas.json) cruzada com os créditos que o
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
  /** A licença sob a qual a silhueta (obra derivada) é distribuída, quando a original obriga a mesma licença (CC BY-SA). */
  licencaDerivada?: string;
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

/**
 * A ordem dos painéis na parede (cinco por fileira no computador): Che Guevara fica ao lado de Stalin, no fim, e o último painel
 * é o de quem está chegando (lib/rede/entrada/voce.ts). Figura nova que não estiver aqui entra antes de Stalin.
 */
const ORDEM_NA_PAREDE = ["lenin", "marx", "engels", "rosa", "gramsci", "freire", "marielle", "stalin", "che"];
const lugarNaParede = (id: string) => {
  const k = ORDEM_NA_PAREDE.indexOf(id);
  return k >= 0 ? k : ORDEM_NA_PAREDE.indexOf("stalin") - 0.5;
};

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
        credito: { autor: c.autor, licenca: c.licenca, licencaUrl: c.licencaUrl, fonte: c.fonte, derivada: c.derivada, ...(c.licencaDerivada ? { licencaDerivada: c.licencaDerivada } : {}), ...(c.cuidado ? { cuidado: c.cuidado } : {}) },
      };
    })
    .sort((a, b) => lugarNaParede(a.id) - lugarNaParede(b.id));
}
