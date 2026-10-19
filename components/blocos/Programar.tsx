// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { WorkspaceSvg } from "blockly/core";
import { type CategoriaDeBlocos, lerProgramacao, lerRodar, saidaConfere } from "@/lib/interativos-mais";
import { useI18n } from "../I18n";

// Programação por blocos (Blockly) e código para rodar (Python ou JavaScript). O programa roda numa linha de execução
// separada (Worker), sem acesso à página nem à conta, e é interrompido se demorar demais (laço sem fim).

const caixa = "no-print my-6 border-l-2 border-gold bg-parchment-deep p-4 font-sans text-sm";
const botao = "cursor-pointer bg-ink px-4 py-2 font-medium text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50";
const claro = "cursor-pointer border-2 border-ink px-3 py-1 font-medium hover:border-oxblood hover:text-oxblood";
const LIMITE_MS = 6000;

type Linha = { texto: string; erro: boolean };

/** Roda JavaScript num Worker descartável: console.log vira saída; erro e tempo esgotado também. */
function rodarJs(codigo: string, aoSair: (l: Linha) => void, aoFim: () => void) {
  const fonte = `let __laco=200000;const __p=(e)=>(...m)=>postMessage({t:e,x:m.map((v)=>{try{return typeof v==="object"?JSON.stringify(v):String(v)}catch(_){return String(v)}}).join(" ")});self.console={log:__p("o"),info:__p("o"),warn:__p("e"),error:__p("e")};self.alert=__p("o");self.prompt=()=>null;(async()=>{try{${codigo}\n}catch(e){postMessage({t:"e",x:e==="LACO"?"__LACO__":String(e&&e.message||e)})}postMessage({t:"fim"})})();`;
  const url = URL.createObjectURL(new Blob([fonte], { type: "text/javascript" }));
  const w = new Worker(url);
  const relogio = window.setTimeout(() => {
    w.terminate();
    aoSair({ texto: "__TEMPO__", erro: true });
    aoFim();
  }, LIMITE_MS);
  w.onmessage = (ev: MessageEvent<{ t: string; x?: string }>) => {
    if (ev.data.t === "fim") {
      window.clearTimeout(relogio);
      w.terminate();
      URL.revokeObjectURL(url);
      aoFim();
    } else aoSair({ texto: ev.data.x ?? "", erro: ev.data.t === "e" });
  };
  w.onerror = (ev) => {
    ev.preventDefault();
    window.clearTimeout(relogio);
    w.terminate();
    aoSair({ texto: ev.message || "Error", erro: true });
    aoFim();
  };
  return () => {
    window.clearTimeout(relogio);
    w.terminate();
  };
}

/** Python pelo mesmo interpretador da IDE (Pyodide, no próprio site). */
function rodarPython(codigo: string, aoSair: (l: Linha) => void, aoFim: () => void, aoCarregar: () => void) {
  const w = new Worker("/workers/python.js");
  let relogio = 0;
  w.onmessage = (ev: MessageEvent<{ type: string; text?: string }>) => {
    const { type, text = "" } = ev.data;
    if (type === "ready") {
      aoCarregar();
      relogio = window.setTimeout(() => {
        w.terminate();
        aoSair({ texto: "__TEMPO__", erro: true });
        aoFim();
      }, LIMITE_MS * 2);
    } else if (type === "done") {
      window.clearTimeout(relogio);
      w.terminate();
      aoFim();
    } else aoSair({ texto: text.replace(/\n$/, ""), erro: type === "err" });
  };
  w.onerror = () => {
    window.clearTimeout(relogio);
    w.terminate();
    aoSair({ texto: "Python", erro: true });
    aoFim();
  };
  w.postMessage({ code: codigo, input: "" });
  return () => {
    window.clearTimeout(relogio);
    w.terminate();
  };
}

