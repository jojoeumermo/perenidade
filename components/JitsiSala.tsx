// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import { fill } from "@/i18n/config";
import { escolherServidor, SERVIDORES_JITSI, servidorEscolhido } from "@/lib/jitsi";
import { useI18n } from "./I18n";

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

// O programa de cada servidor é baixado uma vez por visita (todos definem a mesma API).
const carregando = new Map<string, Promise<void>>();
function carregarApi(servidor: string): Promise<void> {
  let pedido = carregando.get(servidor);
  if (!pedido) {
    pedido = new Promise<void>((ok, erro) => {
      const s = document.createElement("script");
      s.src = `https://${servidor}/external_api.js`;
      s.async = true;
      s.onload = () => ok();
      s.onerror = () => {
        carregando.delete(servidor);
        erro(new Error("jitsi"));
      };
      document.head.appendChild(s);
    });
    carregando.set(servidor, pedido);
  }
  return pedido;
}

const BOTOES_DE_QUEM_ASSISTE = ["microphone", "camera", "desktop", "chat", "raisehand", "tileview", "fullscreen", "hangup", "settings", "select-background"];
const BOTOES_DE_QUEM_CONDUZ = [...BOTOES_DE_QUEM_ASSISTE, "participants-pane", "mute-everyone", "mute-video-everyone", "security", "shareaudio", "whiteboard"];

/**
 * A sala de vídeo dentro da página, pelo Jitsi Meet (código aberto), num servidor público sem limite de tempo e sem
 * login de moderador (lib/jitsi.ts). O que a API deixa personalizar (cores de fundo, marcas d'água, botões, idioma, nome
 * de quem entra) está aqui; o resto do visual é do servidor. Sem gravação. Ao sair da sala, avisa quem embutiu.
 * Se o servidor estiver fora do ar, dá para trocar: a escolha fica neste aparelho, e todos da sala precisam usar o mesmo.
 */
export function JitsiSala({ sala, servidor: servidorDaSala, nome, conduzo, lang, assunto, aoSair, aoEntrar }: { sala: string; servidor?: string; nome: string; conduzo: boolean; lang: string; assunto?: string; aoSair?: () => void; aoEntrar?: () => void }) {
  const { t } = useI18n();
  const caixa = useRef<HTMLDivElement>(null);
  const [erro, setErro] = useState(false);
  const [servidor, setServidor] = useState(() => servidorEscolhido(sala, servidorDaSala));
  const [trocar, setTrocar] = useState(false);
  useEffect(() => {
    let api: JitsiApi | null = null;
    let vivo = true;
    void Promise.resolve().then(() => vivo && setErro(false));
    carregarApi(servidor)
      .then(() => {
        if (!vivo || !caixa.current || !window.JitsiMeetExternalAPI) return;
        api = new window.JitsiMeetExternalAPI(servidor, {
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
  }, [sala, servidor, nome, conduzo, lang, assunto, aoSair, aoEntrar]);
  const outros = SERVIDORES_JITSI.filter((s) => s !== servidor);
  const rodape = (
    <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-sans text-xs text-ink-soft">
      <span>{fill(t.common.videoServer, { dominio: servidor })}</span>
      <a href={`https://${servidor}/${sala}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-oxblood">{t.common.openInNewTab}</a>
      {outros.length > 0 && (
        <button type="button" onClick={() => setTrocar((x) => !x)} className="cursor-pointer underline hover:text-oxblood">{t.common.videoSwitch}</button>
      )}
      {trocar && (
        <span className="flex w-full flex-wrap items-center gap-2">
          <span>{t.common.videoSwitchHint}</span>
          {outros.map((s) => (
            <button key={s} type="button" onClick={() => { escolherServidor(sala, s); setServidor(s); setTrocar(false); }} className="cursor-pointer border border-ink px-2 py-0.5 font-mono hover:border-oxblood">{s}</button>
          ))}
        </span>
      )}
    </p>
  );
  if (erro) {
    return (
      <div>
        <p className="border-2 border-oxblood p-4 font-sans text-sm text-oxblood">{fill(t.common.videoRoomFailed, { dominio: servidor })}</p>
        {rodape}
      </div>
    );
  }
  return (
    <div>
      <div ref={caixa} className="aspect-video w-full min-h-[22rem] border-4 border-ink bg-[#17130e] lg:min-h-[32rem]" />
      {rodape}
    </div>
  );
}
