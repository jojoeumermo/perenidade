// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { redePub } from "@/lib/rede/cliente-publicar";
import { preencher } from "@/lib/rede/preencher";
import { checarTexto } from "@/lib/rede/publicar/checagem";
import type { TextosPublicar } from "@/lib/rede/textos-publicar";
import type { TipoDePost } from "@/lib/rede/tipos";
import { type Agendado, type CitarQuem, LIMITES_PUBLICAR, type PedidoPublicar, type PreviaDoPost, type RespondeQuem } from "@/lib/rede/tipos-publicar";
import { enviarMidia, gerarPrevia } from "./api";
import { BorrarRostos } from "./BorrarRostos";
import { aplicarBorrado, type AreaBorrada, ErroDeImagem, prepararImagem } from "./imagem";
import { useTextosPublicar } from "./textos";

const CHAVE_RASCUNHO = "lucia:rede:rascunho:v1";
const PRAZOS = [1, 6, 24, 72, 168] as const;

export interface ImagemEscolhida {
  id: string;
  base: Blob;
  final: Blob;
  url: string;
  largura: number;
  altura: number;
  alt: string;
  areas: AreaBorrada[];
}

export interface AudioGravado {
  blob: Blob;
  url: string;
  duracao: number;
}

export interface RascunhoGuardado {
  tipo: TipoDePost;
  texto: string;
  titulo: string;
  corpo: string;
}

const lerRascunho = (): RascunhoGuardado | null => {
  try {
    const bruto = window.localStorage.getItem(CHAVE_RASCUNHO);
    if (!bruto) return null;
    const r = JSON.parse(bruto) as Partial<RascunhoGuardado>;
    return typeof r.texto === "string" ? { tipo: (r.tipo ?? "post") as TipoDePost, texto: r.texto, titulo: r.titulo ?? "", corpo: r.corpo ?? "" } : null;
  } catch {
    return null;
  }
};
/** Guarda (ou apaga, com null) o rascunho do aparelho na hora; o Escrever novo usa ao fechar, para não perder o que ainda não foi guardado. */
export const escreverRascunho = (r: RascunhoGuardado | null) => {
  try {
    if (r) window.localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(r));
    else window.localStorage.removeItem(CHAVE_RASCUNHO);
  } catch {
    // sem armazenamento (janela privada): o rascunho só não é guardado
  }
};

