// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A identidade da conta, como o voto em limiar a usa (lib/rede/voto/limiar.ts): assinar a chave de voto da guardiã e o registro
// da chave da votação, e conferir a identidade de quem criou e das guardiãs.
//
// A identidade é a do chat novo (Ed25519 da conta, guardada no aparelho; a pública no diretório e no registro de transparência).
// Quem a guarda é outra parte do código (os aparelhos e o registro de transparência do chat). Para o voto não depender de como ela
// é guardada, essa parte ENTREGA uma fonte por `ligarIdentidadeDoVoto` (lib/rede/chat/r2/navegador.ts, quando o chat abre neste
// aparelho; a urna do navegador abre o chat sozinha quando precisa). Sem fonte ligada, a tela diz que é preciso ligar o chat novo
// neste aparelho: para ser guardiã, para abrir votação secreta E para votar, porque sem ela o aparelho não confere no registro
// público as identidades de quem criou a votação e das guardiãs (só a coerência interna não segura um servidor ativo).
// Sem os atalhos "@/" de propósito: os testes rodam este arquivo direto no Node.

export interface IdentidadeDoVoto {
  /** A conta (uuid). */
  usuario: string;
  /** A identidade da conta (Ed25519, 32 bytes): a mesma do diretório. */
  publica: Uint8Array;
  /** Assina com a identidade da conta (Ed25519). */
  assinar(texto: Uint8Array): Promise<Uint8Array>;
}

/** O que o registro de transparência diz de uma identidade: a que ele conhece, outra, ou não sabe (ainda não conferiu). */
export type IdentidadeConferida = "conferida" | "trocada" | "nao_conferida";

export interface FonteDaIdentidade {
  /** A identidade deste aparelho, ou nulo se o chat novo ainda não foi ligado aqui. */
  minha(): Promise<IdentidadeDoVoto | null>;
  /** Confere a identidade de outra conta no registro de transparência. */
  conferir(usuario: string, identidade: Uint8Array): Promise<IdentidadeConferida>;
}

let fonte: FonteDaIdentidade | null = null;

/** Liga a fonte da identidade (uma vez, quando a identidade do chat novo abre neste aparelho). Nulo desliga (Sair rápido). */
export function ligarIdentidadeDoVoto(f: FonteDaIdentidade | null): void {
  fonte = f;
}

export function fonteDaIdentidadeDoVoto(): FonteDaIdentidade | null {
  return fonte;
}
