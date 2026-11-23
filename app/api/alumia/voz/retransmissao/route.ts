// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As credenciais curtas do servidor de retransmissão (TURN) das salas de voz da Alumia (lib/rede/voz/sala.ts; docs/rede/VOZ.md).
// Desde a R2 (membros escondidos), o servidor não sabe quem é de qual núcleo: a rota não recebe o grupo e não confere filiação. Dá
// a credencial a quem gastar um passe anônimo (Privacy Pass, lib/rede/passes/servidor.ts; só conta aprovada recebe passes), SEM
// sessão de conta: o servidor não liga a sala de voz a conta nenhuma. Quem pode ouvir é decidido pela chave da sala, que só os
// membros tiram do grupo. O áudio é cifrado ponta a ponta (DTLS-SRTP): o servidor de retransmissão só repassa
// pacotes que não consegue ouvir, e cada pessoa só vê o endereço dele, não o das outras. O provedor do TURN vê os endereços de rede,
// e a voz (UDP) não passa pelo Tor.
//
// Dois jeitos, escolhidos pelas variáveis do servidor do site (nunca no repositório):
//   - TURN da Cloudflare: CLOUDFLARE_TURN_KEY_ID e CLOUDFLARE_TURN_TOKEN (os mesmos da aula ao vivo), ou VOZ_TURN_CF_CHAVE e
//     VOZ_TURN_CF_TOKEN para uma chave só da voz;
//   - TURN próprio (coturn, com "use-auth-secret"): VOZ_TURN_URLS (separados por vírgula) e VOZ_TURN_SEGREDO.
// Sem nenhum dos dois: responde "desligada" e a tela diz que a voz ainda não está ligada.
import { paraBytea } from "@/lib/rede/caixas/base";
import { recusaDeSessao, trazSessao } from "@/lib/rede/caixas/rota";
import { rpcDeServico } from "@/lib/rede/convites/servidor";
import { conferirPasse } from "@/lib/rede/passes/servidor";
import { doCoturn, soTurn, type Servidor, VALIDADE_S } from "@/lib/rede/voz/retransmissao";

export const dynamic = "force-dynamic";

const semGuardar = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

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
  // A mesma chave TURN da Cloudflare da aula ao vivo serve (CLOUDFLARE_TURN_KEY_ID e CLOUDFLARE_TURN_TOKEN); VOZ_TURN_CF_* separa, se quiser.
  const cfChave = (process.env.VOZ_TURN_CF_CHAVE || process.env.CLOUDFLARE_TURN_KEY_ID || "").trim();
  const cfToken = (process.env.VOZ_TURN_CF_TOKEN || process.env.CLOUDFLARE_TURN_TOKEN || "").trim();
  const urls = (process.env.VOZ_TURN_URLS ?? "").split(",").map((u) => u.trim()).filter((u) => /^turns?:/.test(u));
  const segredo = (process.env.VOZ_TURN_SEGREDO ?? "").trim();
  if (!(cfChave && cfToken) && !(urls.length && segredo)) return Response.json({ erro: "desligada" }, { headers: semGuardar });

  // Sem sessão (um erro do aparelho nunca liga conta e sala) e com um passe anônimo, gasto no banco (repetido, recusado).
  if (trazSessao(pedido)) return recusaDeSessao();
  const passe = await conferirPasse(pedido.headers.get("authorization"));
  if (!passe.ok) return Response.json({ erro: passe.motivo === "sem_servico" ? "sem_servico" : "passe" }, { status: passe.motivo === "sem_servico" ? 503 : 401, headers: semGuardar });
  const gasto = await rpcDeServico<boolean>("rede_passe_gastar", { p_resumo: paraBytea(passe.resumo) });
  if (!gasto.ok) return Response.json({ erro: "rede" }, { status: 502, headers: semGuardar });
  if (gasto.dado !== true) return Response.json({ erro: "passe_usado" }, { status: 409, headers: semGuardar });

  const servidores = cfChave && cfToken ? await daCloudflare(cfChave, cfToken) : doCoturn(urls, segredo);
  if (!servidores?.length) return Response.json({ erro: "desligada" }, { headers: semGuardar });
  return Response.json({ iceServers: servidores, validade: VALIDADE_S }, { headers: semGuardar });
}
