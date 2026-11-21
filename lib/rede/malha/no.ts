// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Um aparelho da malha sem internet (onda R3, item 2.2; documento público: docs/rede/SEM-INTERNET.md): guarda, repassa e entrega.
//
// - Guarda até 500 pacotes (sai o de validade mais curta; entre os de mesma validade, um sorteado), joga fora os vencidos.
// - Não repete: o resumo do corpo de cada pacote visto fica numa lista até a validade dele. Um aparelho malicioso que reenvie o mesmo
//   pacote (ou o mesmo corpo com outro cabeçalho) não faz ninguém repassar de novo nem entregar de novo. A lista tem teto
//   (VISTOS_MAXIMO); cheia, o aparelho RECUSA pacote novo de vizinho até os vistos vencerem, em vez de esquecer um visto antes da
//   validade (esquecer deixava uma enxurrada de pacotes inventados apagar os resumos reais e o pacote real voltar a ser repassado e
//   entregue). Limite dito no documento: a enxurrada (cerca de 400 encontros com o teto de 128) para a malha deste aparelho até os
//   pacotes inventados vencerem; não faz repetir.
// - A cada encontro manda até 64 pacotes, em ordem sorteada, e aceita até 128 do outro lado (um vizinho não enche a memória num
//   encontro só). A cada encontro o aparelho também faz um pacote de cobertura (pacote.ts), igual aos outros para quem não tem a
//   chave: quem repassa não sabe quais pacotes "nasceram" no aparelho do lado.
// - Entrega: cada pacote novo vai a `entregar`, que diz se é para este aparelho (testa as etiquetas das caixas dele e dos atos em que
//   confirmou presença: entrega.ts). O reconhecido CONTINUA sendo repassado: parar de repassar diria "era para mim".
// - Pacote malformado, vencido, de tamanho errado ou que faz `entregar` falhar: some, e nada cai.
// - Desligar apaga tudo o que estava guardado (o aparelho não fica com pacotes de outras pessoas).
// - Sem contador de saltos, sem lista de quem passou o pacote: nada no aparelho diz de onde veio cada um.
// Sorteios por crypto.getRandomValues (nunca Math.random).
// Sem "@/" de propósito: roda no Node nos testes (scripts/testar-r3-malha.mjs).
import { paraHex } from "../chat/r2/bytes";
import { horaDe, ler, resumoDoPacote, TAMANHO_DO_PACOTE } from "./pacote";

/** O que move bytes entre aparelhos próximos (Bluetooth LE no Android: android.ts; aparelhos simulados: simulado.ts). */
export interface TransporteDaMalha {
  /** Chama `f` a cada aparelho encontrado; a promessa de `f` acaba quando este lado terminou de mandar. Devolve o "parar". */
  aoEncontrar(f: (par: ParDaMalha) => void | Promise<void>): () => void;
}
export interface ParDaMalha {
  mandar(p: Uint8Array): Promise<void>;
  /** Cada pacote que chega deste vizinho; a promessa de `f` acaba quando o pacote foi tratado. Devolve o "parar". */
  aoReceber(f: (p: Uint8Array) => void | Promise<void>): () => void;
  fechar(): void;
}

export const GUARDA_MAXIMA = 500;
export const POR_ENCONTRO = 64;
export const RECEBE_POR_ENCONTRO = 128;
/** A lista dos vistos não cresce sem fim (um vizinho que inventa pacotes): cheia, pacote novo de vizinho é recusado (nada é esquecido antes da validade). */
export const VISTOS_MAXIMO = 50_000;

/** Um inteiro sorteado em [0, n) sem viés (rejeição), pelo gerador do sistema. */
export function sortearAte(n: number): number {
  if (!Number.isInteger(n) || n < 1 || n > 0x1_0000_0000) throw new Error("intervalo_invalido");
  const limite = Math.floor(0x1_0000_0000 / n) * n;
  const b = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(b);
    if (b[0] < limite) return b[0] % n;
  }
}

/** Embaralha (Fisher–Yates) com o sorteio do sistema. */
export function embaralhar<T>(xs: T[]): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = sortearAte(i + 1);
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  return xs;
}

interface Guardado {
  bytes: Uint8Array;
  validade: number;
}

export interface OpcoesDoNo {
  agora?: () => number;
  guardaMaxima?: number;
  /** Faz um pacote de cobertura (pacote.ts, montarCobertura). Sem isto, o aparelho não faz cobertura (só nos testes). */
  cobertura?: () => Promise<Uint8Array>;
}

