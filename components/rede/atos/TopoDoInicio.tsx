// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import type { ContextoDoEncaixe } from "../encaixes";
import { CartaoDoAto } from "./CartaoDoAto";
import { FaixaProximoAto } from "./FaixaProximoAto";
import { useProximoAto, useTextosDosAtos } from "./usar";
import "./atos.css";

/**
 * O alto da linha do Início (pranchas celular-inicio e computador-inicio): a faixa dourada "PRÓXIMO ATO" com as plaquinhas e,
 * logo embaixo, o cartão do ato com o mosaico. Sem próximo ato (ou se o servidor falhar), não mostra nada.
 *
 * Para quem junta (F1/integrador): o encaixe exporta este componente como `TopoDoInicioEncaixado` (./encaixe); o TopoDaLinha2 da
 * F1 o põe entre as abas e os posts, só na aba "Seguindo", no lugar dos dublês da prévia (o contrato da F0 não tem esse ponto).
 */
export function TopoDoInicio({ lang, situacao }: ContextoDoEncaixe) {
  const t = useTextosDosAtos(lang);
  const ato = useProximoAto(true);
  if (!t || !ato || ato.situacao === "cancelado") return null;
  return (
    <div className="al-ato-topo">
      <FaixaProximoAto ato={ato} t={t} lang={lang} />
      <CartaoDoAto ato={ato} t={t} lang={lang} logado={situacao.logado} />
    </div>
  );
}
