// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// As legendas do vídeo do story: a autora escreve cada trecho (de quando a quando, e se vai no meio da tela, como um "texto que
// aparece e some") ou gera no aparelho — só onde o navegador reconhece a fala SEM mandar o áudio para fora (processLocally); onde
// não dá, o botão explica e não manda nada a ninguém. Gerada, a legenda só sai depois de a autora marcar "Conferi" (ela aprova).
// No visor, a faixa de legenda acompanha o tempo do vídeo e liga/desliga (CC): com o som desligado, ela é a acessibilidade.
import { useId, useRef, useState, type RefObject } from "react";
import { limparLegendas, tempoCurto } from "@/lib/rede/stories/legendas";
import type { TextosDosStories } from "@/lib/rede/textos-stories";
import { LIMITES_DO_STORY, type LegendaDoVideo } from "@/lib/rede/tipos-stories";
import { preencherStory } from "../stories/usar";

type T = TextosDosStories["b1"]["legendas"];

/** O reconhecimento de fala do navegador, só o que usamos (o tipo não vem no TypeScript). */
interface Reconhecedor {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  processLocally?: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: (faixa?: MediaStreamTrack) => void;
  stop: () => void;
}
type ClasseDoReconhecedor = (new () => Reconhecedor) & { available?: (o: { langs: string[]; processLocally: boolean }) => Promise<string> };

const IDIOMA_DA_FALA: Record<string, string> = { pt: "pt-BR", en: "en-US", es: "es-ES", fr: "fr-FR", ru: "ru-RU", zh: "zh-CN" };

/** O reconhecedor que roda NO APARELHO, ou nulo (sem ele, nada de gerar: o áudio nunca sai daqui). */
async function reconhecedorLocal(lang: string): Promise<ClasseDoReconhecedor | null> {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: ClasseDoReconhecedor; webkitSpeechRecognition?: ClasseDoReconhecedor };
  const C = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!C || !("processLocally" in C.prototype) || typeof C.available !== "function") return null;
  try {
    const d = await C.available({ langs: [IDIOMA_DA_FALA[lang] ?? "pt-BR"], processLocally: true });
    return d === "available" ? C : null;
  } catch {
    return null;
  }
}

/**
 * Toca o trecho [inicio, fim] do vídeo e escuta a fala com o reconhecedor LOCAL (a faixa de áudio do próprio vídeo, sem mandar
 * nada para fora). Devolve as legendas achadas (tempo contado do início do trecho) ou nulo se o navegador recusou.
 */
function ouvirNoAparelho(v: HTMLVideoElement & { captureStream?: () => MediaStream }, C: ClasseDoReconhecedor, lang: string, inicio: number, fim: number) {
  const faixa = v.captureStream?.().getAudioTracks()[0];
  if (!faixa) return null;
  const r = new C();
  r.lang = IDIOMA_DA_FALA[lang] ?? "pt-BR";
  r.continuous = true;
  r.interimResults = false;
  r.processLocally = true;
  const achadas: LegendaDoVideo[] = [];
  let desde = 0;
  let acabar: (l: LegendaDoVideo[] | null) => void = () => undefined;
  const fimDaEscuta = new Promise<LegendaDoVideo[] | null>((pronto) => (acabar = pronto));
  r.onresult = (e) => {
    for (let k = e.resultIndex; k < e.results.length; k++) {
      const res = e.results[k];
      if (!res.isFinal) continue;
      const agora = Math.max(0, v.currentTime * 1000 - inicio);
      const texto = res[0].transcript.trim();
      if (texto) achadas.push({ de: desde, ate: Math.max(desde + 800, agora), texto: texto.slice(0, LIMITES_DO_STORY.legendaDoVideo) });
      desde = agora;
    }
  };
  const terminar = (falhou = false) => {
    v.removeEventListener("timeupdate", aoTempo);
    try {
      r.stop();
    } catch {
      /* já parou */
    }
    acabar(falhou ? null : achadas);
  };
  const aoTempo = () => {
    if (v.currentTime * 1000 >= fim - 60 || v.ended) terminar();
  };
  r.onerror = () => terminar(achadas.length === 0);
  v.currentTime = inicio / 1000;
  v.muted = false;
  v.addEventListener("timeupdate", aoTempo);
  try {
    r.start(faixa);
    void v.play().catch(() => terminar(true));
  } catch {
    terminar(true);
  }
  return { fim: fimDaEscuta, parar: () => terminar() };
}

