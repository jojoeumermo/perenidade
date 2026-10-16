// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type Anexo, cifrarArquivo, deBase64Comum, decifrarArquivo, extensaoDe, identificar, LIMITE_BYTES, LIMITE_POR_MENSAGEM, paraBase64Comum, picosDe, tamanhoLegivel, type TipoDeAnexo } from "@/lib/anexos";
import { BackendError, rpc } from "@/lib/backend";
import { Aviso, botao, botaoClaro, elo, textoDoErro } from "./comum";

// Tudo o que um arquivo de conversa passa acontece neste aparelho: conferir o tipo pelos bytes, redesenhar a imagem
// (sem os dados embutidos pela câmera), medir o áudio, cifrar com uma chave só dele, e, do outro lado, baixar o
// cifrado, abrir, conferir o resumo e mostrar. O servidor nunca vê o conteúdo, o nome nem o tipo.

/** Um arquivo escolhido, ainda neste aparelho, pronto para ser cifrado e enviado. */
export interface Preparado {
  marca: string;
  bytes: Uint8Array<ArrayBuffer>;
  tipo: TipoDeAnexo;
  mime: string;
  nome: string;
  url: string;
  largura?: number;
  altura?: number;
  duracao?: number;
  picos?: number[];
  umaVez: boolean;
}

/** O estado que o banco conhece de um anexo: ver uma vez já aberto por mim, e se ainda há bytes. */
export interface EstadoDoAnexo {
  id: string;
  uma_vez: boolean;
  aberto: boolean;
  disponivel: boolean;
}

const LADO_MAXIMO = 2048;

const lerBytes = (arquivo: Blob) => arquivo.arrayBuffer().then((buffer) => new Uint8Array(buffer));

/** Redesenha a imagem: só os pontos passam (nada de local, aparelho ou autor embutidos) e ela sai menor. GIF fica como está, para não perder o movimento. */
async function limparImagem(bytes: Uint8Array<ArrayBuffer>, mime: string): Promise<{ bytes: Uint8Array<ArrayBuffer>; mime: string; largura: number; altura: number }> {
  const bitmap = await createImageBitmap(new Blob([bytes], { type: mime }));
  if (mime === "image/gif") {
    const saida = { bytes, mime, largura: bitmap.width, altura: bitmap.height };
    bitmap.close();
    return saida;
  }
  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const tela = document.createElement("canvas");
  tela.width = Math.max(1, Math.round(bitmap.width * escala));
  tela.height = Math.max(1, Math.round(bitmap.height * escala));
  const pincel = tela.getContext("2d");
  if (!pincel) throw new BackendError("arquivo_recusado");
  pincel.drawImage(bitmap, 0, 0, tela.width, tela.height);
  bitmap.close();
  return { ...(await telaParaBytes(tela)), largura: tela.width, altura: tela.height };
}

async function telaParaBytes(tela: HTMLCanvasElement): Promise<{ bytes: Uint8Array<ArrayBuffer>; mime: string }> {
  const gravar = (tipo: string, qualidade: number) => new Promise<Blob | null>((resolve) => tela.toBlob(resolve, tipo, qualidade));
  const webp = await gravar("image/webp", 0.85);
  const blob = webp?.type === "image/webp" ? webp : await gravar("image/jpeg", 0.88);
  if (!blob) throw new BackendError("arquivo_recusado");
  return { bytes: await lerBytes(blob), mime: blob.type };
}

/** Duração (e tamanho, no vídeo) lidos pelo próprio navegador. */
function medirMidia(url: string, tipo: "audio" | "video"): Promise<{ duracao?: number; largura?: number; altura?: number }> {
  return new Promise((resolve) => {
    const elemento = document.createElement(tipo);
    const fim = window.setTimeout(() => resolve({}), 4000);
    elemento.preload = "metadata";
    elemento.onloadedmetadata = () => {
      window.clearTimeout(fim);
      const duracao = Number.isFinite(elemento.duration) ? Math.round(elemento.duration * 100) / 100 : undefined;
      resolve(tipo === "video" ? { duracao, largura: (elemento as HTMLVideoElement).videoWidth, altura: (elemento as HTMLVideoElement).videoHeight } : { duracao });
    };
    elemento.onerror = () => { window.clearTimeout(fim); resolve({}); };
    elemento.src = url;
  });
}

/** A forma de onda, decodificando o áudio neste aparelho. Se o navegador não decodificar o formato, fica sem. */
async function picosDoAudio(bytes: Uint8Array<ArrayBuffer>): Promise<{ picos?: number[]; duracao?: number }> {
  try {
    const contexto = new AudioContext();
    const som = await contexto.decodeAudioData(bytes.slice().buffer);
    const picos = picosDe(som.getChannelData(0));
    void contexto.close();
    return { picos, duracao: Math.round(som.duration * 100) / 100 };
  } catch {
    return {};
  }
}