function Saida({ linhas, esperado }: { linhas: Linha[]; esperado: string | null }) {
  const { t } = useI18n();
  const texto = linhas.filter((l) => !l.erro).map((l) => l.texto).join("\n");
  const traduz = (l: Linha) => (l.texto === "__TEMPO__" || l.texto === "__LACO__" ? t.blocks.timeout : l.texto);
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{t.blocks.output}</p>
      <pre className="mt-1 max-h-64 min-h-[3rem] overflow-auto whitespace-pre-wrap border-2 border-ink bg-[#14110d] p-3 font-mono text-[13px] text-[#efe4c8]" aria-live="polite">
        {linhas.map((l, i) => (
          <span key={i} className={l.erro ? "text-[#ff9b8f]" : undefined}>{traduz(l)}{"\n"}</span>
        ))}
      </pre>
      {esperado !== null && linhas.length > 0 && (
        <p role="status" className={`mt-2 font-semibold ${saidaConfere(texto, esperado) ? "text-ok" : "text-oxblood"}`}>{saidaConfere(texto, esperado) ? t.blocks.outputMatches : t.blocks.outputDiffers}</p>
      )}
      {esperado !== null && (
        <details className="mt-1 text-xs">
          <summary className="cursor-pointer">{t.blocks.expectedOutput}</summary>
          <pre className="mt-1 whitespace-pre-wrap font-mono">{esperado}</pre>
        </details>
      )}
    </div>
  );
}

// ───────────── Código para rodar ─────────────

export function Rodar({ spec }: { spec: string }) {
  const { t } = useI18n();
  const dados = useMemo(() => lerRodar(spec), [spec]);
  const [codigo, setCodigo] = useState(dados.codigo);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [estado, setEstado] = useState<"parado" | "carregando" | "rodando">("parado");
  const parar = useRef<() => void>(() => {});
  useEffect(() => () => parar.current(), []);

  function rodar() {
    setLinhas([]);
    const sair = (l: Linha) => setLinhas((ls) => (ls.length > 1000 ? ls : [...ls, l]));
    const fim = () => setEstado("parado");
    if (dados.linguagem === "python") {
      setEstado("carregando");
      parar.current = rodarPython(codigo, sair, fim, () => setEstado("rodando"));
    } else {
      setEstado("rodando");
      parar.current = rodarJs(codigo, sair, fim);
    }
  }
  if (!dados.codigo) return <pre className="text-sm">{spec}</pre>;
  return (
    <div className={caixa}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{dados.linguagem === "python" ? "Python" : "JavaScript"}</p>
        {codigo !== dados.codigo && <button type="button" className="cursor-pointer text-xs underline" onClick={() => setCodigo(dados.codigo)}>{t.blocks.restart}</button>}
      </div>
      <textarea
        value={codigo}
        onChange={(e) => setCodigo(e.target.value)}
        spellCheck={false}
        aria-label={t.blocks.code}
        rows={Math.min(18, Math.max(4, codigo.split("\n").length + 1))}
        onKeyDown={(e) => {
          if (e.key === "Tab" && !e.shiftKey) {
            e.preventDefault();
            const el = e.currentTarget;
            const at = el.selectionStart;
            setCodigo(codigo.slice(0, at) + "    " + codigo.slice(el.selectionEnd));
            requestAnimationFrame(() => el.setSelectionRange(at + 4, at + 4));
          } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            if (estado === "parado") rodar();
          }
        }}
        className="mt-1 w-full border-2 border-ink bg-parchment px-3 py-2 font-mono text-[13px] leading-relaxed"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" className={botao} disabled={estado !== "parado"} onClick={rodar}>{estado === "carregando" ? t.blocks.loadingPython : `▶ ${t.blocks.run}`}</button>
        {estado !== "parado" && <button type="button" className={claro} onClick={() => { parar.current(); setEstado("parado"); }}>{t.blocks.stop}</button>}
        <span className="text-xs text-ink-soft">Ctrl + Enter</span>
      </div>
      {(linhas.length > 0 || estado === "rodando") && <Saida linhas={linhas} esperado={dados.esperado} />}
    </div>
  );
}

// ───────────── Programação por blocos (Blockly) ─────────────

