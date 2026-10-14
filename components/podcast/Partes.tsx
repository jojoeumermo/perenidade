// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useState } from "react";
import type { Dict } from "@/i18n/types";
import { BackendError, hasBackend, rpc, useMe } from "@/lib/backend";
import { type Episodio, lerLegendas, relogio } from "@/lib/podcast";
import { radio, usePlayer } from "@/lib/radio";
import { L } from "../I18n";
import { faixaDoEpisodio, Ouvir } from "./Ouvir";

/** O tocador grande da página do episódio: o play, a forma da onda (clicável) e os capítulos. */
export function TocadorDoEpisodio({ e, programa, s }: { e: Episodio; programa: string; s: Dict["podcast"] }) {
  const { queue, index, time } = usePlayer();
  const atual = queue[index]?.id === `podcast:${e.id}`;
  const agora = atual ? time : 0;
  const total = e.duracao || 1;
  const picos = e.picos && e.picos.length > 0 ? e.picos : Array.from({ length: 120 }, (_, i) => 30 + 25 * Math.abs(Math.sin(i * 0.7)));
  const ir = (segundos: number) => (atual ? radio.seek(segundos) : radio.play([faixaDoEpisodio(e, programa)], 0, segundos));
  const capitulo = (e.capitulos ?? []).filter((c) => c.t <= agora).at(-1);

  return (
    <div className="mt-6">
      <div className="flex items-center gap-4">
        <Ouvir episodio={e} programa={programa} rotulo={s.listen} pausar={s.pause} grande />
        <div className="min-w-0 flex-1">
          <div className="relative h-14">
            <svg aria-hidden viewBox={`0 0 ${picos.length} 100`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
              <defs>
                <clipPath id={`onda-${e.id}`}>
                  <rect x="0" y="0" width={(agora / total) * picos.length} height="100" />
                </clipPath>
              </defs>
              {[false, true].map((tocado) => (
                <g key={String(tocado)} fill="currentColor" className={tocado ? "text-oxblood" : "text-ink/25"} clipPath={tocado ? `url(#onda-${e.id})` : undefined}>
                  {picos.map((valor, i) => {
                    const h = Math.max(6, valor);
                    return <rect key={i} x={i + 0.15} y={(100 - h) / 2} width={0.7} height={h} />;
                  })}
                </g>
              ))}
            </svg>
            <input
              type="range"
              min={0}
              max={total}
              step={1}
              value={agora}
              onChange={(ev) => ir(Number(ev.target.value))}
              aria-label={s.position}
              aria-valuetext={`${relogio(agora)} / ${relogio(total)}`}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </div>
          <p className="mt-1 flex justify-between font-mono text-xs tabular-nums text-ink-soft">
            <span>{relogio(agora)}</span>
            {capitulo && <span className="truncate px-2 text-ink" lang="pt-BR">{capitulo.titulo}</span>}
            <span>{relogio(total)}</span>
          </p>
        </div>
      </div>
      {(e.capitulos?.length ?? 0) > 0 && (
        <nav aria-label={s.chapters} className="mt-6">
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-gold">{s.chapters}</h2>
          <ol className="mt-2 divide-y divide-rule border-y border-rule font-sans text-sm" lang="pt-BR">
            {e.capitulos!.map((c, i) => {
              const ativo = atual && capitulo?.t === c.t;
              return (
                <li key={`${c.t}-${i}`}>
                  <button type="button" onClick={() => ir(c.t)} className={`flex w-full cursor-pointer items-baseline gap-3 py-2 text-left hover:text-oxblood ${ativo ? "font-semibold text-oxblood" : ""}`}>
                    <span className="w-16 shrink-0 font-mono text-xs tabular-nums text-ink-soft">{relogio(c.t)}</span>
                    <span>{c.titulo}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      )}
    </div>
  );
}

/**
 * Transcrição. Com legendas (tempo de cada fala), cada trecho é clicável e o que está tocando fica marcado;
 * dá para procurar uma palavra. Sem legendas, é o texto corrido.
 */
export function Transcricao({ e, programa, s }: { e: Episodio; programa: string; s: Dict["podcast"] }) {
  const { queue, index, time } = usePlayer();
  const atual = queue[index]?.id === `podcast:${e.id}`;
  const [busca, setBusca] = useState("");
  const trechos = useMemo(() => {
    const lidos = lerLegendas(e.legendas ?? "");
    // Junta falas curtas em parágrafos de uns 30 segundos: fica legível como texto e continua clicável.
    const blocos: { inicio: number; texto: string }[] = [];
    for (const trecho of lidos) {
      const ultimo = blocos.at(-1);
      if (ultimo && trecho.inicio - ultimo.inicio < 30) ultimo.texto += ` ${trecho.texto}`;
      else blocos.push({ inicio: trecho.inicio, texto: trecho.texto });
    }
    return blocos;
  }, [e.legendas]);
  const termo = busca.trim().toLowerCase();
  const ir = (segundos: number) => (atual ? radio.seek(segundos) : radio.play([faixaDoEpisodio(e, programa)], 0, segundos));

  if (trechos.length === 0) {
    const paragrafos = (e.transcricao ?? "").split(/\n{2,}/).filter((p) => p.trim());
    if (paragrafos.length === 0) return null;
    return (
      <div className="prose-lesson mt-4 max-h-[32rem] overflow-y-auto border-l-2 border-gold pl-4" lang="pt-BR">
        {paragrafos.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    );
  }

  const visiveis = termo ? trechos.filter((t) => t.texto.toLowerCase().includes(termo)) : trechos;
  const agora = atual ? trechos.filter((t) => t.inicio <= time).at(-1)?.inicio : undefined;
  return (
    <div className="mt-4">
      <label className="block max-w-sm font-sans text-sm">
        {s.searchTranscript}
        <input type="search" value={busca} onChange={(ev) => setBusca(ev.target.value)} className="mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2" />
      </label>
      <ol className="mt-4 max-h-[32rem] space-y-3 overflow-y-auto border-l-2 border-gold pl-4" lang="pt-BR">
        {visiveis.map((t) => (
          <li key={t.inicio} className={`grid grid-cols-[3.5rem_1fr] gap-3 ${agora === t.inicio ? "bg-parchment-deep" : ""}`}>
            <button type="button" onClick={() => ir(t.inicio)} className="cursor-pointer self-start pt-1 text-left font-mono text-xs tabular-nums text-oxblood underline-offset-2 hover:underline" aria-label={`${s.playFrom} ${relogio(t.inicio)}`}>
              {relogio(t.inicio)}
            </button>
            <p className="text-lg leading-relaxed">{t.texto}</p>
          </li>
        ))}
      </ol>
      {termo && visiveis.length === 0 && <p className="mt-3 font-sans text-sm text-ink-soft">{s.noMatch}</p>}
    </div>
  );
}

interface Resposta {
  id: string;
  corpo: string;
  autor: string;
  criado_em: string;
  da_equipe: boolean;
  oculto: boolean;
  retido: boolean;
}

/** A conversa do episódio. É uma conversa da Comunidade: as mesmas regras e a mesma mediação. */
export function Conversa({ topico, s }: { topico: string; s: Dict["podcast"] }) {
  const me = useMe();
  const [respostas, setRespostas] = useState<Resposta[] | null>(null);
  const [trancado, setTrancado] = useState(false);
  const [texto, setTexto] = useState("");
  const [aviso, setAviso] = useState("");
  const [volta, setVolta] = useState(0);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!hasBackend) return;
    let cancelado = false;
    rpc<{ respostas: Resposta[]; trancado: boolean }>("topico_ver", { p_id: topico })
      .then((t) => {
        if (cancelado) return;
        setRespostas(t.respostas);
        setTrancado(t.trancado);
      })
      .catch(() => {
        if (!cancelado) setRespostas([]);
      });
    return () => {
      cancelado = true;
    };
  }, [topico, volta, me.status]);

  if (!hasBackend || respostas === null) return null;

  async function responder() {
    setOcupado(true);
    setAviso("");
    try {
      const r = await rpc<{ retido: boolean; bloqueado: boolean }>("responder", { p_topico: topico, p_corpo: texto });
      setTexto("");
      setAviso(r.bloqueado ? s.commentBlocked : r.retido ? s.commentHeld : "");
      setVolta((v) => v + 1);
    } catch (erro) {
      const codigo = erro instanceof BackendError ? erro.code : "";
      setAviso(codigo === "muitos_pedidos" ? s.tooMany : codigo === "topico_trancado" ? s.commentsClosed : s.failed);
    } finally {
      setOcupado(false);
    }
  }

  const data = (iso: string) => new Date(iso).toLocaleDateString(document.documentElement.lang || "pt-BR", { day: "numeric", month: "short" });
  return (
    <div className="mt-4 font-sans">
      {respostas.length === 0 && <p className="text-ink-soft">{s.commentsEmpty}</p>}
      <ul className="space-y-4">
        {respostas.map((r) => (
          <li key={r.id} className={`border-l-2 pl-4 ${r.da_equipe ? "border-oxblood" : "border-rule"} ${r.oculto ? "opacity-60" : ""}`}>
            <p className="text-xs text-ink-soft">
              <strong className="text-ink">{r.autor || "—"}</strong>
              {r.da_equipe && <span className="ml-2 bg-oxblood px-1.5 py-0.5 text-[0.65rem] font-bold uppercase text-parchment">{s.team}</span>} · {data(r.criado_em)}
              {r.retido && <span className="ml-2 text-oxblood">{s.waitingModeration}</span>}
            </p>
            <p className="mt-1 whitespace-pre-line text-base leading-relaxed">{r.corpo}</p>
          </li>
        ))}
      </ul>
      {trancado ? (
        <p className="mt-6 text-sm text-ink-soft">{s.commentsClosed}</p>
      ) : me.status === "in" ? (
        <form className="mt-6 space-y-2 text-sm" onSubmit={(ev) => { ev.preventDefault(); void responder(); }}>
          <label className="block">
            {s.commentLabel}
            <textarea value={texto} onChange={(ev) => setTexto(ev.target.value)} rows={3} maxLength={8000} required minLength={2} className="mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2" />
          </label>
          <button type="submit" disabled={ocupado || texto.trim().length < 2} className="cursor-pointer bg-ink px-5 py-2.5 font-semibold text-parchment hover:bg-oxblood disabled:opacity-50">{s.comment}</button>
          <p className="text-xs text-ink-soft">{s.commentRules}</p>
        </form>
      ) : (
        <p className="mt-6 text-sm">
          <L href="/entrar" className="font-semibold underline hover:text-oxblood">{s.signIn}</L> {s.signInToComment}
        </p>
      )}
      <p role="status" className="mt-2 min-h-5 text-sm text-oxblood">{aviso}</p>
    </div>
  );
}

/** Compartilhar: o menu do próprio aparelho, quando existe; senão, copia o endereço. */
export function Compartilhar({ titulo, s }: { titulo: string; s: Dict["podcast"] }) {
  const [copiado, setCopiado] = useState(false);
  async function compartilhar() {
    const url = window.location.href.split("#")[0];
    if (navigator.share) {
      try {
        await navigator.share({ title: titulo, url });
        return;
      } catch {
        // a pessoa fechou o menu: segue para copiar
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      window.prompt(s.copyLink, url);
    }
  }
  return (
    <button type="button" onClick={() => void compartilhar()} className="cursor-pointer border-2 border-ink px-4 py-2 font-sans text-sm font-semibold hover:border-oxblood hover:text-oxblood">
      {copiado ? s.copied : s.share}
    </button>
  );
}

/** Marca que a pessoa já viu os episódios novos (apaga o pontinho do menu). */
export function MarcarVisto({ ultimo }: { ultimo: string | null }) {
  useEffect(() => {
    if (!ultimo) return;
    try {
      localStorage.setItem("lucia:podcast-visto", ultimo);
      window.dispatchEvent(new Event("lucia:podcast-visto"));
    } catch {
      // sem armazenamento: o pontinho volta na próxima visita
    }
  }, [ultimo]);
  return null;
}
