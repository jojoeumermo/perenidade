// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O que o chat da equipe deixou no aparelho antes do MLS (R2): a loja da biblioteca do Matrix de cada aparelho aprovado, com as
// sessões Megolm e Olm ("lucia-equipe-olm-<aparelho>::matrix-sdk-crypto" e "...-meta", no IndexedDB). As conversas do beta foram
// apagadas no servidor na troca (supabase/migracoes/20261124-r2-equipe.sql); aqui saem as chaves delas do aparelho, para nenhuma
// ficar esquecida. lib/chaveiro.ts chama ao abrir o chaveiro (apagar o que não existe não custa nada). Sem "@/": roda no Node nos
// testes (scripts/testar-r2-equipe.mjs, com um IndexedDB de mentira).

/** Os nomes das lojas antigas de um aparelho da equipe. */
export const lojasDoMegolm = (aparelho: string) => [`lucia-equipe-olm-${aparelho}::matrix-sdk-crypto`, `lucia-equipe-olm-${aparelho}::matrix-sdk-crypto-meta`];

/** Apaga as lojas antigas do Megolm deste aparelho. Nunca lança: sem IndexedDB, não há o que apagar. */
export async function apagarLojasDoMegolm(aparelho: string, idb: IDBFactory | undefined = typeof indexedDB === "undefined" ? undefined : indexedDB): Promise<void> {
  if (!idb || !/^[0-9a-f-]{36}$/.test(aparelho)) return;
  await Promise.all(
    lojasDoMegolm(aparelho).map(
      (nome) =>
        new Promise<void>((resolve) => {
          try {
            const pedido = idb.deleteDatabase(nome);
            pedido.onsuccess = pedido.onerror = pedido.onblocked = () => resolve();
          } catch {
            resolve();
          }
        }),
    ),
  );
}
