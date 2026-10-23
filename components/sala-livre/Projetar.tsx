// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Markdown } from "../Markdown";
import { type Ferramenta, Gaveta, mmss, Quadro, useAgora } from "./Ferramentas";
import { CANAL, lerSalas, type Mensagem, roteiro, type Sala } from "./salas";

/** O relógio da tela atual: quanto passou e quanto era o planejado (vermelho quando passa). */
function TempoDaTela({ inicio, minutos, escuro = true }: { inicio: number; minutos: number; escuro?: boolean }) {
  const agora = useAgora();
  const passou = agora && inicio ? agora - inicio : 0;
  const estourou = minutos > 0 && passou > minutos * 60_000;
  return (
    <span className={`rounded px-2 py-0.5 font-mono tabular-nums ${estourou ? "bg-[#c21f16] text-white" : escuro ? "bg-white/10" : "bg-parchment-deep"}`} title="Tempo nesta tela">
      ⏱ {mmss(passou)}{minutos ? ` / ${minutos} min` : ""}
    </span>
  );
}

/** Projetar: uma tela por vez, grande, com setas do teclado, ferramentas, quadro, tela preta e modo apresentador. */
export function Projetar({ sala, lang, fechar }: { sala: Sala; lang: string; fechar: () => void }) {
  const lista = useMemo(() => roteiro(sala.corpo), [sala.corpo]);
  const [i, setI] = useState(-1);
  const [inicio, setInicio] = useState(0);
  const [gaveta, setGaveta] = useState(false);
  const [ferramenta, setFerramenta] = useState<Ferramenta>("tempo");
  const [quadro, setQuadro] = useState(false);
  const [preta, setPreta] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const canal = useRef<BroadcastChannel | null>(null);
  const estado = useRef({ i: -1, inicio: 0 });
  const ir = useCallback((n: number) => {
    const alvo = Math.max(-1, Math.min(lista.length - 1, n));
    if (alvo !== estado.current.i) {
      setI(alvo);
      setInicio(Date.now());
    }
    setPreta(false);
  }, [lista.length]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const c = new BroadcastChannel(CANAL);
    canal.current = c;
    c.onmessage = (e: MessageEvent<Mensagem>) => {
      const d = e.data;
      if (d?.sala !== sala.id) return;
      if (d.tipo === "ir") ir(d.i);
      if (d.tipo === "quem") c.postMessage({ tipo: "estado", sala: sala.id, ...estado.current } satisfies Mensagem);
    };
    return () => { c.close(); canal.current = null; };
  }, [sala.id, ir]);
  // Guarda onde a projeção está e conta para a janela do apresentador.
  useEffect(() => {
    estado.current = { i, inicio };
    canal.current?.postMessage({ tipo: "estado", sala: sala.id, i, inicio } satisfies Mensagem);
  }, [i, inicio, sala.id]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const escrevendo = e.target instanceof HTMLElement && (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable);
      if (escrevendo) return;
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") { e.preventDefault(); ir(i + 1); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") ir(i - 1);
      else if (e.key === "b" || e.key === "B" || e.key === ".") setPreta((p) => !p);
      else if (e.key === "Escape" && !document.fullscreenElement) fechar();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [i, ir, fechar]);

  const apresentador = () => window.open(`${window.location.pathname}?apresentador=${encodeURIComponent(sala.id)}`, "lucia-apresentador", "popup,width=1100,height=720");
  const atual = i >= 0 ? lista[i] : null;
  const botao = "cursor-pointer rounded border border-[#f4ecd8]/40 px-2 py-1 hover:bg-white/10";
  return (
    <div ref={caixa} className="fixed inset-0 z-50 flex flex-col bg-parchment">
      <div className="flex flex-wrap items-center gap-2 border-b-4 border-ink bg-[#17130e] px-4 py-2 font-sans text-sm text-[#f4ecd8]">
        <strong className="max-w-[30ch] truncate">{sala.titulo}</strong>
        {atual && <TempoDaTela inicio={inicio} minutos={atual.minutos} />}
        <span className="ml-auto font-mono">{i + 2} / {lista.length + 1}</span>
        <button type="button" onClick={() => setGaveta(!gaveta)} aria-pressed={gaveta} className={botao}>Ferramentas</button>
        <button type="button" onClick={() => setQuadro(!quadro)} aria-pressed={quadro} className={botao}>Quadro</button>
        <button type="button" onClick={() => setPreta(!preta)} aria-pressed={preta} className={botao} title="Tecla B">Tela preta</button>
        <button type="button" onClick={apresentador} className={botao} title="Abre uma segunda janela com notas, próxima tela e relógio">Apresentador</button>
        <button type="button" onClick={() => (document.fullscreenElement ? void document.exitFullscreen() : void caixa.current?.requestFullscreen?.().catch(() => undefined))} className={botao}>Tela cheia</button>
        <button type="button" onClick={fechar} className={botao}>Sair (Esc)</button>
      </div>
      <div className="flex h-1.5 bg-[#17130e]">
        {[-1, ...lista.map((_, k) => k)].map((k) => <button key={k} type="button" aria-label={k < 0 ? "Capa" : `Tela ${k + 2}: ${lista[k].titulo}`} onClick={() => ir(k)} className={`flex-1 cursor-pointer border-r border-[#17130e] ${k <= i ? "bg-[#c21f16]" : "bg-white/15"}`} />)}
      </div>
      <div className="relative min-h-0 flex-1">
        <div className="h-full overflow-y-auto px-6 py-8 text-[1.35rem]">
          <div className="mx-auto max-w-4xl">
            {!atual ? (
              <div className="flex min-h-[60vh] flex-col justify-center">
                <p className="font-mono text-sm uppercase tracking-[0.3em] text-oxblood">{sala.para}</p>
                <h1 className="mt-2 font-serif text-6xl font-semibold leading-tight">{sala.titulo}</h1>
                {sala.objetivo && <p className="mt-6 max-w-3xl text-2xl text-ink-soft">Hoje vamos: {sala.objetivo}</p>}
                {lista.some((t) => t.minutos) && <p className="mt-8 font-sans text-base text-ink-soft">{lista.map((t) => `${t.titulo}${t.minutos ? ` (${t.minutos} min)` : ""}`).join(" · ")}</p>}
              </div>
            ) : (
              <Markdown lang={lang}>{atual.texto}</Markdown>
            )}
          </div>
        </div>
        {quadro && <Quadro fechar={() => setQuadro(false)} />}
        <Gaveta sala={sala.id} aberta={gaveta} ferramenta={ferramenta} escolher={setFerramenta} fechar={() => setGaveta(false)} />
        {preta && <button type="button" aria-label="Voltar da tela preta" onClick={() => setPreta(false)} className="absolute inset-0 z-40 cursor-pointer bg-black" />}
      </div>
      <div className="flex justify-between gap-3 border-t-2 border-ink px-4 py-3 font-sans">
        <button type="button" disabled={i < 0} onClick={() => ir(i - 1)} className="cursor-pointer border-2 border-ink px-5 py-2 font-bold disabled:opacity-30">← Anterior</button>
        <p className="hidden self-center text-sm text-ink-soft sm:block">{atual ? atual.titulo : "Capa"}{i + 1 < lista.length ? ` · a seguir: ${lista[i + 1].titulo}` : ""}</p>
        <button type="button" disabled={i >= lista.length - 1} onClick={() => ir(i + 1)} className="cursor-pointer bg-ink px-5 py-2 font-bold text-parchment disabled:opacity-30">Próxima →</button>
      </div>
    </div>
  );
}

