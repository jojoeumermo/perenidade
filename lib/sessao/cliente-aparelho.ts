// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O lado do navegador do "navegador conhecido" (P5, A4; o desenho está em lib/sessao/aparelho.ts). Logo que uma sessão aparece
// neste endereço (entrar, a ponte do login único, o link do e-mail, ou só abrir a página com a sessão guardada), apresenta a
// sessão à rota /api/sessao/aparelho, que lê o cookie HttpOnly deste navegador. Uma vez por sessão: o id da última sessão
// apresentada fica guardado (só o id, que já está no token guardado ao lado). Erro aqui nunca atrapalha a entrada.

const CHAVE = "lucia:aparelho-sessao";

function sessaoDoToken(token: string): string | null {
  try {
    const meio = token.split(".")[1] ?? "";
    const corpo = JSON.parse(atob(meio.replace(/-/g, "+").replace(/_/g, "/"))) as { session_id?: unknown };
    return typeof corpo.session_id === "string" ? corpo.session_id : null;
  } catch {
    return null;
  }
}

const emAndamento = new Set<string>();

/** Apresenta a sessão deste token, se ainda não foi apresentada neste navegador. */
export async function apresentarSessao(token: string | null | undefined): Promise<void> {
  if (typeof window === "undefined" || !token) return;
  const sessao = sessaoDoToken(token);
  if (!sessao || emAndamento.has(sessao)) return;
  try {
    if (localStorage.getItem(CHAVE) === sessao) return;
  } catch {
    return;
  }
  emAndamento.add(sessao);
  try {
    const r = await fetch("/api/sessao/aparelho", { method: "POST", credentials: "same-origin", headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const d = (await r.json().catch(() => null)) as { ok?: boolean } | null;
    if (r.ok && d?.ok) {
      try {
        localStorage.setItem(CHAVE, sessao);
      } catch {
        // sem armazenamento: apresenta de novo na próxima vez (o banco responde "conhecido" sem aviso)
      }
    }
  } catch {
    // sem rede: tenta de novo na próxima abertura
  } finally {
    emAndamento.delete(sessao);
  }
}
