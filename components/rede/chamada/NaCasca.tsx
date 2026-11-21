// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A chamada em TODA tela da Alumia (Prompt 4, itens 139 e 140, atrás de "alumia-p4-chamadas"; encaixe colunaDireita, que existe em
// toda tela; o cartão sai num portal para dentro da pele da Alumia):
//   - o toque que chegou (de dentro da conversa cifrada): quem liga, voz ou vídeo, Atender e Recusar. Só nesta aba: nenhuma
//     notificação do sistema, nada no disco, nenhum registro de chamada;
//   - a chamada aberta: o cronômetro, o microfone, a câmera (na de vídeo), Desligar; o vídeo de quem está do outro lado e a prévia
//     pequena da própria câmera.
// O microfone e a câmera desligam ao desligar, ao fechar a página e no "Sair rápido".
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { guardaDosToques } from "@/lib/rede/chamada/guarda";
import { painelDaChamada } from "@/lib/rede/chamada/cliente";
import { aoApagarTudoDoChat } from "@/lib/rede/chat/gaveta";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDasChamadas } from "@/lib/rede/textos-p4-chamadas";
import type { ContextoDoEncaixe } from "../encaixes";
import { useChamada, useDuracao, useTextosDasChamadas, useTocando } from "./usar";
import "./chamada.css";

const RAIZ = '[data-al="2"]';

function Fluxo({ fluxo, video, rotulo, mudo = false, espelho = false }: { fluxo: MediaStream | null; video: boolean; rotulo: string; mudo?: boolean; espelho?: boolean }) {
  const ref = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = fluxo;
  }, [fluxo]);
  if (!video) return <audio ref={ref} autoPlay muted={mudo} />;
  return <video ref={ref} autoPlay playsInline muted={mudo} aria-label={rotulo} className={espelho ? "ch-video ch-espelho" : "ch-video"} />;
}

const temVideo = (f: MediaStream | null) => !!f?.getVideoTracks().some((x) => x.readyState !== "ended");

function Icone({ nome }: { nome: "fone" | "camera" | "camera-off" | "mic" | "mic-off" | "desligar" }) {
  const caminhos: Record<typeof nome, React.ReactNode> = {
    fone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />,
    camera: <><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3" /></>,
    "camera-off": <><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3M3 3l18 18" /></>,
    mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
    "mic-off": <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M3 3l18 18" /></>,
    desligar: <path d="M3 14c5-4 13-4 18 0l-2 3-4-1v-2a9 9 0 0 0-6 0v2l-4 1z" />,
  };
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="ch-icone" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {caminhos[nome]}
    </svg>
  );
}

function Tocando({ t }: { t: TextosDasChamadas }) {
  const tocando = useTocando();
  const chamada = useChamada();
  const titulo = useId();
  // O toque vence sozinho (2 min): a guarda limpa quando alguém pergunta.
  useEffect(() => {
    if (!tocando.length) return;
    const v = setInterval(() => void guardaDosToques.tocando(), 5000);
    return () => clearInterval(v);
  }, [tocando.length]);
  // Com uma chamada aberta, outro toque não aparece (fica tocando até vencer; nada atende sozinho).
  if (!tocando.length || chamada.fase === "ligando" || chamada.fase === "conectando" || chamada.fase === "em_chamada") return null;
  const r = tocando[0];
  const p = painelDaChamada();
  return (
    <section className="ch-cartao ch-toque" role="alertdialog" aria-labelledby={titulo} data-ch-toque="">
      <h2 id={titulo}>{preencher(r.corpo.video ? t.tocando.video : t.tocando.voz, { nome: r.nome })}</h2>
      <p className="ch-nota">{t.privacidade}</p>
      <div className="ch-acoes">
        {r.corpo.video ? (
          <>
            <button type="button" className="al-botao al-botao-primario ch-atender" onClick={() => void p.atender(r, true)}>
              <Icone nome="camera" />
              {t.tocando.atenderComCamera}
            </button>
            <button type="button" className="al-botao" onClick={() => void p.atender(r, false)}>
              <Icone nome="fone" />
              {t.tocando.atenderSoVoz}
            </button>
          </>
        ) : (
          <button type="button" className="al-botao al-botao-primario ch-atender" onClick={() => void p.atender(r, false)}>
            <Icone nome="fone" />
            {t.tocando.atender}
          </button>
        )}
        <button type="button" className="al-botao ch-perigo" onClick={() => void p.recusar(r)}>
          <Icone nome="desligar" />
          {t.tocando.recusar}
        </button>
      </div>
    </section>
  );
}

