// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// "Há ato novo" (o emblema do item Atos no menu e o ponto dourado da barra do celular, pranchas computador-inicio e
// celular-inicio): quantos atos de quem a pessoa segue ainda não apareceram na tela dos atos NESTE aparelho. É um número só da
// própria pessoa, sobre atos (nunca sobre gente). A lista do que já foi visto fica só no aparelho (chave "lucia:rede…", que o
// "Sair rápido" apaga) e nunca vai ao servidor: o servidor não precisa saber o que a pessoa abriu (LGPD art. 6º, III).
import type { Ato } from "../tipos-atos";

export const CHAVE_DOS_VISTOS = "lucia:rede:atos:vistos";
/** Guarda no máximo estes ids (os mais novos): a lista não cresce sem fim. */
const MAXIMO = 200;

function lerVistos(): Set<string> {
  try {
    const bruto = typeof localStorage === "undefined" ? null : localStorage.getItem(CHAVE_DOS_VISTOS);
    const lista: unknown = bruto ? JSON.parse(bruto) : [];
    return new Set(Array.isArray(lista) ? lista.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

/** Quantos destes atos são novos (não cancelados e ainda não vistos aqui). Puro, para o teste. */
export function contarNovos(itens: readonly Pick<Ato, "id" | "situacao">[], vistos: ReadonlySet<string>): number {
  return itens.filter((a) => a.situacao !== "cancelado" && !vistos.has(a.id)).length;
}

let contagem: number | null = null;
let pedido = false;

/**
 * O número do emblema (nulo = sem emblema). O encaixe do menu é lido na hora de desenhar a casca, sem espera: a primeira leitura
 * dispara o pedido dos atos de "Seguindo" e devolve nulo; as seguintes devolvem o que chegou.
 */
export function atosNovos(): number | null {
  if (typeof window === "undefined") return null;
  if (!pedido) {
    pedido = true;
    import("../cliente-atos")
      .then(({ atos }) => atos.atos("seguindo"))
      .then((p) => {
        const n = contarNovos(p.itens, lerVistos());
        contagem = n > 0 ? n : null;
      })
      .catch(() => {
        // sem conta ou sem serviço: sem emblema
        contagem = null;
      });
  }
  return contagem;
}

/** A tela dos atos mostrou estes atos: deixam de ser novos. */
export function marcarVistos(ids: readonly string[]): void {
  if (!ids.length) return;
  const vistos = lerVistos();
  for (const id of ids) vistos.delete(id);
  const lista = [...vistos, ...ids].slice(-MAXIMO);
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(CHAVE_DOS_VISTOS, JSON.stringify(lista));
  } catch {
    // sem armazenamento: o emblema volta na próxima visita, nada mais
  }
  contagem = null;
}
