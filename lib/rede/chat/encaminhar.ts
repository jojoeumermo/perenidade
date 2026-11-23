// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O freio de encaminhamento do chat (Prompt 4, item 14, atrás de "alumia-p4-conversa"), como no WhatsApp: o texto encaminhado leva
// DENTRO do cifrado quantas vezes já foi encaminhado (lib/rede/chat/r2/bloco.ts, a marca "encaminhada" do corpo de texto). Quem
// recebe vê "Encaminhada" ou, a partir de MUITAS_VEZES, "Encaminhada muitas vezes"; e o que já foi encaminhado muitas vezes só vai
// para UMA conversa por vez. O servidor não conta nada (nem vê a marca): a conta é feita por cada aparelho, e um aparelho alterado
// pode zerar a dele; o freio é de costume, para desacelerar a corrente, não uma trava contra quem quer burlar.
// Sem "@/" de propósito: roda no Node (scripts/testar-p4-conversa.mjs).

/** A partir de quantos encaminhamentos o texto é "encaminhado muitas vezes" (o número do WhatsApp). */
export const MUITAS_VEZES = 5;
/** Para quantas conversas de uma vez dá para encaminhar um texto que ainda não foi encaminhado muitas vezes. */
export const DESTINOS_DE_UMA_VEZ = 5;
/** A contagem cabe num byte dentro do cifrado. */
export const MAIOR_CONTAGEM = 255;

/** A contagem que o texto leva ao ser encaminhado de novo (a de agora mais um, até o teto). */
export const contagemAoEncaminhar = (atual: number | undefined): number => Math.min(MAIOR_CONTAGEM, Math.max(0, Math.floor(atual ?? 0)) + 1);

/** A marca que a tela mostra. */
export function marcaDeEncaminhada(contagem: number | undefined): "encaminhada" | "muitas" | null {
  if (!contagem || contagem < 1) return null;
  return contagem >= MUITAS_VEZES ? "muitas" : "encaminhada";
}

/** Para quantas conversas de uma vez dá para encaminhar um texto com esta contagem (a de quem recebeu, antes de encaminhar). */
export const destinosPermitidos = (atual: number | undefined): number => (contagemAoEncaminhar(atual) >= MUITAS_VEZES ? 1 : DESTINOS_DE_UMA_VEZ);