const CATEGORIAS: Record<CategoriaDeBlocos, { cor: string; blocos: object[] | string }> = {
  logica: { cor: "210", blocos: [{ kind: "block", type: "controls_if" }, { kind: "block", type: "logic_compare" }, { kind: "block", type: "logic_operation" }, { kind: "block", type: "logic_negate" }, { kind: "block", type: "logic_boolean" }] },
  lacos: {
    cor: "120",
    blocos: [
      { kind: "block", type: "controls_repeat_ext", inputs: { TIMES: { shadow: { type: "math_number", fields: { NUM: 5 } } } } },
      { kind: "block", type: "controls_whileUntil" },
      { kind: "block", type: "controls_for", inputs: { FROM: { shadow: { type: "math_number", fields: { NUM: 1 } } }, TO: { shadow: { type: "math_number", fields: { NUM: 10 } } }, BY: { shadow: { type: "math_number", fields: { NUM: 1 } } } } },
      { kind: "block", type: "controls_forEach" },
      { kind: "block", type: "controls_flow_statements" },
    ],
  },
  matematica: {
    cor: "230",
    blocos: [
      { kind: "block", type: "math_number" },
      { kind: "block", type: "math_arithmetic", inputs: { A: { shadow: { type: "math_number", fields: { NUM: 1 } } }, B: { shadow: { type: "math_number", fields: { NUM: 1 } } } } },
      { kind: "block", type: "math_single" },
      { kind: "block", type: "math_number_property" },
      { kind: "block", type: "math_round" },
      { kind: "block", type: "math_modulo" },
      { kind: "block", type: "math_random_int", inputs: { FROM: { shadow: { type: "math_number", fields: { NUM: 1 } } }, TO: { shadow: { type: "math_number", fields: { NUM: 100 } } } } },
    ],
  },
  texto: { cor: "160", blocos: [{ kind: "block", type: "text_print", inputs: { TEXT: { shadow: { type: "text", fields: { TEXT: "Olá!" } } } } }, { kind: "block", type: "text" }, { kind: "block", type: "text_join" }, { kind: "block", type: "text_length" }, { kind: "block", type: "text_isEmpty" }, { kind: "block", type: "text_changeCase" }] },
  listas: { cor: "260", blocos: [{ kind: "block", type: "lists_create_with" }, { kind: "block", type: "lists_create_empty" }, { kind: "block", type: "lists_repeat" }, { kind: "block", type: "lists_length" }, { kind: "block", type: "lists_getIndex" }, { kind: "block", type: "lists_setIndex" }] },
  variaveis: { cor: "330", blocos: "VARIABLE" },
  funcoes: { cor: "290", blocos: "PROCEDURE" },
};

const chaveDoBloco = (spec: string) => {
  let h = 0;
  for (const c of spec) h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0;
  return `lucia:blocos:${(h >>> 0).toString(36)}`;
};

