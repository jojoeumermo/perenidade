// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { htmlLang, type Locale } from "@/i18n/config";
import { ligado } from "@/lib/recursos";
import { useI18n } from "../I18n";
import { useTextosDaBusca } from "./TextosDaBusca";
import "@/styles/escola-busca.css";

// Busca por voz (Etapa 4, R1-16). O microfone só aparece quando o navegador tem reconhecimento de fala
// (SpeechRecognition ou webkitSpeechRecognition). Quem transcreve é o serviço do navegador (Google ou Apple), não o
// Instituto: por isso, no primeiro uso, um aviso diz isso e só segue depois do "Entendi". O aviso visto fica no aparelho
// (fora da cópia; o "apagar meus dados" apaga). O E4-10 e o E4-16 reaproveitam o aviso com useAvisoDaVoz().

/** A marca de "já li o aviso da voz" neste aparelho (prefixo privado da Escola: fora da cópia, sai no "apagar"). */
export const CHAVE_AVISO_DA_VOZ = "lucia:escola-privado:aviso-da-voz";

interface ResultadoDeFala {
  readonly isFinal: boolean;
  readonly 0: { transcript: string };
}
interface Reconhecedor {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((evento: { resultIndex: number; results: ArrayLike<ResultadoDeFala> }) => void) | null;
  onerror: ((evento: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type Construtor = new () => Reconhecedor;

/** O reconhecimento de fala do navegador, se houver. */
export function reconhecimentoDoNavegador(): Construtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: Construtor; webkitSpeechRecognition?: Construtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const nada = () => () => undefined;
/** Existe reconhecimento de fala? (false no servidor e na primeira pintura, para o HTML não mudar na hidratação) */
export function useTemVoz(): boolean {
  return useSyncExternalStore(nada, () => reconhecimentoDoNavegador() !== null, () => false);
}

const lerAviso = () => {
  try {
    return localStorage.getItem(CHAVE_AVISO_DA_VOZ) === "1";
  } catch {
    return false;
  }
};

/** O aviso da voz (texto no idioma da página) e se a pessoa já disse "Entendi" neste aparelho. */
export function useAvisoDaVoz(): { texto: string; entendi: string; agoraNao: string; aceito: boolean; aceitar: () => void } | null {
  const contexto = useTextosDaBusca();
  const [aceito, setAceito] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setAceito(lerAviso()), 0);
    return () => window.clearTimeout(id);
  }, []);
  if (!contexto) return null;
  const v = contexto.textos.voz;
  return {
    texto: v.aviso,
    entendi: v.entendi,
    agoraNao: v.agoraNao,
    aceito,
    aceitar: () => {
      try {
        localStorage.setItem(CHAVE_AVISO_DA_VOZ, "1");
      } catch {
        // sem armazenamento: o aviso volta na próxima vez, o que não faz mal
      }
      setAceito(true);
    },
  };
}

