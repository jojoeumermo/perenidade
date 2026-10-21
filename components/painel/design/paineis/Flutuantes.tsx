// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { Icone } from "../Icone";
import type { NomeDoIcone } from "../icones";
import { caixa, type CamadaImagem, type CamadaTexto, type Documento, type Fonte, NOMES_DAS_FONTES } from "../motor";
import { BOTAO_ICONE, Cores, Dialogo, ItemDeMenu, useEditor } from "../ui";
import { guardarBloco } from "./Biblioteca";

export interface AvisoDoEstudio {
  id: string;
  mensagem: string;
  tipo: "ok" | "erro" | "info";
}

export interface Comando {
  id: string;
  nome: string;
  icone: NomeDoIcone;
  atalho?: string;
}

/** Os avisos que aparecem embaixo, no meio, e somem sozinhos. */
export function Avisos({ avisos }: { avisos: AvisoDoEstudio[] }) {
  return (
    <div className="pointer-events-none fixed bottom-20 left-1/2 z-[96] flex w-[min(92vw,30rem)] -translate-x-1/2 flex-col items-center gap-2 md:bottom-6" role="status" aria-live="polite">
      {avisos.map((a) => (
        <p key={a.id} className={`estudio-surge pointer-events-auto flex items-start gap-2 rounded-lg px-4 py-2.5 text-sm shadow-xl ${a.tipo === "erro" ? "bg-[#c21f16] text-white" : "bg-[#1f1a14] text-[#f4ecd8]"}`}>
          <Icone nome={a.tipo === "erro" ? "alerta" : a.tipo === "info" ? "info" : "check"} className="mt-0.5 h-4 w-4" />
          {a.mensagem}
        </p>
      ))}
    </div>
  );
}

const FONTES: Fonte[] = ["serifa", "sans", "mono", "manuscrita"];

