// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O trabalho pesado do podcast acontece no navegador de quem produz, para nada pesar no servidor do site:
// envio com barra de progresso, medição do volume (LUFS, como pedem as plataformas), forma da onda,
// capas no tamanho certo e a limpeza dos depósitos.
import { getClient, rpc } from "./backend";

const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** O limite do plano gratuito do serviço de arquivos. Maior que isso entra como link (Internet Archive, Drive). */
export const LIMITE_BYTES = 50 * 1024 * 1024;

export type Deposito = "podcast" | "podcast-producao";

export class EnvioError extends Error {}

/** Nome sorteado: o nome original do arquivo (que costuma dizer de quem é e de quando) não sai do aparelho. */
export const nomeSorteado = (prefixo: string, extensao: string) => `${prefixo}-${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}.${extensao}`;

export function extensaoDe(arquivo: File | Blob, padrao = "bin"): string {
  const nome = "name" in arquivo ? arquivo.name.toLowerCase() : "";
  const pelo = /\.([a-z0-9]{2,5})$/.exec(nome)?.[1];
  if (pelo) return pelo === "jpeg" ? "jpg" : pelo;
  const tipos: Record<string, string> = {
    "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/ogg": "ogg", "audio/opus": "opus", "audio/wav": "wav", "audio/x-wav": "wav",
    "audio/flac": "flac", "audio/webm": "webm", "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov", "application/pdf": "pdf",
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
  };
  return tipos[arquivo.type] ?? padrao;
}

/** Tipo do arquivo como o depósito aceita (alguns sistemas mandam "audio/x-m4a" ou nada). */
export function tipoDe(arquivo: File | Blob): string {
  const ext = extensaoDe(arquivo);
  const porExtensao: Record<string, string> = { mp3: "audio/mpeg", m4a: "audio/mp4", ogg: "audio/ogg", opus: "audio/opus", wav: "audio/wav", flac: "audio/flac", aac: "audio/aac", webm: arquivo.type.startsWith("video") ? "video/webm" : "audio/webm", mp4: "video/mp4", mov: "video/quicktime", pdf: "application/pdf", jpg: "image/jpeg", png: "image/png", webp: "image/webp", zip: "application/zip" };
  return porExtensao[ext] ?? arquivo.type ?? "application/octet-stream";
}

/** Envia com barra de progresso (o cliente do serviço não informa o andamento; aqui é um pedido direto). */
export async function enviarComProgresso(deposito: Deposito, caminho: string, arquivo: Blob, aoAndar?: (fracao: number) => void, tipo = tipoDe(arquivo)): Promise<void> {
  if (arquivo.size > LIMITE_BYTES) throw new EnvioError("tamanho");
  const supabase = await getClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new EnvioError("sessao");
  await new Promise<void>((resolve, reject) => {
    const pedido = new XMLHttpRequest();
    pedido.open("POST", `${base}/storage/v1/object/${deposito}/${caminho.split("/").map(encodeURIComponent).join("/")}`);
    pedido.setRequestHeader("Authorization", `Bearer ${token}`);
    pedido.setRequestHeader("apikey", chave);
    pedido.setRequestHeader("Content-Type", tipo);
    pedido.setRequestHeader("x-upsert", "false");
    pedido.setRequestHeader("cache-control", "max-age=31536000");
    pedido.upload.onprogress = (e) => {
      if (e.lengthComputable) aoAndar?.(e.loaded / e.total);
    };
    pedido.onload = () => {
      if (pedido.status >= 200 && pedido.status < 300) return resolve();
      reject(new EnvioError(pedido.status === 413 ? "tamanho" : pedido.status === 403 || pedido.status === 401 ? "permissao" : pedido.status === 415 ? "formato" : "envio"));
    };
    pedido.onerror = () => reject(new EnvioError("rede"));
    pedido.send(arquivo);
  });
}

