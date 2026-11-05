// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ChevronRight, Ellipsis, Feather, Focus, LogOut, Maximize2, Minimize2, Monitor, Moon, PanelLeftClose, PanelLeftOpen, Search, Star, Sun, UserRound, X, Globe } from "lucide-react";
import { AnimatePresence, LayoutGroup } from "motion/react";
import * as m from "motion/react-m";
import { type ButtonHTMLAttributes, forwardRef, type ReactNode, useId, useMemo, useRef, useState } from "react";
import { L } from "../I18n";
import { Avatar } from "./Avatar";
import { usePainel } from "./estado";
import { ESPACOS, type Espaco, espacoDe, type IdDoEspaco } from "./estrutura";
import { Icone, iconeDoEspaco } from "./icones";
import { experimentou } from "./Tutorial";
import { Contador, Dica, Kbd, MenuSuspenso, mola } from "./ui";

export interface ItemDoMenu {
  id: string;
  nome: string;
  sobre: string;
  grupo: string;
  conta?: number;
}

export type Tema = "light" | "dark" | "sistema";

/** O que o menu precisa saber da casca e o que ele pode pedir a ela. */
export interface PropsDoMenu {
  secoes: ItemDoMenu[];
  atual: ItemDoMenu;
  ir: (id: string) => void;
  /** O departamento da pessoa e as seções dele: ficam no alto, de qualquer espaço. */
  departamento?: { nome: string; secoes: string[] } | null;
  eu: { nome: string; avatar?: string | null };
  funcao: string;
  todasAsFuncoes: string[];
  ambiente: string;
  tema: Tema;
  mudarTema: (tema: Tema) => void;
  telaCheia: boolean;
  alternarTelaCheia: () => void;
  voltarAoSite: () => void;
  sair: () => void;
  /** O seletor de idioma do painel (fica no pé do menu). */
  idioma?: ReactNode;
}

const simples = (texto: string) => texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const LARGURA = { aberto: 248, recolhido: 60 };

/** Soma do que espera numa lista de seções. */
const somar = (itens: ItemDoMenu[]) => itens.reduce((soma, s) => soma + (s.conta ?? 0), 0);

/** Uma seção: o link (ícone, nome, contador) e, separado dele, o botão de fixar (aparece ao passar o mouse ou com o foco). */
function Linha({ s, ativa, comFundo, aoIr }: { s: ItemDoMenu; ativa: boolean; comFundo: boolean; aoIr: (id: string) => void }) {
  const fixada = usePainel((e) => e.favoritos.includes(s.id));
  const fixar = usePainel((e) => e.fixar);
  return (
    <li className="pn-menu-linha">
      <button type="button" onClick={() => aoIr(s.id)} aria-current={ativa ? "page" : undefined} className="pn-menu-item">
        {ativa && comFundo && <m.span aria-hidden layoutId="pn-menu-ativo" className="pn-menu-ativo-fundo" transition={mola.menu} />}
        <Icone id={s.id} />
        <span className="pn-menu-texto">{s.nome}</span>
        <Contador n={s.conta} />
      </button>
      {s.id !== "mesa" && (
        <button type="button" className="pn-menu-fixar" aria-pressed={fixada} aria-label={`Fixar ${s.nome}`} title={fixada ? "Soltar do alto do menu" : "Fixar no alto do menu"} onClick={() => fixar(s.id)}>
          <Star aria-hidden width={14} height={14} fill={fixada ? "currentColor" : "none"} />
        </button>
      )}
    </li>
  );
}

