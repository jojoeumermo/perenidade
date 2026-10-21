// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// As peças da interface do estúdio: o contexto do editor (o que todos os painéis leem e mudam), seções, campos
// numéricos, faixas, a escolha de cor (paleta, cor livre e conta-gotas), botões de ícone e menus.

import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";
import type { Me } from "@/lib/backend";
import type { Abertura } from "./Estudio";
import { Icone } from "./Icone";
import type { NomeDoIcone } from "./icones";
import type { Camada, Documento, FormatoId } from "./motor";
import { PALETA } from "./motor";
import type { Modelo } from "./modelos";
import type { Projeto } from "./projeto";

export interface AjudasDaTela {
  instagram: boolean;
  margens: boolean;
  grade: boolean;
  reguas: boolean;
  /** Encaixar posições e tamanhos em múltiplos de 8. */
  oito: boolean;
}

export type Gaveta = "modelos" | "texto" | "elementos" | "imagens" | "fundo" | "trabalhos" | null;
export type Janela = null | "previa" | "baixar" | "atalhos" | "comandos" | "foto" | "idioma" | "lote" | "conferir" | "historico" | "revisao" | "publicar";

export interface Editor {
  me: Me;
  projeto: Projeto;
  doc: Documento;
  pagina: number;
  titulo: string;
  setTitulo: (t: string) => void;
  formato: FormatoId;
  /** As camadas escolhidas (na ordem do documento). */
  selecionadas: Camada[];
  camada: Camada | null;
  selecionar: (ids: string[]) => void;
  setProjeto: (f: (p: Projeto) => Projeto, lembrar?: boolean, rotulo?: string) => void;
  setDoc: (f: (d: Documento) => Documento, lembrar?: boolean, rotulo?: string) => void;
  /** Muda as camadas escolhidas (cada uma recebe a mudança; textos recalculam a altura). */
  mudar: (m: Partial<Camada>, lembrar?: boolean) => void;
  mudarCamada: (id: string, m: Partial<Camada>, lembrar?: boolean) => void;
  acrescentar: (c: Camada | Camada[]) => void;
  ajustarAltura: (c: Camada) => Camada;
  acoes: Record<string, () => void>;
  irParaPagina: (i: number) => void;
  usarModelo: (m: Modelo, modo: "trocar" | "acrescentar" | "novo") => void;
  mudarFormato: (id: FormatoId, adaptarCamadas: boolean) => void;
  avisar: (mensagem: string, tipo?: "ok" | "erro" | "info") => void;
  progresso: (f: number | null, rotulo?: string) => void;
  gaveta: Gaveta;
  setGaveta: (g: Gaveta) => void;
  janela: Janela;
  setJanela: (j: Janela) => void;
  ajudas: AjudasDaTela;
  setAjudas: (f: (a: AjudasDaTela) => AjudasDaTela) => void;
  simples: boolean;
  setSimples: (s: boolean) => void;
  /** Conta-gotas: o próximo clique na arte devolve a cor daquele ponto. */
  pegarCor: (devolver: (cor: string) => void) => void;
  idSalvo: string | null;
  guardar: () => Promise<void>;
  /** Variáveis valendo na página aberta. */
  vars: Record<string, string>;
  /** Abre a imagem escolhida no editor de foto (recorte e fundo). */
  editarFoto: (id: string) => void;
  reenquadrar: string | null;
  setReenquadrar: (id: string | null) => void;
  editarTexto: (id: string) => void;
  /** Abre outro trabalho (ou modelo) no mesmo editor. */
  abrir: (a: Abertura) => void;
  mexido: boolean;
  /** No Laboratório de Design dos estudantes: sem conta, tudo fica no aparelho (sem trabalhos, revisão nem publicação). */
  laboratorio: boolean;
}

export const ContextoDoEditor = createContext<Editor | null>(null);
export function useEditor(): Editor {
  const e = useContext(ContextoDoEditor);
  if (!e) throw new Error("useEditor fora do estúdio");
  return e;
}

