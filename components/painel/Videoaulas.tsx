// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

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
import { Aviso, botao, botaoClaro, campo, data, elo, rotulo, useAcao, useLista } from "./comum";
import { fontesPt } from "./Escrever";

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
        <span className="rounded-sm bg-[#c21f16] px-1.5 py-0.5 font-semibold text-white">YouTube</span>
        <a href={link} target="_blank" rel="noopener noreferrer" className={`${elo} font-mono`}>{link.replace("https://", "")}</a>
        <button
          type="button"
          className={elo}
          onClick={() => {
            navigator.clipboard?.writeText(link).then(() => setCopiado(true), () => undefined);
          }}
        >
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
  return <p className="mt-2 text-xs text-ink-soft">{textos[situacao] ?? textos[""]}</p>;
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

const DESENHOS = {
  gravar: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  minhas: "M4 5h16v11H4zM8 20h8M12 16v4",
  revisar: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  noar: "M5 12a7 7 0 0 1 14 0M8.5 12a3.5 3.5 0 0 1 7 0M12 12v8",
  camera: "M3.5 7h11v10h-11zM14.5 10.5 20.5 7v10l-6-3.5",
  tela: "M3.5 4.5h17v11h-17zM8 20h8M12 15.5V20",
  ambos: "M3.5 4.5h17v11h-17zM13 9.5h5v4h-5zM8 20h8",
  play: "M8 5.5v13l10.5-6.5z",
  certo: "M5 12.5l4.5 4.5L19 7.5",
};
function Desenho({ nome, className = "h-4 w-4" }: { nome: keyof typeof DESENHOS; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d={DESENHOS[nome]} />
    </svg>
  );
}

const TOM: Record<Videoaula["status"], string> = { pendente: "bg-gold/25 text-ink", aprovada: "bg-ok/20 text-ink", recusada: "bg-oxblood/15 text-oxblood" };