/** Um grupo do menu: o cabeçalho em mono (nome, soma do que espera, seta) abre e fecha a lista, com altura animada. */
function Grupo({ chave, nome, padrao, itens, atual, donoDoAtivo, aoIr, nota, tour, simbolo }: { chave: string; nome: string; padrao: boolean; itens: ItemDoMenu[]; atual: string; donoDoAtivo: boolean; aoIr: (id: string) => void; nota?: string; tour?: string; simbolo?: ReactNode }) {
  const aberto = usePainel((s) => s.gruposAbertos[chave] ?? padrao);
  const alternar = usePainel((s) => s.alternarGrupo);
  const idLista = useId();
  const temAtual = itens.some((s) => s.id === atual);
  const soma = somar(itens);
  return (
    <li data-tour={tour}>
      <button
        type="button"
        className="pn-menu-grupo-cabeca"
        aria-expanded={aberto}
        aria-controls={idLista}
        data-atual={temAtual}
        onClick={() => {
          alternar(chave, padrao);
          experimentou("areas");
        }}
      >
        {simbolo}
        <span className="pn-menu-grupo-nome">{nome}</span>
        {soma > 0 && !aberto && (
          <span className="pn-menu-grupo-soma">
            {soma}
            <span className="sr-only"> esperando</span>
          </span>
        )}
        <m.span aria-hidden style={{ display: "inline-flex" }} animate={{ rotate: aberto ? 90 : 0 }} transition={mola.rapida} initial={false}>
          <ChevronRight className="pn-menu-seta" />
        </m.span>
      </button>
      <AnimatePresence initial={false}>
        {aberto && (
          <m.div key="lista" id={idLista} className="pn-menu-gaveta" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18, ease: [0.2, 0.7, 0.2, 1] }}>
            {nota && <p className="pn-menu-nota">{nota}</p>}
            <ul className="pn-menu-lista">
              {itens.map((s) => (
                <Linha key={s.id} s={s} ativa={s.id === atual} comFundo={donoDoAtivo} aoIr={aoIr} />
              ))}
            </ul>
          </m.div>
        )}
      </AnimatePresence>
    </li>
  );
}

