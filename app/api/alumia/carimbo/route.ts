// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O carimbo de tempo do registro de abuso (Prompt 4, item 10; lib/rede/seguranca-pessoal/carimbo.ts):
//   POST, com a sessão no cabeçalho Authorization, {resumo: 64 letras hexadecimais (o SHA-256 do arquivo)}
//     → {ok, carimbo (DER, base64), hora (ISO), servico (só o nome do servidor)}
// O pedido RFC 3161 sai DAQUI, nunca do aparelho: o serviço de carimbo não vê o endereço nem a conta de quem pediu, só o resumo. O
// arquivo nunca passa por aqui. Sem ALUMIA_CARIMBO_URL (a escolha do serviço é da coordenação), responde "sem_servico" e a tela
// manda o registro sem carimbo, dizendo isso. Nada vai a log; o freio é na memória do processo.
import { contaDoToken, criarFreio, deOutraOrigem, resposta } from "@/lib/rede/convites/servidor";
import { lerRespostaDoCarimbo, pedidoDeCarimbo, resumoDeHex, servicoDoCarimbo } from "@/lib/rede/seguranca-pessoal/carimbo";
import { ligado } from "@/lib/recursos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const freio = criarFreio(20, 60 * 60_000);

const paraBase64 = (b: Uint8Array) => Buffer.from(b).toString("base64");

export async function POST(pedido: Request) {
  if (!ligado("alumia-p4-seguranca-pessoal")) return resposta({ ok: false, motivo: "desligado" }, 404);
  if (deOutraOrigem(pedido)) return resposta({ ok: false, motivo: "origem" }, 403);
  const servico = servicoDoCarimbo(process.env.ALUMIA_CARIMBO_URL);
  if (!servico) return resposta({ ok: false, motivo: "sem_servico" }, 503);
  const conta = await contaDoToken(pedido);
  if (conta === "sem_conexao") return resposta({ ok: false, motivo: "sem_conexao" }, 502);
  if (!conta) return resposta({ ok: false, motivo: "entre_primeiro" }, 401);
  if (!freio(conta.id)) return resposta({ ok: false, motivo: "muitos_pedidos" }, 429);

  const c = (await pedido.json().catch(() => null)) as Record<string, unknown> | null;
  const resumo = resumoDeHex(c?.resumo);
  if (!resumo) return resposta({ ok: false, motivo: "invalido" }, 400);
  const nonce = crypto.getRandomValues(new Uint8Array(8));
  let corpo: Uint8Array;
  try {
    const r = await fetch(servico, {
      method: "POST",
      headers: { "Content-Type": "application/timestamp-query", Accept: "application/timestamp-reply" },
      body: Buffer.from(pedidoDeCarimbo(resumo, nonce)),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) return resposta({ ok: false, motivo: "servico_fora" }, 502);
    corpo = new Uint8Array(await r.arrayBuffer());
    if (corpo.length > 64 * 1024) return resposta({ ok: false, motivo: "servico_fora" }, 502);
  } catch {
    return resposta({ ok: false, motivo: "servico_fora" }, 502);
  }
  const lido = lerRespostaDoCarimbo(corpo, resumo, nonce);
  if (!lido.ok) return resposta({ ok: false, motivo: "servico_fora" }, 502);
  return resposta({ ok: true, carimbo: paraBase64(lido.token), hora: lido.hora, servico: servico.hostname });
}
