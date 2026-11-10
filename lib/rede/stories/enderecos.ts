// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os endereços dos stories (/alumia/stories), num lugar só: a faixa, o visor, o "criar" e o "Pôr no story" do cartão montam e
// leem por aqui, e só aceitam o que o banco aceita (handle e id conferidos), para nenhum parâmetro estranho virar busca ou
// salto. Sem "@/" de propósito (roda no Node nos testes).

const HANDLE = /^[a-z0-9_]{3,20}$/;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** O id de um destaque: o uuid do banco (ou o "ex-dest-…" dos exemplos da prévia). A tela ainda confere se ele está na lista. */
const DESTAQUE = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|ex-[a-z0-9-]{1,40})$/;

export const enderecosDosStories = {
  /** A faixa (e a linha embaixo). */
  stories: (lang: string) => `/${lang}/alumia/stories`,
  /** Abrir os stories de alguém (ou os meus, com "eu"); `i` = começar do story i. */
  ver: (lang: string, handle: string, i?: number) =>
    `/${lang}/alumia/stories?ver=${encodeURIComponent(handle)}${i && i > 0 ? `&i=${Math.floor(i)}` : ""}`,
  /** O "criar"; com um post, é o "Pôr no story" daquele post. */
  criar: (lang: string, post?: string | null) => `/${lang}/alumia/stories?criar=1${post && ID.test(post) ? `&post=${post}` : ""}`,
} as const;

/** As chaves da busca que dizem o que está aberto por cima (as outras, como ?aba=, ficam como estão). */
export const CHAVES_DOS_STORIES = ["ver", "i", "criar", "post", "destaque"] as const;

/** O que o endereço pede (lido da busca): abrir alguém, um destaque, criar, ou só a faixa. Valores fora do formato são ignorados. */
export function lerPedidoDoEndereco(busca: URLSearchParams | { get(chave: string): string | null }): {
  ver: string | null;
  i: number;
  criar: boolean;
  post: string | null;
  destaque: string | null;
} {
  // "?ver=@nome" também vale: o @ é como a pessoa escreve o nome (o banco guarda sem ele).
  const ver = busca.get("ver")?.trim().replace(/^@/, "").toLowerCase() ?? null;
  const i = Number(busca.get("i") ?? "0");
  const post = busca.get("post");
  const destaque = busca.get("destaque");
  return {
    ver: ver && (ver === "eu" || HANDLE.test(ver)) ? ver : null,
    i: Number.isInteger(i) && i >= 0 && i < 100 ? i : 0,
    criar: busca.get("criar") === "1",
    post: post && ID.test(post) ? post : null,
    destaque: destaque && DESTAQUE.test(destaque) ? destaque : null,
  };
}
