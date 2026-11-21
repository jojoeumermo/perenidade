// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A memória da luta (/alumia/memoria-da-luta), Prompt 4: o mural de vitórias (116), as campanhas com linha do tempo (115), o arquivo
// vivo (44) e os podcasts das comunidades (119), em abas. Atrás de "alumia-p4-memoria-e-luta" (desligada, a rota dá 404 e o banco
// recusa). A aba escolhida fica só na memória desta aba do navegador.
import "./memoria.css";
import { useState, type KeyboardEvent } from "react";
import type { PropsDaTelaDoPacote } from "../registro";
import { FaixaDaPrevia, useTextosAlumia3 } from "../conversa/base3";
import { Faixa } from "../ui/Faixa";
import { AbaArquivo } from "./AbaArquivo";
import { AbaCampanhas } from "./AbaCampanhas";
import { AbaPodcasts } from "./AbaPodcasts";
import { AbaVitorias } from "./AbaVitorias";
import { useTextosDaMemoria } from "./textos";
import { PREVIA_DA_MEMORIA } from "@/lib/rede/memoria/cliente";

const ABAS = ["vitorias", "campanhas", "memoria", "podcasts"] as const;
type Aba = (typeof ABAS)[number];

export default function TelaDaMemoria({ lang }: PropsDaTelaDoPacote) {
  const t = useTextosDaMemoria(lang);
  const t3 = useTextosAlumia3(lang);
  const [aba, setAba] = useState<Aba>("vitorias");

  if (!t) return <div className="ml-pagina" aria-busy="true" />;

  const teclas = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = ABAS.indexOf(aba);
    const j = e.key === "ArrowRight" ? (i + 1) % ABAS.length : e.key === "ArrowLeft" ? (i + ABAS.length - 1) % ABAS.length : e.key === "Home" ? 0 : e.key === "End" ? ABAS.length - 1 : -1;
    if (j < 0) return;
    e.preventDefault();
    setAba(ABAS[j]);
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-aba="${ABAS[j]}"]`)?.focus();
  };

  return (
    <div className="ml-pagina">
      {PREVIA_DA_MEMORIA && t3 && <FaixaDaPrevia t={t3} />}
      <header className="ml-cabeca">
        <Faixa className="ml-faixa" altura={8} />
        <h1 className="ml-titulo al-cond">{t.titulo}</h1>
        <p className="ml-chamada">{t.intro}</p>
      </header>
      <div className="ml-abas" role="tablist" aria-label={t.abas.rotulo} onKeyDown={teclas}>
        {ABAS.map((a) => (
          <button key={a} type="button" role="tab" id={`ml-aba-${a}`} data-aba={a} aria-selected={aba === a} aria-controls={`ml-painel-${a}`} tabIndex={aba === a ? 0 : -1} className="ml-aba" onClick={() => setAba(a)}>
            {t.abas[a]}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`ml-painel-${aba}`} aria-labelledby={`ml-aba-${aba}`}>
        {aba === "vitorias" && <AbaVitorias t={t} lang={lang} />}
        {aba === "campanhas" && <AbaCampanhas t={t} lang={lang} />}
        {aba === "memoria" && <AbaArquivo t={t} lang={lang} />}
        {aba === "podcasts" && <AbaPodcasts t={t} lang={lang} />}
      </div>
    </div>
  );
}