export const mensagensDeEnvio: Record<string, string> = {
  tamanho: "O arquivo passa de 50 MB, o limite do depósito. Exporte em MP3 de 96 a 128 kbps, ou guarde no Internet Archive e cole o link.",
  sessao: "Entre na sua conta de novo para enviar.",
  permissao: "O depósito recusou: a sua função não envia este tipo de arquivo.",
  formato: "O depósito não aceita este formato.",
  rede: "A conexão caiu durante o envio. Tente de novo.",
  envio: "O envio não foi aceito. Tente de novo.",
};

/** Endereço temporário (uma hora) para ouvir um arquivo do depósito fechado sem baixar inteiro. */
export async function urlAssinada(caminho: string): Promise<string> {
  const supabase = await getClient();
  const { data, error } = await supabase.storage.from("podcast-producao").createSignedUrl(caminho, 3600);
  if (error || !data) throw new EnvioError("leitura");
  return data.signedUrl;
}

export const urlPublica = (caminho: string) => `${base}/storage/v1/object/public/podcast/${caminho.split("/").map(encodeURIComponent).join("/")}`;

/** Apaga dos depósitos o que o banco liberou e confirma de volta. Devolve quantos saíram. */
export async function liberarEspaco(itens: { deposito: string; caminho: string }[]): Promise<number> {
  if (itens.length === 0) return 0;
  const supabase = await getClient();
  const feitos: { deposito: string; caminho: string }[] = [];
  for (const deposito of ["podcast", "podcast-producao"]) {
    const caminhos = itens.filter((item) => item.deposito === deposito).map((item) => item.caminho);
    for (let i = 0; i < caminhos.length; i += 100) {
      const lote = caminhos.slice(i, i + 100);
      const { error } = await supabase.storage.from(deposito).remove(lote);
      if (!error) feitos.push(...lote.map((caminho) => ({ deposito, caminho })));
    }
  }
  if (feitos.length > 0) await rpc("podcast_liberados", { p_itens: feitos });
  return feitos.length;
}

// ── Medição do áudio ──

export interface Analise {
  duracao: number;
  /** 200 barras de 0 a 100 para desenhar a forma da onda. */
  picos: number[];
  /** Volume integrado (LUFS). O padrão dos podcasts é perto de -16. */
  lufs: number | null;
  /** Pico mais alto (dBFS). Acima de -1 estoura em alguns aparelhos. */
  pico: number | null;
  /** Nível das partes mais silenciosas (aproximação do ruído de fundo, em LUFS). */
  ruido: number | null;
  /** A medição cobriu o arquivo inteiro ou só a duração (formato que não dá para medir em pedaços). */
  completa: boolean;
}

/** Filtro de ponderação K (BS.1770), com estado, para medir em pedaços sem emendas. */
class Biquad {
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;
  constructor(
    private b0: number,
    private b1: number,
    private b2: number,
    private a1: number,
    private a2: number,
  ) {}
  passo(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

const filtrosK = () => [
  new Biquad(1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585),
  new Biquad(1.0, -2.0, 1.0, -1.99004745483398, 0.99007225036621),
];

function duracaoPeloElemento(arquivo: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(arquivo);
    const el = new Audio();
    el.preload = "metadata";
    const fim = (valor: number) => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(valor) ? valor : 0);
    };
    el.onloadedmetadata = () => fim(el.duration);
    el.onerror = () => fim(0);
    el.src = url;
  });
}

/**
 * Mede o áudio no navegador. MP3 é lido em pedaços de 1,5 MB (o MP3 se decodifica em pedaços), então até um episódio de
 * uma hora cabe na memória de um computador simples; outros formatos são lidos inteiros até 30 MB.
 */
