// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { locales } from "@/i18n/config";
import { registrarVisita, semIdioma } from "@/lib/historico-local";
import { estaLigado } from "@/lib/modo-seguro";
import { ligado } from "@/lib/recursos";

/**
 * Guarda as mudanças de página no "Por onde andei" (lib/historico-local.ts), SÓ quando a pessoa ligou o histórico
 * neste aparelho e o modo seguro está desligado. Grava o caminho sem o idioma e sem a consulta (a pergunta da busca
 * nunca entra) e o título da página, lido depois que o Next troca o título. Não desenha nada e não manda nada a lugar
 * nenhum.
 */
export function RegistroDeVisita() {
  const pathname = usePathname();
  useEffect(() => {
    if (!ligado("escola") || !pathname) return;
    // O título da página nova chega um instante depois da rota: espera e lê.
    const id = window.setTimeout(() => {
      try {
        const titulo = document.title.split(" — ").slice(0, -1).join(" — ") || document.title;
        registrarVisita(localStorage, { caminho: semIdioma(pathname, locales), titulo }, { seguro: estaLigado() });
      } catch {
        // armazenamento bloqueado: nada a guardar
      }
    }, 400);
    return () => window.clearTimeout(id);
  }, [pathname]);
  return null;
}
