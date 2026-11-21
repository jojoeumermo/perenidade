// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O endereço do chat entre instâncias (onda R3, item 2.7; docs/rede/INSTANCIAS.md): "codinome@instancia", com a instância sendo o nome
// do site de uma organização parceira que roda a própria Alumia (só o nome, sem esquema, porta, caminho nem usuário). Sem "@/".
import { CODINOME } from "../caixas/diretorio";

/** Os rótulos desta frente (um por finalidade; a junção os junta em lib/rede/cifra/rotulos.ts). */
export const ROTULOS = {
  instancias: "alumia/r3/instancias/v1",
} as const;

/** O nome de uma instância: um nome de site em minúsculas, com pelo menos um ponto (nada de IP, porta ou "localhost"). */
const INSTANCIA = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** O menor e o maior número de bits da prova de trabalho de quem vem de fora (sem passe). O servidor pode pedir mais que o mínimo; o
 * aparelho não resolve mais que o máximo (um servidor que pede mais estaria travando o aparelho). */
export const BITS_DE_FORA_MINIMO = 22;
export const BITS_DE_FORA_MAXIMO = 24;

export interface EnderecoDeFora {
  codinome: string;
  instancia: string;
}

export const instanciaValida = (nome: string): boolean => INSTANCIA.test(nome);

/** Lê "codinome@instancia" (a última @ separa). Nulo se qualquer parte for torta. */
export function lerEndereco(texto: string): EnderecoDeFora | null {
  const t = texto.trim();
  const i = t.lastIndexOf("@");
  if (i < 1) return null;
  const codinome = t.slice(0, i).trim();
  const instancia = t.slice(i + 1).trim().toLowerCase();
  if (!CODINOME.test(codinome) || !instanciaValida(instancia)) return null;
  return { codinome, instancia };
}

export const escreverEndereco = (e: EnderecoDeFora): string => `${e.codinome}@${e.instancia}`;

/** É a própria instância deste aparelho? (Então o chat é o de sempre, não o de fora.) */
export const eDaqui = (e: EnderecoDeFora, propria: string): boolean => e.instancia === propria.trim().toLowerCase();
