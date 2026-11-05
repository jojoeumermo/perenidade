// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { type ReactNode, useId, useMemo, useState, useSyncExternalStore } from "react";
import { getItem, KEYS, setItem } from "@/lib/storage";
import { L } from "../I18n";
import { Avatar } from "./Avatar";
import { ESPACOS, type Espaco, espacoDe, type IdDoEspaco } from "./estrutura";
import { Icone } from "./icones";
import { experimentou } from "./Tutorial";

export interface ItemDoMenu {
  id: string;
  nome: string;
  sobre: string;
  grupo: string;
  conta?: number;
}

const simples = (texto: string) => texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

function lerGrupos(): Record<string, boolean> {
  try {
    const dado: unknown = JSON.parse(getItem(KEYS.painelGrupos) || "{}");
    return dado && typeof dado === "object" ? (dado as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function Desenho({ d, className = "h-[18px] w-[18px]" }: { d: string; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

/** Só no computador o menu recolhe para o trilho de ícones; no celular a folha é sempre inteira (mesmo que a pessoa tenha recolhido no computador). */
function useComputador() {
  return useSyncExternalStore(
    (avisar) => {
      const m = window.matchMedia("(min-width: 64rem)");
      m.addEventListener("change", avisar);
      return () => m.removeEventListener("change", avisar);
    },
    () => window.matchMedia("(min-width: 64rem)").matches,
    () => true,
  );
}

const SETA = "M9 6l6 6-6 6";
const BUSCA = "M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM15.5 15.5 20 20";
const RECOLHER = "M15 6l-6 6 6 6M20 4v16";
const EXPANDIR = "M9 6l6 6-6 6M4 4v16";
const MAIS = "M5 12h.01M12 12h.01M19 12h.01";

/** Uma seção na lista de um espaço. */
function Linha({ s, ativa, aoIr }: { s: ItemDoMenu; ativa: boolean; aoIr: (id: string) => void }) {
  return (
    <li>
      <button type="button" onClick={() => aoIr(s.id)} aria-current={ativa ? "page" : undefined} className="pn-menu-item">
        <Icone id={s.id} className="h-[16px] w-[16px]" />
        <span className="pn-menu-texto">{s.nome}</span>
        {Boolean(s.conta) && <span className="pn-selo">{s.conta}<span className="sr-only"> esperando</span></span>}
      </button>
    </li>
  );
}

/** Um espaço do menu: o cabeçalho (ícone, nome, o que espera, seta) abre e fecha a gaveta com as seções. */
function Gaveta({ nome, desenho, itens, aberto, aoAlternar, atual, aoIr, conta, nota, tour, recolhido }: { nome: string; desenho: string; itens: ItemDoMenu[]; aberto: boolean; aoAlternar: () => void; atual: string; aoIr: (id: string) => void; conta?: number; nota?: string; tour?: string; recolhido: boolean }) {
  const idLista = useId();
  const temAtual = itens.some((s) => s.id === atual);
  return (
    <li data-tour={tour}>
      <button type="button" onClick={aoAlternar} aria-expanded={aberto} aria-controls={idLista} data-atual={temAtual} title={recolhido ? nome : undefined} className="pn-menu-espaco">
        <Desenho d={desenho} />
        <span className="pn-menu-texto">{nome}</span>
        {Boolean(conta) && (
          <span className="pn-selo pn-menu-selo">
            {conta}
            <span className="sr-only"> esperando</span>
          </span>
        )}
        <Desenho d={SETA} className="pn-menu-seta h-4 w-4" />
      </button>
      <div id={idLista} className="pn-menu-gaveta" data-aberta={aberto} inert={!aberto || recolhido}>
        <ul>
          {nota && <li className="pn-ajuda" style={{ padding: "0.15rem 0.6rem 0.15rem 2.15rem" }}>{nota}</li>}
          {itens.map((s) => (
            <Linha key={s.id} s={s} ativa={s.id === atual} aoIr={aoIr} />
          ))}
        </ul>
      </div>
    </li>
  );
}

/**
 * O menu do painel: uma coluna só, com a linha fina das lutas no topo, a busca "Ir para…", o departamento da pessoa, as
 * seções fixadas e os 8 espaços (Mesa, Escrever e produzir, Revisar e publicar, Comunidade e atendimento, Equipe, Site e
 * operação, Segurança, Minha conta), cada um com o número do que espera por você. A largura desliza ao recolher (no
 * computador sobram os ícones dos espaços) e cada espaço abre como uma gaveta; o que estava aberto fica guardado no
 * aparelho. No celular, o menu é uma folha inteira e uma barra de baixo leva aos espaços principais.
 * O mapa seção → espaço está em estrutura.ts: seção nova sem entrada cai no espaço do grupo antigo, nunca fica de fora.
 */
export function MenuDoPainel({
  secoes,
  atual,
  ir,
  fixadas,
  compacto: compactoSalvo,
  alternarCompacto,
  aberto,
  alternarMenu,
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
  /** Abre e fecha a folha do menu no celular (o botão "Mais" da barra de baixo). */
  alternarMenu?: () => void;
  eu: { nome: string; avatar?: string | null };
  funcao: string;
  todasAsFuncoes: string[];
  ambiente: string;
  /** Os botões de foco, modo leve e tela cheia. */
  ferramentas: ReactNode;
  /** Voltar ao site, tema, sair e idioma. */
  rodape: ReactNode;
  /** O departamento da pessoa e as seções dele: ficam no alto, de qualquer espaço. */
  departamento?: { nome: string; secoes: string[] } | null;
}) {
  const computador = useComputador();
  const compacto = compactoSalvo && computador;
  const [busca, setBusca] = useState("");
  const [grupos, setGrupos] = useState<Record<string, boolean>>(lerGrupos);
  const espacoDa = (s: ItemDoMenu) => espacoDe(s.id, s.grupo);
  const doEspaco = (id: IdDoEspaco) => secoes.filter((s) => espacoDa(s) === id);
  const espacos = ESPACOS.filter((e) => doEspaco(e.id).length > 0);
  const total = (itens: ItemDoMenu[]) => itens.reduce((soma, s) => soma + (s.conta ?? 0), 0);
  const termo = simples(busca.trim());
  const achadas = useMemo(() => (termo ? secoes.filter((s) => simples(`${s.nome} ${s.grupo} ${s.sobre}`).includes(termo)) : []), [termo, secoes]);
  const presas = fixadas.map((id) => secoes.find((s) => s.id === id)).filter((s): s is ItemDoMenu => Boolean(s));
  const doDepartamento = (departamento?.secoes ?? []).map((id) => secoes.find((s) => s.id === id)).filter((s): s is ItemDoMenu => Boolean(s));
  const espacoAtual = espacoDa(atual);
  // Um espaço fica aberto se a pessoa abriu, ou, enquanto ela não mexeu nele, se a seção de agora é dele (a menos que a
  // seção já esteja no departamento ou nas fixadas, no alto: seria a mesma linha duas vezes).
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
  const abrirEspaco = (e: Espaco) => {
    guardar({ ...grupos, [`espaco:${e.id}`]: true });
  };
  // Barra de baixo (celular): a Mesa e os espaços de trabalho que a pessoa enxerga, mais o "Mais".
  const fixos = espacos.filter((e) => ["mesa", "producao", "revisao", "comunidade"].includes(e.id)).slice(0, 4);
  const noEspaco = (e: Espaco) => {
    const itens = doEspaco(e.id);
    if (itens.length === 1) {
      irPara(itens[0].id);
      return;
    }
    abrirEspaco(e);
    if (!aberto) alternarMenu?.();
  };

  return (
    <>
      <aside id="menu-do-painel" aria-label="Menu do painel" data-recolhido={compacto} className={`pn-menu painel-menu no-print ${aberto ? "flex" : "hidden lg:flex"} max-lg:min-h-[calc(100dvh-3.5rem-env(safe-area-inset-top,0px))]`}>
        <div className="pn-menu-lutas" aria-hidden />
        {/* O alto: a marca, onde se está e a busca. */}
        <div className="pn-menu-topo">
          <div className="pn-menu-marca pn-so-computador">
            <L href="/" title="Instituto Lúcia · voltar ao site" className="shrink-0">
              {/* A marca não muda nunca. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/marca-96.png" alt="Instituto Lúcia" width={36} height={36} className="h-9 w-9" />
            </L>
            <span className="min-w-0">
              <span className="pn-menu-nome truncate">Instituto Lúcia</span>
              <span className="pn-menu-ambiente">Painel · {ambiente}</span>
            </span>
          </div>
          <label data-tour="ir-para" className="pn-menu-busca">
            <Desenho d={BUSCA} className="h-4 w-4 shrink-0" />
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
            />
            <kbd className="hidden text-[0.65rem] lg:inline">Ctrl K</kbd>
          </label>
        </div>

        {/* Todos os espaços, um embaixo do outro; cada um abre e fecha. */}
        <nav aria-label="Espaços do painel" data-tour="areas" className="pn-menu-nav">
          {termo ? (
            <div>
              <p className="pn-rotulo" style={{ padding: "0.25rem 0.6rem" }}>Achadas</p>
              {achadas.length === 0 ? (
                <p className="pn-ajuda" style={{ padding: "0 0.6rem" }}>Nenhuma seção com esse nome.</p>
              ) : (
                <ul className="pn-menu-lista">
                  {achadas.map((s) => (
                    <Linha key={s.id} s={s} ativa={s.id === atual.id} aoIr={irPara} />
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <ul className="pn-menu-lista">
              {departamento && doDepartamento.length > 0 && (
                <Gaveta
                  nome="Meu departamento"
                  tour="departamento"
                  nota={departamento.nome}
                  desenho="M3 21h18M5 21V8l7-4 7 4v13M9 21v-6h6v6"
                  itens={doDepartamento}
                  aberto={estaAberto("departamento", true)}
                  aoAlternar={() => guardar({ ...grupos, departamento: !estaAberto("departamento", true) })}
                  atual={atual.id}
                  aoIr={irPara}
                  conta={total(doDepartamento)}
                  recolhido={compacto}
                />
              )}
              {presas.length > 0 && (
                <Gaveta
                  nome="Fixadas"
                  desenho="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7z"
                  itens={presas}
                  aberto={estaAberto("fixadas", true)}
                  aoAlternar={() => guardar({ ...grupos, fixadas: !estaAberto("fixadas", true) })}
                  atual={atual.id}
                  aoIr={irPara}
                  recolhido={compacto}
                />
              )}
              {espacos.map((e) => {
                const chave = `espaco:${e.id}`;
                const itens = doEspaco(e.id);
                const padrao = e.id === "mesa" || (e.id === espacoAtual && !jaNoAlto);
                return (
                  <Gaveta
                    key={chave}
                    nome={e.nome}
                    desenho={e.desenho}
                    itens={itens}
                    aberto={estaAberto(chave, padrao)}
                    // No trilho recolhido, um clique no ícone abre o menu já com aquele espaço aberto.
                    aoAlternar={() => {
                      if (compacto) {
                        abrirEspaco(e);
                        alternarCompacto();
                      } else guardar({ ...grupos, [chave]: !estaAberto(chave, padrao) });
                    }}
                    atual={atual.id}
                    aoIr={irPara}
                    conta={total(itens)}
                    recolhido={compacto}
                  />
                );
              })}
            </ul>
          )}
        </nav>

        {/* O pé: quem está aqui, recolher o menu, as ferramentas e o resto. */}
        <div className="pn-menu-pe pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
          <div className="pn-menu-pessoa">
            <button type="button" onClick={() => ir("conta")} title="Minha conta" data-tour="conta" className="shrink-0 cursor-pointer">
              <Avatar nome={eu.nome} avatar={eu.avatar ?? undefined} className="h-9 w-9" texto="font-sans font-black italic" />
            </button>
            <span className="pn-menu-pessoa-texto min-w-0">
              <span className="block truncate font-semibold">{eu.nome}</span>
              <span className="pn-ajuda block truncate" title={todasAsFuncoes.join(" · ") || undefined}>
                {funcao}
              </span>
            </span>
          </div>
          <div className="pn-menu-ferramentas">
            <button type="button" onClick={alternarCompacto} aria-pressed={compacto} data-tour="recolher" title={compacto ? "Abrir o menu" : "Recolher o menu (ficam só os ícones)"} className="pn-botao pn-botao-discreto pn-botao-icone pn-botao-pequeno pn-so-computador">
              <Desenho d={compacto ? EXPANDIR : RECOLHER} className="h-4 w-4" />
              <span className="sr-only">{compacto ? "Abrir o menu" : "Recolher o menu"}</span>
            </button>
            {ferramentas}
          </div>
          <div className="pn-menu-links">{rodape}</div>
        </div>
      </aside>

      {/* Barra de baixo, só no celular: a Mesa, os espaços de trabalho e o "Mais" (a folha com tudo). */}
      <nav aria-label="Atalhos do painel" className="pn-barra-baixo no-print">
        {fixos.map((e) => {
          const n = total(doEspaco(e.id));
          return (
            <button key={e.id} type="button" onClick={() => (e.id === "mesa" ? irPara("mesa") : noEspaco(e))} aria-current={espacoAtual === e.id && !aberto ? "true" : undefined} className="pn-barra-baixo-item">
              <Desenho d={e.desenho} className="h-5 w-5" />
              <span>{e.id === "producao" ? "Escrever" : e.id === "revisao" ? "Revisar" : e.id === "comunidade" ? "Atender" : e.nome}</span>
              {n > 0 && (
                <span className="pn-selo">
                  {n}
                  <span className="sr-only"> esperando</span>
                </span>
              )}
            </button>
          );
        })}
        <button type="button" onClick={() => alternarMenu?.()} aria-expanded={aberto} aria-controls="menu-do-painel" className="pn-barra-baixo-item" aria-current={aberto ? "true" : undefined}>
          <Desenho d={MAIS} className="h-5 w-5" />
          <span>Mais</span>
        </button>
      </nav>
    </>
  );
}