/** Classes repetidas. */
export const CAMPO = "h-9 w-full rounded-md border border-e-fio bg-e-campo px-2.5 text-sm text-e-tinta focus:border-e-bordo focus:outline-none disabled:opacity-50";
export const ROTULO = "font-mono text-[0.68rem] uppercase tracking-[0.16em] text-e-suave";
export const BOTAO = "inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-e-fio bg-e-campo px-3 text-sm text-e-tinta hover:border-e-tinta disabled:cursor-not-allowed disabled:opacity-40";
export const BOTAO_PRIMARIO = "e-primario inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50";
export const BOTAO_ICONE = "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-e-tinta hover:bg-e-bordo-claro disabled:cursor-not-allowed disabled:opacity-35";
export const ATIVO = "bg-e-bordo-claro text-e-bordo";

export function BotaoIcone({ icone, rotulo, atalho, onClick, ativo, disabled, className = "", tamanho = "h-5 w-5" }: { icone: NomeDoIcone; rotulo: string; atalho?: string; onClick: () => void; ativo?: boolean; disabled?: boolean; className?: string; tamanho?: string }) {
  return (
    <button type="button" className={`${BOTAO_ICONE} ${ativo ? ATIVO : ""} ${className}`} onClick={onClick} disabled={disabled} aria-label={rotulo} aria-pressed={ativo} title={atalho ? `${rotulo} (${atalho})` : rotulo}>
      <Icone nome={icone} className={tamanho} />
    </button>
  );
}

export function Secao({ titulo, children, aberta = true, acao }: { titulo: string; children: ReactNode; aberta?: boolean; acao?: ReactNode }) {
  const [aberto, setAberto] = useState(aberta);
  return (
    <section className="border-b border-e-fio px-4 py-3">
      <div className="flex items-center justify-between">
        <button type="button" className={`${ROTULO} flex cursor-pointer items-center gap-1`} aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
          <Icone nome={aberto ? "seta" : "seta-dir"} className="h-3.5 w-3.5" />
          {titulo}
        </button>
        {acao}
      </div>
      {aberto && <div className="mt-2.5 space-y-2.5">{children}</div>}
    </section>
  );
}

/** Um número editável, com rótulo pequeno em cima; aceita arrastar no rótulo para mudar (como nos editores). */
export function Numero({ rotulo, valor, mudar, passo = 1, min, max, sufixo, desativado, casas = 0 }: { rotulo: string; valor: number; mudar: (v: number, fim?: boolean) => void; passo?: number; min?: number; max?: number; sufixo?: string; desativado?: boolean; casas?: number }) {
  const [texto, setTexto] = useState<string | null>(null);
  const arrasto = useRef<{ x: number; v: number } | null>(null);
  const limitar = (v: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));
  const mostrado = texto ?? (casas ? valor.toFixed(casas).replace(".", ",") : String(Math.round(valor)));
  return (
    <label className="block min-w-0">
      <span
        className={`mb-1 block cursor-ew-resize select-none text-xs text-e-suave ${desativado ? "pointer-events-none" : ""}`}
        onPointerDown={(e) => {
          arrasto.current = { x: e.clientX, v: valor };
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!arrasto.current) return;
          const v = limitar(arrasto.current.v + Math.round((e.clientX - arrasto.current.x) / 3) * passo);
          mudar(Number(v.toFixed(Math.max(casas, 0))), false);
        }}
        onPointerUp={() => {
          if (arrasto.current) mudar(valor, true);
          arrasto.current = null;
        }}
      >
        {rotulo}
      </span>
      <span className="relative block">
        <input
          type="text"
          inputMode="decimal"
          className={`${CAMPO} ${sufixo ? "pr-7" : ""}`}
          value={mostrado}
          disabled={desativado}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            setTexto(e.target.value);
            const v = Number(e.target.value.replace(",", "."));
            if (e.target.value.trim() !== "" && Number.isFinite(v)) mudar(limitar(v), true);
          }}
          onBlur={() => setTexto(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              const v = limitar(valor + (e.key === "ArrowUp" ? 1 : -1) * passo * (e.shiftKey ? 10 : 1));
              setTexto(null);
              mudar(Number(v.toFixed(Math.max(casas, 0))), true);
            } else if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
        {sufixo && <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-e-suave">{sufixo}</span>}
      </span>
    </label>
  );
}

