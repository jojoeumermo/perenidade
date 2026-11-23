// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As regras puras do grupo "memória e luta" (Prompt 4, itens 43, 44, 115, 116, 119 e 121), sem tela e sem banco: o interruptor e
// as rotas, o fato do "Neste dia na luta", os links aceitos, o endereço do podcast, o RSS do podcast e o desafio diário (as
// perguntas do dia, iguais para todo mundo, e a pontuação, que fica só no aparelho). O banco decide de verdade quem vê e o que sai
// (supabase/migracoes/20261127-p4-memoria-e-luta.sql). Sem "@/" de propósito (roda nos testes).
import { criarSorteio, embaralhar } from "../../jogos/base";
import { enderecoAbsoluto, escapar, idiomaOk, semControle } from "../alcance/regras";
import type { Recurso } from "../../recursos";

/** O interruptor do grupo (só pelo nome, desligado; o painel único liga). */
export const FLAG_DA_MEMORIA: Recurso = "alumia-p4-memoria-e-luta";

/** As telas do grupo (lib/rede/rotas-novas.ts): a memória da luta (arquivo vivo, vitórias, campanhas, podcasts) e o desafio. */
export const ROTAS_DA_MEMORIA = ["memoria-da-luta", "desafio"] as const;

// ── 43. Neste dia na luta ──────────────────────────────────────────────────────────────────────────────────────────────────

/** Um fato como a rota do site (/api/neste-dia) devolve. */
export interface FatoDaLuta {
  ano: number;
  texto: string;
  link: string;
  dia?: string;
}

/** O dia de hoje em Brasília (AAAA-MM-DD): a chave do "Neste dia", do desafio e do "fechar por hoje". */
export function chaveDoDia(agora: Date = new Date()): string {
  const [dia, mes, ano] = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(agora).split("/");
  return `${ano}-${mes}-${dia}`;
}

