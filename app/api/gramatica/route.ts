// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { NextResponse } from "next/server";

/**
 * Conferência de ortografia e gramática para os editores do site. O navegador fala só com este endereço; daqui o texto
 * vai ao LanguageTool (de código aberto) do próprio instituto, se LANGUAGETOOL_URL estiver definida (por exemplo
 * https://gramatica.institutolucia.org/v2, um contêiner "erikvl87/languagetool"), ou, sem ela, ao serviço público.
 * Nada é guardado; cada endereço de origem faz no máximo 30 pedidos por minuto.
 */
const PROPRIO = (process.env.LANGUAGETOOL_URL ?? "").replace(/\/$/, "");
const PUBLICO = "https://api.languagetool.org/v2";
const janela = new Map<string, { ate: number; n: number }>();

export async function POST(request: Request) {
  const origem = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const agora = Date.now();
  const atual = janela.get(origem);
  if (!atual || atual.ate < agora) janela.set(origem, { ate: agora + 60_000, n: 1 });
  else if (++atual.n > 30) return NextResponse.json({ erro: "limite" }, { status: 429 });
  if (janela.size > 5000) for (const [k, v] of janela) if (v.ate < agora) janela.delete(k);

  let pedido: { text?: unknown; language?: unknown };
  try {
    pedido = (await request.json()) as { text?: unknown; language?: unknown };
  } catch {
    return NextResponse.json({ erro: "pedido" }, { status: 400 });
  }
  const text = typeof pedido.text === "string" ? pedido.text.slice(0, 20000) : "";
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
