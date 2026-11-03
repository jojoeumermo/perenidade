// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "@/components/Link";
import { fill, type Locale, localePath } from "@/i18n/config";
import type { TextosDaOrganizacao } from "@/i18n/escola/organizacao";
import {
  apagarRoda,
  guardarRodas,
  gravarRoda,
  lerRodasGuardadas,
  MAX_RESPOSTA_DA_RODA,
  PERGUNTAS_DA_RODA,
  type PerguntaDaRoda,
  respostaComNome,
  rodaDoSemestre,
  rodaVazia,
  textoDaRoda,
} from "@/lib/escola/organizacao";
import { hojeEmBrasilia, semestreDe } from "@/lib/escola/tempo";
import { useRodas } from "./guardado-organizacao";

type S = TextosDaOrganizacao["roda"];

/**
 * A Roda do semestre (E4-12): avaliação coletiva em 5 perguntas, feita neste aparelho, sozinha(o) ou em roda. Guarda até 4
 * rodas (uma por semestre) em "lucia:escola:roda-do-semestre". "Levar à ouvidoria" só abre a ouvidoria: NADA do texto vai
 * no endereço; a ouvidoria lê o rascunho daqui. Nada sai do aparelho sem o clique em Enviar lá.
 */
export function RodaDoSemestre({ s, lang }: { s: S; lang: Locale }) {
  const [semestre, setSemestre] = useState("");
  const [respostas, setRespostas] = useState(rodaVazia("").respostas);
  const [aviso, setAviso] = useState("");
  const [guarda, setGuarda] = useState(true);
  const pronto = useRef(false);
  const rodas = useRodas();

  // Só depois de abrir (no aparelho) sabemos o semestre e o que já foi escrito.
  useEffect(() => {
    const id = window.setTimeout(() => {
      const atual = semestreDe(hojeEmBrasilia()).id;
      setSemestre(atual);
      setRespostas(rodaDoSemestre(lerRodasGuardadas(), atual).respostas);
      pronto.current = true;
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const perguntas = Object.fromEntries(PERGUNTAS_DA_RODA.map((p) => [p, s[p]])) as Record<PerguntaDaRoda, string>;
  const folha = textoDaRoda({ semestre, em: "", respostas }, perguntas, fill(s.folha, { semestre }));

  function mudar(p: PerguntaDaRoda, valor: string) {
    if (!pronto.current) return;
    const novas = { ...respostas, [p]: valor.slice(0, MAX_RESPOSTA_DA_RODA) };
    setRespostas(novas);
    setAviso("");
    setGuarda(guardarRodas(gravarRoda(lerRodasGuardadas(), { semestre, respostas: novas, em: hojeEmBrasilia() })));
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(folha);
      setAviso(s.copiado);
    } catch {
      setAviso("");
    }
  }

  function apagar() {
    guardarRodas(apagarRoda(lerRodasGuardadas(), semestre));
    setRespostas(rodaVazia(semestre).respostas);
    setAviso(s.apagada);
  }

  return (
    <div data-roda="" data-roda-semestre={semestre}>
      <h3 className="org-subtitulo">{fill(s.semestre, { semestre })}</h3>
      <p className="org-nota">{s.nadaSai}</p>
      {!guarda && (
        <p className="org-erro" role="alert">
          {s.semAparelho}
        </p>
      )}
      <div className="no-print">
        {PERGUNTAS_DA_RODA.map((p) => (
          <div key={p} className="org-campo">
            <label htmlFor={`roda-${p}`}>{s[p]}</label>
            <textarea id={`roda-${p}`} className="org-input" rows={3} maxLength={MAX_RESPOSTA_DA_RODA} value={respostas[p]} onChange={(e) => mudar(p, e.target.value)} />
            <p className="org-nota">{fill(s.contador, { n: respostas[p].length, max: MAX_RESPOSTA_DA_RODA })}</p>
            {respostaComNome(respostas[p]) && (
              <p className="org-aviso" role="status" data-roda-aviso-nome="">
                {s.avisoNome}
              </p>
            )}
          </div>
        ))}
        <div className="org-botoes">
          <button type="button" className="botao" data-roda-copiar="" onClick={() => void copiar()}>
            {s.copiar}
          </button>
          <button type="button" className="botao" data-roda-imprimir="" onClick={() => window.print()}>
            {s.imprimir}
          </button>
          <Link href={localePath(lang, "/escola/ouvidoria?sobre=escola")} className="botao" data-roda-levar="">
            {s.levar}
          </Link>
          <button type="button" className="botao" data-roda-apagar="" onClick={apagar}>
            {s.apagar}
          </button>
        </div>
        <p className="org-nota" role="status" aria-live="polite">
          {aviso}
        </p>
        <p className="org-nota">{fill(s.guardadas, { n: rodas.length })}</p>
      </div>
      <pre className="roda-folha" data-roda-folha="">
        {folha}
      </pre>
    </div>
  );
}
