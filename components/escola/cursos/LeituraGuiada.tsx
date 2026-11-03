// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useGuardado } from "@/components/estudo/guardado";
import { fill } from "@/i18n/config";
import type { TextosDosCursos } from "@/i18n/escola/cursos";
import { apagarRespostas, gravarResposta, type LeituraGuiada as Leitura, lerRespostas, MAX_RESPOSTA, respondidas } from "@/lib/escola/leituras";

const SEM_RESPOSTAS: Record<string, string[]> = {};

/**
 * A leitura guiada (R1-44): por seção da obra, o trecho de referência (onde ler) e as perguntas, cada uma com um campo
 * de resposta. As respostas ficam SÓ neste aparelho ("lucia:escola:leituras"), gravadas enquanto a pessoa escreve (com
 * uma pequena espera). Nada é enviado. No servidor e na hidratação os campos começam vazios; o guardado chega no
 * primeiro efeito.
 */
export function LeituraGuiada({ leitura, s }: { leitura: Leitura; s: TextosDosCursos["leitura"] }) {
  const [guardadas] = useGuardado(() => lerRespostas(leitura.obra), SEM_RESPOSTAS);
  const [rascunho, setRascunho] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<"" | "guardado" | "erro" | "apagado">("");
  const espera = useRef<Record<string, number>>({});
  const id = useId();

  // O que foi escrito e ainda não foi gravado (a gravação espera meio segundo sem digitar).
  const pendentes = useRef<Record<string, { secao: string; i: number; texto: string }>>({});

  // Ao sair da página (ou desmontar), grava o que ficou pendente.
  useEffect(() => {
    const obra = leitura.obra;
    const timers = espera.current;
    const fila = pendentes.current;
    const gravarTudo = () => {
      for (const [k, p] of Object.entries(fila)) {
        window.clearTimeout(timers[k]);
        gravarResposta(obra, p.secao, p.i, p.texto);
        delete fila[k];
      }
    };
    window.addEventListener("pagehide", gravarTudo);
    return () => {
      window.removeEventListener("pagehide", gravarTudo);
      gravarTudo();
    };
  }, [leitura.obra]);

  const chave = (secao: string, i: number) => `${secao}:${i}`;
  const valor = (secao: string, i: number) => rascunho[chave(secao, i)] ?? guardadas[secao]?.[i] ?? "";

  const escrever = (secao: string, i: number, texto: string) => {
    const k = chave(secao, i);
    setRascunho((r) => ({ ...r, [k]: texto }));
    pendentes.current[k] = { secao, i, texto };
    window.clearTimeout(espera.current[k]);
    espera.current[k] = window.setTimeout(() => {
      delete pendentes.current[k];
      setAviso(gravarResposta(leitura.obra, secao, i, texto) ? "guardado" : "erro");
    }, 500);
  };

  const gravarAgora = (secao: string, i: number) => {
    const k = chave(secao, i);
    const pendente = pendentes.current[k];
    if (!pendente) return;
    window.clearTimeout(espera.current[k]);
    delete pendentes.current[k];
    setAviso(gravarResposta(leitura.obra, secao, i, pendente.texto) ? "guardado" : "erro");
  };

  const apagar = () => {
    if (!window.confirm(s.apagarConfirma)) return;
    for (const k of Object.keys(espera.current)) window.clearTimeout(espera.current[k]);
    for (const k of Object.keys(pendentes.current)) delete pendentes.current[k];
    setRascunho({});
    setAviso(apagarRespostas(leitura.obra) ? "apagado" : "erro");
  };

  const atuais: Record<string, string[]> = {};
  for (const sec of leitura.secoes) atuais[sec.id] = sec.perguntas.map((_, i) => valor(sec.id, i));
  const total = leitura.secoes.reduce((n, sec) => n + sec.perguntas.length, 0);
  const feitas = respondidas(leitura, atuais);

  return (
    <div className="leitura-guiada">
      <p className="font-sans text-sm text-ink-soft" role="status" aria-live="polite">
        {fill(s.progresso, { n: feitas, total })}
        {aviso === "guardado" && <span className="ml-2">· {s.guardado}</span>}
        {aviso === "apagado" && <span className="ml-2">· {s.apagado}</span>}
      </p>
      {aviso === "erro" && (
        <p role="alert" className="mt-1 font-sans text-sm font-semibold text-oxblood">
          {s.naoGuardou}
        </p>
      )}
      <ol className="leitura-secoes">
        {leitura.secoes.map((sec) => (
          <li key={sec.id} id={sec.id} className="leitura-secao">
            <h2 className="font-serif text-2xl font-semibold" lang="pt">
              {sec.titulo}
            </h2>
            <p className="leitura-onde">
              <span className="rotulo">{s.onde}</span>
              <span className="mt-1 block" lang="pt">
                {sec.referencia}
              </span>
            </p>
            <ol className="leitura-perguntas">
              {sec.perguntas.map((p, i) => {
                const campo = `${id}-${sec.id}-${i}`;
                return (
                  <li key={p}>
                    <label htmlFor={campo} className="block">
                      <span className="rotulo">{fill(s.pergunta, { n: i + 1 })}</span>
                      <span className="mt-1 block font-serif text-lg" lang="pt">
                        {p}
                      </span>
                    </label>
                    <textarea
                      id={campo}
                      className="leitura-resposta"
                      rows={4}
                      maxLength={MAX_RESPOSTA}
                      value={valor(sec.id, i)}
                      onChange={(e) => escrever(sec.id, i, e.target.value)}
                      onBlur={() => gravarAgora(sec.id, i)}
                    />
                  </li>
                );
              })}
            </ol>
          </li>
        ))}
      </ol>
      <p className="mt-8 font-sans text-sm text-ink-soft">{s.privacidade}</p>
      <button type="button" onClick={apagar} className="mt-3 inline-flex min-h-11 items-center border-2 border-ink px-4 py-2 font-sans text-sm font-semibold hover:border-oxblood hover:text-oxblood">
        {s.apagar}
      </button>
    </div>
  );
}
