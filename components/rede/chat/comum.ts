// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { TextosDoChat } from "@/lib/rede/textos-chat";
import type { TextosDaRede } from "@/lib/rede/textos";
import { codigoDoErro, textoDoErro } from "../erros";

// Peças do chat privado: os botões (próprios do chat, para não depender do visual que a Alumia estiver usando) e o texto dos erros.
export const botaoForte = "min-h-11 rounded-full bg-[#c21f16] px-4 text-sm font-bold text-white hover:bg-[#1f1a14] disabled:opacity-50";
export const botaoLeve = "min-h-11 rounded-full border-[1.5px] border-ink px-4 text-sm font-semibold hover:bg-parchment-deep disabled:opacity-50";
export const botaoPerigo = "min-h-11 rounded-full border-[1.5px] border-oxblood px-4 text-sm font-semibold text-oxblood hover:bg-parchment-deep disabled:opacity-50";

/** O erro no idioma: primeiro os do chat, depois os da Alumia. Nunca mostra o conteúdo de nada, só o código traduzido. */
export function erroDoChat(t: TextosDoChat, s: Pick<TextosDaRede, "erros">, erro: unknown): string {
  const codigo = codigoDoErro(erro);
  const doChat = (t.erros as Record<string, string>)[codigo] ?? (erro instanceof Error ? (t.erros as Record<string, string>)[erro.message] : undefined);
  return doChat ?? textoDoErro(s, erro);
}
