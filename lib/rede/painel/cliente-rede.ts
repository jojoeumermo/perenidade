// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O lado do navegador da impressão de rede (app/api/alumia/impressao): ao entrar na
// Alumia e antes de pedir a conta, a tela de entrada pede ao servidor que registre de que rede a conta veio. O navegador não
// calcula nem vê nada: manda só a sessão; o servidor lê o endereço do próprio pedido.
// Falha, rota fora do ar ou segredo não configurado nunca impedem a entrada: quem barra é o banco.
import { getClient, hasBackend, hasSession } from "@/lib/backend";

const CHAVE = "lucia:alumia:rede-vista";
/** Ao entrar, uma vez a cada 10 minutos por aba basta (o pedido de conta sempre registra). */
const INTERVALO = 10 * 60_000;

export interface RedeRegistrada {
  ok: boolean;
  barrada: boolean;
}

/** Só na memória desta página: depois de uma troca de conta no aparelho, a entrada não registra a rede (nada é gravado para isso). */
let pularNestaPagina = false;

/** A entrada desta página não registra a rede (a senha de pânico chama, ao trocar a conta). Vale até a página recarregar. */
export function naoRegistrarRedeNestaPagina(): void {
  pularNestaPagina = true;
}

export async function registrarRede(momento: "entrada" | "pedido"): Promise<RedeRegistrada> {
  const nada = { ok: false, barrada: false };
  if (!hasBackend || !hasSession() || pularNestaPagina) return nada;
  try {
    if (momento === "entrada" && Date.now() - Number(sessionStorage.getItem(CHAVE) ?? 0) < INTERVALO) return nada;
  } catch {
    // sem armazenamento da aba: registra sempre
  }
  try {
    const supabase = await getClient();
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) return nada;
    const r = await fetch("/api/alumia/impressao", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ momento }),
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    const dado = (await r.json().catch(() => null)) as { ok?: boolean; barrada?: boolean } | null;
    if (dado?.ok) {
      try {
        sessionStorage.setItem(CHAVE, String(Date.now()));
      } catch {
        // segue
      }
    }
    return { ok: dado?.ok === true, barrada: dado?.barrada === true };
  } catch {
    return nada;
  }
}
