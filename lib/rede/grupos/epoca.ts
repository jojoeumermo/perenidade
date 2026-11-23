// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Tudo o que um grupo MLS usa numa época sai de UM segredo exportado pela biblioteca (o "exporter" do RFC 9420, seção 8.5:
// `exportSecretKey(grupo, 32)` do motor). A biblioteca não aceita rótulo no exporter; então a Alumia tira de cada segredo exportado,
// com HKDF-SHA-256 (@noble/hashes, auditada) e um rótulo por finalidade, a chave do embrulho dos commits, a chave dos posts "p2", a
// da voz e, na equipe, a das mensagens. Quem não está na época não tem o segredo: não deriva nada disso. Quem sai do grupo perde
// tudo na época seguinte. Nenhuma primitiva feita aqui: só a chamada da biblioteca. Sem "@/": roda no Node nos testes.
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { ROTULOS } from "./rotulos-do-motor";

export type TipoDeGrupo = "grupo" | "equipe";

export interface SegredosDaEpoca {
  /** SHA-256(rótulo ‖ id do grupo): amarra o embrulho ao grupo (não é segredo). */
  amarra: Uint8Array;
  /** A chave do embrulho (XChaCha20-Poly1305) dos commits que vão ao banco. */
  embrulho: Uint8Array;
  /** Grupo: a chave dos posts "p2". Equipe: a chave das mensagens "m1". */
  conteudo: Uint8Array;
  /** Só no grupo: a base das chaves das salas de voz. Na equipe, null. */
  voz: Uint8Array | null;
}

const texto = new TextEncoder();
const derivar = (segredo: Uint8Array, sal: Uint8Array, rotulo: string) => hkdf(sha256, segredo, sal, texto.encode(rotulo), 32);

/** A amarração de um grupo (o id do grupo no MLS) ao embrulho. */
export function amarraDoGrupo(grupo: Uint8Array): Uint8Array {
  const prefixo = texto.encode(ROTULOS.amarra);
  const junto = new Uint8Array(prefixo.length + grupo.length);
  junto.set(prefixo);
  junto.set(grupo, prefixo.length);
  return sha256(junto);
}

/**
 * Os segredos de uma época. `exportado`: os 32 bytes do exporter do MLS naquela época (cada época dá outro). `grupo`: o
 * identificador do grupo no MLS (o sal: dois grupos nunca dão a mesma chave, nem com o mesmo segredo).
 */
export function segredosDaEpoca(exportado: Uint8Array, grupo: Uint8Array, tipo: TipoDeGrupo): SegredosDaEpoca {
  if (exportado.length !== 32) throw new Error("segredo_invalido");
  return {
    amarra: amarraDoGrupo(grupo),
    embrulho: derivar(exportado, grupo, tipo === "grupo" ? ROTULOS.grupo.embrulho : ROTULOS.equipe.embrulho),
    conteudo: derivar(exportado, grupo, tipo === "grupo" ? ROTULOS.grupo.post : ROTULOS.equipe.mensagem),
    voz: tipo === "grupo" ? derivar(exportado, grupo, ROTULOS.grupo.voz) : null,
  };
}

/** A chave de uma sala de voz, tirada da chave de voz da época com o nome da sala (salas diferentes, chaves diferentes). */
export function chaveDaSala(voz: Uint8Array, grupo: Uint8Array, sala: string): Uint8Array {
  return hkdf(sha256, voz, grupo, texto.encode(`${ROTULOS.sala}|${sala}`), 32);
}

/** Apaga da memória os segredos de uma época (o melhor que o JavaScript deixa: zera os bytes). */
export function apagarSegredos(s: SegredosDaEpoca): void {
  for (const b of [s.embrulho, s.conteudo, s.voz]) b?.fill(0);
}
