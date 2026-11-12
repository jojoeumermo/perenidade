// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { L } from "@/components/I18n";
import { fill } from "@/i18n/config";
import type { TextosDoAssistente } from "@/i18n/assistente";
import { filtrarPerguntas, type PerguntaFrequente } from "@/lib/perguntas-frequentes";

const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A janela do botão "?" em todas as páginas: perguntas frequentes com respostas PRONTAS (content/perguntas-frequentes.json).
 * Sem IA, sem pedido a servidor nenhum e sem texto livre interpretado: a pessoa escolhe uma pergunta da lista ou digita
 * para FILTRAR a lista (lib/perguntas-frequentes.ts, aqui no navegador). O que ela digita não sai do aparelho e não é guardado.
 *
 * Acessível: diálogo com o foco preso (Tab e Shift+Tab giram dentro dele; Esc fecha, no BotaoDoAssistente), o foco vai ao
 * campo ao abrir, setas para cima e para baixo andam pela lista (Home e End vão ao começo e ao fim), cada pergunta é um botão
 * que abre e fecha a resposta (aria-expanded), e a contagem do filtro é anunciada (role="status").
 */
export function PainelDoAssistente({
  textos: s,
  perguntas,
  email,
  aberto,
  fechar,
}: {
  textos: TextosDoAssistente;
  perguntas: PerguntaFrequente[];
  email: string;
  aberto: boolean;
  fechar: () => void;
}) {
  const [busca, setBusca] = useState("");
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const janela = useRef<HTMLElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const base = useId();
  const tituloId = `${base}-titulo`;
  const leadId = `${base}-lead`;
  const listaId = `${base}-lista`;

  const achadas = useMemo(() => filtrarPerguntas(perguntas, busca), [perguntas, busca]);
  const nada = busca.trim() !== "" && achadas.length === 0;
  // Sem nada que case, a lista inteira continua à vista ("veja as perguntas abaixo").
  const mostradas = nada ? perguntas : achadas;

  // Ao abrir, o foco vai para o campo do filtro.
  useEffect(() => {
    if (aberto) campo.current?.focus();
  }, [aberto]);

  function botoesDaLista(): HTMLButtonElement[] {
    return Array.from(lista.current?.querySelectorAll<HTMLButtonElement>("button[data-pergunta]") ?? []);
  }

  function andarNaLista(e: React.KeyboardEvent) {
    const botoes = botoesDaLista();
    if (!botoes.length) return;
    const atual = botoes.indexOf(document.activeElement as HTMLButtonElement);
    let proximo: number | null = null;
    if (e.key === "ArrowDown") proximo = atual < 0 ? 0 : Math.min(botoes.length - 1, atual + 1);
    else if (e.key === "ArrowUp") proximo = atual <= 0 ? -1 : atual - 1;
    else if (e.key === "Home" && atual >= 0) proximo = 0;
    else if (e.key === "End" && atual >= 0) proximo = botoes.length - 1;
    if (proximo === null) return;
    e.preventDefault();
    if (proximo < 0) campo.current?.focus();
    else botoes[proximo].focus();
  }

  // O foco não sai da janela enquanto ela está aberta: Tab no último volta ao primeiro, e Shift+Tab no primeiro vai ao último.
  function prenderFoco(e: React.KeyboardEvent) {
    if (e.key !== "Tab" || !janela.current) return;
    const focaveis = Array.from(janela.current.querySelectorAll<HTMLElement>(FOCAVEIS)).filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (!focaveis.length) return;
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    if (e.shiftKey && (document.activeElement === primeiro || !janela.current.contains(document.activeElement))) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primeiro.focus();
    }
  }

  return (
    <section
      ref={janela}
      id="assistente-do-site"
      role="dialog"
      aria-modal="true"
      aria-labelledby={tituloId}
      aria-describedby={leadId}
      onKeyDown={(e) => {
        prenderFoco(e);
        andarNaLista(e);
      }}
      className="assistente-janela al-pele absolute bottom-14 left-0 flex max-h-[max(16rem,min(calc(100dvh-19rem),40rem))] w-[min(24rem,calc(100vw-1.5rem))] flex-col border-2 border-ink bg-folha text-ink shadow-[6px_6px_0_var(--sombra)]"
    >
      <header className="flex items-start justify-between gap-3 border-b border-rule px-4 py-3">
        <div>
          <h2 id={tituloId} className="font-serif text-xl font-semibold">{s.titulo}</h2>
          <p id={leadId} className="mt-1 text-xs text-ink-soft">{s.lead}</p>
        </div>
        <button type="button" onClick={fechar} aria-label={s.fechar} title={s.fechar} className="assistente-fechar -mr-1 h-9 w-9 shrink-0 cursor-pointer text-xl leading-none hover:text-oxblood">
          <span aria-hidden>×</span>
        </button>
      </header>

      <div className="border-b border-rule px-4 py-3">
        <label htmlFor={`${base}-filtro`} className="block text-sm font-semibold">{s.filtro}</label>
        <input
          id={`${base}-filtro`}
          ref={campo}
          type="search"
          value={busca}
          maxLength={120}
          autoComplete="off"
          spellCheck={false}
          placeholder={s.dica}
          aria-controls={listaId}
          aria-describedby={`${base}-privacidade`}
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => {
            // Enter no campo abre a primeira pergunta que sobrou (e nada mais: não há pedido a enviar).
            if (e.key === "Enter") {
              e.preventDefault();
              const primeira = botoesDaLista()[0];
              if (primeira && !nada) {
                setAbertaId(primeira.dataset.pergunta ?? null);
                primeira.focus();
              }
            }
          }}
          className="assistente-campo mt-1 w-full border-2 border-ink bg-parchment px-2 py-1.5 font-sans text-base"
        />
        <p id={`${base}-privacidade`} className="mt-1 text-xs text-ink-soft">{s.privacidade}</p>
        <p role="status" aria-live="polite" className="mt-1 text-xs text-ink-soft">
          {busca.trim() !== "" && !nada ? fill(s.contagem, { n: achadas.length, total: perguntas.length }) : ""}
        </p>
        {nada && (
          <p className="mt-1 text-sm">
            {s.naoAchei}{s.entre}
            <a href={`mailto:${email}`} className="font-semibold underline hover:text-oxblood">{s.faleConosco}</a>{s.fim}
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        <ul ref={lista} id={listaId} aria-label={s.lista} className="space-y-1">
          {mostradas.map((p) => {
            const aberta = abertaId === p.id;
            const respostaId = `${base}-r-${p.id}`;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  data-pergunta={p.id}
                  aria-expanded={aberta}
                  aria-controls={respostaId}
                  onClick={() => setAbertaId(aberta ? null : p.id)}
                  className="flex w-full cursor-pointer items-start gap-2 px-2 py-2 text-left font-sans text-sm font-semibold hover:bg-parchment-deep hover:text-oxblood aria-expanded:bg-parchment-deep"
                >
                  <span aria-hidden className="mt-px w-3 shrink-0 font-mono text-oxblood">{aberta ? "−" : "+"}</span>
                  <span>{p.pergunta}</span>
                </button>
                <div id={respostaId} hidden={!aberta} className="mx-2 mb-2 border-l-4 border-gold bg-parchment-deep px-3 py-2">
                  <p className="font-serif text-base">{p.resposta}</p>
                  {p.href && (
                    <p className="mt-2 text-sm">
                      <L href={p.href} onClick={fechar} className="font-semibold underline hover:text-oxblood">
                        {s.abrir} <span aria-hidden>→</span>
                      </L>
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
