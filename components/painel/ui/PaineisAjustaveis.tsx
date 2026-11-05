// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Fragment, type ReactNode, useEffect, useRef, useSyncExternalStore } from "react";
import { type ImperativePanelGroupHandle, Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { usePainel } from "../estado";

export interface PainelAjustavel {
  id: string;
  /** Largura mínima, em porcentagem do grupo. */
  minimo: number;
  padrao?: number;
  maximo?: number;
  /** Pode recolher até sumir (arrastando além do mínimo). */
  recolhivel?: boolean;
  /** Nome da coluna para o leitor de tela (a alça diz "entre X e Y"). */
  nome?: string;
  conteudo: ReactNode;
}

const MEDIA = "(min-width: 64rem)";
/** As colunas só se ajustam no computador; abaixo de 64 rem, empilham (sem a biblioteca). */
function useLargo() {
  return useSyncExternalStore(
    (avisar) => {
      const consulta = window.matchMedia(MEDIA);
      consulta.addEventListener("change", avisar);
      return () => consulta.removeEventListener("change", avisar);
    },
    () => window.matchMedia(MEDIA).matches,
    () => true,
  );
}

/**
 * Colunas que a pessoa arrasta para ajustar (react-resizable-panels 3): lista | detalhe, ou canais | conversa | membros.
 * A alça é um fio de 1 px com área de pegar de 8 px, bordô ao passar o mouse e ao arrastar; setas do teclado ajustam;
 * duplo clique volta ao padrão. As larguras ficam guardadas no estado da casca (200 ms depois de soltar).
 */
export function PaineisAjustaveis({ id, paineis, orientacao = "horizontal", className, alturaMinima }: { id: string; paineis: PainelAjustavel[]; orientacao?: "horizontal" | "vertical"; className?: string; alturaMinima?: string }) {
  const largo = useLargo();
  const guardadas = usePainel((s) => s.larguras[id]);
  const guardar = usePainel((s) => s.guardarLarguras);
  const grupo = useRef<ImperativePanelGroupHandle>(null);
  const relogio = useRef(0);
  useEffect(() => () => window.clearTimeout(relogio.current), []);
  const padroes = (() => {
    const livres = paineis.filter((p) => p.padrao === undefined).length;
    const fixos = paineis.reduce((soma, p) => soma + (p.padrao ?? 0), 0);
    return paineis.map((p) => p.padrao ?? Math.max(p.minimo, (100 - fixos) / Math.max(livres, 1)));
  })();
  const iniciais = guardadas && guardadas.length === paineis.length ? guardadas : padroes;

  if (!largo && orientacao === "horizontal") {
    return (
      <div className={`pn-paineis-empilhados ${className ?? ""}`}>
        {paineis.map((p) => (
          <div key={p.id}>{p.conteudo}</div>
        ))}
      </div>
    );
  }

  return (
    <PanelGroup
      ref={grupo}
      id={`pn-${id}`}
      direction={orientacao}
      className={`pn-paineis ${className ?? ""}`}
      style={alturaMinima ? { minHeight: alturaMinima } : undefined}
      onLayout={(tamanhos) => {
        window.clearTimeout(relogio.current);
        relogio.current = window.setTimeout(() => guardar(id, tamanhos), 200);
      }}
    >
      {paineis.map((p, i) => (
        <Fragment key={p.id}>
          {i > 0 && (
            <PanelResizeHandle
              className="pn-alca"
              aria-label={`Ajustar a largura entre ${paineis[i - 1].nome ?? paineis[i - 1].id} e ${p.nome ?? p.id}`}
              onDoubleClick={() => grupo.current?.setLayout(padroes)}
            />
          )}
          <Panel id={`pn-${id}-${p.id}`} order={i} defaultSize={iniciais[i]} minSize={p.minimo} maxSize={p.maximo} collapsible={p.recolhivel} style={{ overflow: "auto" }}>
            {p.conteudo}
          </Panel>
        </Fragment>
      ))}
    </PanelGroup>
  );
}
