// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { Post } from "@/lib/rede/tipos";
import { enderecoDaMidia } from "../publicar/api";
import { duracaoEmSegundos, previa, useAudioDoPost, useTextosDaMidia } from "./base";
import { BotaoOuvir } from "./BotaoOuvir";
import { TocadorDeAudio } from "./TocadorDeAudio";
import { TranscricaoDoAudio } from "./TranscricaoDoAudio";

/** O áudio de uma resposta: nada baixa antes do toque; depois, o tocador próprio (TocadorDeAudio). */
function AudioDaResposta({ lang, audio }: { lang: string; audio: { id: string; duracao: number } }) {
  const tm = useTextosDaMidia(lang);
  const [url, setUrl] = useState("");
  const [estado, setEstado] = useState<"parado" | "carregando" | "falhou">("parado");
  if (!tm) return null;
  if (url) return <TocadorDeAudio className="m12-audio" src={url} duracao={audio.duracao} tocarJa t={{ tocar: preencher(tm.audio.ouvir, { d: duracaoEmSegundos(audio.duracao) }), pausar: tm.audio.pausar, posicao: tm.audio.posicao }} />;
  return (
    <div className="m12-audio-linha">
      <button
        type="button"
        className="al2-chip al2-chip-p"
        disabled={estado === "carregando"}
        onClick={() => {
          if (previa()) return;
          setEstado("carregando");
          enderecoDaMidia(audio.id).then(setUrl, () => setEstado("falhou"));
        }}
      >
        <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
          <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
        </svg>
        {estado === "carregando" ? tm.audio.carregando : preencher(tm.audio.ouvir, { d: duracaoEmSegundos(audio.duracao) })}
      </button>
      {estado === "falhou" && <p role="alert" className="m12-erro">{tm.audio.falha}</p>}
    </div>
  );
}

/**
 * O que a frente 12B põe em cada resposta da conversa (components/rede/conversa/TelaDaConversaAlumia.tsx), logo depois do texto:
 * o áudio, se a resposta tem, e a transcrição aprovada (ou o "Escrever a transcrição" para quem gravou). O "Ouvir" vai na fileira
 * de ações que fica sempre à vista (OuvirResposta). Resposta silenciada não recebe nada.
 */
export function NaResposta({ lang, s, post }: { lang: string; s: TextosDaRede; post: Post & { silenciada?: boolean } }) {
  const audio = useAudioDoPost(post.id);
  if (post.silenciada || !audio) return null;
  return (
    <div className="m12-na-resposta">
      <AudioDaResposta lang={lang} audio={audio} />
      <TranscricaoDoAudio lang={lang} s={s} post={post} />
    </div>
  );
}

/** O "Ouvir" da resposta, para a fileira de ações que fica sempre à vista. */
export function OuvirResposta({ lang, post }: { lang: string; post: Post & { silenciada?: boolean } }) {
  return <BotaoOuvir post={post} lang={lang} classe="al3-acao m12-ouvir" resposta />;
}
