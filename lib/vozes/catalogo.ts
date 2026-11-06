// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// As vozes que este site oferece (public/vozes/vozes.json, escrita por "npm run vozes:baixar"), a escolha guardada no
// aparelho ("lucia:voz") e o motor das vozes naturais, que roda num Worker (public/workers/voz.js). Nada daqui vai
// para fora do site. A lista só é lida quando a pessoa abre o seletor ou toca uma voz natural.

export const CHAVE_DA_VOZ = "lucia:voz";
export const CACHE_DAS_VOZES = "lucia-vozes";
export const VOZ_DO_APARELHO = "aparelho";

export type Arquivo = { url: string; bytes: number; sha256: string; papel?: string };
export type VozNatural = {
  id: string;
  motor: "kokoro" | "piper" | "teste";
  /** pt, en, es, fr: a voz natural de cada idioma (a escolhida vale para o português; as outras seguem o gênero dela). */
  idioma?: string;
  numero: number;
  genero: "f" | "m";
  webgpu: boolean;
  espeak: string;
  modelo: string;
  licenca: string;
  bloqueada?: boolean;
  amostra: string | null;
  bytes: number;
  arquivos: Arquivo[];
};
type Biblioteca = { js: string; pasta: string; wasm: Arquivo };
export type Lista = { formato: number; ort: { versao: string; wasm: Biblioteca; webgpu: Biblioteca }; fonemas: { js: string; wasm: Arquivo; dados: Arquivo }; vozes: VozNatural[] };
/** modo: "frase" (frase a frase, com respiro entre elas) ou "direto" (a aula toda, emendando as frases). */
export type Escolha = { voz: string; velocidade: number; numero?: number; modo: "frase" | "direto" };

const PADRAO: Escolha = { voz: VOZ_DO_APARELHO, velocidade: 1, modo: "frase" };

export function lerEscolha(): Escolha {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_DA_VOZ) ?? "null");
    if (v && typeof v.voz === "string") return { voz: v.voz, velocidade: Math.min(2, Math.max(0.5, Number(v.velocidade) || 1)), numero: Number(v.numero) || undefined, modo: v.modo === "direto" ? "direto" : "frase" };
  } catch {
    // sem armazenamento ou valor estragado: volta ao padrão
  }
  return PADRAO;
}

export function gravarEscolha(escolha: Partial<Escolha>) {
  const nova = { ...lerEscolha(), ...escolha };
  try {
    localStorage.setItem(CHAVE_DA_VOZ, JSON.stringify(nova));
  } catch {
    // sem armazenamento: vale até fechar a página
  }
  return nova;
}

let lista: Promise<Lista | null> | null = null;

/** A lista de vozes do site; sem o arquivo (o servidor não rodou vozes:baixar), só a voz do aparelho existe. */
export function carregarLista(): Promise<Lista | null> {
  lista ??= fetch("/vozes/vozes.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : null))
    .then((j: Lista | null) => (j && j.formato === 1 && Array.isArray(j.vozes) ? { ...j, vozes: j.vozes.filter((v) => !v.bloqueada || location.hostname === "localhost") } : null))
    .catch(() => null);
  return lista;
}

/** Todos os arquivos que uma voz precisa no aparelho (com a biblioteca e o espeak, que as vozes dividem). */
export function arquivosDaVoz(l: Lista, voz: VozNatural): Arquivo[] {
  return [...voz.arquivos, l.ort.wasm.wasm, l.fonemas.wasm, l.fonemas.dados];
}

/** Quanto falta baixar desta voz (zero quando já está guardada). */
export async function faltaBaixar(l: Lista, voz: VozNatural): Promise<number> {
  try {
    const cache = await caches.open(CACHE_DAS_VOZES);
    let falta = 0;
    for (const a of arquivosDaVoz(l, voz)) if (!(await cache.match(a.url))) falta += a.bytes;
    return falta;
  } catch {
    return voz.bytes;
  }
}

/** Apaga as vozes baixadas (Meus dados → apagar tudo). */
export async function apagarVozes() {
  try {
    await caches.delete(CACHE_DAS_VOZES);
  } catch {
    // sem Cache Storage: nada guardado
  }
}

export type Aparelho = { fraco: boolean; economia: boolean; redeLenta: boolean };

/** Aparelho com pouca memória ou rede em economia de dados: o seletor avisa e sugere a voz leve. */
export function comoEstaOAparelho(): Aparelho {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean; effectiveType?: string } };
  const memoria = nav.deviceMemory;
  return {
    fraco: typeof memoria === "number" && memoria < 4,
    economia: Boolean(nav.connection?.saveData) || matchMedia("(prefers-reduced-data: reduce)").matches,
    redeLenta: /(^|-)2g|3g/.test(nav.connection?.effectiveType ?? ""),
  };
}

