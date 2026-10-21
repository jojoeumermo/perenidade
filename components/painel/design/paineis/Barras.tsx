// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { enderecoDo } from "@/lib/estudio";
import { Icone } from "../Icone";
import type { NomeDoIcone } from "../icones";
import { nomeDeArquivo, paraPsd, usarVariaveis } from "../motor";
import { variaveisDaPagina } from "../projeto";
import { baixarArquivo } from "../exportacao";
import { ATIVO, BOTAO, BOTAO_ICONE, BOTAO_PRIMARIO, BotaoIcone, type Gaveta, ItemDeMenu, Menu, useEditor } from "../ui";
import { MenuBaixar } from "./Exportar";

/** O símbolo do instituto, pequeno, para a barra do alto. */
function Simbolo({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      <path fill="#c21f16" d="M60 10l6.29 19.35h20.34L70.17 41.31l6.29 19.34L60 48.7 43.54 60.65l6.29-19.34-16.46-11.96h20.34z" />
      <path fill="currentColor" d="M56 108V76C46 69 31 67 12 71v30c19-4 34-1 44 7zM64 108V76c10-7 25-9 44-5v30c-19-4-34-1-44 7z" />
    </svg>
  );
}

function quandoGuardou(salvoEm: number | null, agora: number) {
  if (!salvoEm) return "";
  const minutos = Math.floor((agora - salvoEm) / 60_000);
  if (minutos < 1) return "Guardado agora";
  if (minutos < 60) return `Guardado há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  return horas < 24 ? `Guardado há ${horas} h` : `Guardado em ${new Date(salvoEm).toLocaleDateString("pt-BR")}`;
}

const iniciais = (nome: string) =>
  nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

/** Abre o PSD no editor avançado (PhotoCraft): baixa o arquivo e abre o editor em outra aba. */
export async function abrirNoAvancado(ed: ReturnType<typeof useEditor>) {
  try {
    ed.progresso(0.2, "Montando o PSD");
    usarVariaveis(variaveisDaPagina(ed.projeto, ed.pagina));
    baixarArquivo(await paraPsd(ed.doc), `${nomeDeArquivo(ed.titulo)}.psd`);
    const endereco = enderecoDo("photocraft");
    if (endereco) window.open(endereco, "_blank", "noopener");
    ed.avisar(endereco ? "PSD baixado. O editor avançado abriu em outra aba: abra o arquivo nele (File › Open…)." : "PSD baixado. O editor avançado ainda não está no ar; o arquivo abre em qualquer editor que leia PSD.", "info");
  } catch {
    ed.avisar("Não deu para montar o PSD.", "erro");
  } finally {
    ed.progresso(null);
  }
}

export function BarraDoAlto({ mexido, salvoEm, guardando, escala, podeRefazer, passos, celular, ferramenta }: { mexido: boolean; salvoEm: number | null; guardando: boolean; escala: number; passos: string[]; voltarAte: (i: number) => void; podeRefazer: boolean; celular: boolean; ferramenta: "mover" | "texto" | "mao" }) {
  const ed = useEditor();
  const [agora, setAgora] = useState(() => Date.now());
  const [menuZoom, setMenuZoom] = useState(false);
  const [menuBaixar, setMenuBaixar] = useState(false);
  const [menuMais, setMenuMais] = useState(false);
  useEffect(() => {
    const id = window.setInterval(() => setAgora(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const estado = guardando ? "Guardando…" : mexido ? (ed.idSalvo ? "Mudanças a guardar" : "Rascunho neste aparelho") : quandoGuardou(salvoEm, agora) || "Ainda não guardado";
  const ok = !guardando && !mexido && Boolean(salvoEm);
  return (
    <header className="flex h-14 shrink-0 items-center gap-1.5 border-b border-e-fio bg-e-painel px-2 sm:gap-3 sm:px-3">
      <button type="button" className={BOTAO_ICONE} onClick={ed.acoes.sair} aria-label="Sair do estúdio" title="Sair do estúdio (o rascunho fica guardado neste aparelho)">
        <Icone nome="seta-esq" className="h-5 w-5" />
      </button>
      <span className="hidden text-e-tinta sm:block">
        <Simbolo />
      </span>
      <div className="min-w-0 sm:w-56 lg:w-64">
        <p className="hidden font-mono text-[0.62rem] uppercase leading-none tracking-[0.2em] text-e-suave sm:block">Estúdio</p>
        <input value={ed.titulo} onChange={(e) => ed.setTitulo(e.target.value)} maxLength={120} aria-label="Nome do trabalho" className="w-full truncate rounded-sm border border-transparent bg-transparent font-serif text-[1.05rem] leading-tight font-semibold text-e-tinta hover:border-e-fio focus:border-e-bordo focus:outline-none" />
      </div>
      {!celular && (
        <span className={`hidden items-center gap-1.5 text-sm whitespace-nowrap xl:flex ${ok ? "text-e-suave" : "text-e-bordo"}`} role="status">
          {ok ? <Icone nome="check" className="h-4 w-4 text-[#2f5d34]" /> : <span className="h-2 w-2 rounded-full bg-current" aria-hidden />}
          {estado}
        </span>
      )}
      <div className="flex-1" />
      {!celular && (
        <div className="hidden items-center gap-0.5 rounded-lg border border-e-fio p-0.5 md:flex" role="group" aria-label="Ferramenta">
          <BotaoIcone icone="mover" rotulo="Mover e selecionar" atalho="V" ativo={ferramenta === "mover"} onClick={ed.acoes.ferramentaMover} className="h-8 w-8" />
          <BotaoIcone icone="texto" rotulo="Texto: clique na arte para escrever" atalho="T" ativo={ferramenta === "texto"} onClick={ed.acoes.ferramentaTexto} className="h-8 w-8" />
          <BotaoIcone icone="maos" rotulo="Mão: arrastar a tela" atalho="H ou espaço" ativo={ferramenta === "mao"} onClick={ed.acoes.ferramentaMao} className="h-8 w-8" />
        </div>
      )}
      <div className="flex items-center">
        <BotaoIcone icone="desfazer" rotulo={passos.length ? `Desfazer: ${passos[passos.length - 1]}` : "Desfazer"} atalho="Ctrl+Z" onClick={ed.acoes.desfazer} disabled={!passos.length} />
        <BotaoIcone icone="refazer" rotulo="Refazer" atalho="Ctrl+Shift+Z" onClick={ed.acoes.refazer} disabled={!podeRefazer} />
      </div>
      {!celular && (
        <div className="relative hidden items-center rounded-lg border border-e-fio md:flex">
          <BotaoIcone icone="menos" rotulo="Afastar" atalho="Ctrl+-" onClick={ed.acoes.afastar} className="h-8 w-8" tamanho="h-4 w-4" />
          <button type="button" className="h-8 min-w-14 cursor-pointer px-1 font-mono text-sm text-e-tinta hover:bg-e-bordo-claro" onClick={() => setMenuZoom(!menuZoom)} aria-haspopup="menu" aria-expanded={menuZoom} title="Zoom">
            {Math.round(escala * 100)}%
          </button>
          <BotaoIcone icone="mais" rotulo="Aproximar" atalho="Ctrl++" onClick={ed.acoes.aproximar} className="h-8 w-8" tamanho="h-4 w-4" />
          <Menu aberto={menuZoom} fechar={() => setMenuZoom(false)} className="w-52">
            <ItemDeMenu icone="ajustar" rotulo="Encaixar na tela" atalho="Ctrl+0" onClick={() => { ed.acoes.encaixar(); setMenuZoom(false); }} />
            <ItemDeMenu rotulo="50%" onClick={() => { ed.acoes.metade(); setMenuZoom(false); }} />
            <ItemDeMenu rotulo="100% (tamanho real)" atalho="Ctrl+1" onClick={() => { ed.acoes.cem(); setMenuZoom(false); }} />
          </Menu>
        </div>
      )}
      {!celular && (
        <button type="button" className={`${BOTAO} hidden lg:inline-flex`} onClick={ed.acoes.previa} title="Pré-visualizar (P)">
          <Icone nome="olho" className="h-4 w-4" /> Pré-visualizar
        </button>
      )}
      <div className="relative">
        <button type="button" className={celular ? BOTAO_ICONE : BOTAO} onClick={() => setMenuBaixar(!menuBaixar)} aria-haspopup="menu" aria-expanded={menuBaixar} aria-label="Baixar" title="Baixar (Ctrl+E)">
          <Icone nome="baixar" className="h-4 w-4" />
          {!celular && (
            <>
              <span className="hidden sm:inline">Baixar</span>
              <Icone nome="seta" className="h-4 w-4 text-e-suave" />
            </>
          )}
        </button>
        <MenuBaixar aberto={menuBaixar} fechar={() => setMenuBaixar(false)} />
      </div>
      <button type="button" className={BOTAO_PRIMARIO} onClick={() => void ed.guardar()} disabled={guardando} title="Guardar na conta (Ctrl+S)">
        {guardando ? "Guardando…" : ed.laboratorio ? "Guardar no aparelho" : "Guardar"}
      </button>
      <div className="relative">
        <BotaoIcone icone="pontos" rotulo="Mais" onClick={() => setMenuMais(!menuMais)} ativo={menuMais} />
        <Menu aberto={menuMais} fechar={() => setMenuMais(false)} alinhar="direita" className="w-72">
          {(
            [
              ["verificar", "Conferir antes de postar", "conferir"],
              ["olho", "Pré-visualizar", "previa"],
              ["publicar", "Publicar no Instagram", "publicar"],
              ["comentario", "Revisão e comentários", "revisao"],
              ["historico", "Versões guardadas", "historicoDeVersoes"],
              ["idioma", "Versão em outro idioma", "idioma"],
              ["lista", "Gerar várias artes de uma lista", "lote"],
              ["ab", "Criar versão B (teste A/B)", "versaoB"],
              ["comando", "Todos os comandos", "comandos"],
              ["teclado", "Atalhos do teclado", "atalhos"],
            ] as [NomeDoIcone, string, string][]
          )
            .filter(([, , acao]) => !ed.laboratorio || !["publicar", "revisao", "historicoDeVersoes"].includes(acao))
            .map(([icone, rotulo, acao]) => (
            <ItemDeMenu key={acao} icone={icone} rotulo={rotulo} atalho={acao === "comandos" ? "Ctrl+K" : acao === "atalhos" ? "?" : undefined} onClick={() => { ed.acoes[acao](); setMenuMais(false); }} />
          ))}
          <div className="my-1 border-t border-e-fio" />
          <ItemDeMenu icone="lampada" rotulo={ed.simples ? "Sair do modo simples" : "Modo simples (menos botões)"} onClick={() => { ed.setSimples(!ed.simples); setMenuMais(false); }} />
          <ItemDeMenu icone="lua" rotulo="Interface clara ou escura" onClick={() => { ed.acoes.temaDaInterface(); setMenuMais(false); }} />
          <ItemDeMenu icone="externo" rotulo="Abrir no editor avançado (PSD)" onClick={() => { void abrirNoAvancado(ed); setMenuMais(false); }} />
        </Menu>
      </div>
      {!celular && (
        <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-e-tinta font-sans text-xs font-bold text-e-painel lg:flex" title={ed.me.nome} aria-label={ed.me.nome}>
          {iniciais(ed.me.nome) || "?"}
        </span>
      )}
    </header>
  );
}

const ITENS_DO_TRILHO: { id: Exclude<Gaveta, null>; nome: string; icone: NomeDoIcone; simples: boolean }[] = [
  { id: "modelos", nome: "Modelos", icone: "modelos", simples: true },
  { id: "texto", nome: "Texto", icone: "texto", simples: true },
  { id: "elementos", nome: "Elementos", icone: "elementos", simples: false },
  { id: "imagens", nome: "Imagens", icone: "imagens", simples: true },
  { id: "fundo", nome: "Fundo", icone: "fundo", simples: false },
  { id: "trabalhos", nome: "Trabalhos", icone: "trabalhos", simples: true },
];

/** O trilho de ícones da esquerda (abre e fecha as gavetas). */
export function Trilho() {
  const ed = useEditor();
  return (
    <nav className="flex w-20 shrink-0 flex-col items-stretch gap-1 border-r border-e-fio bg-e-fundo px-2 py-2.5" aria-label="Gavetas do estúdio">
      {ITENS_DO_TRILHO.filter((i) => (!ed.simples || i.simples) && !(ed.laboratorio && i.id === "trabalhos")).map((i) => (
        <button key={i.id} type="button" onClick={() => ed.setGaveta(ed.gaveta === i.id ? null : i.id)} aria-pressed={ed.gaveta === i.id} className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg py-2.5 text-[0.72rem] text-e-tinta hover:bg-e-bordo-claro ${ed.gaveta === i.id ? ATIVO : ""}`}>
          <Icone nome={i.icone} className="h-[22px] w-[22px]" />
          {i.nome}
        </button>
      ))}
      <div className="flex-1" />
      <button type="button" onClick={() => void abrirNoAvancado(ed)} className="flex cursor-pointer flex-col items-center gap-1 rounded-lg py-2 text-[0.68rem] text-e-suave hover:bg-e-bordo-claro hover:text-e-tinta" title="Baixa o PSD com as camadas e abre o editor avançado (PhotoCraft)">
        <Icone nome="externo" className="h-5 w-5" />
        Avançado
      </button>
      <button type="button" onClick={ed.acoes.atalhos} className="mx-auto flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-e-suave hover:bg-e-bordo-claro hover:text-e-tinta" aria-label="Ajuda e atalhos" title="Ajuda e atalhos (?)">
        <Icone nome="ajuda" className="h-5 w-5" />
      </button>
    </nav>
  );
}

/** As abas de baixo, no celular. */
export function AbasDoCelular() {
  const ed = useEditor();
  return (
    <nav className="grid shrink-0 border-t border-e-fio bg-e-painel pb-[env(safe-area-inset-bottom,0px)]" style={{ gridTemplateColumns: `repeat(${ed.laboratorio ? 5 : 6}, minmax(0, 1fr))` }} aria-label="Gavetas do estúdio">
      {ITENS_DO_TRILHO.filter((i) => !(ed.laboratorio && i.id === "trabalhos")).map((i) => (
        <button key={i.id} type="button" onClick={() => ed.setGaveta(ed.gaveta === i.id ? null : i.id)} aria-pressed={ed.gaveta === i.id} className={`flex cursor-pointer flex-col items-center gap-0.5 py-2 text-[0.66rem] ${ed.gaveta === i.id ? "text-e-bordo" : "text-e-tinta"}`}>
          <Icone nome={i.icone} className="h-5 w-5" />
          {i.nome}
        </button>
      ))}
    </nav>
  );
}