/** Um link aceito: https, sem usuário e senha no endereço, sem espaço. */
export function linkOk(link: string | null | undefined): boolean {
  const v = (link ?? "").trim();
  return v.length > 0 && v.length <= 500 && /^https:\/\/[A-Za-z0-9.-]+\.[A-Za-z]{2,}(:\d{1,5})?(\/[^\s<>"]*)?$/.test(v) && !/^https:\/\/[^/]*@/.test(v);
}

/**
 * O fato do quadro "Neste dia na luta": o primeiro da resposta do /api/neste-dia (a rota já põe primeiro os da lista da equipe e os de
 * hoje, e escolhe na Wikipédia pelo servidor, com cache). Só com ano, texto e link https; nada mais segue para a tela.
 */
export function fatoDoDiaNaLuta(resposta: unknown): FatoDaLuta | null {
  const fatos = (resposta as { fatos?: unknown } | null)?.fatos;
  if (!Array.isArray(fatos)) return null;
  for (const f of fatos) {
    const x = f as Partial<FatoDaLuta>;
    if (typeof x?.ano !== "number" || !Number.isInteger(x.ano) || typeof x.texto !== "string" || !x.texto.trim() || !linkOk(x.link)) continue;
    const fato: FatoDaLuta = { ano: x.ano, texto: semControle(x.texto).trim().slice(0, 400), link: (x.link as string).trim() };
    if (typeof x.dia === "string" && /^\d{2}\/\d{2}$/.test(x.dia)) fato.dia = x.dia;
    return fato;
  }
  return null;
}

/** A chave do aparelho que guarda "fechei o quadro hoje" (só o dia, nada mais). */
export const CHAVE_DO_QUADRO = "alumia-neste-dia-fechado";

// ── 119. Podcast ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/** O endereço do podcast: 3 a 40 letras minúsculas, números e hífen. */
export const slugOk = (slug: string | null | undefined): boolean => /^[a-z0-9-]{3,40}$/.test(slug ?? "");

/** Um episódio como o banco deixa sair (public.rede_p4_podcast_rss). Sem autor, sem texto do post, sem número de quem ouve. */
export interface EpisodioQueSai {
  id: string;
  titulo: string;
  notas: string;
  numero: number;
  criado_em: string;
  duracao: number | null;
  tipo: string;
}

/** O podcast como o banco deixa sair. */
export interface PodcastQueSai {
  slug: string;
  titulo: string;
  sobre: string;
  comunidade: string;
  comunidade_nome: string;
  episodios: EpisodioQueSai[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TIPOS_DE_AUDIO = ["audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4", "audio/aac", "audio/wav"];

/** Os endereços do podcast no servidor do site (o feed e o áudio de cada episódio). */
export const rotasDoPodcast = {
  rss: (site: string, slug: string) => `${site.replace(/\/+$/, "")}/api/rede/podcast/${encodeURIComponent(slug)}`,
  audio: (site: string, slug: string, episodio: string) => `${site.replace(/\/+$/, "")}/api/rede/podcast/${encodeURIComponent(slug)}/${encodeURIComponent(episodio)}`,
};

const dataRfc = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date(0).toUTCString() : d.toUTCString();
};

/**
 * O RSS 2.0 do podcast (com as marcas do iTunes que os aplicativos de podcast leem). O áudio aponta para a rota do site (nunca para o
 * depósito); o autor é a comunidade; não leva o texto do post nem número de quem ouve. Feed e rota próprios: não se mistura com o
 * podcast do Instituto (app/podcast.xml).
 */
export function montarRssDoPodcast(p: PodcastQueSai, opcoes: { site: string; alumia: string; lang: string }): string {
  const lang = idiomaOk(opcoes.lang);
  const pagina = enderecoAbsoluto(lang, "/memoria-da-luta", { alumia: opcoes.alumia, site: opcoes.site });
  const itens = (p.episodios ?? [])
    .filter((e) => UUID.test(e.id))
    .map((e) => {
      const audio = rotasDoPodcast.audio(opcoes.site, p.slug, e.id);
      const tipo = TIPOS_DE_AUDIO.includes(e.tipo) ? e.tipo : "audio/webm";
      return [
        "    <item>",
        `      <title>${escapar(e.titulo)}</title>`,
        `      <guid isPermaLink="false">${escapar(e.id)}</guid>`,
        `      <pubDate>${dataRfc(e.criado_em)}</pubDate>`,
        e.notas?.trim() ? `      <description>${escapar(e.notas.trim())}</description>` : "",
        `      <enclosure url="${escapar(audio)}" length="0" type="${tipo}"/>`,
        Number.isFinite(e.duracao) && (e.duracao ?? 0) > 0 ? `      <itunes:duration>${Math.round(e.duracao as number)}</itunes:duration>` : "",
        `      <itunes:episode>${Math.max(1, Math.trunc(e.numero))}</itunes:episode>`,
        "    </item>",
      ].filter(Boolean).join("\n");
    });
  const ultimo = (p.episodios ?? []).reduce<string | null>((m, e) => (!m || e.criado_em > m ? e.criado_em : m), null);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapar(p.titulo)}</title>`,
    `    <link>${escapar(pagina)}</link>`,
    `    <description>${escapar(p.sobre?.trim() || p.titulo)}</description>`,
    `    <language>${lang === "zh" ? "zh-CN" : lang === "pt" ? "pt-BR" : lang}</language>`,
    `    <atom:link href="${escapar(rotasDoPodcast.rss(opcoes.site, p.slug))}" rel="self" type="application/rss+xml"/>`,
    `    <itunes:author>${escapar(p.comunidade_nome || p.comunidade)}</itunes:author>`,
    "    <itunes:explicit>false</itunes:explicit>",
    ultimo ? `    <lastBuildDate>${dataRfc(ultimo)}</lastBuildDate>` : "",
    ...itens,
    "  </channel>",
    "</rss>",
  ].filter(Boolean).join("\n");
}

// ── 121. Desafio diário ────────────────────────────────────────────────────────────────────────────────────────────────────

/** Um verbete do glossário, como a rota /api/rede/desafio entrega (a mesma lista dos jogos de treino do site). */
export interface VerbeteDoDesafio {
  termo: string;
  resumo: string;
}

/** Uma pergunta: a definição com o termo escondido e quatro opções. */
export interface PerguntaDoDesafio {
  enunciado: string;
  opcoes: string[];
  certa: number;
  termo: string;
}

/** Quantas perguntas o desafio do dia tem. */
export const PERGUNTAS_POR_DIA = 5;

/** A semente do dia: só a data (AAAA-MM-DD). Todo mundo recebe o mesmo desafio; nada de quem joga entra no sorteio. */
export function sementeDoDia(dia: string): number {
  let h = 2166136261;
  for (const c of dia) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h >>> 0;
}

const semAcento = (c: string): string => c.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Troca cada ocorrência do termo (com ou sem acento, em qualquer caixa) por "____", mantendo o resto do texto como está. */
export function esconderTermo(resumo: string, termo: string): string {
  const letras = [...resumo];
  const simples = letras.map(semAcento);
  // Só dá para casar letra a letra quando cada letra continua sendo uma letra sem o acento (o normal em português).
  if (simples.some((c) => c.length !== 1)) return resumo;
  const alvo = [...semAcento(termo)].join("");
  const texto = simples.join("");
  if (!alvo) return resumo;
  let saida = "";
  let i = 0;
  while (i < letras.length) {
    if (texto.startsWith(alvo, i)) {
      saida += "____";
      i += alvo.length;
    } else {
      saida += letras[i];
      i += 1;
    }
  }
  return saida;
}

/** As perguntas do dia, a partir dos verbetes: sempre as mesmas para a mesma data, com o termo escondido no enunciado. */
export function perguntasDoDia(verbetes: readonly VerbeteDoDesafio[], dia: string): PerguntaDoDesafio[] {
  const bons = verbetes.filter((v) => typeof v?.termo === "string" && typeof v?.resumo === "string" && v.termo.trim().length >= 3 && v.resumo.trim().length >= 20);
  if (bons.length < 4) return [];
  const rnd = criarSorteio(sementeDoDia(dia));
  const escolhidos = embaralhar(bons, rnd).slice(0, Math.min(PERGUNTAS_POR_DIA, bons.length));
  return escolhidos.map((v) => {
    const outros = embaralhar(bons.filter((o) => o.termo !== v.termo), rnd).slice(0, 3).map((o) => o.termo);
    const opcoes = embaralhar([v.termo, ...outros], rnd);
    return { enunciado: esconderTermo(v.resumo.trim(), v.termo.trim()), opcoes, certa: opcoes.indexOf(v.termo), termo: v.termo };
  });
}

/** O que o aparelho guarda (uma chave só, só o dia de hoje). Nada de sequência, nada de dias anteriores. */
export const CHAVE_DA_PONTUACAO = "alumia-desafio-do-dia";

type Guarda = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** A pontuação de hoje, se houver (a de outro dia não vale e não é lida). */
export function lerPontuacao(guarda: Guarda | null, dia: string): { acertos: number; total: number } | null {
  try {
    const cru = guarda?.getItem(CHAVE_DA_PONTUACAO);
    if (!cru) return null;
    const x = JSON.parse(cru) as { dia?: unknown; acertos?: unknown; total?: unknown };
    if (x.dia !== dia || !Number.isInteger(x.acertos) || !Number.isInteger(x.total)) return null;
    const total = Math.min(Math.max(x.total as number, 1), PERGUNTAS_POR_DIA);
    return { acertos: Math.min(Math.max(x.acertos as number, 0), total), total };
  } catch {
    return null;
  }
}

/** Guarda a pontuação de hoje no lugar da anterior (que some). Sem armazenamento, não guarda e não quebra. */
export function gravarPontuacao(guarda: Guarda | null, dia: string, acertos: number, total: number): void {
  try {
    guarda?.setItem(CHAVE_DA_PONTUACAO, JSON.stringify({ dia, acertos: Math.trunc(acertos), total: Math.trunc(total) }));
  } catch {
    // Navegação privada ou armazenamento bloqueado: o desafio funciona do mesmo jeito, só não lembra.
  }
}

/** Apaga a pontuação guardada. */
export function apagarPontuacao(guarda: Guarda | null): void {
  try {
    guarda?.removeItem(CHAVE_DA_PONTUACAO);
  } catch {
    // Sem armazenamento: nada a apagar.
  }
}