export function EditarLegendas({
  t,
  lang,
  duracao,
  agulha,
  legendas,
  aoMudar,
  video,
  inicio,
  fim,
  geradas,
  aprovadas,
  aoGerar,
  aoAprovar,
}: {
  t: T;
  lang: string;
  /** A duração do trecho cortado (ms): as legendas contam a partir do início do corte. */
  duracao: number;
  /** Onde a prévia está agora, já contada do início do corte. */
  agulha: number;
  legendas: LegendaDoVideo[];
  aoMudar: (l: LegendaDoVideo[]) => void;
  video: RefObject<HTMLVideoElement | null>;
  inicio: number;
  fim: number;
  geradas: boolean;
  aprovadas: boolean;
  aoGerar: () => void;
  aoAprovar: (sim: boolean) => void;
}) {
  const id = useId();
  const [gerando, setGerando] = useState(false);
  const [aviso, setAviso] = useState("");
  const parar = useRef<(() => void) | null>(null);

  const nova = () => {
    const de = Math.max(0, Math.min(duracao - 500, Math.round(agulha)));
    aoMudar(limparLegendas([...legendas, { de, ate: Math.min(duracao, de + 2500), texto: "…" }], duracao));
  };
  const mudar = (k: number, n: Partial<LegendaDoVideo>) => aoMudar(legendas.map((l, j) => (j === k ? { ...l, ...n } : l)));

  async function gerar() {
    setAviso("");
    const C = await reconhecedorLocal(lang);
    if (!C || !video.current) return setAviso(t.semGerar);
    const escuta = ouvirNoAparelho(video.current, C, lang, inicio, fim);
    if (!escuta) return setAviso(t.semGerar);
    parar.current = escuta.parar;
    setGerando(true);
    const achadas = await escuta.fim;
    parar.current = null;
    setGerando(false);
    if (achadas === null) return setAviso(t.semGerar);
    const limpas = limparLegendas(achadas, duracao);
    if (limpas.length === 0) return setAviso(t.nenhumaFala);
    aoMudar(limpas);
    aoGerar();
  }

  return (
    <section className="al-ed-legendas" aria-labelledby={`${id}-t`}>
      <h3 id={`${id}-t`} className="al-cond al-st-titulo-secao">
        {t.titulo}
      </h3>
      <p className="al-st-dica">{t.ajuda}</p>
      {legendas.length > 0 ? (
        <ol className="al-ed-legendas-lista">
          {legendas.map((l, k) => (
            <li key={k} className="al-ed-legenda">
              <span className="al-ed-legenda-tempo" aria-hidden>
                {tempoCurto(l.de)}–{tempoCurto(l.ate)}
              </span>
              <label className="sr-only" htmlFor={`${id}-${k}`}>
                {preencherStory(t.texto, { n: k + 1 })}
              </label>
              <input
                id={`${id}-${k}`}
                className="al-ed-legenda-texto"
                value={l.texto}
                maxLength={LIMITES_DO_STORY.legendaDoVideo}
                onChange={(e) => mudar(k, { texto: e.target.value })}
                onBlur={() => aoMudar(limparLegendas(legendas, duracao))}
              />
              <span className="al-ed-legenda-num">
                <label>
                  {t.de}
                  <input type="number" min={0} max={duracao / 1000} step={0.1} value={(l.de / 1000).toFixed(1)} onChange={(e) => mudar(k, { de: Math.round(Number(e.target.value) * 1000) })} />
                </label>
                <label>
                  {t.ate}
                  <input type="number" min={0} max={duracao / 1000} step={0.1} value={(l.ate / 1000).toFixed(1)} onChange={(e) => mudar(k, { ate: Math.round(Number(e.target.value) * 1000) })} />
                </label>
              </span>
              <label className="al-ed-legenda-grande">
                <input type="checkbox" checked={!!l.grande} onChange={(e) => mudar(k, { grande: e.target.checked || undefined })} />
                {t.grande}
              </label>
              <button type="button" className="al-ed-legenda-tirar" aria-label={preencherStory(t.tirar, { n: k + 1 })} onClick={() => aoMudar(legendas.filter((_, j) => j !== k))}>
                ×
              </button>
            </li>
          ))}
        </ol>
      ) : null}
      <div className="al-ed-legendas-acoes">
        <button type="button" className="al-botao al-botao-contorno al-botao-p" disabled={legendas.length >= LIMITES_DO_STORY.legendas || gerando} onClick={nova}>
          {preencherStory(t.nova, { tempo: tempoCurto(agulha) })}
        </button>
        <button type="button" className="al-botao al-botao-contorno al-botao-p" aria-busy={gerando} onClick={() => (gerando ? parar.current?.() : void gerar())}>
          {gerando ? t.gerando : t.gerar}
        </button>
      </div>
      <p className="al-st-dica" role="status">
        {aviso || t.gerarAjuda}
      </p>
      {geradas && legendas.length > 0 ? (
        <label className="al-ed-legendas-aprovar">
          <input type="checkbox" checked={aprovadas} onChange={(e) => aoAprovar(e.target.checked)} />
          {t.aprovar}
        </label>
      ) : null}
    </section>
  );
}
