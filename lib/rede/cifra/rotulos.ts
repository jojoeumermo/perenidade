// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os rótulos de todas as finalidades da cifra da R2 e da R3, num lugar só (docs/rede/CHAT-PRIVADO.md): cada frente declara os seus num `const ROTULOS`
// no próprio módulo, e este arquivo só os junta. Uma chave por finalidade: o teste confere que nenhum rótulo se repete entre as frentes
// (dois usos com o mesmo rótulo poderiam trocar um tipo de mensagem por outro). As cópias que uma frente guarda dos rótulos de outra
// (ROTULOS_DE_FORA da conversa a dois, ROTULOS_DA_FRANQUIA da denúncia) não entram nas listas: o teste confere que são iguais aos
// originais, byte a byte.
// Sem "@/" de propósito.
import { ROTULOS as CAIXAS } from "../caixas/base";
import { ROTULOS as DUPLA, ROTULOS_DE_FORA as DUPLA_DE_FORA } from "../chat/r2/rotulos";
import { ROTULOS as COFRES } from "../cofre/argon";
import { ROTULOS_DA_FRANQUIA } from "../franquia/protocolo";
import { LISTA_DE_ROTULOS as MOTOR_DOS_GRUPOS } from "../grupos/rotulos-do-motor";
import { LISTA_DE_ROTULOS as MEMBROS } from "../membros/rotulos";
import { ROTULOS as VOTO } from "../voto/limiar";
// R3 (docs/plano: onda R3, seção 4.6 do desenho).
import { ROTULOS as EQUIPE } from "../../equipe/autoria";
import { ROTULOS as TRAVA } from "../casca/trava";
import { ROTULOS as PQ } from "../chat/r3/camada-pq";
import { ROTULOS as FOLHAS } from "../grupos/certificado";
import { ROTULOS as INSTANCIAS } from "../instancias/endereco";
import { ROTULOS as MALHA } from "../malha/pacote";
import { ROTULOS_DOS_PASSES as PASSES } from "../passes/comum";
import { ROTULOS as ENQUETE } from "../voto/enquete-do-grupo";
// Prompt 4.
import { ROTULOS as QUEM_LEVA } from "../chat/quem-leva";
import { ROTULOS as TOPICOS } from "../chat/topicos";
import { ROTULOS as CHAMADA } from "../chamada/toque";

/** Os rótulos que só existem fora do TypeScript do site (arquivo de origem → rótulos). */
export const FORA_DO_TS: Readonly<Record<string, readonly string[]>> = {
  "nativo/servidor-chat/src/prova.rs": ["alumia/r3/instancias/desafio/v1"],
  "nativo/servidor-chat/src/rotas.rs": ["alumia/r3/cofre-anonimo/caixa/v1"],
  "nativo/servidor-chat/banco/001-chat.sql": ["alumia/r3/cofre-anonimo/deposito/v1", "alumia/r3/cofre-anonimo/leitura/v1"],
  "nativo/nucleo/src/cofre.rs": ["alumia/r3/cofre-computador/v1"],
  "scripts/segredos/cerimonia.mjs": ["alumia/r3/cerimonia/v1", "alumia/r3/cerimonia/conferencia/v1"],
};
function FORA_DO_TS_LISTA(): Readonly<Record<string, string>> {
  return Object.fromEntries(Object.values(FORA_DO_TS).flat().map((r, i) => [String(i), r]));
}

const daLista = (lista: readonly string[]): Readonly<Record<string, string>> => Object.fromEntries(lista.map((r, i) => [String(i), r]));

