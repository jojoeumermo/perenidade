// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BackendError, hasBackend, rpc } from "@/lib/backend";
import { arquivoPublico, type Capitulo, relogio } from "@/lib/podcast";
import { useHydrated } from "@/lib/storage";
import { L } from "../I18n";
import { Markdown } from "../Markdown";
import { Capa } from "./Capa";

interface Rascunho {
  id: string;
  titulo: string;
  resumo: string;
  roteiro: string;
  notas: string;
  capa: string;
  status: string;
  audio: string;
  externo: string;
  duracao: number;
  capitulos: Capitulo[];
  transcricao: string;
  pendencias: string[];
  pode_comentar: boolean;
  pode_aprovar: boolean;
  comentarios: { id: string; texto: string; tempo: number | null; resolvido: boolean; autor: string; criado_em: string }[];
}

const etapas: Record<string, string> = { ideia: "ideia", roteiro: "roteiro", gravacao: "gravação", edicao: "edição", revisao: "esperando aprovação", aprovado: "aprovado", publicado: "no ar" };

/**
 * Rascunho para quem aprova, aberto pelo link privado: ouve, lê o roteiro e as notas e, com conta da equipe, comenta com
 * a marcação de tempo e aprova ou devolve. O painel é só em português, e esta página também.
 */
