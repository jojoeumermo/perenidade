// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import { JITSI_DOMINIO } from "@/lib/jitsi";

interface JitsiApi {
  dispose(): void;
  addListener(evento: string, f: (...args: unknown[]) => void): void;
  executeCommand(comando: string, ...args: unknown[]): void;
}
declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (dominio: string, opcoes: Record<string, unknown>) => JitsiApi;
  }
}

let carregando: Promise<void> | null = null;
function carregarApi(): Promise<void> {
  if (window.JitsiMeetExternalAPI) return Promise.resolve();
  if (!carregando) {
    carregando = new Promise((ok, erro) => {
      const s = document.createElement("script");
      s.src = `https://${JITSI_DOMINIO}/external_api.js`;
      s.async = true;
      s.onload = () => ok();
      s.onerror = () => {
        carregando = null;
        erro(new Error("jitsi"));
      };
      document.head.appendChild(s);
    });
  }
  return carregando;
}

const BOTOES_DE_QUEM_ASSISTE = ["microphone", "camera", "desktop", "chat", "raisehand", "tileview", "fullscreen", "hangup", "settings", "select-background"];
const BOTOES_DE_QUEM_CONDUZ = [...BOTOES_DE_QUEM_ASSISTE, "participants-pane", "mute-everyone", "mute-video-everyone", "security", "shareaudio", "whiteboard"];

/**
 * A sala de vídeo dentro da página, pelo Jitsi Meet (código aberto), no servidor configurado. O que a API deixa
 * personalizar (cores de fundo, marcas d'água, botões, idioma, nome de quem entra) está aqui; o resto do visual é do
 * servidor. Sem gravação. Ao sair da sala, avisa quem embutiu.
 */
export function JitsiSala({ sala, nome, conduzo, lang, assunto, aoSair, aoEntrar }: { sala: string; nome: string; conduzo: boolean; lang: string; assunto?: string; aoSair?: () => void; aoEntrar?: () => void }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    let api: JitsiApi | null = null;
    let vivo = true;
    carregarApi()
      .then(() => {
        if (!vivo || !caixa.current || !window.JitsiMeetExternalAPI) return;
        api = new window.JitsiMeetExternalAPI(JITSI_DOMINIO, {
          roomName: sala,
          parentNode: caixa.current,
          width: "100%",
          height: "100%",
          lang,
          userInfo: { displayName: nome },
          configOverwrite: {
            prejoinConfig: { enabled: false },
            disableDeepLinking: true,
            startWithAudioMuted: !conduzo,
            startWithVideoMuted: !conduzo,
            defaultLanguage: lang,
            subject: assunto ?? "",
            disableThirdPartyRequests: true,
            enableWelcomePage: false,
            toolbarButtons: conduzo ? BOTOES_DE_QUEM_CONDUZ : BOTOES_DE_QUEM_ASSISTE,
            // Sem gravação, sem transmissão para fora: a sala é só para quem está nela.
            fileRecordingsEnabled: false,
            liveStreamingEnabled: false,
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            SHOW_BRAND_WATERMARK: false,
            SHOW_POWERED_BY: false,
            DEFAULT_BACKGROUND: "#17130e",
            DEFAULT_REMOTE_DISPLAY_NAME: "…",
            DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
            MOBILE_APP_PROMO: false,
            TOOLBAR_ALWAYS_VISIBLE: false,
          },
        });
        api.addListener("videoConferenceJoined", () => aoEntrar?.());
        api.addListener("videoConferenceLeft", () => aoSair?.());
        api.addListener("readyToClose", () => aoSair?.());
      })
      .catch(() => {
        if (vivo) setErro(true);
      });
    return () => {
      vivo = false;
      api?.dispose();
    };
  }, [sala, nome, conduzo, lang, assunto, aoSair, aoEntrar]);
  if (erro) {
    return (
      <p className="border-2 border-oxblood p-4 font-sans text-sm text-oxblood">
        A sala de vídeo não carregou (o servidor {JITSI_DOMINIO} não respondeu ou está bloqueado nesta rede).{" "}
        <a href={`https://${JITSI_DOMINIO}/${sala}`} target="_blank" rel="noopener noreferrer" className="underline">Abrir em outra aba ↗</a>
      </p>
    );
  }
  return <div ref={caixa} className="aspect-video w-full min-h-[22rem] border-4 border-ink bg-[#17130e] lg:min-h-[32rem]" />;
}
