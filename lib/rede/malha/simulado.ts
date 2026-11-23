// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Aparelhos simulados para a malha sem internet (onda R3, item 2.2): o transporte de mentira dos testes
// (scripts/testar-r3-malha.mjs). Cada `aparelho()` é um TransporteDaMalha; `encontrar(a, b)` aproxima dois deles: os dois lados
// recebem o par, mandam o que têm, e a promessa só acaba quando tudo o que foi mandado foi tratado do outro lado. Nada de rede:
// os bytes passam de um lado para o outro na memória, como passariam pelo Bluetooth (o Kotlin só move bytes: android.ts).
// `espiar` deixa o teste ver tudo o que passou entre dois aparelhos (o aparelho malicioso por perto).
import type { ParDaMalha, TransporteDaMalha } from "./no";

type AoEncontrar = (par: ParDaMalha) => void | Promise<void>;
type AoReceber = (p: Uint8Array) => void | Promise<void>;

class Ponta implements ParDaMalha {
  outra!: Ponta;
  private receptores: AoReceber[] = [];
  private fila: Uint8Array[] = [];
  private pendentes: Promise<void>[] = [];
  private fechado = false;
  private readonly espiao?: (p: Uint8Array) => void;

  constructor(espiao?: (p: Uint8Array) => void) {
    this.espiao = espiao;
  }

  async mandar(p: Uint8Array): Promise<void> {
    if (this.fechado) throw new Error("fechado");
    const copia = Uint8Array.from(p);
    this.espiao?.(Uint8Array.from(copia));
    this.outra.chegar(copia);
  }

  /** Um pacote chegou a esta ponta: vai aos receptores (ou espera um se ainda não há). */
  chegar(p: Uint8Array) {
    if (this.fechado) return;
    if (!this.receptores.length) {
      this.fila.push(p);
      return;
    }
    for (const r of this.receptores) this.pendentes.push(Promise.resolve().then(() => r(Uint8Array.from(p))));
  }

  aoReceber(f: AoReceber): () => void {
    this.receptores.push(f);
    const esperando = this.fila;
    this.fila = [];
    for (const p of esperando) this.chegar(p);
    return () => {
      this.receptores = this.receptores.filter((x) => x !== f);
    };
  }

  /** Espera tudo o que chegou ser tratado (inclusive o que chegou enquanto esperava). */
  async esvaziar(): Promise<void> {
    while (this.pendentes.length) {
      const agora = this.pendentes;
      this.pendentes = [];
      await Promise.allSettled(agora);
    }
  }

  fechar(): void {
    this.fechado = true;
    this.receptores = [];
    this.fila = [];
  }
}

export class AparelhoSimulado implements TransporteDaMalha {
  private ouvintes: AoEncontrar[] = [];

  aoEncontrar(f: AoEncontrar): () => void {
    this.ouvintes.push(f);
    return () => {
      this.ouvintes = this.ouvintes.filter((x) => x !== f);
    };
  }

  /** Avisa os ouvintes deste aparelho do encontro (só a rede simulada chama). */
  encontrou(par: ParDaMalha): Promise<void>[] {
    return this.ouvintes.map((f) => Promise.resolve().then(() => f(par)));
  }
}

export class RedeSimulada {
  aparelho(): AparelhoSimulado {
    return new AparelhoSimulado();
  }

  /**
   * Aproxima `a` e `b`: cada lado manda o que tem; acaba quando os dois terminaram de mandar e tudo foi tratado. `espiar` vê cada
   * pacote que passou (nos dois sentidos).
   */
  async encontrar(a: AparelhoSimulado, b: AparelhoSimulado, espiar?: (p: Uint8Array) => void): Promise<void> {
    const pa = new Ponta(espiar);
    const pb = new Ponta(espiar);
    pa.outra = pb;
    pb.outra = pa;
    await Promise.allSettled([...a.encontrou(pa), ...b.encontrou(pb)]);
    // Tudo o que um lado mandou e o outro tratou pode ter gerado mais trabalho (entregar): espera até as duas pontas ficarem quietas.
    await Promise.all([pa.esvaziar(), pb.esvaziar()]);
    await Promise.all([pa.esvaziar(), pb.esvaziar()]);
    pa.fechar();
    pb.fechar();
  }
}