/** As listas de rótulos de cada frente (nome da frente → rótulos). */
export const LISTAS: Record<string, Readonly<Record<string, string>>> = {
  caixas: CAIXAS,
  // A declaração de quem escreve ("o passe de depósito desta caixa é meu") está entre os rótulos "de fora" da conversa a dois, mas
  // só ela a usa (lib/rede/chat/r2/certificados.ts): conta aqui como dela.
  dupla: { ...DUPLA, declaracao: DUPLA_DE_FORA.declaracao },
  cofres: Object.fromEntries(COFRES.finalidades.map((f) => [f, COFRES.cofre(f)])),
  // Os grupos e o chat da equipe no motor MLS (lib/rede/grupos, prefixo alumia/r2/mls/).
  grupos: daLista(MOTOR_DOS_GRUPOS),
  // Os núcleos com membros escondidos (lib/rede/membros: caixas da época, papéis, entrada).
  membros: daLista(MEMBROS),
  voto: VOTO,
  // ── R3 ──
  // O chat da equipe sem autor no banco (o autor e a hora assinados dentro do cifrado; lib/equipe/autoria.ts).
  equipe: EQUIPE,
  // O certificado da folha MLS dos grupos da rede, assinado pela identidade da conta (lib/rede/grupos/certificado.ts).
  folhas: FOLHAS,
  // A enquete não secreta dentro do grupo cifrado do núcleo (lib/rede/voto/enquete-do-grupo.ts).
  enquete: ENQUETE,
  // A camada pós-quântica (SPQR) da conversa a dois (lib/rede/chat/r3/camada-pq.ts).
  pq: PQ,
  // A trava do chat nos apps (lib/rede/casca/trava.ts).
  trava: TRAVA,
  // Os pacotes sem internet e o Farol do ato (lib/rede/malha/pacote.ts).
  malha: MALHA,
  // Os passes por RSA cego e o passe da urna (lib/rede/passes/comum.ts).
  passes: PASSES,
  // O chat entre instâncias (lib/rede/instancias/endereco.ts).
  instancias: INSTANCIAS,
  // Os que só existem fora do TypeScript do site: o servidor do chat em Rust (nativo/servidor-chat/src/prova.rs, rotas.rs e banco/001-chat.sql) o cofre do
  // app do computador (nativo/nucleo/src/cofre.rs) e a cerimônia dos segredos (scripts/segredos/cerimonia.mjs). O teste da junção (scripts/testar-r3-rotulos.mjs) confere que cada um
  // está escrito igual no arquivo de origem.
  "fora-do-ts": FORA_DO_TS_LISTA(),
  // ── Prompt 4 ──
  // "Quem leva o quê" dentro do grupo cifrado (lib/rede/chat/quem-leva.ts, item 19).
  "quem-leva": QUEM_LEVA,
  // Os tópicos dentro do grupo cifrado (lib/rede/chat/topicos.ts, item 20).
  topicos: TOPICOS,
  // A chamada da conversa a dois: a chave da combinação e o nome do canal, tirados da chave do toque (lib/rede/chamada/toque.ts,
  // itens 139 e 140).
  chamada: CHAMADA,
};

/** As cópias de rótulos de outras frentes que diferem do original (frente.nome). Vazio = tudo certo. */
export function copiasDiferentes(): string[] {
  const todos = new Set(Object.values(LISTAS).flatMap((l) => Object.values(l)));
  const copias: Record<string, Readonly<Record<string, string>>> = { "dupla(de fora)": DUPLA_DE_FORA, franquia: ROTULOS_DA_FRANQUIA };
  return Object.entries(copias).flatMap(([frente, lista]) => Object.entries(lista).filter(([, r]) => !todos.has(r)).map(([nome]) => `${frente}.${nome}`));
}

/** Os rótulos repetidos (o mesmo texto em duas finalidades), com onde aparecem. Vazio = tudo certo. */
export function rotulosRepetidos(listas: Record<string, Readonly<Record<string, string>>> = LISTAS): { rotulo: string; onde: string[] }[] {
  const onde = new Map<string, string[]>();
  for (const [frente, lista] of Object.entries(listas)) {
    for (const [nome, rotulo] of Object.entries(lista)) onde.set(rotulo, [...(onde.get(rotulo) ?? []), `${frente}.${nome}`]);
  }
  return [...onde].filter(([, l]) => l.length > 1).map(([rotulo, l]) => ({ rotulo, onde: l }));
}

/** Um rótulo é prefixo de outro? (Com separador "|" ou "‖" logo depois, os dois poderiam ser confundidos.) */
export function rotulosPrefixos(listas: Record<string, Readonly<Record<string, string>>> = LISTAS): [string, string][] {
  const todos = [...new Set(Object.values(listas).flatMap((l) => Object.values(l)))];
  const saida: [string, string][] = [];
  for (const a of todos) for (const b of todos) if (a !== b && b.startsWith(a) && !/^\//.test(b.slice(a.length))) saida.push([a, b]);
  return saida;
}
