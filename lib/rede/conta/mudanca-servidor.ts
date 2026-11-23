// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// 74. Do lado do servidor do site: para onde a pessoa se mudou (o "movedTo" do documento do ator), lido com a chave de serviço
// (public.rede_p4_ct_mudou_para, que só a chave de serviço chama). Com "alumia-p4-conta" desligado, nada (o documento fica como era).
import { ligado } from "@/lib/recursos";

const SUPA = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");

/** A conta nova de quem já mandou a mudança; nulo sem mudança, desligado ou se o banco não respondeu. */
export async function mudouPara(handle: string): Promise<string | null> {
  const servico = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!ligado("alumia-p4-conta") || !SUPA || !servico) return null;
  try {
    const r = await fetch(`${SUPA}/rest/v1/rpc/rede_p4_ct_mudou_para`, {
      method: "POST",
      headers: { apikey: servico, Authorization: `Bearer ${servico}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_handle: handle }),
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    const v = r.ok ? ((await r.json().catch(() => null)) as unknown) : null;
    return typeof v === "string" && /^https:\/\/[^\s]{1,490}$/.test(v) ? v : null;
  } catch {
    return null;
  }
}
