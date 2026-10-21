// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Sair do boletim com um clique, pelo botão "cancelar inscrição" do próprio leitor de e-mail (RFC 8058). O Gmail e os
// outros mandam um POST para o endereço do cabeçalho List-Unsubscribe; aqui ele vira a mesma saída do link do rodapé.
// Quem abrir o endereço no navegador (GET) vai para a página do jornal, que confirma a saída na tela.

const supabase = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const semGuardar = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

const codigoDe = (pedido: Request) => {
  const codigo = new URL(pedido.url).searchParams.get("codigo") ?? "";
  return /^[a-f0-9]{32}$/.test(codigo) ? codigo : "";
};

export async function POST(pedido: Request) {
  const codigo = codigoDe(pedido);
  if (!codigo || !supabase || !chave) return new Response("", { status: 400, headers: semGuardar });
  const resposta = await fetch(`${supabase}/rest/v1/rpc/boletim_sair`, {
    method: "POST",
    headers: { apikey: chave, Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_codigo: codigo }),
    cache: "no-store",
  }).catch(() => null);
  if (!resposta || resposta.status >= 500) return new Response("", { status: 502, headers: semGuardar });
  if (!resposta.ok && (await resposta.text()).includes("muitos_pedidos")) return new Response("", { status: 429, headers: semGuardar });
  // Código que já saiu (ou nunca existiu) também responde 200: para quem pediu, o resultado é o mesmo.
  return new Response("", { status: 200, headers: semGuardar });
}

export function GET(pedido: Request) {
  const codigo = codigoDe(pedido);
  const destino = new URL(codigo ? `/pt/jornal?boletim=sair&codigo=${codigo}` : "/pt/jornal", pedido.url);
  return Response.redirect(destino, 303);
}
