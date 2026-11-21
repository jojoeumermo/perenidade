// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Horário e volume (onda R2, item 2.8), o lado do aparelho:
//   - VIGIAR: cada caixa é buscada em INTERVALO FIXO (60 s com a tela à vista, 15 min em segundo plano), com um deslocamento sorteado
//     por caixa, e UMA caixa por pedido (buscar várias num pedido só ligaria as caixas entre si). O horário da busca não depende de ter
//     chegado mensagem nem de a pessoa estar digitando;
//   - COBERTURA: o aparelho mantém duas caixas de cobertura (criadas como qualquer caixa, com passe) e deposita nelas pacotes falsos do
//     tamanho de uma mensagem curta, em horários sorteados (intervalos exponenciais, média de 10 min com a tela aberta), e os busca e
//     apaga como faria com mensagens de verdade. O servidor não distingue caixa nem pacote de cobertura. Teto de banda: 5 MB por dia.
//     Ligada por padrão; desligável (cobertura(false)), e a escolha fica neste aparelho.
// Onda R3 (item 3.3): os números e o processo dos depósitos passaram ao RITMO (lib/rede/caixas/ritmo.ts), o mesmo nos três tipos de
// app; a cobertura fica SEMPRE ligada (a tela não a desliga mais) e mais devagar em segundo plano e com a bateria fraca; a mensagem de
// verdade sai no lugar de um pacote de cobertura. O intervalo de busca depende do estado do aparelho. O chat a dois busca cada caixa
// por aqui (`agendarBusca`), não mais por um ciclo próprio.
// Sorteio só por crypto.getRandomValues (nunca Math.random).
// Sem "@/" de propósito.
import { registrarLimpezaDaSaida } from "../../modo-seguro";
import { configurarRitmo, esperaExponencial, estadoAtual, intervaloDeBusca, ligarRitmo, RITMO, uniforme, type EstadoDoAparelho } from "./ritmo";
import { sortear } from "./base";
import { apagar, buscar, confirmar, criar, depositar, novaCaixa } from "./cliente";
import { TAMANHOS_DUPLA } from "./tamanhos";
import type { Caixa, Pacote } from "./tipos";

/** O intervalo de busca com a tela à vista e em segundo plano (os do ritmo). */
export const INTERVALO_A_VISTA_MS = RITMO.aberto.busca;
export const INTERVALO_FUNDO_MS = RITMO.fundo.busca;
/** O teto de banda da cobertura (bytes depositados + buscados por dia). */
export const TETO_DA_COBERTURA_BYTES = 5 * 1024 * 1024;
/** O intervalo médio entre depósitos (de verdade ou cobertura) com a tela à vista (o do ritmo). */
export const MEDIA_DA_COBERTURA_MS = RITMO.aberto.cobertura;
/** O tamanho dos pacotes falsos: o da mensagem curta da conversa a dois (bloco de 2048). */
export const TAMANHO_DA_COBERTURA = TAMANHOS_DUPLA[0];

/** O relógio e a visibilidade (trocados nos testes). */
export interface Relogio {
  agendar: (fn: () => void, ms: number) => () => void;
  agora: () => number;
  aVista: () => boolean;
}

let relogio: Relogio = {
  agendar: (fn, ms) => {
    const t = setTimeout(fn, ms);
    return () => clearTimeout(t);
  },
  agora: () => Date.now(),
  aVista: () => typeof document === "undefined" || document.visibilityState !== "hidden",
};

export function configurarRelogio(parte: Partial<Relogio>): void {
  relogio = { ...relogio, ...parte };
  configurarRitmo(parte);
}

export { uniforme, esperaExponencial };

/** O deslocamento sorteado de uma caixa dentro do intervalo (fica o mesmo enquanto a caixa é vigiada). */
const deslocamento = (intervalo: number) => Math.floor(uniforme() * intervalo);

/** Quanto falta até a próxima busca desta caixa: o próximo múltiplo do intervalo, mais o deslocamento da caixa. */
export function proximaBusca(agora: number, intervalo: number, desloc: number): number {
  const base = Math.floor((agora - desloc) / intervalo) * intervalo + desloc;
  const proxima = base + intervalo;
  return Math.max(1, proxima - agora);
}

