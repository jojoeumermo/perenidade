// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A conferência de saúde do site, para o monitor (.github/workflows/monitor.yml, scripts/operacao/monitor.mjs). Pergunta ao
// banco, com a chave pública (a mesma que qualquer visita usa), a versão da Alumia e se as filas andam (public.operacao_saude:
// só sim ou não). Não devolve nada de ninguém: nem número de pessoas, nem endereço, nem o endereço do banco, nem mensagem de erro.
// Sem a função nova no banco (a migração da operação ainda não rodou), cai na versão da Alumia, que já é pública.
import { VERSAO_ESPERADA_DO_BANCO } from "@/lib/rede/painel/tipos";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

const SEM_CACHE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

type Filas = { emails: boolean | null; agendados: boolean | null; faxina: boolean | null };

async function perguntar(base: string, chave: string, funcao: string): Promise<{ ok: boolean; status: number; valor: unknown }> {
  const r = await fetch(`${base}/rest/v1/rpc/${funcao}`, {
    method: "POST",
    headers: { apikey: chave, Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: "{}",
    cache: "no-store",
    signal: AbortSignal.timeout(3000),
  });
  return { ok: r.ok, status: r.status, valor: r.ok ? await r.json().catch(() => null) : null };
}

const simOuNao = (v: unknown) => (typeof v === "boolean" ? v : null);

export async function GET() {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!base || !chave) return Response.json({ site: "ok", banco: "sem_configuracao", esperada: VERSAO_ESPERADA_DO_BANCO }, { headers: SEM_CACHE });
  let versao: number | null = null;
  let filas: Filas | null = null;
  try {
    const saude = await perguntar(base, chave, "operacao_saude");
    if (saude.ok && saude.valor && typeof saude.valor === "object") {
      const v = saude.valor as Record<string, unknown>;
      versao = typeof v.versao === "number" ? v.versao : null;
      filas = { emails: simOuNao(v.emails_em_dia), agendados: simOuNao(v.agendados_em_dia), faxina: simOuNao(v.faxina_em_dia) };
    } else {
      const antiga = await perguntar(base, chave, "rede_alumia_versao");
      versao = antiga.ok && typeof antiga.valor === "number" ? antiga.valor : null;
    }
  } catch {
    versao = null;
  }
  const banco = versao === null ? "sem_resposta" : versao >= VERSAO_ESPERADA_DO_BANCO ? "ok" : "desatualizado";
  return Response.json({ site: "ok", banco, versao, esperada: VERSAO_ESPERADA_DO_BANCO, ...(filas ? { filas } : {}) }, { headers: SEM_CACHE });
}