/** A barra de ferramentas que flutua sobre a camada escolhida (a do texto, como no modelo aprovado). */
export function BarraFlutuante({ escala, esquerda, topo }: { escala: number; esquerda: number; topo: number }) {
  const ed = useEditor();
  const c = ed.camada;
  const [cores, setCores] = useState(false);
  const [mais, setMais] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  if (!c) return null;
  const b = caixa(c);
  const largura = c.tipo === "texto" ? 440 : 300;
  const acima = topo + b.y * escala - 92;
  const y = acima > 8 ? acima : topo + (b.y + b.h) * escala + 14;
  const x = Math.max(8, esquerda + (b.x + b.w / 2) * escala - largura / 2);
  const separador = <span className="mx-0.5 h-6 w-px bg-e-fio" aria-hidden />;
  const corAtual = c.tipo === "texto" ? c.cor : c.tipo === "elemento" || c.tipo === "marca" ? c.cor : c.tipo === "imagem" ? c.borda : c.preenchimento;
  const mudarCor = (cor: string) => (c.tipo === "texto" || c.tipo === "elemento" || c.tipo === "marca" ? ed.mudar({ cor }) : c.tipo === "imagem" ? ed.mudar({ borda: cor, espessura: cor && !c.espessura ? 6 : c.espessura }) : ed.mudar({ preenchimento: cor || "transparent" }));
  return (
    <div ref={ref} className="estudio-surge absolute z-20 flex h-12 items-center gap-0.5 rounded-xl border border-e-fio bg-e-painel px-1.5 text-e-tinta shadow-[0_10px_30px_rgba(0,0,0,0.35)]" style={{ left: x, top: y }} role="toolbar" aria-label="Ferramentas da camada" onPointerDown={(e) => e.stopPropagation()}>
      {c.tipo === "texto" && (
        <>
          <select value={c.fonte} onChange={(e) => ed.mudar({ fonte: e.target.value as Fonte })} aria-label="Fonte" className="h-9 cursor-pointer rounded-md border border-transparent bg-transparent px-1.5 font-serif text-sm hover:border-e-fio" style={{ fontFamily: c.fonte === "serifa" ? "var(--font-serif-display)" : c.fonte === "mono" ? "var(--font-archive)" : c.fonte === "manuscrita" ? "var(--font-hand)" : "var(--font-ui)" }}>
            {FONTES.map((f) => (
              <option key={f} value={f}>
                {NOMES_DAS_FONTES[f]}
              </option>
            ))}
          </select>
          <input type="number" min={4} max={1200} value={Math.round((c as CamadaTexto).tamanho)} onChange={(e) => Number(e.target.value) > 0 && ed.mudar({ tamanho: Number(e.target.value) })} aria-label="Tamanho da letra" className="h-9 w-14 rounded-md border border-e-fio bg-e-campo px-1.5 text-center text-sm" />
          <button type="button" className={`${BOTAO_ICONE} font-serif text-base font-bold ${c.peso >= 700 ? "bg-e-bordo-claro text-e-bordo" : ""}`} aria-pressed={c.peso >= 700} aria-label="Negrito" title="Negrito (para uma palavra só, escreva **assim**)" onClick={() => ed.mudar({ peso: c.peso >= 700 ? 400 : 700 })}>
            B
          </button>
          <button type="button" className={`${BOTAO_ICONE} font-serif text-base italic ${c.italico ? "bg-e-bordo-claro text-e-bordo" : ""}`} aria-pressed={c.italico} aria-label="Itálico" title="Itálico (para uma palavra só, escreva _assim_)" onClick={() => ed.mudar({ italico: !c.italico })}>
            I
          </button>
          {separador}
        </>
      )}
      <div className="relative">
        <button type="button" className={BOTAO_ICONE} aria-label="Cor" title="Cor" aria-expanded={cores} onClick={() => setCores(!cores)}>
          <span className="h-5 w-5 rounded-full border-2 border-e-suave" style={{ background: corAtual && corAtual !== "transparent" ? corAtual : "linear-gradient(45deg,transparent 45%,#c21f16 45%,#c21f16 55%,transparent 55%)" }} />
        </button>
        {cores && (
          <div className="estudio-surge absolute top-full left-0 z-30 mt-2 w-64 rounded-lg border border-e-fio bg-e-painel p-3 shadow-xl">
            <Cores valor={corAtual || ""} mudar={mudarCor} semCor={c.tipo !== "texto"} extras={ed.projeto.paleta} />
          </div>
        )}
      </div>
      {c.tipo === "texto" && (
        <>
          {(["left", "center", "right"] as const).map((a) => (
            <button key={a} type="button" className={`${BOTAO_ICONE} ${c.alinhar === a ? "bg-e-bordo-claro text-e-bordo" : ""}`} aria-pressed={c.alinhar === a} aria-label={a === "left" ? "Alinhar à esquerda" : a === "center" ? "Centralizar" : "Alinhar à direita"} title={a === "left" ? "Alinhar à esquerda" : a === "center" ? "Centralizar" : "Alinhar à direita"} onClick={() => ed.mudar({ alinhar: a })}>
              <Icone nome={a === "left" ? "texto-esq" : a === "center" ? "texto-centro" : "texto-dir"} className="h-5 w-5" />
            </button>
          ))}
        </>
      )}
      {c.tipo === "imagem" && (
        <>
          <button type="button" className={BOTAO_ICONE} aria-label="Reenquadrar a foto" title="Reenquadrar a foto (duplo clique)" onClick={() => ed.setReenquadrar(c.id)}>
            <Icone nome="enquadrar" className="h-5 w-5" />
          </button>
          <button type="button" className={BOTAO_ICONE} aria-label="Recortar ou tirar o fundo" title="Recortar ou tirar o fundo" onClick={() => ed.editarFoto(c.id)}>
            <Icone nome="remover-fundo" className="h-5 w-5" />
          </button>
          <select value={(c as CamadaImagem).filtro} onChange={(e) => ed.mudar({ filtro: e.target.value as CamadaImagem["filtro"] })} aria-label="Filtro" className="h-9 cursor-pointer rounded-md border border-e-fio bg-e-campo px-1.5 text-sm">
            <option value="nenhum">Sem filtro</option>
            <option value="pb">Preto e branco</option>
            <option value="duotom">Duotom vermelho</option>
            <option value="sepia">Sépia</option>
            <option value="contraste">Mais contraste</option>
          </select>
        </>
      )}
      {separador}
      <button type="button" className={BOTAO_ICONE} aria-label="Duplicar" title="Duplicar (Ctrl+D)" onClick={ed.acoes.duplicar}>
        <Icone nome="duplicar" className="h-5 w-5" />
      </button>
      <div className="relative">
        <button type="button" className={BOTAO_ICONE} aria-label="Mais" title="Mais" aria-expanded={mais} onClick={() => setMais(!mais)}>
          <Icone nome="pontos" className="h-5 w-5" />
        </button>
        {mais && (
          <div className="estudio-surge absolute top-full right-0 z-30 mt-2 w-60 rounded-lg border border-e-fio bg-e-painel p-1.5 text-sm shadow-xl" role="menu">
            {c.tipo === "texto" && <ItemDeMenu icone="texto" rotulo="Editar o texto na arte" atalho="Enter" onClick={() => { setMais(false); ed.editarTexto(c.id); }} />}
            <ItemDeMenu icone="copiar-estilo" rotulo="Copiar estilo" atalho="Ctrl+Alt+C" onClick={() => { setMais(false); ed.acoes.copiarEstilo(); }} />
            <ItemDeMenu icone="copiar-estilo" rotulo="Colar estilo" atalho="Ctrl+Alt+V" onClick={() => { setMais(false); ed.acoes.colarEstilo(); }} />
            <ItemDeMenu icone="frente" rotulo="Trazer para a frente" atalho="Ctrl+]" onClick={() => { setMais(false); ed.acoes.frente(); }} />
            <ItemDeMenu icone="tras" rotulo="Mandar para trás" atalho="Ctrl+[" onClick={() => { setMais(false); ed.acoes.tras(); }} />
            <ItemDeMenu icone="cadeado" rotulo="Travar" atalho="Ctrl+L" onClick={() => { setMais(false); ed.acoes.travar(); }} />
            <ItemDeMenu icone="lixeira" rotulo="Apagar" atalho="Delete" perigo onClick={() => { setMais(false); ed.acoes.apagar(); }} />
          </div>
        )}
      </div>
    </div>
  );
}

