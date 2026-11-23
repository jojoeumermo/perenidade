// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Dois cofres que ficam SÓ NESTE APARELHO (Prompt 4, Parte H). Nada aqui vai ao servidor. A criptografia é a de biblioteca que a
// senha de pânico já usa (lib/rede/cofre/argon.ts): Argon2id da libsodium sobre a senha → chave de 256 bits → XChaCha20-Poly1305
// com um rótulo por finalidade ("diario" e "viagem"). Nada feito à mão, nenhum protocolo novo.
//
//   104 Diário privado cifrado: as entradas, cifradas com a senha do diário. Sem ela, ninguém lê (nem a Instituição). Esqueceu a
//       senha, o diário não volta.
//   109 Modo viagem: as conversas escolhidas somem da lista do chat até o código. O registro tem SEMPRE a mesma forma e o mesmo
//       tamanho (20 marcas): quem não ligou recebe um de fachada, com bytes sorteados. Assim, ter o registro não diz se o modo está
//       ligado, e a tela de antes e de depois é a mesma. Cada marca é o SHA-256 de um sal sorteado e do id da conversa: sem a lista,
//       não dá para dizer quais são. Limite honesto (a tela diz): esconde da tela, não apaga do aparelho; quem examinar o aparelho
//       a fundo, com as conversas abertas, pode testar cada uma contra as marcas.
// Os dois ficam no localStorage com chaves que NÃO começam com "lucia" (o Sair rápido apaga o que começa com "lucia"; o diário e o
// modo viagem têm de sobreviver a ele, como o cofre da senha de pânico).
// Sem "@/" de propósito: roda no Node nos testes (scripts/testar-p4-conta.mjs).
import { abrir, cabecalhoValido, deBase64, derivar, novoCabecalho, paraBase64, selar, type CabecalhoA2id } from "../cofre/argon";

const codificar = new TextEncoder();
const decodificar = new TextDecoder();

/** O que guarda e lê (o localStorage na tela; um mapa na memória no teste). */
export interface Guarda {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
}

function sorteados(n: number): Uint8Array {
  const b = new Uint8Array(n);
  globalThis.crypto.getRandomValues(b);
  return b;
}

// ───────────────────────────── 104. Diário ─────────────────────────────

export const CHAVE_DO_DIARIO = "alumia-diario";
export const MAX_ENTRADAS = 500;
export const MAX_LETRAS_DA_ENTRADA = 5000;

export interface EntradaDoDiario {
  id: string;
  em: string;
  texto: string;
}

interface DiarioGuardado {
  v: 1;
  cab: CabecalhoA2id;
  dado: string;
}

function lerDiario(g: Guarda): DiarioGuardado | null {
  try {
    const x = JSON.parse(g.getItem(CHAVE_DO_DIARIO) ?? "null") as DiarioGuardado | null;
    return x && x.v === 1 && cabecalhoValido(x.cab) && typeof x.dado === "string" ? x : null;
  } catch {
    return null;
  }
}

/** Há um diário neste aparelho? */
export const temDiario = (g: Guarda) => lerDiario(g) !== null;

/** Uma chave aberta do diário (fica só na memória da página enquanto ele está aberto). */
export interface DiarioAberto {
  chave: Uint8Array;
  cab: CabecalhoA2id;
  entradas: EntradaDoDiario[];
}

function arrumarEntradas(bruto: unknown): EntradaDoDiario[] {
  if (!Array.isArray(bruto)) return [];
  return bruto
    .filter((e): e is EntradaDoDiario => !!e && typeof e.id === "string" && typeof e.em === "string" && typeof e.texto === "string")
    .map((e) => ({ id: e.id.slice(0, 64), em: e.em.slice(0, 40), texto: e.texto.slice(0, MAX_LETRAS_DA_ENTRADA) }))
    .slice(0, MAX_ENTRADAS);
}

/** Cria um diário novo com esta senha (pelo menos 8 letras). Apaga o que houver. */
export async function criarDiario(g: Guarda, senha: string): Promise<DiarioAberto> {
  if (senha.length < 8) throw new Error("senha_curta");
  const { chave, cabecalho } = await derivar(senha);
  const aberto: DiarioAberto = { chave, cab: cabecalho, entradas: [] };
  await guardarDiario(g, aberto);
  return aberto;
}

/** Abre o diário. Senha errada ou bytes mexidos: nulo. */
export async function abrirDiario(g: Guarda, senha: string): Promise<DiarioAberto | null> {
  const x = lerDiario(g);
  if (!x) return null;
  const { chave } = await derivar(senha, x.cab);
  const claro = await abrir(chave, "diario", deBase64(x.dado));
  if (!claro) {
    chave.fill(0);
    return null;
  }
  try {
    return { chave, cab: x.cab, entradas: arrumarEntradas(JSON.parse(decodificar.decode(claro))) };
  } catch {
    chave.fill(0);
    return null;
  }
}

/** Cifra e guarda todas as entradas. */
export async function guardarDiario(g: Guarda, d: DiarioAberto): Promise<void> {
  const selado = await selar(d.chave, "diario", codificar.encode(JSON.stringify(arrumarEntradas(d.entradas))));
  g.setItem(CHAVE_DO_DIARIO, JSON.stringify({ v: 1, cab: d.cab, dado: paraBase64(selado) } satisfies DiarioGuardado));
}

