// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import type { TrilhaDoIndice } from "@/app/[lang]/aulas.json/route";
import { localePath } from "@/i18n/config";

export interface AulaDoIndice {
  id: string;
  titulo: string;
  trilha: string;
  tituloDaTrilha: string;
  area: string;
  nomeDaArea: string;
  etapa: string;
}

export interface Indice {
  trilhas: TrilhaDoIndice[];
  aulas: Map<string, AulaDoIndice>;
}

const guardados = new Map<string, Promise<Indice | null>>();

function carregar(lang: string): Promise<Indice | null> {
  let pedido = guardados.get(lang);
  if (!pedido) {
    pedido = fetch(localePath(lang, "/aulas.json"))
      .then((r) => (r.ok ? (r.json() as Promise<{ trilhas: TrilhaDoIndice[] }>) : null))
      .then((dado) => {
        if (!dado || !Array.isArray(dado.trilhas)) {
          // Falhou (sem internet, servidor ocupado): a próxima abertura da página tenta de novo.
          guardados.delete(lang);
          return null;
        }
        const aulas = new Map<string, AulaDoIndice>();
        for (const [trilha, tituloDaTrilha, area, nomeDaArea, etapa, lista] of dado.trilhas)
          for (const [slug, titulo] of lista) aulas.set(`${trilha}/${slug}`, { id: `${trilha}/${slug}`, titulo, trilha, tituloDaTrilha, area, nomeDaArea, etapa });
        return { trilhas: dado.trilhas, aulas };
      })
      .catch(() => {
        guardados.delete(lang);
        return null;
      });
    guardados.set(lang, pedido);
  }
  return pedido;
}

/** O índice de trilhas e aulas (nomes e endereços), lido de /<idioma>/aulas.json uma vez por visita. */
export function useIndice(lang: string): Indice | null {
  const [indice, setIndice] = useState<Indice | null>(null);
  useEffect(() => {
    let vivo = true;
    void carregar(lang).then((i) => vivo && setIndice(i));
    return () => {
      vivo = false;
    };
  }, [lang]);
  return indice;
}
