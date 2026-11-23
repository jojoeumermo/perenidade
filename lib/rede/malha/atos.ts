// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os atos que este aparelho reconhece na malha sem internet (onda R3, item 2.2; documento público: docs/rede/SEM-INTERNET.md).
//
// - Antes do ato, COM internet: `buscarAto` pede ao banco o material do ato (public.rede_ato_farol_material: a chave do ato k_ato e
//   as 8 chaves do farol da coordenação, verdadeiras e falsas misturadas). Só quem confirmou presença ou coordena recebe; os outros
//   recebem nulo e o aparelho não guarda nada. O material fica SÓ NA MEMÓRIA deste app aberto (nada no disco: um celular apreendido
//   com o app fechado não diz de qual ato a pessoa ia participar). Fechar o app esquece; abrir com internet busca de novo.
// - Sem internet: o farol que chega pela malha e vale (duas assinaturas de chaves diferentes da lista: entrega.ts) fica em
//   `farolSemInternet(ato)`, e a tela ouve por `aoFarolSemInternet`. Um farol com uma assinatura só é PEDIDO: não aparece para quem
//   só confirmou presença.
// - `destinoComAtos` junta estes atos às caixas do chat no destino da entrega (ativacao.ts, `definirDestino`).
// Sem "@/" de propósito: roda no Node nos testes (scripts/testar-r3-malha-atos.mjs).
import { copia, iguais, type Bytes } from "../chat/r2/bytes";
import type { AtoDaMalha, DestinoDaEntrega } from "./entrega";
import { bytesDoUuid, type FarolAssinado } from "./farol";

/** O jeito de chamar o banco (lib/rede/cliente.ts, `chamar`). */
export type ChamarBanco = <T>(funcao: string, argumentos?: Record<string, unknown>) => Promise<T>;

/** Até quantos atos o aparelho reconhece ao mesmo tempo (cada um custa um HMAC por pacote que passa). */
export const ATOS_MAXIMO = 16;

interface Guardado {
  id: string;
  ato: AtoDaMalha;
}

const guardados = new Map<string, Guardado>();
const farois = new Map<string, FarolAssinado>();
const ouvintes = new Set<(ato: string, f: FarolAssinado) => void>();

/** Base64 comum (o que o banco devolve: interno.voto_b64) para bytes; torto = null. */
function deBase64(s: unknown): Bytes | null {
  if (typeof s !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(s) || s.length % 4 !== 0) return null;
  try {
    const bin = atob(s);
    const b = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    return b;
  } catch {
    return null;
  }
}

/** Confere o formato do material que veio do banco. Torto (ou nulo) = null: o aparelho não guarda nada. */
export function lerMaterial(idDoAto: string, r: unknown): AtoDaMalha | null {
  let ato: Bytes;
  try {
    ato = bytesDoUuid(idDoAto);
  } catch {
    return null;
  }
  if (!r || typeof r !== "object") return null;
  const m = r as { k_ato?: unknown; chaves?: unknown };
  const kAto = deBase64(m.k_ato);
  if (!kAto || kAto.length !== 32 || !Array.isArray(m.chaves) || m.chaves.length > 64) return null;
  const chaves: Bytes[] = [];
  for (const c of m.chaves) {
    const chave = deBase64((c as { chave?: unknown } | null)?.chave);
    if (!chave || chave.length !== 32) return null;
    if (!chaves.some((x) => iguais(x, chave))) chaves.push(chave);
  }
  return { ato, kAto, chaves };
}

/**
 * Busca (com internet) e guarda na memória o material de um ato. Devolve se o aparelho passou a reconhecer o farol dele. Sem
 * presença confirmada, ato cancelado ou erro de rede: false, e nada muda.
 */
export async function buscarAto(chamar: ChamarBanco, idDoAto: string): Promise<boolean> {
  const id = idDoAto.toLowerCase();
  let r: unknown;
  try {
    r = await chamar<unknown>("rede_ato_farol_material", { p_ato: id });
  } catch {
    return false;
  }
  const ato = lerMaterial(id, r);
  if (!ato) {
    esquecerAto(id);
    return false;
  }
  guardados.delete(id);
  guardados.set(id, { id, ato });
  while (guardados.size > ATOS_MAXIMO) esquecerAto(guardados.keys().next().value as string);
  return true;
}

/** Os atos que o aparelho reconhece agora. */
export const atosGuardados = (): AtoDaMalha[] => [...guardados.values()].map((g) => g.ato);

/** Esquece um ato (e o farol que tinha chegado dele). */
export function esquecerAto(idDoAto: string): void {
  guardados.delete(idDoAto.toLowerCase());
  farois.delete(idDoAto.toLowerCase());
}

/** Esquece todos (sair da conta, pânico). */
export function esquecerAtos(): void {
  guardados.clear();
  farois.clear();
}

const idDe = (ato: Uint8Array): string | null => {
  for (const g of guardados.values()) if (iguais(g.ato.ato, ato)) return g.id;
  return null;
};

/** O que a entrega faz com um farol reconhecido e conferido: só o de DUAS assinaturas vale para a tela. */
export function receberFarol(ato: Uint8Array, farol: FarolAssinado, assinaturas: number): void {
  if (assinaturas < 2) return;
  const id = idDe(ato);
  if (!id) return;
  const atual = farois.get(id);
  if (atual && atual.quando >= farol.quando) return;
  const guardado: FarolAssinado = { ...farol, ato: copia(farol.ato), assinaturas: farol.assinaturas.map((a) => ({ chave: copia(a.chave), assinatura: copia(a.assinatura) })) };
  farois.set(id, guardado);
  for (const f of ouvintes) f(id, guardado);
}

/** O último farol que chegou sem internet deste ato (ou null). */
export const farolSemInternet = (idDoAto: string): FarolAssinado | null => farois.get(idDoAto.toLowerCase()) ?? null;

/** Para a tela ouvir os faróis que chegam sem internet. Devolve o "parar". */
export function aoFarolSemInternet(f: (ato: string, farol: FarolAssinado) => void): () => void {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
}

/** O destino da entrega com os atos daqui: as caixas e as mensagens vêm do chat (`base`); o farol, deste módulo. */
export function destinoComAtos(base: Pick<DestinoDaEntrega, "caixas" | "mensagem">): DestinoDaEntrega {
  return { caixas: () => base.caixas(), mensagem: (c, d) => base.mensagem(c, d), atos: atosGuardados, farol: receberFarol };
}