export interface OpcoesDeVigia {
  /** De onde começar (para caixa de vários leitores, o último pacote já lido). */
  cursor?: number;
}

/**
 * Vigia uma caixa: busca em intervalo fixo e entrega o que chegou a `aoChegar`, que devolve até onde confirmar (0 = nada). Numa caixa de
 * um leitor só, o confirmado sai do servidor. Erro de rede ou de `aoChegar`: tenta de novo na próxima vez, sem perder nada. Devolve a
 * função que para a vigia.
 */
export function vigiar(c: Caixa, aoChegar: (p: Pacote[]) => Promise<number>, opcoes: OpcoesDeVigia = {}): () => void {
  let cursor = Math.max(0, opcoes.cursor ?? 0);
  return agendarBusca(async () => {
    for (let voltas = 0; voltas < 20; voltas++) {
      const pacotes = await buscar(c, cursor);
      if (!pacotes.length) break;
      const ate = await aoChegar(pacotes);
      cursor = Math.max(cursor, ...pacotes.map((p) => p.ordem));
      if (!c.multi && ate > 0) await confirmar(c, ate);
      if (pacotes.length < 50) break;
    }
  });
}

/**
 * A agenda de UMA caixa (ou de qualquer busca que deva seguir o ritmo): roda `rodada` em intervalo fixo do estado do aparelho (aberto,
 * fundo, bateria fraca), num ponto do intervalo sorteado para esta caixa e que não muda enquanto ela é vigiada. O horário não depende de
 * ter chegado mensagem nem de a pessoa estar digitando. Erro em `rodada`: tenta de novo na próxima vez. Devolve a função que para.
 */
export function agendarBusca(rodada: () => Promise<unknown>): () => void {
  let parado = false;
  let cancelar: () => void = () => {};
  const deslocamentos = {} as Record<EstadoDoAparelho, number>;
  const desloc = (e: EstadoDoAparelho) => (deslocamentos[e] ??= deslocamento(intervaloDeBusca(e)));

  const agendar = () => {
    if (parado) return;
    const e = estadoAtual();
    const espera = proximaBusca(relogio.agora(), intervaloDeBusca(e), desloc(e));
    cancelar = relogio.agendar(() => void vez(), espera);
  };
  const vez = async () => {
    if (parado) return;
    try {
      await rodada();
    } catch {
      /* tenta de novo na próxima vez */
    }
    agendar();
  };

  agendar();
  return () => {
    parado = true;
    cancelar();
  };
}

// ── A cobertura ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

const CHAVE_LIGADA = "alumia-cobertura-r2-ligada";
const CHAVE_CAIXAS = "alumia-cobertura-r2";

interface EstadoDaCobertura {
  caixas: { id: string; pd: string; pl: string }[];
  dia: string;
  bytes: number;
}

const paraTexto = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const deTexto = (t: string) => new Uint8Array((t.match(/../g) ?? []).map((h) => parseInt(h, 16)));

function lerEstado(): EstadoDaCobertura | null {
  try {
    const v = JSON.parse(globalThis.localStorage?.getItem(CHAVE_CAIXAS) ?? "null") as EstadoDaCobertura | null;
    if (v && Array.isArray(v.caixas) && typeof v.dia === "string" && typeof v.bytes === "number") return v;
  } catch {
    /* nada */
  }
  return null;
}

function gravarEstado(e: EstadoDaCobertura | null): void {
  try {
    if (e) globalThis.localStorage?.setItem(CHAVE_CAIXAS, JSON.stringify(e));
    else globalThis.localStorage?.removeItem(CHAVE_CAIXAS);
  } catch {
    /* nada */
  }
}

/** A cobertura está ligada neste aparelho? (Ligada por padrão.) */
export function coberturaLigada(): boolean {
  try {
    return globalThis.localStorage?.getItem(CHAVE_LIGADA) !== "nao";
  } catch {
    return true;
  }
}