export class NoDaMalha {
  private readonly guardados = new Map<string, Guardado>();
  private readonly vistos = new Map<string, number>();
  private soltar: (() => void) | null = null;
  private readonly agora: () => number;
  private readonly guardaMaxima: number;
  private readonly cobertura?: () => Promise<Uint8Array>;
  private readonly transporte: TransporteDaMalha;
  private readonly entregar: (p: Uint8Array) => Promise<boolean>;
  /** Quantos pacotes foram jogados fora por formato, validade ou repetição (só para os testes; não sai do aparelho). */
  readonly descartados = { malformado: 0, repetido: 0, demais: 0, cheio: 0 };

  constructor(transporte: TransporteDaMalha, entregar: (p: Uint8Array) => Promise<boolean>, opcoes: OpcoesDoNo = {}) {
    this.transporte = transporte;
    this.entregar = entregar;
    this.agora = opcoes.agora ?? (() => Date.now());
    this.guardaMaxima = opcoes.guardaMaxima ?? GUARDA_MAXIMA;
    this.cobertura = opcoes.cobertura;
  }

  get ligado(): boolean {
    return this.soltar !== null;
  }

  /** Começa a participar: a cada aparelho encontrado, troca pacotes. */
  ligar(): void {
    if (this.soltar) return;
    this.soltar = this.transporte.aoEncontrar((par) => this.encontro(par));
  }

  /** Para de participar e apaga o que estava guardado e a lista dos vistos. */
  desligar(): void {
    this.soltar?.();
    this.soltar = null;
    for (const g of this.guardados.values()) g.bytes.fill(0);
    this.guardados.clear();
    this.vistos.clear();
  }

  /** Quantos pacotes este aparelho guarda agora. */
  get quantos(): number {
    this.limpar();
    return this.guardados.size;
  }

  /** Uma cópia do que está guardado (só para os testes: o "aparelho malicioso" que olha tudo o que repassa). */
  copiaDoGuardado(): Uint8Array[] {
    this.limpar();
    return [...this.guardados.values()].map((g) => Uint8Array.from(g.bytes));
  }

  /**
   * Põe um pacote na fila de repasse. Devolve se entrou. Nunca lança. `deVizinho`: veio de outro aparelho (com a lista dos vistos
   * cheia, é recusado); o feito aqui (mensagem, farol, cobertura) entra sempre.
   */
  guardar(p: unknown, deVizinho = false): boolean {
    const lido = ler(p, this.agora());
    if (!lido || !(p instanceof Uint8Array)) {
      this.descartados.malformado++;
      return false;
    }
    const chave = paraHex(resumoDoPacote(lido));
    if (this.vistos.has(chave)) {
      this.descartados.repetido++;
      return false;
    }
    if (deVizinho && this.vistos.size >= VISTOS_MAXIMO) {
      this.limpar();
      if (this.vistos.size >= VISTOS_MAXIMO) {
        this.descartados.cheio++;
        return false;
      }
    }
    this.vistos.set(chave, lido.validade);
    this.guardados.set(chave, { bytes: Uint8Array.from(p), validade: lido.validade });
    this.caber();
    return true;
  }

  /** Um pacote que chegou de um vizinho. Nunca lança. */
  async receber(p: unknown): Promise<void> {
    try {
      if (!(p instanceof Uint8Array) || p.length !== TAMANHO_DO_PACOTE) {
        this.descartados.malformado++;
        return;
      }
      if (!this.guardar(p, true)) return;
      await this.entregar(Uint8Array.from(p)).catch(() => false);
    } catch {
      this.descartados.malformado++;
    }
  }

  /** O encontro com um vizinho: recebe até 128 dele; faz uma cobertura; manda até 64 em ordem sorteada. */
  async encontro(par: ParDaMalha): Promise<void> {
    let recebidos = 0;
    par.aoReceber((p) => {
      if (++recebidos > RECEBE_POR_ENCONTRO) {
        this.descartados.demais++;
        return;
      }
      return this.receber(p);
    });
    if (this.cobertura) {
      try {
        this.guardar(await this.cobertura());
      } catch {
        // Sem cobertura neste encontro: segue.
      }
    }
    this.limpar();
    const lista = embaralhar([...this.guardados.values()]).slice(0, POR_ENCONTRO);
    for (const g of lista) await par.mandar(Uint8Array.from(g.bytes)).catch(() => undefined);
  }

  private limpar() {
    const hora = horaDe(this.agora());
    for (const [k, g] of this.guardados)
      if (g.validade < hora) {
        g.bytes.fill(0);
        this.guardados.delete(k);
      }
    for (const [k, v] of this.vistos) if (v < hora) this.vistos.delete(k);
  }

  private caber() {
    this.limpar();
    while (this.guardados.size > this.guardaMaxima) {
      let menor = Infinity;
      for (const g of this.guardados.values()) menor = Math.min(menor, g.validade);
      const candidatos = [...this.guardados].filter(([, g]) => g.validade === menor);
      const [k, g] = candidatos[sortearAte(candidatos.length)];
      g.bytes.fill(0);
      this.guardados.delete(k);
    }
  }
}
