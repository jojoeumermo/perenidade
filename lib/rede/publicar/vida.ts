// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As regras puras do público e da vida do post (onda 9, 9D): o prazo para sumir, as semanas da conta, o aviso antes de publicar
// ofensa (lista aberta, só no aparelho) e o "leia antes de repostar" (só no aparelho). Sem estado de tela e sem "@/" de propósito:
// roda no Node dos testes (scripts/testar-alumia-o9-publicar.mjs). O banco é supabase/migracoes/20261115-alumia-o9-publicar.sql.
import { TERMOS_OFENSIVOS } from "./termos-ofensivos";

/** Quando o post some sozinho: 24 horas ou 7 dias (nulo: não some). */
export type SomeEm = "24h" | "7d";
export const PRAZOS_PARA_SUMIR: readonly SomeEm[] = ["24h", "7d"];

/** As escolhas de "apagar meus posts depois de X semanas" (as mesmas do banco). */
export const SEMANAS_DA_CONTA = [1, 2, 4, 8, 12, 26, 52] as const;
export type SemanasDaConta = (typeof SEMANAS_DA_CONTA)[number];
export const semanasValidas = (n: unknown): n is SemanasDaConta => typeof n === "number" && (SEMANAS_DA_CONTA as readonly number[]).includes(n);

/** Quanto falta para o post sumir, na maior unidade inteira (minutos, horas ou dias). Nulo: já venceu ou o prazo não vale. */
export function tempoAteSumir(expira: string | null | undefined, agora: number): { unidade: "min" | "h" | "d"; n: number } | null {
  if (!expira) return null;
  const fim = new Date(expira).getTime();
  if (!Number.isFinite(fim) || fim <= agora) return null;
  const min = Math.ceil((fim - agora) / 60_000);
  if (min < 60) return { unidade: "min", n: min };
  const h = Math.floor(min / 60);
  if (h < 48) return { unidade: "h", n: h };
  return { unidade: "d", n: Math.floor(h / 24) };
}

// ── Aviso antes de publicar ofensa (L3-22) ──

const TROCAS: Record<string, string> = { "4": "a", "@": "a", "3": "e", "0": "o", "1": "i", "5": "s", $: "s", "7": "t" };

/**
 * O texto do jeito que a lista compara: minúsculas, sem acento, sem as trocas de letra por número ou símbolo, letra repetida
 * junta ("viadooo" → "viado"), e tudo que não é letra vira um espaço só. Pura.
 */
export function normalizarParaAviso(texto: string): string {
  const semAcento = texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const trocado = Array.from(semAcento, (c) => TROCAS[c] ?? c).join("");
  return ` ${trocado.replace(/[^a-z]+/g, " ").replace(/([a-z])\1+/g, "$1").trim()} `;
}

/** Os termos da lista que aparecem no texto como palavra inteira (sem repetir, na ordem da lista). Pura. */
export function termosNoTexto(texto: string, lista: readonly string[] = TERMOS_OFENSIVOS): string[] {
  if (!texto.trim()) return [];
  const alvo = normalizarParaAviso(texto);
  const achados: string[] = [];
  for (const termo of lista) {
    const t = normalizarParaAviso(termo);
    if (t.trim() && alvo.includes(t) && !achados.includes(termo)) achados.push(termo);
  }
  return achados;
}

// ── Leia antes de repostar (L3-23) ──

/** O primeiro link http(s) do texto, sem a pontuação que costuma colar no fim. Pura. */
export function primeiroLink(texto: string | null | undefined): string | null {
  const m = (texto ?? "").match(/https?:\/\/[^\s<>"'()]+/i);
  return m ? m[0].replace(/[.,;:!?…]+$/, "") : null;
}

/**
 * A chave de um link para saber se já foi aberto neste aparelho: o mesmo endereço com ou sem barra no fim, com ou sem "www.", com
 * ou sem o "#" do fim, é o mesmo link. Nulo se não for um endereço http(s). Pura.
 */
export function chaveDoLink(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const caminho = u.pathname.replace(/\/+$/, "");
    return `link:${host}${caminho}${u.search}`;
  } catch {
    return null;
  }
}

/** O Repostar pergunta antes? Só quando o post tem link, a pergunta está ligada e o link não foi aberto neste aparelho. Pura. */
export function perguntarAntesDeRepostar(link: string | null, ligada: boolean, jaAberto: (chave: string) => boolean): boolean {
  const chave = chaveDoLink(link);
  return Boolean(chave && ligada && !jaAberto(chave));
}

// ── Escolhas deste aparelho (as duas valem só aqui e ligadas por padrão) ──

const CHAVE_OFENSA = "alumia:aviso-ofensa";
const CHAVE_LEIA = "alumia:leia-antes";

function lerLigado(chave: string): boolean {
  try {
    return localStorage.getItem(chave) !== "nao";
  } catch {
    return true;
  }
}
function gravarLigado(chave: string, sim: boolean): void {
  try {
    if (sim) localStorage.removeItem(chave);
    else localStorage.setItem(chave, "nao");
  } catch {
    // sem armazenamento (janela privada): vale o padrão (ligado)
  }
}

export const avisoDeOfensaLigado = () => lerLigado(CHAVE_OFENSA);
export const marcarAvisoDeOfensa = (sim: boolean) => gravarLigado(CHAVE_OFENSA, sim);
export const leiaAntesLigado = () => lerLigado(CHAVE_LEIA);
export const marcarLeiaAntes = (sim: boolean) => gravarLigado(CHAVE_LEIA, sim);