/**
 * A janela do apresentador: aberta ao lado, mostra a tela atual em miniatura, as notas do professor (linhas com %%),
 * a próxima tela, o relógio e o tempo planejado. Comanda a projeção pelo canal do navegador.
 */
export function Apresentador({ salaId, lang }: { salaId: string; lang: string }) {
  const [sala] = useState(() => lerSalas().find((s) => s.id === salaId) ?? null);
  const lista = useMemo(() => (sala ? roteiro(sala.corpo) : []), [sala]);
  const [i, setI] = useState(-1);
  const [inicio, setInicio] = useState(0);
  const [ligada, setLigada] = useState(false);
  const [comeco] = useState(() => Date.now());
  const canal = useRef<BroadcastChannel | null>(null);
  const agora = useAgora();
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const c = new BroadcastChannel(CANAL);
    canal.current = c;
    c.onmessage = (e: MessageEvent<Mensagem>) => {
      const d = e.data;
      if (d?.sala !== salaId || d.tipo !== "estado") return;
      setLigada(true);
      setI(d.i);
      setInicio(d.inicio);
    };
    c.postMessage({ tipo: "quem", sala: salaId } satisfies Mensagem);
    return () => { c.close(); canal.current = null; };
  }, [salaId]);
  const ir = (n: number) => {
    const alvo = Math.max(-1, Math.min(lista.length - 1, n));
    setI(alvo);
    setInicio(Date.now());
    canal.current?.postMessage({ tipo: "ir", sala: salaId, i: alvo } satisfies Mensagem);
  };
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") { e.preventDefault(); ir(i + 1); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") ir(i - 1);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });
  if (!sala) return <div className="fixed inset-0 z-50 grid place-items-center bg-parchment p-6 font-sans"><p>Esta sala não está neste navegador. Abra o modo apresentador pela própria projeção.</p></div>;
  const atual = i >= 0 ? lista[i] : null;
  const proxima = lista[i + 1];
  const planejado = lista.reduce((s, t) => s + t.minutos, 0);
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#17130e] font-sans text-[#f4ecd8]">
      <div className="flex flex-wrap items-center gap-3 border-b border-white/15 px-4 py-2 text-sm">
        <strong className="truncate">{sala.titulo}</strong>
        <span className={`rounded px-2 py-0.5 text-xs ${ligada ? "bg-[#1d6b3a]" : "bg-[#c21f16]"}`}>{ligada ? "ligado à projeção" : "abra a projeção na outra janela"}</span>
        <span className="ml-auto font-mono text-lg tabular-nums">{agora ? new Date(agora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}</span>
        <span className="font-mono tabular-nums" title="Desde que o apresentador abriu">aula: {mmss(agora ? agora - comeco : 0)}{planejado ? ` / ${planejado} min` : ""}</span>
      </div>
      <div className="grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-[3fr_2fr]">
        <section className="flex min-h-0 flex-col">
          <p className="flex items-center gap-3 text-xs uppercase tracking-widest text-[#f4ecd8]/60">Agora · tela {i + 2} de {lista.length + 1} {atual && <TempoDaTela inicio={inicio} minutos={atual.minutos} />}</p>
          <div className="mt-2 min-h-0 flex-1 overflow-y-auto rounded border-2 border-white/20 bg-parchment p-5 text-ink">
            {atual ? <Markdown lang={lang}>{atual.texto}</Markdown> : <><p className="font-mono text-xs uppercase text-oxblood">{sala.para}</p><h1 className="font-serif text-4xl font-semibold">{sala.titulo}</h1>{sala.objetivo && <p className="mt-3">Hoje vamos: {sala.objetivo}</p>}</>}
          </div>
        </section>
        <section className="flex min-h-0 flex-col gap-4">
          <div className="min-h-0 flex-1 overflow-y-auto rounded border-2 border-[#ffd27a]/60 p-4">
            <p className="text-xs uppercase tracking-widest text-[#ffd27a]">Notas desta tela</p>
            {atual?.notas.length ? <ul className="mt-2 list-disc space-y-2 pl-5 text-xl leading-snug">{atual.notas.map((n, k) => <li key={k}>{n}</li>)}</ul> : <p className="mt-2 text-sm text-[#f4ecd8]/60">Sem notas. Escreva linhas começando com %% no texto da sala: só você vê, aqui.</p>}
          </div>
          <div className="rounded border border-white/20 p-3">
            <p className="text-xs uppercase tracking-widest text-[#f4ecd8]/60">A seguir</p>
            <p className="mt-1 font-serif text-2xl">{proxima ? `${proxima.titulo}${proxima.minutos ? ` · ${proxima.minutos} min` : ""}` : "Fim da aula"}</p>
          </div>
          <ol className="max-h-40 overflow-y-auto text-sm">
            {lista.map((t, k) => <li key={k}><button type="button" onClick={() => ir(k)} className={`w-full cursor-pointer rounded px-2 py-1 text-left ${k === i ? "bg-[#c21f16] text-white" : "hover:bg-white/10"}`}>{k + 2}. {t.titulo}{t.minutos ? ` · ${t.minutos} min` : ""}</button></li>)}
          </ol>
        </section>
      </div>
      <div className="flex justify-between gap-3 border-t border-white/15 px-4 py-3">
        <button type="button" disabled={i < 0} onClick={() => ir(i - 1)} className="cursor-pointer rounded border-2 border-[#f4ecd8] px-6 py-2 font-bold disabled:opacity-30">← Anterior</button>
        <button type="button" disabled={i >= lista.length - 1} onClick={() => ir(i + 1)} className="cursor-pointer rounded bg-[#c21f16] px-8 py-2 font-bold text-white disabled:opacity-30">Próxima →</button>
      </div>
    </div>
  );
}
