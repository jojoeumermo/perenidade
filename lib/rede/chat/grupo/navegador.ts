// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A conversa em grupo (recurso "alumia-chat-grupo") montada no NAVEGADOR. Documento: docs/rede/CHAT-PRIVADO.md ("Conversa em grupo").
//   - a loja do motor MLS desta conta no OPFS ("core-crypto/grupos-chat-<conta>", cifrada pelo motor com a chave guardada na guarda
//     selada dos grupos) e o estado dos grupos na guarda selada ("lucia-alumia-grupos", AES-GCM com chave não exportável): as duas
//     começam com o nome dos grupos de propósito, e o "Sair rápido" (lib/rede/grupos/apagar.ts) apaga as duas;
//   - a identidade da conta é a do chat a dois deste aparelho, que só assina os textos do grupo;
//   - as caixas do grupo pelo cliente das caixas anônimas, SEM a sessão da conta, pela via atual (direta, Tor ou mixnet) e com cada
//     depósito no ritmo (lib/rede/caixas/ritmo.ts): o grupo sai no lugar de um pacote de cobertura, como a conversa a dois;
//   - cada caixa (a da época de cada grupo, e a de resposta de cada convite aceito) é buscada no SEU horário pela agenda das caixas;
//   - o convite, o pedido e a recusa vão pela conversa a dois (o controle "grupo"): chegam aqui por `conviteChegou`, ligado em
//     lib/rede/chat/r2/navegador.ts só com o recurso ligado.
// Carregado só quando a tela do grupo aparece (import dinâmico de lib/rede/chat/grupo/cliente.ts): a casca do site não leva nada disto.
import { agendarBusca } from "../../caixas/agenda";
import * as caixas from "../../caixas/cliente";
import { enfileirarDeVerdade } from "../../caixas/ritmo";
import { abrirLojaDoMotor, guardaNoNavegador } from "../../grupos/loja-do-navegador";
import { PREFIXO_DA_LOJA } from "../../grupos/apagar";
import { aoApagarTudoDoChat } from "../gaveta";
import { deB64Url } from "../r2/bytes";
import type { CorpoDoConvite } from "./formato";
import { prepararAparelhoDoGrupo } from "./aparelho";
import { contatoDoChat } from "./contato";
import { GruposDoAparelho } from "./servico";
import { transporteDosGrupos } from "./transporte";

/** O lugar da loja do motor desta conta (começa com o prefixo que o "Sair rápido" apaga). */
export const lugarDaLoja = (conta: string) => `${PREFIXO_DA_LOJA}chat-${conta}`;

let aberto: { conta: string; grupos: Promise<GruposDoAparelho | null> } | null = null;

type AoMudar = (qual: string) => void;
const ouvintes = new Set<AoMudar>();
/** A tela é avisada quando uma caixa de grupo foi lida ou um convite chegou (só dentro da aba; nada vai à rede). */
export function aoMudarNosGrupos(fazer: AoMudar): () => void {
  ouvintes.add(fazer);
  return () => void ouvintes.delete(fazer);
}
export function avisar(qual: string): void {
  for (const f of ouvintes) {
    try {
      f(qual);
    } catch {
      /* a tela que falhou não derruba a agenda */
    }
  }
}

let vigias: { grupos: GruposDoAparelho; ativas: Map<string, () => void> } | null = null;
/** Cada caixa dos grupos é buscada no seu horário (a mesma agenda da conversa a dois); grupo novo entra, grupo que saiu sai. */
export async function acertarVigias(): Promise<void> {
  const v = vigias;
  if (!v) return;
  const quer = new Set(await v.grupos.vigiadas().catch(() => [] as string[]));
  if (vigias !== v) return;
  for (const [qual, parar] of v.ativas) {
    if (quer.has(qual)) continue;
    parar();
    v.ativas.delete(qual);
  }
  for (const qual of quer)
    if (!v.ativas.has(qual))
      v.ativas.set(qual, agendarBusca(async () => {
        await v.grupos.receberUm(qual).catch(() => 0);
        await acertarVigias();
        avisar(qual);
      }));
}
function pararVigias(): void {
  for (const parar of vigias?.ativas.values() ?? []) parar();
  vigias = null;
}

/** Os grupos desta conta neste aparelho; null se o chat a dois ainda não foi ativado aqui (é dele a identidade da conta). */
export function gruposDaConta(conta: string): Promise<GruposDoAparelho | null> {
  if (aberto?.conta === conta) return aberto.grupos;
  pararVigias();
  const grupos = (async () => {
    const { chatDaConta, naFila } = await import("../r2/navegador");
    const chat = await chatDaConta(conta);
    if (!chat) return null;
    const { M, cc } = await abrirLojaDoMotor(lugarDaLoja(conta));
    const transporte = transporteDosGrupos({
      criar: (c) => caixas.criar(c),
      depositar: (c, envelope, franquia, unico) => enfileirarDeVerdade(() => caixas.depositar(c, envelope, franquia, unico)),
      buscar: (c, cursor) => caixas.buscar(c, cursor),
    });
    const identidade = { publica: deB64Url(chat.identidadePublica()), assinar: async (t: Uint8Array) => chat.assinarParaOGrupo(t) };
    const ap = await prepararAparelhoDoGrupo(M, cc, identidade, transporte);
    const g = new GruposDoAparelho({
      ap,
      guarda: guardaNoNavegador(`chat-grupo:${conta}:`),
      eu: { conta, codinome: chat.estado.codinome },
      mandarPelaConversa: async (conversa, corpo) => void (await naFila(() => chat.mandarGrupo(conversa, corpo))),
      contatoPorCodinome: async (codinome) => contatoDoChat(chat, (c) => c.codinome === codinome),
      contatoPorConta: async (c) => contatoDoChat(chat, (x) => x.com === c),
      conferirIdentidade: (c, identidadeDela) => chat.conferirNoRegistro(c, identidadeDela),
    });
    vigias = { grupos: g, ativas: new Map() };
    await acertarVigias();
    return g;
  })();
  aberto = { conta, grupos };
  grupos.catch(() => {
    if (aberto?.grupos === grupos) aberto = null;
  });
  return grupos;
}

/** O controle "grupo" chegou pela conversa a dois (lib/rede/chat/r2/navegador.ts chama, sem esperar). */
export async function conviteChegou(conta: string, x: { conversa: string; autor: string; codinome: string; corpo: CorpoDoConvite; quando: number }): Promise<void> {
  const g = await gruposDaConta(conta);
  if (!g) return;
  await g.aoChegarConvite(x);
  await acertarVigias();
  avisar("convites");
}

/** Depois do "Sair rápido", do pânico ou do "apagar tudo do chat": esta aba esquece os grupos abertos (as lojas já foram apagadas). */
export function esquecerGruposNaMemoria(): void {
  aberto = null;
  pararVigias();
}
aoApagarTudoDoChat(esquecerGruposNaMemoria);
