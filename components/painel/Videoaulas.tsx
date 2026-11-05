// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Check, CircleDot, Eye, FileText, type LucideIcon, Monitor, MonitorPlay, PictureInPicture2, Play, Radio, Square, Trash2, Upload, Video, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { areaSlugs } from "@/lib/areas";
import { can, getClient, type Me } from "@/lib/backend";
import {
  apagarVideo,
  cabe,
  converterPara720p,
  enderecoDoVideo,
  enviarVideo,
  formatoDeGravacao,
  LIMITE_BYTES,
  LIMITE_SEGUNDOS,
  medir,
  mensagensDeVideo,
  opcoesDoGravador,
  relogio,
  restricoesDeVideo,
  VideoErro,
  type Formato,
  type Medidas,
} from "@/lib/videoaula";
import { linkDoYoutube, mensagemDoCanal, pedirAoCanal } from "@/lib/canal-youtube";
import { cleanSources, SourcesField, type SourceDraft } from "../Editor";
import { useI18n } from "../I18n";
import { useTrackOptions } from "../useTrackOptions";
import { playerPt, VideoPlayer } from "../VideoPlayer";
import { Aviso, data, useAcao, useLista } from "./comum";
import { fontesPt } from "./Escrever";
import { Abas, Area, Botao, Campo, Cartao, confirmarFrase, Esqueleto, Estatistica, Estatisticas, Faixa, Marca, Selecao, Selo, type TomDoSelo, Vazio } from "./ui";

interface Videoaula {
  id: string;
  disciplina: string;
  trilha: string | null;
  titulo: string;
  descricao: string;
  nome_autor: string;
  caminho: string;
  tipo: string;
  duracao: number;
  largura: number;
  altura: number;
  tamanho: number;
  status: "pendente" | "aprovada" | "recusada";
  nota: string;
  criado_em: string;
  revisado_em: string | null;
  minha: boolean;
  transcricao?: string;
  legenda?: string;
  fontes?: { titulo: string; autor?: string; url?: string }[];
  /** A cópia no canal do instituto no YouTube (supabase/functions/youtube). */
  youtube?: string | null;
  youtube_situacao?: "" | "enviando" | "no_ar" | "travado" | "erro";
  youtube_erro?: string;
}

/** Como está a cópia de uma aula aprovada no YouTube do instituto, em uma linha (com o link para pôr numa aula). */
function NoYoutube({ aula }: { aula: Videoaula }) {
  const [copiado, setCopiado] = useState(false);
  if (aula.status !== "aprovada") return null;
  const situacao = aula.youtube_situacao ?? "";
  if (situacao === "no_ar" && aula.youtube) {
    const link = linkDoYoutube(aula.youtube);
    return (
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <Selo tom="bordo" ponto>YouTube</Selo>
        <a href={link} target="_blank" rel="noopener noreferrer" className="pn-elo font-mono">{link.replace("https://", "")}</a>
        <button
          type="button"
          className="pn-elo inline-flex items-center gap-1"
          onClick={() => {
            navigator.clipboard?.writeText(link).then(() => setCopiado(true), () => undefined);
          }}
        >
          {copiado && <Check aria-hidden className="h-3 w-3" />}
          {copiado ? "Copiado" : "Copiar o link (para pôr num bloco de vídeo de uma aula)"}
        </button>
      </p>
    );
  }
  const textos: Record<string, string> = {
    enviando: "Indo para o YouTube do instituto…",
    travado: "Já está no YouTube, mas o Google deixa privado até liberar o canal. Enquanto isso, o site toca a cópia do instituto.",
    erro: "Não foi para o YouTube. A curadoria pode tentar de novo em “No ar”.",
    "": "Ainda não foi para o YouTube do instituto.",
  };
  return <p className={`mt-2 text-xs ${situacao === "erro" ? "text-oxblood" : "text-ink-soft"}`}>{textos[situacao] ?? textos[""]}</p>;
}

/** O vídeo pronto para enviar, gravado aqui ou escolhido no aparelho. */
interface Pronto {
  blob: Blob;
  formato: Formato;
  medidas: Medidas;
  previa: string;
}

const situacao: Record<Videoaula["status"], string> = { pendente: "esperando revisão", aprovada: "no ar", recusada: "não aprovada" };
const megas = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
const erroDe = (erro: unknown) => (erro instanceof VideoErro ? (mensagensDeVideo[erro.message] ?? mensagensDeVideo.formato) : "Algo deu errado. Tente de novo.");

type Aba = "gravar" | "minhas" | "revisar" | "noar";

/** Os ícones das vistas e do gravador (Lucide, no lugar dos desenhos feitos à mão). */
const DESENHOS = {
  gravar: CircleDot,
  minhas: MonitorPlay,
  revisar: Eye,
  noar: Radio,
  camera: Video,
  tela: Monitor,
  ambos: PictureInPicture2,
  play: Play,
  certo: Check,
} satisfies Record<string, LucideIcon>;
function Desenho({ nome, className = "h-4 w-4" }: { nome: keyof typeof DESENHOS; className?: string }) {
  const Simbolo = DESENHOS[nome];
  return <Simbolo aria-hidden className={`shrink-0 ${className}`} strokeWidth={1.7} />;
}

/** O tom do selo de cada situação (a palavra diz a situação; a cor só acompanha). */
const TOM: Record<Videoaula["status"], TomDoSelo> = { pendente: "aviso", aprovada: "ok", recusada: "erro" };

/** O número de cada passo do formulário, num círculo bordô claro. */
function Passo({ n, nome }: { n: number; nome: string }) {
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--pn-destaque-suave)] font-mono text-xs font-semibold text-oxblood">{n}</span>
      {nome}
    </span>
  );
}

