// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Encaixe da frente 10B (cargos e chegada). Quem junta acrescenta `cargos` à lista de components/rede/encaixes.tsx (import de
// "./comunidades/cargos/encaixe") e faz a página da comunidade mostrar as abas encaixadas além da dos atos. Pendura:
//   · abasDaComunidade   a aba Chegada (boas-vindas, regras antes de postar, etiqueta, cargos e as ferramentas de quem cuida);
//   · anexosDoCartao     a etiqueta de quem escreveu, nos posts de comunidade;
//   · antesDePublicar    numa comunidade que pede as regras antes, avisa e para antes de gastar a tentativa. A conferência de
//                        verdade é do banco (o gatilho de 20261116-alumia-o10-cargos.sql); se a consulta falhar, segue.
import dynamic from "next/dynamic";
import type { ContextoDoEncaixe, Encaixe, PedidoDePublicacao, ResultadoAntesDePublicar } from "../../encaixes";
import type { Post } from "@/lib/rede/tipos";
import { cargos } from "./cliente";
import { carregarTextosDosCargos, por } from "./textos";

const AbaChegada = dynamic(() => import("./AbaChegada"), { ssr: false });
const EtiquetaNoCartao = dynamic(() => import("./EtiquetaNoCartao"), { ssr: false });

/** Antes de publicar numa comunidade: as regras precisam ser aceitas primeiro? Fora de comunidade, nem pergunta. */
export async function avisoDasRegras(pedido: PedidoDePublicacao, lang: string): Promise<ResultadoAntesDePublicar> {
  if (!pedido.comunidade) return { ok: true };
  const [r, t] = await Promise.all([cargos.regrasParaPostar(pedido.comunidade), carregarTextosDosCargos(lang)]);
  if (!r.precisa) return { ok: true };
  return { ok: false, bloqueia: true, aviso: por(t.antes.leia, { nome: r.nome ?? pedido.comunidade }) };
}

export const encaixe: Encaixe = {
  abasDaComunidade: [
    {
      chave: "chegada",
      rotulo: (ctx) => ({ pt: "Chegada", en: "Arrival", es: "Llegada", fr: "Arrivée", ru: "Новичкам", zh: "入门" } as Record<string, string>)[ctx.lang] ?? "Chegada",
      Componente: AbaChegada as React.ComponentType<ContextoDoEncaixe & { slug: string }>,
    },
  ],
  anexosDoCartao: [EtiquetaNoCartao as React.ComponentType<ContextoDoEncaixe & { post: Post }>],
  antesDePublicar: [(pedido, ctx) => avisoDasRegras(pedido, ctx.lang)],
};
