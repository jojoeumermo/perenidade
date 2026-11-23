// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A lista de conversas sincronizada entre os aparelhos da pessoa (onda R2, item 2.2). O servidor guarda só um arquivo cifrado
// (public.rede_cofre_gravar, tipo "lista") com a chave de sincronia da conta, que só os aparelhos dela têm (repassada pelo QR de
// ligar ou pela cópia de segurança). Formato: lib/rede/aparelhos/arquivo.ts (libsodium, secretstream XChaCha20-Poly1305), com o
// rótulo da lista: um arquivo de cópia não abre como lista, nem o contrário.
import { deTexto, texto, type Bytes } from "../chat/r2/bytes";
import { ROTULOS } from "../chat/r2/rotulos";
import type { Cofre, Lista } from "../chat/r2/servico";
import { abrirArquivo, cifrarArquivo } from "./arquivo";

export const cofreDaLista: Cofre = {
  async cifrar(chave: Bytes, lista: Lista): Promise<Bytes> {
    const claro = texto(JSON.stringify(lista));
    try {
      return await cifrarArquivo(chave, ROTULOS.lista, "sincronia", null, claro);
    } finally {
      claro.fill(0);
    }
  },
  async abrir(chave: Bytes, arquivo: Uint8Array): Promise<Lista | null> {
    const claro = await abrirArquivo(chave, ROTULOS.lista, arquivo);
    if (!claro) return null;
    try {
      const l = JSON.parse(deTexto(claro));
      if (l?.v !== 1 || typeof l.conversas !== "object" || typeof l.contatos !== "object" || typeof l.prefs !== "object") return null;
      return { recusas: {}, bloqueios: {}, freio: [], aparelhos: {}, ...l } as Lista;
    } catch {
      return null;
    } finally {
      claro.fill(0);
    }
  },
};
