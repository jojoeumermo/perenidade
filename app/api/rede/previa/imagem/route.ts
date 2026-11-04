// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O proxy da imagem de uma prévia de link (pacote publicar): o leitor vê a imagem pelo NOSSO endereço, e o navegador dele nunca
// toca no site de fora. Só serve o endereço que a rota de prévia assinou (HMAC com REDE_PREVIA_SEGREDO; sem o segredo, nada é
// servido), com a mesma busca de DNS conferido, tamanho máximo e tipo conferido pelos bytes (só JPG, PNG, WebP e GIF; nunca SVG).
import { buscarSeguro } from "@/lib/rede/publicar/buscar-seguro";
import { assinaturaConfere, urlSegura } from "@/lib/rede/publicar/previa";

export const runtime = "nodejs";

const nada = (status: number) => new Response("", { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

function tipoPelosBytes(b: Uint8Array): string | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  const t = (de: number, ate: number) => String.fromCharCode(...b.subarray(de, ate));
  if (t(0, 4) === "RIFF" && t(8, 12) === "WEBP") return "image/webp";
  if (t(0, 4) === "GIF8") return "image/gif";
  return null;
}

export async function GET(pedido: Request) {
  const p = new URL(pedido.url).searchParams;
  const alvo = p.get("u") ?? "";
  if (!assinaturaConfere(alvo, p.get("s") ?? "", process.env.REDE_PREVIA_SEGREDO)) return nada(404);
  if (!urlSegura(alvo)) return nada(404);
  const busca = await buscarSeguro(alvo, { tipos: ["image/"], maxBytes: 2 * 1024 * 1024, tempoMs: 6000 });
  const tipo = busca ? tipoPelosBytes(busca.corpo) : null;
  if (!busca || !tipo || busca.truncado) return nada(404);
  return new Response(busca.corpo as unknown as BodyInit, {
    headers: {
      "Content-Type": tipo,
      "Cache-Control": "public, max-age=86400, s-maxage=604800",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cross-Origin-Resource-Policy": "same-origin",
      "X-Robots-Tag": "noindex",
    },
  });
}
