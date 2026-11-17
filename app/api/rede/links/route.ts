// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os links de um post da Alumia conferidos no Google Safe Browsing pelo servidor do site (onda 11, 11F). Só os links, nunca o
// texto; ao Google vão só prefixos de 4 bytes dos resumos (lib/rede/links-conferidos/safe-browsing.ts). A chave
// GOOGLE_SAFE_BROWSING_KEY fica só no servidor; sem ela, GET diz {ligado: false} e o POST devolve {conferido: false}, e o
// compositor segue só com a lista aberta do aparelho (components/rede/protecao/link-suspeito.ts).
import { conferirPedido, estadoDaConferencia } from "@/lib/rede/links-conferidos/rota";
import { chamarComoPessoa, tokenDe } from "@/lib/rede/publicar/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return estadoDaConferencia(process.env.GOOGLE_SAFE_BROWSING_KEY);
}

export async function POST(pedido: Request) {
  return conferirPedido(pedido, {
    chave: process.env.GOOGLE_SAFE_BROWSING_KEY,
    token: tokenDe(pedido),
    podePublicar: async (token) => {
      const r = await chamarComoPessoa<boolean>(token, "rede_pub_pode_enviar");
      return r.ok && r.dado === true;
    },
  });
}
