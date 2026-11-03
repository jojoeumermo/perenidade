// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import type pt from "@/i18n/escola/matricula/pt.json";
import { carregarLista, faltaBaixar, lerEscolha, VOZ_DO_APARELHO } from "@/lib/vozes/catalogo";
import { iniciar, parar, useLeitor } from "@/lib/vozes/leitor";

export type TextosDoFluxo = (typeof pt)["fluxo"];

export interface OpcaoDaPergunta {
  valor: string;
  titulo: string;
  frase: string;
  icone?: ReactNode;
}

/**
 * "Ouvir a pergunta", com o leitor das aulas (lib/vozes/leitor.ts) e a voz que a pessoa escolheu. Se a voz natural
 * escolhida ainda precisa baixar, pergunta antes (quem tem o pacote de dados contado decide). Ao trocar de pergunta, a
 * leitura para.
 */
export function OuvirPergunta({ alvo, s, lang }: { alvo: string; s: TextosDoFluxo; lang: string }) {
  const leitor = useLeitor();
  const [pergunta, setPergunta] = useState<{ bytes: number } | null>(null);
  useEffect(
    () => () => {
      parar();
    },
    [alvo],
  );

  async function ouvir() {
    if (leitor.ativo) {
      parar();
      return;
    }
    const escolha = lerEscolha();
    if (escolha.voz !== VOZ_DO_APARELHO) {
      const lista = await carregarLista();
      const voz = lista?.vozes.find((v) => v.id === escolha.voz);
      const falta = lista && voz ? await faltaBaixar(lista, voz) : 0;
      if (falta > 0) {
        setPergunta({ bytes: falta });
        return;
      }
    }
    void iniciar([`#${alvo}`]);
  }

  const tamanho = pergunta ? `${new Intl.NumberFormat(lang, { maximumFractionDigits: 0 }).format(Math.max(1, pergunta.bytes / 1_000_000))} MB` : "";
  return (
    <div className="font-sans text-sm">
      <button type="button" onClick={() => void ouvir()} aria-pressed={leitor.ativo} className="inline-flex min-h-11 cursor-pointer items-center gap-2 px-1 underline hover:text-oxblood">
        <svg aria-hidden viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M3 8v4h3l4 3V5L6 8H3z" />
          {!leitor.ativo && <path d="M13 7.5a3.5 3.5 0 0 1 0 5M15.5 5a7 7 0 0 1 0 10" />}
        </svg>
        {leitor.ativo ? s.pararDeOuvir : s.ouvir}
      </button>
      {pergunta && (
        <div role="alert" className="mt-2 border border-rule bg-parchment-deep p-3">
          <p>{s.baixarVoz.replace("{tamanho}", tamanho)}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="min-h-11 cursor-pointer border-2 border-ink px-4 font-medium hover:border-oxblood hover:text-oxblood"
              onClick={() => {
                setPergunta(null);
                void iniciar([`#${alvo}`]);
              }}
            >
              {s.baixarSim}
            </button>
            <button type="button" className="min-h-11 cursor-pointer px-4 underline hover:text-oxblood" onClick={() => setPergunta(null)}>
              {s.baixarNao}
            </button>
          </div>
        </div>
      )}
      {leitor.erro === "sem-voz" && <p className="mt-2 text-ink-soft">{s.semVoz}</p>}
    </div>
  );
}

/** A barra de baixo de cada tela: "Voltar" e "Pular". */
export function VoltarEPular({ s, voltar, pular }: { s: TextosDoFluxo; voltar?: () => void; pular?: () => void }) {
  if (!voltar && !pular) return null;
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-4 font-sans">
      {voltar ? (
        <button type="button" onClick={voltar} className="inline-flex min-h-11 cursor-pointer items-center border-2 border-ink px-5 font-semibold hover:border-oxblood hover:text-oxblood">
          ← {s.voltar}
        </button>
      ) : (
        <span />
      )}
      {pular && (
        <button type="button" onClick={pular} className="inline-flex min-h-11 cursor-pointer items-center px-3 font-semibold underline hover:text-oxblood">
          {s.pular} →
        </button>
      )}
    </div>
  );
}

/**
 * Uma pergunta de vida da matrícula, numa tela só: o título (que recebe o foco quando a tela troca, para o leitor de
 * tela anunciar), "Ouvir a pergunta", as opções em botões grandes (um toque escolhe e segue) e "Voltar" e "Pular".
 */
export function PerguntaDeVida({
  id,
  contador,
  pergunta,
  dica,
  opcoes,
  escolhido,
  escolher,
  voltar,
  pular,
  focar,
  s,
  lang,
}: {
  id: string;
  contador?: string;
  pergunta: string;
  dica?: string;
  opcoes: OpcaoDaPergunta[];
  escolhido?: string;
  escolher: (valor: string) => void;
  voltar?: () => void;
  pular?: () => void;
  focar: boolean;
  s: TextosDoFluxo;
  lang: string;
}) {
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focar) titulo.current?.focus();
  }, [focar, id]);
  const alvo = `pergunta-${id}`;
  return (
    <section aria-labelledby={`${alvo}-titulo`} data-pergunta={id} className="mt-8">
      <div id={alvo}>
        {contador && <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-soft">{contador}</p>}
        <h2 id={`${alvo}-titulo`} ref={titulo} tabIndex={-1} className="mt-2 font-serif text-3xl font-semibold leading-tight outline-none sm:text-4xl">
          {pergunta}
        </h2>
        {dica && <p className="mt-2 font-sans text-ink-soft">{dica}</p>}
        {/* As opções entram na leitura em voz alta, depois da pergunta. O leitor das aulas pula botões, então elas vão
            repetidas aqui, escondidas da tela e (com inert) do leitor de tela, que já lê os botões. */}
        <ul className="matricula-para-ouvir" inert>
          {opcoes.map((o) => (
            <li key={o.valor}>
              {o.titulo}. {o.frase}
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-3">
        <OuvirPergunta alvo={alvo} s={s} lang={lang} />
      </div>
      <ul className="mt-5 grid gap-3 font-sans sm:grid-cols-2">
        {opcoes.map((o) => (
          <li key={o.valor}>
            <button type="button" className="matricula-opcao h-full" aria-pressed={escolhido === o.valor} onClick={() => escolher(o.valor)} data-opcao={o.valor}>
              {o.icone && <span className="matricula-icone">{o.icone}</span>}
              <span>
                <span className="block font-serif text-xl font-semibold">{o.titulo}</span>
                <span className="mt-0.5 block text-sm text-ink-soft">{o.frase}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <VoltarEPular s={s} voltar={voltar} pular={pular} />
    </section>
  );
}
