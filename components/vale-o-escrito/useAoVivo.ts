// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import { getClient, hasBackend, rpc } from "@/lib/backend";
import type { DadosDoObservatorio } from "@/lib/vale-o-escrito/visual";
import type { Entrada } from "@/lib/vale-o-escrito/tipos";

/**
 * Atualização ao vivo: assina o canal de Broadcast "vale-o-escrito" (o banco avisa, por trigger em interno.vale_entradas,
 * com o evento "mudou" e a carga {id, acao}: publicada, atualizada ou retirada; não há tabela exposta nem Realtime de
 * linhas). Em "publicada" e "atualizada" busca a entrada com public.vale_publicada(id) e a confere de novo; em "retirada"
 * tira a ficha da tela. Só no navegador, só com a página aberta, e só se o serviço estiver configurado: sem ele, os dados
 * em arquivo valem sozinhos. O cliente do Supabase e as regras só são baixados depois da conexão.
 *
 * Privacidade: o canal é anônimo (chave pública); nenhum dado da pessoa que lê é enviado. O aviso não traz conteúdo, e a
 * entrada buscada passa pelas mesmas regras dos arquivos (lib/vale-o-escrito/aovivo.ts) antes de aparecer.
 */
export function useAoVivo(
  conhecidos: Pick<DadosDoObservatorio, "pessoas" | "organizacoes">,
  aoMudar: (id: string, entrada: Entrada | null) => void,
): { ligado: boolean; ultimo: string | null } {
  const [ligado, setLigado] = useState(false);
  const [ultimo, setUltimo] = useState<string | null>(null);
  // As funções e os dados mais novos, sem reabrir o canal a cada mudança.
  const conhecidosRef = useRef(conhecidos);
  const aoMudarRef = useRef(aoMudar);
  useEffect(() => {
    conhecidosRef.current = conhecidos;
    aoMudarRef.current = aoMudar;
  });

  useEffect(() => {
    if (!hasBackend) return;
    let fechado = false;
    let desfazer: (() => void) | null = null;
    (async () => {
      try {
        const [{ acaoDaLinha }, supabase] = await Promise.all([import("@/lib/vale-o-escrito/aovivo"), getClient()]);
        if (fechado) return;
        const canal = supabase
          .channel("vale-o-escrito")
          .on("broadcast", { event: "mudou" }, (mensagem) => {
            const carga = (mensagem as { payload?: { id?: unknown; acao?: unknown } }).payload;
            const id = typeof carga?.id === "string" ? carga.id : "";
            if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(id)) return;
            if (carga?.acao === "retirada") {
              aoMudarRef.current(id, null);
              return;
            }
            if (carga?.acao !== "publicada" && carga?.acao !== "atualizada") return;
            void (async () => {
              try {
                const linha = await rpc<{ id?: string; doc?: unknown } | null>("vale_publicada", { p_id: id });
                if (fechado) return;
                if (!linha) {
                  aoMudarRef.current(id, null);
                  return;
                }
                const acao = acaoDaLinha(linha, conhecidosRef.current);
                if (acao.tipo === "pôr") {
                  aoMudarRef.current(acao.entrada.id, acao.entrada);
                  setUltimo(acao.entrada.titulo);
                }
              } catch {
                // Sem rede agora: vale na próxima carga.
              }
            })();
          })
          .subscribe((estado) => {
            if (!fechado) setLigado(estado === "SUBSCRIBED");
          });
        desfazer = () => {
          void supabase.removeChannel(canal);
        };
      } catch {
        // Sem serviço ou sem rede: o observatório segue com os dados em arquivo.
        if (!fechado) setLigado(false);
      }
    })();
    return () => {
      fechado = true;
      desfazer?.();
    };
  }, []);

  return { ligado, ultimo };
}
