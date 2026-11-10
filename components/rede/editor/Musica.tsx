// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A música opcional do vídeo, SEM RASTREIO: as 4 faixas são feitas no próprio aparelho (lib/rede/stories/musica.ts). Ouvir a
// prévia toca pelo WebAudio daqui mesmo; nada é pedido a serviço nenhum, ninguém fica sabendo o que a pessoa escolheu ouvir.
import { useEffect, useRef, useState } from "react";
import { gerarMusica, MUSICAS } from "@/lib/rede/stories/musica";
import type { TextosDosStories } from "@/lib/rede/textos-stories";
import type { MusicaDoStory } from "@/lib/rede/tipos-stories";
import { preencherStory } from "../stories/usar";

type T = TextosDosStories["b1"]["musica"];

export function EscolherMusica({ t, musica, aoEscolher }: { t: T; musica: MusicaDoStory | null; aoEscolher: (m: MusicaDoStory | null) => void }) {
  const [tocando, setTocando] = useState<MusicaDoStory | null>(null);
  const audio = useRef<{ ctx: AudioContext; fonte: AudioBufferSourceNode } | null>(null);

  const parar = () => {
    try {
      audio.current?.fonte.stop();
    } catch {
      /* já parou */
    }
    void audio.current?.ctx.close().catch(() => undefined);
    audio.current = null;
    setTocando(null);
  };
  useEffect(() => parar, []);

  const ouvir = (m: MusicaDoStory) => {
    parar();
    if (typeof AudioContext === "undefined") return;
    const ctx = new AudioContext();
    const amostras = gerarMusica(m, ctx.sampleRate, 6);
    const buffer = ctx.createBuffer(1, amostras.length, ctx.sampleRate);
    buffer.copyToChannel(amostras as Float32Array<ArrayBuffer>, 0);
    const fonte = ctx.createBufferSource();
    fonte.buffer = buffer;
    fonte.connect(ctx.destination);
    fonte.onended = () => setTocando((x) => (x === m ? null : x));
    fonte.start();
    audio.current = { ctx, fonte };
    setTocando(m);
  };

  return (
    <fieldset className="al-ed-musica">
      <legend className="al-cond al-st-titulo-secao">{t.titulo}</legend>
      <div className="al-ed-musica-lista">
        {[null, ...MUSICAS.map((x) => x.id)].map((m) => (
          <div key={m ?? "nenhuma"} className="al-ed-musica-item" data-escolhida={musica === m ? "sim" : "nao"}>
            <label className="al-ed-musica-nome">
              <input type="radio" name="al-ed-musica" className="sr-only" checked={musica === m} onChange={() => aoEscolher(m)} />
              {m ? (
                <span className="al-ed-musica-ondas" aria-hidden data-tocando={tocando === m ? "sim" : "nao"}>
                  <i />
                  <i />
                  <i />
                </span>
              ) : null}
              {m ? t.nomes[m] : t.nenhuma}
            </label>
            {m ? (
              <button
                type="button"
                className="al-ed-musica-ouvir"
                aria-label={tocando === m ? t.parar : preencherStory(t.ouvir, { nome: t.nomes[m] })}
                aria-pressed={tocando === m}
                onClick={() => (tocando === m ? parar() : ouvir(m))}
              >
                <span aria-hidden>{tocando === m ? "■" : "▶"}</span>
              </button>
            ) : null}
          </div>
        ))}
      </div>
      <p className="al-st-dica">{t.ajuda}</p>
    </fieldset>
  );
}
