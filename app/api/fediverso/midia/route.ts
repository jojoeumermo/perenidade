// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A rota-proxy da mídia de fora (imagem de post e avatar de perfil remoto). O navegador de quem lê pede a imagem AQUI e nunca toca a
// instância de fora: ela não vê o IP, o navegador nem o cookie de ninguém (só o nosso servidor, com o nome da Alumia). Só no modo
// "fediverso-total" (desligado por padrão: 404). Só serve o endereço que o servidor assinou (HMAC derivado do segredo da federação,
// com validade: não é proxy aberto, e ninguém pede para assinar uma URL qualquer); a busca passa pela trava de SSRF de
// lib/rede/fediverso/http.ts (só https na 443, DNS conferido ao conectar, nada de endereço interno), o bloqueio de instância é
// conferido em CADA salto (um redirecionamento não leva a instância bloqueada), com tamanho máximo, e o tipo é conferido pelos
// BYTES (JPG, PNG, WebP, GIF e AVIF; nunca SVG). O cache é curto (1 dia na borda) para imagem de instância que a mediação bloqueou
// depois sumir logo.
//
// QUANDO a imagem é buscada (P12, lib/rede/fediverso/midia-guardada.ts): com a pasta da VPS configurada, a imagem de uma nota de
// fora (e o avatar de quem o banco guarda) é buscada na chegada, numa hora sorteada, e fica no disco. Esta rota serve a cópia.
// Enquanto ela está na fila ("pendente"), a rota NÃO a busca lá fora (responde 404 curto): a hora em que a origem é tocada não
// depende de ninguém abrir o aviso ou o fio. Só o que o banco não conhece (post lido agora na origem, com o toque da pessoa) é
// buscado na hora, como antes. Sem a pasta configurada, tudo é buscado na hora, como antes.
import { buscarImagemDeFora, estadoDaMidia, lerGuardada, midiaGuardadaLigada } from "@/lib/rede/fediverso/midia-guardada";
import { urlDoFediverso } from "@/lib/rede/fediverso/http";
import { conferirTeto } from "@/lib/rede/fediverso/rotas";
import { banco, midiaAssinada, modoTotal, semFederacao } from "@/lib/rede/fediverso/servidor";

export const runtime = "nodejs";

const nada = (status: number, maxAge = 300) => new Response("", { status, headers: { "Cache-Control": `public, max-age=${maxAge}`, "X-Robots-Tag": "noindex" } });

const servir = ({ bytes, tipo }: { bytes: Uint8Array; tipo: string }) =>
  new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": tipo,
      "Content-Length": String(bytes.length),
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex",
    },
  });

export async function GET(pedido: Request) {
  if (!modoTotal()) return semFederacao();
  const barrado = conferirTeto(pedido, "midia", 600);
  if (barrado) return barrado;
  const p = new URL(pedido.url).searchParams;
  const alvo = p.get("u") ?? "";
  if (!midiaAssinada(alvo, p.get("e") ?? "", p.get("s") ?? "")) return nada(404);
  if (!urlDoFediverso(alvo)) return nada(404);
  if (midiaGuardadaLigada()) {
    // A cópia guardada só sai se a instância ainda não foi bloqueada (a faxina a apaga logo depois; até lá, não serve).
    const guardada = await lerGuardada(alvo);
    if (guardada) {
      const bloqueada = await banco<boolean>("bloqueado", { url: alvo }).catch(() => true);
      return bloqueada ? nada(404) : servir(guardada);
    }
    // Na fila (ou o banco não respondeu): não busca fora agora. O 404 é curto, para a imagem aparecer quando for guardada.
    if ((await estadoDaMidia(alvo)) === "pendente") return nada(404, 60);
  }
  const imagem = await buscarImagemDeFora(alvo);
  return imagem ? servir(imagem) : nada(404);
}
