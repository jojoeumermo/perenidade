// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Onda R3, o que a R2 deixou (13): o "lido até" de cada conversa da equipe mora só neste aparelho (o banco não guarda mais a hora em
// que cada pessoa leu). É um número por conversa (o número da mensagem, que o banco dá). As contagens de não lidas são pedidas ao banco
// mandando este mapa (public.chat_conversas, public.presenca), que só conta e não grava. A chave começa com "lucia-": o pânico e os
// três Esc a apagam (lib/modo-seguro.ts). Limite: outro aparelho da mesma pessoa não sabe o que foi lido neste.
// Sem "@/": roda no Node nos testes.

const chave = (usuario: string) => `lucia-equipe-lidas-${usuario}`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type Armazenamento = Pick<Storage, "getItem" | "setItem">;
const local = (): Armazenamento | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

/** O mapa {conversa: número lido} deste aparelho (só entradas válidas). */
export function lidas(usuario: string, a: Armazenamento | null = local()): Record<string, number> {
  try {
    const bruto = JSON.parse(a?.getItem(chave(usuario)) ?? "{}") as unknown;
    if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return {};
    return Object.fromEntries(Object.entries(bruto).filter(([k, v]) => UUID.test(k) && Number.isSafeInteger(v) && (v as number) >= 0)) as Record<string, number>;
  } catch {
    return {};
  }
}

/** Marca a conversa como lida até este número (nunca volta para trás). */
export function marcarLida(usuario: string, conversa: string, numero: number, a: Armazenamento | null = local()): void {
  if (!UUID.test(conversa) || !Number.isSafeInteger(numero) || numero < 0) return;
  const atual = lidas(usuario, a);
  if ((atual[conversa] ?? 0) >= numero) return;
  atual[conversa] = numero;
  try {
    a?.setItem(chave(usuario), JSON.stringify(atual));
  } catch {
    // sem armazenamento: as conversas aparecem como não lidas, nada além disso
  }
  for (const f of ouvintes) f();
}

const ouvintes = new Set<() => void>();
/** Para a tela refazer as contagens quando o "lido até" muda (useSyncExternalStore). */
export function ouvirLidas(f: () => void): () => void {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
}
/** O mapa como texto (estável enquanto não muda), para useSyncExternalStore. */
export const instantaneoDasLidas = (usuario: string) => JSON.stringify(lidas(usuario));
