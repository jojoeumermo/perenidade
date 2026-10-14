// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Senhas vazadas (Have I Been Pwned, Pwned Passwords), pelo método do anonimato: o navegador calcula o SHA-1 da
// senha, manda para cá só os cinco primeiros caracteres e compara o resto em casa. Nem a senha nem o resumo dela
// saem do aparelho, e o serviço de fora nem vê quem perguntou: a consulta parte daqui. A resposta vem com
// enchimento (Add-Padding), para o tamanho dela não denunciar o prefixo.
import { buscarTexto } from "@/lib/externo";

export async function GET(pedido: Request) {
  const prefixo = (new URL(pedido.url).searchParams.get("prefixo") ?? "").toUpperCase();
  if (!/^[0-9A-F]{5}$/.test(prefixo)) return new Response("", { status: 400, headers: { "Cache-Control": "no-store" } });
  const lista = await buscarTexto(`https://api.pwnedpasswords.com/range/${prefixo}`, { guardar: 86400, cabecalhos: { "Add-Padding": "true" } });
  if (lista === null) return new Response("", { status: 503, headers: { "Cache-Control": "no-store" } });
  return new Response(lista, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400, s-maxage=86400", "X-Robots-Tag": "noindex" } });
}
