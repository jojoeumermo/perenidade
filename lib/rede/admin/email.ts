// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O e-mail de uma conta banida pelo painel único da Alumia, sem guardar o e-mail: o servidor calcula HMAC-SHA-256 do endereço
// normalizado com um segredo que vive só na variável ALUMIA_EMAIL_SEGREDO, e o banco guarda só esse resumo
// (interno.alumia_admin_emails_barrados). Sem o segredo, o resumo não volta ao e-mail nem testando listas de endereços.
// Trocar o segredo desfaz todos os e-mails barrados (as contas banidas continuam banidas).
//
// Só no servidor. Sem os atalhos "@/" de propósito: scripts/testar-alumia-admin.mjs roda este arquivo direto no Node.
import { createHmac } from "node:crypto";

export const TAMANHO_MINIMO_DO_SEGREDO_DO_EMAIL = 32;

/**
 * O endereço na forma que entra na conta: sem espaços, em minúsculas e sem o "+etiqueta" da parte de antes do @ (o mesmo
 * e-mail com outra etiqueta continua barrado). No Gmail os pontos também saem, porque o Gmail os ignora.
 */
export function normalizarEmail(email: string): string | null {
  const texto = email.trim().toLowerCase();
  const arroba = texto.lastIndexOf("@");
  if (arroba < 1 || arroba === texto.length - 1 || /\s/.test(texto)) return null;
  let local = texto.slice(0, arroba).split("+")[0];
  const dominio = texto.slice(arroba + 1);
  if (dominio === "gmail.com" || dominio === "googlemail.com") local = local.replace(/\./g, "");
  if (!local) return null;
  return `${local}@${dominio === "googlemail.com" ? "gmail.com" : dominio}`;
}

/** O resumo do e-mail, em hexadecimal, ou nulo sem segredo (ou segredo curto) ou com endereço que não é e-mail. */
export function seloDoEmail(email: string | null | undefined, segredo: string | undefined = process.env.ALUMIA_EMAIL_SEGREDO): string | null {
  if (!segredo || segredo.trim().length < TAMANHO_MINIMO_DO_SEGREDO_DO_EMAIL || !email) return null;
  const normal = normalizarEmail(email);
  if (!normal) return null;
  return createHmac("sha256", segredo.trim()).update(`alumia:email-barrado:${normal}`).digest("hex");
}