/** Confere e prepara os arquivos escolhidos (ou colados, ou arrastados). Recusa o que não entra, antes de qualquer envio. */
export async function preparar(arquivos: File[], jaTem: number): Promise<Preparado[]> {
  if (arquivos.length + jaTem > LIMITE_POR_MENSAGEM) throw new BackendError("anexos_demais");
  const saida: Preparado[] = [];
  for (const arquivo of arquivos) {
    if (arquivo.size > LIMITE_BYTES) throw new BackendError("arquivo_grande");
    let bytes = await lerBytes(arquivo);
    const achado = identificar(bytes, arquivo.type);
    if (!achado) throw new BackendError("arquivo_recusado");
    let { mime } = achado;
    const extra: Partial<Preparado> = {};
    if (achado.tipo === "imagem") {
      const limpa = await limparImagem(bytes, mime);
      bytes = limpa.bytes;
      mime = limpa.mime;
      extra.largura = limpa.largura;
      extra.altura = limpa.altura;
    }
    if (bytes.length > LIMITE_BYTES) throw new BackendError("arquivo_grande");
    const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    if (achado.tipo === "video") Object.assign(extra, await medirMidia(url, "video"));
    if (achado.tipo === "audio") Object.assign(extra, await medirMidia(url, "audio"), await picosDoAudio(bytes));
    const base = arquivo.name.replace(/\.[^.]+$/, "").replace(/[^\p{L}\p{N} _.-]/gu, "").trim().slice(0, 80) || achado.tipo;
    saida.push({ marca: crypto.randomUUID(), bytes, tipo: achado.tipo, mime, nome: `${base}.${extensaoDe(mime)}`, url, umaVez: false, ...extra });
  }
  return saida;
}

/** Cifra cada arquivo com a própria chave, sobe o cifrado e devolve o que vai dentro da mensagem. */
export async function subir(preparados: Preparado[], conversa: string, andamento?: (feitos: number) => void): Promise<Anexo[]> {
  const anexos: Anexo[] = [];
  for (const [indice, item] of preparados.entries()) {
    const selado = await cifrarArquivo(item.bytes, conversa);
    const { id } = await rpc<{ id: string }>("chat_anexo_enviar", { p_conversa: conversa, p_cifrado: paraBase64Comum(selado.cifrado), p_uma_vez: item.umaVez });
    const anexo: Anexo = { id, tipo: item.tipo, mime: item.mime, nome: item.nome, tamanho: item.bytes.length, chave: selado.chave, iv: selado.iv, hash: selado.hash };
    if (item.largura && item.altura) Object.assign(anexo, { largura: item.largura, altura: item.altura });
    if (item.duracao !== undefined) anexo.duracao = item.duracao;
    if (item.picos) anexo.picos = item.picos;
    if (item.umaVez) anexo.uma_vez = true;
    anexos.push(anexo);
    andamento?.(indice + 1);
  }
  return anexos;
}

export const soltar = (preparados: Preparado[]) => preparados.forEach((item) => URL.revokeObjectURL(item.url));

/** Encaminhar: baixa e abre cada arquivo, e cifra de novo com chave nova para a conversa de destino (a chave de uma conversa nunca vale em outra). */
export async function reenviar(anexos: Anexo[], de: string, para: string): Promise<Anexo[]> {
  const saida: Anexo[] = [];
  for (const anexo of anexos) {
    const { bytes } = await baixar(anexo, de);
    const selado = await cifrarArquivo(bytes, para);
    const { id } = await rpc<{ id: string }>("chat_anexo_enviar", { p_conversa: para, p_cifrado: paraBase64Comum(selado.cifrado), p_uma_vez: false });
    const { uma_vez: _umaVez, ...resto } = anexo;
    void _umaVez;
    saida.push({ ...resto, id, chave: selado.chave, iv: selado.iv, hash: selado.hash });
  }
  return saida;
}

// ───────────────────────────── Baixar e abrir ─────────────────────────────

/** O que já foi aberto neste aparelho, para não baixar de novo ao rolar a conversa. */
const abertos = new Map<string, { url: string; bytes: Uint8Array<ArrayBuffer> }>();
const GUARDADOS = 40;

async function baixar(anexo: Anexo, conversa: string): Promise<{ url: string; bytes: Uint8Array<ArrayBuffer> }> {
  const guardado = abertos.get(anexo.id);
  if (guardado) return guardado;
  const { cifrado } = await rpc<{ cifrado: string | null }>("chat_anexo_ler", { p_id: anexo.id });
  if (!cifrado) throw new BackendError("ja_visto");
  const bytes = await decifrarArquivo(deBase64Comum(cifrado), anexo, conversa);
  if (!bytes) throw new BackendError("arquivo_nao_abre");
  const aberto = { url: URL.createObjectURL(new Blob([bytes], { type: anexo.mime })), bytes };
  // Ver uma vez não fica guardado: fechou, acabou.
  if (!anexo.uma_vez) {
    if (abertos.size >= GUARDADOS) {
      const primeiro = abertos.keys().next().value;
      if (primeiro) { URL.revokeObjectURL(abertos.get(primeiro)!.url); abertos.delete(primeiro); }
    }
    abertos.set(anexo.id, aberto);
  }
  return aberto;
}