function Microfone({ className }: { className: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

/**
 * O botão de microfone ao lado do campo de busca. Ao terminar de ouvir, entrega o texto (o campo é preenchido e a
 * busca roda). Erro ou falta de permissão viram uma frase simples embaixo. Sem a Escola ligada ou sem reconhecimento
 * de fala no navegador, não aparece nada.
 */
export function BuscaPorVoz({ aoOuvir, className = "" }: { aoOuvir: (texto: string) => void; className?: string }) {
  const { lang } = useI18n();
  const contexto = useTextosDaBusca();
  const temVoz = useTemVoz();
  const aviso = useAvisoDaVoz();
  const [perguntando, setPerguntando] = useState(false);
  const [ouvindo, setOuvindo] = useState(false);
  const [erro, setErro] = useState("");
  const reconhecedor = useRef<Reconhecedor | null>(null);
  const aoOuvirRef = useRef(aoOuvir);
  useEffect(() => {
    aoOuvirRef.current = aoOuvir;
  });
  useEffect(() => () => reconhecedor.current?.abort(), []);

  if (!ligado("escola") || !temVoz || !contexto || !aviso) return null;
  const v = contexto.textos.voz;

  function ouvir() {
    const Construtor = reconhecimentoDoNavegador();
    if (!Construtor) return;
    setErro("");
    let r: Reconhecedor;
    try {
      r = new Construtor();
    } catch {
      setErro(v.erro);
      return;
    }
    r.lang = htmlLang[lang as Locale] ?? "pt-BR";
    r.interimResults = false;
    r.continuous = false;
    r.maxAlternatives = 1;
    r.onresult = (evento) => {
      let texto = "";
      for (let i = evento.resultIndex; i < evento.results.length; i++) if (evento.results[i].isFinal) texto += evento.results[i][0].transcript;
      texto = texto.trim();
      if (texto) aoOuvirRef.current(texto);
    };
    r.onerror = (evento) => {
      const motivo = evento.error;
      setErro(motivo === "not-allowed" || motivo === "service-not-allowed" ? v.semPermissao : motivo === "no-speech" || motivo === "audio-capture" ? v.naoOuviu : motivo === "network" ? v.semRede : motivo === "aborted" ? "" : v.erro);
    };
    r.onend = () => {
      setOuvindo(false);
      reconhecedor.current = null;
    };
    reconhecedor.current = r;
    try {
      r.start();
      setOuvindo(true);
    } catch {
      setErro(v.erro);
    }
  }

  function tocar() {
    if (ouvindo) {
      reconhecedor.current?.stop();
      return;
    }
    if (!aviso?.aceito) {
      setPerguntando(true);
      return;
    }
    ouvir();
  }

  return (
    <span className={`busca-voz relative inline-flex shrink-0 ${className}`}>
      <button
        type="button"
        onClick={tocar}
        aria-pressed={ouvindo}
        aria-label={ouvindo ? v.parar : v.botao}
        title={ouvindo ? v.parar : v.botao}
        data-busca-voz
        className={`busca-voz-botao flex cursor-pointer items-center justify-center ${ouvindo ? "text-oxblood" : "text-ink-soft hover:text-ink"}`}
      >
        <Microfone className="h-5 w-5" />
      </button>
      {perguntando && (
        <span
          role="dialog"
          aria-label={v.botao}
          onKeyDown={(e) => {
            // Esc fecha só o aviso (não a busca inteira).
            if (e.key === "Escape") {
              e.stopPropagation();
              setPerguntando(false);
            }
          }}
          className="busca-voz-aviso absolute right-0 top-[calc(100%+0.4rem)] z-50 border-2 border-ink bg-parchment p-3 text-left font-sans text-sm text-ink shadow-[3px_3px_0_var(--ink)]"
        >
          <span className="block">{aviso.texto}</span>
          <span className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              autoFocus
              className="botao-voz-ok cursor-pointer bg-ink px-4 py-2 font-semibold text-parchment hover:bg-oxblood"
              onClick={() => {
                aviso.aceitar();
                setPerguntando(false);
                ouvir();
              }}
            >
              {aviso.entendi}
            </button>
            <button type="button" className="cursor-pointer px-3 py-2 underline hover:text-oxblood" onClick={() => setPerguntando(false)}>
              {aviso.agoraNao}
            </button>
          </span>
        </span>
      )}
      {/* A região viva fica sempre montada (vazia quando não há nada a dizer), para o leitor de tela anunciar o
          "Ouvindo" e os erros quando eles chegam. */}
      <span
        role="status"
        aria-live="polite"
        className={
          !perguntando && (ouvindo || erro)
            ? "busca-voz-aviso absolute right-0 top-[calc(100%+0.4rem)] z-50 border-2 border-ink bg-parchment p-3 text-left font-sans text-sm text-ink shadow-[3px_3px_0_var(--ink)]"
            : "sr-only"
        }
      >
        {perguntando ? "" : ouvindo ? v.ouvindo : erro}
      </span>
    </span>
  );
}
