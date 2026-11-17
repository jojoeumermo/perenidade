// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Painel de controle da Alumia: abrir o arquivo de um story ou a imagem de um post para moderar. Os dois depósitos são privados e
// só quem pode ver o post ou o story lê o arquivo; a coordenação e o admin precisam ver o que vão decidir.
//   POST { tipo: "story" | "post", caminho } com a sessão no Authorization → um endereço assinado que vale 2 minutos.
// Quem pode e o quê: o banco decide (public.alumia_painel_midia_abrir, chamada com a sessão de quem pediu): o papel, se o
// arquivo é de um post fora de núcleo e de espaço fechado ou de um story que o painel pode abrir (o de amigos próximos só com
// denúncia), e grava a abertura no registro do painel ANTES de a rota assinar. Para qualquer outro caso a rota responde 404,
// igual a um endereço que não existe.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPA = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const semCache = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex", "Referrer-Policy": "no-referrer" };
const naoExiste = () => new Response(null, { status: 404, headers: semCache });

const DEPOSITOS = {
  story: { nome: "rede-stories", caminho: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f-]{32,36}\.(webp|png|jpg|mp4|webm)$/ },
  post: { nome: "rede-midia", caminho: /^[a-f0-9-]{36}\/[a-f0-9-]{36}\.(jpg|png|webp)$/ },
} as const;

export async function POST(pedido: Request) {
  const servico = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!SUPA || !ANON || !servico) return naoExiste();
  const lugar = pedido.headers.get("sec-fetch-site");
  if (lugar && lugar !== "same-origin") return naoExiste();
  const token = /^Bearer ([A-Za-z0-9._-]{20,4096})$/.exec(pedido.headers.get("authorization") ?? "")?.[1];
  if (!token) return naoExiste();
  const corpo = (await pedido.json().catch(() => null)) as { tipo?: unknown; caminho?: unknown } | null;
  const deposito = corpo?.tipo === "story" || corpo?.tipo === "post" ? DEPOSITOS[corpo.tipo] : null;
  const caminho = typeof corpo?.caminho === "string" ? corpo.caminho : "";
  if (!deposito || !deposito.caminho.test(caminho)) return naoExiste();

  // O papel e o arquivo são conferidos no banco, com a sessão de quem pediu; a abertura fica no registro do painel.
  try {
    const r = await fetch(`${SUPA}/rest/v1/rpc/alumia_painel_midia_abrir`, {
      method: "POST",
      headers: { apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_tipo: corpo?.tipo, p_caminho: caminho }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const liberado = r.ok ? ((await r.json().catch(() => null)) as { ok?: boolean } | null) : null;
    if (liberado?.ok !== true) return naoExiste();
    const assinado = await fetch(`${SUPA}/storage/v1/object/sign/${deposito.nome}/${caminho.split("/").map(encodeURIComponent).join("/")}`, {
      method: "POST",
      headers: { apikey: servico, Authorization: `Bearer ${servico}`, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: 120 }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const dado = assinado.ok ? ((await assinado.json().catch(() => null)) as { signedURL?: string } | null) : null;
    if (!dado?.signedURL) return naoExiste();
    return Response.json({ url: `${SUPA}/storage/v1${dado.signedURL}` }, { headers: semCache });
  } catch {
    return naoExiste();
  }
}
