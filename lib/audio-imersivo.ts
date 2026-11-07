// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Áudio espacial do podcast (T17): o equivalente aberto do que os serviços fechados vendem como "áudio imersivo". Tudo
// roda no navegador de quem ouve, com a Web Audio API (padrão do W3C), sem arquivo extra e sem mandar nada para lugar
// nenhum:
//   - espacialização binaural: o som do episódio vira dois "alto-falantes virtuais" à frente da pessoa (PannerNode com
//     o modelo HRTF do próprio navegador), que nos fones soam fora da cabeça, como numa sala, e não "dentro do ouvido";
//   - ambiência leve: um ConvolverNode com uma resposta ao impulso calculada aqui (reflexões iniciais e uma cauda que
//     escurece), em vez de baixar um arquivo de impulso pesado.
// Na tela o nome é sempre "áudio espacial (binaural, aberto)". Não é Dolby Atmos nem compatível com ele: Atmos é um
// formato fechado, com mixagem por objetos feita no estúdio; aqui o efeito é aplicado na hora sobre o áudio estéreo comum.
//
// Este arquivo não importa nada do site ("@/"), para rodar também no teste em Node (scripts/testar-podcast-imersivo.mjs).

export type Ambiente = "estudio" | "sala" | "auditorio";

export interface Predefinicao {
  /** Duração da cauda da ambiência, em segundos. */
  segundos: number;
  /** Quanto a cauda cai (maior = some mais rápido). */
  decaimento: number;
  /** Volume da ambiência somada ao som direto (0 a 1). Baixo de propósito: a voz continua clara. */
  molhado: number;
  /** Abertura dos dois alto-falantes virtuais, em graus para cada lado. */
  largura: number;
  /** Atraso antes da ambiência começar, em segundos (dá a sensação do tamanho do lugar). */
  preAtraso: number;
}

export const AMBIENTES: Record<Ambiente, Predefinicao> = {
  estudio: { segundos: 0.6, decaimento: 3.4, molhado: 0.08, largura: 22, preAtraso: 0.006 },
  sala: { segundos: 1.3, decaimento: 2.8, molhado: 0.14, largura: 32, preAtraso: 0.012 },
  auditorio: { segundos: 2.4, decaimento: 2.3, molhado: 0.2, largura: 42, preAtraso: 0.022 },
};

export const AMBIENTE_PADRAO: Ambiente = "sala";
export const ehAmbiente = (v: unknown): v is Ambiente => v === "estudio" || v === "sala" || v === "auditorio";

/** Gerador pseudoaleatório pequeno e fixo (mulberry32): a mesma semente dá sempre a mesma sala. */
function sorteio(semente: number) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A resposta ao impulso da ambiência, em dois canais diferentes entre si (o que dá largura). Começa com poucas reflexões
 * iniciais nítidas e segue com um ruído que cai de forma exponencial e vai ficando mais escuro (um passa-baixas de um polo
 * que fecha com o tempo, como o ar e as paredes fazem). A energia é normalizada para o volume não depender do ambiente.
 * No máximo 3 segundos: a 48 kHz são uns 1,1 MB de memória, calculados uma vez e só quando a pessoa liga o modo.
 */
export function respostaAoImpulso(taxa: number, p: Predefinicao, semente = 17): [Float32Array, Float32Array] {
  const total = Math.max(1, Math.round(Math.min(3, Math.max(0.1, p.segundos)) * taxa));
  const pre = Math.round(Math.max(0, p.preAtraso) * taxa);
  const canais: [Float32Array, Float32Array] = [new Float32Array(total), new Float32Array(total)];
  canais.forEach((dados, c) => {
    const acaso = sorteio(semente + c * 7919);
    // Reflexões iniciais: 6 batidas entre 5 e 60 ms depois do pré-atraso, cada vez mais fracas.
    for (let i = 0; i < 6; i++) {
      const pos = pre + Math.round((0.005 + acaso() * 0.055) * taxa);
      if (pos < total) dados[pos] += (acaso() < 0.5 ? -1 : 1) * (0.55 - i * 0.07);
    }
    let filtrado = 0;
    for (let i = pre; i < total; i++) {
      const t = (i - pre) / (total - pre || 1);
      const envelope = Math.exp(-p.decaimento * t * 3);
      // Coeficiente do passa-baixas: aberto no começo (0,9), quase fechado no fim (0,15).
      const abertura = 0.9 - 0.75 * t;
      filtrado += abertura * ((acaso() * 2 - 1) - filtrado);
      dados[i] += filtrado * envelope * 0.6;
    }
    // Entrada suave nos primeiros 2 ms da cauda, para não estalar.
    const rampa = Math.min(total - pre, Math.round(0.002 * taxa));
    for (let i = 0; i < rampa; i++) dados[pre + i] *= i / rampa;
  });
  let energia = 0;
  for (const dados of canais) for (let i = 0; i < dados.length; i++) energia += dados[i] * dados[i];
  const escala = energia > 0 ? 1 / Math.sqrt(energia / 2) : 1;
  for (const dados of canais) for (let i = 0; i < dados.length; i++) dados[i] *= escala;
  return canais;
}

/** Onde fica cada alto-falante virtual: x à direita, z negativo à frente (o padrão da Web Audio), a 1 metro. */
export function posicaoDoAltoFalante(graus: number): { x: number; y: number; z: number } {
  const r = (graus * Math.PI) / 180;
  return { x: Math.round(Math.sin(r) * 1e6) / 1e6, y: 0, z: Math.round(-Math.cos(r) * 1e6) / 1e6 };
}

