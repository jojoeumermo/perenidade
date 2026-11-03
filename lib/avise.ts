// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// "Me avise quando sair" (Etapa 3, catálogo honesto): a pessoa marca uma trilha em construção e o site guarda, só no
// aparelho (localStorage "lucia:avise"), quantas aulas prontas havia naquele dia. Quando a página das disciplinas ou a
// da trilha vê mais aulas prontas do que o guardado, avisa. Nada vai para o servidor; entra na cópia de segurança e sai
// no "apagar meus dados" (lib/estudo.ts). Sem os atalhos "@/" de propósito: os roteiros de conferência rodam no Node.

export const CHAVE_DO_AVISE = "lucia:avise";

/** trilha → aulas prontas quando a pessoa pediu o aviso (ou quando viu o último aviso). */
export type Avisos = Record<string, number>;

type Armazenamento = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function lerAvisos(armazenamento?: Armazenamento): Avisos {
  try {
    const bruto = (armazenamento ?? localStorage).getItem(CHAVE_DO_AVISE);
    const r = bruto ? (JSON.parse(bruto) as unknown) : null;
    if (!r || typeof r !== "object" || Array.isArray(r)) return {};
    const saida: Avisos = {};
    for (const [trilha, n] of Object.entries(r as Record<string, unknown>)) if (/^[a-z0-9-]{1,80}$/.test(trilha) && typeof n === "number" && n >= 0) saida[trilha] = Math.floor(n);
    return saida;
  } catch {
    return {};
  }
}

function gravar(avisos: Avisos, armazenamento?: Armazenamento): boolean {
  try {
    const a = armazenamento ?? localStorage;
    if (Object.keys(avisos).length === 0) a.removeItem(CHAVE_DO_AVISE);
    else a.setItem(CHAVE_DO_AVISE, JSON.stringify(avisos));
    return true;
  } catch {
    return false;
  }
}

/** Liga (com o número de aulas prontas de agora) ou desliga o aviso de uma trilha. */
export function marcarAviso(trilha: string, prontas: number | null, armazenamento?: Armazenamento): boolean {
  const avisos = lerAvisos(armazenamento);
  if (prontas === null) delete avisos[trilha];
  else avisos[trilha] = Math.max(0, Math.floor(prontas));
  return gravar(avisos, armazenamento);
}

/** As trilhas marcadas que ganharam aula pronta: trilha → quantas aulas novas. */
export function novidades(avisos: Avisos, prontasAgora: Record<string, number>): { trilha: string; novas: number }[] {
  return Object.entries(avisos)
    .filter(([trilha, antes]) => (prontasAgora[trilha] ?? 0) > antes)
    .map(([trilha, antes]) => ({ trilha, novas: prontasAgora[trilha] - antes }));
}
