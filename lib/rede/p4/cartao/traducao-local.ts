// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 4, item 31: traduzir o post NO APARELHO, com o tradutor que o próprio navegador traz (a Translator API e o detector de
// língua, LanguageDetector, que rodam o modelo localmente). O texto do post nunca sai do aparelho por aqui: nenhum fetch, nenhum
// serviço de fora. Na primeira vez de um par de línguas, o navegador pode baixar o modelo do próprio fabricante (o texto não vai
// junto); a tela avisa antes. No modo leve, desligado (lib/rede/p4/cartao/regras.ts, estadoDaTraducaoNoAparelho).
// Onde o navegador não tem esse tradutor (Firefox, Safari, Chrome antigo), quem chama usa o caminho de antes, o NOSSO servidor de
// tradução (app/api/rede/traduzir, ALUMIA_TRADUCAO_URL), e a tela diz que o texto foi ao nosso servidor.
// Sem "@/" de propósito (o teste chama com um navegador falso).
import { estadoDaTraducaoNoAparelho, linguaDetectada, type EstadoDaTraducaoNoAparelho, type SinaisDoAparelho } from "./regras";

/** As partes do tradutor do navegador que este arquivo usa (o teste passa um falso). */
export interface TradutorDoNavegador {
  Translator?: {
    availability: (o: { sourceLanguage: string; targetLanguage: string }) => Promise<string>;
    create: (o: { sourceLanguage: string; targetLanguage: string }) => Promise<{ translate: (texto: string) => Promise<string>; destroy?: () => void }>;
  };
  LanguageDetector?: {
    availability?: () => Promise<string>;
    create: () => Promise<{ detect: (texto: string) => Promise<{ detectedLanguage?: string; confidence?: number }[]>; destroy?: () => void }>;
  };
}

/** O tradutor deste navegador (nulo fora do navegador ou sem a API). */
export function tradutorDoNavegador(): TradutorDoNavegador | null {
  if (typeof globalThis === "undefined") return null;
  const g = globalThis as unknown as TradutorDoNavegador & { window?: unknown };
  if (!g.window || !g.Translator || !g.LanguageDetector) return null;
  return { Translator: g.Translator, LanguageDetector: g.LanguageDetector };
}

/** Os sinais do aparelho para o modo leve (o atributo data-light da página, o Save-Data, a memória, os núcleos e a rede). */
export function sinaisDoAparelho(): SinaisDoAparelho {
  if (typeof navigator === "undefined") return { leveEscolhido: true };
  const n = navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string }; deviceMemory?: number };
  return {
    leveEscolhido: typeof document !== "undefined" && document.documentElement.hasAttribute("data-light"),
    saveData: n.connection?.saveData === true,
    effectiveType: n.connection?.effectiveType,
    deviceMemory: n.deviceMemory,
    hardwareConcurrency: n.hardwareConcurrency,
  };
}

/** O aparelho pode tentar traduzir sozinho (tem o tradutor e não está no modo leve)? Sem perguntar par nenhum ainda. */
export function aparelhoPodeTentar(api: TradutorDoNavegador | null, s: SinaisDoAparelho): boolean {
  return Boolean(api?.Translator && api.LanguageDetector) && estadoDaTraducaoNoAparelho(s, "available") !== "desligada_no_leve";
}

export type ResultadoNoAparelho =
  | { ok: true; texto: string; titulo: string | null; origem: string }
  | { ok: false; motivo: EstadoDaTraducaoNoAparelho | "sem_lingua" | "falhou" };

/**
 * Traduz título e texto para `destino`, só no aparelho. Detecta a língua do texto (sem certeza, desiste: "sem_lingua"); já na
 * língua da página, devolve o texto como está. Nada sai do aparelho: quando não dá, devolve o motivo e quem chama decide.
 */
export async function traduzirNoAparelho(
  api: TradutorDoNavegador | null,
  s: SinaisDoAparelho,
  texto: string,
  titulo: string | null,
  destino: string,
): Promise<ResultadoNoAparelho> {
  if (!api?.Translator || !api.LanguageDetector) return { ok: false, motivo: "sem_modelo" };
  if (estadoDaTraducaoNoAparelho(s, "available") === "desligada_no_leve") return { ok: false, motivo: "desligada_no_leve" };
  try {
    const detector = await api.LanguageDetector.create();
    const origem = linguaDetectada(await detector.detect(`${titulo ?? ""}\n${texto}`.trim()));
    detector.destroy?.();
    if (!origem) return { ok: false, motivo: "sem_lingua" };
    if (origem === destino) return { ok: true, texto, titulo, origem };
    const estado = estadoDaTraducaoNoAparelho(s, await api.Translator.availability({ sourceLanguage: origem, targetLanguage: destino }));
    if (estado !== "pronta" && estado !== "baixar") return { ok: false, motivo: estado };
    const tradutor = await api.Translator.create({ sourceLanguage: origem, targetLanguage: destino });
    const traduzido = await tradutor.translate(texto);
    const tituloTraduzido = titulo?.trim() ? await tradutor.translate(titulo) : null;
    tradutor.destroy?.();
    return { ok: true, texto: traduzido, titulo: tituloTraduzido, origem };
  } catch {
    return { ok: false, motivo: "falhou" };
  }
}
