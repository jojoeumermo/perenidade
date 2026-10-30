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
export function JitsiSala({ sala, servidor: servidorDaSala, nome, conduzo, lang, assunto, aoSair, aoEntrar, video }: { sala: string; servidor?: string; nome: string; conduzo: boolean; lang: string; assunto?: string; aoSair?: () => void; aoEntrar?: () => void; /** Chamada de canal: todo mundo entra falando, com a câmera ligada só se for de vídeo. */ video?: boolean }) {
  const { t } = useI18n();
  const caixa = useRef<HTMLDivElement>(null);
  const [erro, setErro] = useState(false);
  const [servidor, setServidor] = useState(() => servidorEscolhido(sala, servidorDaSala));
  const [trocar, setTrocar] = useState(false);
  // A sala só é montada de novo quando muda a sala ou o servidor. Nome, assunto e os avisos de entrar e sair mudam a
  // cada nova renderização de quem embute (funções novas a cada vez): se entrassem na lista do efeito, a sala era
  // desmontada e montada de novo sem parar, e todo mundo via a pessoa "saindo e entrando" o tempo todo.
  const avisos = useRef({ aoSair, aoEntrar });
  const dados = useRef({ nome, assunto, conduzo, lang, video });
  const apiAtual = useRef<JitsiApi | null>(null);
  useEffect(() => {
    avisos.current = { aoSair, aoEntrar };
  }, [aoSair, aoEntrar]);
  useEffect(() => {
    dados.current = { nome, assunto, conduzo, lang, video };
    apiAtual.current?.executeCommand("displayName", nome);
    if (conduzo && assunto) apiAtual.current?.executeCommand("subject", assunto);
  }, [nome, assunto, conduzo, lang, video]);
  useEffect(() => {
    let api: JitsiApi | null = null;
    const { nome, assunto, conduzo, lang, video } = dados.current;
    // Na chamada de um canal não há quem conduza: todo mundo tem os mesmos botões e entra com o microfone aberto.
    const doCanal = video !== undefined;
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
            startWithAudioMuted: doCanal ? false : !conduzo,
            startWithVideoMuted: doCanal ? !video : !conduzo,
            defaultLanguage: lang,
            subject: assunto ?? "",
            disableThirdPartyRequests: true,
            // Sem ligação direta entre dois aparelhos (o "P2P" que o Jitsi usa quando só há duas pessoas): o vídeo passa
            // sempre pelo servidor da sala. A ligação direta falha em muitas redes de celular e de escola, e a troca de
            // uma para a outra quando entra a terceira pessoa deixava gente sem receber a imagem.
            p2p: { enabled: false },
            enableWelcomePage: false,
            toolbarButtons: conduzo || doCanal ? BOTOES_DE_QUEM_CONDUZ : BOTOES_DE_QUEM_ASSISTE,
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
        apiAtual.current = api;
        api.addListener("videoConferenceJoined", () => avisos.current.aoEntrar?.());
        api.addListener("videoConferenceLeft", () => avisos.current.aoSair?.());
        api.addListener("readyToClose", () => avisos.current.aoSair?.());
      })
      .catch(() => {
        if (vivo) setErro(true);
      });
    return () => {
      vivo = false;
      if (apiAtual.current === api) apiAtual.current = null;
      api?.dispose();
    };
  }, [sala, servidor]);
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
