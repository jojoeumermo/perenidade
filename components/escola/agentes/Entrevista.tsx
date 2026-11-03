// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useId, useMemo, useState } from "react";
import { useI18n } from "@/components/I18n";
import { fill } from "@/i18n/config";
import type { TextosDoAcompanhante } from "@/i18n/escola/acompanhante";
import type { TextosDosAgentes } from "@/i18n/escola/agentes";
import { type Fala, lerTrabalho } from "@/lib/escola/acompanhante";
import { conferirCampo, contextoDaEntrevista, etapaDaEntrevista, LIMITES_DOS_AGENTES } from "@/lib/escola/agentes";
import { Conversa } from "../acompanhante/Conversa";
import { conferirComTextos } from "./conferir";

/**
 * Ensaio de entrevista (modo "entrevista" do assistente): a vaga, a conta "Pergunta n de 5" e a conversa. A primeira
 * mensagem só abre a entrevista; as 5 respostas seguintes são contadas no aparelho (lib/escola/agentes.ts). No fim:
 * "Treino concluído, sem nota". A vaga vai no contexto do pedido e nunca é gravada fora do histórico comum.
 */
export function Entrevista({ s, comum, a }: { s: TextosDosAgentes["entrevista"]; comum: TextosDosAgentes["comum"]; a: TextosDoAcompanhante }) {
  const { lang } = useI18n();
  const id = useId();
  const [vaga, setVaga] = useState("");
  const [falas, setFalas] = useState<readonly Fala[]>([]);
  const [versao, setVersao] = useState(0);
  const [aviso, setAviso] = useState("");
  const etapa = etapaDaEntrevista(falas);
  const contexto = useMemo(() => (vaga.trim() ? contextoDaEntrevista(vaga, falas) : undefined), [vaga, falas]);
  const dadoNaVaga = conferirCampo(vaga);
  const conferir = useMemo(() => conferirComTextos(comum), [comum]);
  const comecou = falas.length > 0;

  return (
    <div data-entrevista>
      <section>
        {comecou ? (
          <p>
            <span className="font-semibold">{s.vaga}:</span> {vaga}
          </p>
        ) : (
          <>
            <label htmlFor={`${id}-campo`} id={`${id}-vaga`} className="block font-semibold">
              {s.vaga}
            </label>
            <p id={`${id}-dica`} className="text-sm text-ink-soft">
              {s.vagaDica}
            </p>
            <input
              id={`${id}-campo`}
              aria-labelledby={`${id}-vaga`}
              aria-describedby={`${id}-dica`}
              type="text"
              value={vaga}
              maxLength={LIMITES_DOS_AGENTES.vaga}
              onChange={(e) => {
                setVaga(e.target.value.slice(0, LIMITES_DOS_AGENTES.vaga));
                setAviso("");
              }}
              className="acompanhante-campo mt-2 w-full border-2 border-ink bg-parchment px-3 py-2 font-serif text-base"
              data-vaga
            />
            {dadoNaVaga && (
              <p role="status" className={`mt-1 text-sm font-semibold ${dadoNaVaga.bloqueia ? "text-oxblood" : ""}`}>
                {comum.dadoPessoal[dadoNaVaga.aviso]}
              </p>
            )}
            <p className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="acompanhante-botao-claro"
                onClick={() => {
                  const trabalho = lerTrabalho();
                  setVaga(trabalho.slice(0, LIMITES_DOS_AGENTES.vaga));
                  setAviso(trabalho ? "" : s.semTrabalho);
                }}
              >
                {s.usarTrabalho}
              </button>
            </p>
            <p role="status" className="mt-1 text-sm text-ink-soft">
              {aviso}
            </p>
            <p className="mt-3 text-sm font-semibold">{s.exemplosTitulo}</p>
            <ul className="mt-1 flex flex-wrap gap-2">
              {s.exemplos.map((exemplo) => (
                <li key={exemplo}>
                  <button type="button" className="acompanhante-botao-claro" onClick={() => setVaga(exemplo)}>
                    {exemplo}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {vaga.trim() && !etapa.terminou && (
        <p className="mt-6 font-mono text-sm uppercase tracking-widest text-oxblood" data-etapa-da-entrevista aria-live="polite">
          {fill(s.etapa, { n: Math.min(etapa.total, etapa.respondidas + 1), total: etapa.total })}
        </p>
      )}
      {!vaga.trim() && <p className="mt-6 text-sm text-ink-soft">{s.escolhaAVaga}</p>}

      {etapa.terminou && (
        <section className="mt-6 border-2 border-ink p-4" data-entrevista-concluida>
          <h2 className="font-serif text-2xl font-semibold">{s.concluido}</h2>
          <p className="mt-2">{s.concluidoTexto}</p>
        </section>
      )}

      <div className="mt-4">
        <Conversa
          key={versao}
          s={a}
          modo="entrevista"
          contexto={contexto}
          itens={["vaga"]}
          campo={{ rotulo: s.resposta, dica: s.respostaDica, max: LIMITES_DOS_AGENTES.respostaMax, min: 3, linhas: 5, lang }}
          botao={comecou ? s.botaoResponder : s.botaoComecar}
          inicial={s.comecar}
          semServidor="aviso"
          bloqueado={!vaga.trim() || Boolean(dadoNaVaga?.bloqueia)}
          conferirTexto={conferir}
          encerrarQuando={(f) => etapaDaEntrevista(f).terminou}
          aoMudar={(f) => {
            setFalas(f);
            if (f.length === 0) setVersao((v) => v + 1);
          }}
        />
      </div>
    </div>
  );
}
