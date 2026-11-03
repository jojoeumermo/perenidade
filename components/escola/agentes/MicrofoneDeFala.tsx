// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import { reconhecimentoDoNavegador, useAvisoDaVoz, useTemVoz } from "@/components/busca/BuscaPorVoz";
import { SelosDePrivacidade } from "@/components/SeloDePrivacidade";
import type { TextosDosAgentes } from "@/i18n/escola/agentes";
import { SELOS_DE_FORA } from "@/lib/selos";

/** O idioma do reconhecimento de fala, pelo idioma da página. */
export const IDIOMA_DA_VOZ: Record<string, string> = { pt: "pt-BR", en: "en-US", es: "es-ES", fr: "fr-FR", ru: "ru-RU", zh: "zh-CN" };

/**
 * O microfone do ensaio de oratória (opcional). Quem transcreve é o reconhecimento de fala do navegador (o áudio pode ir
 * à empresa dele): por isso o aviso da voz (o mesmo da busca por voz) e o selo, e só segue depois do "Entendi". A
 * transcrição aparece em tempo real no campo editável. O Instituto não grava áudio: o que pode sair é o texto do
 * campo, quando a pessoa aperta o botão da conversa.
 */
export function MicrofoneDeFala({ s, lang, texto, preencher }: { s: TextosDosAgentes["oratoria"]; lang: string; texto: string; preencher: (texto: string) => void }) {
  const temVoz = useTemVoz();
  const aviso = useAvisoDaVoz();
  const [perguntando, setPerguntando] = useState(false);
  const [ouvindo, setOuvindo] = useState(false);
  const [erro, setErro] = useState("");
  const atual = useRef<{ stop(): void; abort(): void } | null>(null);
  useEffect(() => () => atual.current?.abort(), []);
  if (!temVoz || !aviso) return null;

  function ouvir() {
    const Construtor = reconhecimentoDoNavegador();
    if (!Construtor) return;
    setErro("");
    let r: InstanceType<typeof Construtor>;
    try {
      r = new Construtor();
    } catch {
      setErro(s.erroVoz);
      return;
    }
    const base = texto.trim();
    r.lang = IDIOMA_DA_VOZ[lang] ?? "pt-BR";
    r.interimResults = true;
    r.continuous = true;
    r.maxAlternatives = 1;
    r.onresult = (evento) => {
      let falado = "";
      for (let i = 0; i < evento.results.length; i++) falado += `${evento.results[i][0].transcript} `;
      preencher(`${base} ${falado}`.trim());
    };
    r.onerror = (evento) => setErro(evento.error === "not-allowed" || evento.error === "service-not-allowed" ? s.semPermissao : evento.error === "no-speech" || evento.error === "audio-capture" ? s.naoOuviu : evento.error === "aborted" ? "" : s.erroVoz);
    r.onend = () => {
      setOuvindo(false);
      atual.current = null;
    };
    atual.current = r;
    try {
      r.start();
      setOuvindo(true);
    } catch {
      setErro(s.erroVoz);
    }
  }

  return (
    <div className="mt-3" data-microfone-de-fala>
      <p className="text-sm">{s.avisoDaVoz}</p>
      <SelosDePrivacidade item={SELOS_DE_FORA.reconhecimentoDeFala} lang={lang} className="mt-1" />
      <button
        type="button"
        className="acompanhante-botao-claro mt-2"
        aria-pressed={ouvindo}
        onClick={() => {
          if (ouvindo) atual.current?.stop();
          else if (aviso && !aviso.aceito) setPerguntando(true);
          else ouvir();
        }}
      >
        {ouvindo ? s.pararMicrofone : s.microfone}
      </button>
      {perguntando && aviso && (
        <div role="group" aria-label={s.microfone} className="mt-2 border-2 border-ink bg-parchment p-3 text-sm">
          <p>{aviso.texto}</p>
          <p className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="acompanhante-botao"
              onClick={() => {
                aviso.aceitar();
                setPerguntando(false);
                ouvir();
              }}
            >
              {aviso.entendi}
            </button>
            <button type="button" className="acompanhante-botao-claro" onClick={() => setPerguntando(false)}>
              {aviso.agoraNao}
            </button>
          </p>
        </div>
      )}
      <p role="status" aria-live="polite" className="mt-1 text-sm text-ink-soft">
        {ouvindo ? s.ouvindo : erro}
      </p>
    </div>
  );
}
