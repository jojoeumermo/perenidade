// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useState } from "react";

/** Carrega uma resposta do banco e recarrega quando a chave muda ou quando `recarregar` é chamado. Guarda o erro, sem quebrar. */
export function useCarga<T>(chave: string | null, buscar: () => Promise<T>): { dado: T | null; erro: unknown; carregando: boolean; recarregar: () => void; trocar: (d: T) => void } {
  const [estado, setEstado] = useState<{ chave: string | null; vez: number; dado: T | null; erro: unknown }>({ chave: null, vez: -1, dado: null, erro: null });
  const [vez, setVez] = useState(0);
  useEffect(() => {
    if (chave === null) return;
    let vivo = true;
    buscar().then(
      (dado) => vivo && setEstado({ chave, vez, dado, erro: null }),
      (erro: unknown) => vivo && setEstado((e) => ({ chave, vez, dado: e.chave === chave ? e.dado : null, erro })),
    );
    return () => {
      vivo = false;
    };
    // `buscar` muda a cada desenho; a chave e a vez decidem quando buscar de novo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, vez]);
  const recarregar = useCallback(() => setVez((v) => v + 1), []);
  const trocar = useCallback((dado: T) => setEstado((e) => ({ ...e, dado, erro: null })), []);
  const carregando = chave !== null && (estado.chave !== chave || estado.vez !== vez);
  return { dado: estado.chave === chave ? estado.dado : null, erro: estado.chave === chave ? estado.erro : null, carregando, recarregar, trocar };
}
