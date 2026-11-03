// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import type { Dict } from "@/i18n/types";
import type { TextosDaLeveza } from "@/i18n/escola/leveza";
import type { AulaEmLibras } from "@/lib/escola/leveza";
import { usePrefs } from "@/lib/prefs";
import { ConviteDoPacote } from "./ConviteDoPacote";
import { useAulaLeve, useConviteDoPacote } from "./guardado-leveza";
import { InterruptoresDeLeveza } from "./InterruptoresDeLeveza";
import { LevarEstaAula } from "./LevarEstaAula";
import { LibrasNaAula } from "./LibrasNaAula";
import { MedidorDeDados } from "./MedidorDeDados";

export interface PropsDaLeveza {
  lang: string;
  libras: AulaEmLibras | null;
  vlibrasLigado: boolean;
  hrefEmPortugues: string;
  textoBytes: number;
  caminhos: { texto: string; epub: string };
  paginasDaTrilha: string[];
  trilhas: Dict["tracks"];
  espelhos: string[];
  s: TextosDaLeveza;
}

/** Tudo da leveza e do alcance da aula, acima do "Ouvir a aula": Libras, convite do pacote e "Estudar mais leve". */
export function LevezaDaAula({ lang, libras, vlibrasLigado, hrefEmPortugues, textoBytes, caminhos, paginasDaTrilha, trilhas, espelhos, s }: PropsDaLeveza) {
  const prefs = usePrefs();
  const convite = useConviteDoPacote();
  const [soTexto, definirSoTexto] = useAulaLeve();
  // null: abre sozinho no modo pacote; depois que a pessoa abre ou fecha, vale a escolha dela.
  const [escolha, setEscolha] = useState<boolean | null>(null);

  return (
    <div className="lev no-print">
      <LibrasNaAula lang={lang} libras={libras} vlibrasLigado={vlibrasLigado} hrefEmPortugues={hrefEmPortugues} s={s.libras} />
      {convite.convidar && convite.motivo && <ConviteDoPacote s={s.convite} motivo={convite.motivo} responder={convite.responder} />}
      <details className="lev-mais" open={escolha ?? prefs.pacote} onToggle={(e) => setEscolha(e.currentTarget.open)}>
        <summary className="lev-resumo">{s.leve.resumo}</summary>
        <InterruptoresDeLeveza s={s.leve} soTexto={soTexto} definirSoTexto={definirSoTexto} />
        <LevarEstaAula s={s.levar} lang={lang} textoBytes={textoBytes} caminhos={caminhos} paginasDaTrilha={paginasDaTrilha} trilhas={trilhas} espelhos={espelhos} />
        <div className="lev-tela">
          <h3 className="lev-subtitulo">{s.telaApagada.titulo}</h3>
          <p className="lev-nota">{s.telaApagada.texto}</p>
        </div>
        <MedidorDeDados s={s.medidor} lang={lang} />
      </details>
    </div>
  );
}
