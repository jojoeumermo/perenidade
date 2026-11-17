// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { EsqueletoDosAjustes } from "../../Esqueletos";
import { FaixaDaPrevia, Torradas, useTextosAlumia3, useTorrada } from "../../conversa/base3";
import type { PropsDaTelaDoPacote } from "../../registro";
import { EstadoDaAlumia } from "../../ui/Estado";
import { Faixa } from "../../ui/Faixa";
import { criarTextos } from "../turma/comum";
import { AbaDaMonitoria } from "./Monitoria";
import { AbaDasProvas } from "./Provas";
import { carregarTextosDaAgenda } from "./textos";
import "../turma/estudo.css";

export const useTextosDaAgenda = criarTextos(carregarTextosDaAgenda);

type Aba = "provas" | "monitoria";
const ABAS: Aba[] = ["provas", "monitoria"];

/**
 * A agenda de estudo (/alumia/agenda; frente 11C): a aba Provas (as datas do ENEM e dos vestibulares, com a fonte oficial, que a
 * pessoa assina para receber aviso e põe na própria agenda) e a aba Monitoria (horários de quem dá monitoria, marcados por
 * disciplina e hora, nunca pela pessoa). ?aba=monitoria abre na segunda. Computador primeiro.
 */
export default function TelaDaAgenda({ lang, s, situacao }: PropsDaTelaDoPacote) {
  const t = useTextosDaAgenda(lang);
  const t3 = useTextosAlumia3(lang);
  const torradas = useTorrada();
  const id = useId();
  const [aba, setAba] = useState<Aba>(() => (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("aba") === "monitoria" ? "monitoria" : "provas"));
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);
  const membro = situacao.logado && situacao.membro;

  // A aba fica no endereço (voltar e mandar o link abrem nela), sem recarregar.
  useEffect(() => {
    try {
      const u = new URL(window.location.href);
      if (aba === "provas") u.searchParams.delete("aba");
      else u.searchParams.set("aba", aba);
      window.history.replaceState(window.history.state, "", u);
    } catch {
      // sem histórico: a aba vale só nesta visita
    }
  }, [aba]);

  if (!t || !t3) return <EsqueletoDosAjustes rotulo={s.estados.carregando} quantos={3} />;

  function teclas(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const n = e.key === "Home" ? 0 : e.key === "End" ? ABAS.length - 1 : (i + (e.key === "ArrowRight" ? 1 : -1) + ABAS.length) % ABAS.length;
    setAba(ABAS[n]);
    botoes.current[n]?.focus();
  }

  return (
    <article className="es-pagina" aria-labelledby={`${id}-titulo`}>
      <FaixaDaPrevia t={t3} />
      <header className="es-cabeca">
        <Faixa className="es-faixa" />
        <h1 id={`${id}-titulo`} className="es-titulo al-cond">{t.titulo}</h1>
        <p className="es-chamada">{t.chamada}</p>
      </header>

      {!membro ? (
        <EstadoDaAlumia icone="cadeado" texto={t.entre} />
      ) : (
        <>
          <div className="es-abas" role="tablist" aria-label={t.abas.rotulo}>
            {ABAS.map((a, i) => (
              <button
                key={a}
                ref={(el) => {
                  botoes.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`${id}-aba-${a}`}
                aria-controls={`${id}-painel-${a}`}
                aria-selected={aba === a}
                tabIndex={aba === a ? 0 : -1}
                className="es-aba"
                onClick={() => setAba(a)}
                onKeyDown={(e) => teclas(e, i)}
              >
                {t.abas[a]}
              </button>
            ))}
          </div>
          <div role="tabpanel" id={`${id}-painel-${aba}`} aria-labelledby={`${id}-aba-${aba}`}>
            {aba === "provas" ? <AbaDasProvas t={t} lang={lang} avisar={torradas.mostrar} /> : <AbaDaMonitoria t={t} lang={lang} avisar={torradas.mostrar} />}
          </div>
        </>
      )}
      <Torradas estado={torradas} />
    </article>
  );
}
