// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { ATALHOS } from "@/components/celular/Atalhos";
import { L } from "@/components/I18n";
import { fill } from "@/i18n/config";
import type { PredioDoMapa } from "@/lib/escola/campus";
import type { TextosDoCampus } from "@/lib/escola/campus-servidor";

type S = TextosDoCampus["mapa"];

/** O desenho do prédio no quadrado com o tom dele (a cor de um atalho do celular; nada novo). */
function Fachada({ predio, pequena }: { predio: PredioDoMapa; pequena?: boolean }) {
  const atalho = ATALHOS[predio.desenho];
  return (
    <span aria-hidden className={`predio-tom flex shrink-0 items-center justify-center border-[1.5px] border-[#1f1a14] ${pequena ? "h-9 w-9 rounded-[0.75rem]" : "h-11 w-11 rounded-[0.9rem]"}`} style={{ background: atalho.fundo, color: atalho.tinta }}>
      <svg viewBox="0 0 24 24" className={pequena ? "h-[20px] w-[20px]" : "h-[24px] w-[24px]"} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

function Cabeca({ predio, s, carimbo, comFrase = true, compacta }: { predio: PredioDoMapa; s: S; carimbo?: string; comFrase?: boolean; compacta?: boolean }) {
  return (
    <span className={`flex min-w-0 items-start ${compacta ? "gap-2" : "gap-2.5"}`}>
      <Fachada predio={predio} pequena={compacta} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className={`block font-serif font-semibold leading-tight ${compacta ? "text-[1.08rem]" : "text-[1.2rem]"}`}>{predio.nome}</span>
          {compacta && <span className="font-mono text-[0.66rem] text-ink-soft">{predio.itens.length}</span>}
          {carimbo && <Carimbo s={s} dia={carimbo} />}
        </span>
        {comFrase && <span className={`predio-frase mt-0.5 block font-sans leading-snug text-ink-soft ${compacta ? "line-clamp-2 text-[0.76rem]" : "text-[0.8rem]"}`}>{predio.frase}</span>}
      </span>
    </span>
  );
}

/** Quantas seções cada prédio mostra de cara no mapa compacto do "Mais"; o resto fica no "Ver tudo". */
const NO_COMPACTO = 5;

function Itens({ itens, aoAbrir, compacto }: { itens: PredioDoMapa["itens"]; aoAbrir?: (path: string) => void; compacto?: boolean }) {
  return itens.map((item) => (
    <li key={item.path} className="border-b border-rule last:border-b-0">
      <L
        href={item.path}
        onClick={() => aoAbrir?.(item.path)}
        title={item.description}
        className={`predio-link gap-2 font-sans font-medium text-ink underline-offset-4 hover:text-prelo-texto hover:underline ${compacto ? "py-0.5 text-[0.88rem]" : "py-1 text-[0.92rem]"}`}
      >
        <span className="min-w-0 flex-1">{item.label}</span>
        <span aria-hidden className="text-ink-soft">›</span>
      </L>
    </li>
  ));
}

function Lista({ predio, s, aoAbrir, compacta, limite }: { predio: PredioDoMapa; s: S; aoAbrir?: (path: string) => void; compacta?: boolean; limite?: number }) {
  // Só esconde quando sobram pelo menos três: "Ver tudo" para uma ou duas seções ocupa o mesmo lugar que elas.
  const corta = limite !== undefined && predio.itens.length > limite + 2;
  const vistos = corta ? predio.itens.slice(0, limite) : predio.itens;
  const resto = corta ? predio.itens.slice(limite) : [];
  return (
    <>
      <ul className={compacta ? "mt-2 border-t border-rule" : "mt-3 border-t border-rule"}>
        <Itens itens={vistos} aoAbrir={aoAbrir} compacto={limite !== undefined} />
      </ul>
      {resto.length > 0 && (
        <details className="predio-resto group/resto">
          <summary className="predio-link cursor-pointer gap-1.5 font-mono text-[0.7rem] uppercase tracking-[0.12em] text-prelo-texto hover:underline">
            <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5 transition-transform group-open/resto:rotate-90 motion-reduce:transition-none" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5l7 7-7 7" />
            </svg>
            {fill(s.verTudo, { n: predio.itens.length })}
          </summary>
          <ul className="border-t border-rule">
            <Itens itens={resto} aoAbrir={aoAbrir} compacto />
          </ul>
        </details>
      )}
    </>
  );
}

/**
 * Um prédio do campus. No celular é uma gaveta (o nome, a frase de porta e, aberta, as seções de dentro); no computador,
 * o cartão com tudo à vista. As duas formas vêm no HTML e o CSS mostra uma, para funcionar sem JavaScript.
 * `compacto` (o mapa dentro do "Mais", 05/11/2026): o cartão do computador fica mais baixo (desenho menor, frase em até
 * duas linhas) e mostra as primeiras seções, com o resto num "Ver tudo"; com busca, tudo aberto.
 */
export function Predio({ predio, s, carimbo, aoAbrir, aberto, compacto }: { predio: PredioDoMapa; s: S; carimbo?: string; aoAbrir?: (path: string) => void; aberto?: boolean; compacto?: boolean }) {
  return (
    <li className="predio" data-predio={predio.id} data-visitado={carimbo ? "" : undefined}>
      <details className="campus-celular h-full border-[1.5px] border-ink bg-folha p-3" open={aberto}>
        <summary className="cursor-pointer" title={fill(s.abrir, { nome: predio.nome })}>
          <Cabeca predio={predio} s={s} carimbo={carimbo} />
          <span className="mt-1.5 block font-mono text-[0.68rem] uppercase tracking-[0.12em] text-ink-soft">{fill(s.secoes, { n: predio.itens.length })}</span>
        </summary>
        <Lista predio={predio} s={s} aoAbrir={aoAbrir} compacta />
      </details>
      <div className={`campus-computador flex-col border-2 border-ink bg-folha ${compacto ? "p-3" : "h-full p-4"}`}>
        <Cabeca predio={predio} s={s} carimbo={carimbo} compacta={compacto} />
        <Lista predio={predio} s={s} aoAbrir={aoAbrir} compacta={compacto} limite={compacto && !aberto ? NO_COMPACTO : undefined} />
      </div>
    </li>
  );
}
