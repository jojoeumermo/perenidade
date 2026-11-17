// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O lado do aparelho da conferência de links (onda 11, 11F): pergunta ao servidor do site se a conferência está ligada e manda
// SÓ os links do post (nunca o texto) para a rota /api/rede/links, com o token da sessão. Quem fala com o Google é o servidor.
// Na prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim), um dublê: a conferência aparece ligada e os endereços de teste públicos do próprio
// Google (testsafebrowsing.appspot.com) saem como perigosos, sem nada ir a lugar nenhum.
import { getClient } from "@/lib/backend";
import type { ResultadoDaConferencia } from "./safe-browsing";

const PREVIA = process.env.NEXT_PUBLIC_ALUMIA_PREVIA === "sim";

let ligada: Promise<boolean> | null = null;

/** A conferência está ligada no servidor (a chave existe)? Uma pergunta por página. */
export function conferenciaLigada(): Promise<boolean> {
  if (PREVIA) return Promise.resolve(true);
  ligada ??= fetch("/api/rede/links", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<{ ligado?: boolean }>) : { ligado: false }))
    .then((r) => r.ligado === true)
    .catch(() => false);
  return ligada;
}

/** O dublê da prévia: as páginas de teste do Safe Browsing. */
function naPrevia(links: string[]): ResultadoDaConferencia {
  const perigosos = links
    .filter((l) => /^https?:\/\/testsafebrowsing\.appspot\.com\//i.test(l))
    .map((link) => ({ link, tipos: [/phishing|social/i.test(link) ? "SOCIAL_ENGINEERING" : /unwanted/i.test(link) ? "UNWANTED_SOFTWARE" : "MALWARE"] }));
  return { conferido: true, perigosos };
}

/** Confere os links no servidor. Nulo quando não deu (sem sessão, sem rede, rota fora): a lista do aparelho continua valendo. */
export async function conferirNoServidor(links: string[]): Promise<ResultadoDaConferencia | null> {
  if (!links.length) return { conferido: false, perigosos: [] };
  if (PREVIA) return naPrevia(links);
  try {
    const supabase = await getClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;
    const r = await fetch("/api/rede/links", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ links: links.slice(0, 10) }),
      cache: "no-store",
    });
    if (!r.ok) return null;
    return (await r.json()) as ResultadoDaConferencia;
  } catch {
    return null;
  }
}
