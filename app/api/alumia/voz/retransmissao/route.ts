// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As credenciais curtas do servidor de retransmissão (TURN) das salas de voz da Alumia (lib/rede/voz/sala.ts; docs/rede/VOZ.md).
// Só para quem é membro do grupo (núcleo ou comunidade fechada), conferido no banco com a sessão da pessoa. O áudio é cifrado
// ponta a ponta (DTLS-SRTP): o servidor de retransmissão só repassa pacotes que não consegue ouvir, e cada pessoa só vê o endereço
// dele, não o das outras.
//
// Dois jeitos, escolhidos pelas variáveis do servidor do site (nunca no repositório):
//   - TURN da Cloudflare: CLOUDFLARE_TURN_KEY_ID e CLOUDFLARE_TURN_TOKEN (os mesmos da aula ao vivo), ou VOZ_TURN_CF_CHAVE e
//     VOZ_TURN_CF_TOKEN para uma chave só da voz;
//   - TURN próprio (coturn, com "use-auth-secret"): VOZ_TURN_URLS (separados por vírgula) e VOZ_TURN_SEGREDO.
// Sem nenhum dos dois: responde "desligada" e a tela diz que a voz ainda não está ligada.
import { rpcNoBanco } from "@/lib/instagram";
import { doCoturn, soTurn, type Servidor, VALIDADE_S } from "@/lib/rede/voz/retransmissao";

export const dynamic = "force-dynamic";

const semGuardar = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
const GRUPO = /^(nucleo:[0-9a-f-]{36}|comunidade:[a-z0-9-]{2,60})$/;

async function daCloudflare(chave: string, token: string): Promise<Servidor[] | null> {
  try {
    const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(chave)}/credentials/generate-ice-servers`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ttl: VALIDADE_S }),
      cache: "no-store",
    });
    if (!r.ok) return null;
    const corpo = (await r.json()) as { iceServers?: Servidor[] | Servidor };
    const lista = Array.isArray(corpo.iceServers) ? corpo.iceServers : corpo.iceServers ? [corpo.iceServers] : [];
    return soTurn(lista);
  } catch {
    return null;
  }
}

export async function POST(pedido: Request) {
  const corpo = (await pedido.json().catch(() => null)) as { grupo?: unknown } | null;
  const grupo = typeof corpo?.grupo === "string" ? corpo.grupo : "";
  if (!GRUPO.test(grupo)) return Response.json({ erro: "grupo" }, { status: 400, headers: semGuardar });

  // A mesma chave TURN da Cloudflare da aula ao vivo serve (CLOUDFLARE_TURN_KEY_ID e CLOUDFLARE_TURN_TOKEN); VOZ_TURN_CF_* separa, se quiser.
  const cfChave = (process.env.VOZ_TURN_CF_CHAVE || process.env.CLOUDFLARE_TURN_KEY_ID || "").trim();
  const cfToken = (process.env.VOZ_TURN_CF_TOKEN || process.env.CLOUDFLARE_TURN_TOKEN || "").trim();
  const urls = (process.env.VOZ_TURN_URLS ?? "").split(",").map((u) => u.trim()).filter((u) => /^turns?:/.test(u));
  const segredo = (process.env.VOZ_TURN_SEGREDO ?? "").trim();
  if (!(cfChave && cfToken) && !(urls.length && segredo)) return Response.json({ erro: "desligada" }, { headers: semGuardar });

  // Só membro do grupo (o banco confere com a sessão da pessoa; quem não é recebe "nao_encontrado").
  const bearer = /^Bearer (.+)$/.exec(pedido.headers.get("authorization") ?? "")?.[1];
  if (!bearer) return Response.json({ erro: "entre_primeiro" }, { status: 401, headers: semGuardar });
  const membro = await rpcNoBanco<unknown>("rede_mls_estado", { p_grupo: grupo, p_desde: 2147483647 }, bearer);
  if (!membro.ok) return Response.json({ erro: "nao_encontrado" }, { status: 404, headers: semGuardar });

  const servidores = cfChave && cfToken ? await daCloudflare(cfChave, cfToken) : doCoturn(urls, segredo);
  if (!servidores?.length) return Response.json({ erro: "desligada" }, { headers: semGuardar });
  return Response.json({ iceServers: servidores, validade: VALIDADE_S }, { headers: semGuardar });
}
