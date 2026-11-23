// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As regras puras do grupo "cartão do post" do prompt 4 (itens 30, 31, 35 e 120), sem tela e sem banco. O banco decide de verdade
// o que vale (supabase/migracoes/20261127-p4-cartao-do-post.sql) e o tradutor do aparelho (./traducao-local.ts); a tela só esconde o que não daria em nada. Sem "@/" de propósito
// (roda nos testes).
import type { Post } from "../../tipos";

// ── Item 30: reações próprias da comunidade ──────────────────────────────────────────────────────────────────────────────

/** Até quantos emojis a mediação escolhe. */
export const MAXIMO_DE_EMOJIS = 6;

/** A faixa dos emojis (a mesma de interno.rede_p4_emoji_ok): setas e símbolos, pictogramas, seletor, junção, tecla, etiquetas. */
const FAIXA_DOS_EMOJIS = /^[←-⯿\u{1F000}-\u{1FAFF}️‍⃣\u{E0020}-\u{E007F}©®〰〽㊗㊙]+$/u;

/** O emoji pode entrar numa lista da mediação? De 1 a 16 unidades, só da faixa dos emojis, sem o gesto obsceno. */
export function emojiAceito(emoji: string): boolean {
  if (typeof emoji !== "string") return false;
  const tamanho = [...emoji].length;
  return tamanho >= 1 && tamanho <= 16 && FAIXA_DOS_EMOJIS.test(emoji) && !emoji.includes("\u{1F595}");
}

/** Separa o que a mediação digitou em emojis (um por grafema), sem espaços nem vírgulas. */
export function separarEmojis(texto: string): string[] {
  const limpo = String(texto ?? "").replace(/[\s,;]+/g, "");
  if (!limpo) return [];
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment: (s: string) => Iterable<{ segment: string }> } }).Segmenter;
  if (Seg) return [...new Seg(undefined, { granularity: "grapheme" }).segment(limpo)].map((s) => s.segment);
  return [...limpo];
}

export type ProblemaDaLista = "vazia" | "muitos" | "emoji" | "repetido";

/** Confere a lista antes de mandar (o banco confere de novo). Vazia é válida: volta à lista padrão. */
export function conferirLista(lista: readonly string[]): ProblemaDaLista | null {
  if (lista.length > MAXIMO_DE_EMOJIS) return "muitos";
  if (lista.some((e) => !emojiAceito(e))) return "emoji";
  if (new Set(lista).size !== lista.length) return "repetido";
  return null;
}

/** A paleta de um post: a lista em vigor que o banco mandou (se ela veio boa), senão a padrão. */
export function paletaDoPost(emBanco: readonly string[] | null | undefined, padrao: readonly string[]): string[] {
  const lista = (emBanco ?? []).filter((e) => emojiAceito(e)).slice(0, Math.max(MAXIMO_DE_EMOJIS, padrao.length));
  return lista.length > 0 ? [...new Set(lista)] : [...padrao];
}

// ── Item 35: coleções públicas curadas ───────────────────────────────────────────────────────────────────────────────────

/** Só a pasta privada vira pública (a do núcleo, nunca). */
export function pastaPodeSerPublica(pasta: { nucleo: unknown }): boolean {
  return !pasta.nucleo;
}

/** O endereço da coleção no perfil da dona (a fileira de coleções do acervo). */
export function caminhoDaColecao(handle: string): string {
  return `/u/${encodeURIComponent(handle)}`;
}

// ── Item 120: exportar o post como imagem ────────────────────────────────────────────────────────────────────────────────

/**
 * O post pode sair como imagem (Instagram, WhatsApp)? Só o que já é aberto à internet, fora da fila, sem cifra e sem aviso de
 * conteúdo que esconderia o texto. Post restrito (membros, seguidores, comunidade, núcleo, equipe) não exporta, nem o da
 * própria pessoa: a imagem circula fora sem a trava de quem vê.
 */
export function postPodeVirarImagem(post: Pick<Post, "publico" | "retido"> & { corpo_grupo?: string | null; grupo?: string | null }): boolean {
  return post.publico === "internet" && !post.retido && !post.corpo_grupo && !post.grupo;
}

