// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import type { TextosDoChat } from "@/lib/rede/textos-chat";
import { qrDaSeguranca } from "@/lib/sigilo";
import { botaoLeve } from "./comum";

/**
 * O código de segurança da conversa em QR, desenhado no próprio aparelho (a biblioteca "qrcode" já é do site e só é baixada
 * quando a pessoa abre o código). As duas cores são do QR, não da interface: tinta escura sobre branco puro, para qualquer
 * câmera ler.
 */
export function QrDoCodigo({ codigo, rotulo }: { codigo: string; rotulo: string }) {
  const [imagem, setImagem] = useState("");
  useEffect(() => {
    let cancelado = false;
    import("qrcode")
      .then((qrcode) => qrcode.toDataURL(qrDaSeguranca(codigo), { errorCorrectionLevel: "M", margin: 1, width: 200, color: { dark: "#1f1a14", light: "#ffffff" } }))
      .then((url) => !cancelado && setImagem(url))
      .catch(() => !cancelado && setImagem(""));
    return () => {
      cancelado = true;
    };
  }, [codigo]);
  if (!imagem) return <div aria-hidden className="h-[200px] w-[200px] rounded-md border border-rule bg-parchment" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={imagem} alt={rotulo} width={200} height={200} className="rounded-md border border-rule" />;
}

type Detector = { detect: (fonte: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

/** Este navegador deixa usar a câmera? (sem isso, o botão de ler nem aparece: comparar os números serve) */
export const temCamera = () => typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function";

/**
 * Lê um QR com a câmera. Este componente só entra na tela depois de a pessoa tocar em "Ler o QR": é o toque que liga a câmera.
 * Ela desliga ao fechar, ao ler, ao sair da tela e quando a aba vai para o fundo. A imagem não sai do aparelho: quem lê é o
 * leitor do próprio navegador ou, na falta dele, a biblioteca "jsqr" (que já é do site), rodando aqui.
 */
export function LeitorDeQr({ t, aoLer, fechar }: { t: TextosDoChat; aoLer: (texto: string) => void; fechar: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [aviso, setAviso] = useState("");
  const aoLerRef = useRef(aoLer);
  const fecharRef = useRef(fechar);
  useEffect(() => {
    aoLerRef.current = aoLer;
    fecharRef.current = fechar;
  }, [aoLer, fechar]);
  useEffect(() => {
    let fluxo: MediaStream | null = null;
    let relogio = 0;
    let parado = false;
    const desligar = () => {
      parado = true;
      window.clearTimeout(relogio);
      fluxo?.getTracks().forEach((faixa) => faixa.stop());
      fluxo = null;
    };
    const aoEsconder = () => {
      if (document.visibilityState !== "visible") {
        desligar();
        fecharRef.current();
      }
    };
    document.addEventListener("visibilitychange", aoEsconder);
    (async () => {
      try {
        const aberto = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (parado || !video.current) {
          aberto.getTracks().forEach((faixa) => faixa.stop());
          return;
        }
        fluxo = aberto;
        video.current.srcObject = aberto;
        await video.current.play();
        const Nativo = (window as unknown as { BarcodeDetector?: new (opcoes: { formats: string[] }) => Detector }).BarcodeDetector;
        let ler: () => Promise<string | null>;
        if (Nativo) {
          const detector = new Nativo({ formats: ["qr_code"] });
          ler = async () => (video.current ? ((await detector.detect(video.current))[0]?.rawValue ?? null) : null);
        } else {
          const { default: jsQR } = await import("jsqr");
          const tela = document.createElement("canvas");
          const contexto = tela.getContext("2d", { willReadFrequently: true });
          ler = async () => {
            const v = video.current;
            if (!v || !contexto || !v.videoWidth) return null;
            const escala = Math.min(1, 640 / v.videoWidth);
            tela.width = Math.round(v.videoWidth * escala);
            tela.height = Math.round(v.videoHeight * escala);
            contexto.drawImage(v, 0, 0, tela.width, tela.height);
            const imagem = contexto.getImageData(0, 0, tela.width, tela.height);
            return jsQR(imagem.data, imagem.width, imagem.height, { inversionAttempts: "dontInvert" })?.data ?? null;
          };
        }
        const volta = async () => {
          if (parado || !video.current) return;
          try {
            const valor = await ler();
            if (valor) {
              desligar();
              aoLerRef.current(valor);
              return;
            }
          } catch {
            // a câmera ainda está abrindo
          }
          relogio = window.setTimeout(volta, 250);
        };
        void volta();
      } catch {
        desligar();
        setAviso(t.acoes.qrSemCamera);
      }
    })();
    return () => {
      document.removeEventListener("visibilitychange", aoEsconder);
      desligar();
    };
  }, [t.acoes.qrSemCamera]);
  return (
    <div className="space-y-2">
      <video ref={video} muted playsInline className="aspect-square w-full max-w-xs rounded-md bg-[#1f1a14] object-cover" aria-label={t.acoes.qrAponte} />
      <p className="text-xs text-ink-soft">{t.acoes.qrAponte}</p>
      {aviso && <p role="alert" className="text-xs text-oxblood">{aviso}</p>}
      <button type="button" onClick={fechar} className={botaoLeve}>{t.acoes.qrFechar}</button>
    </div>
  );
}
