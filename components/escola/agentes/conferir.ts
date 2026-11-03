// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { TextosDosAgentes } from "@/i18n/escola/agentes";
import { conferirCampo } from "@/lib/escola/agentes";

/** A conferência de dado pessoal (lib/escola/agentes.ts) com o aviso no idioma da página, no formato da prop conferirTexto. */
export const conferirComTextos =
  (comum: TextosDosAgentes["comum"]) =>
  (texto: string): { aviso: string; bloqueia: boolean } | null => {
    const r = conferirCampo(texto);
    return r ? { aviso: comum.dadoPessoal[r.aviso], bloqueia: r.bloqueia } : null;
  };
