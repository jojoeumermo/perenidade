// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Áudio e vídeo curto no chat a dois (Prompt 4, itens 137 e 138), atrás de "alumia-p4-anexo-cifrado". Documento:
// docs/rede/CHAT-PRIVADO.md ("Áudio e vídeo").
//   - Gravar áudio: o gravador do navegador (MediaRecorder), só no aparelho, até 60 s (para sozinho). Nenhum reconhecimento de fala.
//   - Vídeo curto: um arquivo MP4 ou WebM de até 1 minuto e 10 MB; antes de cifrar, as caixas de metadado (lugar, câmera, data) são
//     neutralizadas NO APARELHO (lib/rede/midia/limpar-video.ts, a mesma limpeza do vídeo do post).
//   - Mandar: cifra no aparelho, sobe só o cifrado (sem sessão, com passe anônimo) e manda a chave e o endereço dentro da mensagem
//     cifrada (lib/rede/chat-chaveiro.ts, enviarAnexo).
//   - Na mensagem: nada é baixado sozinho; ao tocar em "Ouvir" ou "Ver vídeo", baixa o cifrado, confere, abre neste aparelho e toca
//     por um endereço blob: (solto ao sair). "Ver uma vez": abre, apaga daqui e pede ao depósito que apague.
//   - Foto de ver uma vez (Prompt 4, item 13, com "alumia-p4-conversa"): refeita NO APARELHO no canvas (lib/rede/stories/imagem.ts:
//     sai sem lugar, câmera nem data), sempre "ver uma vez", e aberta dentro da proteção contra print do item 1
//     (components/rede/presenca/ConteudoProtegido.tsx), com a marca d'água do codinome de quem lê. O vídeo de ver uma vez também.
// Alvos de toque de 44 px; sem animação (o contador do gravador é texto, atualizado a cada segundo).
import { useEffect, useRef, useState } from "react";
import { abrirAnexoDaMensagem, enviarAnexo, type OpcoesDaMensagem, type Sessao, tirarAnexoDoDeposito } from "@/lib/rede/chat-chaveiro";
import type { CorpoDeAnexo } from "@/lib/rede/chat/anexo-cifrado";
import { TETOS } from "@/lib/rede/chat/anexo-cifrado";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDoAnexo } from "@/lib/rede/textos-chat-anexo";
import { botaoLeve } from "./comum";
import { ConteudoProtegido } from "../presenca/ConteudoProtegido";
import { ditadoNoAparelho, ditarAudio } from "@/lib/rede/midia/reconhecer";

/** Os textos da foto de ver uma vez (i18n/rede/p4-conversa, "foto"). */
export interface TextosDaFoto {
  botao: string;
  explica: string;
  rotulo: string;
  abrir: string;
  escondido: string;
  aviso: string;
  invalida: string;
}

/** Os textos da transcrição da nota de voz no aparelho (i18n/rede/p4-conversa, "transcrever"; item 21). */
export interface TextosDaTranscricao {
  botao: string;
  ouvindo: string;
  rotulo: string;
  aviso: string;
  vazia: string;
  falhou: string;
}

/**
 * A transcrição de uma nota de voz NO APARELHO (Prompt 4, item 21, com "alumia-p4-conversa"): pelo reconhecedor do navegador só no
 * modo local, com o idioma já instalado (lib/rede/midia/reconhecer.ts, a mesma conferência das legendas dos stories). Sem isso, o
 * botão nem aparece (a transcrição fica para os apps). O áudio toca escondido a partir do endereço blob: deste aparelho; o texto fica
 * só nesta tela (não vai ao histórico, a ninguém nem ao servidor) e some ao sair.
 */
function TranscricaoNoAparelho({ t, url, lang }: { t: TextosDaTranscricao; url: string; lang: string }) {
  const [pode, setPode] = useState(false);
  const [estado, setEstado] = useState<"parado" | "ouvindo" | "pronto" | "falhou">("parado");
  const [texto, setTexto] = useState("");
  const parar = useRef<(() => void) | null>(null);
  useEffect(() => {
    let vivo = true;
    void ditadoNoAparelho(lang).then((sim) => vivo && setPode(sim), () => undefined);
    return () => {
      vivo = false;
      parar.current?.();
    };
  }, [lang]);
  if (!pode) return null;
  function transcrever() {
    setTexto("");
    setEstado("ouvindo");
    parar.current = ditarAudio(url, lang, setTexto, (erro) => {
      parar.current = null;
      setEstado(erro ? "falhou" : "pronto");
    });
  }
  return (
    <div className="flex flex-col gap-1 text-xs" data-transcricao>
      {estado === "parado" || estado === "falhou" ? (
        <button type="button" className="inline-flex min-h-11 items-center self-start underline" onClick={transcrever}>{t.botao}</button>
      ) : null}
      {estado === "ouvindo" && <p role="status">{t.ouvindo}</p>}
      {estado === "falhou" && <p role="alert">{t.falhou}</p>}
      {(estado === "pronto" || (estado === "ouvindo" && texto)) && (
        <figure className="rounded-md border border-rule px-2 py-1">
          <figcaption className="font-semibold">{t.rotulo}</figcaption>
          <p className="whitespace-pre-wrap break-words text-sm">{texto || t.vazia}</p>
          <p className="opacity-80">{t.aviso}</p>
        </figure>
      )}
    </div>
  );
}

