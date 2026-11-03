// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useMemo } from "react";
import { CopyButton } from "@/components/CopyButton";
import { L, useI18n } from "@/components/I18n";
import type { TextosDoAcompanhante } from "@/i18n/escola/acompanhante";
import type { TextosDosAgentes } from "@/i18n/escola/agentes";
import { levarRascunho, LIMITES_DOS_AGENTES } from "@/lib/escola/agentes";
import { Conversa } from "../acompanhante/Conversa";
import { conferirComTextos } from "./conferir";

/**
 * Agente do educador (modo "educador" do assistente): do tema sai um rascunho de aula com as 6 partes do modelo.
 * Moldura fixa em cada resposta: "Rascunho de máquina: confira cada fato e acrescente as fontes antes de qualquer uso.
 * Nada aqui é publicado." A resposta vem sem marca de autor. "Conferir este rascunho" leva o texto à Revisão (aba atual,
 * lido uma vez) e quem publica é a pessoa, pelo /contribuir.
 */
export function RascunhoDoEducador({ s, comum, a }: { s: TextosDosAgentes["educador"]; comum: TextosDosAgentes["comum"]; a: TextosDoAcompanhante }) {
  const { lang } = useI18n();
  const conferir = useMemo(() => conferirComTextos(comum), [comum]);
  return (
    <div data-rascunho-do-educador>
      <Conversa
        s={a}
        modo="educador"
        itens={["tema"]}
        campo={{ rotulo: s.tema, dica: s.temaDica, max: LIMITES_DOS_AGENTES.temaMax, min: LIMITES_DOS_AGENTES.temaMin, linhas: 4, lang }}
        botao={s.botao}
        umaVez
        semServidor="aviso"
        avisoDaResposta={s.moldura}
        conferirTexto={conferir}
        acaoNaResposta={(texto) => (
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <CopyButton text={texto} label={comum.copiar} done={comum.copiado} />
            <L href="/escola/agentes/revisao" className="underline hover:text-oxblood" onClick={() => levarRascunho(texto)} data-conferir-rascunho>
              {s.conferir}
            </L>
            <L href="/contribuir" className="underline hover:text-oxblood">
              {s.contribuir}
            </L>
          </p>
        )}
      />
      <p className="mt-6 border-l-4 border-gold pl-3 text-sm">{s.moldura}</p>
      <p className="mt-2 text-xs text-ink-soft">{s.naoEscreva}</p>
    </div>
  );
}
