// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O rosto da própria conta no pé do menu da Alumia (A10 do Prompt 5): antes era sempre o mosaico de 16 cartões, mesmo com foto ou
// desenho escolhido. Agora é o que a pessoa escolheu (rede_perfil_meu → avatar), e muda na hora em que ela troca no Editar perfil.
// Guardado só na memória da aba; nada vai para o aparelho.
import type { ImagemDePerfil } from "./tipos-perfil";

const EVENTO = "alumia:rosto-da-conta";
let guardado: { imagem: ImagemDePerfil | null } | null = null;

/** O rosto guardado nesta aba (nulo: ainda não lido). */
export const rostoGuardado = (): { imagem: ImagemDePerfil | null } | null => guardado;

/** Guarda o rosto e avisa quem mostra (o menu, o painel "Mais" do celular). */
export function trocarRostoDaConta(imagem: ImagemDePerfil | null): void {
  guardado = { imagem };
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENTO));
}

/** Escuta a troca do rosto; devolve a função que para de escutar. */
export function ouvirRostoDaConta(aoMudar: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(EVENTO, aoMudar);
  return () => window.removeEventListener(EVENTO, aoMudar);
}

/** Esquece o rosto (ao sair da conta). */
export function esquecerRostoDaConta(): void {
  guardado = null;
}