/** Aulas em vídeo, no jeito de um estúdio de canal: quem ensina grava ou envia; a curadoria revisa; a coordenação pode tirar do ar. */
export function Videoaulas({ me }: { me: Me }) {
  const revisa = can(me, "coordenacao", "curadoria", "educacao");
  const [aba, setAba] = useState<Aba>("minhas");
  const fila = useLista<Videoaula[]>(revisa ? "videoaulas_fila" : "videoaulas_minhas");
  const minhas = useLista<Videoaula[]>("videoaulas_minhas");
  const lista = minhas.dados ?? [];
  const paraRevisar = fila.dados?.filter((v) => !v.minha).length ?? 0;
  const minutos = Math.round(lista.filter((v) => v.status === "aprovada").reduce((soma, v) => soma + v.duracao, 0) / 60);
  const opcoes: { id: Aba; nome: string; conta?: number }[] = [
    { id: "minhas", nome: "Conteúdo" },
    { id: "gravar", nome: "Gravar ou enviar" },
    ...(revisa ? [{ id: "revisar" as const, nome: "Para revisar", conta: paraRevisar }] : []),
    ...(can(me, "coordenacao") ? [{ id: "noar" as const, nome: "No ar" }] : []),
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <Estatisticas className="min-w-0 flex-1">
          <Estatistica rotulo="No ar" valor={lista.filter((v) => v.status === "aprovada").length} tom="ok" />
          <Estatistica rotulo="Esperando revisão" valor={lista.filter((v) => v.status === "pendente").length} tom="aviso" />
          <Estatistica rotulo="Minutos publicados" valor={minutos} />
        </Estatisticas>
        <Botao variante="principal" simbolo={CircleDot} onClick={() => setAba("gravar")}>
          Gravar uma aula
        </Botao>
      </div>
      <Abas rotulo="Vistas das aulas em vídeo" valor={aba} aoMudar={setAba} opcoes={opcoes} />
      <div>
        {aba === "gravar" && <Gravar me={me} enviado={() => { minhas.recarregar(); setAba("minhas"); }} />}
        {aba === "minhas" && <Minhas lista={minhas.dados} erro={minhas.erro} recarregar={minhas.recarregar} gravar={() => setAba("gravar")} />}
        {aba === "revisar" && <Revisar me={me} fila={fila.dados} erro={fila.erro} recarregar={fila.recarregar} />}
        {aba === "noar" && <NoAr />}
      </div>
    </div>
  );
}

