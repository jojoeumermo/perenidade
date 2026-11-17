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
//   ./lei/encaixe         onda 8 · lei e ajuda (reaceite dos termos e a seção de Ajustes)
//   ./convites/encaixe    onda 8 · convites para a Alumia (atrás de "alumia-convites")
//   ./meusdados/encaixe   onda 8 · meus dados (a seção de Ajustes que leva a /alumia/meus-dados)
//   ./moderacao/encaixe   onda 9 · moderação da comunidade (antes de publicar: o modo lento e o filtro automático)
//   ./modoato/encaixe     onda 9 · modo ato (a barra do modo ligado, o aviso de foto e de dado pessoal, "Estou bem")
//   ./rotulos/encaixe     onda 9 · rótulos assináveis (a tarja no cartão, só para quem assina um rotulador)
//   ./comunidades/decisao/encaixe     onda 10 · a aba Decisões da comunidade (votação interna e os números da semana)
//   ./comunidades/acervo/encaixe      onda 10 · a aba Acervo da comunidade e as coleções no perfil
//   ./comunidades/cargos/encaixe      onda 10 · a aba Chegada, a etiqueta no cartão e as regras antes de postar
//   ./comunidades/estrutura/encaixe   onda 10 · a aba Estrutura, levar a outra comunidade e o aviso da comunidade de avisos (no
//                                     alto da comunidade, no lugar do "Escrever aqui" para quem não abre post)
//   ./estudo/questoes/encaixe         onda 11 · o item Questões no menu
//   ./estudo/turma/encaixe            onda 11 · o item Turmas no menu
//   ./estudo/agenda/encaixe           onda 11 · o item Agenda no menu e as próximas provas na coluna da direita
//   ./estudo/redacao/encaixe          onda 11 · o item Redação no menu
//   ./estudo/conquistas/encaixe       onda 11 · a fileira de conquistas no perfil e a seção Estudo e conquistas nos Ajustes
//   ./coautoria/encaixe               onda 12 · assinar junto, "Fonte?" e marcar na foto (atrás de "alumia-coautoria")
//   ./midia/encaixe                   onda 12 · ouvir o post, a transcrição do áudio e o vídeo curto (atrás de "alumia-video-post")
//   ./alcance/encaixe                 onda 13 · levar para fora (arte, QR, cartão para colar, a aba Levar e levar e trazer quem eu
//                                     sigo, atrás de "alumia-alcance"); na lista, depois da Estrutura, para a aba Levar vir depois dela
//   ./pontes/encaixe                  onda 13 · pontes (Traduzir, o rótulo de robô, o Mural no menu e a seção Pontes nos Ajustes)
//   ./leve/encaixe                    onda 13 · leve e no seu tempo (por último: o antesDePublicar dele roda depois dos outros)
//   ./fediverso/encaixe               Faixa 2 · gente de fora (Fediverso): as peças entram pelo nome no cartão, na linha, na conversa, nos avisos e na busca; o encaixe é {}
//
// A ordem das abas da comunidade é a desta lista (o Fórum da 10A vem de ./conversa): Posts, Fórum, Decisões, Acervo, Chegada,
// Estrutura, Levar (onda 13) e, depois, Atos, Aulas, Wiki, Perguntas e Sobre (components/rede/comunidades/PaginaDaComunidadeAlumia.tsx).
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
import { encaixe as acervo } from "./comunidades/acervo/encaixe";
import { encaixe as coautoria } from "./coautoria/encaixe";
import { encaixe as cargos } from "./comunidades/cargos/encaixe";
import { encaixe as decisao } from "./comunidades/decisao/encaixe";
import { encaixe as estrutura } from "./comunidades/estrutura/encaixe";
import { encaixe as convites } from "./convites/encaixe";
import { encaixe as conversa } from "./conversa/encaixe";
import { encaixe as fediverso } from "./fediverso/encaixe";
import { encaixe as agenda } from "./estudo/agenda/encaixe";
import { encaixe as conquistas } from "./estudo/conquistas/encaixe";
import { encaixe as questoes } from "./estudo/questoes/encaixe";
import { encaixe as redacao } from "./estudo/redacao/encaixe";
import { encaixe as turma } from "./estudo/turma/encaixe";
import { encaixe as lei } from "./lei/encaixe";
import { encaixe as leve } from "./leve/encaixe";
import { encaixe as meusdados } from "./meusdados/encaixe";
import { encaixe as midia } from "./midia/encaixe";
import { encaixe as moderacao } from "./moderacao/encaixe";
import { encaixe as modoato } from "./modoato/encaixe";
import { encaixe as org } from "./org/encaixe";
import { encaixe as pontes } from "./pontes/encaixe";
import { encaixe as protecao, topoDaProtecao } from "./protecao/encaixe";
import { encaixe as publicar } from "./publicar/encaixe";
import { encaixe as rotulos } from "./rotulos/encaixe";
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
  /** O nome inteiro, para o leitor de tela, quando o rótulo do menu é curto. */
  rotuloInteiro?: (ctx: ContextoDoEncaixe) => string;
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
  /**
   * No alto da página da comunidade, entre a capa e as abas (o carimbo da comunidade de avisos, da 10C). A peça que sabe que a
   * pessoa não abre post ali chama `aoBarrarEscrever` com a frase que vai no lugar do "Escrever aqui" (nulo: pode escrever).
   */
  altoDaComunidade?: ComponentType<ContextoDoEncaixe & { slug: string; aoBarrarEscrever?: (motivo: string | null) => void }>[];
  abasDoNucleo?: AbaEncaixada<{ nucleo: string }>[];
  colunaDireita?: ComponentType<ContextoDoEncaixe>[];
  /** No alto da linha de Início, acima das abas (a faixa de stories da F5). */
  topoDaLinha?: ComponentType<ContextoDoEncaixe>[];
  secoesDeAjustes?: { chave: string; titulo: (ctx: ContextoDoEncaixe) => string; Componente: ComponentType<ContextoDoEncaixe> }[];
  aoSairRapido?: LimpezaAoSair[];
}

