// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Entrega ao estúdio de design uma imagem da Wikimedia Commons pelo nosso domínio: a tela do estúdio só consegue
// desenhar (e exportar) imagens do mesmo endereço do site, e a política de segurança das páginas não deixa o navegador
// buscar nada de fora. Só arquivos do Commons, redimensionados por lá, até 8 MB. Nenhum redirecionamento é seguido (ele levaria
// para fora de upload.wikimedia.org), e o corpo é lido aos poucos: passou de 8 MB, a leitura para ali, sem encher a memória.
import { buscarJson } from "@/lib/externo";

const MAXIMO = 8 * 1024 * 1024;

/** Lê o corpo aos poucos; passou do máximo, para e devolve nulo. */
async function lerAte(corpo: ReadableStream<Uint8Array>, maximo: number): Promise<Uint8Array<ArrayBuffer> | null> {
  const leitor = corpo.getReader();
  const pedacos: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.length;
    if (total > maximo) {
      await leitor.cancel().catch(() => undefined);
      return null;
    }
    pedacos.push(value);
  }
  const tudo = new Uint8Array(total);
  let i = 0;
  for (const p of pedacos) {
    tudo.set(p, i);
    i += p.length;
  }
  return tudo;
}

export async function GET(pedido: Request) {
  const parametros = new URL(pedido.url).searchParams;
  const arquivo = (parametros.get("arquivo") ?? "").replace(/[\u0000-\u001f]/g, "").slice(0, 300);
  const largura = Math.min(2400, Math.max(120, Number(parametros.get("largura")) || 1400));
  if (!/^[^/\\:*?"<>|]{3,300}\.(jpe?g|png|webp|gif|svg|tiff?)$/i.test(arquivo)) return new Response("", { status: 400 });
  // O Commons diz onde está a versão redimensionada; o endereço vem sempre de upload.wikimedia.org.
  const dados = await buscarJson<{ query?: { pages?: Record<string, { imageinfo?: { thumburl?: string }[] }> } }>(
    `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(`File:${arquivo}`)}&prop=imageinfo&iiprop=url&iiurlwidth=${largura}&format=json&utf8=1`,
    { guardar: 86400 },
  );
  const endereco = Object.values(dados?.query?.pages ?? {})[0]?.imageinfo?.[0]?.thumburl ?? "";
  let url: URL;
  try {
    url = new URL(endereco);
  } catch {
    return new Response("", { status: 404 });
  }
  if (url.protocol !== "https:" || url.hostname !== "upload.wikimedia.org") return new Response("", { status: 404 });
  try {
    // Sem o cache de dados do Next: ele separa uma cópia do corpo e a lê inteira, passando por cima do limite de 8 MB. Quem guarda
    // a imagem é a borda, pelo Cache-Control da resposta.
    const resposta = await fetch(url, { headers: { "User-Agent": "InstitutoLucia/1.0 (+https://institutolucia.org)" }, signal: AbortSignal.timeout(15_000), redirect: "manual", cache: "no-store" });
    if (!resposta.ok || !resposta.body) return new Response("", { status: 404 });
    const tipo = resposta.headers.get("content-type") ?? "";
    if (!/^image\/(jpeg|png|webp|gif)/.test(tipo)) return new Response("", { status: 415 });
    if (Number(resposta.headers.get("content-length") ?? "0") > MAXIMO) return new Response("", { status: 413 });
    const bytes = await lerAte(resposta.body, MAXIMO);
    if (!bytes) return new Response("", { status: 413 });
    return new Response(bytes, { headers: { "Content-Type": tipo, "Cache-Control": "public, max-age=86400, s-maxage=604800", "X-Robots-Tag": "noindex" } });
  } catch {
    return new Response("", { status: 504 });
  }
}
