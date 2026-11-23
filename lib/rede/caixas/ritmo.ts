// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O RITMO do aparelho (onda R3, item 3.3: a multidão): um só, o mesmo TypeScript no site, no app do Android e no do computador, para
// todos terem o mesmo padrão de tráfego, de tamanhos e de intervalos. Documento: docs/rede/CHAT-PRIVADO.md ("Horário e volume").
//   - DEPÓSITOS: um processo de Poisson. Em cada instante sorteado sai UM pacote do tamanho da mensagem curta: a mensagem de verdade
//     mais antiga que esperava, ou, sem nenhuma, um pacote de cobertura. A mensagem de verdade sai NO LUGAR da cobertura, então quem
//     olha não sabe quando a pessoa escreveu. A taxa depende do ESTADO do aparelho: tela do chat aberta, em segundo plano, ou bateria
//     abaixo de 20% (mais devagar, para não gastar). A cobertura está sempre ligada; o teto de banda do dia (5 MB) continua;
//   - teto de espera: a primeira da fila não espera mais que 30 s pelo próximo instante (se esperar, sai na hora e o processo recomeça
//     dali; com a tela aberta, cerca de 2 vezes em 100; o documento diz o limite);
//   - mudou o estado (abriu, foi para o fundo, bateria): o próximo instante é sorteado de novo com a taxa nova (o processo não tem
//     memória, então isso não deixa marca);
//   - BUSCAS: cada caixa em intervalo fixo do estado, com deslocamento sorteado por caixa (lib/rede/caixas/agenda.ts);
//   - os apps usam os mesmos cabeçalhos (`CABECALHOS_DOS_APPS`, HTTP nativo sem Origin), e o mesmo ritmo.
// Sorteio só por crypto.getRandomValues (nunca Math.random). Sem "@/" de propósito.

export type EstadoDoAparelho = "aberto" | "fundo" | "bateria_fraca";

/** Os números do ritmo, num lugar só (milissegundos). `cobertura`: o intervalo MÉDIO entre depósitos; `busca`: o intervalo fixo. */
export const RITMO = {
  aberto: { cobertura: 8_000, busca: 60_000 },
  fundo: { cobertura: 10 * 60_000, busca: 15 * 60_000 },
  bateria_fraca: { cobertura: 30 * 60_000, busca: 30 * 60_000 },
  /** Uma mensagem de verdade não espera mais que isto pelo próximo instante. */
  tetoDeEspera: 30_000,
  /** O menor e o maior intervalo sorteado (o maior evita uma espera sem fim; o menor, uma rajada). */
  minimo: 1_000,
  vezesAMedia: 8,
  /** Bateria abaixo disto (sem carregar) = "bateria_fraca". */
  bateriaFraca: 0.2,
} as const;

/**
 * Os cabeçalhos fixos dos pedidos anônimos nos apps (o HTTP nativo não manda Origin): os mesmos no Android, no computador e na
 * mixnet. Sem Accept-Language (diria o idioma da pessoa). Os apps importam daqui (um lugar só).
 */
export const CABECALHOS_DOS_APPS = { "User-Agent": "alumia/1", Accept: "application/json" } as const;

/** O relógio e a tela (trocados nos testes; lib/rede/caixas/agenda.ts repassa o dele). */
export interface RelogioDoRitmo {
  agendar: (fn: () => void, ms: number) => () => void;
  agora: () => number;
  aVista: () => boolean;
}
let relogio: RelogioDoRitmo = {
  agendar: (fn, ms) => {
    const t = setTimeout(fn, ms);
    return () => clearTimeout(t);
  },
  agora: () => Date.now(),
  aVista: () => typeof document === "undefined" || document.visibilityState !== "hidden",
};
export function configurarRitmo(parte: Partial<RelogioDoRitmo>): void {
  relogio = { ...relogio, ...parte };
}

/** Um número uniforme em [0, 1) do sorteio do sistema. */
export function uniforme(): number {
  const v = new Uint32Array(1);
  globalThis.crypto.getRandomValues(v);
  return v[0] / 2 ** 32;
}

/** Uma espera exponencial com média `media`, entre o mínimo e 8 vezes a média. */
export const esperaExponencial = (media: number): number => Math.min(media * RITMO.vezesAMedia, Math.max(RITMO.minimo, Math.floor(-Math.log(1 - uniforme()) * media)));

// ── O estado ────────────────────────────────────────────────────────────────────────────────────────────────────────────
let definido: EstadoDoAparelho | null = null;
let bateriaFraca = false;

/** Os apps dizem o estado (ciclo de vida do app e bateria); null volta a ler da página (visibilidade e bateria do navegador). */
export function definirEstado(e: EstadoDoAparelho | null): void {
  definido = e;
  reavaliar();
}
/** O site diz se a bateria está fraca (navigator.getBattery, quando o navegador tem). */
export function definirBateria(fraca: boolean): void {
  bateriaFraca = fraca;
  reavaliar();
}
export function estadoAtual(): EstadoDoAparelho {
  if (definido) return definido;
  if (bateriaFraca) return "bateria_fraca";
  return relogio.aVista() ? "aberto" : "fundo";
}
export const intervaloDeBusca = (e: EstadoDoAparelho = estadoAtual()): number => RITMO[e].busca;
export const mediaDosDepositos = (e: EstadoDoAparelho = estadoAtual()): number => RITMO[e].cobertura;