export interface CadeiaEspacial {
  desmontar(): void;
}

function posicionar(painel: PannerNode, graus: number, contexto: BaseAudioContext) {
  const { x, y, z } = posicaoDoAltoFalante(graus);
  if (painel.positionX) {
    painel.positionX.setValueAtTime(x, contexto.currentTime);
    painel.positionY.setValueAtTime(y, contexto.currentTime);
    painel.positionZ.setValueAtTime(z, contexto.currentTime);
  } else {
    (painel as unknown as { setPosition(x: number, y: number, z: number): void }).setPosition(x, y, z);
  }
}

/**
 * Monta a cadeia entre "entrada" e "saida": o estéreo (ou mono, que vira estéreo igual nos dois lados) é separado nos dois
 * canais, cada um vai para um PannerNode HRTF à esquerda e à direita da frente; em paralelo, uma parte passa pela
 * ambiência. Devolve como desmontar, para trocar de ambiente ou desligar sem recriar o contexto.
 */
export function montarEspacial(contexto: BaseAudioContext, entrada: AudioNode, saida: AudioNode, ambiente: Ambiente): CadeiaEspacial {
  const p = AMBIENTES[ambiente] ?? AMBIENTES[AMBIENTE_PADRAO];
  // Força dois canais: o episódio gravado em mono chega igual nos dois alto-falantes virtuais.
  const estereo = contexto.createGain();
  estereo.channelCount = 2;
  estereo.channelCountMode = "explicit";
  estereo.channelInterpretation = "speakers";
  const separar = contexto.createChannelSplitter(2);
  const nos: AudioNode[] = [estereo, separar];
  entrada.connect(estereo);
  estereo.connect(separar);

  // O som direto um pouco abaixo, para a soma com a ambiência não estourar.
  const direto = contexto.createGain();
  direto.gain.value = 0.92;
  direto.connect(saida);
  nos.push(direto);

  [-p.largura, p.largura].forEach((graus, canal) => {
    const painel = contexto.createPanner();
    painel.panningModel = "HRTF";
    painel.distanceModel = "inverse";
    painel.refDistance = 1;
    painel.rolloffFactor = 0;
    posicionar(painel, graus, contexto);
    separar.connect(painel, canal);
    painel.connect(direto);
    nos.push(painel);
  });

  const ambiencia = contexto.createConvolver();
  ambiencia.normalize = false;
  const canais = respostaAoImpulso(contexto.sampleRate, p);
  const buffer = contexto.createBuffer(2, canais[0].length, contexto.sampleRate);
  buffer.copyToChannel(canais[0] as Float32Array<ArrayBuffer>, 0);
  buffer.copyToChannel(canais[1] as Float32Array<ArrayBuffer>, 1);
  ambiencia.buffer = buffer;
  const molhado = contexto.createGain();
  molhado.gain.value = p.molhado;
  estereo.connect(ambiencia);
  ambiencia.connect(molhado);
  molhado.connect(saida);
  nos.push(ambiencia, molhado);

  return {
    desmontar() {
      try {
        entrada.disconnect(estereo);
      } catch {
        // já desligado
      }
      for (const no of nos) {
        try {
          no.disconnect();
        } catch {
          // já desligado
        }
      }
    },
  };
}

// ---------------------------------------------------------------- a escolha da pessoa (só neste navegador)

export interface EscolhaImersiva {
  ligado: boolean;
  ambiente: Ambiente;
}

/** Fica só neste navegador (comodidade de quem ouve), sob esta chave. Não vai para a conta nem para o servidor. */
export const CHAVE_IMERSIVO = "lucia:audio-espacial";

export function lerEscolha(texto: string | null): EscolhaImersiva {
  try {
    const v = JSON.parse(texto ?? "") as Partial<EscolhaImersiva>;
    return { ligado: v.ligado === true, ambiente: ehAmbiente(v.ambiente) ? v.ambiente : AMBIENTE_PADRAO };
  } catch {
    return { ligado: false, ambiente: AMBIENTE_PADRAO };
  }
}

let escolha: EscolhaImersiva | null = null;
const ouvintes = new Set<() => void>();
const PADRAO: EscolhaImersiva = { ligado: false, ambiente: AMBIENTE_PADRAO };

function carregar(): EscolhaImersiva {
  if (escolha) return escolha;
  if (typeof window === "undefined") return PADRAO;
  try {
    escolha = lerEscolha(window.localStorage.getItem(CHAVE_IMERSIVO));
  } catch {
    escolha = { ...PADRAO };
  }
  return escolha;
}

/** O estado do modo, para o useSyncExternalStore (o tocador e o controle da página do podcast leem o mesmo). */
export const audioEspacial = {
  assinar(ouvinte: () => void) {
    ouvintes.add(ouvinte);
    return () => {
      ouvintes.delete(ouvinte);
    };
  },
  atual: carregar,
  servidor: () => PADRAO,
  definir(mudanca: Partial<EscolhaImersiva>) {
    escolha = { ...carregar(), ...mudanca };
    if (!ehAmbiente(escolha.ambiente)) escolha.ambiente = AMBIENTE_PADRAO;
    try {
      window.localStorage.setItem(CHAVE_IMERSIVO, JSON.stringify(escolha));
    } catch {
      // sem armazenamento: vale só nesta visita
    }
    ouvintes.forEach((o) => o());
  },
};

/** O navegador tem o que o modo precisa? (Web Audio com PannerNode e ConvolverNode.) */
export function temAudioEspacial(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { AudioContext?: unknown; webkitAudioContext?: unknown };
  return Boolean(w.AudioContext || w.webkitAudioContext);
}
