// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Botao } from "@/components/rede/ui/Botao";
import { dia, Estado, Etiqueta, Quadro, useDado } from "@/components/painel/alumia/pecas";

interface Apagamentos {
  total: number;
  por_dia: { dia: string; n: number }[];
  arquivos_na_fila: number;
}

/**
 * Para o painel de controle da Alumia (coordenação e admin): quantos pedidos de apagamento de conta estão no prazo de
 * arrependimento e quantos vencem em cada dia. Sem nome, sem conteúdo, sem link para a pessoa (public.alumia_painel_apagamentos).
 * Mostra também quantos arquivos de contas já apagadas esperam a faxina do depósito: se o número não desce, a rota
 * app/api/rede/exportar/faxina não está sendo chamada. Quem junta pendura este quadro na Visão geral ou em Pessoas.
 */
export function PainelApagamentos() {
  const leitura = useDado<Apagamentos>("alumia_painel_apagamentos");
  const d = leitura.dados;
  return (
    <Quadro
      titulo="Contas sendo apagadas"
      lado={
        <Botao variante="contorno" tamanho="p" onClick={leitura.recarregar}>
          Atualizar
        </Botao>
      }
    >
      <Estado leitura={leitura} />
      {d ? (
        <ul className="ap-lista">
          <li className="ap-linha">
            <span className="ap-linha-texto">
              <span className="ap-forte">No prazo de arrependimento</span>
              <span className="ap-miudo">A conta já saiu da rede; é apagada de vez quando o prazo de 7 dias vence. A pessoa ainda pode desistir.</span>
            </span>
            <Etiqueta tom={d.total > 0 ? "dourado" : undefined}>{d.total.toLocaleString("pt-BR")}</Etiqueta>
          </li>
          {d.por_dia.map((p) => (
            <li key={p.dia} className="ap-linha">
              <span className="ap-linha-texto">
                <span className="ap-forte">Vence em {dia(`${p.dia}T12:00:00`)}</span>
              </span>
              <Etiqueta>{p.n.toLocaleString("pt-BR")}</Etiqueta>
            </li>
          ))}
          <li className="ap-linha">
            <span className="ap-linha-texto">
              <span className="ap-forte">Arquivos esperando a faxina</span>
              <span className="ap-miudo">Fotos, áudios e stories de contas já apagadas, que o servidor do site tira do depósito de hora em hora.</span>
            </span>
            <Etiqueta tom={d.arquivos_na_fila > 0 ? "dourado" : "papel"}>{d.arquivos_na_fila.toLocaleString("pt-BR")}</Etiqueta>
          </li>
        </ul>
      ) : null}
    </Quadro>
  );
}
