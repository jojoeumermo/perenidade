// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Só o servidor do site. Item 50 (Prompt 4): o que as rotas /api/rede/rss/t/<tema> e /api/rede/atom/<c|u|t>/<nome> respondem. Com o
// alcance (onda 13) ou o lote desligado, com a Alumia interditada, ou fora da regra do banco: 404, igual. Nada de quem lê é lido nem
// guardado. Sem "@/" de propósito (roda nos testes).
import { alcanceLigado } from "../alcance/ligado";
import { HANDLE_OK, idiomaOk, SLUG_OK } from "../alcance/regras";
import { alumiaInterditada, basesDoServidor, lerCanal, textosDoServidor } from "../alcance/servidor";
import { ligado } from "../../recursos";
import { temaOk } from "./fediverso-tema";
import { enderecoDoFeed, LETRAS, montarAtom, montarRssDoTema, type CanalDoFeed, type Letra, type TextosDoFeed } from "./feeds";
import { lerCanalDoTema } from "./servidor";

/** "Posts públicos com #{nome} na Alumia", nos seis idiomas (o resto dos textos é o do RSS da onda 13). */
const DESCRICAO_DO_TEMA: Record<string, string> = {
  pt: "Posts públicos com #{nome} na Alumia",
  en: "Public posts with #{nome} on Alumia",
  es: "Posts públicos con #{nome} en Alumia",
  fr: "Posts publics avec #{nome} sur Alumia",
  ru: "Публичные посты с #{nome} в Alumia",
  zh: "Alumia 上带有 #{nome} 的公开帖子",
};

const naoAchado = () =>
  new Response("", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=60", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex" } });

/** O nome do canal aceito para a letra; torto → nulo. */
export function nomeDoCanal(letra: string, cru: string): { letra: Letra; nome: string } | null {
  if (!(letra in LETRAS)) return null;
  const l = letra as Letra;
  const nome = decodeURIComponent(cru).toLowerCase().replace(/^(@|%40|#)/, "");
  if (l === "u") return HANDLE_OK.test(nome) ? { letra: l, nome } : null;
  if (l === "c") return SLUG_OK.test(nome) ? { letra: l, nome } : null;
  const t = temaOk(nome);
  return t ? { letra: l, nome: t } : null;
}

/** Responde o feed pedido (RSS só do #tema; Atom dos três). */
export async function responderFeed(pedido: Request, formato: "rss" | "atom", letra: string, cru: string): Promise<Response> {
  if (!alcanceLigado() || !ligado("alumia-p4-descoberta-estudo") || (await alumiaInterditada())) return naoAchado();
  const qual = nomeDoCanal(letra, cru);
  if (!qual || (formato === "rss" && qual.letra !== "t")) return naoAchado();
  const canal: CanalDoFeed | null = qual.letra === "t" ? await lerCanalDoTema(qual.nome) : await lerCanal(LETRAS[qual.letra] as "perfil" | "comunidade", qual.nome);
  if (!canal) return naoAchado();
  const lang = idiomaOk(new URL(pedido.url).searchParams.get("lang"));
  const bases = basesDoServidor();
  const textos: TextosDoFeed = { ...textosDoServidor(lang).rss, descricaoTema: DESCRICAO_DO_TEMA[lang] ?? DESCRICAO_DO_TEMA.pt };
  const proprio = enderecoDoFeed(bases.site, formato, qual.letra, qual.nome, lang);
  const xml = formato === "atom" ? montarAtom(canal, { lang, bases, textos, proprio }) : montarRssDoTema(canal, { lang, bases, textos, proprio });
  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": formato === "atom" ? "application/atom+xml; charset=utf-8" : "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