const diaDe = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Ainda cabe `n` bytes na banda de hoje? (Conta, se couber.) */
export function cabeNaBanda(e: EstadoDaCobertura, n: number, agora: number): boolean {
  const hoje = diaDe(agora);
  if (e.dia !== hoje) {
    e.dia = hoje;
    e.bytes = 0;
  }
  if (e.bytes + n > TETO_DA_COBERTURA_BYTES) return false;
  e.bytes += n;
  return true;
}

let pararCobertura: (() => void) | null = null;

async function caixasDeCobertura(): Promise<{ estado: EstadoDaCobertura; caixas: Caixa[] }> {
  let estado = lerEstado();
  if (!estado || estado.caixas.length < 2) {
    const novas = [novaCaixa(false), novaCaixa(false)];
    for (const c of novas) await criar(c);
    estado = { caixas: novas.map((c) => ({ id: paraTexto(c.id), pd: paraTexto(c.pd), pl: paraTexto(c.pl) })), dia: diaDe(relogio.agora()), bytes: 0 };
    gravarEstado(estado);
  }
  return { estado, caixas: estado.caixas.map((x) => ({ id: deTexto(x.id), pd: deTexto(x.pd), pl: deTexto(x.pl), multi: false })) };
}

/**
 * Liga ou desliga a cobertura. Ligada: cria (uma vez) as duas caixas de cobertura, vigia as duas como qualquer caixa e liga o processo
 * de depósitos do ritmo (lib/rede/caixas/ritmo.ts): pacotes falsos nos instantes sem mensagem de verdade, até o teto de banda do dia.
 * Desligada: para e apaga as caixas de cobertura no servidor. Onda R3: a tela não oferece mais desligar (a cobertura é sempre ligada);
 * desligar fica para sair da conta e para os testes.
 */
export function cobertura(ligada: boolean): void {
  try {
    globalThis.localStorage?.setItem(CHAVE_LIGADA, ligada ? "sim" : "nao");
  } catch {
    /* nada */
  }
  pararCobertura?.();
  pararCobertura = null;
  if (!ligada) {
    const e = lerEstado();
    gravarEstado(null);
    for (const x of e?.caixas ?? []) void apagar({ id: deTexto(x.id), pl: deTexto(x.pl) }).catch(() => {});
    return;
  }
  let parado = false;
  const paradas: (() => void)[] = [];
  // O "Sair rápido" e o pânico (lib/modo-seguro.ts) param a cobertura desta aba; as caixas dela saem com as chaves do aparelho.
  const tirarDaSaida = registrarLimpezaDaSaida(() => esquecerCobertura());
  pararCobertura = () => {
    parado = true;
    tirarDaSaida();
    paradas.forEach((p) => p());
  };
  void caixasDeCobertura()
    .then(({ estado, caixas }) => {
      if (parado) return;
      for (const c of caixas) {
        paradas.push(
          vigiar(c, async (p) => {
            cabeNaBanda(estado, p.reduce((n, x) => n + x.envelope.length, 0), relogio.agora());
            gravarEstado(estado);
            return p[p.length - 1].ordem;
          }),
        );
      }
      // O processo de Poisson do ritmo: em cada instante, a mensagem de verdade que esperava ou um pacote falso (até o teto do dia).
      paradas.push(
        ligarRitmo(async () => {
          if (parado || !cabeNaBanda(estado, TAMANHO_DA_COBERTURA, relogio.agora())) return;
          gravarEstado(estado);
          const alvo = caixas[uniforme() < 0.5 ? 0 : 1];
          await depositar(alvo, sortear(TAMANHO_DA_COBERTURA)).catch(() => null);
        }),
      );
    })
    .catch(() => {
      /* sem passes ou sem rede: a cobertura fica para a próxima abertura */
    });
}

/** Para a cobertura sem mudar a escolha (Sair rápido; sair da conta) e esquece as caixas dela neste aparelho. */
export function esquecerCobertura(): void {
  pararCobertura?.();
  pararCobertura = null;
  gravarEstado(null);
}
