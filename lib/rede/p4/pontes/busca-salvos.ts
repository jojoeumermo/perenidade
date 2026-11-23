// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 4, item 130 (atrás de "alumia-p4-pontes"): procurar nos salvos e nas pastas, pelo texto, SÓ NO APARELHO. A tela baixa as
// páginas dos salvos (ou da pasta aberta) pelo mesmo caminho de sempre, que o servidor já serve sem saber de busca nenhuma, e filtra
// aqui; o termo nunca sai do aparelho (como lib/busca-local.ts no painel e components/rede/uso/busca-local.ts). Sem "@/".
import { normalizar } from "../../../../components/rede/uso/busca-local";

/** Quantos posts no máximo a busca junta (as páginas de sempre, até este teto). */
export const TETO_DA_BUSCA_NOS_SALVOS = 300;

export interface PostDosSalvos {
  id: string;
  titulo?: string | null;
  texto?: string | null;
  corpo?: string | null;
}

export interface Pagina<P> {
  itens: P[];
  proximo: string | null;
}

/** O termo vale (2 letras ou mais, sem contar os espaços)? */
export const termoValido = (termo: string) => normalizar(termo.trim()).length >= 2;

/** Os posts que têm o termo no título, no texto ou no corpo (sem acento e sem diferença de maiúscula), na mesma ordem. */
export function filtrarSalvos<P extends PostDosSalvos>(posts: readonly P[], termo: string): P[] {
  if (!termoValido(termo)) return [...posts];
  const alvo = normalizar(termo.trim());
  return posts.filter((p) => normalizar([p.titulo, p.texto, p.corpo].filter(Boolean).join("\n")).includes(alvo));
}

/**
 * Junta as páginas que faltam, a partir das que a tela já tem, até o fim ou até o teto. `buscar` é o pedido de sempre (o servidor
 * só vê "a próxima página", nunca o termo). Devolve os posts sem repetir e se chegou ao fim.
 */
export async function juntarSalvos<P extends PostDosSalvos>(ja: Pagina<P>, buscar: (cursor: string) => Promise<Pagina<P>>, teto = TETO_DA_BUSCA_NOS_SALVOS): Promise<{ itens: P[]; fim: boolean }> {
  const vistos = new Set<string>();
  const itens: P[] = [];
  const somar = (lista: readonly P[]) => {
    for (const p of lista) {
      if (itens.length >= teto) return;
      if (!vistos.has(p.id)) {
        vistos.add(p.id);
        itens.push(p);
      }
    }
  };
  somar(ja.itens);
  let cursor = ja.proximo;
  while (cursor && itens.length < teto) {
    const r = await buscar(cursor);
    somar(r.itens ?? []);
    if (!r.proximo || r.proximo === cursor) {
      cursor = null;
      break;
    }
    cursor = r.proximo;
  }
  return { itens, fim: !cursor };
}
