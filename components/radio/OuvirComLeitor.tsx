// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import type { TextosDoSom } from "@/i18n/escola/som";
import { carregarLista, faltaBaixar, lerEscolha, VOZ_DO_APARELHO } from "@/lib/vozes/catalogo";
import { iniciar, parar, useLeitor } from "@/lib/vozes/leitor";

/**
 * O botão "Ouvir" do Som do campus (Hoje no campus e o cordel da aula): lê o trecho `alvo` com o leitor das aulas
 * (lib/vozes/leitor.ts), na voz que a pessoa escolheu. Com a voz do aparelho, nada é baixado nem enviado. Se a voz
 * escolhida for uma voz natural que ainda não está no aparelho, pergunta antes, dizendo o tamanho; nunca baixa sozinho.
 * Ao sair da página, a leitura que este botão começou para.
 */
export function OuvirComLeitor({ alvo, lang, s, className = "" }: { alvo: string; lang: string; s: TextosDoSom["ouvir"]; className?: string }) {
  const leitor = useLeitor();
  const [pergunta, setPergunta] = useState<{ bytes: number } | null>(null);
  // A leitura em curso foi começada por este botão? (o estado desenha; a referência serve à limpeza ao sair)
  const [minha, setMinha] = useState(false);
  const meu = useRef(false);
  const lendoAqui = leitor.ativo && minha;

  useEffect(
    () => () => {
      if (meu.current) parar();
    },
    [],
  );

  function comecar() {
    meu.current = true;
    setMinha(true);
    void iniciar([alvo]);
  }

  async function ouvir() {
    if (lendoAqui) {
      parar();
      meu.current = false;
      setMinha(false);
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
    comecar();
  }

  const tamanho = pergunta ? `${new Intl.NumberFormat(lang, { maximumFractionDigits: 0 }).format(Math.max(1, pergunta.bytes / 1_000_000))} MB` : "";
  return (
    <div className={`no-print font-sans ${className}`}>
      <button type="button" onClick={() => void ouvir()} aria-pressed={lendoAqui} className="som-botao inline-flex min-h-11 cursor-pointer items-center gap-2 border-2 border-ink bg-folha px-4 font-semibold hover:border-oxblood hover:text-oxblood">
        <svg viewBox="0 0 20 20" aria-hidden className="h-4 w-4" fill="currentColor">
          {lendoAqui ? <rect x="5" y="5" width="10" height="10" /> : <path d="M3 8h3l5-4v12l-5-4H3z M13.5 6.5a5 5 0 0 1 0 7l-1-1a3.6 3.6 0 0 0 0-5z" />}
        </svg>
        {lendoAqui ? s.parar : s.ouvir}
      </button>
      {pergunta && (
        <div role="alert" className="mt-3 max-w-xl border border-rule bg-parchment-deep p-4 text-sm">
          <p>{s.baixarVoz.replace("{tamanho}", tamanho)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="min-h-11 cursor-pointer border-2 border-ink px-4 font-medium hover:border-oxblood hover:text-oxblood"
              onClick={() => {
                setPergunta(null);
                comecar();
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
      {leitor.erro === "sem-voz" && minha && <p className="mt-2 text-sm text-ink-soft">{s.semVoz}</p>}
    </div>
  );
}