export function Faixa({ rotulo, valor, min, max, passo = 1, mudar, sufixo = "", casas }: { rotulo: string; valor: number; min: number; max: number; passo?: number; mudar: (v: number, fim?: boolean) => void; sufixo?: string; casas?: number }) {
  const c = casas ?? (Number.isInteger(passo) ? 0 : 2);
  return (
    <label className="block text-xs">
      <span className="flex justify-between text-e-suave">
        {rotulo}
        <span className="font-mono text-e-tinta">
          {c ? valor.toFixed(c).replace(".", ",") : Math.round(valor)}
          {sufixo}
        </span>
      </span>
      <input type="range" min={min} max={max} step={passo} value={valor} onChange={(e) => mudar(Number(e.target.value), false)} onPointerUp={(e) => mudar(Number((e.target as HTMLInputElement).value), true)} onKeyUp={(e) => mudar(Number((e.target as HTMLInputElement).value), true)} className="mt-1 w-full" />
    </label>
  );
}

export function Chave({ rotulo, ligado, mudar, dica }: { rotulo: string; ligado: boolean; mudar: (v: boolean) => void; dica?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm" title={dica}>
      <input type="checkbox" checked={ligado} onChange={(e) => mudar(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--e-bordo)]" />
      <span>
        {rotulo}
        {dica && <span className="block text-xs text-e-suave">{dica}</span>}
      </span>
    </label>
  );
}

const corValida = (c: string) => /^#[0-9a-f]{6}$/i.test(c);

/** As cores redondas da paleta, a cor livre (+) e o conta-gotas. "semCor" põe a opção transparente. */
export function Cores({ valor, mudar, semCor, extras = [] }: { valor: string; mudar: (cor: string) => void; semCor?: boolean; extras?: string[] }) {
  const ed = useContext(ContextoDoEditor);
  const paleta = [...PALETA.map(([nome, cor]) => ({ nome, cor })), ...extras.filter((c) => !PALETA.some(([, k]) => k === c)).map((cor) => ({ nome: cor, cor }))];
  const conta = typeof window !== "undefined" && "EyeDropper" in window;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {semCor && (
        <button type="button" title="Sem cor" aria-label="Sem cor" aria-pressed={valor === "" || valor === "transparent"} onClick={() => mudar("")} className={`h-7 w-7 cursor-pointer rounded-full border border-e-fio bg-[linear-gradient(45deg,transparent_45%,#c21f16_45%,#c21f16_55%,transparent_55%)] ${valor === "" || valor === "transparent" ? "ring-2 ring-e-bordo ring-offset-2 ring-offset-e-painel" : ""}`} />
      )}
      {paleta.map(({ nome, cor }) => (
        <button key={cor} type="button" title={nome} aria-label={nome} aria-pressed={valor.toLowerCase() === cor.toLowerCase()} onClick={() => mudar(cor)} className={`h-7 w-7 cursor-pointer rounded-full border border-black/15 ${valor.toLowerCase() === cor.toLowerCase() ? "ring-2 ring-e-bordo ring-offset-2 ring-offset-e-painel" : ""}`} style={{ background: cor }} />
      ))}
      <label className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-dashed border-e-suave text-e-suave hover:border-e-tinta hover:text-e-tinta" title="Outra cor">
        <Icone nome="mais" className="h-4 w-4" />
        <input type="color" value={corValida(valor) ? valor : "#000000"} onChange={(e) => mudar(e.target.value)} aria-label="Outra cor" className="absolute inset-0 cursor-pointer opacity-0" />
      </label>
      <button
        type="button"
        title={conta ? "Conta-gotas: pegar uma cor de qualquer lugar da tela" : "Conta-gotas: clique num ponto da arte"}
        aria-label="Conta-gotas"
        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-e-suave hover:bg-e-bordo-claro hover:text-e-tinta"
        onClick={async () => {
          if (conta) {
            try {
              const r = await new (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper().open();
              mudar(r.sRGBHex);
            } catch {
              /* a pessoa desistiu */
            }
          } else ed?.pegarCor(mudar);
        }}
      >
        <Icone nome="conta-gotas" className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Um menu suspenso simples (abre abaixo do botão; fecha com Esc ou clique fora). */
export function Menu({ aberto, fechar, children, className = "", alinhar = "esquerda" }: { aberto: boolean; fechar: () => void; children: ReactNode; className?: string; alinhar?: "esquerda" | "direita" }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) fechar();
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        fechar();
      }
    };
    window.addEventListener("pointerdown", fora, true);
    window.addEventListener("keydown", tecla, true);
    const primeiro = ref.current?.querySelector<HTMLElement>("button, input, select, [tabindex]");
    primeiro?.focus();
    return () => {
      window.removeEventListener("pointerdown", fora, true);
      window.removeEventListener("keydown", tecla, true);
    };
  }, [aberto, fechar]);
  if (!aberto) return null;
  return (
    <div ref={ref} role="menu" className={`estudio-surge absolute top-full z-30 mt-1.5 min-w-56 rounded-lg border border-e-fio bg-e-painel p-1.5 text-sm text-e-tinta shadow-[0_12px_32px_rgba(23,19,14,0.22)] ${alinhar === "direita" ? "right-0" : "left-0"} ${className}`}>
      {children}
    </div>
  );
}

