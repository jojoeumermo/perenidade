// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O miolo da rota /api/rede/links (app/api/rede/links/route.ts), separado para os testes chamarem com dublês (do banco e do
// Google). GET: a conferência está ligada? (a chave existe no servidor). POST {links}: só para quem é membro e pode publicar,
// até 10 links, com teto de pedidos por pessoa; devolve {conferido, perigosos}. Nada é gravado nem escrito em registro: o link
// vive só durante o pedido (e o prefixo do resumo, na memória das respostas do Google). Sem "@/": roda no Node dos testes.
import { conferirLinks, MAXIMO_DE_LINKS, type ResultadoDaConferencia } from "./safe-browsing";

export interface DependenciasDaRota {
  /** GOOGLE_SAFE_BROWSING_KEY (só no servidor). */
  chave: string | undefined;
  /** O token da pessoa (cabeçalho Authorization), ou nulo. */
  token: string | null;
  /** A pessoa pode publicar? (rede_pub_pode_enviar, chamado como ela.) */
  podePublicar: (token: string) => Promise<boolean>;
  /** O fetch para o Google (dublê nos testes). */
  buscar?: Parameters<typeof conferirLinks>[2];
}

const responder = (corpo: unknown, status = 200) =>
  Response.json(corpo, { status, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } });

const pedidos = new Map<string, number[]>();
export const TETO_POR_MINUTO = 20;

/** Esquece o teto (para os testes). */
export function zerarTeto() {
  pedidos.clear();
}

/** O id da conta dentro do token (o "sub"), sem conferir a assinatura: só serve depois que o banco aceitou o token. */
export function contaDoToken(token: string): string | null {
  try {
    const meio = token.split(".")[1];
    if (!meio) return null;
    const corpo = JSON.parse(Buffer.from(meio.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")) as { sub?: unknown };
    return typeof corpo.sub === "string" && /^[0-9a-f-]{36}$/.test(corpo.sub) ? corpo.sub : null;
  } catch {
    return null;
  }
}

export function estadoDaConferencia(chave: string | undefined): Response {
  return responder({ ligado: Boolean(chave) });
}

export async function conferirPedido(pedido: Request, d: DependenciasDaRota): Promise<Response> {
  if (!d.token) return responder({ erro: "entre_primeiro" }, 401);
  const declarado = Number(pedido.headers.get("content-length") ?? "0");
  if (declarado > 32 * 1024) return responder({ erro: "invalido" }, 413);
  let corpo: unknown;
  try {
    const texto = await pedido.text();
    if (texto.length > 32 * 1024) return responder({ erro: "invalido" }, 413);
    corpo = JSON.parse(texto);
  } catch {
    return responder({ erro: "invalido" }, 400);
  }
  const links = (corpo as { links?: unknown })?.links;
  if (!Array.isArray(links) || links.length > MAXIMO_DE_LINKS || links.some((l) => typeof l !== "string" || l.length > 2048)) {
    return responder({ erro: "invalido" }, 400);
  }
  if (!(await d.podePublicar(d.token))) return responder({ erro: "consentimento" }, 403);

  // Teto por pessoa (por instância): 20 conferências por minuto. A chave é a conta (o "sub" do token, que o banco acabou de aceitar
  // em podePublicar): renovar a sessão troca o token, não a conta.
  const agora = Date.now();
  const chaveDoTeto = contaDoToken(d.token) ?? d.token.slice(-24);
  const recentes = (pedidos.get(chaveDoTeto) ?? []).filter((t) => agora - t < 60_000);
  if (recentes.length >= TETO_POR_MINUTO) return responder({ erro: "muitos_pedidos" }, 429);
  recentes.push(agora);
  pedidos.set(chaveDoTeto, recentes);
  if (pedidos.size > 2000) pedidos.clear();

  const r: ResultadoDaConferencia = await conferirLinks(links as string[], d.chave, d.buscar);
  return responder(r);
}
