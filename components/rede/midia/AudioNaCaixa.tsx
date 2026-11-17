// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import type { AudioEnviado } from "@/lib/rede/tipos-publicar";
import { LIMITES_PUBLICAR } from "@/lib/rede/tipos-publicar";
import { enviarMidia } from "../publicar/api";
import { Gravador, type AudioGravado } from "../publicar/ExtrasDoEscrever";
import { useTextosPublicar } from "../publicar/textos";
import { useTextosDaMidia } from "./base";

export type { AudioGravado };

/**
 * Sobe o áudio gravado na caixa de resposta pela mesma rota das fotos e do áudio do post (o servidor confere o tipo pelos bytes e
 * guarda na pasta da pessoa) e devolve o que rede_publicar recebe em "audio".
 */
export async function enviarAudioDaResposta(a: AudioGravado): Promise<AudioEnviado> {
  const subido = await enviarMidia(a.blob);
  return { caminho: subido.caminho, duracao: Math.max(1, Math.min(LIMITES_PUBLICAR.audioSegundos, Math.round(a.duracao))) };
}

/**
 * Gravar um áudio na caixa "Responder para @…" da conversa (até 1 minuto, o mesmo gravador do Escrever). Fica numa linha inteira
 * da caixa, acima do campo: o microfone; gravando, o relógio e "Parar"; gravado, o tocador, regravar e tirar. A linha de texto
 * continua pedida (é por ela que quem não ouve acompanha), e a caixa diz isso enquanto há áudio.
 */
export function AudioNaCaixa({ lang, audio, aoMudar, desligado = false }: { lang: string; audio: AudioGravado | null; aoMudar: (a: AudioGravado | null) => void; desligado?: boolean }) {
  const tm = useTextosDaMidia(lang);
  const tp = useTextosPublicar(lang);
  const [aberto, setAberto] = useState(false);
  if (!tm || !tp) return null;
  if (!aberto && !audio) {
    return (
      <div className="m12-caixa">
        <button type="button" className="al3-acao m12-microfone" onClick={() => setAberto(true)} disabled={desligado} aria-label={tm.audio.gravar} title={tm.audio.gravar}>
          <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
          </svg>
          <span>{tm.audio.gravar}</span>
        </button>
      </div>
    );
  }
  return (
    <div className="m12-caixa m12-caixa-aberta">
      <Gravador
        t={tp}
        audio={audio}
        comecarJa={!audio}
        tocadorDaAlumia
        classeBotao="al-botao al-botao-p al-botao-contorno"
        aoGravar={(a) => aoMudar(a)}
        aoTirar={() => aoMudar(null)}
      />
      {!audio && (
        <button type="button" className="al3-acao m12-fechar" onClick={() => setAberto(false)} aria-label={tm.audio.tirar} title={tm.audio.tirar}>
          <span aria-hidden>×</span>
        </button>
      )}
      {audio && <p className="m12-dica">{tm.audio.linha}</p>}
    </div>
  );
}
