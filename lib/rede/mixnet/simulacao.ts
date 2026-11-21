// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// SÓ PARA TESTE (onda R3, item 2.1): a simulação de uma mixnet no modelo Loopix (o que a Nym usa) com um OBSERVADOR DA REDE INTEIRA,
// para medir se ele liga o depósito numa caixa a quem depositou e a busca da caixa a quem buscou (e, com os dois, quem fala com quem).
// Nada daqui roda no aparelho. Documento: docs/rede/CHAT-PRIVADO.md ("Por onde as mensagens passam").
//
// O modelo:
//   - N aparelhos; cada um manda pacotes num fluxo de Poisson (taxa λ). Uma mensagem de verdade (depósito ou busca) sai NO LUGAR do
//     próximo pacote do fluxo; sem mensagem, o pacote é cobertura. Na variante "sem cobertura", só as mensagens de verdade saem, na hora;
//   - cada pacote passa por uma camada de nós de cada vez (nó sorteado por camada); cada nó segura o pacote por um tempo exponencial de
//     média μ; o de verdade sai da última camada para o servidor, o de cobertura para outro lugar;
//   - as buscas seguem o ritmo do aparelho (intervalo fixo com deslocamento sorteado), sem relação com os depósitos.
// O observador vê TODAS as ligações com o horário exato: cada pacote que entra e sai de cada nó, de onde veio e para onde foi. Para cada
// pacote que chega ao servidor, ele volta camada por camada: a saída de um nó no instante τ veio de cada entrada anterior com peso
// proporcional à densidade exponencial (τ − chegada); na primeira camada, cada entrada tem dono conhecido. O palpite é o aparelho de
// maior peso (a melhor estratégia conhecida para mixagem por atraso exponencial). Na via direta, ele vê o endereço: acerta sempre.
//
// O sorteio daqui é um gerador DETERMINÍSTICO com semente (para o teste se repetir), que não serve para nada de segurança e não sai daqui.
import { MODELO } from "./parametros";

export type ViaSimulada = "direta" | "mixnet" | "mixnet_sem_cobertura";

/** Um gerador determinístico (xoshiro128**) com semente: só para a simulação. */
export function gerador(semente: number) {
  let a = semente >>> 0 || 1;
  let b = 0x9e3779b9;
  let c = 0x243f6a88;
  let d = 0xb7e15162;
  const proximo = () => {
    const r = Math.imul(rotl(Math.imul(b, 5), 7), 9) >>> 0;
    const t = b << 9;
    c ^= a;
    d ^= b;
    b ^= c;
    a ^= d;
    c ^= t;
    d = rotl(d, 11);
    return r;
  };
  for (let i = 0; i < 20; i++) proximo();
  const uniforme = () => (proximo() + 0.5) / 2 ** 32;
  return {
    uniforme,
    inteiro: (n: number) => Math.floor(uniforme() * n),
    exponencial: (media: number) => -Math.log(uniforme()) * media,
  };
}
const rotl = (x: number, k: number) => ((x << k) | (x >>> (32 - k))) >>> 0;

export interface OpcoesDaRodada {
  via: ViaSimulada;
  semente: number;
  pessoas?: number;
  segundos?: number;
  conversas?: number;
  depositosPorConversa?: number;
  /** O intervalo das buscas (segundos). */
  intervaloDaBusca?: number;
  modelo?: { camadas: number; nosPorCamada: number; atrasoMedio: number; taxaPorAparelho: number };
}

export interface ResultadoDaRodada {
  /** Quantos depósitos e buscas chegaram ao servidor, e em quantos o palpite do observador acertou o aparelho. */
  eventos: number;
  acertos: number;
  /** Quantas conversas, e em quantas o observador acertou os DOIS lados (quem deposita e quem busca a caixa). */
  conversas: number;
  paresCertos: number;
  pessoas: number;
}

interface Chegada {
  t: number;
  /** Na primeira camada: o aparelho. Nas outras: o id da saída da camada anterior. */
  de: number;
}