const codigo = (e: unknown) => String((e as { code?: unknown })?.code ?? (e as Error)?.message ?? "");

/** O erro de envio como frase da tela. */
export function erroDoAnexo(t: TextosDoAnexo, e: unknown): string {
  const c = codigo(e);
  if (c === "anexo_longo") return t.longo;
  if (c === "anexo_grande") return t.grande;
  if (c === "anexo_tipo" || c === "anexo_metadado") return t.tipo;
  if (c === "sem_passes" || c === "passe") return t.semPasses;
  if (c === "anexo_desligado") return t.desligado;
  return t.erro;
}

/** O melhor formato que o gravador deste navegador faz (Opus em WebM, Ogg ou MP4). */
function formatoDoGravador(): string {
  const M = typeof MediaRecorder === "undefined" ? null : MediaRecorder;
  for (const f of ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"]) if (M?.isTypeSupported?.(f)) return f;
  return "";
}

/**
 * A duração de um vídeo, lida NO APARELHO pelos metadados (um <video> fora da tela, com endereço blob: solto em seguida). NaN se o
 * navegador não consegue ler (não é vídeo). O WebM de gravador às vezes diz "duração infinita": aí pula para o fim, e a duração certa
 * aparece. Teto de 8 s para responder.
 */
function duracaoDoVideo(arquivo: Blob): Promise<number> {
  return new Promise((resolver) => {
    const v = document.createElement("video");
    const url = URL.createObjectURL(arquivo);
    let pronto = false;
    const fim = (ms: number) => {
      if (pronto) return;
      pronto = true;
      clearTimeout(teto);
      URL.revokeObjectURL(url);
      v.removeAttribute("src");
      resolver(ms);
    };
    const teto = setTimeout(() => fim(Number.NaN), 8000);
    const ler = () => {
      if (Number.isFinite(v.duration) && v.duration > 0) fim(Math.round(v.duration * 1000));
    };
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () => {
      if (v.duration === Number.POSITIVE_INFINITY) {
        v.ondurationchange = ler;
        v.currentTime = 1e101;
      } else if (Number.isFinite(v.duration) && v.duration > 0) ler();
      else fim(Number.NaN);
    };
    v.onerror = () => fim(Number.NaN);
    v.src = url;
  });
}

/** Os botões do compositor: gravar áudio e escolher um vídeo curto. */
export function AnexoNoCompositor({ t, sessao = null, enviar = null, opcoes, desligado, aoEnviado, aoErro, foto = null }: {
  t: TextosDoAnexo;
  /** A foto de ver uma vez (item 13): só com "alumia-p4-conversa" ligado. */
  foto?: TextosDaFoto | null;
  /** A conversa a dois (manda por enviarAnexo), ou, na conversa em grupo, `enviar` (o mesmo anexo cifrado, pelo grupo). */
  sessao?: Sessao | null;
  enviar?: ((arquivo: Uint8Array<ArrayBuffer>, mime: string, duracaoMs: number, opcoes: OpcoesDaMensagem) => Promise<void>) | null;
  opcoes: () => OpcoesDaMensagem;
  desligado: boolean;
  aoEnviado: () => void;
  aoErro: (frase: string) => void;
}) {
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const gravador = useRef<MediaRecorder | null>(null);
  const partes = useRef<Blob[]>([]);
  const inicio = useRef(0);
  const cancelado = useRef(false);
  const relogio = useRef<ReturnType<typeof setInterval> | null>(null);
  const arquivo = useRef<HTMLInputElement>(null);
  const imagem = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      // Saiu da conversa no meio da gravação: para o microfone e não manda nada.
      cancelado.current = true;
      if (relogio.current) clearInterval(relogio.current);
      if (gravador.current?.state === "recording") gravador.current.stop();
    },
    [],
  );

  async function mandar(bytes: Uint8Array<ArrayBuffer>, mime: string, duracaoMs: number, umaVez = false) {
    setEnviando(true);
    try {
      const o = umaVez ? { ...opcoes(), umaVez: true } : opcoes();
      if (enviar) await enviar(bytes, mime, duracaoMs, o);
      else if (sessao) await enviarAnexo(sessao, bytes, mime, duracaoMs, o);
      aoEnviado();
    } catch (e) {
      aoErro(erroDoAnexo(t, e));
    } finally {
      setEnviando(false);
    }
  }

  async function gravar() {
    aoErro("");
    let fluxo: MediaStream;
    try {
      fluxo = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      aoErro(t.semMicrofone);
      return;
    }
    const formato = formatoDoGravador();
    const g = new MediaRecorder(fluxo, formato ? { mimeType: formato } : undefined);
    partes.current = [];
    cancelado.current = false;
    g.ondataavailable = (e) => {
      if (e.data.size) partes.current.push(e.data);
    };
    g.onstop = () => {
      fluxo.getTracks().forEach((faixa) => faixa.stop());
      if (relogio.current) clearInterval(relogio.current);
      setGravando(false);
      const ms = Math.min(Math.round(performance.now() - inicio.current), TETOS.audio.segundos * 1000);
      if (cancelado.current || partes.current.length === 0) return;
      const mime = g.mimeType || formato || "audio/webm";
      void new Blob(partes.current, { type: mime }).arrayBuffer().then((b) => mandar(new Uint8Array(b), mime, ms));
    };
    gravador.current = g;
    inicio.current = performance.now();
    setSegundos(0);
    setGravando(true);
    g.start(1000);
    relogio.current = setInterval(() => {
      const s = Math.floor((performance.now() - inicio.current) / 1000);
      setSegundos(s);
      if (s >= TETOS.audio.segundos && g.state === "recording") g.stop();
    }, 1000);
  }

  function parar(cancelar: boolean) {
    cancelado.current = cancelar;
    if (gravador.current?.state === "recording") gravador.current.stop();
  }

  async function escolheu(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    aoErro("");
    if (f.size > TETOS.video.bytes) return aoErro(t.grande);
    const ms = await duracaoDoVideo(f);
    if (!Number.isFinite(ms)) return aoErro(t.tipo);
    if (ms > TETOS.video.segundos * 1000) return aoErro(t.longo);
    const { limparVideo } = await import("@/lib/rede/midia/limpar-video");
    const limpo = limparVideo(new Uint8Array(await f.arrayBuffer()));
    if (!limpo) return aoErro(t.tipo);
    await mandar(new Uint8Array(limpo.bytes), limpo.tipo.tipo, ms);
  }

  /** A foto (item 13): refeita no canvas DESTE aparelho (o arquivo original, com EXIF e GPS, nunca sai daqui), sempre ver uma vez. */
  async function escolheuFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !foto) return;
    aoErro("");
    let refeita: Blob;
    try {
      const { refazerImagem } = await import("@/lib/rede/stories/imagem");
      refeita = await refazerImagem(f);
    } catch (erro) {
      return aoErro(codigo(erro) === "grande" ? t.grande : foto.invalida);
    }
    if (refeita.size > TETOS.imagem.bytes) return aoErro(t.grande);
    await mandar(new Uint8Array(await refeita.arrayBuffer()), refeita.type || "image/webp", 0, true);
  }

  if (gravando)
    return (
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t.gravar}>
        <p className="text-xs font-semibold" role="status" aria-live="polite">{preencher(t.gravando, { s: segundos })}</p>
        <button type="button" className={botaoLeve} onClick={() => parar(false)}>{t.parar}</button>
        <button type="button" className="inline-flex min-h-11 items-center px-2 text-xs underline" onClick={() => parar(true)}>{t.cancelar}</button>
      </div>
    );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={botaoLeve} disabled={desligado || enviando} onClick={() => void gravar()} data-anexo="gravar">
        {t.gravar}
      </button>
      <button type="button" className={botaoLeve} disabled={desligado || enviando} onClick={() => arquivo.current?.click()} title={t.videoExplica} data-anexo="video">
        {t.video}
      </button>
      <input ref={arquivo} type="file" accept="video/mp4,video/webm" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void escolheu(e)} />
      {foto && (
        <>
          <button type="button" className={botaoLeve} disabled={desligado || enviando} onClick={() => imagem.current?.click()} title={foto.explica} data-anexo="foto">
            {foto.botao}
          </button>
          <input ref={imagem} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void escolheuFoto(e)} />
        </>
      )}
      {enviando && <p className="text-xs" role="status">{t.enviando}</p>}
    </div>
  );
}