export const vozesNaturaisPossiveis = () => typeof Worker !== "undefined" && typeof AudioContext !== "undefined" && typeof WebAssembly !== "undefined";

type Pedido = { resolver: (som: { pcm: Float32Array; taxa: number }) => void; rejeitar: (e: Error) => void };

/** O motor de uma voz natural: abre o Worker, baixa (com progresso) e fala frase a frase. */
export class MotorNatural {
  readonly id: string;
  private worker: Worker;
  private pronto: Promise<void>;
  private pedidos = new Map<number, Pedido>();
  private guardas = new Map<number, { resolver: () => void; rejeitar: (e: Error) => void }>();
  private proximo = 1;

  private lista: Lista;

  constructor(l: Lista, voz: VozNatural, aoProgresso: (feito: number, total: number) => void) {
    this.id = voz.id;
    this.lista = l;
    this.worker = new Worker("/workers/voz.js");
    let resolverPronto: () => void = () => {};
    let rejeitarPronto: (e: Error) => void = () => {};
    this.pronto = new Promise((res, rej) => {
      resolverPronto = res;
      rejeitarPronto = rej;
    });
    this.worker.onmessage = (e: MessageEvent) => {
      const m = e.data;
      if (m.t === "progresso") aoProgresso(m.feito, m.total);
      else if (m.t === "pronto") resolverPronto();
      else if (m.t === "audio") {
        this.pedidos.get(m.id)?.resolver({ pcm: m.pcm, taxa: m.taxa });
        this.pedidos.delete(m.id);
      } else if (m.t === "guardado") {
        this.guardas.get(m.id)?.resolver();
        this.guardas.delete(m.id);
      } else if (m.t === "erro") {
        const erro = new Error(m.mensagem);
        if (m.id) {
          this.pedidos.get(m.id)?.rejeitar(erro);
          this.pedidos.delete(m.id);
          this.guardas.get(m.id)?.rejeitar(erro);
          this.guardas.delete(m.id);
        } else rejeitarPronto(erro);
      }
    };
    this.worker.onerror = () => rejeitarPronto(new Error("o motor da voz não abriu"));
    this.worker.postMessage({ t: "carregar", voz: { ...voz, bytes: arquivosDaVoz(l, voz).reduce((s, a) => s + a.bytes, 0), ort: l.ort, fonemas: l.fonemas } });
  }

  carregado() {
    return this.pronto;
  }

  /** Fala um trecho com a voz dada (do mesmo modelo). `sessao` é o número da leitura: veja cancelar(). */
  async falar(texto: string, velocidade: number, voz: VozNatural | null, sessao: number) {
    await this.pronto;
    const id = this.proximo++;
    return new Promise<{ pcm: Float32Array; taxa: number }>((resolver, rejeitar) => {
      this.pedidos.set(id, { resolver, rejeitar });
      this.worker.postMessage({ t: "falar", id, texto, velocidade, sessao, voz: voz && this.lista ? { ...voz, ort: this.lista.ort, fonemas: this.lista.fonemas } : null });
    });
  }

  /** Baixa e guarda no aparelho os arquivos de outra voz do mesmo modelo (o estilo), sem fechar o modelo aberto. */
  async guardar(voz: VozNatural) {
    await this.pronto;
    const id = this.proximo++;
    return new Promise<void>((resolver, rejeitar) => {
      this.guardas.set(id, { resolver, rejeitar });
      this.worker.postMessage({ t: "guardar", id, voz: { ...voz, ort: this.lista.ort, fonemas: this.lista.fonemas } });
    });
  }

  /** Descarta, no Worker, tudo o que ainda está na fila das leituras anteriores a `sessao`. O modelo continua aberto. */
  cancelar(sessao: number) {
    this.worker.postMessage({ t: "cancelar", sessao });
  }

  encerrar() {
    this.worker.terminate();
    for (const p of this.pedidos.values()) p.rejeitar(new Error("parado"));
    this.pedidos.clear();
    for (const g of this.guardas.values()) g.rejeitar(new Error("parado"));
    this.guardas.clear();
  }
}
