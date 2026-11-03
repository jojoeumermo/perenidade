// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { NextResponse } from "next/server";
import { quemPede, tokenDoPedido } from "@/lib/sessao-da-equipe";

/**
 * Conferência de ortografia e gramática para os editores do site. O navegador fala só com este endereço; daqui o texto
 * vai ao LanguageTool (de código aberto) do próprio instituto, se LANGUAGETOOL_URL estiver definida (por exemplo
 * https://gramatica.institutolucia.org/v2, um contêiner "erikvl87/languagetool"), ou, sem ela, ao serviço público.
 *
 * A rota continua aberta a visitantes (o editor aparece em /contribuir e na sala livre, para quem não tem conta), mas:
 *   - só aceita pedidos vindos do próprio site: outro site não usa o nosso servidor como LanguageTool de graça pelo
 *     navegador. Isso não segura curl nem robô, por isso há o limite;
 *   - limite por origem: sem sessão, 10 pedidos por minuto; com sessão de quem tem conta (Authorization: Bearer), 30.
 * O limite fica na memória de cada instância do servidor, então é um freio, não uma cerca: o que vale entre instâncias é a
 * regra de limite da Cloudflare para /api/gramatica (docs/plano-2026-11/notas/seguranca-producao.md).
 * Nada é guardado: nem o texto, nem quem pediu.
 */
const PROPRIO = (process.env.LANGUAGETOOL_URL ?? "").replace(/\/$/, "");
const PUBLICO = "https://api.languagetool.org/v2";
const janela = new Map<string, { ate: number; n: number }>();
const POR_MINUTO = { visitante: 10, conta: 30 };
// O editor corta em 20.000 caracteres. Quem escreve aulas no painel ainda não manda a sessão daqui (components/Editor.tsx),
// então o teto de texto é o mesmo para todos, para não cortar a conferência de uma aula longa.
const MAXIMO_TEXTO = 20000;

/** Endereços de onde o site roda: o principal, o www (que redireciona) e o próprio endereço que atendeu o pedido. */
function origensDoSite(request: Request): Set<string> {
  const lista = new Set(["https://institutolucia.org", "https://www.institutolucia.org"]);
  try {
    lista.add(new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://institutolucia.org").origin);
  } catch {
    // endereço mal escrito na configuração: ficam os de cima
  }
  try {
    lista.add(new URL(request.url).origin);
  } catch {
    // sem endereço próprio: ficam os de cima
  }
  return lista;
}

/** O pedido veio de uma página do próprio site? Navegador antigo sem Origin nem Sec-Fetch-Site passa (e cai no limite). */
function doProprioSite(request: Request): boolean {
  const origem = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site") return false;
  if (!origem) return true;
  if (origensDoSite(request).has(origem)) return true;
  return process.env.NODE_ENV !== "production" && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origem);
}

export async function POST(request: Request) {
  if (!doProprioSite(request)) return NextResponse.json({ erro: "origem" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  // Atrás da Cloudflare, o primeiro endereço do X-Forwarded-For é o da borda (o mesmo para muita gente): vale o do visitante.
  const origem = request.headers.get("cf-connecting-ip")?.trim() || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const agora = Date.now();
  const atual = janela.get(origem);
  let n = 1;
  if (!atual || atual.ate < agora) janela.set(origem, { ate: agora + 60_000, n: 1 });
  else n = ++atual.n;
  const limite = () => NextResponse.json({ erro: "limite" }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "60" } });
  // Acima do teto de quem tem conta, nem pergunta ao banco. Entre os dois tetos, só passa quem mandou a sessão de uma conta:
  // o banco só é consultado aí, então um token inventado não vira uma consulta ao banco por pedido.
  if (n > POR_MINUTO.conta) return limite();
  if (n > POR_MINUTO.visitante && !(tokenDoPedido(request) && (await quemPede(request)).conta)) return limite();
  if (janela.size > 5000) for (const [k, v] of janela) if (v.ate < agora) janela.delete(k);

  let pedido: { text?: unknown; language?: unknown };
  try {
    pedido = (await request.json()) as { text?: unknown; language?: unknown };
  } catch {
    return NextResponse.json({ erro: "pedido" }, { status: 400 });
  }
  const text = typeof pedido.text === "string" ? pedido.text.slice(0, MAXIMO_TEXTO) : "";
  const language = typeof pedido.language === "string" && /^[a-zA-Z-]{2,10}$/.test(pedido.language) ? pedido.language : "auto";
  if (text.trim().length < 3) return NextResponse.json({ matches: [] });

  // Idioma fixo em pt-BR nos editores em português (sem detecção automática), modo rigoroso, e fora as regras que só
  // apontam marcas do próprio formato do texto.
  const corpo = new URLSearchParams({ text, language, level: "picky", disabledRules: "WHITESPACE_RULE,UNPAIRED_BRACKETS,COMMA_PARENTHESIS_WHITESPACE,ARROWS" });
  if (language.startsWith("pt")) corpo.set("motherTongue", "pt-BR");
  const consultar = async (base: string) => {
    const resposta = await fetch(`${base}/check`, { method: "POST", body: corpo, signal: AbortSignal.timeout(20000) });
    if (!resposta.ok) throw new Error(String(resposta.status));
    return (await resposta.json()) as { matches?: unknown[] };
  };
  // Primeiro o conferidor do instituto; se ele não responder, o serviço público entra de reserva e o autor é avisado.
  if (PROPRIO) {
    try {
      const dados = await consultar(PROPRIO);
      return NextResponse.json({ matches: dados.matches ?? [], fonte: "proprio" }, { headers: { "Cache-Control": "no-store" } });
    } catch {
      // cai no público
    }
  }
  try {
    const dados = await consultar(PUBLICO);
    return NextResponse.json({ matches: dados.matches ?? [], fonte: "publico", reserva: Boolean(PROPRIO) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ erro: "servico" }, { status: 502 });
  }
}