/** O formulário com o gravador. */
function Gravar({ me, enviado }: { me: Me; enviado: () => void }) {
  const { lang, t } = useI18n();
  const tracks = useTrackOptions(lang);
  const amplo = can(me, "coordenacao", "curadoria");
  const minhas = me.papeis.filter((p) => p.papel === "educacao" || p.papel === "educacao_secundaria").map((p) => p.disciplina).filter((d): d is string => Boolean(d));
  const disciplinas = amplo ? [...areaSlugs] : [...new Set(minhas)];
  const [form, setForm] = useState({ disciplina: disciplinas[0] ?? "", trilha: "", titulo: "", descricao: "", transcricao: "", legenda: "" });
  const [fontes, setFontes] = useState<SourceDraft[]>([{ titulo: "", autor: "", url: "" }]);
  const [pronto, setPronto] = useState<Pronto | null>(null);
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [transcrevendo, setTranscrevendo] = useState(false);
  const acao = useAcao();

  /** Manda o vídeo gravado ao serviço de transcrição (Whisper, pela função do serviço de contas) e preenche a transcrição e a legenda. */
  async function transcrever() {
    if (!pronto) return;
    if (pronto.blob.size > 25 * 1024 * 1024) return setAviso("O serviço de transcrição aceita até 25 MB: grave um trecho mais curto ou escreva a transcrição à mão.");
    setTranscrevendo(true);
    setAviso("");
    try {
      const supabase = await getClient();
      const corpo = new FormData();
      corpo.append("arquivo", pronto.blob, `aula.${pronto.formato.extensao}`);
      const { data, error } = await supabase.functions.invoke<{ texto?: string; vtt?: string; erro?: string }>("transcrever-audio", { body: corpo });
      if (error || !data || data.erro || !data.texto) {
        const e = data?.erro;
        setAviso(e === "desligada" ? "A transcrição automática ainda não foi ligada: a coordenação precisa guardar a chave do serviço de Whisper (gratuita, na Groq) como segredo GROQ_API_KEY no Supabase. Até lá, escreva a transcrição à mão ou importe um .vtt." : e === "sem_permissao" ? "A transcrição é só para quem tem função no painel. Saia e entre de novo se acabou de receber a função." : e === "cota" ? "O serviço de transcrição atingiu a cota de agora. Tente mais tarde." : e === "limite" ? "Você já transcreveu muitas vezes agora; tente mais tarde ou escreva à mão." : "A transcrição não respondeu. Tente de novo ou escreva à mão.");
        return;
      }
      setForm((f) => ({ ...f, transcricao: data.texto ?? "", legenda: data.vtt || f.legenda }));
    } catch {
      setAviso("A transcrição não respondeu. Tente de novo ou escreva à mão.");
    } finally {
      setTranscrevendo(false);
    }
  }

  useEffect(() => () => (pronto ? URL.revokeObjectURL(pronto.previa) : undefined), [pronto]);

  async function enviar() {
    if (!pronto) return;
    setAviso("");
    const lista = cleanSources(fontes);
    if (form.titulo.trim().length < 3) return setAviso("Dê um título à aula.");
    if (lista.length === 0) return setAviso("Cite pelo menos uma fonte.");
    setEnviando(true);
    let caminho = "";
    try {
      caminho = await enviarVideo(pronto.blob, pronto.formato);
    } catch (erro) {
      setEnviando(false);
      return setAviso(erroDe(erro));
    }
    const ok = await acao.agir(
      "videoaula_enviar",
      {
        p: {
          ...form,
          caminho,
          tipo: pronto.formato.tipo,
          duracao: String(pronto.medidas.duracao),
          largura: String(pronto.medidas.largura),
          altura: String(pronto.medidas.altura),
          tamanho: String(pronto.blob.size),
          fontes: lista,
        },
      },
      "Aula enviada. A curadoria foi avisada.",
    );
    setEnviando(false);
    if (ok) {
      setPronto(null);
      setForm({ ...form, titulo: "", descricao: "", transcricao: "", legenda: "" });
      enviado();
    } else {
      // O registro foi recusado: o arquivo não fica perdido no depósito.
      await apagarVideo(caminho).catch(() => undefined);
    }
  }

  if (disciplinas.length === 0)
    return <Vazio simbolo={Video} titulo="Para gravar aulas em vídeo é preciso ter uma disciplina confiada (educação ou educação secundária)." texto="Peça à coordenação em Voluntários e convites." />;

  const fontesCertas = cleanSources(fontes).length > 0;
  const lista = [
    { feito: Boolean(pronto), nome: "O vídeo, gravado ou escolhido" },
    { feito: form.titulo.trim().length >= 3, nome: "Um título" },
    { feito: fontesCertas, nome: "Pelo menos uma fonte" },
    { feito: form.transcricao.trim().length > 0, nome: "A transcrição (recomendada)", opcional: true },
  ];

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-4 xl:sticky xl:top-[calc(var(--pn-barra-altura)+1rem)] xl:self-start">
        {pronto ? (
          <Cartao className="overflow-hidden p-0!" aria-label="Prévia da aula">
            <VideoPlayer src={pronto.previa} titulo="Prévia da aula" labels={playerPt} />
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <p className="font-mono text-xs text-ink-soft">
                {relogio(pronto.medidas.duracao)} · {pronto.medidas.largura}×{pronto.medidas.altura} · {megas(pronto.blob.size)}
              </p>
              <Botao pequeno onClick={() => setPronto(null)}>
                Descartar e gravar de novo
              </Botao>
            </div>
          </Cartao>
        ) : (
          <Gravador aoTerminar={setPronto} />
        )}
        <details className="pn-cartao text-sm text-ink-soft">
          <summary className="cursor-pointer font-semibold text-ink">Como funciona e o que você autoriza</summary>
          <p className="mt-2">Aulas curtas em vídeo, de até 10 minutos e até 480p, para complementar as trilhas. Grave aqui mesmo (câmera ou tela, com o seu microfone) ou envie um vídeo pronto. Como toda aula, ela passa pela revisão antes de ir ao ar e precisa de pelo menos uma fonte. Escrever a transcrição deixa a aula acessível para quem não ouve.</p>
          <p className="mt-2">Ao enviar, você autoriza a publicação da sua imagem e da sua voz nesta aula, com o seu nome público, sob a mesma licença das aulas escritas (CC BY-SA 4.0). Não grave outras pessoas sem a autorização delas.</p>
        </details>
      </div>

      <div className="min-w-0 space-y-4">
        <Cartao titulo={<Passo n={1} nome="Detalhes" />}>
          <div className="mt-3 space-y-3">
            <Campo rotulo="Título" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} maxLength={160} />
            <Area rotulo="Do que a aula trata" ajuda="Aparece abaixo do vídeo." value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} maxLength={2000} rows={3} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Selecao rotulo="Disciplina" value={form.disciplina} onChange={(e) => setForm({ ...form, disciplina: e.target.value, trilha: "" })}>
                {disciplinas.map((area) => (
                  <option key={area} value={area}>
                    {t.areas[area as keyof typeof t.areas]?.[0] ?? area}
                  </option>
                ))}
              </Selecao>
              <Selecao rotulo="Trilha (opcional)" value={form.trilha} onChange={(e) => setForm({ ...form, trilha: e.target.value })}>
                <option value="">Nenhuma: aula avulsa da disciplina</option>
                {tracks
                  .filter((track) => track.area === form.disciplina)
                  .map((track) => (
                    <option key={track.slug} value={track.slug}>
                      {track.title}
                    </option>
                  ))}
              </Selecao>
            </div>
          </div>
        </Cartao>

        <Cartao titulo={<Passo n={2} nome="Acessibilidade" />} sobre="Quem não ouve acompanha a aula pelo texto e pelas legendas.">
          <div className="mt-3">
            <Area rotulo="Transcrição" value={form.transcricao} onChange={(e) => setForm({ ...form, transcricao: e.target.value })} maxLength={60000} rows={6} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Botao pequeno carregando={transcrevendo} disabled={!pronto || transcrevendo} onClick={() => void transcrever()}>{transcrevendo ? "Transcrevendo…" : "Transcrever automaticamente (Whisper)"}</Botao>
            <span className="text-xs text-ink-soft">
              {pronto
                ? "Manda o vídeo ao Whisper e preenche a transcrição e a legenda (vídeos de até 25 MB, uns 10 minutos). Revise antes de enviar."
                : "Primeiro grave ou escolha o vídeo no passo 1: o botão acende quando o vídeo estiver pronto."}
            </span>
          </div>
          <label className="pn-campo-bloco mt-4 block">
            <span className="pn-rotulo">Legendas em WebVTT (opcional, arquivo .vtt)</span>
            <input
              type="file"
              accept=".vtt,text/vtt"
              onChange={async (e) => {
                const arquivo = e.target.files?.[0];
                if (!arquivo) return setForm({ ...form, legenda: "" });
                const texto = await arquivo.text();
                if (!texto.startsWith("WEBVTT") || texto.length > 200000) {
                  setAviso("O arquivo de legendas precisa ser WebVTT (começa com WEBVTT) e ter até 200 mil caracteres.");
                  e.target.value = "";
                  return;
                }
                setForm({ ...form, legenda: texto });
              }}
              className="pn-campo text-sm"
            />
            {form.legenda && (
              <span className="mt-1 block">
                <Selo tom="ok" ponto>Legenda pronta</Selo>
              </span>
            )}
          </label>
        </Cartao>

        <Cartao titulo={<Passo n={3} nome="Fontes" />}>
          <div className="mt-3">
            <SourcesField value={fontes} onChange={setFontes} labels={fontesPt} />
          </div>
        </Cartao>

        <Cartao variante="destaque" aria-label="Enviar para revisão">
          <ul className="space-y-1.5 text-sm">
            {lista.map((item) => (
              <li key={item.nome} className={`flex items-center gap-2 ${item.feito ? "" : "text-ink-soft"}`}>
                <span aria-hidden className={`flex h-5 w-5 items-center justify-center rounded-full border ${item.feito ? "border-ok bg-ok text-[var(--pn-superficie)]" : "border-[var(--pn-borda-forte)]"}`}>{item.feito && <Desenho nome="certo" className="h-3 w-3" />}</span>
                <span className="sr-only">{item.feito ? "✓" : ""}</span>
                {item.nome}
              </li>
            ))}
          </ul>
          <Botao variante="principal" className="mt-4 w-full justify-center" carregando={enviando} disabled={!pronto || enviando || acao.ocupado} onClick={() => void enviar()}>
            {enviando ? "Enviando…" : "Enviar para revisão"}
          </Botao>
          <Aviso texto={aviso || acao.aviso} />
        </Cartao>
      </div>
    </div>
  );
}

