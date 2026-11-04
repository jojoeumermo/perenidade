// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Vale o Escrito: pede ao Internet Archive (Save Page Now) a cópia de uma fonte, na aprovação da entrada (ESPEC, regra 8).
// Só a curadoria chama: o token da sessão vai para vale_arquivo_pedir, que confere o papel no banco e segura o ritmo
// (40 por hora por pessoa); aqui há ainda um freio por instância. O servidor só fala com web.archive.org, e só de links
// públicos (enderecoParaArquivar recusa endereço local ou de rede interna, para a rota não sondar a rede do servidor).
// Devolve o link da cópia (https://web.archive.org/web/AAAAMMDDhhmmss/<link>) ou { falhou: true }: nesse caso a tela
// marca arquivoFalhou e a curadoria tenta de novo depois. Nada da página é guardado aqui, só o link do arquivo.
import { rpcNoBanco } from "@/lib/instagram";
import { arquivoDaResposta, enderecoParaArquivar } from "@/lib/vale-o-escrito/curadoria";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const responder = (corpo: unknown, status = 200) => Response.json(corpo, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

// Freio por instância: no máximo 30 pedidos por minuto, mesmo que o banco deixasse passar mais.
let janela = 0;
let pedidos = 0;
function dentroDoFreio(): boolean {
  const agora = Math.floor(Date.now() / 60_000);
  if (agora !== janela) {
    janela = agora;
    pedidos = 0;
  }
  return ++pedidos <= 30;
}

export async function POST(pedido: Request) {
  const token = /^Bearer\s+([\w.-]+)$/.exec(pedido.headers.get("authorization") ?? "")?.[1];
  if (!token) return responder({ erro: "Entre na sua conta de novo." }, 401);
  const corpo = (await pedido.json().catch(() => null)) as { url?: unknown } | null;
  const destino = typeof corpo?.url === "string" ? enderecoParaArquivar(corpo.url) : null;
  if (!destino) return responder({ erro: "Este link não pode ser arquivado (só endereços públicos http ou https)." }, 400);
  if (!dentroDoFreio()) return responder({ erro: "Muitos pedidos de arquivo seguidos. Espere um minuto." }, 429);
  const pode = await rpcNoBanco<unknown>("vale_arquivo_pedir", {}, token);
  if (!pode.ok) {
    const limite = pode.erro === "muitos_pedidos";
    return responder({ erro: limite ? "Muitos pedidos de arquivo na última hora. Espere um pouco." : "O arquivo da fonte é com a curadoria." }, limite ? 429 : 403);
  }
  try {
    const resposta = await fetch(destino, {
      redirect: "follow",
      cache: "no-store",
      headers: { "User-Agent": "InstitutoLucia-ValeOEscrito/1.0 (arquivo de fonte pública)" },
      signal: AbortSignal.timeout(50_000),
    });
    const arquivoUrl = arquivoDaResposta(resposta.headers, resposta.url);
    if (!resposta.ok && !arquivoUrl) return responder({ falhou: true, erro: "O Internet Archive não aceitou agora. Tente de novo em alguns minutos." }, 502);
    if (!arquivoUrl) return responder({ falhou: true, erro: "O Internet Archive respondeu, mas sem o link da cópia. Tente de novo." }, 502);
    return responder({ ok: true, arquivoUrl });
  } catch {
    return responder({ falhou: true, erro: "O Internet Archive não respondeu a tempo. Tente de novo em alguns minutos." }, 504);
  }
}
