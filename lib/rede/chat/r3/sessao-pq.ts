// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A sessão SPQR com cada aparelho da outra ponta (onda R3, item 1.1): quando nasce, quem é A2B e quando um estado pode ser trocado.
// Documento: docs/rede/CHAT-PRIVADO.md ("A camada pós-quântica").
//
// - Quem manda primeiro a um aparelho com quem não tem estado SPQR sorteia a auth_key (32 bytes), cria o estado A2B e leva a auth_key
//   DENTRO de cada pacote (dentro do envelope X-Wing) até receber a primeira resposta daquele aparelho.
// - Quem recebe um pacote com auth_key e não tem estado cria o B2A com ela. O estado só é gravado se o Proteus de dentro abrir.
// - Um estado CONFIRMADO (já recebeu algo da outra ponta) nunca é trocado por um pacote com auth_key: quem quebrou o X25519 no meio da
//   conversa (e por isso forja o Proteus) não consegue "recomeçar" o SPQR com uma auth_key dele.
// - Os dois começaram ao mesmo tempo (os dois com estado A2B ainda sem resposta): vale o início do aparelho de MENOR chave Ed25519
//   (comparação de bytes); o de chave maior troca o seu A2B pelo B2A da outra ponta. As mensagens que o de chave maior mandou antes da
//   troca não abrem do outro lado (o contador da conversa avisa "faltou mensagem"). Limite dito no documento.
// - O estado do SPQR não vai para a cópia de segurança (como as sessões Proteus) e sai junto no "Sair rápido" (mora no estado do
//   aparelho, na loja cifrada).
//
// Sem "@/" de propósito.
import type { MotorSpqr } from "./spqr";

/** O que o aparelho guarda por aparelho da outra ponta: o estado do SPQR e, enquanto ninguém respondeu, a auth_key que sorteou. */
export interface RegistroSpqr {
  e: Uint8Array;
  a: Uint8Array | null;
}

/** O SPQR deste aparelho: o motor e o acesso ao registro de cada aparelho da outra ponta (só na memória; quem chama persiste). */
export interface PqDoAparelho {
  motor: MotorSpqr;
  ler(aparelho: Uint8Array): RegistroSpqr | null;
  gravar(aparelho: Uint8Array, r: RegistroSpqr): void;
}

/** a < b, byte a byte (as chaves Ed25519 têm 32 bytes). */
export function menor(a: Uint8Array, b: Uint8Array): boolean {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] < b[i];
  return a.length < b.length;
}

/** O registro para MANDAR a um aparelho: o que já existe, ou um A2B novo com auth_key sorteada. */
export function paraMandar(pq: PqDoAparelho, aparelho: Uint8Array): RegistroSpqr {
  const ja = pq.ler(aparelho);
  if (ja) return ja;
  const a = new Uint8Array(32);
  globalThis.crypto.getRandomValues(a);
  return { e: pq.motor.inicial("A2B", a), a };
}

/**
 * Os estados com que tentar abrir um pacote do aparelho `de` (na ordem). `inicio`: a auth_key que veio no pacote, se veio. `eu`: a
 * chave Ed25519 deste aparelho (para o desempate). O estado novo (B2A com a auth_key de fora) só entra quando não há estado, ou no
 * desempate do começo simultâneo; nunca no lugar de um estado confirmado.
 */
export function candidatos(pq: PqDoAparelho, de: Uint8Array, inicio: Uint8Array | null, eu: Uint8Array): Uint8Array[] {
  const ja = pq.ler(de);
  const lista: Uint8Array[] = ja ? [ja.e] : [];
  if (inicio && (!ja || (ja.a !== null && menor(de, eu)))) lista.push(pq.motor.inicial("B2A", inicio));
  return lista;
}
