// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O navegador conhecido (P5, A4): a parte pura, que roda na rota /api/sessao/aparelho e nos testes. Sem "@/" de propósito.
//
// Cada navegador onde a pessoa já entrou guarda um identificador aleatório (32 bytes) num cookie HttpOnly, Secure e SameSite=Lax,
// que só o servidor lê. O servidor manda ao banco o resumo SHA-256 dele, e o banco guarda só uma marca por conta (o SHA-256 do
// resumo com a conta, em interno.alumia_navegadores), junto do nome do navegador e do sistema ("Chrome", "Windows") e do dia em
// que foi visto; nada de endereço de rede. A cada sessão nova, o servidor apresenta o resumo: navegador conhecido não recebe o
// aviso de "entrada nova"; navegador novo recebe. O cookie é renovado (o mesmo valor, prazo novo) de 30 em 30 dias; o valor não
// troca, para que duas contas no mesmo navegador não se derrubem uma à outra.
// O identificador não é credencial: quem o copia não entra em conta nenhuma, só evita um aviso (a senha e o código continuam).
import { createHash, randomBytes } from "node:crypto";

/** O nome do cookie: com o prefixo __Secure- quando vai só por https (o navegador recusa o prefixo sem o Secure). */
export const nomeDoCookie = (seguro: boolean) => (seguro ? "__Secure-al-aparelho" : "al-aparelho");

/** O prazo do cookie: 400 dias (o teto do Chrome). O banco esquece o navegador que não aparece nesse prazo. */
export const PRAZO_DO_COOKIE_S = 400 * 24 * 60 * 60;

const VALOR = /^[A-Za-z0-9_-]{43}$/;

/** Um identificador novo: 32 bytes aleatórios em base64url (43 letras). */
export function identificadorNovo(): string {
  return randomBytes(32).toString("base64url");
}

/** O resumo que o banco guarda (SHA-256 em hexadecimal). Nulo para um valor fora da forma (cookie mexido). */
export function resumoDoIdentificador(valor: string | null | undefined): string | null {
  if (!valor || !VALOR.test(valor)) return null;
  return createHash("sha256").update(valor, "utf8").digest("hex");
}

/** O valor de um cookie no cabeçalho Cookie. */
export function lerCookie(cabecalho: string | null | undefined, nome: string): string | null {
  if (!cabecalho) return null;
  for (const parte of cabecalho.split(";")) {
    const i = parte.indexOf("=");
    if (i < 0) continue;
    if (parte.slice(0, i).trim() === nome) return parte.slice(i + 1).trim() || null;
  }
  return null;
}

/**
 * O domínio do cookie: o do site do instituto quando o pedido vem dele ou de um subdomínio dele (alumia., escola.), para o mesmo
 * navegador ser um só no site, na Alumia e na Escola. Fora disso (outro endereço, localhost com porta), só o próprio endereço.
 */
export function dominioDoCookie(hostDoPedido: string | null | undefined, enderecoDoSite: string | null | undefined): string | null {
  if (!hostDoPedido || !enderecoDoSite) return null;
  let site: string;
  try {
    site = new URL(enderecoDoSite).hostname.toLowerCase();
  } catch {
    return null;
  }
  const host = hostDoPedido.toLowerCase().replace(/:\d+$/, "");
  if (!site.includes(".") || site === "localhost" || /^[\d.]+$/.test(site)) return null;
  return host === site || host.endsWith(`.${site}`) ? site : null;
}

/** O cabeçalho Set-Cookie do identificador. */
export function montarCookie(valor: string, opcoes: { seguro: boolean; dominio: string | null }): string {
  const partes = [`${nomeDoCookie(opcoes.seguro)}=${valor}`, "Path=/", `Max-Age=${PRAZO_DO_COOKIE_S}`, "HttpOnly", "SameSite=Lax"];
  if (opcoes.seguro) partes.push("Secure");
  if (opcoes.dominio) partes.push(`Domain=${opcoes.dominio}`);
  return partes.join("; ");
}
