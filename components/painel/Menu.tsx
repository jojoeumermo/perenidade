// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { type ReactNode, useMemo, useState } from "react";
import { L } from "../I18n";
import { Avatar } from "./Avatar";
import { Icone } from "./icones";

export interface ItemDoMenu {
  id: string;
  nome: string;
  sobre: string;
  grupo: string;
  conta?: number;
}

/** As áreas do trilho, na ordem do trabalho: o que é de hoje, o que se produz, quem se atende, a equipe, o site, a segurança e você. */
const AREAS: { grupo: string; nome: string; desenho: string }[] = [
  { grupo: "", nome: "Hoje", desenho: "M4 11l8-7 8 7v9h-5.5v-6h-5v6H4z" },
  { grupo: "Produção", nome: "Produção", desenho: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" },
  { grupo: "Atendimento", nome: "Atendimento", desenho: "M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z" },
  { grupo: "Pessoas", nome: "Pessoas", desenho: "M9 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.7-3.5 3.3-5.5 6.5-5.5s5.8 2 6.5 5.5M16 4.5a3.2 3.2 0 0 1 0 6.3M18 14.5c2 .6 3.3 2.6 3.6 5.5" },
  { grupo: "Site", nome: "Site", desenho: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" },
  { grupo: "Segurança", nome: "Segurança", desenho: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" },
  { grupo: "Você", nome: "Você", desenho: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" },
];

const simples = (texto: string) => texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/**
 * O menu do painel em duas colunas, como uma mesa de redação: à esquerda o trilho escuro com as áreas (cada uma com o
 * número do que espera por você), à direita a lista da área escolhida, com a busca "Ir para…" e as seções fixadas no
 * alto. Recolhido, fica só o trilho. No celular, abre como uma folha inteira, com as áreas em abas no alto.
 */
export function MenuDoPainel({
  secoes,
  atual,
  ir,
  fixadas,
  compacto,
  alternarCompacto,
  aberto,
  eu,
  funcao,
  todasAsFuncoes,
  ambiente,
  ferramentas,
  rodape,
  departamento,
}: {
  secoes: ItemDoMenu[];
  atual: ItemDoMenu;
  ir: (id: string) => void;
  fixadas: string[];
  compacto: boolean;
  alternarCompacto: () => void;
  aberto: boolean;
  eu: { nome: string; avatar?: string | null };
  funcao: string;
  todasAsFuncoes: string[];
  ambiente: string;
  /** Os botões de foco e tela cheia. */
  ferramentas: ReactNode;
  /** Voltar ao site, tema, sair e idioma. */
  rodape: ReactNode;
  /** O departamento da pessoa e as seções dele: ficam no alto, de qualquer área. */
  departamento?: { nome: string; secoes: string[] } | null;
}) {
  // A área que está aberta na lista: começa na da seção atual; um clique no trilho troca.
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const area = escolhida ?? atual.grupo;
  const areas = AREAS.filter((a) => secoes.some((s) => s.grupo === a.grupo));
  const total = (grupo: string) => secoes.filter((s) => s.grupo === grupo).reduce((soma, s) => soma + (s.conta ?? 0), 0);
  const termo = simples(busca.trim());
  const achadas = useMemo(() => (termo ? secoes.filter((s) => simples(`${s.nome} ${s.grupo} ${s.sobre}`).includes(termo)) : []), [termo, secoes]);
  const daArea = secoes.filter((s) => s.grupo === area);
  const presas = fixadas.map((id) => secoes.find((s) => s.id === id)).filter((s): s is ItemDoMenu => Boolean(s));
  const nomeDaArea = AREAS.find((a) => a.grupo === area)?.nome ?? area;
  const doDepartamento = (departamento?.secoes ?? []).map((id) => secoes.find((s) => s.id === id)).filter((s): s is ItemDoMenu => Boolean(s));
  const [departamentoAberto, setDepartamentoAberto] = useState(true);

  const Linha = ({ s }: { s: ItemDoMenu }) => {
    const ativa = s.id === atual.id;
    return (
      <li>
        <button
          type="button"
          onClick={() => {
            setBusca("");
            setEscolhida(null);
            ir(s.id);
          }}
          aria-current={ativa ? "page" : undefined}
          className={`painel-item group flex w-full cursor-pointer items-center gap-2.5 px-2.5 py-2 text-left ${ativa ? "painel-item-ativo" : ""}`}
        >
          <Icone id={s.id} className="h-[17px] w-[17px] shrink-0" />
          <span className="min-w-0 flex-1 truncate">{s.nome}</span>
          {Boolean(s.conta) && <span className="painel-conta min-w-6 bg-[#c21f16] px-1.5 py-0.5 text-center font-mono text-[0.7rem] font-semibold leading-none text-white">{s.conta}</span>}
        </button>
      </li>
    );
  };

  return (
    <aside
      id="menu-do-painel"
      data-tour="menu"
      aria-label="Menu do painel"
      className={`painel-menu no-print lg:sticky lg:top-0 lg:flex lg:h-screen max-lg:min-h-[calc(100dvh-3.5rem-env(safe-area-inset-top,0px))] max-lg:flex-col ${aberto ? "flex" : "hidden"}`}
    >
      {/* O trilho: as áreas do painel. */}
      <nav aria-label="Áreas do painel" className="painel-trilho flex shrink-0 bg-[#1f1a14] text-[#cdbb91] max-lg:gap-1 max-lg:overflow-x-auto max-lg:border-b-[3px] max-lg:border-[#c21f16] max-lg:px-2 max-lg:py-2 lg:w-[4.5rem] lg:flex-col lg:items-center lg:gap-1.5 lg:border-r-[3px] lg:border-[#c21f16] lg:py-4">
        <L href="/" title="Instituto Lúcia · voltar ao site" className="mb-2 hidden shrink-0 lg:block">
          {/* A marca não muda nunca. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/marca-96.png" alt="Instituto Lúcia" width={44} height={44} className="h-11 w-11" />
        </L>
        {areas.map((a) => {
          const n = total(a.grupo);
          const ativa = a.grupo === area && !termo;
          return (
            <button
              key={a.grupo || "hoje"}
              type="button"
              onClick={() => {
                setBusca("");
                setEscolhida(a.grupo);
                if (compacto) alternarCompacto();
              }}
              aria-pressed={ativa}
              title={a.nome}
              className={`painel-area relative flex shrink-0 cursor-pointer items-center justify-center gap-2 max-lg:px-3 max-lg:py-2 lg:h-12 lg:w-12 ${ativa ? "bg-[#c21f16] text-white" : "hover:bg-[#2b241b] hover:text-white"}`}
            >
              <svg aria-hidden viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={a.desenho} />
              </svg>
              <span className="text-sm font-semibold lg:sr-only">{a.nome}</span>
              {n > 0 && (
                <span className="border-2 border-[#1f1a14] bg-[#c21f16] px-1 font-mono text-[0.62rem] font-extrabold leading-tight text-white lg:absolute lg:-top-1 lg:-right-1">
                  {n}
                  <span className="sr-only"> esperando</span>
                </span>
              )}
            </button>
          );
        })}
        <button type="button" onClick={() => ir("conta")} title="Minha conta" data-tour="conta" className="mt-auto hidden shrink-0 cursor-pointer lg:block">
          <Avatar nome={eu.nome} avatar={eu.avatar ?? undefined} className="h-10 w-10" texto="font-sans font-black italic" />
        </button>
      </nav>

      {/* A lista da área: a busca, as fixadas e as seções. */}
      <div className={`painel-lista flex min-h-0 flex-1 flex-col border-ink bg-parchment text-ink lg:w-[15.5rem] lg:border-r-2 ${compacto ? "lg:hidden" : ""}`}>
        <div className="px-3 pt-4 lg:pt-5">
          <p className="hidden font-mono text-[0.62rem] uppercase tracking-[0.22em] text-ink-soft lg:block">Painel · {ambiente}</p>
          <label data-tour="ir-para" className="mt-2 flex items-center gap-2 border-2 border-ink bg-folha px-2.5 focus-within:shadow-[3px_3px_0_var(--prelo)]">
            <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="M15.5 15.5 20 20" />
            </svg>
            <span className="sr-only">Ir para uma seção</span>
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && achadas[0]) {
                  setBusca("");
                  ir(achadas[0].id);
                }
                if (e.key === "Escape") setBusca("");
              }}
              placeholder="Ir para…"
              className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-ink-soft"
            />
            <kbd className="hidden font-mono text-[0.6rem] text-ink-soft lg:inline">Ctrl K</kbd>
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-4 pb-4 [scrollbar-width:thin]">
          {termo ? (
            <div>
              <p className="painel-grupo px-2.5 pb-1.5 font-mono text-[0.62rem] uppercase tracking-[0.22em] text-gold">Achadas</p>
              {achadas.length === 0 ? <p className="px-2.5 text-ink-soft">Nenhuma seção com esse nome.</p> : <ul>{achadas.map((s) => <Linha key={s.id} s={s} />)}</ul>}
            </div>
          ) : (
            <>
              {departamento && doDepartamento.length > 0 && (
                <div className="mb-5">
                  <button
                    type="button"
                    onClick={() => setDepartamentoAberto(!departamentoAberto)}
                    aria-expanded={departamentoAberto}
                    className="painel-grupo flex w-full cursor-pointer items-center justify-between px-2.5 pb-1.5 font-mono text-[0.62rem] uppercase tracking-[0.22em] text-gold"
                  >
                    <span>Meu departamento</span>
                    <span aria-hidden>{departamentoAberto ? "▾" : "▸"}</span>
                  </button>
                  <p className="truncate px-2.5 pb-1 text-xs font-bold text-ink">{departamento.nome}</p>
                  {departamentoAberto && (
                    <ul>
                      {doDepartamento.map((s) => (
                        <Linha key={s.id} s={s} />
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {presas.length > 0 && (
                <div className="mb-5">
                  <p className="painel-grupo px-2.5 pb-1.5 font-mono text-[0.62rem] uppercase tracking-[0.22em] text-gold">★ Fixadas</p>
                  <ul>
                    {presas.map((s) => (
                      <Linha key={s.id} s={s} />
                    ))}
                  </ul>
                </div>
              )}
              {/* Trocar de área no trilho remonta a lista, que entra deslizando de leve (painel-troca). */}
              <div key={nomeDaArea} className="painel-troca">
                <p className="painel-grupo px-2.5 pb-1.5 font-mono text-[0.62rem] uppercase tracking-[0.22em] text-gold">{nomeDaArea}</p>
                <ul>
                  {daArea.map((s) => (
                    <Linha key={s.id} s={s} />
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
        <div className="border-t-2 border-ink px-3 pt-3 pb-[calc(0.85rem+env(safe-area-inset-bottom,0px))]">
          <p className="flex items-center gap-2.5">
            <button type="button" onClick={() => ir("conta")} title="Minha conta" className="shrink-0 cursor-pointer lg:hidden">
              <Avatar nome={eu.nome} avatar={eu.avatar ?? undefined} className="h-9 w-9" texto="font-sans font-black italic" />
            </button>
            <span className="min-w-0">
              <span className="block truncate font-semibold">{eu.nome}</span>
              <span className="block truncate text-xs text-ink-soft" title={todasAsFuncoes.join(" · ") || undefined}>
                {funcao}
              </span>
            </span>
          </p>
          <p className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={alternarCompacto}
              aria-pressed={compacto}
              data-tour="recolher"
              title="Recolher o menu (fica só o trilho de ícones)"
              className="hidden cursor-pointer border-2 border-ink p-1.5 hover:bg-ink hover:text-parchment lg:block"
            >
              <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 6l-6 6 6 6M20 4v16" />
              </svg>
            </button>
            {ferramentas}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs">{rodape}</div>
        </div>
      </div>
    </aside>
  );
}
