// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import "@/styles/escola-avaliacao.css";
import { useEffect, useRef, useState } from "react";
import { fill } from "@/i18n/config";
import type { TextosDaAvaliacao } from "@/i18n/escola/avaliacao";
import { apagarExplicacao, BASE_DOS_AUDIOS, type Explicacao, explicacaoDe, gravarExplicacao, MAX_EXPLICACAO, SEGUNDOS_DE_GRAVACAO } from "@/lib/escola/avaliacao";

// ───────────── Os áudios no IndexedDB "lucia-explicacoes" (fora da cópia de segurança; o "apagar meus dados" apaga) ─────────────

const LOJA = "audios";

function abrirBase(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const pedido = indexedDB.open(BASE_DOS_AUDIOS, 1);
      pedido.onupgradeneeded = () => {
        if (!pedido.result.objectStoreNames.contains(LOJA)) pedido.result.createObjectStore(LOJA);
      };
      pedido.onsuccess = () => resolve(pedido.result);
      pedido.onerror = () => resolve(null);
      pedido.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function naBase<T>(modo: IDBTransactionMode, fazer: (loja: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  const base = await abrirBase();
  if (!base) return null;
  return new Promise((resolve) => {
    try {
      const pedido = fazer(base.transaction(LOJA, modo).objectStore(LOJA));
      pedido.onsuccess = () => {
        resolve(pedido.result ?? null);
        base.close();
      };
      pedido.onerror = () => {
        resolve(null);
        base.close();
      };
    } catch {
      resolve(null);
      base.close();
    }
  });
}

const lerAudio = (aula: string) => naBase<unknown>("readonly", (l) => l.get(aula)).then((v) => (v instanceof Blob ? v : null));
const guardarAudio = (aula: string, audio: Blob) => naBase("readwrite", (l) => l.put(audio, aula));
const apagarAudio = (aula: string) => naBase("readwrite", (l) => l.delete(aula));

const podeGravar = () => typeof window !== "undefined" && typeof window.MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

/**
 * "Explique com suas palavras" (E4-13, R1-34), no fim da aula: um campo de até 1000 caracteres ou uma gravação de até
 * 2 minutos (MediaRecorder, sem reconhecimento de fala). O texto vai para "lucia:escola:explicacoes" e entra na cópia
 * de segurança; o áudio vai para o IndexedDB "lucia-explicacoes", fora da cópia por causa do tamanho. Nada vai para
 * servidor. O que a pessoa explicou volta da outra vez que ela abrir a aula e na revisão da aula (Praticar).
 */
export function ExpliqueComSuasPalavras({ aula, s }: { aula: string; s: TextosDaAvaliacao["explique"] }) {
  const [anterior, setAnterior] = useState<Explicacao | null>(() => explicacaoDe(aula));
  const [texto, setTexto] = useState("");
  const [aviso, setAviso] = useState("");
  const [audio, setAudio] = useState<string | null>(null);
  const [segundos, setSegundos] = useState<number | null>(null);
  const [semMicrofone, setSemMicrofone] = useState(() => !podeGravar());
  const gravador = useRef<{ recorder: MediaRecorder; stream: MediaStream; relogio: number } | null>(null);

  // O áudio guardado desta aula, se houver.
  useEffect(() => {
    let vivo = true;
    void lerAudio(aula).then((blob) => {
      if (vivo && blob) setAudio(URL.createObjectURL(blob));
    });
    return () => {
      vivo = false;
    };
  }, [aula]);

  // O endereço do áudio na memória sai quando troca ou quando a aula fecha.
  useEffect(
    () => () => {
      if (audio) URL.revokeObjectURL(audio);
    },
    [audio],
  );

  // Saiu da aula gravando: para tudo e solta o microfone.
  useEffect(
    () => () => {
      const g = gravador.current;
      if (!g) return;
      window.clearInterval(g.relogio);
      if (g.recorder.state !== "inactive") g.recorder.stop();
      g.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  function guardar() {
    const nova = gravarExplicacao(aula, texto);
    if (nova) {
      setAnterior(nova);
      setTexto("");
      setAviso(s.guardado);
    }
  }

  async function gravar() {
    if (gravador.current) return;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setSemMicrofone(true);
      return;
    }
    const pedacos: Blob[] = [];
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      setSemMicrofone(true);
      return;
    }
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) pedacos.push(e.data);
    };
    recorder.onstop = () => {
      const g = gravador.current;
      if (g) window.clearInterval(g.relogio);
      stream.getTracks().forEach((t) => t.stop());
      gravador.current = null;
      setSegundos(null);
      if (pedacos.length === 0) return;
      const blob = new Blob(pedacos, { type: recorder.mimeType || "audio/webm" });
      void guardarAudio(aula, blob).then(() => {
        setAudio(URL.createObjectURL(blob));
        setAviso(s.guardado);
      });
    };
    const inicio = Date.now();
    const relogio = window.setInterval(() => {
      const passados = Math.floor((Date.now() - inicio) / 1000);
      setSegundos(passados);
      // No limite de 2 minutos, para sozinho.
      if (passados >= SEGUNDOS_DE_GRAVACAO && recorder.state !== "inactive") recorder.stop();
    }, 250);
    gravador.current = { recorder, stream, relogio };
    setSegundos(0);
    setAviso("");
    recorder.start();
  }

  function parar() {
    const g = gravador.current;
    if (g && g.recorder.state !== "inactive") g.recorder.stop();
  }

  async function apagar() {
    parar();
    apagarExplicacao(aula);
    await apagarAudio(aula);
    setAnterior(null);
    setTexto("");
    setAudio(null);
    setAviso(s.apagado);
  }

  const gravando = segundos !== null;
  return (
    <section className="explique-com-suas-palavras no-print" aria-labelledby="explique-titulo" data-explique="">
      <h2 id="explique-titulo">{s.titulo}</h2>
      <p className="mt-1 text-ink-soft">{s.texto}</p>

      {anterior && (
        <figure className="mt-4 border-l-2 border-rule pl-3" data-explicacao-anterior="">
          <figcaption className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-ink-soft">{s.anterior}</figcaption>
          <blockquote className="mt-1 whitespace-pre-line font-serif text-base">{anterior.texto}</blockquote>
        </figure>
      )}

      <label className="mt-4 block font-semibold" htmlFor={`explique-${aula}`}>
        {s.campo}
      </label>
      <textarea id={`explique-${aula}`} value={texto} maxLength={MAX_EXPLICACAO} onChange={(e) => setTexto(e.target.value.slice(0, MAX_EXPLICACAO))} />
      <p className="mt-1 text-xs text-ink-soft" aria-live="polite">
        {fill(s.contador, { n: texto.length, max: MAX_EXPLICACAO })}
      </p>

      <div className="acoes-da-explicacao">
        <button type="button" className="botao botao-tinta botao-menor disabled:cursor-not-allowed disabled:opacity-50" disabled={!texto.trim()} onClick={guardar}>
          {s.guardar}
        </button>
        {!semMicrofone &&
          (gravando ? (
            <button type="button" className="botao botao-menor cursor-pointer border-2 border-ink px-4 py-2" onClick={parar} data-parar-gravacao="">
              {s.parar}
            </button>
          ) : (
            <button type="button" className="cursor-pointer border-2 border-ink px-4 py-2 font-semibold hover:border-oxblood hover:text-oxblood" onClick={() => void gravar()} data-gravar="">
              {s.gravar}
            </button>
          ))}
        {(anterior || audio) && (
          <button type="button" className="cursor-pointer underline hover:text-oxblood" onClick={() => void apagar()} data-apagar-explicacao="">
            {s.apagar}
          </button>
        )}
      </div>
      {gravando && (
        <p className="gravando mt-2" aria-live="polite">
          {fill(s.gravando, { s: segundos, max: SEGUNDOS_DE_GRAVACAO })}
        </p>
      )}
      {semMicrofone && <p className="mt-2 text-sm text-ink-soft">{s.semMicrofone}</p>}
      {audio && (
        <div className="mt-3">
          <p className="text-sm font-semibold">{s.suaGravacao}</p>
          <audio controls src={audio} preload="metadata" />
          <p className="text-xs text-ink-soft">{s.semTranscricao}</p>
        </div>
      )}
      {aviso && (
        <p role="status" className="mt-2 text-sm text-ok">
          {aviso}
        </p>
      )}
      <p className="mt-4 text-xs text-ink-soft">{s.aviso}</p>
    </section>
  );
}