const duracaoLegivel = (segundos?: number) => (segundos === undefined ? "" : `${Math.floor(segundos / 60)}:${String(Math.floor(segundos % 60)).padStart(2, "0")}`);

const icone: Record<TipoDeAnexo, string> = { imagem: "🖼", video: "🎞", audio: "🎙", pdf: "📄", docx: "📝" };

/** Um arquivo recebido: baixa e abre ao aparecer (fotos, áudio, vídeo) ou quando a pessoa pede (documentos, ver uma vez). */
export function AnexoVisto({ anexo, estado, conversa, minha, aoAbrirGaleria }: { anexo: Anexo; estado?: EstadoDoAnexo; conversa: string; minha: boolean; aoAbrirGaleria?: () => void }) {
  const [aberto, setAberto] = useState<{ url: string; bytes: Uint8Array<ArrayBuffer> } | null>(() => abertos.get(anexo.id) ?? null);
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [janela, setJanela] = useState(false);
  const umaVez = Boolean(anexo.uma_vez);
  const automatico = !umaVez && (anexo.tipo === "imagem" || anexo.tipo === "audio" || anexo.tipo === "video");

  const abrir = useCallback(async () => {
    setOcupado(true);
    setAviso("");
    try {
      const resultado = await baixar(anexo, conversa);
      setAberto(resultado);
      if (umaVez || anexo.tipo === "pdf" || anexo.tipo === "docx") setJanela(true);
    } catch (erro) {
      setAviso(textoDoErro(erro));
    } finally {
      setOcupado(false);
    }
  }, [anexo, conversa, umaVez]);

  useEffect(() => {
    if (!automatico || aberto || ocupado || aviso) return;
    const marca = window.setTimeout(() => void abrir(), 0);
    return () => window.clearTimeout(marca);
    // Só ao aparecer: as dependências de estado deixariam o efeito repetir a cada mudança.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [automatico, anexo.id]);

  const fecharJanela = () => {
    setJanela(false);
    if (umaVez && aberto) { URL.revokeObjectURL(aberto.url); setAberto(null); }
  };

  const rodape = (
    <span className="block text-[0.7rem] opacity-70">
      {icone[anexo.tipo]} {anexo.nome} · {tamanhoLegivel(anexo.tamanho)}{anexo.duracao !== undefined ? ` · ${duracaoLegivel(anexo.duracao)}` : ""}
    </span>
  );

  if (umaVez) {
    const esgotado = minha || estado?.aberto || estado?.disponivel === false;
    return (
      <div className="my-1 border border-dashed border-current/40 px-2 py-1.5 text-sm">
        <p className="flex items-center gap-2">
          <span aria-hidden>{esgotado ? "◌" : "①"}</span>
          <span className="flex-1">{minha ? `${icone[anexo.tipo]} Enviado para ver uma vez` : esgotado ? `${icone[anexo.tipo]} Aberto (era para ver uma vez)` : `${icone[anexo.tipo]} ${anexo.tipo === "imagem" ? "Foto" : anexo.tipo === "video" ? "Vídeo" : "Arquivo"} para ver uma vez`}</span>
          {!esgotado && !janela && <button type="button" className={`${botaoClaro} px-2 py-0.5 text-xs`} disabled={ocupado} onClick={() => void abrir()}>{ocupado ? "Abrindo…" : "Abrir uma vez"}</button>}
        </p>
        {aviso && <Aviso texto={aviso} />}
        {janela && aberto && <Janela titulo="Ver uma vez: ao fechar, some deste aparelho" fechar={fecharJanela}><Conteudo anexo={anexo} url={aberto.url} bytes={aberto.bytes} /></Janela>}
      </div>
    );
  }

  if (anexo.tipo === "pdf" || anexo.tipo === "docx") {
    return (
      <div className="my-1 border border-current/30 px-2 py-1.5 text-sm">
        <p className="flex flex-wrap items-center gap-2">
          <span aria-hidden className="text-xl">{icone[anexo.tipo]}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{anexo.nome}</span>
            <span className="block text-[0.7rem] opacity-70">{anexo.tipo.toUpperCase()} · {tamanhoLegivel(anexo.tamanho)}</span>
          </span>
          <button type="button" className={`${botaoClaro} px-2 py-0.5 text-xs`} disabled={ocupado} onClick={() => (aberto ? setJanela(true) : void abrir())}>{ocupado ? "Abrindo…" : "Abrir"}</button>
          {aberto && <a href={aberto.url} download={anexo.nome} className={`${elo} text-xs`}>Baixar</a>}
        </p>
        {aviso && <Aviso texto={aviso} />}
        {janela && aberto && <Janela titulo={anexo.nome} fechar={() => setJanela(false)}><Conteudo anexo={anexo} url={aberto.url} bytes={aberto.bytes} /></Janela>}
      </div>
    );
  }

  if (!aberto) {
    return (
      <div className="my-1 text-sm">
        <p className="flex items-center gap-2">
          <span aria-hidden>{icone[anexo.tipo]}</span>
          <span className="flex-1 opacity-80">{aviso || (ocupado ? "Abrindo…" : "Arquivo")}</span>
          {aviso && <button type="button" className={`${elo} text-xs`} onClick={() => void abrir()}>Tentar de novo</button>}
        </p>
        {rodape}
      </div>
    );
  }

  if (anexo.tipo === "audio") return <div className="my-1"><Tocador url={aberto.url} picos={anexo.picos} duracao={anexo.duracao} />{rodape}</div>;
  if (anexo.tipo === "video") {
    return (
      <div className="my-1">
        <video src={aberto.url} controls playsInline preload="metadata" className="max-h-72 w-full bg-black" style={anexo.largura && anexo.altura ? { aspectRatio: `${anexo.largura} / ${anexo.altura}` } : undefined} />
        {rodape}
      </div>
    );
  }
  return (
    <div className="my-1">
      <button type="button" className="block cursor-pointer" onClick={() => (aoAbrirGaleria ? aoAbrirGaleria() : setJanela(true))} title="Abrir">
        {/* eslint-disable-next-line @next/next/no-img-element -- o endereço é um blob local, sem domínio para otimizar */}
        <img src={aberto.url} alt={anexo.nome} className="max-h-72 w-auto max-w-full" width={anexo.largura} height={anexo.altura} />
      </button>
      {rodape}
      {janela && <Janela titulo={anexo.nome} fechar={() => setJanela(false)}><Conteudo anexo={anexo} url={aberto.url} bytes={aberto.bytes} /></Janela>}
    </div>
  );
}

/** O conteúdo aberto, em tamanho grande: foto, vídeo, áudio, PDF (o leitor do navegador) ou DOCX (convertido aqui mesmo). */
function Conteudo({ anexo, url, bytes }: { anexo: Anexo; url: string; bytes: Uint8Array<ArrayBuffer> }) {
  const [docx, setDocx] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  useEffect(() => {
    if (anexo.tipo !== "docx") return;
    let cancelado = false;
    let urlLocal = "";
    (async () => {
      try {
        const mammoth = await import("mammoth");
        const { value } = await mammoth.convertToHtml({ arrayBuffer: bytes.slice().buffer });
        // O HTML vai para um quadro isolado (sandbox sem permissões): nada dele roda nem enxerga o painel.
        const pagina = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>body{font:16px/1.5 Georgia,serif;margin:1.5rem;color:#222;background:#fff}img{max-width:100%}table{border-collapse:collapse}td,th{border:1px solid #999;padding:.2rem .4rem}</style>${value}`;
        urlLocal = URL.createObjectURL(new Blob([pagina], { type: "text/html" }));
        if (!cancelado) setDocx(urlLocal);
      } catch {
        if (!cancelado) setAviso("Não foi possível converter este documento aqui. Baixe para abrir no seu programa.");
      }
    })();
    return () => { cancelado = true; if (urlLocal) URL.revokeObjectURL(urlLocal); };
  }, [anexo.tipo, bytes]);

  if (anexo.tipo === "imagem") {
    // eslint-disable-next-line @next/next/no-img-element -- blob local
    return <img src={url} alt={anexo.nome} className="mx-auto max-h-[80vh] max-w-full object-contain" />;
  }
  if (anexo.tipo === "video") return <video src={url} controls autoPlay playsInline className="mx-auto max-h-[80vh] max-w-full bg-black" />;
  if (anexo.tipo === "audio") return <Tocador url={url} picos={anexo.picos} duracao={anexo.duracao} grande />;
  if (anexo.tipo === "pdf") return <iframe src={url} title={anexo.nome} className="h-[80vh] w-full border border-rule bg-white" />;
  if (aviso) return <Aviso texto={aviso} />;
  if (!docx) return <p className="p-4 text-center text-ink-soft">Convertendo o documento neste aparelho…</p>;
  return <iframe src={docx} sandbox="" title={anexo.nome} className="h-[80vh] w-full border border-rule bg-white" />;
}

/** Uma janela por cima da conversa. */
export function Janela({ titulo, fechar, children }: { titulo: string; fechar: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") fechar(); };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [fechar]);
  return (
    <div role="dialog" aria-modal="true" aria-label={titulo} className="fixed inset-0 z-50 flex flex-col bg-ink/95 p-3 text-parchment">
      <div className="flex items-center justify-between gap-3 pb-2">
        <p className="truncate font-semibold">{titulo}</p>
        <button type="button" className="cursor-pointer px-2 text-2xl leading-none" aria-label="Fechar" onClick={fechar}>×</button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}

// ───────────────────────────── Áudio: tocar e gravar ─────────────────────────────

const velocidades = [1, 1.5, 2];

/** Toca um áudio com a forma de onda (dá para tocar nela para pular), e em 1×, 1,5× ou 2×. */
export function Tocador({ url, picos, duracao, grande = false }: { url: string; picos?: number[]; duracao?: number; grande?: boolean }) {
  const som = useRef<HTMLAudioElement>(null);
  const [tocando, setTocando] = useState(false);
  const [posicao, setPosicao] = useState(0);
  const [total, setTotal] = useState(duracao ?? 0);
  const [velocidade, setVelocidade] = useState(1);
  const barras = picos && picos.length ? picos : Array.from({ length: 48 }, () => 30);
  const fracao = total > 0 ? Math.min(1, posicao / total) : 0;

  function alternar() {
    const elemento = som.current;
    if (!elemento) return;
    if (elemento.paused) void elemento.play();
    else elemento.pause();
  }
  function pular(e: React.MouseEvent<HTMLButtonElement>) {
    const elemento = som.current;
    if (!elemento || !total) return;
    const caixa = e.currentTarget.getBoundingClientRect();
    elemento.currentTime = Math.max(0, Math.min(total, ((e.clientX - caixa.left) / caixa.width) * total));
  }
  function trocarVelocidade() {
    const proxima = velocidades[(velocidades.indexOf(velocidade) + 1) % velocidades.length];
    setVelocidade(proxima);
    if (som.current) som.current.playbackRate = proxima;
  }

  return (
    <div className={`flex items-center gap-2 ${grande ? "mx-auto max-w-xl py-10" : ""}`}>
      <audio
        ref={som}
        src={url}
        preload="metadata"
        onPlay={() => setTocando(true)}
        onPause={() => setTocando(false)}
        onEnded={() => { setTocando(false); setPosicao(0); }}
        onTimeUpdate={(e) => setPosicao(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => { if (Number.isFinite(e.currentTarget.duration)) setTotal(e.currentTarget.duration); e.currentTarget.playbackRate = velocidade; }}
      />
      <button type="button" className="h-9 w-9 shrink-0 cursor-pointer rounded-full border border-current text-base" aria-label={tocando ? "Pausar" : "Tocar"} onClick={alternar}>{tocando ? "❚❚" : "▶"}</button>
      <button type="button" className="flex h-9 min-w-32 flex-1 cursor-pointer items-end gap-px" aria-label="Pular para um ponto do áudio" onClick={pular}>
        {barras.map((pico, i) => (
          <span key={i} className={`flex-1 ${i / barras.length <= fracao ? "bg-current" : "bg-current opacity-30"}`} style={{ height: `${Math.max(8, pico)}%` }} />
        ))}
      </button>
      <span className="w-10 shrink-0 text-right font-mono text-[0.7rem]">{duracaoLegivel(tocando || posicao > 0 ? posicao : total)}</span>
      <button type="button" className="shrink-0 cursor-pointer border border-current px-1.5 font-mono text-[0.7rem]" aria-label={`Velocidade ${velocidade}×`} onClick={trocarVelocidade}>{velocidade}×</button>
    </div>
  );
}

/**
 * Gravar áudio: segure o botão para gravar e solte para enviar; "Travar" deixa gravar sem segurar e mostra "Parar".
 * Depois de parar, dá para ouvir antes de enviar ou descartar. Nada sai do aparelho até "Enviar".
 */
export function Gravador({ aoGravar, aoAvisar, fechar }: { aoGravar: (preparado: Preparado) => void; aoAvisar: (tipo: "audio" | "") => void; fechar: () => void }) {
  const gravador = useRef<MediaRecorder | null>(null);
  const pedacos = useRef<Blob[]>([]);
  const inicio = useRef(0);
  const [fase, setFase] = useState<"pronto" | "gravando" | "travado" | "ouvindo" | "preparando">("pronto");
  const [segundos, setSegundos] = useState(0);
  const [pronto, setPronto] = useState<Preparado | null>(null);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    if (fase !== "gravando" && fase !== "travado") return;
    const relogio = window.setInterval(() => setSegundos(Math.round((Date.now() - inicio.current) / 1000)), 500);
    return () => window.clearInterval(relogio);
  }, [fase]);

  useEffect(() => () => { gravador.current?.stream.getTracks().forEach((faixa) => faixa.stop()); }, []);

  async function comecar() {
    if (gravador.current) return;
    setAviso("");
    try {
      const fluxo = await navigator.mediaDevices.getUserMedia({ audio: true });
      const tipo = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"].find((candidato) => MediaRecorder.isTypeSupported(candidato));
      const atual = new MediaRecorder(fluxo, tipo ? { mimeType: tipo } : undefined);
      pedacos.current = [];
      atual.ondataavailable = (e) => { if (e.data.size) pedacos.current.push(e.data); };
      atual.onstop = () => {
        fluxo.getTracks().forEach((faixa) => faixa.stop());
        gravador.current = null;
        aoAvisar("");
        void terminar(new Blob(pedacos.current, { type: atual.mimeType || "audio/webm" }));
      };
      atual.onstart = () => { inicio.current = Date.now(); };
      gravador.current = atual;
      setSegundos(0);
      atual.start(250);
      setFase("gravando");
      aoAvisar("audio");
    } catch {
      setAviso("Não foi possível usar o microfone. Confira a permissão do navegador.");
    }
  }

  function parar() {
    const atual = gravador.current;
    if (!atual || atual.state === "inactive") return;
    setFase("preparando");
    atual.stop();
  }

  async function terminar(blob: Blob) {
    if (blob.size < 1000 || Date.now() - inicio.current < 700) {
      setFase("pronto");
      setAviso("Gravação curta demais. Segure o botão enquanto fala.");
      return;
    }
    try {
      const [preparado] = await preparar([new File([blob], `audio.${extensaoDe(blob.type.split(";")[0])}`, { type: blob.type.split(";")[0] })], 0);
      setPronto(preparado);
      setFase("ouvindo");
    } catch (erro) {
      setFase("pronto");
      setAviso(textoDoErro(erro));
    }
  }

  function enviar() {
    if (!pronto) return;
    aoGravar(pronto);
    setPronto(null);
    fechar();
  }
  function descartar() {
    if (pronto) URL.revokeObjectURL(pronto.url);
    setPronto(null);
    setFase("pronto");
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-rule bg-parchment px-3 py-2 text-sm">
      {fase === "ouvindo" && pronto ? (
        <>
          <div className="min-w-48 flex-1"><Tocador url={pronto.url} picos={pronto.picos} duracao={pronto.duracao} /></div>
          <button type="button" className={botao} onClick={enviar}>Enviar áudio</button>
          <button type="button" className={elo} onClick={descartar}>Descartar</button>
        </>
      ) : (
        <>
          <button
            type="button"
            className={`${botao} select-none touch-none ${fase === "gravando" || fase === "travado" ? "bg-oxblood" : ""}`}
            aria-pressed={fase === "gravando" || fase === "travado"}
            disabled={fase === "preparando"}
            onPointerDown={(e) => { if (fase === "pronto") { e.currentTarget.setPointerCapture(e.pointerId); void comecar(); } }}
            onPointerUp={() => { if (fase === "gravando") parar(); }}
            onPointerCancel={() => { if (fase === "gravando") parar(); }}
            onClick={() => { if (fase === "travado") parar(); }}
            onKeyDown={(e) => { if ((e.key === " " || e.key === "Enter") && fase === "pronto") { e.preventDefault(); void comecar().then(() => setFase("travado")); } }}
          >
            {fase === "pronto" ? "🎙 Segure para gravar" : fase === "travado" ? "■ Parar" : fase === "preparando" ? "Preparando…" : "● Gravando… solte para parar"}
          </button>
          {(fase === "gravando" || fase === "travado") && <span className="font-mono" aria-live="polite">{duracaoLegivel(segundos)}</span>}
          {fase === "gravando" && <button type="button" className={botaoClaro} onPointerDown={(e) => e.preventDefault()} onPointerUp={() => setFase("travado")}>🔒 Travar</button>}
          {fase === "pronto" && <button type="button" className={elo} onClick={fechar}>Cancelar</button>}
          <span className="basis-full text-xs text-ink-soft">A gravação fica neste aparelho até você enviar. Sem transcrição: nenhum serviço de fora ouve o áudio.</span>
        </>
      )}
      {aviso && <Aviso texto={aviso} />}
    </div>
  );
}

// ───────────────────────────── Antes de enviar ─────────────────────────────

/** Os arquivos escolhidos, antes do envio: miniatura, nome, tirar, "ver uma vez" e editar a foto. */
export function Preparados({ itens, mudar }: { itens: Preparado[]; mudar: (itens: Preparado[]) => void }) {
  const [editando, setEditando] = useState<Preparado | null>(null);
  if (itens.length === 0) return null;
  const tirar = (marca: string) => { const item = itens.find((x) => x.marca === marca); if (item) URL.revokeObjectURL(item.url); mudar(itens.filter((x) => x.marca !== marca)); };
  const trocar = (novo: Preparado) => mudar(itens.map((x) => (x.marca === novo.marca ? novo : x)));
  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {itens.map((item) => (
        <div key={item.marca} className="relative w-36 border border-rule bg-parchment p-1 text-xs">
          {item.tipo === "imagem" ? (
            // eslint-disable-next-line @next/next/no-img-element -- blob local
            <img src={item.url} alt="" className="h-20 w-full object-cover" />
          ) : item.tipo === "video" ? (
            <video src={item.url} muted playsInline preload="metadata" className="h-20 w-full bg-black object-cover" />
          ) : (
            <p className="flex h-20 items-center justify-center text-3xl">{icone[item.tipo]}</p>
          )}
          <p className="mt-1 truncate font-semibold" title={item.nome}>{item.nome}</p>
          <p className="text-ink-soft">{tamanhoLegivel(item.bytes.length)}{item.duracao !== undefined ? ` · ${duracaoLegivel(item.duracao)}` : ""}</p>
          {(item.tipo === "imagem" || item.tipo === "video") && (
            <label className="mt-1 flex cursor-pointer items-center gap-1">
              <input type="checkbox" checked={item.umaVez} onChange={(e) => trocar({ ...item, umaVez: e.target.checked })} /> ver uma vez
            </label>
          )}
          <p className="mt-1 flex gap-2">
            {item.tipo === "imagem" && item.mime !== "image/gif" && <button type="button" className={elo} onClick={() => setEditando(item)}>Editar</button>}
            <button type="button" className={`${elo} text-oxblood`} onClick={() => tirar(item.marca)}>Tirar</button>
          </p>
        </div>
      ))}
      {editando && <EditorDeImagem item={editando} fechar={() => setEditando(null)} pronto={(novo) => { trocar(novo); setEditando(null); }} />}
    </div>
  );
}

type Ferramenta = "cortar" | "desenhar" | "borrar";

/** Cortar, desenhar por cima e borrar um trecho (um rosto, um documento) antes de enviar. Tudo no canvas, neste aparelho. */
function EditorDeImagem({ item, fechar, pronto }: { item: Preparado; fechar: () => void; pronto: (novo: Preparado) => void }) {
  const tela = useRef<HTMLCanvasElement>(null);
  const [ferramenta, setFerramenta] = useState<Ferramenta>("desenhar");
  const [cor, setCor] = useState("#8b1a1a");
  const [selecao, setSelecao] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [historico, setHistorico] = useState<ImageData[]>([]);
  const [dimensao, setDimensao] = useState({ largura: 1, altura: 1 });
  const desenhando = useRef(false);
  const ultimo = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const bitmap = await createImageBitmap(new Blob([item.bytes], { type: item.mime }));
      const atual = tela.current;
      if (cancelado || !atual) return;
      atual.width = bitmap.width;
      atual.height = bitmap.height;
      atual.getContext("2d")?.drawImage(bitmap, 0, 0);
      setDimensao({ largura: bitmap.width, altura: bitmap.height });
      bitmap.close();
    })();
    return () => { cancelado = true; };
  }, [item]);

  const ponto = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const atual = e.currentTarget;
    const caixa = atual.getBoundingClientRect();
    return { x: ((e.clientX - caixa.left) / caixa.width) * atual.width, y: ((e.clientY - caixa.top) / caixa.height) * atual.height };
  };
  const guardar = () => {
    const atual = tela.current;
    const pincel = atual?.getContext("2d");
    if (atual && pincel) setHistorico((lista) => [...lista.slice(-9), pincel.getImageData(0, 0, atual.width, atual.height)]);
  };
  const desfazer = () => {
    const anterior = historico.at(-1);
    const atual = tela.current;
    if (!anterior || !atual) return;
    atual.width = anterior.width;
    atual.height = anterior.height;
    atual.getContext("2d")?.putImageData(anterior, 0, 0);
    setDimensao({ largura: anterior.width, altura: anterior.height });
    setHistorico((lista) => lista.slice(0, -1));
    setSelecao(null);
  };

  function comecar(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = ponto(e);
    desenhando.current = true;
    if (ferramenta === "desenhar") {
      guardar();
      ultimo.current = p;
    } else {
      setSelecao({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
    }
  }
  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!desenhando.current) return;
    const p = ponto(e);
    if (ferramenta === "desenhar") {
      const pincel = tela.current?.getContext("2d");
      if (pincel && ultimo.current) {
        pincel.strokeStyle = cor;
        pincel.lineWidth = Math.max(4, tela.current!.width / 150);
        pincel.lineCap = "round";
        pincel.beginPath();
        pincel.moveTo(ultimo.current.x, ultimo.current.y);
        pincel.lineTo(p.x, p.y);
        pincel.stroke();
      }
      ultimo.current = p;
    } else {
      setSelecao((atual) => (atual ? { ...atual, x1: p.x, y1: p.y } : atual));
    }
  }
  function soltar() {
    desenhando.current = false;
    ultimo.current = null;
  }
  const retangulo = () => {
    if (!selecao) return null;
    const x = Math.round(Math.min(selecao.x0, selecao.x1));
    const y = Math.round(Math.min(selecao.y0, selecao.y1));
    const largura = Math.round(Math.abs(selecao.x1 - selecao.x0));
    const altura = Math.round(Math.abs(selecao.y1 - selecao.y0));
    return largura >= 8 && altura >= 8 ? { x, y, largura, altura } : null;
  };
  function aplicarSelecao() {
    const atual = tela.current;
    const pincel = atual?.getContext("2d");
    const r = retangulo();
    if (!atual || !pincel || !r) return;
    guardar();
    if (ferramenta === "cortar") {
      const corte = pincel.getImageData(r.x, r.y, r.largura, r.altura);
      atual.width = r.largura;
      atual.height = r.altura;
      pincel.putImageData(corte, 0, 0);
      setDimensao({ largura: r.largura, altura: r.altura });
    } else {
      // Borrar de verdade: reduz o trecho a poucos blocos e amplia de volta, sem suavizar. O que estava ali não volta.
      const bloco = Math.max(12, Math.round(Math.max(r.largura, r.altura) / 8));
      const pequena = document.createElement("canvas");
      pequena.width = Math.max(1, Math.round(r.largura / bloco));
      pequena.height = Math.max(1, Math.round(r.altura / bloco));
      const p = pequena.getContext("2d")!;
      p.imageSmoothingEnabled = true;
      p.drawImage(atual, r.x, r.y, r.largura, r.altura, 0, 0, pequena.width, pequena.height);
      pincel.imageSmoothingEnabled = false;
      pincel.drawImage(pequena, 0, 0, pequena.width, pequena.height, r.x, r.y, r.largura, r.altura);
      pincel.imageSmoothingEnabled = true;
    }
    setSelecao(null);
  }
  async function concluir() {
    const atual = tela.current;
    if (!atual) return;
    const { bytes, mime } = await telaParaBytes(atual);
    URL.revokeObjectURL(item.url);
    pronto({ ...item, bytes, mime, nome: item.nome.replace(/\.[^.]+$/, `.${extensaoDe(mime)}`), url: URL.createObjectURL(new Blob([bytes], { type: mime })), largura: atual.width, altura: atual.height });
  }
  const r = retangulo();

  return (
    <Janela titulo="Editar a foto antes de enviar" fechar={fechar}>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        {(["desenhar", "cortar", "borrar"] as Ferramenta[]).map((f) => (
          <button key={f} type="button" className={`${botaoClaro} px-2 py-1 text-parchment ${ferramenta === f ? "bg-parchment/20" : ""}`} aria-pressed={ferramenta === f} onClick={() => { setFerramenta(f); setSelecao(null); }}>
            {f === "desenhar" ? "✎ Desenhar" : f === "cortar" ? "⌗ Cortar" : "▦ Borrar"}
          </button>
        ))}
        {ferramenta === "desenhar" && <input type="color" value={cor} onChange={(e) => setCor(e.target.value)} aria-label="Cor do traço" className="h-8 w-10 cursor-pointer" />}
        {ferramenta !== "desenhar" && <button type="button" className={`${botaoClaro} px-2 py-1 text-parchment`} disabled={!r} onClick={aplicarSelecao}>{ferramenta === "cortar" ? "Cortar o trecho marcado" : "Borrar o trecho marcado"}</button>}
        <button type="button" className={`${botaoClaro} px-2 py-1 text-parchment`} disabled={historico.length === 0} onClick={desfazer}>↶ Desfazer</button>
        <span className="flex-1" />
        <button type="button" className={botao} onClick={() => void concluir()}>Pronto</button>
      </div>
      <p className="mb-2 text-xs opacity-80">{ferramenta === "desenhar" ? "Arraste para desenhar por cima." : "Arraste para marcar um trecho, depois aplique."}</p>
      <div className="relative inline-block max-w-full">
        <canvas ref={tela} className="max-h-[70vh] max-w-full cursor-crosshair touch-none bg-black" onPointerDown={comecar} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar} />
        {r && <div className="pointer-events-none absolute border-2 border-dashed border-gold bg-gold/10" style={{ left: `${(r.x / dimensao.largura) * 100}%`, top: `${(r.y / dimensao.altura) * 100}%`, width: `${(r.largura / dimensao.largura) * 100}%`, height: `${(r.altura / dimensao.altura) * 100}%` }} />}
      </div>
    </Janela>
  );
}

