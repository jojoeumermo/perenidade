// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import dynamic from "next/dynamic";
import { deForaVale } from "@/lib/rede/fediverso/tela/linha";
import { contaDoHandle, eDeFora, enderecoDoFioRemoto, enderecoDoPerfilRemoto, type CartaoDeFora } from "@/lib/rede/fediverso/tela/tipos";
import { alumia2Ligada } from "@/lib/rede/rotas-novas";
import { enderecos } from "@/lib/rede/tipos";
import type { Encaixe } from "../encaixes";
import type { ItemDeAvisoDeFora, TipoDeAvisoDeFora } from "./AvisoDeFora";

// Cada peça só chega ao navegador quando a flag está ligada e a tela a desenha.
const CartaoRemoto = dynamic(() => import("./CartaoRemoto"), { ssr: false });
const RespostasDeFora = dynamic(() => import("./RespostasDeFora"), { ssr: false });
const BuscaDeFora = dynamic(() => import("./BuscaDeFora"), { ssr: false });
const AvisoDeFora = dynamic(() => import("./AvisoDeFora"), { ssr: false });

/**
 * Gente de fora aparece na tela? Só com "rede-v2" + "alumia-2" (a casca nova) e "fediverso-total" (lib/recursos.ts), ou na prévia
 * (com os dados de exemplo): a mesma regra de todas as peças (deForaVale). Lida a cada desenho, e não uma vez só: a flag pode ser
 * ligada ou desligada pelo painel com o site no ar.
 */
export function fediversoNaTela(): boolean {
  return alumia2Ligada() && deForaVale();
}

/** O post é um cartão de fora E a tela pode mostrá-lo? (Com a flag desligada, nenhum post é tratado como de fora.) */
export function eDeForaNaTela(post: unknown): post is CartaoDeFora {
  return fediversoNaTela() && eDeFora(post);
}

/**
 * O cartão de um post de fora, no lugar do cartão de sempre (linha, perfil, busca). `completo` é a página do post (densidade
 * "aberta"). O "responder" de um post de fora é do próprio cartão (vira um post público daqui), por isso não recebe aoResponder.
 */
export function CartaoDeForaNaLinha({ post, lang, logado, completo = false }: { post: unknown; lang: string; logado: boolean; completo?: boolean }) {
  if (!eDeForaNaTela(post)) return null;
  return <CartaoRemoto post={post} lang={lang} logado={logado} densidade={completo ? "aberta" : "lista"} />;
}

/** Na conversa de um post daqui, depois do fio: as respostas que vieram de outros servidores. Sem a flag, nada (nem pedido). */
export function RespostasDeForaNaConversa({ post, lang, logado }: { post: { id: string } | string; lang: string; logado?: boolean }) {
  if (!fediversoNaTela()) return null;
  return <RespostasDeFora post={post} lang={lang} logado={logado} />;
}

/** Na busca: a conta de fora, quando o que se escreveu é @nome@servidor. Sem a flag ou com outro texto, nada (nem pedido). */
export function BuscaDeForaNaBusca({ q, lang }: { q: string; lang: string }) {
  // O formato é conferido aqui só de leve (a peça confere de verdade): assim a busca comum nem baixa a peça.
  if (!fediversoNaTela() || !/^@?[^@\s]+@[^@\s]+\.[^@\s]+$/.test(q.trim())) return null;
  return <BuscaDeFora q={q.trim()} lang={lang} />;
}

const TIPOS_DE_FORA: readonly string[] = ["fed_seguidor", "fed_resposta", "fed_mencao", "fed_curtida", "fed_impulso"] satisfies readonly TipoDeAvisoDeFora[];

/** O aviso é um dos tipos da federação (e a tela pode mostrá-lo)? */
export function eAvisoDeFora(item: { tipo?: unknown } | null | undefined): boolean {
  return fediversoNaTela() && typeof item?.tipo === "string" && TIPOS_DE_FORA.includes(item.tipo);
}

/**
 * Para onde um aviso de fora leva: seguidor → o perfil de quem seguiu; menção (e uma resposta só) → o fio da nota de fora;
 * curtida, impulso e respostas agrupadas → o post daqui. Nulo: sem destino (a linha vira botão de "marcar como lido").
 */
export function destinoDoAvisoDeFora(lang: string, item: Pick<ItemDeAvisoDeFora, "tipo" | "total" | "post" | "ator_remoto" | "objeto_remoto">): string | null {
  const nota = typeof item.objeto_remoto === "string" && /^https:\/\//.test(item.objeto_remoto) ? item.objeto_remoto : null;
  const daqui = item.post ? enderecos.post(lang, item.post) : null;
  if (item.tipo === "fed_seguidor") {
    const quem = item.ator_remoto;
    const conta = contaDoHandle(quem?.handle) ?? (quem && /^https:\/\//.test(quem.ator) ? quem.ator : null);
    return item.total === 1 && conta ? enderecoDoPerfilRemoto(lang, conta) : null;
  }
  if (item.tipo === "fed_mencao") return nota ? enderecoDoFioRemoto(lang, nota) : daqui;
  if (item.tipo === "fed_resposta") return item.total === 1 && nota ? enderecoDoFioRemoto(lang, nota) : daqui;
  return daqui;
}

/** O miolo de uma linha de aviso com gente de fora (vai dentro do link ou botão da tela de Avisos). */
export function AvisoDeForaNaLista({ item, lang, novo }: { item: ItemDeAvisoDeFora; lang: string; novo?: string }) {
  if (!eAvisoDeFora(item)) return null;
  return <AvisoDeFora item={item} lang={lang} novo={novo} />;
}

/**
 * Encaixe do Fediverso na tela (F4: gente de fora no mesmo visual, sem aba à parte). Os pontos comuns de components/rede/encaixes.tsx
 * (menu, ações e anexos do cartão, compositor, abas, coluna da direita, ajustes) não servem a esta etapa: gente de fora entra
 * DENTRO da linha, do cartão, da conversa, dos avisos e da busca, que são telas da Faixa 1. Por isso o encaixe em si fica vazio
 * (somá-lo em ENCAIXES não muda nada na tela) e as peças saem daqui pelo nome, cada uma com uma importação e uma linha
 * (docs/rede/PEDIDOS-ENTRE-FAIXAS.md):
 *
 *   CartaoDeForaNaLinha        no CartaoDePost, quando eDeForaNaTela(post);
 *   RespostasDeForaNaConversa  na conversa, depois do fio;
 *   AvisoDeForaNaLista         na tela de Avisos, quando eAvisoDeFora(item), com destinoDoAvisoDeFora;
 *   BuscaDeForaNaBusca         na busca;
 *   misturarDeFora, maisDeFora (lib/rede/fediverso/tela/linha.ts) na linha "Seguindo".
 *
 * Tudo atrás de "rede-v2" + "alumia-2" + "fediverso-total" (ou da prévia, com os exemplos): fora disso as peças devolvem nulo, não
 * baixam o código delas e não pedem nada à rede. Regras: nenhuma foto de fora (rosto em mosaico pelo @), mídia só pela rota-proxy daqui,
 * nenhuma lista de quem curtiu ou impulsionou, número só a partir de 3.
 */
export const encaixeDoFediverso: Encaixe = {};

/** O mesmo, com o nome que components/rede/encaixes.tsx usa para as outras frentes. */
export const encaixe = encaixeDoFediverso;