/** Os encaixes juntos, na ordem fixa das frentes (F1 primeiro: as outras telas herdam a casca). */
export type EncaixesJuntos = { [K in keyof Encaixe]-?: NonNullable<Encaixe[K]> };

/** Junta os encaixes das frentes, na ordem dada. Puro (os testes chamam com encaixes falsos). */
export function juntarEncaixes(lista: readonly Encaixe[]): EncaixesJuntos {
  const junto: EncaixesJuntos = {
    menu: [], acoesDoCartao: [], anexosDoCartao: [], tiposDoCompositor: [], antesDePublicar: [], abasDoPerfil: [],
    abasDaComunidade: [], altoDaComunidade: [], abasDoNucleo: [], colunaDireita: [], topoDaLinha: [], secoesDeAjustes: [], aoSairRapido: [],
  };
  for (const e of lista) {
    for (const chave of Object.keys(junto) as (keyof EncaixesJuntos)[]) {
      const parte = e[chave];
      if (Array.isArray(parte)) (junto[chave] as unknown[]).push(...parte);
    }
  }
  return junto;
}

/** A ordem fixa das frentes. */
const FRENTES: readonly Encaixe[] = [
  publicar, coautoria, atos, conversa, fediverso, org, stories, seguranca, chat, protecao, lei, convites, meusdados, moderacao, rotulos, modoato, decisao, acervo, cargos, estrutura,
  alcance, questoes, turma, agenda, redacao, conquistas, midia, pontes, leve,
];

/**
 * O alto do Início numa ordem só (antes vinha do CSS): a barra do modo ato primeiro (é o que a pessoa precisa ver na rua), o modo
 * protegido ligado logo abaixo, depois as peças das outras frentes na ordem fixa (o lembrete da organização, os stories, o aviso
 * fixado da coordenação, o reaceite dos termos) e, por último, o aviso neutro das marcações que esperam o aceite.
 */
export function ordenarTopoDaLinha(
  frentes: readonly Encaixe[],
  primeiro: Encaixe,
  protegido: ComponentType<ContextoDoEncaixe> | null,
  porUltimo: ComponentType<ContextoDoEncaixe> | null,
): ComponentType<ContextoDoEncaixe>[] {
  return [
    ...(primeiro.topoDaLinha ?? []),
    ...(protegido ? [protegido] : []),
    ...juntarEncaixes(frentes.filter((e) => e !== primeiro)).topoDaLinha,
    ...(porUltimo ? [porUltimo] : []),
  ];
}

/** Todos os encaixes da Alumia. */
export const ENCAIXES: EncaixesJuntos = {
  ...juntarEncaixes(FRENTES),
  topoDaLinha: ordenarTopoDaLinha(FRENTES, modoato, topoDaProtecao?.protegido ?? null, topoDaProtecao?.marcacoes ?? null),
};

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