/** O menu do botão direito sobre a arte. */
export function MenuDeContexto({ x, y, fechar }: { x: number; y: number; fechar: () => void }) {
  const ed = useEditor();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    const fora = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) fechar();
    };
    window.addEventListener("pointerdown", fora, true);
    return () => window.removeEventListener("pointerdown", fora, true);
  }, [fechar]);
  const tem = ed.selecionadas.length > 0;
  const fazer = (acao: string) => () => {
    fechar();
    ed.acoes[acao]();
  };
  const c = ed.camada;
  return (
    <div ref={ref} role="menu" className="estudio-surge absolute z-40 w-64 rounded-lg border border-e-fio bg-e-painel p-1.5 text-sm text-e-tinta shadow-[0_12px_32px_rgba(0,0,0,0.35)]" style={{ left: x, top: y }} onPointerDown={(e) => e.stopPropagation()}>
      {tem ? (
        <>
          {c?.tipo === "texto" && <ItemDeMenu icone="texto" rotulo="Editar o texto" atalho="Enter" onClick={() => { fechar(); ed.editarTexto(c.id); }} />}
          {c?.tipo === "imagem" && (
            <>
              <ItemDeMenu icone="enquadrar" rotulo="Reenquadrar a foto" atalho="Enter" onClick={() => { fechar(); ed.setReenquadrar(c.id); }} />
              <ItemDeMenu icone="remover-fundo" rotulo="Recortar ou tirar o fundo" onClick={() => { fechar(); ed.editarFoto(c.id); }} />
            </>
          )}
          <ItemDeMenu icone="copiar" rotulo="Copiar" atalho="Ctrl+C" onClick={fazer("copiar")} />
          <ItemDeMenu icone="colar" rotulo="Colar" atalho="Ctrl+V" onClick={fazer("colar")} />
          <ItemDeMenu icone="duplicar" rotulo="Duplicar" atalho="Ctrl+D" onClick={fazer("duplicar")} />
          <div className="my-1 border-t border-e-fio" />
          <ItemDeMenu icone="copiar-estilo" rotulo="Copiar estilo" atalho="Ctrl+Alt+C" onClick={fazer("copiarEstilo")} />
          <ItemDeMenu icone="copiar-estilo" rotulo="Colar estilo" atalho="Ctrl+Alt+V" onClick={fazer("colarEstilo")} />
          <div className="my-1 border-t border-e-fio" />
          {ed.selecionadas.length > 1 && <ItemDeMenu icone="agrupar" rotulo="Agrupar" atalho="Ctrl+G" onClick={fazer("agrupar")} />}
          {ed.selecionadas.some((k) => k.grupo) && <ItemDeMenu icone="desagrupar" rotulo="Desagrupar" atalho="Ctrl+Shift+G" onClick={fazer("desagrupar")} />}
          <ItemDeMenu icone="frente" rotulo="Trazer para a frente" atalho="Ctrl+]" onClick={fazer("frente")} />
          <ItemDeMenu icone="tras" rotulo="Mandar para trás" atalho="Ctrl+[" onClick={fazer("tras")} />
          <ItemDeMenu icone="cadeado" rotulo="Travar" atalho="Ctrl+L" onClick={fazer("travar")} />
          <ItemDeMenu icone="olho-fechado" rotulo="Esconder" atalho="Ctrl+Shift+H" onClick={fazer("esconder")} />
          <ItemDeMenu icone="bloco" rotulo="Guardar como bloco reutilizável" onClick={() => { fechar(); void guardarBloco(ed); }} />
          <div className="my-1 border-t border-e-fio" />
          <ItemDeMenu icone="lixeira" rotulo="Apagar" atalho="Delete" perigo onClick={fazer("apagar")} />
        </>
      ) : (
        <>
          <ItemDeMenu icone="colar" rotulo="Colar" atalho="Ctrl+V" onClick={fazer("colar")} />
          <ItemDeMenu icone="camadas" rotulo="Selecionar tudo" atalho="Ctrl+A" onClick={fazer("tudo")} />
          <ItemDeMenu icone="pagina" rotulo="Nova página" onClick={fazer("novaPagina")} />
          <ItemDeMenu icone="fundo" rotulo="Mudar o fundo" onClick={() => { fechar(); ed.setGaveta("fundo"); }} />
          <ItemDeMenu icone="guias" rotulo="Guias do Instagram" atalho="Shift+I" onClick={fazer("instagram")} />
          <ItemDeMenu icone="ajustar" rotulo="Encaixar na tela" atalho="Ctrl+0" onClick={fazer("encaixar")} />
        </>
      )}
    </div>
  );
}

