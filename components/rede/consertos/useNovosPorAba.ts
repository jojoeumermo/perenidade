// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { consertos } from "@/lib/rede/cliente-consertos";
import type { AbaComContador } from "@/lib/rede/tipos-consertos";

/**
 * O "N novos" de cada aba (Seguindo, Comunidades, Tudo), de 30 em 30 segundos com a página à vista. Cada aba lembra a última
 * vez que foi aberta; a aba aberta agora fica em zero. Só números: nenhum conteúdo, nenhum rastreamento.
 */
export function useNovosPorAba({ ativo, aberta }: { ativo: boolean; aberta: AbaComContador | null }) {
  const [novos, setNovos] = useState<Partial<Record<AbaComContador, number>>>({});
  const vistas = useRef<Record<AbaComContador, string>>({ seguindo: new Date().toISOString(), minhas: new Date().toISOString(), tudo: new Date().toISOString() });

  /** A pessoa abriu (ou recarregou) a aba: tudo o que chegou até agora está visto. */
  const vi = useCallback((aba: AbaComContador) => {
    vistas.current[aba] = new Date().toISOString();
    setNovos((atuais) => ({ ...atuais, [aba]: 0 }));
  }, []);

  useEffect(() => {
    if (!ativo) return;
    const relogio = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void consertos
        .novosPorAba({ ...vistas.current })
        .then((r) => setNovos(r))
        .catch(() => undefined);
    }, 30000);
    return () => window.clearInterval(relogio);
  }, [ativo, aberta]);

  return { novos, vi };
}