/** O anexo dentro da bolha da mensagem: só baixa e abre quando a pessoa toca. */
export function AnexoNaMensagem({ t, sessao = null, abrirCorpo = null, corpo, minha, aoAbrirUmaVez, aoFecharUmaVez, foto = null, marca = "", transcrever = null, lang = "pt" }: {
  t: TextosDoAnexo;
  /** Os textos da transcrição no aparelho (item 21). Sem eles (flag desligada), nada de transcrição. */
  transcrever?: TextosDaTranscricao | null;
  /** O idioma da tela: o da transcrição. */
  lang?: string;
  /** Os textos da foto de ver uma vez e da proteção (item 13). Sem eles, a foto aparece como "não está mais aqui". */
  foto?: TextosDaFoto | null;
  /** O codinome de quem lê: a marca d'água da proteção contra print (item 1). */
  marca?: string;
  /** A conversa a dois (abre por abrirAnexoDaMensagem), ou, na conversa em grupo, `abrirCorpo` (o mesmo anexo, preso ao grupo). */
  sessao?: Sessao | null;
  abrirCorpo?: ((corpo: CorpoDeAnexo) => Promise<Blob | null>) | null;
  corpo: CorpoDeAnexo;
  minha: boolean;
  /** "Ver uma vez" (só a de outra pessoa): a mensagem sai do histórico deste aparelho quando abre. */
  aoAbrirUmaVez: () => void;
  aoFecharUmaVez: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [estado, setEstado] = useState<"fechado" | "abrindo" | "sumiu">("fechado");
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  const umaVez = !!corpo.umaVez && !minha;
  const rotulo = corpo.tipo === "audio" ? t.audio : corpo.tipo === "imagem" ? (foto?.rotulo ?? "") : t.videoRotulo;
  // Foto e vídeo de ver uma vez abrem dentro da proteção contra print do item 1 (só com os textos da foto, isto é, com a flag).
  const protegido = umaVez && corpo.tipo !== "audio" && !!foto;
  const segundos = Math.max(1, Math.round(corpo.duracaoMs / 1000));

  async function abrir() {
    setEstado("abrindo");
    const blob = await (abrirCorpo ? abrirCorpo(corpo) : sessao ? abrirAnexoDaMensagem(sessao, corpo) : Promise.resolve(null)).catch(() => null);
    if (umaVez) {
      // Abriu (ou tentou): sai daqui e do depósito, dê certo ou não. Fica só nesta tela até fechar.
      aoAbrirUmaVez();
      void tirarAnexoDoDeposito(corpo);
    }
    if (!blob) return setEstado("sumiu");
    setUrl(URL.createObjectURL(blob));
    setEstado("fechado");
  }

  // A foto só abre com a proteção (a flag do lote da conversa): sem ela, não se mostra sem proteção.
  if (corpo.tipo === "imagem" && !foto) return <p className="text-sm italic opacity-80">{t.sumiu}</p>;
  return (
    <div className="flex flex-col gap-1" data-anexo-tipo={corpo.tipo}>
      <p className="text-xs font-semibold">
        {rotulo}
        {corpo.tipo === "imagem" ? "" : ` · ${preencher(t.duracao, { s: segundos })}`}
      </p>
      {url ? (
        corpo.tipo === "audio" ? (
          <>
            <audio controls src={url} className="max-w-full" />
            {/* Nota de voz de ver uma vez não se transcreve: ela é para ouvir uma vez, não para virar texto. */}
            {transcrever && !umaVez && <TranscricaoNoAparelho t={transcrever} url={url} lang={lang} />}
          </>
        ) : (
          <ConteudoProtegido ativo={protegido} marca={marca} textoEscondido={foto?.escondido ?? ""} aviso={foto?.aviso ?? null} className="relative max-w-full overflow-hidden rounded-lg">
            {corpo.tipo === "imagem" ? (
              // A foto decifrada neste aparelho, por um endereço blob: (solto ao fechar): nada a otimizar nem a buscar fora.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={foto?.rotulo ?? ""} draggable={false} className="max-h-80 max-w-full rounded-lg" />
            ) : (
              <video controls playsInline src={url} className="max-h-80 max-w-full rounded-lg" />
            )}
          </ConteudoProtegido>
        )
      ) : estado === "sumiu" ? (
        <p className="text-sm italic opacity-80">{t.sumiu}</p>
      ) : (
        <button type="button" className="inline-flex min-h-11 items-center underline disabled:opacity-60" disabled={estado === "abrindo"} onClick={() => void abrir()}>
          {estado === "abrindo" ? t.abrindo : corpo.tipo === "imagem" && foto ? foto.abrir : umaVez ? t.umaVez : corpo.tipo === "audio" ? t.ouvir : t.ver}
        </button>
      )}
      {umaVez && (url || estado === "sumiu") && (
        <button type="button" className="inline-flex min-h-11 items-center text-xs underline" onClick={aoFecharUmaVez}>
          {t.fechar}
        </button>
      )}
    </div>
  );
}