// ───────────────────────────── Galeria ─────────────────────────────

export interface ItemDaGaleria {
  mensagem: string;
  anexo: Anexo;
  estado?: EstadoDoAnexo;
  autor: string;
  minha: boolean;
  quando: string;
}

/** Tudo o que já foi trocado numa conversa: fotos e vídeos em grade, áudios e documentos em lista. */
export function Galeria({ itens, conversa, fechar, irPara }: { itens: ItemDaGaleria[]; conversa: string; fechar: () => void; irPara: (mensagem: string) => void }) {
  const [aba, setAba] = useState<"midia" | "documentos" | "audios">("midia");
  const filtro = { midia: ["imagem", "video"], documentos: ["pdf", "docx"], audios: ["audio"] }[aba];
  const lista = itens.filter((item) => filtro.includes(item.anexo.tipo) && !item.anexo.uma_vez);
  return (
    <Janela titulo="Arquivos desta conversa" fechar={fechar}>
      <div className="mb-3 flex gap-2 text-sm">
        {(["midia", "documentos", "audios"] as const).map((nome) => (
          <button key={nome} type="button" className={`${botaoClaro} px-2 py-1 text-parchment ${aba === nome ? "bg-parchment/20" : ""}`} aria-pressed={aba === nome} onClick={() => setAba(nome)}>
            {nome === "midia" ? "Fotos e vídeos" : nome === "documentos" ? "Documentos" : "Áudios"}
          </button>
        ))}
      </div>
      {lista.length === 0 && <p className="py-10 text-center opacity-70">Nada aqui ainda. (Arquivos para ver uma vez não entram na galeria.)</p>}
      <ul className={aba === "midia" ? "grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4" : "space-y-2"}>
        {lista.map((item) => (
          <li key={item.anexo.id} className="border border-parchment/30 p-1">
            <AnexoVisto anexo={item.anexo} estado={item.estado} conversa={conversa} minha={item.minha} />
            <p className="flex justify-between gap-2 text-[0.7rem] opacity-80">
              <span className="truncate">{item.minha ? "Você" : item.autor} · {item.quando}</span>
              <button type="button" className="cursor-pointer underline" onClick={() => { fechar(); irPara(item.mensagem); }}>ir à mensagem</button>
            </p>
          </li>
        ))}
      </ul>
    </Janela>
  );
}