const primeiroLink = (texto: string): string | null => texto.match(/https?:\/\/[^\s<>"')]+/i)?.[0].replace(/[.,;:!?]+$/, "") ?? null;

/** Valor para <input type="datetime-local"> (hora local) a partir de um instante. */
const paraCampoLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

/**
 * O estado dos campos que o pacote publicar acrescenta ao Escrever: enquete, imagens (com texto alternativo e borrado de
 * rostos), áudio de até 1 minuto, prévia de link, quem pode responder, fio, agendamento e rascunho no aparelho. `preparar()` sobe
 * os arquivos (o servidor tira o metadado de novo) e devolve os campos do pedido de publicar.
 */
export function useEscreverPub({
  tipo,
  resposta,
  respostaPropria,
  texto,
  titulo,
  corpo,
  aplicarRascunho,
}: {
  tipo: TipoDePost;
  resposta: boolean;
  respostaPropria: boolean;
  texto: string;
  titulo: string;
  corpo: string;
  aplicarRascunho: (r: RascunhoGuardado) => void;
}) {
  const t = useTextosPublicar();
  const [opcoes, setOpcoes] = useState<string[]>(["", ""]);
  const [horas, setHoras] = useState<number>(24);
  const [multipla, setMultipla] = useState(false);
  const [imagens, setImagens] = useState<ImagemEscolhida[]>([]);
  const [audio, setAudio] = useState<AudioGravado | null>(null);
  const [previa, setPrevia] = useState<PreviaDoPost | null>(null);
  const [previaEstado, setPreviaEstado] = useState<"parada" | "buscando" | "falhou">("parada");
  const [previaTirada, setPreviaTirada] = useState<string | null>(null);
  const [respondeQuem, setRespondeQuem] = useState<RespondeQuem>("todos");
  // B1: aviso de conteúdo (até 80, o banco corta igual), enquete avançada, quem pode citar e as opções de agendar.
  const [aviso, setAvisoBruto] = useState("");
  const setAviso = (v: string) => setAvisoBruto(v.slice(0, 80));
  const [soNoFim, setSoNoFim] = useState(false);
  const [embaralhar, setEmbaralhar] = useState(false);
  const [citarQuem, setCitarQuem] = useState<CitarQuem>("ninguem");
  const [repetir, setRepetir] = useState<number>(0);
  const [aposAto, setAposAto] = useState<string>("");
  const [fio, setFio] = useState(respostaPropria);
  const [agendar, setAgendarBruto] = useState("");
  const [agendaOk, setAgendaOk] = useState(true);
  // Os limites do campo de data são fixados quando o Escrever abre (o banco confere de novo na hora de agendar).
  const [limitesDaAgenda] = useState(() => ({ minimo: paraCampoLocal(new Date(Date.now() + 6 * 60_000)), maximo: paraCampoLocal(new Date(Date.now() + 30 * 86_400_000)) }));
  const setAgendar = (valor: string) => {
    setAgendarBruto(valor);
    const ms = valor ? new Date(valor).getTime() : 0;
    setAgendaOk(!valor || (ms >= Date.now() + 5 * 60_000 && ms <= Date.now() + 30 * 86_400_000));
  };
  const [recuperado, setRecuperado] = useState(false);
  const subidas = useRef(new Map<string, { caminho: string; largura: number | null; altura: number | null }>());
  const enquete = tipo === "enquete" && !resposta;

  // Rascunho: volta o que ficou neste aparelho (só para um post novo) e guarda enquanto a pessoa escreve.
  useEffect(() => {
    if (resposta) return;
    const r = lerRascunho();
    if (r && (r.texto.trim() || r.corpo.trim() || r.titulo.trim())) {
      aplicarRascunho(r);
      // Ler o aparelho na abertura é sincronizar com um sistema de fora: é o uso certo do efeito.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRecuperado(true);
    }
    // só na abertura
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (resposta) return;
    const espera = window.setTimeout(() => escreverRascunho(texto.trim() || corpo.trim() || titulo.trim() ? { tipo, texto, titulo, corpo } : null), 700);
    return () => window.clearTimeout(espera);
  }, [resposta, tipo, texto, titulo, corpo]);

  // Prévia de link: o primeiro endereço do texto, buscado pelo servidor depois de uma pausa na digitação.
  const alvo = useMemo(() => primeiroLink(`${texto}\n${corpo}`), [texto, corpo]);
  useEffect(() => {
    if (!alvo || alvo === previaTirada || previa?.url === alvo) return;
    let vivo = true;
    const espera = window.setTimeout(() => {
      setPreviaEstado("buscando");
      void gerarPrevia(alvo).then((p) => {
        if (!vivo) return;
        setPrevia(p);
        setPreviaEstado(p ? "parada" : "falhou");
      });
    }, 900);
    return () => {
      vivo = false;
      window.clearTimeout(espera);
    };
  }, [alvo, previaTirada, previa?.url]);

  // Libera os endereços locais (blob:) ao sair.
  useEffect(
    () => () => {
      imagens.forEach((i) => URL.revokeObjectURL(i.url));
    },
    // só na saída; as trocas liberam o que saiu
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const achados = useMemo(() => checarTexto(`${titulo}\n${texto}\n${corpo}\n${enquete ? opcoes.join("\n") : ""}\n${imagens.map((i) => i.alt).join("\n")}`), [titulo, texto, corpo, enquete, opcoes, imagens]);
  const opcoesValidas = opcoes.map((o) => o.trim()).filter(Boolean);
  const enqueteOk = !enquete || (opcoesValidas.length >= LIMITES_PUBLICAR.opcoesMin && new Set(opcoesValidas.map((o) => o.toLowerCase())).size === opcoesValidas.length);

  const adicionarImagem = useCallback(
    async (arquivos: FileList | File[]): Promise<string> => {
      const lista = Array.from(arquivos).slice(0, LIMITES_PUBLICAR.imagens);
      let erro = "";
      const novas: ImagemEscolhida[] = [];
      for (const f of lista) {
        if (imagens.length + novas.length >= LIMITES_PUBLICAR.imagens) {
          erro = "maximo";
          break;
        }
        try {
          const { blob, largura, altura } = await prepararImagem(f);
          novas.push({ id: crypto.randomUUID(), base: blob, final: blob, url: URL.createObjectURL(blob), largura, altura, alt: "", areas: [] });
        } catch (e) {
          erro = e instanceof ErroDeImagem ? e.codigo : "invalida";
        }
      }
      if (novas.length) setImagens((atual) => [...atual, ...novas].slice(0, LIMITES_PUBLICAR.imagens));
      return erro;
    },
    [imagens.length],
  );
  const tirarImagem = (id: string) =>
    setImagens((atual) => {
      const i = atual.find((x) => x.id === id);
      if (i) URL.revokeObjectURL(i.url);
      return atual.filter((x) => x.id !== id);
    });
  const mudarAlt = (id: string, alt: string) => setImagens((atual) => atual.map((i) => (i.id === id ? { ...i, alt: alt.slice(0, LIMITES_PUBLICAR.textoAlt) } : i)));
  const borrar = async (id: string, areas: AreaBorrada[]) => {
    const i = imagens.find((x) => x.id === id);
    if (!i) return;
    const final = await aplicarBorrado(i.base, areas);
    URL.revokeObjectURL(i.url);
    subidas.current.delete(id);
    setImagens((atual) => atual.map((x) => (x.id === id ? { ...x, areas, final, url: URL.createObjectURL(final) } : x)));
  };

  /** Sobe o que há para subir e monta os campos do pedido. Lança o erro (com `code`) se algo falhar. */
  async function preparar(): Promise<Partial<PedidoPublicar>> {
    const campos: Partial<PedidoPublicar> = {};
    if (imagens.length) {
      const midia = [];
      for (const i of imagens) {
        let s = subidas.current.get(i.id);
        if (!s) {
          const r = await enviarMidia(i.final);
          s = { caminho: r.caminho, largura: r.largura, altura: r.altura };
          subidas.current.set(i.id, s);
        }
        midia.push({ caminho: s.caminho, alt: i.alt.trim(), largura: s.largura, altura: s.altura });
      }
      campos.midia = midia;
    }
    if (audio && !imagens.length) {
      const chave = "audio";
      let s = subidas.current.get(chave);
      if (!s) {
        const r = await enviarMidia(audio.blob);
        s = { caminho: r.caminho, largura: null, altura: null };
        subidas.current.set(chave, s);
      }
      campos.audio = { caminho: s.caminho, duracao: Math.max(1, Math.min(LIMITES_PUBLICAR.audioSegundos, Math.round(audio.duracao))) };
    }
    if (enquete) campos.enquete = { opcoes: opcoesValidas, horas, multipla, ...(soNoFim ? { so_no_fim: true } : {}), ...(embaralhar ? { embaralhar: true } : {}) };
    if (previa && alvo === previa.url) campos.previa = { url: previa.url, titulo: previa.titulo, descricao: previa.descricao, imagem: previa.imagem };
    if (!resposta && respondeQuem !== "todos") campos.responde_quem = respondeQuem;
    if (aviso.trim()) campos.aviso = aviso.trim();
    if (!resposta) campos.citar_quem = citarQuem;
    if (respostaPropria && fio) campos.fio = true;
    return campos;
  }

  function limpar() {
    escreverRascunho(null);
    imagens.forEach((i) => URL.revokeObjectURL(i.url));
    if (audio) URL.revokeObjectURL(audio.url);
  }

  return {
    t, enquete, opcoes, setOpcoes, horas, setHoras, multipla, setMultipla, imagens, adicionarImagem, tirarImagem, mudarAlt, borrar, audio, setAudio,
    previa: previa && alvo === previa.url ? previa : null, previaEstado: alvo ? previaEstado : ("parada" as const), alvo, limitesDaAgenda, agendaOk, tirarPrevia: () => { setPreviaTirada(alvo); setPrevia(null); setPreviaEstado("parada"); },
    respondeQuem, setRespondeQuem, fio, setFio, agendar, setAgendar, recuperado, achados, enqueteOk, preparar, limpar,
    aviso, setAviso, soNoFim, setSoNoFim, embaralhar, setEmbaralhar, citarQuem, setCitarQuem, repetir, setRepetir, aposAto, setAposAto,
    /** Pode enviar? Não há dado pessoal nem endereço com número (o banco confere de novo) e a enquete está completa. */
    podeEnviar: achados.bloqueia.length === 0 && enqueteOk,
  };
}
export type PubDoEscrever = ReturnType<typeof useEscreverPub>;

/** O gravador de áudio (até 1 minuto). `classeBotao` troca a cara dos botões (o Escrever novo usa os da Alumia); `comecarJa` grava ao abrir. */
export function Gravador({ t, aoGravar, audio, aoTirar, classeBotao, comecarJa = false }: { t: TextosPublicar; audio: AudioGravado | null; aoGravar: (a: AudioGravado) => void; aoTirar: () => void; classeBotao?: string; comecarJa?: boolean }) {
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [erro, setErro] = useState("");
  const gravador = useRef<MediaRecorder | null>(null);
  const relogio = useRef<number | undefined>(undefined);
  const suporta = typeof window !== "undefined" && "MediaRecorder" in window && Boolean(navigator.mediaDevices?.getUserMedia);

  useEffect(() => () => {
    window.clearInterval(relogio.current);
    if (gravador.current?.state === "recording") gravador.current.stop();
  }, []);

  async function comecar() {
    setErro("");
    let fluxo: MediaStream;
    try {
      fluxo = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return setErro(t.audio.semPermissao);
    }
    const tipos = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"];
    const mimeType = tipos.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
    const r = new MediaRecorder(fluxo, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 32_000 });
    const partes: Blob[] = [];
    const t0 = Date.now();
    r.ondataavailable = (e) => e.data.size && partes.push(e.data);
    r.onstop = () => {
      fluxo.getTracks().forEach((x) => x.stop());
      window.clearInterval(relogio.current);
      setGravando(false);
      const blob = new Blob(partes, { type: r.mimeType || mimeType || "audio/webm" });
      if (blob.size < 200) return;
      if (blob.size > 1_400_000) return setErro(t.erros.invalido_audio);
      aoGravar({ blob, url: URL.createObjectURL(blob), duracao: Math.min(LIMITES_PUBLICAR.audioSegundos, Math.max(1, Math.round((Date.now() - t0) / 1000))) });
    };
    gravador.current = r;
    r.start(1000);
    setSegundos(0);
    setGravando(true);
    relogio.current = window.setInterval(() => {
      const s = Math.round((Date.now() - t0) / 1000);
      setSegundos(s);
      if (s >= LIMITES_PUBLICAR.audioSegundos && r.state === "recording") r.stop();
    }, 250);
  }

  // "Gravar áudio" do Escrever novo: o toque no ícone já começa a gravar (o navegador pede o microfone na hora).
  const jaComecou = useRef(false);
  useEffect(() => {
    if (!comecarJa || jaComecou.current || !suporta || audio) return;
    jaComecou.current = true;
    void comecar();
    // só na abertura
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const botao = classeBotao ?? "min-h-11 cursor-pointer rounded-full border-[1.5px] border-ink px-4 font-sans text-sm font-bold hover:bg-parchment-deep disabled:cursor-not-allowed disabled:opacity-50";
  if (!suporta) return <p className="text-sm text-ink-soft">{t.audio.semSuporte}</p>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {gravando ? (
        <>
          <button type="button" className={botao} onClick={() => gravador.current?.stop()}>
            {t.audio.parar}
          </button>
          <span role="status" className="al2-gravando text-sm">
            {preencher(t.audio.gravando, { s: segundos })}
          </span>
        </>
      ) : audio ? (
        <>
          <audio controls src={audio.url} className="h-11 max-w-full" />
          <button type="button" className={botao} onClick={() => { URL.revokeObjectURL(audio.url); aoTirar(); void comecar(); }}>
            {t.audio.regravar}
          </button>
          <button type="button" className={botao} onClick={() => { URL.revokeObjectURL(audio.url); aoTirar(); }}>
            {t.audio.tirar}
          </button>
        </>
      ) : (
        <button type="button" className={botao} onClick={() => void comecar()}>
          {t.audio.gravar}
        </button>
      )}
      {erro && <span role="alert" className="text-sm text-oxblood">{erro}</span>}
    </div>
  );
}

/** As publicações agendadas (abre a lista ao abrir). */
export function Agendados({ t, lang, b1 }: { t: TextosPublicar; lang: string; /** B1: os rótulos de "toda semana" e "quando o ato terminar". */ b1?: { naFilaRepetir: string; naFilaAto: string } }) {
  const [lista, setLista] = useState<Agendado[] | null>(null);
  const carregar = useCallback(() => void redePub.agendados().then(setLista, () => setLista([])), []);
  const quando = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(lang, { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
    } catch {
      return iso;
    }
  };
  return (
    <details onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && carregar()}>
      <summary className="cursor-pointer text-sm font-bold">{t.agendar.fila}</summary>
      <ul className="mt-1 space-y-1 text-sm">
        {(lista ?? []).filter((a) => a.estado !== "publicado").map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-md border border-rule bg-folha px-2 py-1">
            <span className="min-w-0 flex-1 break-words">
              {quando(a.quando)}: {a.texto}
              {b1 && a.repetir === "semana" && <span className="block text-xs opacity-80">{preencher(b1.naFilaRepetir, { n: a.vezes ?? 1, total: a.repetir_vezes ?? 1 })}</span>}
              {b1 && a.apos_ato && <span className="block text-xs opacity-80">{b1.naFilaAto}</span>}
              {a.estado === "falhou" && <span className="block text-oxblood">{preencher(t.agendar.falhou, { erro: a.erro })}</span>}
            </span>
            <button type="button" className="min-h-11 cursor-pointer font-bold underline" onClick={() => void redePub.cancelarAgendado(a.id).then(carregar, carregar)}>
              {t.agendar.cancelar}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Os campos do pacote publicar dentro do Escrever (enquete, imagens, áudio, prévia, quem responde, fio, agendamento, avisos). */
export function ExtrasDoEscrever({ pub, resposta, lang, semQuemResponde = false }: { pub: PubDoEscrever; resposta: boolean; lang: string; /** A casca nova (alumia-2) mostra "Quem responde" como linha de escolha própria. */ semQuemResponde?: boolean }) {
  const { t } = pub;
  const [borrando, setBorrando] = useState<string | null>(null);
  const [erroImagem, setErroImagem] = useState("");
  const entrada = useRef<HTMLInputElement>(null);
  if (!t) return null;
  const campo = "block w-full rounded-md border border-rule bg-folha px-2 py-2 font-sans text-ink";
  const botao = "min-h-11 cursor-pointer rounded-full border-[1.5px] border-ink px-4 font-sans text-sm font-bold hover:bg-parchment-deep disabled:cursor-not-allowed disabled:opacity-50";
  const noBorrado = pub.imagens.find((i) => i.id === borrando);
  const { minimo, maximo } = pub.limitesDaAgenda;
  const textoDoAchado = (tipo: string) => (t.checagem as Record<string, string>)[tipo];

  return (
    <div className="space-y-3 font-sans">
      {pub.recuperado && <p role="status" className="text-sm text-ink-soft">{t.rascunho.recuperado}</p>}

      {pub.enquete && (
        <fieldset className="space-y-2 rounded-md border border-rule p-3">
          <legend className="px-1 text-sm font-bold">{t.enquete.rotulo}</legend>
          {pub.opcoes.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <label className="min-w-0 flex-1 text-sm">
                <span className="sr-only">{preencher(t.enquete.opcao, { n: i + 1 })}</span>
                <input className={`${campo} min-h-11`} placeholder={preencher(t.enquete.opcao, { n: i + 1 })} maxLength={LIMITES_PUBLICAR.opcaoTexto} value={o} onChange={(e) => pub.setOpcoes((l) => l.map((x, j) => (j === i ? e.target.value : x)))} />
              </label>
              {pub.opcoes.length > LIMITES_PUBLICAR.opcoesMin && (
                <button type="button" className="min-h-11 cursor-pointer px-2 font-bold underline" onClick={() => pub.setOpcoes((l) => l.filter((_, j) => j !== i))}>
                  {preencher(t.enquete.tirar, { n: i + 1 })}
                </button>
              )}
            </div>
          ))}
          {pub.opcoes.length < LIMITES_PUBLICAR.opcoesMax && (
            <button type="button" className={botao} onClick={() => pub.setOpcoes((l) => [...l, ""])}>
              {t.enquete.mais}
            </button>
          )}
          <label className="block text-sm">
            <span className="font-bold">{t.enquete.prazo}</span>
            <select className={`${campo} mt-1 min-h-11`} value={pub.horas} onChange={(e) => pub.setHoras(Number(e.target.value))}>
              {PRAZOS.map((h) => (
                <option key={h} value={h}>
                  {(t.enquete as Record<string, string>)[`p${h}`]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={pub.multipla} onChange={(e) => pub.setMultipla(e.target.checked)} />
            {t.enquete.multipla}
          </label>
          <p className="text-xs text-ink-soft">{t.enquete.secreto}</p>
        </fieldset>
      )}

      <fieldset className="space-y-2 rounded-md border border-rule p-3">
        <legend className="px-1 text-sm font-bold">{t.imagens.titulo}</legend>
        {pub.imagens.map((i, n) => (
          <div key={i.id} className="flex flex-col gap-2 sm:flex-row">
            {/* A prévia local da imagem (blob:), já sem metadado. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={i.url} alt="" width={i.largura} height={i.altura} className="h-28 w-28 shrink-0 rounded-md border border-rule object-cover" />
            <div className="min-w-0 flex-1 space-y-1">
              <label className="block text-sm">
                <span className="font-bold">{t.imagens.alt}</span>
                <input className={`${campo} mt-1 min-h-11`} placeholder={t.imagens.altDica} value={i.alt} onChange={(e) => pub.mudarAlt(i.id, e.target.value)} />
              </label>
              {!i.alt.trim() && <p className="text-xs text-ink-soft">{t.imagens.altFalta}</p>}
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className={botao} onClick={() => setBorrando(i.id)}>
                  {t.imagens.borrar}
                </button>
                <button type="button" className={botao} onClick={() => pub.tirarImagem(i.id)}>
                  {preencher(t.imagens.tirar, { n: n + 1 })}
                </button>
                {i.areas.length > 0 && <span className="text-xs text-ink-soft">{preencher(t.imagens.borradas, { n: i.areas.length })}</span>}
              </div>
            </div>
          </div>
        ))}
        {pub.imagens.length < LIMITES_PUBLICAR.imagens && !pub.audio && (
          <>
            <input
              ref={entrada}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              aria-label={t.imagens.adicionar}
              onChange={(e) => {
                const arquivos = e.target.files;
                if (arquivos?.length) void pub.adicionarImagem(arquivos).then((erro) => setErroImagem(erro ? ((t.imagens as Record<string, string>)[erro] ?? t.imagens.invalida) : ""));
                e.target.value = "";
              }}
            />
            <button type="button" className={botao} onClick={() => entrada.current?.click()}>
              {t.imagens.adicionar}
            </button>
          </>
        )}
        {erroImagem && <p role="alert" className="text-sm text-oxblood">{erroImagem}</p>}
        <p className="text-xs text-ink-soft">{t.imagens.limpa}</p>
      </fieldset>
      {noBorrado && (
        <BorrarRostos
          t={t}
          base={noBorrado.base}
          areasIniciais={noBorrado.areas}
          aoCancelar={() => setBorrando(null)}
          aoConcluir={(areas) => {
            setBorrando(null);
            void pub.borrar(noBorrado.id, areas);
          }}
        />
      )}

      {!pub.imagens.length && (
        <fieldset className="space-y-2 rounded-md border border-rule p-3">
          <legend className="px-1 text-sm font-bold">{t.audio.titulo}</legend>
          <Gravador t={t} audio={pub.audio} aoGravar={pub.setAudio} aoTirar={() => pub.setAudio(null)} />
        </fieldset>
      )}

      {(pub.previa || pub.previaEstado !== "parada") && (
        <div className="rounded-md border border-rule bg-folha p-3 text-sm" aria-live="polite">
          <p className="font-bold">{t.previa.titulo}</p>
          {pub.previaEstado === "buscando" && <p className="text-ink-soft">{t.previa.gerando}</p>}
          {pub.previaEstado === "falhou" && <p className="text-ink-soft">{t.previa.falha}</p>}
          {pub.previa && (
            <div className="mt-1">
              <p className="text-xs text-ink-soft">{pub.previa.dominio}</p>
              {pub.previa.titulo && <p className="font-serif font-semibold">{pub.previa.titulo}</p>}
              {pub.previa.descricao && <p className="text-ink-soft">{pub.previa.descricao}</p>}
              <p className="mt-1 text-xs text-ink-soft">{t.previa.nota}</p>
            </div>
          )}
          <button type="button" className="mt-1 min-h-11 cursor-pointer font-bold underline" onClick={pub.tirarPrevia}>
            {t.previa.tirar}
          </button>
        </div>
      )}

      {!resposta && !semQuemResponde && (
        <label className="block text-sm">
          <span className="font-bold">{t.quem.rotulo}</span>
          <select className={`${campo} mt-1 min-h-11`} value={pub.respondeQuem} onChange={(e) => pub.setRespondeQuem(e.target.value as RespondeQuem)}>
            {(["todos", "seguindo", "mencionados", "ninguem"] as const).map((q) => (
              <option key={q} value={q}>
                {t.quem[q]}
              </option>
            ))}
          </select>
        </label>
      )}

      {resposta && (
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={pub.fio} onChange={(e) => pub.setFio(e.target.checked)} />
          {t.fio.continuar}
        </label>
      )}

      {!resposta && (
        <div className="space-y-1">
          <label className="block text-sm">
            <span className="font-bold">{t.agendar.rotulo}</span>
            <input type="datetime-local" lang={lang} className={`${campo} mt-1 min-h-11`} min={minimo} max={maximo} value={pub.agendar} onChange={(e) => pub.setAgendar(e.target.value)} />
          </label>
          {pub.agendar && !pub.agendaOk && <p role="alert" className="text-sm text-oxblood">{t.agendar.cedo}</p>}
          <Agendados t={t} lang={lang} />
        </div>
      )}

      <div aria-live="polite" className="space-y-1">
        {pub.achados.bloqueia.map((a, i) => (
          <p key={`b${i}`} role="alert" className="text-sm text-oxblood">
            {textoDoAchado(a.tipo)}
          </p>
        ))}
        {pub.achados.avisa.map((a, i) => (
          <p key={`a${i}`} role="status" className="text-sm text-ink-soft">
            {textoDoAchado(a.tipo)}
          </p>
        ))}
      </div>
    </div>
  );
}
