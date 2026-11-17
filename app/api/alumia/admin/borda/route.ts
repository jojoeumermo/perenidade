// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O bloqueio na borda durante um ataque (painel único da Alumia, aba Ataque). Só a coordenação com o segundo fator (o banco
// decide, por public.alumia_admin_eu com o token de quem pediu); para todo o resto, 404.
//   POST {acao: "estado"}                          → {configurada, lista} (e antes apaga na Cloudflare o que venceu)
//   POST {acao: "bloquear", ip, horas, motivo}     → {ok, id, vence_em}
//   POST {acao: "tirar", id, motivo}               → {ok}
// O endereço digitado vai daqui direto à Cloudflare e some: não vai ao banco (que guarda o número da regra e a hora de vencer),
// não vai a log e não volta na resposta. O motivo fica guardado, então não pode levar endereço nem @ de conta
// (invalido:motivo_com_endereco; o banco confere o endereço de novo). A chave da Cloudflare (ALUMIA_CF_TOKEN, ALUMIA_CF_ZONA) só existe no servidor.
import { alvoDoBloqueio, apagarRegra, configDaCloudflare, criarRegra } from "@/lib/rede/admin/cloudflare";
import { conferirMotivoDaBorda } from "@/lib/rede/admin/motivo";
import { eCoordenacaoComFator, tokenDoPedido, varrerVencidas } from "@/lib/rede/admin/servidor";
import { deOutraOrigem, resposta } from "@/lib/rede/convites/servidor";
import { rpcComToken } from "@/lib/rede/seguranca/servico-de-contas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const naoExiste = () => resposta(null, 404);

interface Corpo {
  acao?: unknown;
  ip?: unknown;
  horas?: unknown;
  motivo?: unknown;
  id?: unknown;
}

export async function POST(pedido: Request) {
  if (deOutraOrigem(pedido)) return naoExiste();
  const token = tokenDoPedido(pedido);
  if (!token || !(await eCoordenacaoComFator(token))) return naoExiste();
  const c = (await pedido.json().catch(() => null)) as Corpo | null;
  const cfg = configDaCloudflare();

  if (c?.acao === "estado") {
    if (cfg) await varrerVencidas(cfg);
    const lista = await rpcComToken<unknown>("alumia_admin_borda_lista", {}, token);
    return resposta({ configurada: Boolean(cfg), lista: lista.ok ? lista.dado : null });
  }

  if (!cfg) return resposta({ ok: false, codigo: "sem_configuracao" }, 503);

  if (c?.acao === "bloquear") {
    const alvo = alvoDoBloqueio(c.ip);
    if (!alvo.ok) return resposta({ ok: false, codigo: alvo.motivo }, 400);
    const horas = Number.isInteger(c.horas) ? Number(c.horas) : 0;
    if (horas < 24 || horas > 168) return resposta({ ok: false, codigo: "invalido:horas" }, 400);
    const motivo = conferirMotivoDaBorda(c.motivo);
    if (!motivo.ok) return resposta({ ok: false, codigo: motivo.codigo }, 400);
    const regra = await criarRegra(alvo.alvo, horas, cfg);
    if (!regra.ok) return resposta({ ok: false, codigo: regra.motivo }, 502);
    const guardado = await rpcComToken<{ id: string; vence_em: string }>("alumia_admin_borda_guardar", { p_regra: regra.regra, p_horas: horas, p_motivo: motivo.motivo }, token);
    if (!guardado.ok) {
      // Sem a linha no banco, ninguém apagaria a regra quando vencesse: ela sai da Cloudflare agora.
      await apagarRegra(regra.regra, cfg);
      return resposta({ ok: false, codigo: guardado.codigo }, 400);
    }
    return resposta({ ok: true, id: guardado.dado.id, vence_em: guardado.dado.vence_em });
  }

  if (c?.acao === "tirar") {
    const id = typeof c.id === "string" && UUID.test(c.id) ? c.id : "";
    if (!id) return resposta({ ok: false, codigo: "invalido:id" }, 400);
    const motivo = conferirMotivoDaBorda(c.motivo);
    if (!motivo.ok) return resposta({ ok: false, codigo: motivo.codigo }, 400);
    const regra = await rpcComToken<string>("alumia_admin_borda_regra", { p_id: id }, token);
    if (!regra.ok) return resposta({ ok: false, codigo: regra.codigo }, 400);
    if (!(await apagarRegra(String(regra.dado), cfg))) return resposta({ ok: false, codigo: "cloudflare_fora_do_ar" }, 502);
    const baixa = await rpcComToken("alumia_admin_borda_tirada", { p_id: id, p_motivo: motivo.motivo }, token);
    if (!baixa.ok) return resposta({ ok: false, codigo: baixa.codigo }, 400);
    return resposta({ ok: true });
  }

  return resposta({ ok: false, codigo: "invalido:acao" }, 400);
}
