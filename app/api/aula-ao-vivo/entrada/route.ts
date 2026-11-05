// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Aula ao vivo na sala própria (Galène, infra/aula-ao-vivo/): devolve o endereço de entrada com um token curto assinado
// pelo site. Quem conduz a aula (conferido no banco com a sessão da pessoa) entra como moderador e pode gravar; quem
// assiste entra só com o chat, e só com a aula no ar. Só vale para aula marcada com a sala própria. Sem NEXT_PUBLIC_GALENE_URL
// e GALENE_JWT_KEY (na Vercel), responde "desligada" e a página cai no plano B (transmissão PeerTube ou YouTube).
import { rpcNoBanco } from "@/lib/instagram";
import { configDaSala, entradaNaSala, salaPropriaPronta } from "@/lib/aula-sala";

export const dynamic = "force-dynamic";

const semGuardar = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

interface AulaDoBanco {
  status?: string;
  sala_externa?: string;
  conduzo?: boolean;
}

export async function POST(pedido: Request) {
  const config = configDaSala();
  if (!salaPropriaPronta(config)) return Response.json({ erro: "desligada" }, { status: 200, headers: semGuardar });

  const corpo = (await pedido.json().catch(() => null)) as { aula?: unknown; nome?: unknown } | null;
  const aula = typeof corpo?.aula === "string" ? corpo.aula : "";
  if (!UUID.test(aula)) return Response.json({ erro: "aula" }, { status: 400, headers: semGuardar });

  const bearer = /^Bearer (.+)$/.exec(pedido.headers.get("authorization") ?? "")?.[1];
  const dados = await rpcNoBanco<AulaDoBanco | null>("aula_ao_vivo_ver", { p_id: aula }, bearer);
  if (!dados.ok || !dados.dados) return Response.json({ erro: "aula" }, { status: 404, headers: semGuardar });
  const a = dados.dados;

  // Só a aula marcada com a sala própria (o endereço guardado é o do servidor), e ainda não encerrada nem cancelada.
  let propria = false;
  try {
    propria = new URL(a.sala_externa ?? "").origin === config.url;
  } catch {
    propria = false;
  }
  if (!propria) return Response.json({ erro: "outra_sala" }, { status: 409, headers: semGuardar });

  const conduz = a.conduzo === true;
  const aberta = conduz ? ["agendada", "ao_vivo"].includes(a.status ?? "") : a.status === "ao_vivo";
  if (!aberta) return Response.json({ erro: a.status === "agendada" ? "ainda_nao" : "encerrada" }, { status: 409, headers: semGuardar });

  const nome = typeof corpo?.nome === "string" ? corpo.nome : "";
  const entrada = await entradaNaSala({ aula, conduz, nome, site: new URL(pedido.url).origin }, config);
  return Response.json(entrada, { headers: semGuardar });
}
