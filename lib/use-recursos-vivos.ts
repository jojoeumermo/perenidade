// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { definirVivos, ligado, type Recurso } from "./recursos";
import { lerVivos } from "./recursos-vivos";

/**
 * Para componentes do navegador: devolve se o recurso está ligado, somando a decisão do painel (lida de /api/recursos, que o
 * servidor guarda por 60 s) à variável de montagem. Enquanto a resposta não chega, vale só a variável: a tela nunca espera.
 */
export function useRecurso(recurso: Recurso): boolean {
  const [, setVolta] = useState(0);
  useEffect(() => {
    let cancelado = false;
    fetch("/api/recursos")
      .then((r) => (r.ok ? r.json() : null))
      .then((dados) => {
        if (cancelado || !dados) return;
        definirVivos(lerVivos(dados));
        setVolta((v) => v + 1);
      })
      .catch(() => undefined);
    return () => {
      cancelado = true;
    };
  }, []);
  return ligado(recurso);
}
