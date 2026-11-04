// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { TextosDaRede } from "@/lib/rede/textos";
import { preencher } from "@/lib/rede/preencher";

/** O código de erro de uma chamada (BackendError.code) vira o texto do idioma; o que não se conhece vira a mensagem genérica. */
export function textoDoErro(s: Pick<TextosDaRede, "erros">, erro: unknown): string {
  const codigo = typeof erro === "object" && erro !== null && "code" in erro ? String((erro as { code: unknown }).code) : "falha";
  const [tipo, campo] = codigo.split(":");
  const erros = s.erros as Record<string, string>;
  if (tipo === "invalido") return preencher(erros.invalido, { campo: campo ?? "" });
  return erros[tipo] ?? erros.falha;
}

/** O código cru (para decidir o que a tela faz: pedir a entrada na Rede, confirmar o codinome…). */
export function codigoDoErro(erro: unknown): string {
  return typeof erro === "object" && erro !== null && "code" in erro ? String((erro as { code: unknown }).code) : "falha";
}