/** Grava da câmera ou da tela, com o microfone, em até 480p, parando sozinho nos 10 minutos. Ou recebe um arquivo pronto. */
function Gravador({ aoTerminar }: { aoTerminar: (pronto: Pronto) => void }) {
  const [modo, setModo] = useState<"camera" | "tela" | "ambos">("camera");
  // Um PDF aberto aqui mesmo, para compartilhar esta aba enquanto grava.
  const [pdf, setPdf] = useState<string | null>(null);
  const extras = useRef<MediaStream[]>([]);
  const quadro = useRef<number | null>(null);
  const [estado, setEstado] = useState<"parado" | "pronto" | "gravando" | "convertendo">("parado");
  const [segundos, setSegundos] = useState(0);
  const [progresso, setProgresso] = useState(0);
  const [aviso, setAviso] = useState("");
  const espelho = useRef<HTMLVideoElement>(null);
  const fluxo = useRef<MediaStream | null>(null);
  const gravador = useRef<MediaRecorder | null>(null);
  const relogioRef = useRef<number | null>(null);
  const cancelar = useRef<AbortController | null>(null);
  const arquivo = useRef<HTMLInputElement>(null);
  const formato = typeof window === "undefined" ? null : formatoDeGravacao();

  const desligar = () => {
    fluxo.current?.getTracks().forEach((faixa) => faixa.stop());
    fluxo.current = null;
    extras.current.forEach((s) => s.getTracks().forEach((faixa) => faixa.stop()));
    extras.current = [];
    if (quadro.current) window.cancelAnimationFrame(quadro.current);
    quadro.current = null;
    if (relogioRef.current) window.clearInterval(relogioRef.current);
    relogioRef.current = null;
  };
  // Ao sair da tela, a câmera e o microfone são desligados (a luz da câmera apaga).
  useEffect(
    () => () => {
      fluxo.current?.getTracks().forEach((faixa) => faixa.stop());
      extras.current.forEach((s) => s.getTracks().forEach((faixa) => faixa.stop()));
      if (quadro.current) window.cancelAnimationFrame(quadro.current);
      if (relogioRef.current) window.clearInterval(relogioRef.current);
    },
    [],
  );

  /** Tela e câmera ao mesmo tempo: a tela inteira e a câmera num canto, desenhadas num quadro de 854 por 480. */
  function compor(tela: MediaStream, camera: MediaStream): MediaStream {
    const tela2 = document.createElement("video");
    const cam = document.createElement("video");
    tela2.srcObject = tela;
    cam.srcObject = camera;
    tela2.muted = cam.muted = true;
    void tela2.play();
    void cam.play();
    const canvas = document.createElement("canvas");
    canvas.width = 854;
    canvas.height = 480;
    const ctx = canvas.getContext("2d")!;
    const desenhar = () => {
      ctx.fillStyle = "#17130e";
      ctx.fillRect(0, 0, 854, 480);
      if (tela2.videoWidth) {
        const k = Math.min(854 / tela2.videoWidth, 480 / tela2.videoHeight);
        const w = tela2.videoWidth * k;
        const h = tela2.videoHeight * k;
        ctx.drawImage(tela2, (854 - w) / 2, (480 - h) / 2, w, h);
      }
      if (cam.videoWidth) {
        const w = 214;
        const h = (cam.videoHeight / cam.videoWidth) * w;
        ctx.fillStyle = "#c21f16";
        ctx.fillRect(854 - w - 20, 480 - h - 20, w + 6, h + 6);
        ctx.drawImage(cam, 854 - w - 17, 480 - h - 17, w, h);
      }
      quadro.current = window.requestAnimationFrame(desenhar);
    };
    desenhar();
    extras.current = [tela, camera];
    return canvas.captureStream(24);
  }

  async function finalizar(blob: Blob, usado: Formato, podeConverter = true) {
    try {
      const medidas = await medir(blob);
      if (medidas.duracao > LIMITE_SEGUNDOS) throw new VideoErro("longo");
      // A câmera nem sempre respeita o tamanho pedido (há celulares e câmeras que entregam 720p mesmo assim): passou de
      // 480p ou do peso, converte aqui mesmo, como no vídeo enviado pronto, em vez de recusar a gravação.
      if ((!cabe(medidas) || blob.size > LIMITE_BYTES) && podeConverter) {
        setEstado("convertendo");
        setProgresso(0);
        cancelar.current = new AbortController();
        const convertido = await converterPara720p(blob, setProgresso, cancelar.current.signal);
        setEstado("parado");
        return finalizar(convertido.blob, convertido.formato, false);
      }
      if (blob.size > LIMITE_BYTES) throw new VideoErro("pesado");
      if (!cabe(medidas)) throw new VideoErro("formato");
      aoTerminar({ blob, formato: usado, medidas, previa: URL.createObjectURL(blob) });
    } catch (erro) {
      setEstado("parado");
      setAviso(erroDe(erro));
    }
  }

  async function ligar() {
    setAviso("");
    try {
      const microfone = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      let imagem: MediaStream;
      if (modo === "camera") imagem = await navigator.mediaDevices.getUserMedia({ video: restricoesDeVideo });
      else if (modo === "tela") imagem = await navigator.mediaDevices.getDisplayMedia({ video: restricoesDeVideo, audio: false });
      else {
        const tela = await navigator.mediaDevices.getDisplayMedia({ video: restricoesDeVideo, audio: false });
        const camera = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 24, max: 30 } } });
        imagem = compor(tela, camera);
      }
      fluxo.current = new MediaStream([...imagem.getVideoTracks(), ...microfone.getAudioTracks()]);
      if (espelho.current) {
        espelho.current.srcObject = fluxo.current;
        espelho.current.muted = true;
        void espelho.current.play();
      }
      setEstado("pronto");
    } catch {
      setAviso(modo === "camera" ? "Não foi possível ligar a câmera e o microfone. Confira se o navegador tem permissão." : "A gravação da tela foi cancelada ou não é permitida neste aparelho.");
      desligar();
    }
  }

  function gravar() {
    if (!fluxo.current || !formato) return;
    const pedacos: Blob[] = [];
    const usado = formato;
    const rec = new MediaRecorder(fluxo.current, opcoesDoGravador(usado));
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) pedacos.push(e.data);
    };
    rec.onstop = () => {
      desligar();
      setEstado("parado");
      void finalizar(new Blob(pedacos, { type: usado.tipo }), usado);
    };
    gravador.current = rec;
    rec.start(1000);
    setSegundos(0);
    setEstado("gravando");
    const inicio = Date.now();
    relogioRef.current = window.setInterval(() => {
      const passados = Math.floor((Date.now() - inicio) / 1000);
      setSegundos(passados);
      // O limite é de 10 minutos: a gravação para sozinha.
      if (passados >= LIMITE_SEGUNDOS && rec.state === "recording") rec.stop();
    }, 250);
  }

  async function escolher(arquivo: File) {
    setAviso("");
    if (!/^video\//.test(arquivo.type)) return setAviso(mensagensDeVideo.formato);
    try {
      const medidas = await medir(arquivo);
      if (medidas.duracao > LIMITE_SEGUNDOS) throw new VideoErro("longo");
      const tipo = arquivo.type === "video/mp4" ? "video/mp4" : arquivo.type === "video/webm" ? "video/webm" : null;
      if (cabe(medidas) && tipo && arquivo.size <= LIMITE_BYTES) {
        aoTerminar({ blob: arquivo, formato: { mime: tipo, tipo, extensao: tipo === "video/mp4" ? "mp4" : "webm" }, medidas, previa: URL.createObjectURL(arquivo) });
        return;
      }
      // Maior que 480p, pesado demais ou num formato que o site não guarda: converte aqui mesmo.
      setEstado("convertendo");
      setProgresso(0);
      cancelar.current = new AbortController();
      const { blob, formato: usado } = await converterPara720p(arquivo, setProgresso, cancelar.current.signal);
      setEstado("parado");
      await finalizar(blob, usado, false);
    } catch (erro) {
      setEstado("parado");
      setAviso(erroDe(erro));
    }
  }

  const ligado = estado === "pronto" || estado === "gravando";
  // A área da imagem é escura como a tela de um estúdio: usa os tokens do menu em tinta, que valem nos dois temas.
  return (
    <Cartao as="div" className="overflow-hidden p-0!">
      {formato && estado !== "convertendo" && (
        <div className="grid grid-cols-3 gap-px border-b border-[var(--pn-borda)] bg-[var(--pn-borda)]" role="radiogroup" aria-label="O que gravar">
          {(
            [
              ["camera", "Câmera", "camera"],
              ["tela", "Tela", "tela"],
              ["ambos", "Tela e câmera", "ambos"],
            ] as const
          ).map(([id, nome, desenho]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={modo === id}
              disabled={estado === "gravando"}
              onClick={() => setModo(id)}
              className={`flex cursor-pointer flex-col items-center gap-1 px-2 py-3 text-xs focus-visible:relative focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--pn-foco)] disabled:cursor-not-allowed ${modo === id ? "bg-[var(--pn-ativo)] font-semibold text-ink shadow-[inset_0_-2px_0_var(--pn-destaque-vivo)]" : "bg-[var(--pn-superficie)] text-ink-soft hover:text-ink"}`}
            >
              <Desenho nome={desenho} className="h-5 w-5" />
              {nome}
            </button>
          ))}
        </div>
      )}

      <div className="relative aspect-video w-full bg-[var(--pn-menu-fundo)]">
        <video ref={espelho} playsInline className={`h-full w-full object-contain ${ligado ? "" : "hidden"}`} />
        {!ligado && estado !== "convertendo" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-[var(--pn-menu-texto-suave)]">
            <Desenho nome={modo === "camera" ? "camera" : modo === "tela" ? "tela" : "ambos"} className="h-10 w-10 opacity-70" />
            <p className="max-w-sm text-sm">{formato ? (modo === "camera" ? "Ligue a câmera para ver a imagem aqui antes de gravar." : "Escolha a tela (ou a aba com o PDF) para ver aqui antes de gravar.") : `${mensagensDeVideo.sem_gravador} Você ainda pode enviar um vídeo pronto, em MP4 ou WebM.`}</p>
          </div>
        )}
        {estado === "convertendo" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-[var(--pn-menu-texto)]">
            <p>Convertendo para 480p. Leva o mesmo tempo que o vídeo dura; deixe esta página aberta.</p>
            <progress value={progresso} max={1} className="w-full max-w-sm accent-[var(--pn-menu-destaque)]" aria-label="Andamento da conversão" />
            <p className="font-mono text-sm">{Math.round(progresso * 100)}%</p>
            <button type="button" className="cursor-pointer rounded-[var(--pn-raio)] text-sm underline focus-visible:outline-2 focus-visible:outline-[var(--pn-menu-destaque)]" onClick={() => cancelar.current?.abort()}>Cancelar</button>
          </div>
        )}
        {estado === "gravando" && (
          <p className="absolute left-3 top-3 flex items-center gap-2 rounded-[var(--pn-raio)] bg-[var(--pn-menu-fundo)]/80 px-2 py-1 font-mono text-xs font-bold text-[var(--pn-menu-texto)]">
            <span aria-hidden className="h-2 w-2 rounded-full bg-[var(--pn-menu-destaque)] motion-safe:animate-pulse" />
            REC {relogio(segundos)}
          </p>
        )}
      </div>

      {ligado && (
        <div className="h-1 bg-[var(--pn-borda)]" role="progressbar" aria-label="Tempo de gravação" aria-valuemin={0} aria-valuemax={LIMITE_SEGUNDOS} aria-valuenow={segundos}>
          <div className={`h-1 ${estado === "gravando" ? "bg-[var(--pn-destaque)]" : "bg-ink-soft"}`} style={{ width: `${Math.min(100, (100 * segundos) / LIMITE_SEGUNDOS)}%` }} />
        </div>
      )}

      {estado !== "convertendo" && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          {formato && estado === "parado" && (
            <Botao variante="principal" simbolo={modo === "camera" ? Video : Monitor} onClick={() => void ligar()}>
              {modo === "camera" ? "Ligar a câmera" : modo === "tela" ? "Escolher a tela" : "Escolher a tela e ligar a câmera"}
            </Botao>
          )}
          {estado === "pronto" && (
            <Botao variante="principal" simbolo={CircleDot} onClick={gravar}>
              Começar a gravar
            </Botao>
          )}
          {estado === "gravando" && (
            <Botao simbolo={Square} onClick={() => gravador.current?.stop()}>
              Parar
            </Botao>
          )}
          {ligado && (
            <span className="font-mono text-sm tabular-nums text-ink-soft" role="timer" aria-live="off">
              {relogio(segundos)} de {relogio(LIMITE_SEGUNDOS)}
            </span>
          )}
          {formato && modo !== "camera" && estado !== "gravando" && (
            <label className="pn-elo inline-flex cursor-pointer items-center gap-1 rounded-[var(--pn-raio)] text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--pn-foco)]">
              <FileText aria-hidden className="h-4 w-4" />
              {pdf ? "Trocar o PDF" : "Mostrar um PDF"}
              <input type="file" accept="application/pdf" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { if (pdf) URL.revokeObjectURL(pdf); setPdf(URL.createObjectURL(f)); } }} />
            </label>
          )}
          {estado === "parado" && (
            <>
              <Botao variante="discreto" simbolo={Upload} className="ml-auto" onClick={() => arquivo.current?.click()}>
                Enviar um vídeo pronto
              </Botao>
              <input
                ref={arquivo}
                type="file"
                accept="video/mp4,video/webm,video/*"
                hidden
                onChange={(e) => {
                  const escolhido = e.target.files?.[0];
                  e.target.value = "";
                  if (escolhido) void escolher(escolhido);
                }}
              />
            </>
          )}
        </div>
      )}

      {pdf && (
        <div className="border-t border-[var(--pn-borda)] p-4">
          <p className="text-xs text-ink-soft">
            O PDF abre aqui embaixo. Ao escolher a tela, compartilhe <strong>esta aba</strong>: o que você rolar no PDF entra na gravação.{" "}
            <Botao variante="discreto" pequeno simbolo={X} onClick={() => { URL.revokeObjectURL(pdf); setPdf(null); }}>Fechar o PDF</Botao>
          </p>
          <object data={pdf} type="application/pdf" className="mt-2 h-[60vh] w-full rounded-[var(--pn-raio)] border border-[var(--pn-borda)]" aria-label="PDF da aula">
            <p className="p-3 text-ink-soft">Este navegador não mostra PDF aqui dentro: abra o arquivo em outra aba e compartilhe aquela aba.</p>
          </object>
        </div>
      )}
      <p className="border-t border-[var(--pn-borda)] px-4 py-3 text-xs text-ink-soft">Dica: um lugar silencioso e bem iluminado, a câmera na altura dos olhos e frases curtas. Se travar, pare e grave de novo: são só 10 minutos.</p>
      <div className="px-4 pb-3">
        <Aviso texto={aviso} />
      </div>
    </Cartao>
  );
}

