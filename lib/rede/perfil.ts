// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Regras puras do perfil da Rede v2 (pacote "perfil"): a galeria de rosto e de capa, o formato do @nome, o que "estudando agora" e
// os selos de trilha podem ser, e como ler o progresso do aparelho SÓ quando a pessoa liga. Sem DOM, sem "@/" (roda no Node nos
// testes). O banco confere tudo de novo: isto é a primeira tranca, para a tela não pedir o que o servidor vai recusar.
import type { Estudando, ImagemDePerfil } from "./tipos-perfil";

/** Os 24 rostos ilustrados (public/rede/avatares/aNN.svg), feitos por scripts/gerar-avatares-rede.mjs. */
export const AVATARES: readonly string[] = Array.from({ length: 24 }, (_, i) => `a${String(i + 1).padStart(2, "0")}`);
/** Os 8 padrões de capa (public/rede/capas/cNN.svg). */
export const CAPAS: readonly string[] = Array.from({ length: 8 }, (_, i) => `c${String(i + 1).padStart(2, "0")}`);

export const avatarDaGaleria = (id: string): boolean => /^a(0[1-9]|1[0-9]|2[0-4])$/.test(id);
export const capaDaGaleria = (id: string): boolean => /^c0[1-8]$/.test(id);

export const caminhoDoAvatar = (id: string): string => `/rede/avatares/${id}.svg`;
export const caminhoDaCapa = (id: string): string => `/rede/capas/${id}.svg`;

/** O endereço (ou data URL) a mostrar para uma imagem de perfil; nulo = iniciais (rosto) ou nada (capa). */
export function origemDaImagem(i: ImagemDePerfil | null | undefined, tipo: "avatar" | "capa"): string | null {
  if (!i || i.tipo === null) return null;
  if (i.tipo === "galeria") {
    if (tipo === "avatar") return avatarDaGaleria(i.id) ? caminhoDoAvatar(i.id) : null;
    return capaDaGaleria(i.id) ? caminhoDaCapa(i.id) : null;
  }
  return /^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/.test(i.dados) ? i.dados : null;
}

/** Limites de tamanho (em caracteres da data URL) que o banco aceita. */
export const LIMITE_AVATAR = 40000;
export const LIMITE_CAPA = 90000;
export const BIO_MAXIMA = 160;

/** 3 a 20 letras minúsculas sem acento, números ou _. */
export const handleBemFormado = (h: string): boolean => /^[a-z0-9_]{3,20}$/.test(h);
/** O que a pessoa digitou, arrumado para virar @nome: tira @ e espaços, passa para minúsculas. */
export const arrumarHandle = (h: string): string => h.trim().replace(/^@+/, "").toLowerCase();

/** O @nome parece o do instituto ou da equipe? (o banco recusa; aqui só avisa antes). */
export const handleReservado = (h: string): boolean => /(instituto|lucia|equipe|coordena|modera|admin|suporte|oficial)/.test(h);

/** O texto de um selo de trilha ('trilha:<slug>') ou nulo. */
export const slugDoSelo = (selo: string): string | null => {
  const m = /^trilha:([a-z0-9-]{2,80})$/.exec(selo);
  return m ? m[1] : null;
};

/** "ensino-medio-biologia" vira "ensino medio biologia" (o site não leva o título da trilha para o perfil). */
export const nomeDaTrilha = (slug: string): string => slug.replace(/-/g, " ");

/** A última aula aberta no aparelho (lib/progress.ts: { path, title, track }) como "estudando agora"; nulo se não servir. */
export function estudandoDaUltimaAula(ultima: unknown): Estudando | null {
  if (!ultima || typeof ultima !== "object") return null;
  const u = ultima as { path?: unknown; title?: unknown; track?: unknown };
  const caminho = typeof u.path === "string" ? u.path.split(/[?#]/)[0] : "";
  const trilha = typeof u.track === "string" && /^[a-z0-9-]{2,80}$/.test(u.track) ? u.track : undefined;
  if (!/^\/trilhas\/[a-z0-9-]{2,80}(\/[a-z0-9-]{1,100}){0,2}$/.test(caminho)) return null;
  const titulo = typeof u.title === "string" ? u.title.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 120) : "";
  // Título com endereço ou @ o banco recusa: melhor mostrar a aula sem título do que perder tudo.
  if (!titulo || /(https?:\/\/|www\.|@)/i.test(titulo)) return { trilha, aula: caminho };
  return { trilha, aula: caminho, titulo };
}

/** Quantas aulas feitas há em cada trilha (os ids do aparelho são "trilha/aula"), das mais estudadas para as menos. */
export function trilhasComProgresso(feitas: Iterable<string>): { slug: string; feitas: number }[] {
  const conta = new Map<string, number>();
  for (const id of feitas) {
    const texto = String(id);
    const [slug] = texto.split("/");
    if (texto.includes("/") && /^[a-z0-9-]{2,80}$/.test(slug)) conta.set(slug, (conta.get(slug) ?? 0) + 1);
  }
  return [...conta.entries()].map(([slug, n]) => ({ slug, feitas: n })).sort((a, b) => b.feitas - a.feitas || a.slug.localeCompare(b.slug));
}

/** Os selos que a pessoa escolheu mostrar: só slugs bem formados, sem repetir, até 12 (o banco recusa mais). */
export function escolherSelosDeTrilha(slugs: Iterable<string>): string[] {
  const vistos = new Set<string>();
  for (const s of slugs) if (/^[a-z0-9-]{2,80}$/.test(s)) vistos.add(s);
  return [...vistos].slice(0, 12);
}

/**
 * Os únicos selos que existem: da equipe e dos papéis (equipe, educador, moderação) e de trilha declarada. Nunca opinião política,
 * filiação, saúde ou outro dado sensível (LGPD, art. 5º, II, e art. 11): não há como criar selo fora desta lista.
 */
export const TIPOS_DE_SELO = ["equipe", "educador", "moderacao", "trilha"] as const;
export type TipoDeSelo = (typeof TIPOS_DE_SELO)[number];
export const tipoDoSelo = (selo: string): TipoDeSelo | null => (selo === "equipe" || selo === "educador" || selo === "moderacao" ? selo : slugDoSelo(selo) ? "trilha" : null);

/** O endereço da tela de editar o próprio perfil (rota do pacote, no idioma da página). */
export const enderecoDeEditarPerfil = (lang: string): string => `/${lang}/alumia/editar-perfil`;