let observando = false;
/** No site: acompanha a bateria pelo navigator.getBattery (Chromium). Nos outros navegadores, nada muda. Uma vez só por página. */
export function observarBateria(): void {
  if (observando) return;
  observando = true;
  const nav = (globalThis as { navigator?: { getBattery?: () => Promise<{ level: number; charging: boolean; addEventListener: (t: string, f: () => void) => void }> } }).navigator;
  void nav?.getBattery?.().then(
    (b) => {
      const ler = () => definirBateria(!b.charging && b.level < RITMO.bateriaFraca);
      ler();
      b.addEventListener("levelchange", ler);
      b.addEventListener("chargingchange", ler);
    },
    () => undefined,
  );
}

// ── Os depósitos: o processo de Poisson ────────────────────────────────────────────────────────────────────────────────────
interface NaFila {
  enviar: () => Promise<unknown>;
  feito: (v: unknown) => void;
  falhou: (e: unknown) => void;
}
const fila: NaFila[] = [];
interface Processo {
  cobrir: () => Promise<void>;
  proximo: number;
  estado: EstadoDoAparelho;
  cancelar: () => void;
  cancelarTeto: () => void;
  soltarVisibilidade: () => void;
}
let rodando: Processo | null = null;

function sair(item: NaFila) {
  item.enviar().then(item.feito, item.falhou);
}

function agendarProximo() {
  if (!rodando) return;
  rodando.estado = estadoAtual();
  const espera = esperaExponencial(mediaDosDepositos(rodando.estado));
  rodando.proximo = relogio.agora() + espera;
  rodando.cancelar = relogio.agendar(() => void instante(), espera);
}

/**
 * O teto de espera vale só para a PRIMEIRA da fila (a próxima a sair): se ela esperou o teto, sai na hora e o processo RECOMEÇA dali
 * (o instante que viria é sorteado de novo). Assim nunca saem várias de uma vez (uma rajada diria "mensagem para vários aparelhos") e
 * o número de depósitos por hora não sobe: o instante forçado toma o lugar do sorteado.
 */
function vigiarTeto() {
  if (!rodando) return;
  rodando.cancelarTeto();
  rodando.cancelarTeto = () => {};
  const primeira = fila[0];
  if (!primeira) return;
  rodando.cancelarTeto = relogio.agendar(() => {
    if (!rodando || fila[0] !== primeira) return;
    rodando.cancelar();
    void instante();
  }, RITMO.tetoDeEspera);
}

async function instante() {
  const meu = rodando;
  if (!meu) return;
  const item = fila.shift();
  agendarProximo();
  vigiarTeto();
  if (item) sair(item);
  else await meu.cobrir().catch(() => undefined);
}

/** O estado mudou: se a taxa mudou, o próximo instante é sorteado de novo com a nova (sem memória: não deixa marca). */
function reavaliar() {
  if (!rodando || rodando.estado === estadoAtual()) return;
  rodando.cancelar();
  agendarProximo();
}

/**
 * Liga o processo: em cada instante sorteado sai uma mensagem de verdade (se há alguma esperando) ou um pacote de `cobrir` (a
 * cobertura, que confere a banda do dia). Devolve a função que para. Só um processo por aparelho: ligar de novo troca o anterior.
 */
export function ligarRitmo(cobrir: () => Promise<void>): () => void {
  pararRitmo();
  const meu: Processo = { cobrir, proximo: 0, estado: estadoAtual(), cancelar: () => {}, cancelarTeto: () => {}, soltarVisibilidade: () => {} };
  rodando = meu;
  if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
    const mudou = () => reavaliar();
    document.addEventListener("visibilitychange", mudou);
    meu.soltarVisibilidade = () => document.removeEventListener("visibilitychange", mudou);
  }
  agendarProximo();
  vigiarTeto();
  return () => {
    if (rodando === meu) pararRitmo();
  };
}

/** Para o processo; o que esperava sai na hora (não se perde mensagem). */
export function pararRitmo(): void {
  const meu = rodando;
  if (!meu) return;
  rodando = null;
  meu.cancelar();
  meu.cancelarTeto();
  meu.soltarVisibilidade();
  for (const item of fila.splice(0)) sair(item);
}

export const ritmoLigado = (): boolean => rodando !== null;
/** Quantas mensagens de verdade esperam o próximo instante. */
export const naFilaDoRitmo = (): number => fila.length;

/** O próximo instante de depósito (de verdade ou cobertura). Sem o processo ligado, agora. */
export function proximoInstante(agora: number = relogio.agora()): number {
  return rodando ? Math.max(agora, rodando.proximo) : agora;
}

/**
 * Uma mensagem de verdade: sai no próximo instante do processo, no lugar de um pacote de cobertura (com o teto de espera da primeira
 * da fila). Sem o processo ligado (antes do chat ficar pronto, nos testes), sai na hora.
 */
export function enfileirarDeVerdade<T>(enviar: () => Promise<T>): Promise<T> {
  if (!rodando) return enviar();
  return new Promise<T>((feito, falhou) => {
    fila.push({ enviar, feito: feito as (v: unknown) => void, falhou });
    if (fila.length === 1) vigiarTeto();
  });
}