export function RevisaoPrivada() {
  const hydrated = useHydrated();
  const token = useMemo(() => (hydrated ? (new URLSearchParams(window.location.search).get("t") ?? "") : null), [hydrated]);
  const [r, setR] = useState<Rascunho | null | "erro">(null);
  const [texto, setTexto] = useState("");
  const [comTempo, setComTempo] = useState(true);
  const [nota, setNota] = useState("");
  const [aviso, setAviso] = useState("");
  const [volta, setVolta] = useState(0);
  const audio = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!token || !hasBackend) return;
    let cancelado = false;
    rpc<Rascunho>("podcast_revisao", { p_token: token })
      .then((valor) => {
        if (!cancelado) setR(valor);
      })
      .catch(() => {
        if (!cancelado) setR("erro");
      });
    return () => {
      cancelado = true;
    };
  }, [token, volta]);

  if (token === "" || r === "erro") return <p className="mt-8 border-l-4 border-oxblood pl-4 text-lg">Este link de revisão não existe ou já venceu. Peça um novo a quem produz o episódio.</p>;
  if (!r) return <p className="mt-8 font-mono text-xs text-ink-soft">Carregando…</p>;

  const fonte = r.audio ? arquivoPublico(r.audio) : r.externo;
  const ir = (t: number) => {
    if (!audio.current) return;
    audio.current.currentTime = t;
    void audio.current.play();
  };

  async function comentar() {
    setAviso("");
    try {
      await rpc("podcast_comentar", { p_episodio: (r as Rascunho).id, p_texto: texto, p_tempo: comTempo && audio.current ? Math.floor(audio.current.currentTime) : null });
      setTexto("");
      setVolta((v) => v + 1);
    } catch {
      setAviso("Não deu certo. Confira se você entrou com a conta da equipe.");
    }
  }

  async function decidir(aprovar: boolean) {
    setAviso("");
    try {
      await rpc("podcast_aprovar", { p_id: (r as Rascunho).id, p_aprovar: aprovar, p_nota: nota });
      setNota("");
      setAviso(aprovar ? "Aprovado. Quem produz já foi avisado." : "Devolvido para a edição com o seu pedido.");
      setVolta((v) => v + 1);
    } catch (erro) {
      const codigo = erro instanceof BackendError ? erro.code : "";
      setAviso(codigo === "aprovar_o_proprio" ? "Você não pode aprovar o que você mesmo enviou." : codigo === "invalido:nota" ? "Escreva o que precisa mudar." : "Não deu certo.");
    }
  }

  return (
    <div className="mt-8 grid gap-10 font-sans lg:grid-cols-[minmax(0,1fr)_22rem]" lang="pt-BR">
      <div>
        <div className="grid gap-5 sm:grid-cols-[10rem_1fr]">
          <Capa caminho={r.capa} titulo={r.titulo} className="border-2 border-ink" />
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-oxblood">Rascunho privado · {etapas[r.status] ?? r.status}</p>
            <h2 className="mt-2 font-serif text-3xl font-semibold leading-tight">{r.titulo}</h2>
            <p className="mt-2 text-ink-soft">{r.resumo}</p>
          </div>
        </div>
        {fonte ? (
          <audio ref={audio} controls preload="metadata" src={fonte} className="mt-6 w-full" />
        ) : (
          <p className="mt-6 border-l-2 border-gold pl-3 text-ink-soft">Ainda não há áudio final neste episódio.</p>
        )}
        {r.capitulos.length > 0 && (
          <ol className="mt-4 divide-y divide-rule border-y border-rule text-sm">
            {r.capitulos.map((c) => (
              <li key={c.t}>
                <button type="button" onClick={() => ir(c.t)} className="flex w-full cursor-pointer gap-3 py-1.5 text-left hover:text-oxblood">
                  <span className="w-14 font-mono text-xs text-ink-soft">{relogio(c.t)}</span>
                  {c.titulo}
                </button>
              </li>
            ))}
          </ol>
        )}
        <details className="mt-8" open>
          <summary className="cursor-pointer font-mono text-xs uppercase tracking-[0.2em] text-gold">Roteiro</summary>
          <div className="mt-3">
            <Markdown lang="pt">{r.roteiro || "_Sem roteiro escrito._"}</Markdown>
          </div>
        </details>
        <details className="mt-6">
          <summary className="cursor-pointer font-mono text-xs uppercase tracking-[0.2em] text-gold">Notas do episódio</summary>
          <div className="mt-3">
            <Markdown lang="pt">{r.notas || "_Sem notas ainda._"}</Markdown>
          </div>
        </details>
        {r.transcricao && (
          <details className="mt-6">
            <summary className="cursor-pointer font-mono text-xs uppercase tracking-[0.2em] text-gold">Transcrição</summary>
            <p className="mt-3 max-h-96 overflow-y-auto whitespace-pre-line border-l-2 border-gold pl-3">{r.transcricao}</p>
          </details>
        )}
      </div>
      <aside className="space-y-6 text-sm">
        {r.pendencias.length > 0 && (
          <div className="border-l-4 border-gold pl-3">
            <p className="font-semibold">Ainda falta para publicar</p>
            <p className="text-ink-soft">{r.pendencias.join(", ")}</p>
          </div>
        )}
        <section>
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Comentários ({r.comentarios.length})</h2>
          <ul className="mt-2 space-y-3">
            {r.comentarios.map((c) => (
              <li key={c.id} className={`border-l-2 pl-3 ${c.resolvido ? "border-rule text-ink-soft line-through" : "border-oxblood"}`}>
                <p className="text-xs text-ink-soft">
                  <strong className="text-ink">{c.autor}</strong>
                  {c.tempo !== null && (
                    <button type="button" onClick={() => ir(c.tempo ?? 0)} className="ml-2 cursor-pointer font-mono text-oxblood underline">
                      {relogio(c.tempo)}
                    </button>
                  )}
                </p>
                <p className="whitespace-pre-line">{c.texto}</p>
              </li>
            ))}
          </ul>
          {r.pode_comentar ? (
            <form className="mt-4 space-y-2" onSubmit={(e) => { e.preventDefault(); void comentar(); }}>
              <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} maxLength={2000} required placeholder="O que precisa mudar?" className="w-full border-2 border-ink bg-parchment-deep px-3 py-2" />
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={comTempo} onChange={(e) => setComTempo(e.target.checked)} className="h-4 w-4" />
                Marcar o tempo em que o áudio está agora
              </label>
              <button type="submit" disabled={!texto.trim()} className="cursor-pointer bg-ink px-4 py-2 font-semibold text-parchment hover:bg-oxblood disabled:opacity-50">Comentar</button>
            </form>
          ) : (
            <p className="mt-4 text-ink-soft">
              Para comentar ou aprovar, <L href="/entrar" className="underline hover:text-oxblood">entre com a conta da equipe</L> e abra este link de novo.
            </p>
          )}
        </section>
        {r.pode_aprovar && (
          <section className="border-4 border-ink p-4">
            <h2 className="font-sans text-lg font-black uppercase italic">Supervisão</h2>
            <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={3} maxLength={2000} placeholder="Para devolver, diga o que precisa mudar. Para aprovar, uma nota é opcional." className="mt-2 w-full border-2 border-ink bg-parchment-deep px-3 py-2" />
            <p className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => void decidir(true)} className="cursor-pointer bg-ok px-4 py-2 font-semibold text-parchment">Aprovar</button>
              <button type="button" onClick={() => void decidir(false)} className="cursor-pointer border-2 border-oxblood px-4 py-2 font-semibold text-oxblood">Devolver com ajuste</button>
            </p>
          </section>
        )}
        <p role="status" className="min-h-5 text-oxblood">{aviso}</p>
      </aside>
    </div>
  );
}
