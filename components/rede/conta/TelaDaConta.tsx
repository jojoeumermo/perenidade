// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Conta e convivência (/alumia/conta), Prompt 4, Parte H, em abas: Proteção (107 níveis, 76 menções, 108 checkup), Atendimento (112
// horário e ausência, 111 respostas rápidas), Comunidades (114 guia, 127 quiz, 80 escudo, 105 sala de cuidado, 78 abrir mediação),
// Mediações (78), Diário (104, só no aparelho), Viagem (109, só no aparelho) e Mudar de servidor (74). Atrás de "alumia-p4-conta"
// (desligada, a rota dá 404 e o banco recusa). A aba escolhida fica só na memória desta aba do navegador.
import "./conta.css";
import { useState } from "react";
import type { PropsDaTelaDoPacote } from "../registro";
import { FaixaDaPrevia, useTextosAlumia3 } from "../conversa/base3";
import { Faixa } from "../ui/Faixa";
import { PREVIA_DA_CONTA } from "@/lib/rede/conta/cliente";
import { Abas } from "./Abas";
import { AbaProtecao } from "./AbaProtecao";
import { AbaAtendimento } from "./AbaAtendimento";
import { AbaComunidades } from "./AbaComunidades";
import { AbaMediacoes } from "./AbaMediacoes";
import { AbaDiario } from "./AbaDiario";
import { AbaViagem } from "./AbaViagem";
import { AbaMudar } from "./AbaMudar";
import { useTextosDaConta } from "./textos";

const ABAS = ["protecao", "atendimento", "comunidades", "mediacoes", "diario", "viagem", "mudar"] as const;
type Aba = (typeof ABAS)[number];

export default function TelaDaConta({ lang }: PropsDaTelaDoPacote) {
  const t = useTextosDaConta(lang);
  const t3 = useTextosAlumia3(lang);
  const [aba, setAba] = useState<Aba>("protecao");
  if (!t) return <div className="ct-pagina" aria-busy="true" />;
  return (
    <div className="ct-pagina">
      {PREVIA_DA_CONTA && t3 && <FaixaDaPrevia t={t3} />}
      <header className="ct-cabeca">
        <Faixa className="ct-faixa" altura={8} />
        <h1 className="ct-titulo al-cond">{t.titulo}</h1>
        <p className="ct-chamada">{t.intro}</p>
      </header>
      <Abas chaves={ABAS} atual={aba} rotulo={t.abas.rotulo} nomes={(k) => t.abas[k]} aoTrocar={setAba} prefixo="ct" classe="ct-abas" />
      <div role="tabpanel" id={`ct-painel-${aba}`} aria-labelledby={`ct-aba-${aba}`}>
        {aba === "protecao" && <AbaProtecao t={t} lang={lang} />}
        {aba === "atendimento" && <AbaAtendimento t={t} lang={lang} />}
        {aba === "comunidades" && <AbaComunidades t={t} lang={lang} />}
        {aba === "mediacoes" && <AbaMediacoes t={t} lang={lang} />}
        {aba === "diario" && <AbaDiario t={t} lang={lang} />}
        {aba === "viagem" && <AbaViagem t={t} lang={lang} />}
        {aba === "mudar" && <AbaMudar t={t} lang={lang} />}
      </div>
    </div>
  );
}
