// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { reconhecimentoDoNavegador, useAvisoDaVoz, useTemVoz } from "@/components/busca/BuscaPorVoz";
import { L } from "@/components/I18n";
import { SeloDePrivacidade } from "@/components/SeloDePrivacidade";
import { falar, temVoz } from "@/lib/pratica";
import { Conversa, type Textos } from "./Conversa";

// Conversa em inglês ou espanhol (R1-58): respostas curtas no idioma da prática, com a correção gentil entre colchetes.
// A fala é opcional: o reconhecimento de voz é o do navegador (o áudio pode ir para a empresa do navegador), com o
// mesmo aviso da busca por voz (E4-05), que só segue depois do "Entendi". A resposta é lida pela voz do aparelho.

type Alvo = "en" | "es";
const VOZ: Record<Alvo, string> = { en: "en-US", es: "es-ES" };

interface Reconhecedor {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((evento: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((evento: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

/** O texto para a voz ler: sem Markdown e sem a correção entre colchetes (que é para ler, não para ouvir). */
export const paraFalar = (texto: string) =>
  texto
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[*_`#>$]/g, "")
    .replace(/\s+/g, " ")
    .trim();

function Microfone({ s, alvo, preencher }: { s: Textos["idioma"]; alvo: Alvo; preencher: (texto: string) => void }) {
  const temReconhecimento = useTemVoz();
  const aviso = useAvisoDaVoz();
  const [perguntando, setPerguntando] = useState(false);
  const [ouvindo, setOuvindo] = useState(false);
  const [erro, setErro] = useState("");
  const atual = useRef<Reconhecedor | null>(null);
  useEffect(() => () => atual.current?.abort(), []);
  if (!temReconhecimento || !aviso) return null;

  function ouvir() {
    const Construtor = reconhecimentoDoNavegador() as unknown as (new () => Reconhecedor) | null;
    if (!Construtor) return;
    setErro("");
    let r: Reconhecedor;
    try {
      r = new Construtor();
    } catch {
      setErro(s.erroVoz);
      return;
    }
    r.lang = VOZ[alvo];
    r.interimResults = false;
    r.continuous = false;
    r.maxAlternatives = 1;
    r.onresult = (evento) => {
      let texto = "";
      for (let i = evento.resultIndex; i < evento.results.length; i++) if (evento.results[i].isFinal) texto += evento.results[i][0].transcript;
      if (texto.trim()) preencher(texto.trim());
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
    <div className="mt-2">
      <button
        type="button"
        className="acompanhante-botao-claro"
        aria-pressed={ouvindo}
        onClick={() => {
          if (ouvindo) atual.current?.stop();
          else if (!aviso.aceito) setPerguntando(true);
          else ouvir();
        }}
      >
        {ouvindo ? s.parar : s.microfone}
      </button>
      {perguntando && (
        <div role="group" aria-label={s.microfone} className="mt-2 border-2 border-ink bg-parchment p-3 text-sm">
          <p>{aviso.texto}</p>
          <p className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              autoFocus
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
      <SeloDePrivacidade tipo="externo" servico="reconhecimentoDeFala" parte="voz" className="mt-2" />
      <p role="status" aria-live="polite" className="text-sm text-oxblood">
        {erro}
      </p>
    </div>
  );
}

export function ConversaDeIdioma({ s }: { s: Textos }) {
  const id = useId();
  const [alvo, setAlvo] = useState<Alvo>("en");
  const i = s.idioma;
  return (
    <div data-conversa-idioma>
      <fieldset>
        <legend className="font-semibold">{i.escolha}</legend>
        <div className="mt-2 flex flex-wrap gap-4">
          {(["en", "es"] as const).map((l) => (
            <label key={l} className="flex min-h-11 cursor-pointer items-center gap-2">
              <input type="radio" name={`${id}-alvo`} value={l} checked={alvo === l} onChange={() => setAlvo(l)} className="h-5 w-5" />
              {l === "en" ? i.ingles : i.espanhol}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="mt-3 text-ink-soft" lang={alvo}>
        {i.comecar}
      </p>
      <Conversa
        key={alvo}
        s={s}
        modo="conversa"
        contexto={{ idiomaAlvo: alvo }}
        idiomaAlvo={alvo}
        itens={["pergunta", "idioma"]}
        campo={{ rotulo: i.fala, dica: i.falaDica, max: 600, min: 1, linhas: 2, lang: alvo }}
        semServidor="aviso"
        extraNoCampo={(preencher) => <Microfone s={i} alvo={alvo} preencher={preencher} />}
        acaoNaResposta={(texto) =>
          temVoz() ? (
            <button type="button" className="acompanhante-botao-claro mt-2" onClick={() => void falar(paraFalar(texto), VOZ[alvo])}>
              {i.ouvir}
            </button>
          ) : null
        }
      />
      {/* O "Ouvir a resposta" usa a voz do aparelho; em alguns navegadores, ela é gerada pela empresa do navegador. */}
      <SeloDePrivacidade tipo="externo" servico="vozDoNavegador" className="mt-3" />
      <p className="mt-6">
        {i.trilhas}{" "}
        <L href="/trilhas/ingles-do-zero" className="underline hover:text-oxblood">
          {i.trilhaIngles}
        </L>
        {" · "}
        <L href="/trilhas/espanhol-do-zero" className="underline hover:text-oxblood">
          {i.trilhaEspanhol}
        </L>
      </p>
    </div>
  );
}
