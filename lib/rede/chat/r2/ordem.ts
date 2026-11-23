// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Repetição, falta e ordem das mensagens da conversa a dois (onda R2, item 1.1). Cada bloco (lib/rede/chat/r2/bloco.ts) leva,
// DENTRO do cifrado, o contador do aparelho que escreve nesta conversa e o resumo do bloco anterior dele (`anterior`). O servidor
// não vê nem fabrica nenhum dos dois. Com eles, o aparelho que recebe nota:
//   - REPETIDA: o mesmo contador de novo (o Proteus já recusa a mesma mensagem; isto pega a mesma mensagem cifrada de novo numa
//     sessão refeita). Não é mostrada;
//   - FALTANDO: contadores que não chegaram entre o que já chegou. A tela avisa, de forma discreta (pode ser mensagem vencida,
//     apagada ou retida no caminho);
//   - FORA DE ORDEM: chegou depois de uma de contador maior. A tela põe na ordem do contador e avisa;
//   - CADEIA QUEBRADA: o `anterior` não é o resumo do bloco anterior que chegou (ou o bloco que chegou atrasado não é o que o
//     seguinte dizia). Não deveria acontecer com o Proteus íntegro; a tela avisa forte.
// Funções puras, sem navegador (testadas em scripts/testar-r2-dupla.mjs). O estado fica na loja cifrada do aparelho.
import { iguais, paraB64Url, type Bytes } from "./bytes";
import { NADA_ANTES } from "./bloco";

/** O que este aparelho guarda de um aparelho que escreve numa conversa. */
export interface EstadoDoRemetente {
  /** Todos os contadores até aqui já chegaram. */
  contiguo: number;
  /** O maior contador que chegou. */
  maior: number;
  /** Contadores acima de `contiguo` que já chegaram. */
  acima: number[];
  /** Resumo (base64url) dos blocos que chegaram, pelo contador (só os da ponta: os de baixo de `contiguo - 1` saem). */
  resumos: Record<string, string>;
  /** O `anterior` que um bloco que chegou diz sobre o contador abaixo dele, ainda não chegado. */
  esperados: Record<string, string>;
}

export const ESTADO_NOVO: EstadoDoRemetente = { contiguo: 0, maior: 0, acima: [], resumos: {}, esperados: {} };

export type Aviso = "fora_de_ordem" | "cadeia_quebrada";
export type Juizo = { juizo: "repetida" } | { juizo: "nova"; avisos: Aviso[]; estado: EstadoDoRemetente };

/** Julga um bloco aberto de um aparelho. `resumo`: o resumoDoBloco dele. */
export function julgar(estado: EstadoDoRemetente, contador: number, anterior: Bytes, resumo: Bytes): Juizo {
  if (contador <= estado.contiguo || estado.acima.includes(contador)) return { juizo: "repetida" };
  const avisos: Aviso[] = [];
  if (contador < estado.maior) avisos.push("fora_de_ordem");
  // A cadeia para trás: o anterior deste bloco tem de ser o resumo do bloco de contador - 1 (se ele já chegou); o primeiro, zeros.
  if (contador === 1 ? !iguais(anterior, NADA_ANTES) : estado.resumos[contador - 1] !== undefined && estado.resumos[contador - 1] !== paraB64Url(anterior)) avisos.push("cadeia_quebrada");
  // E para a frente: se o seguinte já chegou, ele disse qual era o resumo deste.
  const esperado = estado.esperados[contador];
  if (esperado !== undefined && esperado !== paraB64Url(resumo)) avisos.push("cadeia_quebrada");
  const acima = [...estado.acima, contador].sort((a, b) => a - b);
  let contiguo = estado.contiguo;
  while (acima.length && acima[0] === contiguo + 1) contiguo = acima.shift() as number;
  const resumos: Record<string, string> = {};
  for (const [k, v] of Object.entries<string>({ ...estado.resumos, [contador]: paraB64Url(resumo) })) if (Number(k) >= contiguo - 1) resumos[k] = v;
  const esperados: Record<string, string> = {};
  for (const [k, v] of Object.entries<string>({ ...estado.esperados, ...(contador > 1 ? { [contador - 1]: paraB64Url(anterior) } : {}) })) if (Number(k) > contiguo) esperados[k] = v;
  return { juizo: "nova", avisos: [...new Set(avisos)], estado: { contiguo, maior: Math.max(estado.maior, contador), acima, resumos, esperados } };
}

/** Os contadores que faltam (entre o que já chegou), para o aviso "faltou mensagem". */
export function faltando(estado: EstadoDoRemetente): number[] {
  const saida: number[] = [];
  for (let n = estado.contiguo + 1; n < estado.maior && saida.length < 100; n++) if (!estado.acima.includes(n)) saida.push(n);
  return saida;
}

/** O que o aparelho guarda do que ELE escreve numa conversa: o último contador e o resumo do último bloco. */
export interface EstadoDeEnvio {
  contador: number;
  ultimo: string;
}

export const ENVIO_NOVO: EstadoDeEnvio = { contador: 0, ultimo: paraB64Url(NADA_ANTES) };
