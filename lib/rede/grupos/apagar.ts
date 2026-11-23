// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O "Sair rápido" dos grupos cifrados: apaga do aparelho o IndexedDB dos grupos ("lucia-alumia-grupos": os segredos de cada época e
// a chave da loja do motor) e as lojas do motor no OPFS ("core-crypto/grupos-<conta>": o estado MLS e as chaves de assinatura), de
// todas as contas. Sem importações, para não pesar na casca (components/rede/chat/encaixe.tsx chama sem baixar o motor).

export const BANCO_DOS_GRUPOS = "lucia-alumia-grupos";
/** O diretório do OPFS em que o core-crypto guarda as lojas (documentação de Database.open). */
export const DIRETORIO_DO_MOTOR = "core-crypto";
/** O começo do nome da loja de cada conta, dentro do diretório do motor. */
export const PREFIXO_DA_LOJA = "grupos-";

/** Apaga as lojas dos grupos (nunca lança, nem espera mais que `limiteMs`). */
export async function apagarLojasDosGrupos(limiteMs = 300): Promise<void> {
  const tarefas: Promise<unknown>[] = [];
  try {
    if (typeof indexedDB !== "undefined") {
      tarefas.push(
        new Promise<void>((pronto) => {
          try {
            const pedido = indexedDB.deleteDatabase(BANCO_DOS_GRUPOS);
            pedido.onsuccess = () => pronto();
            pedido.onerror = () => pronto();
            pedido.onblocked = () => pronto();
          } catch {
            pronto();
          }
        }),
      );
    }
    const armazenamento = typeof navigator !== "undefined" ? navigator.storage : undefined;
    if (armazenamento?.getDirectory) {
      tarefas.push(
        (async () => {
          const raiz = await armazenamento.getDirectory();
          const dir = await raiz.getDirectoryHandle(DIRETORIO_DO_MOTOR);
          const nomes: string[] = [];
          for await (const nome of (dir as unknown as { keys(): AsyncIterable<string> }).keys()) if (nome.startsWith(PREFIXO_DA_LOJA)) nomes.push(nome);
          await Promise.all(nomes.map((n) => dir.removeEntry(n, { recursive: true }).catch(() => undefined)));
        })().catch(() => undefined),
      );
    }
    await Promise.race([Promise.all(tarefas), new Promise((pronto) => setTimeout(pronto, limiteMs))]);
  } catch {
    // nunca lança: a pessoa precisa sair já
  }
}