export function Programacao({ spec }: { spec: string }) {
  const { t, lang } = useI18n();
  const dados = useMemo(() => lerProgramacao(spec), [spec]);
  const area = useRef<HTMLDivElement>(null);
  const espaco = useRef<WorkspaceSvg | null>(null);
  const geradores = useRef<{ js: (ws: WorkspaceSvg) => string; mostrarJs: (ws: WorkspaceSvg) => string; py: (ws: WorkspaceSvg) => string } | null>(null);
  const [pronto, setPronto] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [rodando, setRodando] = useState(false);
  const [verCodigo, setVerCodigo] = useState<"" | "python" | "javascript">("");
  const [codigoVisto, setCodigoVisto] = useState("");
  const parar = useRef<() => void>(() => {});
  const nomes: Record<CategoriaDeBlocos, string> = { logica: t.blocks.catLogic, lacos: t.blocks.catLoops, matematica: t.blocks.catMath, texto: t.blocks.catText, listas: t.blocks.catLists, variaveis: t.blocks.catVariables, funcoes: t.blocks.catFunctions };
  const nomesRef = useRef(nomes);
  useEffect(() => {
    nomesRef.current = nomes;
  });

  useEffect(() => {
    let vivo = true;
    let largura: ResizeObserver | null = null;
    const mensagens = lang === "pt" ? import("blockly/msg/pt-br") : lang === "es" ? import("blockly/msg/es") : lang === "fr" ? import("blockly/msg/fr") : lang === "ru" ? import("blockly/msg/ru") : lang === "zh" ? import("blockly/msg/zh-hans") : import("blockly/msg/en");
    void Promise.all([import("blockly/core"), import("blockly/blocks"), import("blockly/javascript"), import("blockly/python"), mensagens])
      .then(([Blockly, , js, py, msg]) => {
        if (!vivo || !area.current) return;
        Blockly.setLocale(msg as unknown as { [chave: string]: string });
        const { javascriptGenerator, Order } = js;
        const { pythonGenerator } = py;
        // "imprimir" escreve na saída da aula, não numa janela de alerta.
        javascriptGenerator.forBlock.text_print = (bloco, g) => `console.log(${g.valueToCode(bloco, "TEXT", Order.NONE) || "''"});\n`;
        const ws = Blockly.inject(area.current, {
          toolbox: { kind: "categoryToolbox", contents: dados.categorias.map((c) => ({ kind: "category", name: nomesRef.current[c], colour: CATEGORIAS[c].cor, ...(typeof CATEGORIAS[c].blocos === "string" ? { custom: CATEGORIAS[c].blocos } : { contents: CATEGORIAS[c].blocos }) })) },
          media: "/blockly/",
          sounds: false,
          trashcan: true,
          zoom: { controls: true, wheel: false, startScale: 0.9, maxScale: 2, minScale: 0.4 },
          move: { scrollbars: true, drag: true, wheel: false },
          renderer: "zelos",
        });
        espaco.current = ws;
        try {
          const salvo = localStorage.getItem(chaveDoBloco(spec));
          if (salvo) Blockly.serialization.workspaces.load(JSON.parse(salvo), ws);
        } catch {
          /* começa vazio */
        }
        ws.addChangeListener(() => {
          try {
            localStorage.setItem(chaveDoBloco(spec), JSON.stringify(Blockly.serialization.workspaces.save(ws)));
          } catch {
            /* sem espaço no aparelho: segue sem guardar */
          }
        });
        geradores.current = {
          js: (w) => {
            javascriptGenerator.INFINITE_LOOP_TRAP = 'if (--__laco < 0) throw "LACO";\n';
            const codigo = javascriptGenerator.workspaceToCode(w);
            javascriptGenerator.INFINITE_LOOP_TRAP = null;
            return codigo;
          },
          mostrarJs: (w) => javascriptGenerator.workspaceToCode(w),
          py: (w) => pythonGenerator.workspaceToCode(w),
        };
        largura = new ResizeObserver(() => Blockly.svgResize(ws));
        largura.observe(area.current);
        setPronto(true);
      })
      .catch(() => vivo && setFalhou(true));
    return () => {
      vivo = false;
      largura?.disconnect();
      espaco.current?.dispose();
      espaco.current = null;
      parar.current();
    };
  }, [spec, dados.categorias, lang]);

  function rodar() {
    const ws = espaco.current;
    const g = geradores.current;
    if (!ws || !g) return;
    setLinhas([]);
    setRodando(true);
    parar.current = rodarJs(g.js(ws), (l) => setLinhas((ls) => (ls.length > 1000 ? ls : [...ls, l])), () => setRodando(false));
  }
  function mostrar(qual: "python" | "javascript") {
    const ws = espaco.current;
    const g = geradores.current;
    if (!ws || !g) return;
    if (verCodigo === qual) return setVerCodigo("");
    setCodigoVisto(qual === "python" ? g.py(ws) : g.mostrarJs(ws));
    setVerCodigo(qual);
  }

  return (
    <div className={caixa}>
      {dados.objetivo && (
        <p className="mb-2 font-serif text-base">
          <strong className="font-sans text-xs uppercase tracking-wide text-oxblood">{t.blocks.goal} </strong>
          {dados.objetivo}
        </p>
      )}
      {falhou ? <p className="text-oxblood">{t.blocks.failed}</p> : <div ref={area} className="h-[420px] w-full border-2 border-ink bg-parchment" aria-label={t.blocks.blockProgramming} />}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" className={botao} disabled={!pronto || rodando} onClick={rodar}>▶ {t.blocks.run}</button>
        {rodando && <button type="button" className={claro} onClick={() => { parar.current(); setRodando(false); }}>{t.blocks.stop}</button>}
        <button type="button" className={claro} disabled={!pronto} aria-pressed={verCodigo === "python"} onClick={() => mostrar("python")}>{t.blocks.seeCode} Python</button>
        <button type="button" className={claro} disabled={!pronto} aria-pressed={verCodigo === "javascript"} onClick={() => mostrar("javascript")}>{t.blocks.seeCode} JavaScript</button>
      </div>
      {verCodigo && <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap border border-rule bg-parchment p-3 font-mono text-[13px]">{codigoVisto || "—"}</pre>}
      {(linhas.length > 0 || rodando) && <Saida linhas={linhas} esperado={dados.esperado} />}
    </div>
  );
}
