// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { type ReactNode, useMemo, useState } from "react";
import { getItem, KEYS, setItem } from "@/lib/storage";
import { L } from "../I18n";
import { Avatar } from "./Avatar";
import { Icone } from "./icones";
import { experimentou } from "./Tutorial";

export interface ItemDoMenu {
  id: string;
  nome: string;
  sobre: string;
  grupo: string;
  conta?: number;
}

/** As áreas do painel, na ordem do trabalho: o que é de hoje, o que se produz, quem se atende, a equipe, o site, a segurança e você. */
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

function lerGrupos(): Record<string, boolean> {
  try {
    const dado: unknown = JSON.parse(getItem(KEYS.painelGrupos) || "{}");
    return dado && typeof dado === "object" ? (dado as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function Desenho({ d, className = "h-[20px] w-[20px]" }: { d: string; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

/** Uma seção do menu. */
function Linha({ s, ativa, aoIr }: { s: ItemDoMenu; ativa: boolean; aoIr: (id: string) => void }) {
  return (
    <li>
      <button type="button" onClick={() => aoIr(s.id)} aria-current={ativa ? "page" : undefined} className={`painel-item group flex w-full cursor-pointer items-center gap-2.5 py-2 pr-2.5 pl-9 text-left ${ativa ? "painel-item-ativo" : ""}`}>
        <Icone id={s.id} className="h-[16px] w-[16px] shrink-0" />
        <span className="min-w-0 flex-1 truncate">{s.nome}</span>
        {Boolean(s.conta) && <span className="painel-conta min-w-6 bg-[#c21f16] px-1.5 py-0.5 text-center font-mono text-[0.7rem] font-semibold leading-none text-white">{s.conta}</span>}
      </button>
    </li>
  );
}

/** Um grupo do menu: o cabeçalho (ícone, nome, o que espera e a seta) abre e fecha a lista das seções. */
function Grupo({ nome, desenho, itens, aberto, aoAlternar, atual, aoIr, conta, nota, tour }: { nome: string; desenho: string; itens: ItemDoMenu[]; aberto: boolean; aoAlternar: () => void; atual: string; aoIr: (id: string) => void; conta?: number; nota?: string; tour?: string }) {
  const temAtual = itens.some((s) => s.id === atual);
  return (
    <li data-tour={tour}>
      <button type="button" onClick={aoAlternar} aria-expanded={aberto} className={`painel-cabeca flex w-full cursor-pointer items-center gap-2.5 px-2.5 py-2 text-left ${temAtual && !aberto ? "painel-cabeca-atual" : ""}`}>
        <Desenho d={desenho} className="h-[19px] w-[19px] shrink-0" />
        <span className="min-w-0 flex-1 truncate font-semibold">{nome}</span>
        {Boolean(conta) && (
          <span className="min-w-6 bg-[#c21f16] px-1.5 py-0.5 text-center font-mono text-[0.68rem] font-bold leading-none text-white">
            {conta}
            <span className="sr-only"> esperando</span>
          </span>
        )}
        <svg aria-hidden viewBox="0 0 24 24" className={`painel-seta h-4 w-4 shrink-0 ${aberto ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>
      {aberto && (
        <div className="painel-troca">
          {nota && <p className="truncate py-0.5 pr-2.5 pl-9 text-xs font-bold text-ink-soft">{nota}</p>}
          <ul className="pb-1.5">
            {itens.map((s) => (
              <Linha key={s.id} s={s} ativa={s.id === atual} aoIr={aoIr} />
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

/**
 * O menu do painel numa coluna só, como o sumário de um caderno: no alto a marca e a busca "Ir para…"; embaixo, todas as
 * áreas (Hoje, Produção, Atendimento, Pessoas, Site, Segurança, Você) como grupos que abrem e fecham, cada um com o
 * número do que espera por você, e antes delas o departamento e as seções fixadas. Nada muda de lugar quando se troca de
 * área: o que estava aberto continua aberto (e fica guardado no aparelho). Recolhido, no computador, vira o trilho de
 * ícones das áreas. No celular, abre como uma folha inteira.
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
  const [busca, setBusca] = useState("");
  const [grupos, setGrupos] = useState<Record<string, boolean>>(lerGrupos);
  const areas = AREAS.filter((a) => secoes.some((s) => s.grupo === a.grupo));
  const total = (grupo: string) => secoes.filter((s) => s.grupo === grupo).reduce((soma, s) => soma + (s.conta ?? 0), 0);
  const termo = simples(busca.trim());
  const achadas = useMemo(() => (termo ? secoes.filter((s) => simples(`${s.nome} ${s.grupo} ${s.sobre}`).includes(termo)) : []), [termo, secoes]);
  const presas = fixadas.map((id) => secoes.find((s) => s.id === id)).filter((s): s is ItemDoMenu => Boolean(s));
  const doDepartamento = (departamento?.secoes ?? []).map((id) => secoes.find((s) => s.id === id)).filter((s): s is ItemDoMenu => Boolean(s));
  // Um grupo fica aberto se a pessoa abriu, ou, enquanto ela não mexeu nele, se a seção de agora é dele. Se a seção de
  // agora já está no departamento ou nas fixadas, a área dela não abre sozinha: seria a mesma linha duas vezes.
  const estaAberto = (chave: string, padrao: boolean) => grupos[chave] ?? padrao;
  const jaNoAlto = [...doDepartamento, ...presas].some((s) => s.id === atual.id);
  const guardar = (novo: Record<string, boolean>) => {
    setGrupos(novo);
    setItem(KEYS.painelGrupos, JSON.stringify(novo));
    experimentou("areas");
  };
  const irPara = (id: string) => {
    setBusca("");
    ir(id);
  };

  return (
    <>
      {/* Recolhido (só no computador): o trilho dos ícones das áreas. Um clique abre o menu já com aquela área aberta. */}
      {compacto && (
        <aside id="trilho-do-painel" aria-label="Menu do painel" className="painel-menu no-print hidden lg:sticky lg:top-0 lg:flex lg:h-screen">
          <nav aria-label="Áreas do painel" data-tour="areas" className="painel-trilho flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5 border-r-[3px] border-[#c21f16] bg-[#1f1a14] py-4 text-[#cdbb91]">
            <L href="/" title="Instituto Lúcia · voltar ao site" className="mb-2 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/marca-96.png" alt="Instituto Lúcia" width={44} height={44} className="h-11 w-11" />
            </L>
            {areas.map((a) => {
              const n = total(a.grupo);
              return (
                <button
                  key={a.grupo || "hoje"}
                  type="button"
                  onClick={() => {
                    guardar({ ...grupos, [`area:${a.grupo}`]: true });
                    alternarCompacto();
                  }}
                  title={a.nome}
                  className={`painel-area relative flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center ${a.grupo === atual.grupo ? "bg-[#c21f16] text-white" : "hover:bg-[#2b241b] hover:text-white"}`}
                >
                  <Desenho d={a.desenho} className="h-[22px] w-[22px]" />
                  <span className="sr-only">{a.nome}</span>
                  {n > 0 && (
                    <span className="absolute -top-1 -right-1 border-2 border-[#1f1a14] bg-[#c21f16] px-1 font-mono text-[0.62rem] font-extrabold leading-tight text-white">
                      {n}
                      <span className="sr-only"> esperando</span>
                    </span>
                  )}
                </button>
              );
            })}
            <button type="button" onClick={alternarCompacto} data-tour="recolher" title="Abrir o menu" className="mt-auto flex h-10 w-10 cursor-pointer items-center justify-center hover:bg-[#2b241b] hover:text-white">
              <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6M4 4v16" />
              </svg>
            </button>
            <button type="button" onClick={() => ir("conta")} title="Minha conta" data-tour="conta" className="shrink-0 cursor-pointer">
              <Avatar nome={eu.nome} avatar={eu.avatar ?? undefined} className="h-10 w-10" texto="font-sans font-black italic" />
            </button>
          </nav>
        </aside>
      )}

      <aside
        id="menu-do-painel"
        aria-label="Menu do painel"
        className={`painel-menu no-print flex-col border-ink bg-parchment text-ink lg:sticky lg:top-0 lg:h-screen lg:border-r-2 max-lg:min-h-[calc(100dvh-3.5rem-env(safe-area-inset-top,0px))] ${aberto ? "flex" : "hidden"} ${compacto ? "lg:hidden" : "lg:flex"}`}
      >
        {/* O alto: a marca, onde se está e a busca. */}
        <div className="border-b-[3px] border-[#c21f16] bg-[#1f1a14] px-3 pt-4 pb-3 text-[#f4ecd8]">
          <div className="hidden items-center gap-2.5 lg:flex">
            <L href="/" title="Instituto Lúcia · voltar ao site" className="shrink-0">
              {/* A marca não muda nunca. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/marca-96.png" alt="Instituto Lúcia" width={36} height={36} className="h-9 w-9" />
            </L>
            <span className="min-w-0">
              <span className="block truncate font-serif text-[1.05rem] font-semibold leading-tight">Instituto Lúcia</span>
              <span className="block font-mono text-[0.6rem] uppercase tracking-[0.22em] text-[#cdbb91]">Painel · {ambiente}</span>
            </span>
          </div>
          <label data-tour="ir-para" className="flex items-center gap-2 border-2 border-[#f4ecd8] bg-[#f4ecd8] px-2.5 text-[#1f1a14] focus-within:shadow-[3px_3px_0_#c21f16] lg:mt-3.5">
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
                if (e.key === "Enter" && achadas[0]) irPara(achadas[0].id);
                if (e.key === "Escape") setBusca("");
              }}
              placeholder="Ir para…"
              className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-[#5a4e3c]"
            />
            <kbd className="hidden font-mono text-[0.6rem] text-[#5a4e3c] lg:inline">Ctrl K</kbd>
          </label>
        </div>

        {/* Todas as áreas, uma embaixo da outra; cada uma abre e fecha. */}
        <nav aria-label="Áreas do painel" data-tour="areas" className="min-h-0 flex-1 overflow-y-auto px-2 pt-3 pb-4 [scrollbar-width:thin]">
          {termo ? (
            <div>
              <p className="painel-grupo px-2.5 pb-1.5 font-mono text-[0.62rem] uppercase tracking-[0.22em] text-gold">Achadas</p>
              {achadas.length === 0 ? (
                <p className="px-2.5 text-ink-soft">Nenhuma seção com esse nome.</p>
              ) : (
                <ul>
                  {achadas.map((s) => (
                    <Linha key={s.id} s={s} ativa={s.id === atual.id} aoIr={irPara} />
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <ul className="grid gap-0.5">
              {departamento && doDepartamento.length > 0 && (
                <Grupo
                  nome="Meu departamento"
                  tour="departamento"
                  nota={departamento.nome}
                  desenho="M3 21h18M5 21V8l7-4 7 4v13M9 21v-6h6v6"
                  itens={doDepartamento}
                  aberto={estaAberto("departamento", true)}
                  aoAlternar={() => guardar({ ...grupos, departamento: !estaAberto("departamento", true) })}
                  atual={atual.id}
                  aoIr={irPara}
                  conta={doDepartamento.reduce((soma, s) => soma + (s.conta ?? 0), 0)}
                />
              )}
              {presas.length > 0 && (
                <Grupo
                  nome="Fixadas"
                  desenho="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7z"
                  itens={presas}
                  aberto={estaAberto("fixadas", true)}
                  aoAlternar={() => guardar({ ...grupos, fixadas: !estaAberto("fixadas", true) })}
                  atual={atual.id}
                  aoIr={irPara}
                />
              )}
              {areas.map((a) => {
                const chave = `area:${a.grupo}`;
                const padrao = a.grupo === "" || (a.grupo === atual.grupo && !jaNoAlto);
                return (
                  <Grupo
                    key={chave}
                    nome={a.nome}
                    desenho={a.desenho}
                    itens={secoes.filter((s) => s.grupo === a.grupo)}
                    aberto={estaAberto(chave, padrao)}
                    aoAlternar={() => guardar({ ...grupos, [chave]: !estaAberto(chave, padrao) })}
                    atual={atual.id}
                    aoIr={irPara}
                    conta={total(a.grupo)}
                  />
                );
              })}
            </ul>
          )}
        </nav>

        {/* O pé: quem está aqui, recolher o menu, as ferramentas e o resto. */}
        <div className="border-t-2 border-ink px-3 pt-3 pb-[calc(0.85rem+env(safe-area-inset-bottom,0px))]">
          <p className="flex items-center gap-2.5">
            <button type="button" onClick={() => ir("conta")} title="Minha conta" data-tour="conta" className="shrink-0 cursor-pointer">
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
            <button type="button" onClick={alternarCompacto} aria-pressed={compacto} data-tour="recolher" title="Recolher o menu (fica só o trilho de ícones)" className="hidden cursor-pointer border-2 border-ink p-1.5 hover:bg-ink hover:text-parchment lg:block">
              <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 6l-6 6 6 6M20 4v16" />
              </svg>
            </button>
            {ferramentas}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs">{rodape}</div>
        </div>
      </aside>
    </>
  );
}