/** Abre o vídeo de uma aula (pede o endereço assinado na hora de tocar). */
function Assistir({ aula }: { aula: Videoaula }) {
  const [endereco, setEndereco] = useState("");
  const [erro, setErro] = useState("");
  useEffect(() => {
    let vivo = true;
    enderecoDoVideo(aula.caminho)
      .then((url) => vivo && setEndereco(url))
      .catch(() => vivo && setErro("Não foi possível abrir o vídeo agora."));
    return () => {
      vivo = false;
    };
  }, [aula.caminho]);
  if (erro) return <Faixa tom="erro">{erro}</Faixa>;
  if (!endereco) return <Esqueleto linhas={2} rotulo="Abrindo o vídeo…" />;
  return <VideoPlayer src={endereco} titulo={aula.titulo} legenda={aula.legenda} transcricao={aula.transcricao} labels={playerPt} />;
}

function Minhas({ lista, erro, recarregar, gravar }: { lista: Videoaula[] | null; erro: string; recarregar: () => void; gravar: () => void }) {
  const { t } = useI18n();
  const acao = useAcao(recarregar);
  const [aberta, setAberta] = useState<string | null>(null);
  const tocando = lista?.find((aula) => aula.id === aberta) ?? null;
  return (
    <section className="space-y-4">
      {erro && <Faixa tom="erro" acao={<Botao pequeno onClick={recarregar}>Tentar de novo</Botao>}>{erro}</Faixa>}
      <Aviso texto={acao.aviso} />
      {lista === null && !erro && <Esqueleto forma="cartoes" />}
      {lista?.length === 0 && (
        <Vazio
          simbolo={Play}
          titulo="Sua primeira aula em vídeo"
          texto="Até 10 minutos, gravada aqui mesmo com a câmera ou a tela. Passa pela revisão e entra nas trilhas."
          acao={<Botao variante="principal" simbolo={CircleDot} onClick={gravar}>Gravar agora</Botao>}
        />
      )}
      {tocando && (
        <Cartao className="overflow-hidden p-0!" aria-label={tocando.titulo}>
          <Assistir aula={tocando} />
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <p className="font-serif text-lg font-semibold">{tocando.titulo}</p>
            <Botao variante="discreto" pequeno simbolo={X} onClick={() => setAberta(null)}>Fechar</Botao>
          </div>
        </Cartao>
      )}
      {(lista?.length ?? 0) > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {lista?.map((aula) => (
            <li key={aula.id} className="pn-cartao overflow-hidden p-0!">
              <button type="button" onClick={() => setAberta(aula.id)} className="group relative block aspect-video w-full cursor-pointer bg-gradient-to-br from-[var(--pn-menu-superficie)] to-[var(--pn-menu-fundo)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--pn-foco)]" aria-label={`Assistir: ${aula.titulo}`}>
                <span aria-hidden className="absolute left-3 top-3 font-serif text-3xl font-bold text-[var(--pn-menu-texto)] opacity-20">{(t.areas[aula.disciplina as keyof typeof t.areas]?.[0] ?? aula.disciplina).slice(0, 1)}</span>
                <span aria-hidden className="absolute inset-0 m-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--pn-menu-texto)] text-[var(--pn-menu-fundo)] motion-safe:transition-transform motion-safe:group-hover:scale-110"><Desenho nome="play" className="h-5 w-5" /></span>
                <span className="absolute bottom-2 right-2 rounded-[var(--pn-raio)] bg-[var(--pn-menu-fundo)]/85 px-1.5 py-0.5 font-mono text-xs text-[var(--pn-menu-texto)]">{relogio(aula.duracao)}</span>
              </button>
              <div className="p-3">
                <p className="flex flex-wrap items-center gap-1.5 text-xs">
                  <Selo tom={TOM[aula.status]} ponto>{situacao[aula.status]}</Selo>
                  <span className="text-ink-soft">{t.areas[aula.disciplina as keyof typeof t.areas]?.[0] ?? aula.disciplina} · {data(aula.criado_em)}</span>
                </p>
                <p className="mt-1 font-semibold leading-snug">{aula.titulo}</p>
                {aula.nota && (
                  <Faixa tom="aviso" semSimbolo className="mt-2 text-sm">
                    Nota da curadoria: {aula.nota}
                  </Faixa>
                )}
                <NoYoutube aula={aula} />
                {aula.status !== "aprovada" && (
                  <Botao
                    variante="discreto"
                    pequeno
                    perigo
                    simbolo={Trash2}
                    className="mt-2"
                    disabled={acao.ocupado}
                    onClick={async () => {
                      if (!(await confirmarFrase("Apagar esta aula em vídeo? O arquivo também é apagado."))) return;
                      const resposta = (await acao.agir("videoaula_apagar", { p_id: aula.id }, "Aula apagada.")) as { caminho?: string } | null;
                      if (resposta?.caminho) await apagarVideo(resposta.caminho).catch(() => undefined);
                    }}
                  >
                    Apagar
                  </Botao>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Revisar({ me, fila, erro, recarregar }: { me: Me; fila: Videoaula[] | null; erro: string; recarregar: () => void }) {
  const { t } = useI18n();
  const acao = useAcao(recarregar);
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [conferido, setConferido] = useState<Record<string, string[]>>({});
  const decide = can(me, "coordenacao", "curadoria");
  const lista = (fila ?? []).filter((aula) => !aula.minha || can(me, "coordenacao"));
  const itens = ["O som está claro", "A imagem dá para ler", "O conteúdo está correto", "As fontes conferem", "Ninguém aparece sem autorização"];
  return (
    <section className="space-y-4">
      {!decide && <Faixa tom="info">Você vê as aulas da sua disciplina para dar a sua opinião à curadoria pelo Mural da equipe. Quem aprova ou recusa é a curadoria.</Faixa>}
      {erro && <Faixa tom="erro" acao={<Botao pequeno onClick={recarregar}>Tentar de novo</Botao>}>{erro}</Faixa>}
      <Aviso texto={acao.aviso} />
      {fila === null && !erro && <Esqueleto forma="cartoes" />}
      {fila !== null && lista.length === 0 && <Vazio simbolo={Eye} titulo="Nada esperando revisão" texto="Quando alguém enviar uma aula em vídeo da sua disciplina, ela aparece aqui." />}
      <ul className="space-y-5">
        {lista.map((aula) => {
          const marcados = conferido[aula.id] ?? [];
          return (
            <li key={aula.id}>
              <Cartao as="article" aria-label={aula.titulo} className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                <div className="min-w-0 space-y-3">
                  <div className="overflow-hidden rounded-[var(--pn-raio)]">
                    <Assistir aula={aula} />
                  </div>
                  <p className="font-mono text-xs text-ink-soft">{relogio(aula.duracao)} · {aula.largura}×{aula.altura} · {megas(aula.tamanho)}</p>
                </div>
                <div className="min-w-0 space-y-3">
                  <p className="flex flex-wrap items-center gap-2">
                    <Selo tom={TOM[aula.status]} ponto>{situacao[aula.status]}</Selo>
                    <span className="pn-rotulo-mono">{t.areas[aula.disciplina as keyof typeof t.areas]?.[0] ?? aula.disciplina} · {aula.nome_autor || "sem nome"}</span>
                  </p>
                  <h3 className="font-serif text-xl font-semibold leading-snug">{aula.titulo}</h3>
                  {aula.descricao && <p className="whitespace-pre-line text-sm" data-original>{aula.descricao}</p>}
                  {aula.fontes && aula.fontes.length > 0 && (
                    <div className="text-sm">
                      <p className="font-semibold">Fontes</p>
                      <ul className="mt-1 list-disc pl-5 text-ink-soft">
                        {aula.fontes.map((fonte) => (
                          <li key={fonte.titulo}>
                            {fonte.titulo}
                            {fonte.autor ? ` (${fonte.autor})` : ""} {fonte.url && <a href={fonte.url} target="_blank" rel="noopener noreferrer" className="pn-elo">abrir</a>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <fieldset className="rounded-[var(--pn-raio)] border border-[var(--pn-borda)] p-3 text-sm">
                    <legend className="px-1 font-semibold">O que conferir</legend>
                    <div className="space-y-1">
                      {itens.map((item) => (
                        <Marca key={item} rotulo={item} checked={marcados.includes(item)} onChange={(e) => setConferido({ ...conferido, [aula.id]: e.target.checked ? [...marcados, item] : marcados.filter((x) => x !== item) })} />
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-ink-soft">Só para você se guiar: não fica guardado.</p>
                  </fieldset>
                  {decide && (
                    <div className="space-y-2">
                      <Area rotulo="Nota para quem gravou" ajuda="Obrigatória para recusar." value={notas[aula.id] ?? ""} onChange={(e) => setNotas({ ...notas, [aula.id]: e.target.value })} maxLength={1000} rows={2} />
                      <div className="flex flex-wrap gap-2">
                        <Botao
                          variante="principal"
                          simbolo={Check}
                          disabled={acao.ocupado}
                          onClick={async () => {
                            const ok = await acao.agir("videoaula_decidir", { p_id: aula.id, p_aprovar: true, p_nota: notas[aula.id] ?? "" }, "Aula aprovada. Ela já está no ar e vai também para o YouTube do instituto.");
                            // O envio ao YouTube segue sozinho; se o canal não estiver ligado ou falhar, dá para tentar de novo em "No ar".
                            if (ok !== null) void pedirAoCanal({ acao: "enviar", id: aula.id });
                          }}
                        >
                          Aprovar e pôr no ar
                        </Botao>
                        <Botao perigo disabled={acao.ocupado || (notas[aula.id] ?? "").trim().length < 5} onClick={() => acao.agir("videoaula_decidir", { p_id: aula.id, p_aprovar: false, p_nota: notas[aula.id] ?? "" }, "Aula recusada. Quem gravou lê a sua nota.")}>
                          Recusar
                        </Botao>
                      </div>
                    </div>
                  )}
                </div>
              </Cartao>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Só a coordenação: as aulas que estão no ar, a cópia de cada uma no YouTube e o botão de tirar do ar. */
function NoAr() {
  const { t } = useI18n();
  const lista = useLista<Videoaula[]>("videoaulas_no_ar");
  const acao = useAcao(lista.recarregar);
  const [nota, setNota] = useState<Record<string, string>>({});
  const [canal, setCanal] = useState<boolean | null>(null);
  const [indo, setIndo] = useState("");
  useEffect(() => {
    void pedirAoCanal({ acao: "situacao" }).then((r) => setCanal(r.ligado ?? false));
  }, []);
  async function aoCanal(acaoNoCanal: "enviar" | "liberar", id: string) {
    setIndo(id);
    acao.setAviso(acaoNoCanal === "enviar" ? "Mandando ao YouTube… (pode levar um ou dois minutos)" : "Conferindo no YouTube…");
    const r = await pedirAoCanal({ acao: acaoNoCanal, id });
    setIndo("");
    acao.setAviso(r.erro ? mensagemDoCanal(r.erro) : r.travado ? "O vídeo está no YouTube, mas o Google ainda o deixa privado: falta a auditoria do projeto (docs/YOUTUBE.md)." : "Pronto: a aula está no YouTube do instituto.");
    lista.recarregar();
  }
  return (
    <section className="space-y-4">
      <Faixa tom={canal ? "ok" : canal === false ? "aviso" : "info"}>
        {canal === null ? "Conferindo o canal do YouTube…" : canal ? "Canal do YouTube ligado: cada aula aprovada vai sozinha para lá, como não listada." : "Canal do YouTube desligado: as aulas tocam só pela cópia do instituto. Para ligar, veja docs/YOUTUBE.md."}
      </Faixa>
      {lista.erro && <Faixa tom="erro" acao={<Botao pequeno onClick={lista.recarregar}>Tentar de novo</Botao>}>{lista.erro}</Faixa>}
      <Aviso texto={acao.aviso} />
      {lista.dados === null && !lista.erro && <Esqueleto forma="fila" />}
      {lista.dados?.length === 0 && <Vazio simbolo={Radio} titulo="Nenhuma aula em vídeo no ar ainda." />}
      {(lista.dados?.length ?? 0) > 0 && (
        <ul aria-label="No ar" className="pn-lista">
          {lista.dados?.map((aula) => (
            <li key={aula.id} className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--pn-borda)] px-3.5 py-3 last:border-b-0">
              <span className="min-w-0">
                <strong>{aula.titulo}</strong> · {t.areas[aula.disciplina as keyof typeof t.areas]?.[0] ?? aula.disciplina} · {aula.nome_autor}
                <NoYoutube aula={aula} />
                {canal && (aula.youtube_situacao === "" || aula.youtube_situacao === "erro" || (aula.youtube_situacao === "enviando" && !aula.youtube)) && (
                  <Botao variante="discreto" pequeno className="mt-1" carregando={indo === aula.id} disabled={Boolean(indo)} onClick={() => void aoCanal("enviar", aula.id)}>
                    {indo === aula.id ? "Mandando…" : aula.youtube_situacao === "erro" ? "Tentar de novo no YouTube" : "Mandar ao YouTube"}
                  </Botao>
                )}
                {canal && aula.youtube_situacao === "travado" && (
                  <Botao variante="discreto" pequeno className="mt-1" carregando={indo === aula.id} disabled={Boolean(indo)} onClick={() => void aoCanal("liberar", aula.id)}>
                    {indo === aula.id ? "Conferindo…" : "Conferir de novo se o Google liberou"}
                  </Botao>
                )}
              </span>
              <span className="flex flex-wrap items-end gap-2">
                <input value={nota[aula.id] ?? ""} onChange={(e) => setNota({ ...nota, [aula.id]: e.target.value })} placeholder="Motivo" aria-label={`Motivo para tirar do ar: ${aula.titulo}`} className="pn-campo w-48" />
                <Botao variante="discreto" pequeno perigo disabled={acao.ocupado || (nota[aula.id] ?? "").trim().length < 5} onClick={() => acao.agir("videoaula_retirar", { p_id: aula.id, p_nota: nota[aula.id] }, "Aula retirada do ar.")}>
                  Tirar do ar
                </Botao>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
