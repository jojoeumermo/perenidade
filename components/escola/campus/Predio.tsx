// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { ATALHOS } from "@/components/celular/Atalhos";
import { L } from "@/components/I18n";
import { fill } from "@/i18n/config";
import type { PredioDoMapa } from "@/lib/escola/campus";
import type { TextosDoCampus } from "@/lib/escola/campus-servidor";

type S = TextosDoCampus["mapa"];

/** O desenho do prédio no quadrado com o tom dele (a cor de um atalho do celular; nada novo). */
function Fachada({ predio }: { predio: PredioDoMapa }) {
  const atalho = ATALHOS[predio.desenho];
  return (
    <span aria-hidden className="predio-tom flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.9rem] border-[1.5px] border-[#1f1a14]" style={{ background: atalho.fundo, color: atalho.tinta }}>
      <svg viewBox="0 0 24 24" className="h-[24px] w-[24px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {atalho.desenho}
      </svg>
    </span>
  );
}

/** O carimbo do passaporte: só para quem já passou por uma seção do prédio neste aparelho. */
function Carimbo({ s, dia }: { s: S; dia: string }) {
  return (
    <span title={s.carimbo} className="carimbo-do-predio inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-oxblood text-oxblood" data-carimbo={dia}>
      <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
      <span className="sr-only">{s.carimbo}</span>
    </span>
  );
}

function Cabeca({ predio, s, carimbo, comFrase = true }: { predio: PredioDoMapa; s: S; carimbo?: string; comFrase?: boolean }) {
  return (
    <span className="flex min-w-0 items-start gap-2.5">
      <Fachada predio={predio} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="block font-serif text-[1.2rem] font-semibold leading-tight">{predio.nome}</span>
          {carimbo && <Carimbo s={s} dia={carimbo} />}
        </span>
        {comFrase && <span className="predio-frase mt-0.5 block font-sans text-[0.8rem] leading-snug text-ink-soft">{predio.frase}</span>}
      </span>
    </span>
  );
}

function Lista({ predio, aoAbrir, compacta }: { predio: PredioDoMapa; aoAbrir?: (path: string) => void; compacta?: boolean }) {
  return (
    <ul className={compacta ? "mt-2 border-t border-rule" : "mt-3 border-t border-rule"}>
      {predio.itens.map((item) => (
        <li key={item.path} className="border-b border-rule last:border-b-0">
          <L href={item.path} onClick={() => aoAbrir?.(item.path)} title={item.description} className="predio-link gap-2 py-1 font-sans text-[0.92rem] font-medium text-ink underline-offset-4 hover:text-prelo-texto hover:underline">
            <span className="min-w-0 flex-1">{item.label}</span>
            <span aria-hidden className="text-ink-soft">›</span>
          </L>
        </li>
      ))}
    </ul>
  );
}

/**
 * Um prédio do campus. No celular é uma gaveta (o nome, a frase de porta e, aberta, as seções de dentro); no computador,
 * o cartão com tudo à vista. As duas formas vêm no HTML e o CSS mostra uma, para funcionar sem JavaScript.
 */
export function Predio({ predio, s, carimbo, aoAbrir, aberto }: { predio: PredioDoMapa; s: S; carimbo?: string; aoAbrir?: (path: string) => void; aberto?: boolean }) {
  return (
    <li className="predio" data-predio={predio.id} data-visitado={carimbo ? "" : undefined}>
      <details className="campus-celular h-full border-[1.5px] border-ink bg-folha p-3" open={aberto}>
        <summary className="cursor-pointer" title={fill(s.abrir, { nome: predio.nome })}>
          <Cabeca predio={predio} s={s} carimbo={carimbo} />
          <span className="mt-1.5 block font-mono text-[0.68rem] uppercase tracking-[0.12em] text-ink-soft">{fill(s.secoes, { n: predio.itens.length })}</span>
        </summary>
        <Lista predio={predio} aoAbrir={aoAbrir} compacta />
      </details>
      <div className="campus-computador h-full flex-col border-2 border-ink bg-folha p-4">
        <Cabeca predio={predio} s={s} carimbo={carimbo} />
        <Lista predio={predio} aoAbrir={aoAbrir} />
      </div>
    </li>
  );
}
