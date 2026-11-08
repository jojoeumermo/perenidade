// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { idDoVideo } from "@/lib/escola/aovivo";

/** O idioma da interface do tocador do YouTube (o parâmetro "hl"). */
const HL: Record<string, string> = { pt: "pt-BR", en: "en", es: "es", fr: "fr", ru: "ru", zh: "zh-CN" };

/**
 * O vídeo da aula da Escola (a transmissão não listada ou a gravação), como components/TocadorYoutube.tsx: nada do
 * Google carrega até a pessoa clicar; antes disso é só um quadro do site. Depois, o tocador vem pelo domínio sem cookies
 * de propaganda (youtube-nocookie.com), com "rel=0" (sem sugestões de outros canais no fim). O id chegou do banco, só
 * para militante, e ainda é conferido aqui (11 caracteres de sempre).
 */
export function TocadorDaEscola({ id, titulo, lang, aoVivo, textos }: { id: string | null; titulo: string; lang: string; aoVivo: boolean; textos: { assistir: string; aviso: string; semVideo: string } }) {
  const [carregado, setCarregado] = useState(false);
  const video = idDoVideo(id);
  return (
    <div className="ea-tocador">
      {!video ? (
        <p className="ea-sem-video">{textos.semVideo}</p>
      ) : carregado ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${video}?autoplay=1&rel=0&hl=${HL[lang] ?? "pt-BR"}&cc_lang_pref=${(HL[lang] ?? "pt").slice(0, 2)}`}
          title={titulo}
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
        />
      ) : (
        <button type="button" className="ea-tocador-botao" onClick={() => setCarregado(true)}>
          <span aria-hidden className="ea-tocador-play" data-gravada={aoVivo ? undefined : ""}>
            <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" style={{ marginLeft: 4 }}>
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
          <span className="ef-t ea-tocador-chamada">{textos.assistir}</span>
          <span className="ea-tocador-aviso">{textos.aviso}</span>
        </button>
      )}
    </div>
  );
}
