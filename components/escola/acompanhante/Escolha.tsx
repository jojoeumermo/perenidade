// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useId, useState } from "react";
import { RespostaDoAssistente } from "@/components/Assistente";
import { useGuardado } from "@/components/estudo/guardado";
import { L, useI18n } from "@/components/I18n";
import { fill, htmlLang, type Locale } from "@/i18n/config";
import { apagarConversas, type Conversa as ConversaGuardada, LIMITES, lerConversas } from "@/lib/escola/acompanhante";
import { Conversa, type Textos, useModoSeguro } from "./Conversa";
import { OutroJeito } from "./OutroJeito";

// A entrada do acompanhante (/escola/acompanhante): a escolha do modo e o histórico guardado neste aparelho, com
// "Apagar tudo". O histórico começa vazio no servidor e na hidratação e chega no primeiro efeito (useGuardado).

const SEM_CONVERSAS: ConversaGuardada[] = [];

function TirarDuvida({ s }: { s: Textos }) {
  const id = useId();
  const [trecho, setTrecho] = useState("");
  return (
    <div className="mt-3">
      <label htmlFor={`${id}-trecho`} className="block font-semibold">
        {s.duvida.trecho}
      </label>
      <p id={`${id}-dica`} className="text-sm text-ink-soft">
        {s.duvida.trechoDica}
      </p>
      <textarea id={`${id}-trecho`} aria-describedby={`${id}-dica`} value={trecho} maxLength={LIMITES.trecho} rows={4} onChange={(e) => setTrecho(e.target.value.slice(0, LIMITES.trecho))} className="acompanhante-campo mt-2 w-full border-2 border-ink bg-parchment px-3 py-2 font-serif text-base" />
      <Conversa
        s={s}
        modo="socratico"
        contexto={trecho.trim() ? { trecho: trecho.trim() } : undefined}
        itens={trecho.trim() ? ["trecho", "pergunta"] : ["pergunta"]}
        campo={{ rotulo: s.duvida.pergunta, dica: s.duvida.perguntaDica, max: 1000, min: 10, linhas: 3 }}
        semTextoBasta
        semServidor="busca"
      />
    </div>
  );
}

function Historico({ s }: { s: Textos }) {
  const { lang } = useI18n();
  const [conversas] = useGuardado<ConversaGuardada[]>(() => lerConversas(), SEM_CONVERSAS);
  const seguro = useModoSeguro();
  const [aviso, setAviso] = useState("");
  const h = s.hub.historico;
  const data = (ms: number) => new Date(ms).toLocaleString(htmlLang[lang as Locale] ?? "pt-BR", { dateStyle: "short", timeStyle: "short" });
  return (
    <section className="mt-10" aria-labelledby="historico-do-aparelho" data-historico-acompanhante>
      <h2 id="historico-do-aparelho" className="font-serif text-2xl font-semibold">
        {h.titulo}
      </h2>
      {seguro && <p className="mt-2 text-sm text-ink-soft">{h.nenhumaNoModoSeguro}</p>}
      {conversas.length === 0 ? (
        <p className="mt-3 text-ink-soft">{h.vazio}</p>
      ) : (
        <>
          <ul className="mt-3 space-y-2">
            {conversas.map((c) => (
              <li key={c.id}>
                <details className="acompanhante-modo">
                  <summary className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-mono text-xs uppercase tracking-widest text-ink-soft">{s.hub.nomesDosModos[c.modo]}</span>
                    <span className="font-semibold">{c.titulo}</span>
                    <span className="text-xs text-ink-soft">{fill(h.em, { data: data(c.atualizada) })}</span>
                  </summary>
                  <ol className="acompanhante-falas mt-3 space-y-2">
                    {c.falas.map((f, i) =>
                      f.de === "pessoa" ? (
                        <li key={i} className="acompanhante-fala-pessoa ml-auto max-w-[85%] border border-rule bg-parchment px-3 py-2 text-sm whitespace-pre-line">
                          <span className="sr-only">{s.comum.voce}: </span>
                          {f.texto}
                        </li>
                      ) : (
                        <li key={i}>
                          <RespostaDoAssistente texto={f.texto} cortada={Boolean(f.cortada)} rotulo={s.comum.rotuloResposta} aviso={s.comum.avisoAutomatico} avisoCortada={s.comum.cortada} lang={lang} />
                        </li>
                      ),
                    )}
                  </ol>
                  <p className="mt-3">
                    <button type="button" className="acompanhante-botao-claro" onClick={() => apagarConversas(c.id)}>
                      {h.apagar}
                    </button>
                  </p>
                </details>
              </li>
            ))}
          </ul>
          <p className="mt-4">
            <button
              type="button"
              className="acompanhante-botao-claro"
              data-apagar-tudo
              onClick={() => {
                if (!window.confirm(h.confirmar)) return;
                apagarConversas();
                setAviso(h.apagadas);
              }}
            >
              {h.apagarTudo}
            </button>
          </p>
        </>
      )}
      <p role="status" aria-live="polite" className="mt-2 text-sm">
        {aviso}
      </p>
      <p className="mt-2 text-xs text-ink-soft">{s.comum.historicoAqui}</p>
    </section>
  );
}

export function Escolha({ s }: { s: Textos }) {
  const m = s.hub.modos;
  const cartao = "acompanhante-modo block hover:text-ink";
  return (
    <>
      <h2 className="font-serif text-2xl font-semibold">{s.hub.escolha}</h2>
      <div className="acompanhante-modos mt-4">
        <details className="acompanhante-modo" data-modo-acompanhante="duvida">
          <summary>
            <span className="block font-serif text-xl font-semibold">{m.duvida.titulo}</span>
            <span className="mt-1 block text-sm text-ink-soft">{m.duvida.texto}</span>
          </summary>
          <TirarDuvida s={s} />
        </details>
        <div className={cartao} data-modo-acompanhante="pista">
          <p className="font-serif text-xl font-semibold">{m.pista.titulo}</p>
          <p className="mt-1 text-sm text-ink-soft">{m.pista.texto}</p>
          <L href="/meu-estudo/praticar" className="mt-2 inline-flex min-h-11 items-center font-semibold underline hover:text-oxblood">
            {s.hub.irParaPraticar} →
          </L>
        </div>
        <details className="acompanhante-modo" data-modo-acompanhante="outro-jeito">
          <summary>
            <span className="block font-serif text-xl font-semibold">{m.outroJeito.titulo}</span>
            <span className="mt-1 block text-sm text-ink-soft">{m.outroJeito.texto}</span>
          </summary>
          <OutroJeito s={s} />
        </details>
        {(
          [
            ["redacao", "/escola/acompanhante/redacao"],
            ["documento", "/escola/acompanhante/documento"],
            ["idioma", "/escola/acompanhante/conversa"],
          ] as const
        ).map(([chave, href]) => (
          <L key={chave} href={href} className={`${cartao} no-underline`} data-modo-acompanhante={chave}>
            <span className="block font-serif text-xl font-semibold">{m[chave].titulo} →</span>
            <span className="mt-1 block text-sm text-ink-soft">{m[chave].texto}</span>
          </L>
        ))}
      </div>
      <Historico s={s} />
    </>
  );
}
