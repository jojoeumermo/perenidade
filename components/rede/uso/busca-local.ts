// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A busca nos posts restritos cifrados, feita NO APARELHO (R1). O servidor só tem o corpo "p2.…" e não consegue buscar;
// aqui a tela baixa as páginas da linha do grupo, abre cada post com a chave do aparelho e procura no texto aberto. Tetos, para o
// celular e o plano de dados de quem busca: no máximo LIMITES.posts posts, só dos últimos LIMITES.dias dias, e no máximo
// LIMITES.bytes de texto aberto na memória (contado em UTF-16, como o navegador guarda). O texto aberto fica só na memória da aba
// (nunca no armazenamento do navegador) e o termo procurado nunca sai do aparelho.
// Sem "@/" de propósito: roda no Node nos testes (scripts/testar-r1-uso-telas.mjs).

export interface LimitesDaBusca {
  posts: number;
  dias: number;
  bytes: number;
}

export const LIMITES: LimitesDaBusca = { posts: 300, dias: 60, bytes: 2 * 1024 * 1024 };

/** O mínimo de um post da linha para a busca. */
export interface PostParaBusca {
  id: string;
  texto: string;
  criado_em: string;
  grupo?: string | null;
  corpo_grupo?: string | null;
  autor: { id: string | null };
}

export interface PostAberto {
  id: string;
  texto: string;
  criado_em: string;
}

export type MotivoDaParada = "fim" | "posts" | "dias" | "memoria";

export interface Baixados {
  itens: PostAberto[];
  /** Posts cifrados que não abriram neste aparelho (chave de antes de a pessoa entrar no grupo, por exemplo). */
  fechados: number;
  /** Por que parou: acabou a linha, ou bateu num dos tetos. */
  parou: MotivoDaParada;
  bytes: number;
}

export interface FontesDaBusca<P extends PostParaBusca> {
  /** Uma página da linha do grupo (a mais recente primeiro). */
  pagina: (cursor: string | null) => Promise<{ itens: P[]; proximo: string | null }>;
  /** O post é cifrado? */
  cifrado: (post: P) => boolean;
  /** Abre um post cifrado no aparelho (nulo: não abre). */
  abrir: (post: P) => Promise<string | null>;
}

/** Baixa e abre os posts do grupo, respeitando os tetos. `aoAndar` recebe quantos já foram vistos (para a tela mostrar). */
export async function baixarParaBusca<P extends PostParaBusca>(
  fontes: FontesDaBusca<P>,
  limites: LimitesDaBusca = LIMITES,
  agora: number = Date.now(),
  aoAndar?: (vistos: number) => void,
): Promise<Baixados> {
  const desde = agora - limites.dias * 86_400_000;
  const itens: PostAberto[] = [];
  const vistos = new Set<string>();
  let fechados = 0;
  let bytes = 0;
  let cursor: string | null = null;
  // Um teto de páginas também, para uma linha que devolva sempre o mesmo cursor não prender a aba.
  for (let paginas = 0; paginas < Math.ceil(limites.posts / 5) + 5; paginas++) {
    const r: { itens: P[]; proximo: string | null } = await fontes.pagina(cursor);
    for (const post of r.itens) {
      if (vistos.has(post.id)) continue;
      if (vistos.size >= limites.posts) return { itens, fechados, parou: "posts", bytes };
      const quando = Date.parse(post.criado_em);
      if (Number.isFinite(quando) && quando < desde) return { itens, fechados, parou: "dias", bytes };
      vistos.add(post.id);
      let texto: string | null = post.texto ?? "";
      if (fontes.cifrado(post)) {
        try {
          texto = await fontes.abrir(post);
        } catch {
          texto = null;
        }
        if (texto === null) {
          fechados++;
          continue;
        }
      }
      const peso = texto.length * 2;
      if (bytes + peso > limites.bytes) return { itens, fechados, parou: "memoria", bytes };
      bytes += peso;
      itens.push({ id: post.id, texto, criado_em: post.criado_em });
    }
    aoAndar?.(vistos.size);
    if (!r.proximo || r.proximo === cursor) return { itens, fechados, parou: "fim", bytes };
    cursor = r.proximo;
  }
  return { itens, fechados, parou: "posts", bytes };
}

/** Sem acento e em minúsculas, para "acao" achar "ação". */
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export interface Achado {
  id: string;
  criado_em: string;
  /** O pedaço do texto em volta do termo: antes, o termo como está no texto, depois. */
  antes: string;
  achado: string;
  depois: string;
}

/**
 * Procura o termo (2 letras ou mais) nos posts abertos. Devolve, para cada post que tem o termo, o trecho em volta da primeira
 * ocorrência. A normalização não muda o tamanho do texto nas letras comuns; quando muda (letras compostas raras), o trecho cai
 * no começo do post.
 */
export function procurar(itens: readonly PostAberto[], termo: string, folga = 60): Achado[] {
  const alvo = normalizar(termo.trim());
  if (alvo.length < 2) return [];
  const saida: Achado[] = [];
  for (const p of itens) {
    const plano = normalizar(p.texto);
    const i = plano.indexOf(alvo);
    if (i < 0) continue;
    const mesmoTamanho = plano.length === p.texto.length;
    const ini = mesmoTamanho ? i : 0;
    const fim = mesmoTamanho ? i + alvo.length : Math.min(p.texto.length, alvo.length);
    const a = Math.max(0, ini - folga);
    const b = Math.min(p.texto.length, fim + folga);
    saida.push({
      id: p.id,
      criado_em: p.criado_em,
      antes: (a > 0 ? "…" : "") + p.texto.slice(a, ini),
      achado: p.texto.slice(ini, fim),
      depois: p.texto.slice(fim, b) + (b < p.texto.length ? "…" : ""),
    });
  }
  return saida;
}