/** Uma rodada da simulação: monta o tráfego, passa pela rede e põe o observador a adivinhar. */
export function rodada(o: OpcoesDaRodada): ResultadoDaRodada {
  const r = gerador(o.semente);
  const N = o.pessoas ?? 50;
  const T = o.segundos ?? 30;
  const K = o.conversas ?? 20;
  const D = o.depositosPorConversa ?? 2;
  const intervalo = o.intervaloDaBusca ?? 6;
  const m = o.modelo ?? MODELO;
  const camadas = o.via === "direta" ? 0 : m.camadas;
  const W = m.nosPorCamada;
  const mu = m.atrasoMedio;

  // As conversas (quem deposita, quem busca) e os eventos de verdade.
  const pares: { s: number; d: number }[] = [];
  for (let k = 0; k < K; k++) {
    const s = r.inteiro(N);
    let d = r.inteiro(N - 1);
    if (d >= s) d++;
    pares.push({ s, d });
  }
  const deVerdade: { quem: number; t: number; caixa: number }[] = [];
  for (let k = 0; k < K; k++) {
    for (let i = 0; i < D; i++) deVerdade.push({ quem: pares[k].s, t: 2 + r.uniforme() * (T - 6), caixa: k });
    const desloc = r.uniforme() * intervalo;
    for (let t = desloc; t < T - 3; t += intervalo) deVerdade.push({ quem: pares[k].d, t, caixa: k });
  }

  // Os pacotes que cada aparelho manda: o fluxo de Poisson (com cobertura) ou só os de verdade.
  interface Pacote { quem: number; t: number; caixa: number }
  const pacotes: Pacote[] = [];
  if (o.via === "mixnet") {
    const fila: { t: number; caixa: number }[][] = Array.from({ length: N }, () => []);
    for (const e of deVerdade) fila[e.quem].push({ t: e.t, caixa: e.caixa });
    for (const f of fila) f.sort((x, y) => x.t - y.t);
    for (let u = 0; u < N; u++) {
      let t = r.exponencial(1 / m.taxaPorAparelho);
      while (t < T) {
        // A mensagem de verdade mais antiga que já esperava sai neste pacote; senão, é cobertura (-1).
        const vez = fila[u].length && fila[u][0].t <= t ? fila[u].shift()! : null;
        pacotes.push({ quem: u, t, caixa: vez ? vez.caixa : -1 });
        t += r.exponencial(1 / m.taxaPorAparelho);
      }
    }
  } else {
    for (const e of deVerdade) pacotes.push({ quem: e.quem, t: e.t, caixa: e.caixa });
  }

  // A rede: cada pacote passa pelas camadas; o observador anota cada chegada e cada saída de cada nó.
  const chegadas: Chegada[][][] = Array.from({ length: camadas }, () => Array.from({ length: W }, () => []));
  /** As saídas de cada nó: o instante e o id global (o mesmo id é a chegada na camada seguinte). */
  const saidas: { t: number; no: number; camada: number }[] = [];
  const noServidor: { id: number; quem: number; caixa: number; t: number }[] = [];
  for (const p of pacotes) {
    let t = p.t;
    let de = p.quem;
    let id = -1;
    for (let c = 0; c < camadas; c++) {
      const no = r.inteiro(W);
      chegadas[c][no].push({ t, de });
      t += r.exponencial(mu);
      id = saidas.length;
      saidas.push({ t, no, camada: c });
      de = id;
    }
    if (p.caixa >= 0) noServidor.push({ id, quem: p.quem, caixa: p.caixa, t });
  }
  for (const c of chegadas) for (const n of c) n.sort((x, y) => x.t - y.t);

  // O observador: a distribuição de cada saída sobre os aparelhos, voltando camada por camada (com memória).
  const memoria = new Map<number, Float64Array>();
  const janela = 8 * mu;
  const primeiraDepois = (lista: Chegada[], t: number) => {
    let lo = 0;
    let hi = lista.length;
    while (lo < hi) {
      const meio = (lo + hi) >> 1;
      if (lista[meio].t < t) lo = meio + 1;
      else hi = meio;
    }
    return lo;
  };
  const distribuicao = (id: number): Float64Array => {
    const ja = memoria.get(id);
    if (ja) return ja;
    const s = saidas[id];
    const lista = chegadas[s.camada][s.no];
    const fim = primeiraDepois(lista, s.t);
    const inicio = primeiraDepois(lista, s.t - janela);
    const v = new Float64Array(N);
    let soma = 0;
    for (let i = inicio; i < fim; i++) {
      const w = Math.exp(-(s.t - lista[i].t) / mu);
      soma += w;
      if (s.camada === 0) v[lista[i].de] += w;
      else {
        const anterior = distribuicao(lista[i].de);
        for (let u = 0; u < N; u++) v[u] += w * anterior[u];
      }
    }
    if (soma > 0) for (let u = 0; u < N; u++) v[u] /= soma;
    memoria.set(id, v);
    return v;
  };
  const palpite = (v: Float64Array) => {
    let melhor = 0;
    for (let u = 1; u < N; u++) if (v[u] > v[melhor]) melhor = u;
    return melhor;
  };

  let acertos = 0;
  const porCaixa = Array.from({ length: K }, () => ({ dep: new Float64Array(N), bus: new Float64Array(N) }));
  for (const e of noServidor) {
    let v: Float64Array;
    if (camadas === 0) {
      v = new Float64Array(N);
      v[e.quem] = 1;
    } else v = distribuicao(e.id);
    if (palpite(v) === e.quem) acertos++;
    const alvo = e.quem === pares[e.caixa].s ? porCaixa[e.caixa].dep : porCaixa[e.caixa].bus;
    for (let u = 0; u < N; u++) alvo[u] += Math.log(v[u] + 1e-12);
  }
  let paresCertos = 0;
  for (let k = 0; k < K; k++) if (palpite(porCaixa[k].dep) === pares[k].s && palpite(porCaixa[k].bus) === pares[k].d) paresCertos++;
  return { eventos: noServidor.length, acertos, conversas: K, paresCertos, pessoas: N };
}

/** O intervalo de 99% em torno do acaso (1/N) para `n` tentativas (aproximação normal da binomial). */
export function intervaloDoAcaso(n: number, pessoas: number): { min: number; max: number; acaso: number } {
  const p = 1 / pessoas;
  const z = 2.5758;
  const folga = z * Math.sqrt((p * (1 - p)) / n);
  return { min: Math.max(0, p - folga), max: p + folga, acaso: p };
}
