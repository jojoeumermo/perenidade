// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "next/link";
import { ATIVIDADES, type AtividadeId } from "./atividades";
import { CabecalhoInfantil, Mascote } from "./comum";
import { Contas } from "./Contas";
import { Historias } from "./Historias";
import { Letras } from "./Letras";
import { ParaImprimir } from "./ParaImprimir";
import { Robo } from "./Robo";
import { SegurancaDigital } from "./SegurancaDigital";



const COMPONENTES: Record<AtividadeId, () => React.ReactElement> = {
  letras: Letras,
  historias: Historias,
  contas: Contas,
  robo: Robo,
  seguranca: SegurancaDigital,
  imprimir: ParaImprimir,
};

/** A moldura da área infantil: cores acolhedoras, letras grandes, alvos de toque grandes e o cabeçalho próprio. */
export function AreaInfantil({ lang, atividade }: { lang: string; atividade?: AtividadeId }) {
  const atual = atividade ? ATIVIDADES.find((a) => a.id === atividade) : null;
  const Componente = atividade ? COMPONENTES[atividade] : null;
  return (
    <div className="area-infantil min-h-screen bg-[#FFF8E7] text-[#221C17]" style={{ fontFamily: "'Andika', 'Lexend', 'Comic Neue', 'Trebuchet MS', system-ui, sans-serif" }}>
      <CabecalhoInfantil lang={lang} />
      <div className="mx-auto max-w-5xl px-4 pt-6 pb-16">
        {atual && Componente ? (
          <>
            <Link href={`/${lang}/criancas`} className="no-print inline-flex min-h-12 items-center rounded-full border-4 border-ink bg-white px-5 text-lg font-bold">← Todas as brincadeiras</Link>
            <h1 className="mt-5 flex items-center gap-3 text-4xl font-bold"><span aria-hidden>{atual.desenho}</span>{atual.nome}</h1>
            <p className="mt-1 text-lg">{atual.idade}</p>
            <div className="mt-6"><Componente /></div>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-5">
              <Mascote tamanho={120} />
              <div>
                <h1 className="text-5xl font-bold">Oi! Eu sou a Lua.</h1>
                <p className="mt-2 text-2xl">Vamos brincar e aprender? Escolha uma brincadeira:</p>
              </div>
            </div>
            <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {ATIVIDADES.map((a) => (
                <li key={a.id}>
                  <Link href={`/${lang}/criancas/${a.id}`} className="flex h-full min-h-44 flex-col rounded-3xl border-4 border-ink p-5 shadow-[6px_6px_0_#221C17] transition-transform hover:-translate-y-1 motion-reduce:transition-none" style={{ background: a.cor }}>
                    <span className="text-6xl" aria-hidden>{a.desenho}</span>
                    <span className="mt-2 text-2xl font-bold">{a.nome}</span>
                    <span className="mt-1 text-lg">{a.texto}</span>
                    <span className="mt-auto pt-2 text-sm font-bold">{a.idade}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-10 rounded-2xl bg-white p-4 text-lg">Aqui não tem conta, nem placar, nem anúncio. Nada do que você faz sai deste aparelho. 💛</p>
          </>
        )}
      </div>
    </div>
  );
}
