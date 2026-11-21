// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os segredos de cada época de um grupo. Tudo vem de UM segredo exportado do MLS por época (`exportSecretKey`, que todo membro
// daquela época tira igual e quem saiu não tira mais) e passa pelo HKDF-SHA-256 do @noble/hashes, com o id do grupo como sal e um
// rótulo por finalidade (lib/rede/membros/rotulos.ts):
//   caixa da época (id, passe de depósito, passe de leitura), chave do embrulho, chave dos posts p2, chave da voz.
// O servidor vê só a caixa (o resumo do id e dos passes): não sabe de qual grupo ela é, nem quem tem os passes. Ninguém fora da
// época tem os passes; quem sai perde na época seguinte.
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { juntar, texto } from "./bytes";
import { ROTULOS } from "./rotulos";
import type { Caixa, TipoDeGrupo } from "./tipos";

export interface SegredosDaEpoca {
  epoca: bigint;
  caixa: Caixa;
  embrulho: Uint8Array;
  post: Uint8Array;
  voz: Uint8Array;
}

/** O resumo do id da caixa, como o banco guarda (`id_h`): o servidor nunca grava o id cru. */
export function resumoDaCaixa(id: Uint8Array): Uint8Array {
  return sha256(juntar(texto("alumia/r2/caixa"), id));
}

/**
 * Deriva os segredos da época. `exportado` são os 32 bytes do `exportSecretKey(grupo, 32)` da época; `grupo` é o id do grupo
 * no MLS (32 bytes sorteados na criação). Função pura: o mesmo exportado dá os mesmos segredos em todo aparelho.
 */
export function derivarSegredos(exportado: Uint8Array, grupo: Uint8Array, epoca: bigint, tipo: TipoDeGrupo): SegredosDaEpoca {
  if (exportado.length !== 32 || grupo.length !== 32) throw new Error("segredo_invalido");
  const r = ROTULOS[tipo];
  const tirar = (rotulo: string) => hkdf(sha256, exportado, grupo, texto(rotulo), 32);
  return {
    epoca,
    caixa: { id: tirar(r.caixa), pd: tirar(r.deposito), pl: tirar(r.leitura), multi: true },
    embrulho: tirar(r.embrulho),
    post: tirar(r.post),
    voz: tirar(r.voz),
  };
}
