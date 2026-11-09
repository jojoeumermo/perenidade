// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O teclado das abas dos perfis (components/rede/org/Abas.tsx). Sem "@/" de propósito (o teste roda com node direto).

/** A tecla pede qual aba? Setas andam em roda; Home e End vão à primeira e à última (padrão ARIA de abas). Puro (teste). */
export function abaDaTecla<A>(tecla: string, abas: readonly A[], atual: A): A | null {
  const i = abas.indexOf(atual);
  if (tecla === "ArrowRight") return abas[(i + 1) % abas.length];
  if (tecla === "ArrowLeft") return abas[(i + abas.length - 1) % abas.length];
  if (tecla === "Home") return abas[0];
  if (tecla === "End") return abas[abas.length - 1];
  return null;
}