/** Uma entrada nova (no começo da lista). */
export function novaEntrada(d: DiarioAberto, texto: string, em: Date = new Date()): DiarioAberto {
  const t = texto.trim().slice(0, MAX_LETRAS_DA_ENTRADA);
  if (!t) return d;
  const id = paraBase64(sorteados(12)).replace(/[^A-Za-z0-9]/g, "").slice(0, 16);
  return { ...d, entradas: [{ id, em: em.toISOString(), texto: t }, ...d.entradas].slice(0, MAX_ENTRADAS) };
}

/** Fecha o diário: zera a chave na memória. */
export function fecharDiario(d: DiarioAberto | null) {
  d?.chave.fill(0);
}

// ───────────────────────────── 109. Modo viagem ─────────────────────────────

export const CHAVE_DA_VIAGEM = "alumia-viagem";
export const MARCAS_DA_VIAGEM = 20;
const SELO_DA_VIAGEM = "alumia-viagem/ligado";

interface ViagemGuardada {
  v: 1;
  cab: CabecalhoA2id;
  verificador: string;
  sal: string;
  marcas: string[];
}

function lerViagem(g: Guarda): ViagemGuardada | null {
  try {
    const x = JSON.parse(g.getItem(CHAVE_DA_VIAGEM) ?? "null") as ViagemGuardada | null;
    if (!x || x.v !== 1 || !cabecalhoValido(x.cab) || typeof x.verificador !== "string" || typeof x.sal !== "string") return null;
    if (!Array.isArray(x.marcas) || x.marcas.length !== MARCAS_DA_VIAGEM || !x.marcas.every((m) => typeof m === "string")) return null;
    return x;
  } catch {
    return null;
  }
}

/** O tamanho do verificador selado (nonce + "alumia-viagem/ligado" + etiqueta), para a fachada ter o mesmo. */
const TAMANHO_DO_VERIFICADOR = 24 + codificar.encode(SELO_DA_VIAGEM).length + 16;

/** Um registro de fachada: a mesma forma, bytes sorteados que nenhum código abre. */
function fachada(): ViagemGuardada {
  return {
    v: 1,
    cab: novoCabecalho(),
    verificador: paraBase64(sorteados(TAMANHO_DO_VERIFICADOR)),
    sal: paraBase64(sorteados(16)),
    marcas: Array.from({ length: MARCAS_DA_VIAGEM }, () => paraBase64(sorteados(32))),
  };
}

/** Garante que o registro existe (de fachada, se nunca foi ligado). Chame em toda visita à tela, ligada ou não. */
export function garantirViagem(g: Guarda) {
  if (!lerViagem(g)) g.setItem(CHAVE_DA_VIAGEM, JSON.stringify(fachada()));
}

async function marca(sal: string, id: string): Promise<string> {
  const dados = new Uint8Array([...deBase64(sal), ...codificar.encode(id)]);
  return paraBase64(new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", dados)));
}

/**
 * Liga o modo viagem: estas conversas (até 20) somem da lista até o código. O código precisa de pelo menos 6 letras. Ligar de novo
 * com outras conversas troca as de antes (as de antes voltam).
 */
export async function ligarViagem(g: Guarda, codigo: string, conversas: readonly string[]): Promise<void> {
  if (codigo.length < 6) throw new Error("codigo_curto");
  const ids = [...new Set(conversas)].slice(0, MARCAS_DA_VIAGEM);
  if (ids.length === 0) throw new Error("sem_conversas");
  const { chave, cabecalho } = await derivar(codigo);
  try {
    const verificador = await selar(chave, "viagem", codificar.encode(SELO_DA_VIAGEM));
    const sal = paraBase64(sorteados(16));
    const marcas = await Promise.all(ids.map((id) => marca(sal, id)));
    while (marcas.length < MARCAS_DA_VIAGEM) marcas.push(paraBase64(sorteados(32)));
    // Embaralha: a posição não diz nada da ordem em que foram escolhidas.
    for (let i = marcas.length - 1; i > 0; i--) {
      const j = sorteados(1)[0] % (i + 1);
      [marcas[i], marcas[j]] = [marcas[j], marcas[i]];
    }
    g.setItem(CHAVE_DA_VIAGEM, JSON.stringify({ v: 1, cab: cabecalho, verificador: paraBase64(verificador), sal, marcas } satisfies ViagemGuardada));
  } finally {
    chave.fill(0);
  }
}

/** Desliga com o código: as conversas voltam e o registro vira fachada de novo. Código errado: falso (e nada muda). */
export async function desligarViagem(g: Guarda, codigo: string): Promise<boolean> {
  const x = lerViagem(g);
  if (!x) return false;
  const { chave } = await derivar(codigo, x.cab);
  try {
    const claro = await abrir(chave, "viagem", deBase64(x.verificador));
    if (!claro || decodificar.decode(claro) !== SELO_DA_VIAGEM) return false;
    g.setItem(CHAVE_DA_VIAGEM, JSON.stringify(fachada()));
    return true;
  } finally {
    chave.fill(0);
  }
}

/** Das conversas dadas, as que o modo viagem esconde agora (nenhuma com o registro de fachada, salvo um acaso de 2^-256). */
export async function escondidasPelaViagem(g: Guarda, conversas: readonly string[]): Promise<Set<string>> {
  const x = lerViagem(g);
  const saida = new Set<string>();
  if (!x || conversas.length === 0) return saida;
  const marcas = new Set(x.marcas);
  for (const id of conversas) if (marcas.has(await marca(x.sal, id))) saida.add(id);
  return saida;
}