export async function analisarAudio(arquivo: Blob, aoAndar?: (fracao: number) => void): Promise<Analise> {
  const duracao = await duracaoPeloElemento(arquivo);
  const mp3 = tipoDe(arquivo) === "audio/mpeg";
  if (!mp3 && arquivo.size > 30 * 1024 * 1024) return { duracao: Math.round(duracao), picos: [], lufs: null, pico: null, ruido: null, completa: false };
  const taxa = 48000;
  const contexto = new OfflineAudioContext(1, 1, taxa);
  const sub = taxa / 10; // blocos de 100 ms
  const filtros: Biquad[][] = [];
  const energiasK: number[] = []; // por bloco de 100 ms, soma dos canais (ponderação K)
  const brutas: number[] = []; // por bloco de 100 ms, sem ponderação (para a forma da onda)
  let pico = 0;
  let acumK = 0;
  let acumBruto = 0;
  let amostras = 0;
  const pedaco = mp3 ? 1.5 * 1024 * 1024 : arquivo.size;
  for (let inicio = 0; inicio < arquivo.size; inicio += pedaco) {
    let buffer: AudioBuffer;
    try {
      buffer = await contexto.decodeAudioData(await arquivo.slice(inicio, Math.min(arquivo.size, inicio + pedaco)).arrayBuffer());
    } catch {
      continue;
    }
    const canais = Array.from({ length: Math.min(buffer.numberOfChannels, 2) }, (_, c) => buffer.getChannelData(c));
    while (filtros.length < canais.length) filtros.push(filtrosK());
    for (let i = 0; i < buffer.length; i++) {
      let somaK = 0;
      let somaBruta = 0;
      for (let c = 0; c < canais.length; c++) {
        const x = canais[c][i];
        const absoluto = Math.abs(x);
        if (absoluto > pico) pico = absoluto;
        const y = filtros[c][1].passo(filtros[c][0].passo(x));
        somaK += y * y;
        somaBruta += x * x;
      }
      acumK += somaK;
      acumBruto += somaBruta / canais.length;
      amostras++;
      if (amostras === sub) {
        energiasK.push(acumK / sub);
        brutas.push(Math.sqrt(acumBruto / sub));
        acumK = 0;
        acumBruto = 0;
        amostras = 0;
      }
    }
    aoAndar?.(Math.min(1, (inicio + pedaco) / arquivo.size));
    // Devolve a vez ao navegador entre um pedaço e outro, para a tela não travar.
    await new Promise((r) => setTimeout(r, 0));
  }
  if (energiasK.length < 4) return { duracao: Math.round(duracao), picos: [], lufs: null, pico: null, ruido: null, completa: false };

  // Blocos de 400 ms com 75% de sobreposição (quatro blocos de 100 ms), com as duas comportas da norma.
  const blocos: number[] = [];
  for (let i = 0; i + 4 <= energiasK.length; i++) blocos.push((energiasK[i] + energiasK[i + 1] + energiasK[i + 2] + energiasK[i + 3]) / 4);
  const loud = (z: number) => -0.691 + 10 * Math.log10(z || 1e-12);
  const absolutos = blocos.filter((z) => loud(z) > -70);
  const media = (lista: number[]) => lista.reduce((a, b) => a + b, 0) / Math.max(1, lista.length);
  const relativo = loud(media(absolutos)) - 10;
  const finais = absolutos.filter((z) => loud(z) > relativo);
  const lufs = finais.length ? loud(media(finais)) : null;
  const ordenados = blocos.map(loud).sort((a, b) => a - b);
  const ruido = ordenados.length ? ordenados[Math.floor(ordenados.length * 0.1)] : null;

  // Forma da onda: 200 barras, na raiz para os trechos baixos não sumirem.
  const barras = 200;
  const picos: number[] = [];
  const maior = Math.max(...brutas, 1e-9);
  for (let b = 0; b < barras; b++) {
    const de = Math.floor((b / barras) * brutas.length);
    const ate = Math.max(de + 1, Math.floor(((b + 1) / barras) * brutas.length));
    const trecho = brutas.slice(de, ate);
    picos.push(Math.round(Math.sqrt(Math.max(...trecho) / maior) * 100));
  }
  const duracaoLida = (energiasK.length * sub) / taxa;
  return {
    duracao: Math.round(duracao || duracaoLida),
    picos,
    lufs: lufs === null ? null : Math.round(lufs * 10) / 10,
    pico: pico > 0 ? Math.round(20 * Math.log10(pico) * 10) / 10 : null,
    ruido: ruido === null ? null : Math.round(ruido),
    completa: true,
  };
}

