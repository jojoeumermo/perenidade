// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { apagarAudio, guardarAudio, lerAudio, podeGravarAudio } from "@/components/escola/vida/audio-local";
import { SEGUNDOS_DE_GRAVACAO } from "@/lib/escola/avaliacao";
import { ligado } from "@/lib/recursos";
import { useI18n } from "../I18n";
import { IconeBalao, IconeLixeira, IconeMicrofone, IconeParar } from "./IconesDeTraco";

// O retorno do assistente só baixa depois do clique (e só com a Escola ligada).
const RetornoDoAssistente = dynamic(() => import("./RetornoDoAssistente").then((m) => m.RetornoDoAssistente), { ssr: false });

/** Um número curto e estável a partir do texto (o mesmo da chave da resposta escrita no aparelho). */
const idDoAudio = (chave: string) => {
  let h = 0;
  for (const c of chave) h = (h * 31 + c.charCodeAt(0)) | 0;
  return `resp-${(h >>> 0).toString(36)}`;
};

/**
 * Responder falando, e pedir retorno (Etapa 3, lacuna "resposta aberta ou em áudio com retorno"). Fica logo abaixo do
 * campo de texto dos blocos "Na sua realidade", "O outro lado" e "Realidade". Tudo no aparelho:
 *  - a gravação (até 2 minutos, MediaRecorder, sem reconhecimento de fala e sem rede) vai para o IndexedDB
 *    "lucia-explicacoes", a mesma base do "Explique com suas palavras", com a chave "voz:resp-...": o "apagar meus
 *    dados" já a apaga. Fica fora da cópia de segurança, pelo tamanho. Só com o recurso "meu-estudo" ligado.
 *  - o retorno da gravação é da própria pessoa: ouvir de volta e conferir três perguntas, sem nota.
 *  - o retorno do assistente existente só vem se a pessoa pedir, só do texto escrito, e só com a Escola ligada.
 */
export function RespostaAberta({ chave, pergunta, resposta }: { chave: string; pergunta: string; resposta: string }) {
  const { t } = useI18n();
  const b = t.lesson.blocks;
  const comAudio = ligado("meu-estudo");
  const comRetorno = ligado("escola");
  const id = idDoAudio(chave);
  const [pode, setPode] = useState<boolean | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [segundos, setSegundos] = useState<number | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [pedindo, setPedindo] = useState(false);
  const gravador = useRef<{ rec: MediaRecorder; stream: MediaStream; relogio: number } | null>(null);

  useEffect(() => {
    if (!comAudio) return;
    const adiar = window.setTimeout(() => setPode(podeGravarAudio()), 0);
    let vivo = true;
    void lerAudio(id).then((blob) => {
      if (vivo && blob) setUrl(URL.createObjectURL(blob));
    });
    return () => {
      vivo = false;
      window.clearTimeout(adiar);
    };
  }, [comAudio, id]);

  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );

  // Saiu da aula gravando: para tudo e solta o microfone.
  useEffect(
    () => () => {
      const g = gravador.current;
      if (!g) return;
      window.clearInterval(g.relogio);
      if (g.rec.state !== "inactive") g.rec.stop();
      g.stream.getTracks().forEach((faixa) => faixa.stop());
    },
    [],
  );

  async function gravar() {
    if (gravador.current) return;
    setFalhou(false);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setFalhou(true);
      return;
    }
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach((faixa) => faixa.stop());
      setFalhou(true);
      return;
    }
    const pedacos: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) pedacos.push(e.data);
    };
    rec.onstop = () => {
      const g = gravador.current;
      if (g) window.clearInterval(g.relogio);
      stream.getTracks().forEach((faixa) => faixa.stop());
      gravador.current = null;
      setSegundos(null);
      if (pedacos.length === 0) return;
      const audio = new Blob(pedacos, { type: rec.mimeType || "audio/webm" });
      void guardarAudio(id, audio).then((ok) => {
        if (!ok) return setFalhou(true);
        setUrl(URL.createObjectURL(audio));
      });
    };
    const inicio = Date.now();
    const relogio = window.setInterval(() => {
      const passados = Math.floor((Date.now() - inicio) / 1000);
      setSegundos(passados);
      if (passados >= SEGUNDOS_DE_GRAVACAO && rec.state !== "inactive") rec.stop();
    }, 250);
    gravador.current = { rec, stream, relogio };
    setSegundos(0);
    rec.start();
  }

  function parar() {
    const g = gravador.current;
    if (g && g.rec.state !== "inactive") g.rec.stop();
  }

  async function apagar() {
    parar();
    await apagarAudio(id);
    setUrl(null);
  }

  const gravando = segundos !== null;
  const podeRetorno = comRetorno && resposta.trim().length >= 10;
  if (!comAudio && !comRetorno) return null;

  return (
    <div className="resposta-aberta no-print mt-3 font-sans text-sm" data-resposta-aberta="">
      {comAudio && (
        <div>
          <p className="font-bold">{b.respostaFalar}</p>
          {pode === true ? (
            <>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {gravando ? (
                  <button type="button" className="ouvir-paragrafo-botao" onClick={parar} aria-label={b.respostaParar}>
                    <IconeParar />
                    <span>{b.respostaParar}</span>
                  </button>
                ) : (
                  <button type="button" className="ouvir-paragrafo-botao" onClick={() => void gravar()} aria-label={b.respostaGravar} data-gravar-resposta="">
                    <IconeMicrofone />
                    <span>{b.respostaGravar}</span>
                  </button>
                )}
                {url && !gravando && (
                  <button type="button" className="ouvir-paragrafo-botao" onClick={() => void apagar()} aria-label={b.respostaApagar}>
                    <IconeLixeira />
                    <span>{b.respostaApagar}</span>
                  </button>
                )}
              </div>
              {gravando && (
                <p role="status" aria-live="polite" className="mt-2 font-bold text-prelo-texto">
                  {b.respostaGravando} {segundos}s / {SEGUNDOS_DE_GRAVACAO}s
                </p>
              )}
              {url && !gravando && (
                <div className="mt-3">
                  <p className="font-semibold">{b.respostaOuvir}</p>
                  <audio controls src={url} preload="metadata" className="mt-1 w-full max-w-md" />
                  <p className="mt-2 font-semibold">{b.respostaConferir}</p>
                  <ul className="mt-1 list-disc pl-5 text-ink-soft">
                    <li>{b.respostaConferir1}</li>
                    <li>{b.respostaConferir2}</li>
                    <li>{b.respostaConferir3}</li>
                  </ul>
                </div>
              )}
              {falhou && <p role="status" className="mt-2 text-prelo-texto">{b.respostaSemMicrofone}</p>}
              <p className="mt-2 text-xs text-ink-soft">{b.respostaAviso}</p>
            </>
          ) : (
            pode === false && <p className="mt-1 text-xs text-ink-soft">{b.respostaSemMicrofone}</p>
          )}
        </div>
      )}
      {podeRetorno && (
        <div className="mt-4">
          <button type="button" className="ouvir-paragrafo-botao" aria-expanded={pedindo} onClick={() => setPedindo(!pedindo)} data-pedir-retorno="">
            <IconeBalao />
            <span>{b.retornoPedir}</span>
          </button>
          <p className="mt-1 text-xs text-ink-soft">{b.retornoAviso}</p>
          {pedindo && <RetornoDoAssistente pergunta={pergunta} resposta={resposta} />}
        </div>
      )}
    </div>
  );
}
