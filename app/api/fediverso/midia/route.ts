// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A rota-proxy da mídia de fora (imagem de post e avatar de perfil remoto). O navegador de quem lê pede a imagem AQUI e nunca toca a
// instância de fora: ela não vê o IP, o navegador nem o cookie de ninguém (só o nosso servidor, com o nome da Alumia). Só no modo
// "fediverso-total" (desligado por padrão: 404). Só serve o endereço que o servidor assinou (HMAC derivado do segredo da federação:
// não é proxy aberto); a busca passa pela trava de SSRF de lib/rede/fediverso/http.ts (só https na 443, DNS conferido ao conectar,
// nada de endereço interno), com tamanho máximo, e o tipo é conferido pelos BYTES (JPG, PNG, WebP, GIF e AVIF; nunca SVG).
import { urlDoFediverso, pedirAoFediverso } from "@/lib/rede/fediverso/http";
import { conferirTeto } from "@/lib/rede/fediverso/rotas";
import { banco, midiaAssinada, modoTotal, semFederacao } from "@/lib/rede/fediverso/servidor";

export const runtime = "nodejs";

const nada = (status: number) => new Response("", { status, headers: { "Cache-Control": "public, max-age=300", "X-Robots-Tag": "noindex" } });

function tipoPelosBytes(b: Uint8Array): string | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  const t = (de: number, ate: number) => String.fromCharCode(...b.subarray(de, ate));
  if (t(0, 4) === "RIFF" && t(8, 12) === "WEBP") return "image/webp";
  if (t(0, 4) === "GIF8") return "image/gif";
  if (t(4, 8) === "ftyp" && /^avi[fs]$/.test(t(8, 12))) return "image/avif";
  return null;
}

export async function GET(pedido: Request) {
  if (!modoTotal()) return semFederacao();
  const barrado = conferirTeto(pedido, "midia", 600);
  if (barrado) return barrado;
  const p = new URL(pedido.url).searchParams;
  const alvo = p.get("u") ?? "";
  if (!midiaAssinada(alvo, p.get("s") ?? "")) return nada(404);
  if (!urlDoFediverso(alvo)) return nada(404);
  // Instância bloqueada pela mediação depois que a imagem foi assinada: não serve mais.
  if (await banco<boolean>("bloqueado", { url: alvo }).catch(() => true)) return nada(404);
  const r = await pedirAoFediverso(alvo, { binario: true, maxBytes: 8 * 1024 * 1024, tempoMs: 10_000, cabecalhos: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9" } });
  if (!r || r.status !== 200 || !r.bytes?.length) return nada(404);
  const tipo = tipoPelosBytes(r.bytes);
  if (!tipo) return nada(404);
  return new Response(new Uint8Array(r.bytes), {
    headers: {
      "Content-Type": tipo,
      "Content-Length": String(r.bytes.length),
      "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex",
    },
  });
}