const semAcento = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** A paleta de comandos (Ctrl+K): procure qualquer ação pelo nome. */
export function Comandos({ comandos, fechar }: { comandos: Comando[]; fechar: () => void }) {
  const ed = useEditor();
  const [busca, setBusca] = useState("");
  const [marcado, setMarcado] = useState(0);
  const lista = useMemo(() => {
    const b = semAcento(busca.trim());
    return b ? comandos.filter((c) => semAcento(c.nome).includes(b)) : comandos;
  }, [busca, comandos]);
  const rodar = (c: Comando) => {
    fechar();
    window.setTimeout(() => ed.acoes[c.id]?.(), 0);
  };
  return (
    <Dialogo titulo="Comandos" fechar={fechar} largura="max-w-xl">
      <input
        value={busca}
        onChange={(e) => {
          setBusca(e.target.value);
          setMarcado(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setMarcado((m) => Math.min(lista.length - 1, m + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setMarcado((m) => Math.max(0, m - 1));
          } else if (e.key === "Enter" && lista[marcado]) {
            e.preventDefault();
            rodar(lista[marcado]);
          }
        }}
        placeholder="O que você quer fazer? (ex.: duplicar, guias, página)"
        aria-label="Procurar comando"
        className="mb-3 h-11 w-full rounded-lg border border-e-fio bg-e-campo px-3 text-base focus:border-e-bordo focus:outline-none"
        role="combobox"
        aria-expanded="true"
        aria-controls="estudio-comandos"
        aria-activedescendant={lista[marcado] ? `comando-${lista[marcado].id}` : undefined}
      />
      <ul id="estudio-comandos" role="listbox" className="max-h-[50vh] overflow-y-auto">
        {lista.map((c, i) => (
          <li key={c.id} id={`comando-${c.id}`} role="option" aria-selected={i === marcado}>
            <button type="button" className={`flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left text-sm ${i === marcado ? "bg-e-bordo-claro text-e-bordo" : "hover:bg-e-bordo-claro"}`} onMouseEnter={() => setMarcado(i)} onClick={() => rodar(c)}>
              <Icone nome={c.icone} className="h-4 w-4" />
              <span className="flex-1">{c.nome}</span>
              {c.atalho && <kbd className="font-mono text-xs text-e-suave">{c.atalho}</kbd>}
            </button>
          </li>
        ))}
        {!lista.length && <li className="px-3 py-6 text-center text-sm text-e-suave">Nenhum comando com esse nome.</li>}
      </ul>
    </Dialogo>
  );
}

/** A tela de atalhos (?). */
export function Atalhos({ comandos, fechar }: { comandos: Comando[]; fechar: () => void }) {
  const extras: [string, string][] = [
    ["Arrastar com Shift", "Move só na horizontal ou na vertical; nos cantos, mantém a proporção"],
    ["Arrastar com Alt", "Desliga o ímã e o encaixe de 8 em 8"],
    ["Alt+clique", "Escolhe a camada de baixo, quando há várias empilhadas"],
    ["Shift+clique", "Escolhe várias camadas"],
    ["Ctrl+clique", "Escolhe uma camada de dentro de um grupo"],
    ["Setas (Shift: 10 pontos)", "Move a camada escolhida"],
    ["Espaço segurado", "Arrasta a tela"],
    ["Ctrl+rodinha", "Aproxima e afasta"],
    ["Duplo clique", "Edita o texto na arte; na foto, reenquadra"],
    ["Botão direito", "Menu da camada"],
    ["Esc", "Solta a seleção, sai do modo foco e do reenquadre"],
  ];
  return (
    <Dialogo titulo="Atalhos do teclado" fechar={fechar} largura="max-w-3xl">
      <div className="grid gap-x-8 gap-y-1 text-sm md:grid-cols-2">
        {comandos
          .filter((c) => c.atalho)
          .map((c) => (
            <p key={c.id} className="flex items-center justify-between gap-3 border-b border-e-fio py-1.5">
              <span>{c.nome}</span>
              <kbd className="rounded border border-e-fio bg-e-campo px-1.5 py-0.5 font-mono text-xs">{c.atalho}</kbd>
            </p>
          ))}
      </div>
      <h3 className="mt-5 mb-2 font-serif text-lg font-semibold">Com o mouse</h3>
      <div className="grid gap-x-8 gap-y-1 text-sm md:grid-cols-2">
        {extras.map(([tecla, efeito]) => (
          <p key={tecla} className="flex items-start justify-between gap-3 border-b border-e-fio py-1.5">
            <kbd className="shrink-0 rounded border border-e-fio bg-e-campo px-1.5 py-0.5 font-mono text-xs">{tecla}</kbd>
            <span className="text-right text-e-suave">{efeito}</span>
          </p>
        ))}
      </div>
      <p className="mt-4 text-sm text-e-suave">No texto: _itálico_, **negrito** e ==destaque== misturam estilos na mesma caixa. Variáveis como {"{link}"}, {"{arroba}"}, {"{data}"} e {"{pagina}"} / {"{total}"} viram o valor na hora de desenhar.</p>
    </Dialogo>
  );
}

function passoDaRegua(escala: number) {
  for (const p of [10, 20, 50, 100, 200, 500, 1000]) if (p * escala >= 56) return p;
  return 1000;
}

/** A régua de cima, em pontos da arte. */
export function ReguaHorizontal({ escala, doc, style }: { escala: number; doc: Documento; style: CSSProperties }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const largura = doc.w * escala;
    c.width = Math.round(largura * dpr);
    c.height = Math.round(20 * dpr);
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "rgba(31, 26, 20, 0.85)";
    ctx.fillRect(0, 0, largura, 20);
    const passo = passoDaRegua(escala);
    ctx.strokeStyle = "#b3a584";
    ctx.fillStyle = "#e8dcc0";
    ctx.font = "10px system-ui, sans-serif";
    ctx.beginPath();
    for (let v = 0; v <= doc.w; v += passo / 5) {
      const x = Math.round(v * escala) + 0.5;
      const grande = Math.abs(v % passo) < 0.001;
      ctx.moveTo(x, grande ? 4 : 13);
      ctx.lineTo(x, 20);
      if (grande) ctx.fillText(String(Math.round(v)), x + 3, 11);
    }
    ctx.stroke();
  }, [escala, doc.w]);
  return <canvas ref={ref} aria-hidden className="absolute" style={{ ...style, height: 20 }} />;
}

/** A régua da esquerda. */
export function ReguaVertical({ escala, doc, style }: { escala: number; doc: Documento; style: CSSProperties }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const altura = doc.h * escala;
    c.width = Math.round(20 * dpr);
    c.height = Math.round(altura * dpr);
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "rgba(31, 26, 20, 0.85)";
    ctx.fillRect(0, 0, 20, altura);
    const passo = passoDaRegua(escala);
    ctx.strokeStyle = "#b3a584";
    ctx.fillStyle = "#e8dcc0";
    ctx.font = "10px system-ui, sans-serif";
    ctx.beginPath();
    for (let v = 0; v <= doc.h; v += passo / 5) {
      const y = Math.round(v * escala) + 0.5;
      const grande = Math.abs(v % passo) < 0.001;
      ctx.moveTo(grande ? 4 : 13, y);
      ctx.lineTo(20, y);
      if (grande) {
        ctx.save();
        ctx.translate(11, y + 3);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(String(Math.round(v)), -ctx.measureText(String(Math.round(v))).width - 2, 0);
        ctx.restore();
      }
    }
    ctx.stroke();
  }, [escala, doc.h]);
  return <canvas ref={ref} aria-hidden className="absolute" style={{ ...style, width: 20 }} />;
}
