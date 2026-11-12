// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O script do quadro da ponte de sessão (app/api/sessao/ponte). Roda na origem do SITE, dentro de um quadro escondido que só a
// Alumia e a Escola podem embutir. Só responde a quem a embutiu, e só se essa origem for exatamente alumia.<site> ou escola.<site>
// (a mesma regra de lib/sessao/ponte.ts, origemPodePedir). Lê a sessão guardada pelo site (lucia:sessao); se o token está para
// vencer, renova com o mesmo cadeado que o cliente do Supabase usa (lock:lucia:sessao), para não brigar com uma aba aberta do site.
// Pede à rota o código de uma vez e devolve SÓ a quem pediu. Nada é guardado aqui.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPA = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function GET() {
  const js = `"use strict";
(() => {
  const SUPA = ${JSON.stringify(SUPA)}, ANON = ${JSON.stringify(ANON)}, CHAVE = "lucia:sessao";
  const pode = (o) => {
    try {
      const p = new URL(o), s = location;
      if (p.protocol !== s.protocol || p.port !== s.port) return false;
      if (p.protocol === "http:" && s.hostname !== "localhost") return false;
      if (p.protocol !== "https:" && p.protocol !== "http:") return false;
      return p.hostname === "alumia." + s.hostname || p.hostname === "escola." + s.hostname;
    } catch { return false; }
  };
  const ler = () => { try { const v = JSON.parse(localStorage.getItem(CHAVE) || "null"); return v && v.access_token ? v : null; } catch { return null; } };
  const fresca = (s) => s && Number(s.expires_at || 0) * 1000 > Date.now() + 60000;
  async function renovar() {
    const s = ler();
    if (!s || !s.refresh_token || !SUPA) return null;
    const r = await fetch(SUPA + "/auth/v1/token?grant_type=refresh_token", { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: s.refresh_token }), cache: "no-store", credentials: "omit" });
    if (!r.ok) return null;
    const n = await r.json();
    if (!n || !n.access_token) return null;
    if (!n.expires_at && n.expires_in) n.expires_at = Math.round(Date.now() / 1000) + Number(n.expires_in);
    localStorage.setItem(CHAVE, JSON.stringify(n));
    return n;
  }
  async function sessao() {
    const s = ler();
    if (!s) return null;
    if (fresca(s)) return s;
    const fazer = async () => (fresca(ler()) ? ler() : renovar());
    return navigator.locks ? navigator.locks.request("lock:" + CHAVE, fazer) : fazer();
  }
  addEventListener("message", async (ev) => {
    if (ev.source !== parent || !pode(ev.origin)) return;
    const m = ev.data;
    if (!m || m.tipo !== "pedir" || typeof m.n !== "string" || !/^[a-f0-9]{32}$/.test(m.n)) return;
    const responder = (x) => parent.postMessage(Object.assign({ n: m.n }, x), ev.origin);
    try {
      const s = await sessao();
      if (!s) return responder({ tipo: "nada", motivo: "sem_sessao" });
      const r = await fetch("/api/sessao/ponte", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + s.access_token }, body: JSON.stringify({ destino: ev.origin }), cache: "no-store", credentials: "omit" });
      const b = await r.json().catch(() => null);
      if (!r.ok || !b || !b.token_hash) return responder({ tipo: "nada", motivo: (b && b.erro) || "falha" });
      responder({ tipo: "sessao", token_hash: b.token_hash });
    } catch { responder({ tipo: "nada", motivo: "falha" }); }
  });
})();
`;
  return new Response(js, { headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
