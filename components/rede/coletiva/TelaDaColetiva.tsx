// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A ação coletiva (/alumia/acao-coletiva), Prompt 4, Parte F (itens 89 a 100 e 122 a 126), em abas: Comunidade (pressão, cartas,
// questionário e rodízio), Atos (acessibilidade, ciranda, tempo e panfleto), Projetos de lei (radar), Documentos (modelos),
// Organizações (Pix, imprensa, vitrine, links e frentes) e Pouso e filiação. Atrás de "alumia-p4-coletiva" (desligada, a rota dá
// 404 e o banco recusa). A aba escolhida fica só na memória desta aba do navegador; "?aba=orgs&org=<@>" abre uma organização (o
// link do aviso de Pix).
import "./coletiva.css";
import { useState, type KeyboardEvent } from "react";
import { PREVIA_DA_COLETIVA } from "@/lib/rede/coletiva/cliente";
import type { PropsDaTelaDoPacote } from "../registro";
import { FaixaDaPrevia, useTextosAlumia3 } from "../conversa/base3";
import { Faixa } from "../ui/Faixa";
import { AbaAtos } from "./AbaAtos";
import { AbaComunidade } from "./AbaComunidade";
import { AbaDocumentos, AbaLeis } from "./AbaLeis";
import { AbaOrgs } from "./AbaOrgs";
import { AbaPouso } from "./AbaPouso";
import { useTextosDaColetiva } from "./textos";

const ABAS = ["comunidade", "atos", "leis", "documentos", "orgs", "pouso"] as const;
type Aba = (typeof ABAS)[number];

export default function TelaDaColetiva({ lang }: PropsDaTelaDoPacote) {
  const t = useTextosDaColetiva(lang);
  const t3 = useTextosAlumia3(lang);
  // A tela só roda no aparelho (registro com ssr: false): o endereço já está aqui no primeiro desenho.
  const [busca] = useState(() => new URLSearchParams(window.location.search));
  const [aba, setAba] = useState<Aba>(() => ((ABAS as readonly string[]).includes(busca.get("aba") ?? "") ? (busca.get("aba") as Aba) : "comunidade"));
  const pedida = busca.get("org");
  const org = pedida && /^[a-z0-9_]{2,40}$/i.test(pedida) ? pedida.toLowerCase() : null;

  if (!t) return <div className="ac-pagina" aria-busy="true" />;

  const teclas = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = ABAS.indexOf(aba);
    const j = e.key === "ArrowRight" ? (i + 1) % ABAS.length : e.key === "ArrowLeft" ? (i + ABAS.length - 1) % ABAS.length : e.key === "Home" ? 0 : e.key === "End" ? ABAS.length - 1 : -1;
    if (j < 0) return;
    e.preventDefault();
    setAba(ABAS[j]);
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-aba="${ABAS[j]}"]`)?.focus();
  };

  return (
    <div className="ac-pagina">
      {PREVIA_DA_COLETIVA && t3 && <FaixaDaPrevia t={t3} />}
      <header className="ac-cabeca">
        <Faixa className="ac-faixa" altura={8} />
        <h1 className="ac-titulo al-cond">{t.titulo}</h1>
        <p className="ac-chamada">{t.intro}</p>
      </header>
      <div className="ac-abas" role="tablist" aria-label={t.abas.rotulo} onKeyDown={teclas}>
        {ABAS.map((a) => (
          <button key={a} type="button" role="tab" id={`ac-aba-${a}`} data-aba={a} aria-selected={aba === a} aria-controls={`ac-painel-${a}`} tabIndex={aba === a ? 0 : -1} className="ac-aba" onClick={() => setAba(a)}>
            {t.abas[a]}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`ac-painel-${aba}`} aria-labelledby={`ac-aba-${aba}`}>
        {aba === "comunidade" && <AbaComunidade t={t} lang={lang} />}
        {aba === "atos" && <AbaAtos t={t} lang={lang} />}
        {aba === "leis" && <AbaLeis t={t} lang={lang} />}
        {aba === "documentos" && <AbaDocumentos t={t} lang={lang} />}
        {aba === "orgs" && <AbaOrgs t={t} lang={lang} inicial={org} />}
        {aba === "pouso" && <AbaPouso t={t} lang={lang} />}
      </div>
    </div>
  );
}