/** O que a medição quer dizer, em português de quem edita. */
export function conselhoDeVolume(a: Analise): string[] {
  const dicas: string[] = [];
  if (a.lufs === null && a.completa) return ["Não há som suficiente para medir: o arquivo parece estar em silêncio. Confira se exportou a faixa certa."];
  if (a.lufs === null) return ["Não deu para medir o volume deste formato aqui. Confira no Audacity (Analisar → Medir volume) ou exporte em MP3."];
  if (a.lufs < -19) dicas.push(`Volume baixo (${a.lufs} LUFS). O padrão é perto de -16: no Audacity, Efeitos → Volume e compressão → Normalização de volume (loudness), alvo -16 LUFS.`);
  else if (a.lufs > -14) dicas.push(`Volume alto (${a.lufs} LUFS). Normalize para perto de -16 LUFS: acima disso as plataformas abaixam e pode distorcer.`);
  else dicas.push(`Volume dentro do padrão (${a.lufs} LUFS; o alvo é -16).`);
  if (a.pico !== null && a.pico > -1) dicas.push(`O pico chega a ${a.pico} dB: acima de -1 estoura em alguns aparelhos. Use um limitador em -1 dB.`);
  if (a.ruido !== null && a.lufs !== null && a.ruido > a.lufs - 30) dicas.push(`As partes quietas estão perto do volume da fala (${a.ruido} LUFS): pode haver ruído de fundo. No Audacity: Efeitos → Redução de ruído.`);
  return dicas;
}

// ── Capas ──

/** Recorta no centro, redesenha em 3000×3000 (o padrão das plataformas) e faz a miniatura de 600 para o site. */
export async function prepararCapa(origem: Blob | HTMLCanvasElement): Promise<{ grande: Blob; mini: Blob }> {
  const imagem = origem instanceof HTMLCanvasElement ? origem : await createImageBitmap(origem);
  const lado = Math.min(imagem.width, imagem.height);
  const sx = (imagem.width - lado) / 2;
  const sy = (imagem.height - lado) / 2;
  const desenhar = async (tamanho: number, qualidade: number) => {
    const tela = document.createElement("canvas");
    tela.width = tamanho;
    tela.height = tamanho;
    const pena = tela.getContext("2d");
    if (!pena) throw new EnvioError("formato");
    pena.fillStyle = "#1f1a14";
    pena.fillRect(0, 0, tamanho, tamanho);
    pena.imageSmoothingQuality = "high";
    pena.drawImage(imagem, sx, sy, lado, lado, 0, 0, tamanho, tamanho);
    const blob = await new Promise<Blob | null>((resolve) => tela.toBlob(resolve, "image/jpeg", qualidade));
    if (!blob) throw new EnvioError("formato");
    return blob;
  };
  const grande = await desenhar(3000, 0.88);
  const mini = await desenhar(600, 0.82);
  if ("close" in imagem) imagem.close();
  return { grande, mini };
}

/** Envia a capa e a miniatura para a pasta de capas e devolve os dois caminhos. */
export async function enviarCapa(pasta: string, capa: { grande: Blob; mini: Blob }, aoAndar?: (fracao: number) => void): Promise<{ capa: string; mini: string }> {
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const grande = `capas/${pasta}/capa-${id}.jpg`;
  const mini = `capas/${pasta}/mini-${id}.jpg`;
  await enviarComProgresso("podcast", grande, capa.grande, (f) => aoAndar?.(f * 0.85), "image/jpeg");
  await enviarComProgresso("podcast", mini, capa.mini, (f) => aoAndar?.(0.85 + f * 0.15), "image/jpeg");
  return { capa: grande, mini };
}

/** Baixa um arquivo do depósito público (para medir ou cortar um áudio que já foi enviado). */
export async function baixarPublico(caminho: string): Promise<Blob> {
  const resposta = await fetch(urlPublica(caminho));
  if (!resposta.ok) throw new EnvioError("leitura");
  return resposta.blob();
}
