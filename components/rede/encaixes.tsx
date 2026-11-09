// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os ENCAIXES da Alumia (PLANO-ALUMIA §8 F0 e §9): o ponto único por onde cada frente pendura o que é dela nas telas comuns
// (casca, cartão, compositor, perfil, comunidade, ajustes, Sair rápido) sem editar o arquivo de outra frente. Este arquivo é da
// F0 e não muda depois: ele importa de caminhos fixos o encaixe de cada frente, e cada frente só edita o PRÓPRIO encaixe.tsx:
//
//   ./atos/encaixe        F2 · atos e organizar na rua
//   ./conversa/encaixe    F3 · conversa, comunidades, descoberta e avisos
//   ./org/encaixe         F4 · perfis e organizações
//   ./stories/encaixe     F5 · stories e mídia criativa
//   ./seguranca/encaixe   F6 · privacidade e segurança pessoal
//   ./chat/encaixe        F7 · chat privado e núcleo cifrado
//   ./protecao/encaixe    F8 · proteção contra ataque e moderação
//   ./alcance/encaixe     F9 · alcance e acesso
//   ./publicar/encaixe    F1 · casca, linha, cartão e escrever
//
// Regras para quem pendura: tudo atrás da sua flag (lib/recursos.ts); nada de lista de pessoas; contagem só agregada e a partir
// de 3 (PLANO-ALUMIA §6). Um encaixe vazio ({}) não muda nada na tela.
import type { ComponentType, ReactNode } from "react";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { Post, Situacao } from "@/lib/rede/tipos";
import type { LimpezaAoSair } from "@/lib/rede/saida";
import type { ItemDoMenu } from "./Casca";
import { encaixe as alcance } from "./alcance/encaixe";
import { encaixe as atos } from "./atos/encaixe";
import { encaixe as chat } from "./chat/encaixe";
import { encaixe as conversa } from "./conversa/encaixe";
import { encaixe as org } from "./org/encaixe";
import { encaixe as protecao } from "./protecao/encaixe";
import { encaixe as publicar } from "./publicar/encaixe";
import { encaixe as seguranca } from "./seguranca/encaixe";
import { encaixe as stories } from "./stories/encaixe";

/** O que toda peça encaixada recebe. */
export interface ContextoDoEncaixe {
  lang: string;
  s: TextosDaRede;
  situacao: Situacao;
}

/** Um item a mais no menu (computador) — ou o destino de um item que já existe ("chamados" → /alumia/atos). */
export interface ItemDoMenuEncaixado {
  chave: string;
  /** Troca o destino de um item que já existe no menu, em vez de criar outro. */
  substitui?: ItemDoMenu;
  rotulo: (ctx: ContextoDoEncaixe) => string;
  icone: ReactNode;
  href: (ctx: ContextoDoEncaixe) => string | null;
  /** Número no emblema (já agregado, sem nomes); nulo = sem emblema. */
  emblema?: (ctx: ContextoDoEncaixe) => number | null;
}

/** Uma aba a mais (perfil, comunidade, núcleo). */
export interface AbaEncaixada<P = Record<string, never>> {
  chave: string;
  rotulo: (ctx: ContextoDoEncaixe) => string;
  Componente: ComponentType<ContextoDoEncaixe & P>;
}

/** Um tipo a mais no compositor ("Ato", "Texto longo"…), com o formulário dele. */
export interface TipoDoCompositorEncaixado {
  tipo: string;
  rotulo: (ctx: ContextoDoEncaixe) => string;
  Formulario: ComponentType<ContextoDoEncaixe & { aoMudar: (dados: Record<string, unknown>) => void }>;
}

/** O resultado de uma verificação antes de publicar: segue, ou para com um aviso (a pessoa decide se revisa). */
export type ResultadoAntesDePublicar = { ok: true } | { ok: false; aviso: string; bloqueia?: boolean };

/** O pedido de publicação como o compositor monta (só o que as verificações precisam ler). */
export interface PedidoDePublicacao {
  texto: string;
  tipo: string;
  publico: string;
  comunidade: string | null;
  extras: Record<string, unknown>;
}

/** Tudo o que uma frente pode encaixar. Cada campo é opcional: o esboço vazio é {}. */
export interface Encaixe {
  menu?: ItemDoMenuEncaixado[];
  acoesDoCartao?: ComponentType<ContextoDoEncaixe & { post: Post }>[];
  anexosDoCartao?: ComponentType<ContextoDoEncaixe & { post: Post }>[];
  tiposDoCompositor?: TipoDoCompositorEncaixado[];
  antesDePublicar?: ((pedido: PedidoDePublicacao, ctx: ContextoDoEncaixe) => Promise<ResultadoAntesDePublicar>)[];
  abasDoPerfil?: AbaEncaixada<{ handle: string }>[];
  abasDaComunidade?: AbaEncaixada<{ slug: string }>[];
  abasDoNucleo?: AbaEncaixada<{ nucleo: string }>[];
  colunaDireita?: ComponentType<ContextoDoEncaixe>[];
  secoesDeAjustes?: { chave: string; titulo: (ctx: ContextoDoEncaixe) => string; Componente: ComponentType<ContextoDoEncaixe> }[];
  aoSairRapido?: LimpezaAoSair[];
}

/** Os encaixes juntos, na ordem fixa das frentes (F1 primeiro: as outras telas herdam a casca). */
export type EncaixesJuntos = { [K in keyof Encaixe]-?: NonNullable<Encaixe[K]> };

/** Junta os encaixes das frentes, na ordem dada. Puro (os testes chamam com encaixes falsos). */
export function juntarEncaixes(lista: readonly Encaixe[]): EncaixesJuntos {
  const junto: EncaixesJuntos = {
    menu: [], acoesDoCartao: [], anexosDoCartao: [], tiposDoCompositor: [], antesDePublicar: [], abasDoPerfil: [],
    abasDaComunidade: [], abasDoNucleo: [], colunaDireita: [], secoesDeAjustes: [], aoSairRapido: [],
  };
  for (const e of lista) {
    for (const chave of Object.keys(junto) as (keyof EncaixesJuntos)[]) {
      const parte = e[chave];
      if (Array.isArray(parte)) (junto[chave] as unknown[]).push(...parte);
    }
  }
  return junto;
}

/** Todos os encaixes da Alumia. */
export const ENCAIXES: EncaixesJuntos = juntarEncaixes([publicar, atos, conversa, org, stories, seguranca, chat, protecao, alcance]);

/**
 * Roda as verificações de antes de publicar em ordem e para na primeira que pede revisão. Uma verificação que falha (erro)
 * não bloqueia: a checagem de verdade é a do servidor (lib/rede/publicar/checagem.ts).
 */
export async function verificarAntesDePublicar(
  pedido: PedidoDePublicacao,
  ctx: ContextoDoEncaixe,
  verificacoes: EncaixesJuntos["antesDePublicar"] = ENCAIXES.antesDePublicar,
): Promise<ResultadoAntesDePublicar> {
  for (const verificar of verificacoes) {
    try {
      const r = await verificar(pedido, ctx);
      if (!r.ok) return r;
    } catch {
      // a verificação do aparelho falhou: segue (o servidor confere de novo)
    }
  }
  return { ok: true };
}
