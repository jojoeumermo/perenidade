// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";

// Campos do painel que o navegador desenha mal ou em inglês: a data (dd/mm/aaaa, com calendário próprio em português) e o
// arquivo (arrastar e soltar, sem o "Choose File"). Documentados em docs/PAINEL-COMPONENTES.md.

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];
const iso = (a: number, m: number, d: number) => `${a}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
export const isoParaBr = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v.split("-").reverse().join("/") : "");
export function brParaIso(v: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v.trim());
  if (!m) return "";
  const [d, mes, a] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const data = new Date(Date.UTC(a, mes, d));
  return data.getUTCFullYear() === a && data.getUTCMonth() === mes && data.getUTCDate() === d ? iso(a, mes, d) : "";
}

/**
 * Data em português: digita-se dd/mm/aaaa (as barras entram sozinhas) ou escolhe-se no calendário. O valor é sempre
 * AAAA-MM-DD (ou vazio), como o banco espera. Teclado: setas mudam o dia no calendário, Enter escolhe, Esc fecha.
 */
export function CampoData({ valor, mudar, rotulo, id, className = "" }: { valor: string; mudar: (iso: string) => void; rotulo: string; id?: string; className?: string }) {
  const proprio = useId();
  const campoId = id ?? proprio;
  const [texto, setTexto] = useState(isoParaBr(valor));
  const [aberto, setAberto] = useState(false);
  const hoje = new Date();
  const base = valor ? new Date(`${valor}T12:00:00`) : hoje;
  const [mes, setMes] = useState({ a: base.getFullYear(), m: base.getMonth() });
  const [foco, setFoco] = useState(valor || iso(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()));
  const caixa = useRef<HTMLDivElement>(null);
  // Valor mudou por fora (formulário limpo, item aberto): o texto acompanha.
  const [anterior, setAnterior] = useState(valor);
  if (anterior !== valor) {
    setAnterior(valor);
    setTexto(isoParaBr(valor));
  }
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberto(false); };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  const digitar = (bruto: string) => {
    const so = bruto.replace(/\D/g, "").slice(0, 8);
    const comBarras = so.length > 4 ? `${so.slice(0, 2)}/${so.slice(2, 4)}/${so.slice(4)}` : so.length > 2 ? `${so.slice(0, 2)}/${so.slice(2)}` : so;
    setTexto(comBarras);
    if (!so) mudar("");
    else if (so.length === 8) {
      const v = brParaIso(comBarras);
      if (v) mudar(v);
    }
  };
  const invalido = texto.length === 10 && !brParaIso(texto);
  const primeiro = new Date(mes.a, mes.m, 1).getDay();
  const dias = new Date(mes.a, mes.m + 1, 0).getDate();
  const escolher = (v: string) => {
    mudar(v);
    setTexto(isoParaBr(v));
    setAberto(false);
  };
  const andar = (n: number) => {
    const d = new Date(`${foco}T12:00:00`);
    d.setDate(d.getDate() + n);
    const novo = iso(d.getFullYear(), d.getMonth(), d.getDate());
    setFoco(novo);
    setMes({ a: d.getFullYear(), m: d.getMonth() });
  };

  return (
    <div ref={caixa} className={`relative ${className}`}>
      <label htmlFor={campoId} className="block">{rotulo}</label>
      <div className="mt-1 flex">
        <input
          id={campoId}
          value={texto}
          onChange={(e) => digitar(e.target.value)}
          inputMode="numeric"
          placeholder="dd/mm/aaaa"
          aria-invalid={invalido}
          aria-describedby={invalido ? `${campoId}-erro` : undefined}
          className="painel-campo w-full min-w-0 border-2 border-r-0 border-ink bg-parchment-deep px-3 py-2 font-mono"
        />
        <button type="button" aria-label="Abrir o calendário" aria-expanded={aberto} onClick={() => setAberto((a) => !a)} className="cursor-pointer border-2 border-ink bg-parchment px-2.5 hover:text-oxblood">
          <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3.5" y="5" width="17" height="15" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></svg>
        </button>
      </div>
      {invalido && <p id={`${campoId}-erro`} role="alert" className="mt-1 text-sm text-oxblood">Data que não existe.</p>}
      {aberto && (
        <div
          role="dialog"
          aria-label="Calendário"
          className="absolute z-30 mt-1 w-72 border-2 border-ink bg-parchment p-3 shadow-lg"
          onKeyDown={(e) => {
            if (e.key === "Escape") setAberto(false);
            else if (e.key === "ArrowLeft") { e.preventDefault(); andar(-1); }
            else if (e.key === "ArrowRight") { e.preventDefault(); andar(1); }
            else if (e.key === "ArrowUp") { e.preventDefault(); andar(-7); }
            else if (e.key === "ArrowDown") { e.preventDefault(); andar(7); }
            else if (e.key === "Enter") { e.preventDefault(); escolher(foco); }
          }}
        >
          <div className="flex items-center justify-between">
            <button type="button" aria-label="Mês anterior" className="cursor-pointer px-2" onClick={() => setMes(({ a, m }) => (m === 0 ? { a: a - 1, m: 11 } : { a, m: m - 1 }))}>‹</button>
            <span className="font-semibold">{MESES[mes.m]} de {mes.a}</span>
            <button type="button" aria-label="Próximo mês" className="cursor-pointer px-2" onClick={() => setMes(({ a, m }) => (m === 11 ? { a: a + 1, m: 0 } : { a, m: m + 1 }))}>›</button>
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1 text-center text-xs">
            {SEMANA.map((d, i) => <span key={i} className="text-ink-soft" aria-hidden>{d}</span>)}
            {Array.from({ length: primeiro }, (_, i) => <span key={`v${i}`} />)}
            {Array.from({ length: dias }, (_, i) => {
              const v = iso(mes.a, mes.m, i + 1);
              const marcado = v === valor;
              const ehHoje = v === iso(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
              return (
                <button
                  key={v}
                  type="button"
                  autoFocus={v === foco}
                  tabIndex={v === foco ? 0 : -1}
                  aria-pressed={marcado}
                  aria-label={`${i + 1} de ${MESES[mes.m]} de ${mes.a}`}
                  onClick={() => escolher(v)}
                  className={`cursor-pointer py-1 ${marcado ? "bg-ink text-parchment" : ehHoje ? "border border-oxblood" : "hover:bg-parchment-deep"} ${v === foco ? "outline outline-2 outline-gold" : ""}`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <p className="mt-2 flex justify-between text-xs">
            <button type="button" className="cursor-pointer underline" onClick={() => escolher(iso(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()))}>Hoje</button>
            <button type="button" className="cursor-pointer underline" onClick={() => { mudar(""); setTexto(""); setAberto(false); }}>Sem data</button>
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Arquivo por arrastar e soltar (ou clique, ou teclado), com o texto do painel no lugar do "Choose File" do navegador.
 * Confere tipo e tamanho antes de entregar o arquivo.
 */
export function CampoArquivo({ aceita, maximoMb = 8, escolher, texto = "Arraste o arquivo para cá ou clique para escolher", dica, desligado = false, children }: { aceita: string; maximoMb?: number; escolher: (arquivo: File) => void; texto?: string; dica?: string; desligado?: boolean; children?: ReactNode }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [sobre, setSobre] = useState(false);
  const [erro, setErro] = useState("");
  const tipos = aceita.split(",").map((t) => t.trim());
  const conferir = (f: File | undefined) => {
    setErro("");
    if (!f) return;
    const ok = tipos.some((t) => (t.endsWith("/*") ? f.type.startsWith(t.slice(0, -1)) : t.startsWith(".") ? f.name.toLowerCase().endsWith(t) : f.type === t));
    if (!ok) return setErro("Tipo de arquivo que não serve aqui.");
    if (f.size > maximoMb * 1024 * 1024) return setErro(`O arquivo passa de ${maximoMb} MB.`);
    escolher(f);
  };
  return (
    <div>
      <button
        type="button"
        disabled={desligado}
        onClick={() => entrada.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setSobre(true); }}
        onDragLeave={() => setSobre(false)}
        onDrop={(e) => { e.preventDefault(); setSobre(false); if (!desligado) conferir(e.dataTransfer.files?.[0]); }}
        className={`flex w-full cursor-pointer flex-col items-center justify-center gap-1 border-2 border-dashed px-4 py-6 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${sobre ? "border-oxblood bg-parchment-deep" : "border-rule hover:border-ink"}`}
      >
        {children}
        <span className="font-semibold">{texto}</span>
        {dica && <span className="text-xs text-ink-soft">{dica}</span>}
      </button>
      <input ref={entrada} type="file" accept={aceita} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { conferir(e.target.files?.[0]); e.target.value = ""; }} />
      {erro && <p role="alert" className="mt-1 text-sm text-oxblood">{erro}</p>}
    </div>
  );
}
