// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O que o aparelho faz com cada pacote novo da malha sem internet (onda R3, item 2.2; documento público: docs/rede/SEM-INTERNET.md).
//
// Testa a etiqueta contra as chaves das caixas de entrada deste aparelho (as mesmas caixas da conversa a dois: o pacote leva o
// MESMO depósito que iria ao servidor, e abre pelo MESMO `receber`, com as mesmas sessões) e contra as chaves dos atos em que a
// pessoa confirmou presença (o farol). O que não é para este aparelho fica só na fila de repasse (no.ts).
//
// Farol: só vale com DUAS assinaturas de chaves diferentes da lista do ato (farol.ts); um farol com `quando` igual ou mais velho
// que o último aceito deste ato é ignorado (um aparelho por perto que guarda um farol velho e o solta depois não volta o estado);
// `quando` no futuro (mais de 10 minutos, o relógio de cada um) ou mais velho que a validade máxima também.
// Sem "@/" de propósito: roda no Node nos testes (scripts/testar-r3-malha.mjs).
import { paraHex, type Bytes } from "../chat/r2/bytes";
import { conferirFarol, lerFarol, type FarolAssinado } from "./farol";
import { abrirFarol, chaveDaEtiquetaDoAto, chaveDeDestino, depositoDe, eParaMim, ler, VALIDADE_MAXIMA_HORAS } from "./pacote";

export interface AtoDaMalha {
  /** O id do ato (16 bytes). */
  ato: Uint8Array;
  /** A chave do ato (32 bytes), recebida com internet por quem confirmou presença ou coordena. */
  kAto: Uint8Array;
  /** As chaves do farol da coordenação deste ato (Ed25519, 32 bytes cada). */
  chaves: readonly Uint8Array[];
}

export interface DestinoDaEntrega {
  /** Os ids das caixas de entrada deste aparelho (32 bytes cada): as da conversa a dois e a de sincronia. */
  caixas(): readonly Uint8Array[];
  /** Os atos em que a pessoa confirmou presença ou coordena. */
  atos(): readonly AtoDaMalha[];
  /** O depósito reconhecido vai ao mesmo `receber` da caixa. Devolve se abriu. */
  mensagem(caixaId: Uint8Array, deposito: { c: Bytes; envelope: Bytes }): Promise<boolean>;
  /** O farol reconhecido e conferido: `assinaturas` = quantas valem (2 = vale; 1 = pedido, só interessa a quem coordena). */
  farol(ato: Uint8Array, farol: FarolAssinado, assinaturas: number): Promise<void> | void;
}

const ADIANTADO_S = 10 * 60;

/** A função `entregar` do NoDaMalha para este aparelho. Nunca lança. */
export function entregador(d: DestinoDaEntrega, agora: () => number = () => Date.now()): (p: Uint8Array) => Promise<boolean> {
  const ultimoFarol = new Map<string, number>();
  return async (p) => {
    try {
      const lido = ler(p, agora());
      if (!lido) return false;
      const caixas = d.caixas();
      const atos = d.atos();
      const chaves = [...caixas.map((c) => chaveDeDestino(c)), ...atos.map((a) => chaveDaEtiquetaDoAto(a.kAto))];
      const i = eParaMim(lido, chaves);
      if (i < 0) return false;
      if (i < caixas.length) return await d.mensagem(caixas[i], depositoDe(lido, caixas[i]));
      const a = atos[i - caixas.length];
      const bytes = await abrirFarol(a.kAto, lido);
      const farol = bytes ? lerFarol(bytes) : null;
      if (!farol) return false;
      const n = conferirFarol(farol, a.ato, a.chaves);
      if (n < 1) return false;
      const s = Math.floor(agora() / 1000);
      if (farol.quando > s + ADIANTADO_S || farol.quando < s - VALIDADE_MAXIMA_HORAS * 3600) return false;
      const k = `${paraHex(a.ato)}:${n}`;
      if ((ultimoFarol.get(k) ?? -1) >= farol.quando) return false;
      ultimoFarol.set(k, farol.quando);
      await d.farol(a.ato, farol, n);
      return true;
    } catch {
      return false;
    }
  };
}