/** Aulas em vídeo, no jeito de um estúdio de canal: quem ensina grava ou envia; a curadoria revisa; a coordenação pode tirar do ar. */
export function Videoaulas({ me }: { me: Me }) {
  const revisa = can(me, "coordenacao", "curadoria", "educacao");
  const [aba, setAba] = useState<Aba>("minhas");
  const fila = useLista<Videoaula[]>(revisa ? "videoaulas_fila" : "videoaulas_minhas");
  const minhas = useLista<Videoaula[]>("videoaulas_minhas");
  const lista = minhas.dados ?? [];
  const paraRevisar = fila.dados?.filter((v) => !v.minha).length ?? 0;
  const minutos = Math.round(lista.filter((v) => v.status === "aprovada").reduce((soma, v) => soma + v.duracao, 0) / 60);
  const opcoes: { id: Aba; nome: string; desenho: keyof typeof DESENHOS; conta?: number }[] = [
    { id: "minhas", nome: "Conteúdo", desenho: "minhas" },
    { id: "gravar", nome: "Gravar ou enviar", desenho: "gravar" },
    ...(revisa ? [{ id: "revisar" as const, nome: "Para revisar", desenho: "revisar" as const, conta: paraRevisar }] : []),
    ...(can(me, "coordenacao") ? [{ id: "noar" as const, nome: "No ar", desenho: "noar" as const }] : []),
  ];
  return (
    <div>
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3 border-b border-rule pb-4">
        <dl className="flex flex-wrap gap-x-8 gap-y-2">
          <div>
            <dt className="text-xs text-ink-soft">No ar</dt>
            <dd className="font-serif text-2xl font-semibold">{lista.filter((v) => v.status === "aprovada").length}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-soft">Esperando revisão</dt>
            <dd className="font-serif text-2xl font-semibold">{lista.filter((v) => v.status === "pendente").length}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-soft">Minutos publicados</dt>
            <dd className="font-serif text-2xl font-semibold">{minutos}</dd>
          </div>
        </dl>
        <button type="button" className={`${botao} ml-auto inline-flex items-center gap-2 rounded-md`} onClick={() => setAba("gravar")}>
          <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-[#ff5a4f]" />
          Gravar uma aula
        </button>
      </div>
      <div role="tablist" aria-label="Vistas das aulas em vídeo" className="mt-2 flex flex-wrap gap-1 border-b border-rule">
        {opcoes.map((opcao) => (
          <button key={opcao.id} type="button" role="tab" aria-selected={aba === opcao.id} onClick={() => setAba(opcao.id)} className={`-mb-px flex cursor-pointer items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm ${aba === opcao.id ? "border-ink font-semibold" : "border-transparent text-ink-soft hover:text-ink"}`}>
            <Desenho nome={opcao.desenho} />
            {opcao.nome}
            {opcao.conta ? <span className="rounded-full bg-oxblood px-1.5 text-[0.65rem] font-bold text-parchment">{opcao.conta}</span> : null}
          </button>
        ))}
      </div>
      <div className="mt-5">
        {aba === "gravar" && <Gravar me={me} enviado={() => { minhas.recarregar(); setAba("minhas"); }} />}
        {aba === "minhas" && <Minhas lista={minhas.dados} erro={minhas.erro} recarregar={minhas.recarregar} gravar={() => setAba("gravar")} />}
        {aba === "revisar" && <Revisar me={me} fila={fila.dados ?? []} erro={fila.erro} recarregar={fila.recarregar} />}
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
        setAviso(e === "desligada" ? "A transcrição automática ainda não foi ligada: a coordenação precisa guardar a chave do serviço de Whisper (gratuita, na Groq) como segredo GROQ_API_KEY no Supabase. Até lá, escreva a transcrição à mão ou importe um .vtt." : e === "sem_permissao" ? "A transcrição é só para quem tem função no painel. Saia e entre de novo se acabou de receber a função." : e === "cota" ? "O serviço de transcrição atingiu a cota de agora. Tente mais tarde." : "A transcrição não respondeu. Tente de novo ou escreva à mão.");
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
    return <p className="text-ink-soft">Para gravar aulas em vídeo é preciso ter uma disciplina confiada (educação ou educação secundária). Peça à coordenação em Voluntários e convites.</p>;

  const fontesCertas = cleanSources(fontes).length > 0;
  const lista = [
    { feito: Boolean(pronto), nome: "O vídeo, gravado ou escolhido" },
    { feito: form.titulo.trim().length >= 3, nome: "Um título" },
    { feito: fontesCertas, nome: "Pelo menos uma fonte" },
    { feito: form.transcricao.trim().length > 0, nome: "A transcrição (recomendada)", opcional: true },
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-4 xl:sticky xl:top-4 xl:self-start">
        {pronto ? (
          <section className="overflow-hidden rounded-xl border border-rule bg-parchment-deep">
            <VideoPlayer src={pronto.previa} titulo="Prévia da aula" labels={playerPt} />
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <p className="font-mono text-xs text-ink-soft">
                {relogio(pronto.medidas.duracao)} · {pronto.medidas.largura}×{pronto.medidas.altura} · {megas(pronto.blob.size)}
              </p>
              <button type="button" className={`${botaoClaro} rounded-md px-3 py-1.5 text-sm`} onClick={() => setPronto(null)}>
                Descartar e gravar de novo
              </button>
            </div>
          </section>
        ) : (
          <Gravador aoTerminar={setPronto} />
        )}
        <details className="rounded-lg border border-rule p-4 text-sm text-ink-soft">
          <summary className="cursor-pointer font-semibold text-ink">Como funciona e o que você autoriza</summary>
          <p className="mt-2">Aulas curtas em vídeo, de até 10 minutos e até 480p, para complementar as trilhas. Grave aqui mesmo (câmera ou tela, com o seu microfone) ou envie um vídeo pronto. Como toda aula, ela passa pela revisão antes de ir ao ar e precisa de pelo menos uma fonte. Escrever a transcrição deixa a aula acessível para quem não ouve.</p>
          <p className="mt-2">Ao enviar, você autoriza a publicação da sua imagem e da sua voz nesta aula, com o seu nome público, sob a mesma licença das aulas escritas (CC BY-SA 4.0). Não grave outras pessoas sem a autorização delas.</p>
        </details>
      </div>

      <div className="min-w-0 space-y-4">
        <section className="rounded-xl border border-rule bg-parchment-deep p-5">
          <h2 className="flex items-center gap-2 font-serif text-lg font-semibold"><span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-xs text-parchment">1</span>Detalhes</h2>
          <div className="mt-3 space-y-3">
            <label className="block text-sm font-semibold">
              Título
              <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} maxLength={160} className={campo} />
            </label>
            <label className="block text-sm font-semibold">
              Do que a aula trata
              <span className="block text-xs font-normal text-ink-soft">Aparece abaixo do vídeo.</span>
              <textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} maxLength={2000} rows={3} className={campo} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-semibold">
                Disciplina
                <select value={form.disciplina} onChange={(e) => setForm({ ...form, disciplina: e.target.value, trilha: "" })} className={campo}>
                  {disciplinas.map((area) => (
                    <option key={area} value={area}>
                      {t.areas[area as keyof typeof t.areas]?.[0] ?? area}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold">
                Trilha (opcional)
                <select value={form.trilha} onChange={(e) => setForm({ ...form, trilha: e.target.value })} className={campo}>
                  <option value="">Nenhuma: aula avulsa da disciplina</option>
                  {tracks
                    .filter((track) => track.area === form.disciplina)
                    .map((track) => (
                      <option key={track.slug} value={track.slug}>
                        {track.title}
                      </option>
                    ))}
                </select>
              </label>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-rule bg-parchment-deep p-5">
          <h2 className="flex items-center gap-2 font-serif text-lg font-semibold"><span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-xs text-parchment">2</span>Acessibilidade</h2>
          <p className="mt-1 text-sm text-ink-soft">Quem não ouve acompanha a aula pelo texto e pelas legendas.</p>
          <label className="mt-3 block text-sm font-semibold">
            Transcrição
            <textarea value={form.transcricao} onChange={(e) => setForm({ ...form, transcricao: e.target.value })} maxLength={60000} rows={6} className={campo} />
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" className={`${botaoClaro} rounded-md px-3 py-1.5 text-sm`} disabled={!pronto || transcrevendo} onClick={() => void transcrever()}>{transcrevendo ? "Transcrevendo…" : "Transcrever automaticamente (Whisper)"}</button>
            <span className="text-xs text-ink-soft">
              {pronto
                ? "Manda o vídeo ao Whisper e preenche a transcrição e a legenda (vídeos de até 25 MB, uns 10 minutos). Revise antes de enviar."
                : "Primeiro grave ou escolha o vídeo no passo 1: o botão acende quando o vídeo estiver pronto."}
            </span>
          </div>
          <label className="mt-4 block text-sm font-semibold">
            Legendas em WebVTT (opcional, arquivo .vtt)
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
              className="mt-1 block text-sm font-normal"
            />
            {form.legenda && <span className="mt-1 block text-xs font-normal text-ok">Legenda pronta ✓</span>}
          </label>
        </section>

        <section className="rounded-xl border border-rule bg-parchment-deep p-5">
          <h2 className="flex items-center gap-2 font-serif text-lg font-semibold"><span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-xs text-parchment">3</span>Fontes</h2>
          <div className="mt-3">
            <SourcesField value={fontes} onChange={setFontes} labels={fontesPt} />
          </div>
        </section>

        <section className="rounded-xl border-2 border-ink p-5">
          <ul className="space-y-1.5 text-sm">
            {lista.map((item) => (
              <li key={item.nome} className={`flex items-center gap-2 ${item.feito ? "" : "text-ink-soft"}`}>
                <span aria-hidden className={`flex h-5 w-5 items-center justify-center rounded-full border ${item.feito ? "border-ok bg-ok text-parchment" : "border-rule"}`}>{item.feito && <Desenho nome="certo" className="h-3 w-3" />}</span>
                {item.nome}
              </li>
            ))}
          </ul>
          <button type="button" className={`${botao} mt-4 w-full rounded-md`} disabled={!pronto || enviando || acao.ocupado} onClick={() => void enviar()}>
            {enviando ? "Enviando…" : "Enviar para revisão"}
          </button>
          <Aviso texto={aviso || acao.aviso} />
        </section>
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

  async function finalizar(blob: Blob, usado: Formato) {
    try {
      const medidas = await medir(blob);
      if (blob.size > LIMITE_BYTES) throw new VideoErro("pesado");
      if (!cabe(medidas)) throw new VideoErro(medidas.duracao > LIMITE_SEGUNDOS ? "longo" : "formato");
      aoTerminar({ blob, formato: usado, medidas, previa: URL.createObjectURL(blob) });
    } catch (erro) {
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
      await finalizar(blob, usado);
    } catch (erro) {
      setEstado("parado");
      setAviso(erroDe(erro));
    }
  }

  const ligado = estado === "pronto" || estado === "gravando";
  return (
    <section className="overflow-hidden rounded-xl border border-rule bg-parchment-deep">
      {formato && estado !== "convertendo" && (
        <div className="grid grid-cols-3 gap-px border-b border-rule bg-rule" role="radiogroup" aria-label="O que gravar">
          {(
            [
              ["camera", "Câmera", "camera"],
              ["tela", "Tela", "tela"],
              ["ambos", "Tela e câmera", "ambos"],
            ] as const
          ).map(([id, nome, desenho]) => (
            <button key={id} type="button" role="radio" aria-checked={modo === id} disabled={estado === "gravando"} onClick={() => setModo(id)} className={`flex cursor-pointer flex-col items-center gap-1 px-2 py-3 text-xs disabled:cursor-not-allowed ${modo === id ? "bg-parchment font-semibold text-ink" : "bg-parchment-deep text-ink-soft hover:text-ink"}`}>
              <Desenho nome={desenho} className="h-5 w-5" />
              {nome}
            </button>
          ))}
        </div>
      )}

      <div className="relative aspect-video w-full bg-[#0f0c09]">
        <video ref={espelho} playsInline className={`h-full w-full object-contain ${ligado ? "" : "hidden"}`} />
        {!ligado && estado !== "convertendo" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-[#cdbb91]">
            <Desenho nome={modo === "camera" ? "camera" : modo === "tela" ? "tela" : "ambos"} className="h-10 w-10 opacity-70" />
            <p className="max-w-sm text-sm">{formato ? (modo === "camera" ? "Ligue a câmera para ver a imagem aqui antes de gravar." : "Escolha a tela (ou a aba com o PDF) para ver aqui antes de gravar.") : `${mensagensDeVideo.sem_gravador} Você ainda pode enviar um vídeo pronto, em MP4 ou WebM.`}</p>
          </div>
        )}
        {estado === "convertendo" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-[#f3ead8]">
            <p>Convertendo para 480p. Leva o mesmo tempo que o vídeo dura; deixe esta página aberta.</p>
            <progress value={progresso} max={1} className="w-full max-w-sm" aria-label="Andamento da conversão" />
            <p className="font-mono text-sm">{Math.round(progresso * 100)}%</p>
            <button type="button" className="cursor-pointer text-sm underline" onClick={() => cancelar.current?.abort()}>Cancelar</button>
          </div>
        )}
        {estado === "gravando" && (
          <p className="absolute left-3 top-3 flex items-center gap-2 rounded bg-black/60 px-2 py-1 font-mono text-xs font-bold text-white">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#ff3b30]" />
            REC {relogio(segundos)}
          </p>
        )}
      </div>

      {ligado && (
        <div className="h-1 bg-rule" role="progressbar" aria-label="Tempo de gravação" aria-valuemin={0} aria-valuemax={LIMITE_SEGUNDOS} aria-valuenow={segundos}>
          <div className={`h-1 ${estado === "gravando" ? "bg-[#c21f16]" : "bg-ink-soft"}`} style={{ width: `${Math.min(100, (100 * segundos) / LIMITE_SEGUNDOS)}%` }} />
        </div>
      )}

      {estado !== "convertendo" && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          {formato && estado === "parado" && (
            <button type="button" className={`${botao} rounded-md`} onClick={() => void ligar()}>
              {modo === "camera" ? "Ligar a câmera" : modo === "tela" ? "Escolher a tela" : "Escolher a tela e ligar a câmera"}
            </button>
          )}
          {estado === "pronto" && (
            <button type="button" onClick={gravar} className="flex cursor-pointer items-center gap-2 rounded-full bg-[#c21f16] py-2 pl-2 pr-4 font-semibold text-white hover:bg-[#a51912]">
              <span aria-hidden className="h-6 w-6 rounded-full border-4 border-white/80 bg-[#ff3b30]" />
              Começar a gravar
            </button>
          )}
          {estado === "gravando" && (
            <button type="button" onClick={() => gravador.current?.stop()} className="flex cursor-pointer items-center gap-2 rounded-full bg-ink py-2 pl-2 pr-4 font-semibold text-parchment">
              <span aria-hidden className="h-6 w-6 rounded-md border-4 border-parchment/80 bg-parchment" />
              Parar
            </button>
          )}
          {ligado && (
            <span className="font-mono text-sm tabular-nums text-ink-soft" role="timer" aria-live="off">
              {relogio(segundos)} de {relogio(LIMITE_SEGUNDOS)}
            </span>
          )}
          {formato && modo !== "camera" && estado !== "gravando" && (
            <label className="cursor-pointer text-sm underline hover:text-oxblood">
              {pdf ? "Trocar o PDF" : "Mostrar um PDF"}
              <input type="file" accept="application/pdf" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { if (pdf) URL.revokeObjectURL(pdf); setPdf(URL.createObjectURL(f)); } }} />
            </label>
          )}
          {estado === "parado" && (
            <>
              <button type="button" className="ml-auto cursor-pointer text-sm underline hover:text-oxblood" onClick={() => arquivo.current?.click()}>
                Enviar um vídeo pronto
              </button>
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
        <div className="border-t border-rule p-4">
          <p className="text-xs text-ink-soft">O PDF abre aqui embaixo. Ao escolher a tela, compartilhe <strong>esta aba</strong>: o que você rolar no PDF entra na gravação. <button type="button" className={elo} onClick={() => { URL.revokeObjectURL(pdf); setPdf(null); }}>Fechar o PDF</button></p>
          <object data={pdf} type="application/pdf" className="mt-2 h-[60vh] w-full border border-rule" aria-label="PDF da aula">
            <p className="p-3 text-ink-soft">Este navegador não mostra PDF aqui dentro: abra o arquivo em outra aba e compartilhe aquela aba.</p>
          </object>
        </div>
      )}
      <p className="border-t border-rule px-4 py-3 text-xs text-ink-soft">Dica: um lugar silencioso e bem iluminado, a câmera na altura dos olhos e frases curtas. Se travar, pare e grave de novo: são só 10 minutos.</p>
      <div className="px-4 pb-3">
        <Aviso texto={aviso} />
      </div>
    </section>
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
  if (erro) return <p className="text-oxblood">{erro}</p>;
  if (!endereco) return <p className="painel-carregando text-ink-soft">Abrindo o vídeo…</p>;
  return <VideoPlayer src={endereco} titulo={aula.titulo} legenda={aula.legenda} transcricao={aula.transcricao} labels={playerPt} />;
}

function Minhas({ lista, erro, recarregar, gravar }: { lista: Videoaula[] | null; erro: string; recarregar: () => void; gravar: () => void }) {
  const { t } = useI18n();
  const acao = useAcao(recarregar);
  const [aberta, setAberta] = useState<string | null>(null);
  const tocando = lista?.find((aula) => aula.id === aberta) ?? null;
  return (
    <section>
      <Aviso texto={erro || acao.aviso} />
      {lista?.length === 0 && (
        <div className="rounded-xl border border-dashed border-rule px-6 py-12 text-center">
          <p aria-hidden className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ink text-parchment"><Desenho nome="play" className="h-5 w-5" /></p>
          <p className="mt-4 font-serif text-2xl font-semibold">Sua primeira aula em vídeo</p>
          <p className="mx-auto mt-1 max-w-md text-ink-soft">Até 10 minutos, gravada aqui mesmo com a câmera ou a tela. Passa pela revisão e entra nas trilhas.</p>
          <button type="button" className={`${botao} mt-4 rounded-md`} onClick={gravar}>Gravar agora</button>
        </div>
      )}
      {tocando && (
        <div className="mb-6 overflow-hidden rounded-xl border border-ink bg-parchment-deep">
          <Assistir aula={tocando} />
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <p className="font-serif text-lg font-semibold">{tocando.titulo}</p>
            <button type="button" className={elo} onClick={() => setAberta(null)}>Fechar</button>
          </div>
        </div>
      )}
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {lista?.map((aula) => (
          <li key={aula.id} className="overflow-hidden rounded-xl border border-rule bg-parchment-deep">
            <button type="button" onClick={() => setAberta(aula.id)} className="group relative block aspect-video w-full cursor-pointer bg-gradient-to-br from-[#2b2117] to-[#0f0c09]" aria-label={`Assistir: ${aula.titulo}`}>
              <span aria-hidden className="absolute left-3 top-3 font-serif text-3xl font-bold text-[#f3ead8]/20">{(t.areas[aula.disciplina as keyof typeof t.areas]?.[0] ?? aula.disciplina).slice(0, 1)}</span>
              <span aria-hidden className="absolute inset-0 m-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#f3ead8]/90 text-[#17130e] transition-transform group-hover:scale-110"><Desenho nome="play" className="h-5 w-5" /></span>
              <span className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 font-mono text-xs text-white">{relogio(aula.duracao)}</span>
            </button>
            <div className="p-3">
              <p className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className={`rounded-sm px-1.5 py-0.5 font-medium ${TOM[aula.status]}`}>{situacao[aula.status]}</span>
                <span className="text-ink-soft">{t.areas[aula.disciplina as keyof typeof t.areas]?.[0] ?? aula.disciplina} · {data(aula.criado_em)}</span>
              </p>
              <p className="mt-1 font-semibold leading-snug">{aula.titulo}</p>
              {aula.nota && <p className="mt-2 border-l-2 border-gold pl-2 text-sm">Nota da curadoria: {aula.nota}</p>}
              <NoYoutube aula={aula} />
              {aula.status !== "aprovada" && (
                <button
                  type="button"
                  className={`${elo} mt-2 text-sm text-ink-soft`}
                  disabled={acao.ocupado}
                  onClick={async () => {
                    if (!window.confirm("Apagar esta aula em vídeo? O arquivo também é apagado.")) return;
                    const resposta = (await acao.agir("videoaula_apagar", { p_id: aula.id }, "Aula apagada.")) as { caminho?: string } | null;
                    if (resposta?.caminho) await apagarVideo(resposta.caminho).catch(() => undefined);
                  }}
                >
                  Apagar
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Revisar({ me, fila, erro, recarregar }: { me: Me; fila: Videoaula[]; erro: string; recarregar: () => void }) {
  const { t } = useI18n();
  const acao = useAcao(recarregar);
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [conferido, setConferido] = useState<Record<string, string[]>>({});
  const decide = can(me, "coordenacao", "curadoria");
  const lista = fila.filter((aula) => !aula.minha || can(me, "coordenacao"));
  const itens = ["O som está claro", "A imagem dá para ler", "O conteúdo está correto", "As fontes conferem", "Ninguém aparece sem autorização"];
  return (
    <section>
      {!decide && <p className="mb-4 text-ink-soft">Você vê as aulas da sua disciplina para dar a sua opinião à curadoria pelo Mural da equipe. Quem aprova ou recusa é a curadoria.</p>}
      <Aviso texto={erro || acao.aviso} />
      {lista.length === 0 && (
        <div className="rounded-xl border border-dashed border-rule px-6 py-10 text-center">
          <p className="font-serif text-xl font-semibold">Nada esperando revisão</p>
          <p className="mt-1 text-ink-soft">Quando alguém enviar uma aula em vídeo da sua disciplina, ela aparece aqui.</p>
        </div>
      )}
      <ul className="space-y-6">
        {lista.map((aula) => {
          const marcados = conferido[aula.id] ?? [];
          return (
            <li key={aula.id} className="grid gap-5 rounded-xl border border-rule bg-parchment-deep p-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <div className="min-w-0 space-y-3">
                <div className="overflow-hidden rounded-lg">
                  <Assistir aula={aula} />
                </div>
                <p className="font-mono text-xs text-ink-soft">{relogio(aula.duracao)} · {aula.largura}×{aula.altura} · {megas(aula.tamanho)}</p>
              </div>
              <div className="min-w-0 space-y-3">
                <p className={rotulo}>{t.areas[aula.disciplina as keyof typeof t.areas]?.[0] ?? aula.disciplina} · {aula.nome_autor || "sem nome"}</p>
                <h3 className="font-serif text-xl font-semibold leading-snug">{aula.titulo}</h3>
                {aula.descricao && <p className="whitespace-pre-line text-sm" data-original>{aula.descricao}</p>}
                {aula.fontes && aula.fontes.length > 0 && (
                  <div className="text-sm">
                    <p className="font-semibold">Fontes</p>
                    <ul className="mt-1 list-disc pl-5 text-ink-soft">
                      {aula.fontes.map((fonte) => (
                        <li key={fonte.titulo}>
                          {fonte.titulo}
                          {fonte.autor ? ` (${fonte.autor})` : ""} {fonte.url && <a href={fonte.url} target="_blank" rel="noopener noreferrer" className={elo}>abrir</a>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <fieldset className="rounded-lg border border-rule p-3 text-sm">
                  <legend className="px-1 font-semibold">O que conferir</legend>
                  {itens.map((item) => (
                    <label key={item} className="flex cursor-pointer items-center gap-2 py-0.5">
                      <input type="checkbox" checked={marcados.includes(item)} onChange={(e) => setConferido({ ...conferido, [aula.id]: e.target.checked ? [...marcados, item] : marcados.filter((x) => x !== item) })} />
                      {item}
                    </label>
                  ))}
                  <p className="mt-1 text-xs text-ink-soft">Só para você se guiar: não fica guardado.</p>
                </fieldset>
                {decide && (
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold">
                      Nota para quem gravou
                      <span className="block text-xs font-normal text-ink-soft">Obrigatória para recusar.</span>
                      <textarea value={notas[aula.id] ?? ""} onChange={(e) => setNotas({ ...notas, [aula.id]: e.target.value })} maxLength={1000} rows={2} className={campo} />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={`${botao} rounded-md`}
                        disabled={acao.ocupado}
                        onClick={async () => {
                          const ok = await acao.agir("videoaula_decidir", { p_id: aula.id, p_aprovar: true, p_nota: notas[aula.id] ?? "" }, "Aula aprovada. Ela já está no ar e vai também para o YouTube do instituto.");
                          // O envio ao YouTube segue sozinho; se o canal não estiver ligado ou falhar, dá para tentar de novo em "No ar".
                          if (ok !== null) void pedirAoCanal({ acao: "enviar", id: aula.id });
                        }}
                      >
                        Aprovar e pôr no ar
                      </button>
                      <button type="button" className={`${botaoClaro} rounded-md`} disabled={acao.ocupado || (notas[aula.id] ?? "").trim().length < 5} onClick={() => acao.agir("videoaula_decidir", { p_id: aula.id, p_aprovar: false, p_nota: notas[aula.id] ?? "" }, "Aula recusada. Quem gravou lê a sua nota.")}>
                        Recusar
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
    <section>
      <p className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${canal ? "bg-ok" : canal === false ? "bg-oxblood" : "bg-rule"}`} aria-hidden />
        {canal === null ? "Conferindo o canal do YouTube…" : canal ? "Canal do YouTube ligado: cada aula aprovada vai sozinha para lá, como não listada." : "Canal do YouTube desligado: as aulas tocam só pela cópia do instituto. Para ligar, veja docs/YOUTUBE.md."}
      </p>
      <Aviso texto={lista.erro || acao.aviso} />
      {lista.dados?.length === 0 && <p className="text-ink-soft">Nenhuma aula em vídeo no ar ainda.</p>}
      <ul className="divide-y divide-rule border-y border-rule">
        {lista.dados?.map((aula) => (
          <li key={aula.id} className="flex flex-wrap items-end justify-between gap-3 py-3">
            <span className="min-w-0">
              <strong>{aula.titulo}</strong> · {t.areas[aula.disciplina as keyof typeof t.areas]?.[0] ?? aula.disciplina} · {aula.nome_autor}
              <NoYoutube aula={aula} />
              {canal && (aula.youtube_situacao === "" || aula.youtube_situacao === "erro" || (aula.youtube_situacao === "enviando" && !aula.youtube)) && (
                <button type="button" className={`${elo} mt-1 text-sm`} disabled={Boolean(indo)} onClick={() => void aoCanal("enviar", aula.id)}>
                  {indo === aula.id ? "Mandando…" : aula.youtube_situacao === "erro" ? "Tentar de novo no YouTube" : "Mandar ao YouTube"}
                </button>
              )}
              {canal && aula.youtube_situacao === "travado" && (
                <button type="button" className={`${elo} mt-1 text-sm`} disabled={Boolean(indo)} onClick={() => void aoCanal("liberar", aula.id)}>
                  {indo === aula.id ? "Conferindo…" : "Conferir de novo se o Google liberou"}
                </button>
              )}
            </span>
            <span className="flex flex-wrap items-end gap-2">
              <input value={nota[aula.id] ?? ""} onChange={(e) => setNota({ ...nota, [aula.id]: e.target.value })} placeholder="Motivo" aria-label={`Motivo para tirar do ar: ${aula.titulo}`} className="painel-campo border-2 border-ink bg-parchment-deep px-2 py-1" />
              <button type="button" className={elo} disabled={acao.ocupado || (nota[aula.id] ?? "").trim().length < 5} onClick={() => acao.agir("videoaula_retirar", { p_id: aula.id, p_nota: nota[aula.id] }, "Aula retirada do ar.")}>
                Tirar do ar
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
