// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A franquia das mensagens (message franking, onda R2, item 2.6), o lado do aparelho: cada cópia de mensagem leva uma chave `kf` de 32
// bytes sorteada (dentro do cifrado) e, fora dele, o compromisso c = HMAC-SHA-256(kf, rótulo ‖ id_h da caixa ‖ conteúdo). Ao
// depositar, o servidor devolve a marca t = HMAC(chave do dia, rótulo ‖ c ‖ id_h ‖ dia), guardada com o pacote. Quem denuncia mostra o
// conteúdo, `kf`, `c`, `t`, a caixa e o dia: o servidor refaz `t` e `c` e sabe que aquele conteúdo exato passou por aquela caixa
// naquele dia, sem ter lido nada antes. Só HMAC da @noble/hashes (auditada); o desenho é o do Facebook (2016), adaptado às caixas.
// Sem "@/" de propósito.
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesDe, juntar, ROTULOS, sortear } from "./base";

/** Uma chave de franquia nova (uma por cópia de mensagem). */
export const novaChaveDeFranquia = (): Uint8Array => sortear(32);

/** O compromisso da mensagem: HMAC(kf, "alumia/r2/franquia/v1" ‖ id_h ‖ conteúdo). Vai no depósito, fora do cifrado. */
export function compromisso(kf: Uint8Array, idH: Uint8Array, conteudo: Uint8Array): Uint8Array {
  if (kf.length !== 32 || idH.length !== 32) throw new Error("invalido:franquia");
  return hmac(sha256, kf, juntar(bytesDe(ROTULOS.franquia), idH, conteudo));
}

/** Uma mensagem escolhida para a denúncia (tudo em bytes; o aparelho manda em base64 de endereço). */
export interface MensagemDenunciada {
  /** O conteúdo exato que entrou no compromisso (sem a `kf`). */
  conteudo: Uint8Array;
  /** O trecho que a pessoa escolheu mostrar (tem de estar dentro do conteúdo, em UTF-8). */
  trecho: string;
  kf: Uint8Array;
  c: Uint8Array;
  t: Uint8Array;
  idH: Uint8Array;
  dia: string;
}

export interface Denuncia {
  mensagens: MensagemDenunciada[];
  /** A conta que o aparelho de quem denuncia atribui à autoria (pela sessão Proteus e pelo registro de transparência). */
  autor: string;
  categoria: string;
}

/** O trecho está dentro do conteúdo (bytes UTF-8 iguais, em sequência)? */
export function trechoDentro(conteudo: Uint8Array, trecho: string): boolean {
  const agulha = bytesDe(trecho);
  if (agulha.length === 0 || agulha.length > conteudo.length) return false;
  for (let i = 0; i + agulha.length <= conteudo.length; i++) {
    let j = 0;
    while (j < agulha.length && conteudo[i + j] === agulha[j]) j++;
    if (j === agulha.length) return true;
  }
  return false;
}

/**
 * Manda a denúncia com prova (COM a sessão de quem denuncia: a denúncia tem autoria, como as outras). Só vão os trechos escolhidos e o
 * conteúdo exato de cada mensagem escolhida, que a tela avisa que saem do cifrado. Devolve o protocolo, ou o erro ("sem_prova": a
 * prova não confere; "sem_servico"; "rede").
 */
export async function denunciarComProva(d: { autorCodinome: string; autorIdentidade: Uint8Array; categoria: string; mensagens: MensagemDenunciada[] }): Promise<{ ok: true; protocolo: string } | { ok: false; erro: string }> {
  const { paraB64u } = await import("./base");
  const { postComSessao } = await import("./transporte");
  const r = await postComSessao("/api/alumia/franquia/denunciar", {
    autor_codinome: d.autorCodinome,
    autor_identidade: paraB64u(d.autorIdentidade),
    categoria: d.categoria,
    mensagens: d.mensagens.map((m) => ({ conteudo: paraB64u(m.conteudo), trecho: m.trecho, kf: paraB64u(m.kf), c: paraB64u(m.c), t: paraB64u(m.t), id_h: paraB64u(m.idH), dia: m.dia })),
  });
  if (r.status === 200 && typeof r.corpo?.protocolo === "string") return { ok: true, protocolo: r.corpo.protocolo };
  return { ok: false, erro: typeof r.corpo?.erro === "string" ? r.corpo.erro : "rede" };
}
