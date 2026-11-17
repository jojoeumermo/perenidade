// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Ditar a transcrição NO APARELHO. O reconhecimento de fala dos navegadores, por padrão, manda o áudio para um serviço de fora;
// aqui ele só é oferecido quando o navegador garante o modo local (processLocally) E já tem o idioma instalado. Não pedimos para
// baixar pacote de idioma (seria um serviço de fora). O áudio do post toca escondido para o reconhecedor; o texto que sai fica só
// na tela, para a autora revisar, e só vai ao banco quando ela aprova. Sem suporte, a opção não aparece. Só roda no navegador.
// Sem "@/" de propósito.
import { ETIQUETA_DA_LINGUA } from "./voz";

interface ResultadoDaFala {
  isFinal: boolean;
  0: { transcript: string };
}
interface EventoDaFala {
  resultIndex: number;
  results: ArrayLike<ResultadoDaFala>;
}
interface Reconhecedor {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  processLocally: boolean;
  onresult: ((e: EventoDaFala) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onend: (() => void) | null;
  start: (faixa?: MediaStreamTrack) => void;
  stop: () => void;
}
interface ClasseDoReconhecedor {
  new (): Reconhecedor;
  available?: (o: { langs: string[]; processLocally: boolean }) => Promise<string>;
  prototype: object;
}

function classe(): ClasseDoReconhecedor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: ClasseDoReconhecedor };
  // Só o nome sem prefixo: as versões antigas ("webkit…") não têm o modo local.
  return w.SpeechRecognition ?? null;
}

/** O aparelho transcreve este idioma sem mandar nada para fora? (Falso em qualquer dúvida.) */
export async function ditadoNoAparelho(lang: string): Promise<boolean> {
  const C = classe();
  if (!C || typeof C.available !== "function" || !("processLocally" in C.prototype)) return false;
  if (typeof HTMLMediaElement === "undefined" || !("captureStream" in HTMLMediaElement.prototype)) return false;
  try {
    return (await C.available({ langs: [ETIQUETA_DA_LINGUA[lang] ?? lang], processLocally: true })) === "available";
  } catch {
    return false;
  }
}

/**
 * Toca o áudio escondido e transcreve no aparelho. `aoTexto` recebe o texto até agora (as partes finais juntas); `aoFim`, no fim
 * (com "sem_ditado" quando o navegador recusou). Devolve a função de parar.
 */
export function ditarAudio(url: string, lang: string, aoTexto: (texto: string) => void, aoFim: (erro?: string) => void): () => void {
  const C = classe();
  if (!C) {
    aoFim("sem_ditado");
    return () => undefined;
  }
  const audio = document.createElement("audio");
  audio.preload = "auto";
  // O endereço assinado é de outro domínio: sem CORS, o fluxo sairia mudo.
  audio.crossOrigin = "anonymous";
  audio.src = url;
  const r = new C();
  r.lang = ETIQUETA_DA_LINGUA[lang] ?? lang;
  r.continuous = true;
  r.interimResults = false;
  r.processLocally = true;
  let finais = "";
  let terminou = false;
  const fim = (erro?: string) => {
    if (terminou) return;
    terminou = true;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    try {
      r.stop();
    } catch {
      /* já parado */
    }
    aoFim(erro);
  };
  r.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      if (res.isFinal) finais = `${finais} ${res[0].transcript}`.trim();
    }
    aoTexto(finais);
  };
  r.onerror = () => fim("sem_ditado");
  r.onend = () => fim();
  audio.addEventListener("ended", () => window.setTimeout(() => fim(), 800), { once: true });
  audio.addEventListener("error", () => fim("sem_ditado"), { once: true });
  void (async () => {
    try {
      await audio.play();
      const fluxo = (audio as HTMLAudioElement & { captureStream: () => MediaStream }).captureStream();
      const faixa = fluxo.getAudioTracks()[0];
      if (!faixa) return fim("sem_ditado");
      r.start(faixa);
    } catch {
      fim("sem_ditado");
    }
  })();
  return () => fim();
}
