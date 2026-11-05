// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect } from "react";
import { useCompleted } from "@/lib/progress";
import { useHydrated } from "@/lib/storage";
import { L, useI18n } from "../I18n";
import { escolherAulaDoDia, type AulaSugerida } from "./aula-do-dia";
import { pedirCasca } from "../offline/offline";
import { textosDoApp } from "./textos";

/**
 * A "aula do dia" da tela Início do aplicativo: uma das aulas curtas do "Comece aqui", trocada a cada dia (a mesma para
 * todo mundo no mesmo dia e fuso, sem servidor), pulando as que a pessoa já marcou como feitas neste aparelho. A página
 * é montada uma vez e servida pronta, então a escolha só acontece no aparelho, depois que a tela abre.
 */
export function AulaDoDia({ aulas }: { aulas: AulaSugerida[] }) {
  const { lang } = useI18n();
  const s = textosDoApp(lang);
  const hidratado = useHydrated();
  const feitas = useCompleted();
  // Offline: pede ao service worker que guarde a aula do dia e as seguintes do "Comece aqui" (até 6), para abrirem sem internet.
  const aulaEscolhida = hidratado ? escolherAulaDoDia(aulas, new Date(), feitas) : null;
  const paraGuardar = aulaEscolhida ? Array.from({ length: Math.min(6, aulas.length) }, (_, i) => aulas[(aulas.indexOf(aulaEscolhida) + i) % aulas.length].href).join("|") : "";
  useEffect(() => {
    if (paraGuardar) void pedirCasca(lang, paraGuardar.split("|"));
  }, [paraGuardar, lang]);
  if (!hidratado || aulas.length === 0) return null;
  const aula = aulaEscolhida;
  if (!aula) return null;
  return (
    <L href={aula.href} className="aula-do-dia block rounded-[1.25rem] border-[1.5px] border-ink bg-folha p-4 text-ink shadow-[3px_3px_0_var(--sombra)] hover:text-ink">
      <span className="block font-mono text-[0.68rem] font-medium uppercase tracking-[0.16em] text-prelo-texto">{s.aulaDoDia}</span>
      <span className="mt-1.5 block font-serif text-[1.35rem] font-semibold leading-tight">{aula.titulo}</span>
      <span className="mt-0.5 block text-[0.92rem] text-ink-soft">
        {aula.trilha}
        {aula.minutos > 0 ? ` · ${s.minutos(aula.minutos)}` : ""}
      </span>
      <span className="mt-3 inline-block rounded-full bg-[#c21f16] px-4 py-2 font-sans text-sm font-extrabold text-white">{s.abrirAula} →</span>
    </L>
  );
}