/** Os destinos da imagem e o formato de cada um (o tamanho está em lib/rede/alcance/arte.ts, TAMANHOS). */
export const DESTINOS_DA_IMAGEM = [
  { destino: "instagram-feed", formato: "retrato" },
  { destino: "instagram-stories", formato: "story" },
  { destino: "whatsapp", formato: "quadrado" },
  { destino: "whatsapp-status", formato: "story" },
] as const;
export type DestinoDaImagem = (typeof DESTINOS_DA_IMAGEM)[number]["destino"];

/** O perfil do Instituto que toda imagem leva. */
export const ARROBA_DO_INSTITUTO = "@institutoluciaorg";

/** O pé da imagem: o endereço da Alumia (sem "https://" e sem barra no fim) e o @ do Instituto. */
export function rodapeDaImagem(enderecoDaAlumia: string): string {
  let host = "";
  try {
    const u = new URL(enderecoDaAlumia);
    host = `${u.host}${u.pathname.replace(/\/+$/, "")}`;
  } catch {
    host = String(enderecoDaAlumia ?? "").replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  }
  return host ? `${host} · ${ARROBA_DO_INSTITUTO}` : ARROBA_DO_INSTITUTO;
}

/** Quem aparece na imagem: o codinome e o @, ou ninguém (a pessoa escolheu esconder a autora). */
export function autoriaDaImagem(post: Pick<Post, "autor">, esconder: boolean): { codinome: string; handle: string | null } {
  if (esconder) return { codinome: "", handle: null };
  const a = post.autor;
  return { codinome: a.codinome, handle: a.perfil && a.handle && !a.handle.includes("@") ? a.handle : null };
}

// ── Item 31: traduzir no aparelho ────────────────────────────────────────────────────────────────────────────────────────

/** O que o aparelho diz de si (as partes de navigator que contam; todas opcionais). */
export interface SinaisDoAparelho {
  saveData?: boolean;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  effectiveType?: string;
  /** A pessoa está na versão leve (o atributo data-light da página) ou pediu economia de dados. */
  leveEscolhido?: boolean;
}

/** O aparelho está no modo leve (economia de dados, pouca memória, poucos núcleos ou rede 2G)? */
export function aparelhoLeve(s: SinaisDoAparelho): boolean {
  return Boolean(
    s.leveEscolhido || s.saveData || (typeof s.deviceMemory === "number" && s.deviceMemory < 4) ||
      (typeof s.hardwareConcurrency === "number" && s.hardwareConcurrency <= 2) || /(^|-)2g$/.test(s.effectiveType ?? ""),
  );
}

/**
 * O que o tradutor que o próprio navegador traz (a Translator API, que roda o modelo no aparelho) diz de um par de línguas:
 * "available" (o modelo já está no aparelho), "downloadable" ou "downloading" (o navegador baixa o modelo uma vez, do próprio
 * fabricante; o texto do post não vai junto) e "unavailable".
 */
export type DisponibilidadeNoAparelho = "available" | "downloadable" | "downloading" | "unavailable";

export type EstadoDaTraducaoNoAparelho = "desligada_no_leve" | "sem_modelo" | "baixar" | "pronta";

/**
 * A tradução no aparelho pode rodar? No modo leve, nunca (o modelo é grande demais para ele). Fora dele, pelo que o tradutor do
 * navegador diz do par de línguas; sem o tradutor no navegador, "sem_modelo" (aí a tela usa o nosso servidor, e diz isso).
 */
export function estadoDaTraducaoNoAparelho(s: SinaisDoAparelho, disponibilidade: string | null | undefined): EstadoDaTraducaoNoAparelho {
  if (aparelhoLeve(s)) return "desligada_no_leve";
  if (disponibilidade === "available") return "pronta";
  if (disponibilidade === "downloadable" || disponibilidade === "downloading") return "baixar";
  return "sem_modelo";
}

/** A língua que o detector do aparelho achou, só se ele tiver certeza bastante (60%) e for uma etiqueta de língua de verdade. */
export function linguaDetectada(resultados: readonly { detectedLanguage?: string; confidence?: number }[] | null | undefined): string | null {
  const melhor = [...(resultados ?? [])].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];
  const l = melhor?.detectedLanguage ?? "";
  if (!melhor || (melhor.confidence ?? 0) < 0.6 || !/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(l) || l === "und") return null;
  return l.split("-")[0];
}