function Aberta({ t }: { t: TextosDasChamadas }) {
  const c = useChamada();
  const duracao = useDuracao(c.desde);
  const titulo = useId();
  const p = painelDaChamada();
  // O "acabou" some sozinho depois de alguns segundos.
  useEffect(() => {
    if (c.fase !== "acabou") return;
    const v = setTimeout(() => p.fechar(), 8000);
    return () => clearTimeout(v);
  }, [c.fase, p]);
  if (c.fase === "parada") return null;
  if (c.fase === "acabou") {
    const motivo = c.motivo ?? "eu";
    const frase = motivo === "erro" ? ((t.erros as Record<string, string>)[c.erro ?? ""] ?? t.erros.outro) : preencher(t.fim[motivo], { nome: c.nome });
    return (
      <section className="ch-cartao" role="status" data-ch-fim={motivo}>
        <p className="ch-fim">{frase}</p>
        <div className="ch-acoes">
          <button type="button" className="al-botao" onClick={() => p.fechar()}>{t.acoes.fechar}</button>
        </div>
      </section>
    );
  }
  const outro = c.outros[0] ?? null;
  const frase = c.fase === "ligando" ? t.fases.ligando : c.fase === "conectando" ? t.fases.conectando : t.fases.emChamada;
  return (
    <section className={c.video ? "ch-cartao ch-aberta ch-com-video" : "ch-cartao ch-aberta"} aria-labelledby={titulo} data-ch-fase={c.fase}>
      <h2 id={titulo}>
        {preencher(frase, { nome: c.nome })}
        {duracao && <span className="ch-duracao"> · <time>{duracao}</time></span>}
      </h2>
      {c.video ? (
        <div className="ch-palco">
          {outro && temVideo(outro.fluxo) ? <Fluxo fluxo={outro.fluxo} video rotulo={c.nome} /> : <p className="ch-sem-video">{c.fase === "em_chamada" ? preencher(t.semCamera, { nome: c.nome }) : ""}</p>}
          {/* O áudio de quem está do outro lado toca mesmo sem a câmera dela. */}
          {outro && !temVideo(outro.fluxo) && <Fluxo fluxo={outro.fluxo} video={false} rotulo={c.nome} />}
          {c.minhaCamera && c.camera && <div className="ch-previa"><Fluxo fluxo={c.minhaCamera} video mudo espelho rotulo={t.voce} /></div>}
        </div>
      ) : (
        outro && <Fluxo fluxo={outro.fluxo} video={false} rotulo={c.nome} />
      )}
      {c.fase === "ligando" && <p className="ch-nota">{t.limite}</p>}
      <div className="ch-acoes">
        <button type="button" className="al-botao" aria-pressed={c.mudo} onClick={() => p.mudo(!c.mudo)} aria-label={c.mudo ? t.acoes.falar : t.acoes.mudo} title={c.mudo ? t.acoes.falar : t.acoes.mudo}>
          <Icone nome={c.mudo ? "mic-off" : "mic"} />
        </button>
        {c.video && c.minhaCamera && (
          <button type="button" className="al-botao" aria-pressed={!c.camera} onClick={() => p.camera(!c.camera)} aria-label={c.camera ? t.acoes.cameraDesligar : t.acoes.cameraLigar} title={c.camera ? t.acoes.cameraDesligar : t.acoes.cameraLigar}>
            <Icone nome={c.camera ? "camera" : "camera-off"} />
          </button>
        )}
        <button type="button" className="al-botao ch-perigo" onClick={() => void p.desligar()}>
          <Icone nome="desligar" />
          {c.fase === "ligando" ? t.acoes.desistir : t.acoes.desligar}
        </button>
      </div>
    </section>
  );
}

export function ChamadaNaCasca({ lang, situacao }: ContextoDoEncaixe) {
  const t = useTextosDasChamadas(lang);
  const [raiz] = useState<Element | null>(() => (typeof document === "undefined" ? null : (document.querySelector(RAIZ) ?? document.body)));

  // Fechar a página e o "Sair rápido" fecham a chamada na hora (microfone e câmera desligam); o Sair rápido apaga também os toques.
  useEffect(() => {
    const sair = () => painelDaChamada().sairJa();
    window.addEventListener("pagehide", sair);
    const desfazer = aoApagarTudoDoChat(() => {
      sair();
      guardaDosToques.esquecer();
    });
    return () => {
      window.removeEventListener("pagehide", sair);
      desfazer();
    };
  }, []);

  if (!t || !raiz || !situacao.logado) return null;
  return createPortal(
    <div className="ch-casca" data-ch-casca="">
      <Tocando t={t} />
      <Aberta t={t} />
    </div>,
    raiz,
  );
}
