// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { TextosDosJogos } from "@/i18n/jogos";
import { Botao } from "./comum";

const Sons = dynamic(() => import("./SonsInfantis").then((m) => m.SonsInfantis), { ssr: false, loading: () => <p className="p-4 font-mono text-sm">…</p> });

/** A seção de música para crianças da página /jogos: só carrega o WebAudio quando a pessoa pede. */
export function CriancasSons({ s }: { s: TextosDosJogos }) {
  const [aberto, setAberto] = useState(false);
  return aberto ? <Sons s={s} /> : (
    <div>
      <p className="max-w-2xl leading-relaxed">{s.criancas.lead}</p>
      <Botao className="mt-4" onClick={() => setAberto(true)}>{s.criancas.escolha}</Botao>
    </div>
  );
}
