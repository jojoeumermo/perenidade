// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// "Ouvir o post" (L2-38): a voz é a do PRÓPRIO aparelho (speechSynthesis). Só entram as vozes que o navegador marca como locais
// (localService): as vozes "de rede" de alguns navegadores mandam o texto para um serviço de fora, e essas ficam de fora. Sem voz
// local no idioma, o botão não aparece. As contas puras ficam aqui (os testes rodam no Node); a fala fica em
// components/rede/midia/BotaoOuvir.tsx. Sem "@/" de propósito.

/** O que a tela usa de cada voz (o SpeechSynthesisVoice do navegador tem estes campos). */
export interface VozDoAparelho {
  name: string;
  lang: string;
  localService: boolean;
  default?: boolean;
  voiceURI?: string;
}

/** A língua da página vira a etiqueta da voz preferida (o português do Brasil primeiro). */
export const ETIQUETA_DA_LINGUA: Record<string, string> = { pt: "pt-BR", en: "en-US", es: "es-ES", fr: "fr-FR", ru: "ru-RU", zh: "zh-CN" };

const normal = (lang: string) => (lang || "").replace(/_/g, "-").toLowerCase();

/**
 * A voz para a língua da página: só as locais; primeiro a da etiqueta exata (pt-BR), depois qualquer uma da mesma língua (pt-PT),
 * e entre as que empatam, a padrão do aparelho. Nenhuma local = nulo (o botão não aparece). Pura.
 */
export function escolherVoz<V extends VozDoAparelho>(vozes: readonly V[], lang: string): V | null {
  const etiqueta = normal(ETIQUETA_DA_LINGUA[lang] ?? lang);
  const lingua = etiqueta.split("-")[0];
  const locais = vozes.filter((v) => v.localService === true && v.lang);
  const exatas = locais.filter((v) => normal(v.lang) === etiqueta);
  const mesmas = locais.filter((v) => normal(v.lang).split("-")[0] === lingua);
  const melhor = (lista: V[]) => lista.find((v) => v.default) ?? lista[0] ?? null;
  return melhor(exatas) ?? melhor(mesmas);
}

/**
 * O texto que a voz lê: o aviso de conteúdo (se houver), o título e o texto (o corpo inteiro, no texto longo). Endereços viram
 * "link" (ninguém quer ouvir "h t t p s"), as marcas de formatação saem e os espaços se juntam. Pura.
 */
export function textoParaOuvir(
  p: { titulo?: string | null; texto: string; corpo?: string | null; aviso?: string | null },
  rotulos: { aviso: string; link: string },
): string {
  const partes: string[] = [];
  const aviso = (p.aviso ?? "").trim();
  if (aviso) partes.push(`${rotulos.aviso}: ${aviso}.`);
  const titulo = (p.titulo ?? "").trim();
  if (titulo) partes.push(/[.!?…:]$/.test(titulo) ? titulo : `${titulo}.`);
  partes.push(((p.corpo ?? "").trim() || p.texto || "").trim());
  return partes
    .join(" ")
    .replace(/https?:\/\/[^\s)]+/gi, rotulos.link)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/(^|\s)[#>]+\s*/g, "$1")
    .replace(/[*_~`|]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * O texto em trechos de até `max` letras, cortados no fim da frase (ou na vírgula, ou no espaço): alguns navegadores param no meio
 * de uma fala longa, e trechos curtos também deixam "Parar" responder na hora. Pura.
 */
export function trechosParaFalar(texto: string, max = 220): string[] {
  const limpo = (texto ?? "").replace(/\s+/g, " ").trim();
  if (!limpo) return [];
  const frases = limpo.match(/[^.!?…;]+[.!?…;]*\s*/g) ?? [limpo];
  const saida: string[] = [];
  let atual = "";
  const empurrar = (t: string) => {
    const x = t.trim();
    if (x) saida.push(x);
  };
  for (const frase of frases) {
    if ((atual + frase).length <= max) {
      atual += frase;
      continue;
    }
    empurrar(atual);
    atual = "";
    if (frase.length <= max) {
      atual = frase;
      continue;
    }
    // Frase longa demais: corta na vírgula ou no espaço mais perto do limite.
    let resto = frase;
    while (resto.length > max) {
      const janela = resto.slice(0, max);
      const corte = Math.max(janela.lastIndexOf(", "), janela.lastIndexOf(" "));
      const ponto = corte > max / 3 ? corte + 1 : max;
      empurrar(resto.slice(0, ponto));
      resto = resto.slice(ponto);
    }
    atual = resto;
  }
  empurrar(atual);
  return saida;
}