export function ItemDeMenu({ icone, rotulo, atalho, onClick, disabled, perigo }: { icone?: NomeDoIcone; rotulo: string; atalho?: string; onClick: () => void; disabled?: boolean; perigo?: boolean }) {
  return (
    <button type="button" role="menuitem" disabled={disabled} onClick={onClick} className={`flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-e-bordo-claro disabled:cursor-not-allowed disabled:opacity-40 ${perigo ? "text-[#c21f16]" : ""}`}>
      {icone ? <Icone nome={icone} className="h-4 w-4 text-e-suave" /> : <span className="w-4" />}
      <span className="min-w-0 flex-1 truncate">{rotulo}</span>
      {atalho && <kbd className="font-mono text-[0.68rem] text-e-suave">{atalho}</kbd>}
    </button>
  );
}

/** Janela sobre o estúdio (com título, fechar e foco preso dentro). */
export function Dialogo({ titulo, fechar, children, largura = "max-w-3xl", rodape }: { titulo: string; fechar: () => void; children: ReactNode; largura?: string; rodape?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("input, textarea, select, button:not([data-fechar])")?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        fechar();
      } else if (e.key === "Tab" && ref.current) {
        const focaveis = [...ref.current.querySelectorAll<HTMLElement>("button, input, textarea, select, a[href], [tabindex]:not([tabindex='-1'])")].filter((el) => !el.hasAttribute("disabled"));
        if (!focaveis.length) return;
        const [primeiro, ultimo] = [focaveis[0], focaveis[focaveis.length - 1]];
        if (e.shiftKey && document.activeElement === primeiro) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault();
          primeiro.focus();
        }
      }
    };
    window.addEventListener("keydown", tecla, true);
    return () => {
      window.removeEventListener("keydown", tecla, true);
      anterior?.focus?.();
    };
  }, [fechar]);
  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-[rgba(23,19,14,0.55)] p-0 sm:items-center sm:p-6" onPointerDown={(e) => e.target === e.currentTarget && fechar()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={titulo} className={`estudio-surge flex max-h-[92dvh] w-full ${largura} flex-col rounded-t-xl border border-e-fio bg-e-painel text-e-tinta shadow-2xl sm:rounded-xl`}>
        <div className="flex items-center justify-between border-b border-e-fio px-5 py-3.5">
          <h2 className="font-serif text-xl font-semibold">{titulo}</h2>
          <button type="button" data-fechar className={BOTAO_ICONE} onClick={fechar} aria-label="Fechar">
            <Icone nome="fechar" className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 [scrollbar-width:thin]">{children}</div>
        {rodape && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-e-fio px-5 py-3">{rodape}</div>}
      </div>
    </div>
  );
}

export { Miniatura } from "./Miniatura";