/** O botão de um ícone do trilho (menu recolhido). Encaminha a ref: a dica e o menu suspenso se ancoram nele. */
const BotaoDoTrilho = forwardRef<HTMLButtonElement, { rotulo: string; conta?: number; atual?: boolean; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>>(function BotaoDoTrilho({ rotulo, conta, atual, children, ...resto }, ref) {
  return (
    <button ref={ref} type="button" className="pn-menu-trilho-botao" data-atual={atual || undefined} aria-current={atual ? "page" : undefined} aria-label={conta ? `${rotulo}, ${conta} esperando` : rotulo} {...resto}>
      {children}
      {Boolean(conta) && <span aria-hidden className="pn-menu-ponto" />}
    </button>
  );
});

/** O conteúdo do menu, igual no computador (fixo, que recolhe) e no celular (a folha). */
function ConteudoDoMenu({ props, recolhido, folha, fechar }: { props: PropsDoMenu; recolhido: boolean; folha: boolean; fechar?: () => void }) {
  const { secoes, atual, ir, departamento, eu, funcao, todasAsFuncoes, ambiente, tema, mudarTema, telaCheia, alternarTelaCheia, voltarAoSite, sair, idioma } = props;
  const [filtro, setFiltro] = useState("");
  const favoritos = usePainel((s) => s.favoritos);
  const alternarMenu = usePainel((s) => s.alternarMenu);
  const modoFoco = usePainel((s) => s.modoFoco);
  const modoLeve = usePainel((s) => s.modoLeve);
  const alternarFoco = usePainel((s) => s.alternarFoco);
  const alternarLeve = usePainel((s) => s.alternarLeve);
  const espacoDa = (s: ItemDoMenu) => espacoDe(s.id, s.grupo);
  const doEspaco = (id: IdDoEspaco) => secoes.filter((s) => espacoDa(s) === id);
  const espacos = ESPACOS.filter((e) => doEspaco(e.id).length > 0);
  const termo = simples(filtro.trim());
  const achadas = useMemo(() => (termo ? secoes.filter((s) => simples(`${s.nome} ${s.grupo} ${s.sobre}`).includes(termo)) : []), [termo, secoes]);
  const presas = favoritos.map((id) => secoes.find((s) => s.id === id)).filter((s): s is ItemDoMenu => Boolean(s));
  const doDepartamento = (departamento?.secoes ?? []).map((id) => secoes.find((s) => s.id === id)).filter((s): s is ItemDoMenu => Boolean(s));
  const espacoAtual = espacoDa(atual);
  // O fundo do ativo desliza com layoutId: só uma linha pode tê-lo (o departamento, depois as fixadas, depois o espaço).
  const noDepartamento = doDepartamento.some((s) => s.id === atual.id);
  const nasFixadas = !noDepartamento && presas.some((s) => s.id === atual.id);
  const jaNoAlto = noDepartamento || nasFixadas;
  const aoIr = (id: string) => {
    setFiltro("");
    ir(id);
    fechar?.();
  };

  const marca = (
    <L href="/" className="pn-menu-marca" title="Instituto Lúcia · voltar ao site">
      {/* A marca não muda nunca. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/marca-96.png" alt={recolhido ? "Instituto Lúcia" : ""} width={28} height={28} />
      {!recolhido && (
        <span style={{ minWidth: 0 }}>
          <span className="pn-menu-nome">Instituto Lúcia</span>
          <span className="pn-menu-ambiente">{ambiente}</span>
        </span>
      )}
    </L>
  );

  const pessoa = (
    <MenuSuspenso
      lado={recolhido ? "right" : "top"}
      alinhamento={recolhido ? "end" : "start"}
      rotulo="Sua conta"
      gatilho={
        <button type="button" className="pn-menu-pessoa" data-tour="conta" aria-label={recolhido ? `${eu.nome}: conta, tema e sair` : undefined}>
          <Avatar nome={eu.nome} avatar={eu.avatar ?? undefined} className="h-8 w-8 shrink-0" texto="font-sans font-black italic" />
          {!recolhido && (
            <span className="pn-menu-pessoa-texto">
              <span style={{ fontWeight: 600 }}>{eu.nome}</span>
              <span title={todasAsFuncoes.join(" · ") || undefined}>{funcao}</span>
            </span>
          )}
          {!recolhido && <Ellipsis aria-hidden width={16} height={16} style={{ flex: "none", opacity: 0.7 }} />}
        </button>
      }
    >
      <MenuSuspenso.Item rotulo="Minha conta" simbolo={UserRound} fazer={() => aoIr("conta")} />
      <MenuSuspenso.Separador />
      <MenuSuspenso.Rotulo>Tema</MenuSuspenso.Rotulo>
      <MenuSuspenso.Item rotulo="Claro" simbolo={Sun} marcado={tema === "light"} fazer={() => mudarTema("light")} />
      <MenuSuspenso.Item rotulo="Escuro" simbolo={Moon} marcado={tema === "dark"} fazer={() => mudarTema("dark")} />
      <MenuSuspenso.Item rotulo="Do sistema" simbolo={Monitor} marcado={tema === "sistema"} fazer={() => mudarTema("sistema")} />
      <MenuSuspenso.Separador />
      <MenuSuspenso.Item rotulo="Voltar ao site" simbolo={Globe} fazer={voltarAoSite} />
      <MenuSuspenso.Item rotulo="Sair" simbolo={LogOut} perigo fazer={sair} />
    </MenuSuspenso>
  );

  const ferramentas = (
    <div className="pn-menu-ferramentas">
      <Dica texto={modoFoco ? "Sair do modo foco: mostrar todas as seções" : "Modo foco: só o essencial no menu"} lado={recolhido ? "right" : "top"}>
        <button type="button" className="pn-menu-icone-botao" aria-pressed={modoFoco} aria-label="Modo foco" onClick={alternarFoco}>
          <Focus aria-hidden width={16} height={16} />
        </button>
      </Dica>
      <Dica texto={modoLeve ? "Sair do modo leve" : "Modo leve: sem animações, sombras e texturas"} lado={recolhido ? "right" : "top"}>
        <button type="button" className="pn-menu-icone-botao" aria-pressed={modoLeve} aria-label="Modo leve" onClick={alternarLeve}>
          <Feather aria-hidden width={16} height={16} />
        </button>
      </Dica>
      <Dica texto={telaCheia ? "Sair da tela cheia" : "Tela cheia"} lado={recolhido ? "right" : "top"}>
        <button type="button" className="pn-menu-icone-botao" aria-pressed={telaCheia} aria-label="Tela cheia" onClick={alternarTelaCheia}>
          {telaCheia ? <Minimize2 aria-hidden width={16} height={16} /> : <Maximize2 aria-hidden width={16} height={16} />}
        </button>
      </Dica>
      {!recolhido && idioma}
    </div>
  );

  if (recolhido) {
    return (
      <>
        <div className="pn-menu-lutas" aria-hidden />
        <div className="pn-menu-topo">
          {marca}
          <Dica texto="Abrir o menu" atalho="[" lado="right">
            <button type="button" className="pn-menu-icone-botao" data-tour="recolher" aria-pressed aria-label="Abrir o menu" onClick={() => alternarMenu(false)}>
              <PanelLeftOpen aria-hidden width={18} height={18} />
            </button>
          </Dica>
        </div>
        <nav aria-label="Espaços do painel" data-tour="areas" className="pn-menu-nav">
          <ul className="pn-menu-trilho">
            {presas.map((s) => (
              <li key={`fixa-${s.id}`}>
                <Dica texto={s.conta ? `${s.nome} · ${s.conta} esperando` : s.nome} lado="right">
                  <BotaoDoTrilho rotulo={s.nome} conta={s.conta} atual={s.id === atual.id} onClick={() => aoIr(s.id)}>
                    <Icone id={s.id} />
                  </BotaoDoTrilho>
                </Dica>
              </li>
            ))}
            {presas.length > 0 && <li aria-hidden className="pn-menu-trilho-sep" />}
            {espacos.map((e) => {
              const itens = doEspaco(e.id);
              const soma = somar(itens);
              const Simbolo = iconeDoEspaco(e.icone);
              const rotulo = soma ? `${e.nome} · ${soma} esperando` : e.nome;
              return (
                <li key={e.id}>
                  {itens.length === 1 ? (
                    <Dica texto={rotulo} lado="right">
                      <BotaoDoTrilho rotulo={e.nome} conta={soma} atual={espacoAtual === e.id} onClick={() => aoIr(itens[0].id)}>
                        <Simbolo aria-hidden />
                      </BotaoDoTrilho>
                    </Dica>
                  ) : (
                    // Clicar num espaço abre, ao lado, as seções dele: sem precisar abrir o menu.
                    <MenuSuspenso
                      lado="right"
                      rotulo={e.nome}
                      dica={rotulo}
                      gatilho={
                        <BotaoDoTrilho rotulo={e.nome} conta={soma} atual={espacoAtual === e.id}>
                          <Simbolo aria-hidden />
                        </BotaoDoTrilho>
                      }
                    >
                      <MenuSuspenso.Rotulo>{e.nome}</MenuSuspenso.Rotulo>
                      {itens.map((s) => (
                        <MenuSuspenso.Item key={s.id} rotulo={s.conta ? `${s.nome} (${s.conta})` : s.nome} fazer={() => aoIr(s.id)} />
                      ))}
                    </MenuSuspenso>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="pn-menu-pe">
          {ferramentas}
          {pessoa}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="pn-menu-lutas" aria-hidden />
      <div className="pn-menu-topo">
        {marca}
        {folha ? (
          <Dialog.Close asChild>
            <button type="button" className="pn-menu-icone-botao" aria-label="Fechar o menu">
              <X aria-hidden width={18} height={18} />
            </button>
          </Dialog.Close>
        ) : (
          <Dica texto="Recolher o menu" atalho="[" lado="right">
            <button type="button" className="pn-menu-icone-botao" data-tour="recolher" aria-pressed={false} aria-label="Recolher o menu" onClick={() => alternarMenu(true)}>
              <PanelLeftClose aria-hidden width={18} height={18} />
            </button>
          </Dica>
        )}
      </div>
      <label className="pn-menu-filtro">
        <Search aria-hidden width={14} height={14} />
        <span className="sr-only">Filtrar o menu</span>
        <input
          type="search"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && achadas[0]) aoIr(achadas[0].id);
            if (e.key === "Escape" && filtro) {
              e.stopPropagation();
              setFiltro("");
            }
          }}
          placeholder="Filtrar o menu"
        />
      </label>

      <nav aria-label="Espaços do painel" data-tour="areas" className="pn-menu-nav">
        {termo ? (
          <div>
            <p className="pn-menu-grupo-cabeca" style={{ cursor: "default" }}>
              Achadas
            </p>
            {achadas.length === 0 ? (
              <p className="pn-menu-nota" style={{ paddingLeft: "0.5rem" }}>
                Nenhuma seção com esse nome. A busca completa está em <Kbd>Ctrl K</Kbd>.
              </p>
            ) : (
              <ul className="pn-menu-lista">
                {achadas.map((s) => (
                  <Linha key={s.id} s={s} ativa={s.id === atual.id} comFundo aoIr={aoIr} />
                ))}
              </ul>
            )}
          </div>
        ) : (
          <ul className="pn-menu-grupos">
            {presas.length > 0 && <Grupo chave="fixadas" nome="Fixadas" padrao itens={presas} atual={atual.id} donoDoAtivo={nasFixadas} aoIr={aoIr} />}
            {departamento && doDepartamento.length > 0 && <Grupo chave="departamento" nome="Meu departamento" tour="departamento" nota={departamento.nome} padrao itens={doDepartamento} atual={atual.id} donoDoAtivo={noDepartamento} aoIr={aoIr} />}
            {espacos.map((e) => {
              const chave = `espaco:${e.id}`;
              // Um espaço fica aberto se a pessoa abriu, ou, enquanto ela não mexeu nele, se a seção de agora é dele (a
              // menos que a seção já esteja no alto, no departamento ou nas fixadas: seria a mesma linha duas vezes).
              const padrao = e.id === "mesa" || (e.id === espacoAtual && !jaNoAlto);
              return <Grupo key={chave} chave={chave} nome={e.nome} padrao={padrao} itens={doEspaco(e.id)} atual={atual.id} donoDoAtivo={!jaNoAlto && e.id === espacoAtual} aoIr={aoIr} />;
            })}
          </ul>
        )}
      </nav>

      <div className="pn-menu-pe">
        {pessoa}
        {ferramentas}
      </div>
    </>
  );
}

/**
 * O menu do painel, em tinta: a faixa das lutas no topo, a marca, o filtro, as seções fixadas, o departamento da pessoa e
 * os 8 espaços (Mesa, Escrever e produzir, Revisar e publicar, Comunidade e atendimento, Equipe, Site e operação,
 * Segurança, Minha conta), cada um com o número do que espera. No computador, recolhe para o trilho de ícones (a largura
 * anima com mola; "[" alterna). No celular, é uma folha que entra pela esquerda (foco preso, Esc fecha) e há a barra de
 * baixo. O mapa seção → espaço está em estrutura.ts: seção nova sem entrada cai no espaço do grupo antigo.
 */
export function MenuDoPainel(props: PropsDoMenu) {
  const recolhido = usePainel((s) => s.menuRecolhido);
  const aberto = usePainel((s) => s.menuCelular);
  const abrirMenuCelular = usePainel((s) => s.abrirMenuCelular);
  // A folha não tem Dialog.Trigger (abre pelo botão da barra de cima ou pelo "Mais"), e o Radix devolve o foco só ao
  // Trigger: sem isto, ao fechar, o foco caía no <body>. Guarda quem abriu (antes de o foco entrar na folha) e devolve a ele
  // quando a folha sai de vez (depois da animação de saída, quando o foco já não está preso nela).
  const quemAbriu = useRef<HTMLElement | null>(null);
  return (
    <>
      <m.aside
        id="menu-do-painel"
        aria-label="Menu do painel"
        data-recolhido={recolhido}
        className="pn-menu pn-menu-fixo no-print"
        initial={false}
        animate={{ width: recolhido ? LARGURA.recolhido : LARGURA.aberto }}
        transition={mola.menu}
      >
        <LayoutGroup id="menu-fixo">
          <ConteudoDoMenu props={props} recolhido={recolhido} folha={false} />
        </LayoutGroup>
      </m.aside>

      {/* No celular: a folha do menu (Radix Dialog por baixo: foco preso, Esc fecha, véu). */}
      <Dialog.Root open={aberto} onOpenChange={abrirMenuCelular}>
        <AnimatePresence>
          {aberto && (
            <Dialog.Portal forceMount>
              <Dialog.Overlay asChild forceMount>
                <m.div className="pn-veu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} />
              </Dialog.Overlay>
              <Dialog.Content
                asChild
                forceMount
                aria-describedby={undefined}
                onOpenAutoFocus={() => {
                  const ativo = document.activeElement;
                  quemAbriu.current = ativo instanceof HTMLElement && ativo !== document.body ? ativo : null;
                }}
                onCloseAutoFocus={(e) => {
                  const alvo = quemAbriu.current;
                  quemAbriu.current = null;
                  if (!alvo?.isConnected) return;
                  e.preventDefault();
                  alvo.focus({ preventScroll: true });
                }}
              >
                <m.aside className="pn-menu pn-menu-folha pn-portal no-print" initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={mola.menu}>
                  <Dialog.Title className="sr-only">Menu do painel</Dialog.Title>
                  <LayoutGroup id="menu-folha">
                    <ConteudoDoMenu props={props} recolhido={false} folha fechar={() => abrirMenuCelular(false)} />
                  </LayoutGroup>
                </m.aside>
              </Dialog.Content>
            </Dialog.Portal>
          )}
        </AnimatePresence>
      </Dialog.Root>
    </>
  );
}

/** Barra de baixo, só no celular: a Mesa, os espaços de trabalho e o "Mais" (a folha com tudo). */
export function BarraDeBaixo({ secoes, atual, ir }: { secoes: ItemDoMenu[]; atual: ItemDoMenu; ir: (id: string) => void }) {
  const aberto = usePainel((s) => s.menuCelular);
  const abrirMenuCelular = usePainel((s) => s.abrirMenuCelular);
  const abrirGrupo = usePainel((s) => s.abrirGrupo);
  const doEspaco = (id: IdDoEspaco) => secoes.filter((s) => espacoDe(s.id, s.grupo) === id);
  const espacoAtual = espacoDe(atual.id, atual.grupo);
  const fixos = ESPACOS.filter((e) => ["mesa", "producao", "revisao", "comunidade"].includes(e.id) && doEspaco(e.id).length > 0).slice(0, 4);
  const nome = (e: Espaco) => (e.id === "producao" ? "Escrever" : e.id === "revisao" ? "Revisar" : e.id === "comunidade" ? "Atender" : e.nome);
  const noEspaco = (e: Espaco) => {
    const itens = doEspaco(e.id);
    if (e.id === "mesa" || itens.length === 1) {
      ir(e.id === "mesa" ? "mesa" : itens[0].id);
      return;
    }
    abrirGrupo(`espaco:${e.id}`);
    abrirMenuCelular(true);
  };
  return (
    <nav aria-label="Atalhos do painel" className="pn-barra-baixo no-print">
      {fixos.map((e) => {
        const Simbolo = iconeDoEspaco(e.icone);
        return (
          <button key={e.id} type="button" onClick={() => noEspaco(e)} aria-current={espacoAtual === e.id && !aberto ? "true" : undefined} className="pn-barra-baixo-item">
            <Simbolo aria-hidden />
            <span>{nome(e)}</span>
            <Contador n={somar(doEspaco(e.id))} />
          </button>
        );
      })}
      <button type="button" onClick={() => abrirMenuCelular(!aberto)} aria-expanded={aberto} aria-haspopup="dialog" className="pn-barra-baixo-item" aria-current={aberto ? "true" : undefined}>
        <Ellipsis aria-hidden />
        <span>Mais</span>
      </button>
    </nav>
  );
}
