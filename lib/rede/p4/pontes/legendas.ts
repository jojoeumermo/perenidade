// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 4, item 88 (atrás de "alumia-p4-pontes"): legendas ao vivo na sala de voz, feitas NO APARELHO (regra 6). O reconhecimento
// de fala dos navegadores, por padrão, manda o áudio para um serviço de fora; aqui ele só é usado quando o navegador garante o modo
// local (processLocally) e já tem o idioma instalado, a mesma conferência das legendas dos stories e do ditado
// (lib/rede/midia/reconhecer.ts). Não pedimos para baixar pacote de idioma. Cada faixa de áudio de quem fala na sala vai direto ao
// reconhecedor local (start(faixa)); o texto fica só na tela, nunca é gravado nem enviado. Sem suporte, a opção não aparece.
// Sem "@/" de propósito (roda nos testes, com um reconhecedor de mentira).
import { ETIQUETA_DA_LINGUA } from "../../midia/voz";

interface ResultadoDaFala {
  isFinal: boolean;
  0: { transcript: string };
}
interface EventoDaFala {
  resultIndex: number;
  results: ArrayLike<ResultadoDaFala>;
}
export interface ReconhecedorLocal {
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
export interface ClasseDoReconhecedor {
  new (): ReconhecedorLocal;
  available?: (o: { langs: string[]; processLocally: boolean }) => Promise<string>;
  prototype: object;
}

/** O reconhecedor do navegador, só o nome sem prefixo (as versões antigas, "webkit…", não têm o modo local). */
export function classeDoReconhecedor(janela: unknown = typeof window === "undefined" ? undefined : window): ClasseDoReconhecedor | null {
  const w = janela as { SpeechRecognition?: ClasseDoReconhecedor } | undefined;
  return w?.SpeechRecognition ?? null;
}

/** O aparelho faz legenda neste idioma sem mandar nada para fora? (Falso em qualquer dúvida.) */
export async function legendasNoAparelho(lang: string, C: ClasseDoReconhecedor | null = classeDoReconhecedor()): Promise<boolean> {
  if (!C || typeof C.available !== "function" || !("processLocally" in C.prototype)) return false;
  try {
    return (await C.available({ langs: [ETIQUETA_DA_LINGUA[lang] ?? lang], processLocally: true })) === "available";
  } catch {
    return false;
  }
}

/** A faixa de áudio, como a legenda precisa dela (só o que é lido). */
export interface FaixaParaLegendar {
  readyState: string;
}

/**
 * Legenda uma faixa de áudio (de quem fala na sala) no aparelho. `aoTexto` recebe a fala atual (provisória ou final). Devolve a
 * função de parar. Sem o modo local garantido, não liga (e chama `aoFim("sem_legenda")`). Recomeça sozinho se o navegador encerrar
 * (as falas longas encerram), até a pessoa parar.
 */
export function legendarFaixa(
  faixa: FaixaParaLegendar,
  lang: string,
  aoTexto: (texto: string, final: boolean) => void,
  aoFim: (erro?: string) => void = () => undefined,
  C: ClasseDoReconhecedor | null = classeDoReconhecedor(),
): () => void {
  if (!C || !("processLocally" in C.prototype)) {
    aoFim("sem_legenda");
    return () => undefined;
  }
  const Classe = C;
  let parado = false;
  let r: ReconhecedorLocal | null = null;
  const ligar = () => {
    if (parado) return;
    const novo = new Classe();
    novo.lang = ETIQUETA_DA_LINGUA[lang] ?? lang;
    novo.continuous = true;
    novo.interimResults = true;
    novo.processLocally = true;
    // Conferência depois de pôr: um navegador que não aceita o modo local não liga.
    if (novo.processLocally !== true) {
      parado = true;
      aoFim("sem_legenda");
      return;
    }
    novo.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const texto = String(res?.[0]?.transcript ?? "").trim();
        if (texto) aoTexto(texto, res.isFinal);
      }
    };
    novo.onerror = () => {
      parado = true;
      aoFim("sem_legenda");
    };
    novo.onend = () => {
      if (!parado && faixa.readyState === "live") ligar();
    };
    r = novo;
    try {
      novo.start(faixa as unknown as MediaStreamTrack);
    } catch {
      parado = true;
      aoFim("sem_legenda");
    }
  };
  ligar();
  return () => {
    parado = true;
    try {
      r?.stop();
    } catch {
      // já parado
    }
  };
}

export interface LinhaDeLegenda {
  quem: string;
  texto: string;
  final: boolean;
  em: number;
}

/**
 * As legendas na tela: a fala provisória de cada pessoa é trocada pela seguinte; as finais ficam, só as últimas `max`, e somem
 * depois de `validade` ms. Nada é guardado fora da memória da tela.
 */
export function juntarLegenda(linhas: readonly LinhaDeLegenda[], nova: LinhaDeLegenda, max = 4, validade = 15_000): LinhaDeLegenda[] {
  const vivas = linhas.filter((l) => nova.em - l.em < validade && !(l.quem === nova.quem && !l.final));
  return [...vivas, nova].slice(-max);
}
