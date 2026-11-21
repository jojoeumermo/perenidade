// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A sala de vídeo do painel (Prompt 4, item 141): decide entre o Jitsi (como sempre foi) e o LiveKit Cloud pelo interruptor
// "sala-livekit" (lib/recursos.ts, só pelo nome, desligado). Desligado, é a JitsiSala, igual a hoje. Ligado, é a LivekitSala, com o
// mesmo nome de sala (o que já está no banco); se o serviço de vídeo falhar, o botão "Abrir no Jitsi" volta para a JitsiSala
// enquanto o Jitsi existir. Os lugares que abrem sala usam esta, com as mesmas propriedades da JitsiSala.
import dynamic from "next/dynamic";
import { useState } from "react";
import { ligado } from "@/lib/recursos";
import { JitsiSala } from "./JitsiSala";
import type { EntradaDaSala, PropsDaSala } from "./LivekitSala";

// O LiveKit (o pacote do navegador) só é baixado com o interruptor ligado.
const LivekitSala = dynamic(() => import("./LivekitSala").then((m) => m.LivekitSala), { ssr: false });

/** O LiveKit vale agora (o interruptor do painel, lido no navegador)? */
export const comLivekit = () => ligado("sala-livekit");

export function SalaDeVideo(props: PropsDaSala & { entrada?: EntradaDaSala }) {
  const [noJitsi, setNoJitsi] = useState(false);
  const { entrada, ...daJitsi } = props;
  if (!comLivekit() || noJitsi) return <JitsiSala {...daJitsi} />;
  return <LivekitSala {...props} entrada={entrada} aoFalhar={() => setNoJitsi(true)} />;
}

/**
 * O link da sala da turma (do mês e do curso). Desligado o LiveKit, o link de sempre para o servidor do Jitsi, em outra aba. Ligado,
 * um botão que abre a sala DENTRO do site, logo abaixo (a rota confere no banco que a pessoa está na turma).
 */
export function SalaDaTurma({ sala, entrada, lang, rotulo, href, className, nome }: { sala: string; entrada: Extract<EntradaDaSala, { origem: "turma-mes" | "turma-curso" }>; lang: string; rotulo: string; href: string; className: string; nome: string }) {
  const [aberta, setAberta] = useState(false);
  if (!comLivekit()) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className} data-turma-sala="">
        {rotulo}
      </a>
    );
  }
  return (
    <>
      <button type="button" className={className} aria-expanded={aberta} onClick={() => setAberta((x) => !x)} data-turma-sala="">
        {rotulo}
      </button>
      {aberta && (
        <div className="basis-full">
          <SalaDeVideo sala={sala} nome={nome} conduzo={false} lang={lang} entrada={entrada} aoSair={() => setAberta(false)} />
        </div>
      )}
    </>
  );
}
