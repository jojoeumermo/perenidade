// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import dynamic from "next/dynamic";
import { rotaNovaLigada } from "@/lib/rede/rotas-novas";
import type { ContextoDoEncaixe, Encaixe, PedidoDePublicacao, ResultadoAntesDePublicar } from "../encaixes";
import { CHAVES_DO_LEVE, impressaoDoPost, jaSaiu } from "./regras";
import { carregarTextosDoLeve } from "./textos";
// As regras do modo leve na Alumia (letras do aparelho, ladrilho no lugar da foto) entram com a casca, antes da primeira pintura:
// se esperassem a peça dinâmica, a letra da Alumia já teria sido baixada.
import "./leve.css";

/**
 * Encaixe da frente 13D (onda 13, leve e no seu tempo). Pendura, tudo atrás da mesma chave da página /alumia/leve
 * (lib/rede/rotas-novas.ts, rota "leve"):
 *   colunaDireita     LeveNaCasca: em toda tela, o ladrilho "toque para ver" no modo leve, a fila do aparelho que sai quando a rede
 *                     volta e o lembrete da hora de parar (a coluna da direita existe em toda tela, mesmo escondida; o recado sai
 *                     num portal).
 *   antesDePublicar   sem rede, o Escrever de sempre para com um aviso claro (nada sai, o texto fica); com rede, o mesmo texto
 *                     que acabou de sair da fila do aparelho não sai de novo. Vai por ÚLTIMO na lista das frentes.
 *   secoesDeAjustes   "Leve e no seu tempo", com o caminho para /alumia/leve.
 * O Sair rápido apaga a fila sem pedido daqui: as chaves começam por "lucia:rede" (lib/rede/saida.ts).
 */
const LeveNaCasca = dynamic(() => import("./NaCasca"), { ssr: false });
const NosAjustes = dynamic(() => import("./NosAjustes"), { ssr: false });

const TITULO: Record<string, string> = {
  pt: "Leve e no seu tempo",
  en: "Light and at your own pace",
  es: "Ligera y a tu ritmo",
  fr: "Légère et à votre rythme",
  ru: "Лёгкая версия и свой ритм",
  zh: "轻量与自己的节奏",
};

/** Sem rede, para; com rede, não deixa o texto que acabou de sair da fila do aparelho sair de novo. */
export async function antesDePublicarLeve(pedido: PedidoDePublicacao, ctx: ContextoDoEncaixe): Promise<ResultadoAntesDePublicar> {
  if (typeof navigator === "undefined") return { ok: true };
  if (navigator.onLine === false) {
    const t = await carregarTextosDoLeve(ctx.lang);
    return { ok: false, aviso: t.offline.aviso, bloqueia: true };
  }
  const conta = ctx.situacao.handle;
  if (!conta || !pedido.texto.trim()) return { ok: true };
  let armazem: Storage | null = null;
  try {
    armazem = window.localStorage;
    if (!armazem.getItem(CHAVES_DO_LEVE.saiu)) return { ok: true };
  } catch {
    return { ok: true };
  }
  if (!jaSaiu(armazem, await impressaoDoPost(conta, pedido.publico, pedido.texto), Date.now())) return { ok: true };
  const t = await carregarTextosDoLeve(ctx.lang);
  return { ok: false, aviso: t.offline.jaSaiu, bloqueia: true };
}

const ligada = rotaNovaLigada("leve");

export const encaixe: Encaixe = ligada
  ? {
      colunaDireita: [LeveNaCasca as React.ComponentType<ContextoDoEncaixe>],
      antesDePublicar: [antesDePublicarLeve],
      secoesDeAjustes: [{ chave: "leve", titulo: ({ lang }) => TITULO[lang] ?? TITULO.pt, Componente: NosAjustes as React.ComponentType<ContextoDoEncaixe> }],
    }
  : {};
