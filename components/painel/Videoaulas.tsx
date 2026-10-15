// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import { areaSlugs } from "@/lib/areas";
import { can, type Me } from "@/lib/backend";
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
import { cleanSources, SourcesField, type SourceDraft } from "../Editor";
import { useI18n } from "../I18n";
import { useTrackOptions } from "../useTrackOptions";
import { playerPt, VideoPlayer } from "../VideoPlayer";
import { Abas, Aviso, botao, botaoClaro, campo, data, elo, rotulo, useAcao, useLista } from "./comum";
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

/** Aulas em vídeo: quem ensina grava ou envia; a curadoria revisa; a coordenação pode tirar do ar. */
export function Videoaulas({ me }: { me: Me }) {
  const revisa = can(me, "coordenacao", "curadoria", "educacao");
  const [aba, setAba] = useState<Aba>("gravar");
  const fila = useLista<Videoaula[]>(revisa ? "videoaulas_fila" : "videoaulas_minhas");
  const opcoes: { id: Aba; nome: string; conta?: number }[] = [
    { id: "gravar", nome: "Gravar ou enviar" },
    { id: "minhas", nome: "Minhas aulas em vídeo" },
    ...(revisa ? [{ id: "revisar" as const, nome: "Para revisar", conta: fila.dados?.filter((v) => !v.minha).length }] : []),
    ...(can(me, "coordenacao") ? [{ id: "noar" as const, nome: "No ar" }] : []),
  ];
  return (
    <div>
      <p className="mb-6 max-w-3xl border-l-2 border-gold pl-4 text-ink-soft">
        Aulas curtas em vídeo, de até 10 minutos e até 720p, para complementar as trilhas. Grave aqui mesmo (câmera ou tela, com o seu microfone) ou envie um vídeo pronto. Como toda aula, ela passa pela curadoria antes de ir ao ar e precisa de pelo menos uma fonte. Escrever a transcrição deixa a aula acessível para quem não ouve.
      </p>
      <p className="-mt-3 mb-6 max-w-3xl text-ink-soft">
        Ao enviar, você autoriza a publicação da sua imagem e da sua voz nesta aula, com o seu nome público, sob a mesma licença das aulas escritas (CC BY-SA 4.0). Não grave outras pessoas sem a autorização delas.
      </p>
      <Abas opcoes={opcoes} atual={aba} escolher={setAba} />
      {aba === "gravar" && <Gravar me={me} enviado={() => setAba("minhas")} />}
      {aba === "minhas" && <Minhas />}
      {aba === "revisar" && <Revisar me={me} fila={fila.dados ?? []} erro={fila.erro} recarregar={fila.recarregar} />}
      {aba === "noar" && <NoAr />}
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
  const acao = useAcao();

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

  return (
    <div className="space-y-6">
      {pronto ? (
        <section className="painel-cartao space-y-3 p-5">
          <p className={rotulo}>
            Prévia · {relogio(pronto.medidas.duracao)} · {pronto.medidas.largura}×{pronto.medidas.altura} · {megas(pronto.blob.size)}
          </p>
          <VideoPlayer src={pronto.previa} titulo="Prévia da aula" labels={playerPt} />
          <button type="button" className={botaoClaro} onClick={() => setPronto(null)}>
            Descartar e gravar de novo
          </button>
        </section>
      ) : (
        <Gravador aoTerminar={setPronto} />
      )}

      <section className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            Disciplina
            <select value={form.disciplina} onChange={(e) => setForm({ ...form, disciplina: e.target.value, trilha: "" })} className={campo}>
              {disciplinas.map((area) => (
                <option key={area} value={area}>
                  {t.areas[area as keyof typeof t.areas]?.[0] ?? area}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
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
        <label className="block">
          Título
          <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} maxLength={160} className={campo} />
        </label>
        <label className="block">
          Do que a aula trata (aparece abaixo do vídeo)
          <textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} maxLength={2000} rows={3} className={campo} />
        </label>
        <label className="block">
          Transcrição (recomendado: quem não ouve acompanha a aula pelo texto)
          <textarea value={form.transcricao} onChange={(e) => setForm({ ...form, transcricao: e.target.value })} maxLength={60000} rows={6} className={campo} />
        </label>
        <label className="block">
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
            className="mt-1 block"
          />
        </label>
        <SourcesField value={fontes} onChange={setFontes} labels={fontesPt} />
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={botao} disabled={!pronto || enviando || acao.ocupado} onClick={() => void enviar()}>
            {enviando ? "Enviando…" : "Enviar para revisão"}
          </button>
          {!pronto && <span className="text-ink-soft">Grave ou escolha o vídeo primeiro.</span>}
        </div>
        <Aviso texto={aviso || acao.aviso} />
      </section>
    </div>
  );
}

/** Grava da câmera ou da tela, com o microfone, em até 720p, parando sozinho nos 10 minutos. Ou recebe um arquivo pronto. */
function Gravador({ aoTerminar }: { aoTerminar: (pronto: Pronto) => void }) {
  const [modo, setModo] = useState<"camera" | "tela">("camera");
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
    if (relogioRef.current) window.clearInterval(relogioRef.current);
    relogioRef.current = null;
  };
  // Ao sair da tela, a câmera e o microfone são desligados (a luz da câmera apaga).
  useEffect(
    () => () => {
      fluxo.current?.getTracks().forEach((faixa) => faixa.stop());
      if (relogioRef.current) window.clearInterval(relogioRef.current);
    },
    [],
  );

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
      else imagem = await navigator.mediaDevices.getDisplayMedia({ video: restricoesDeVideo, audio: false });
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
      // Maior que 720p, pesado demais ou num formato que o site não guarda: converte aqui mesmo.
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

  return (
    <section className="painel-cartao space-y-4 p-5">
      <h2 className="font-serif text-xl font-semibold">1. O vídeo</h2>
      {!formato && <p className="border-l-2 border-oxblood pl-3">{mensagensDeVideo.sem_gravador} Você ainda pode enviar um vídeo pronto, em MP4 ou WebM, de até 720p.</p>}
      {estado !== "convertendo" && (
        <div className="flex flex-wrap items-end gap-4">
          {formato && (
            <fieldset className="flex flex-wrap gap-4" disabled={estado === "gravando"}>
              <legend className="sr-only">O que gravar</legend>
              <label className="flex items-center gap-2">
                <input type="radio" name="modo" checked={modo === "camera"} onChange={() => setModo("camera")} /> Câmera
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="modo" checked={modo === "tela"} onChange={() => setModo("tela")} /> Tela (slides, quadro, programa)
              </label>
            </fieldset>
          )}
          {formato && estado === "parado" && (
            <button type="button" className={botao} onClick={() => void ligar()}>
              {modo === "camera" ? "Ligar a câmera" : "Escolher a tela"}
            </button>
          )}
          {estado === "pronto" && (
            <button type="button" className={botao} onClick={gravar}>
              ● Começar a gravar
            </button>
          )}
          {estado === "gravando" && (
            <button type="button" className={botao} onClick={() => gravador.current?.stop()}>
              ■ Parar
            </button>
          )}
          {estado === "parado" && (
            <>
              <button type="button" className={botaoClaro} onClick={() => arquivo.current?.click()}>
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
      {(estado === "pronto" || estado === "gravando") && (
        <div>
          <video ref={espelho} playsInline className="aspect-video w-full max-w-2xl border-2 border-ink bg-black" />
          <p className={`mt-2 font-mono text-lg tabular-nums ${estado === "gravando" ? "text-oxblood" : ""}`} role="timer" aria-live="off">
            {estado === "gravando" ? "● gravando " : ""}
            {relogio(segundos)} de {relogio(LIMITE_SEGUNDOS)}
          </p>
        </div>
      )}
      {estado === "convertendo" && (
        <div className="space-y-2">
          <p>Convertendo para 720p. Leva o mesmo tempo que o vídeo dura; deixe esta página aberta.</p>
          <progress value={progresso} max={1} className="w-full max-w-xl" aria-label="Andamento da conversão" />
          <p className="font-mono text-sm">{Math.round(progresso * 100)}%</p>
          <button type="button" className={elo} onClick={() => cancelar.current?.abort()}>
            Cancelar
          </button>
        </div>
      )}
      <p className="text-ink-soft">Dica: um lugar silencioso e bem iluminado, a câmera na altura dos olhos e frases curtas. Se travar, pare e grave de novo: são só 10 minutos.</p>
      <Aviso texto={aviso} />
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

function Minhas() {
  const { t } = useI18n();
  const lista = useLista<Videoaula[]>("videoaulas_minhas");
  const acao = useAcao(lista.recarregar);
  const [aberta, setAberta] = useState<string | null>(null);
  return (
    <section>
      <Aviso texto={lista.erro || acao.aviso} />
      {lista.dados?.length === 0 && <p className="text-ink-soft">Você ainda não enviou nenhuma aula em vídeo.</p>}
      <ul className="space-y-4">
        {lista.dados?.map((aula) => (
          <li key={aula.id} className="painel-cartao p-4">
            <p className={rotulo}>
              {situacao[aula.status]} · {t.areas[aula.disciplina as keyof typeof t.areas]?.[0] ?? aula.disciplina} · {relogio(aula.duracao)} · enviada em {data(aula.criado_em)}
            </p>
            <p className="mt-1 font-serif text-xl font-semibold">{aula.titulo}</p>
            {aula.nota && <p className="mt-1 border-l-2 border-gold pl-3">Nota da curadoria: {aula.nota}</p>}
            <p className="mt-2 flex flex-wrap gap-4">
              <button type="button" className={elo} onClick={() => setAberta(aberta === aula.id ? null : aula.id)}>
                {aberta === aula.id ? "Fechar" : "Assistir"}
              </button>
              {aula.status !== "aprovada" && (
                <button
                  type="button"
                  className={elo}
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
            </p>
            {aberta === aula.id && (
              <div className="mt-3">
                <Assistir aula={aula} />
              </div>
            )}
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
  const decide = can(me, "coordenacao", "curadoria");
  const lista = fila.filter((aula) => !aula.minha || can(me, "coordenacao"));
  return (
    <section>
      {!decide && <p className="mb-4 text-ink-soft">Você vê as aulas da sua disciplina para dar a sua opinião à curadoria pelo Mural da equipe. Quem aprova ou recusa é a curadoria.</p>}
      <Aviso texto={erro || acao.aviso} />
      {lista.length === 0 && <p className="text-ink-soft">Nenhuma aula em vídeo esperando revisão.</p>}
      <ul className="space-y-6">
        {lista.map((aula) => (
          <li key={aula.id} className="painel-cartao space-y-3 p-5">
            <p className={rotulo}>
              {t.areas[aula.disciplina as keyof typeof t.areas]?.[0] ?? aula.disciplina} · {aula.nome_autor || "sem nome"} · {relogio(aula.duracao)} · {aula.largura}×{aula.altura} · {megas(aula.tamanho)}
            </p>
            <p className="font-serif text-xl font-semibold">{aula.titulo}</p>
            {aula.descricao && <p className="whitespace-pre-line">{aula.descricao}</p>}
            <Assistir aula={aula} />
            {aula.fontes && aula.fontes.length > 0 && (
              <ul className="list-disc pl-5 text-ink-soft">
                {aula.fontes.map((fonte) => (
                  <li key={fonte.titulo}>
                    {fonte.titulo}
                    {fonte.autor ? ` (${fonte.autor})` : ""} {fonte.url && <a href={fonte.url} target="_blank" rel="noopener noreferrer" className={elo}>abrir</a>}
                  </li>
                ))}
              </ul>
            )}
            {decide && (
              <div className="space-y-2">
                <label className="block">
                  Nota para quem gravou (obrigatória para recusar)
                  <textarea value={notas[aula.id] ?? ""} onChange={(e) => setNotas({ ...notas, [aula.id]: e.target.value })} maxLength={1000} rows={2} className={campo} />
                </label>
                <div className="flex flex-wrap gap-3">
                  <button type="button" className={botao} disabled={acao.ocupado} onClick={() => acao.agir("videoaula_decidir", { p_id: aula.id, p_aprovar: true, p_nota: notas[aula.id] ?? "" }, "Aula aprovada. Ela já está no ar.")}>
                    Aprovar
                  </button>
                  <button type="button" className={botaoClaro} disabled={acao.ocupado || (notas[aula.id] ?? "").trim().length < 5} onClick={() => acao.agir("videoaula_decidir", { p_id: aula.id, p_aprovar: false, p_nota: notas[aula.id] ?? "" }, "Aula recusada. Quem gravou lê a sua nota.")}>
                    Recusar
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Só a coordenação: as aulas que estão no ar, com o botão de tirar do ar. */
function NoAr() {
  const { t } = useI18n();
  const lista = useLista<Videoaula[]>("videoaulas_publicas");
  const acao = useAcao(lista.recarregar);
  const [nota, setNota] = useState<Record<string, string>>({});
  return (
    <section>
      <Aviso texto={lista.erro || acao.aviso} />
      {lista.dados?.length === 0 && <p className="text-ink-soft">Nenhuma aula em vídeo no ar ainda.</p>}
      <ul className="divide-y divide-rule border-y border-rule">
        {lista.dados?.map((aula) => (
          <li key={aula.id} className="flex flex-wrap items-end justify-between gap-3 py-3">
            <span>
              <strong>{aula.titulo}</strong> · {t.areas[aula.disciplina as keyof typeof t.areas]?.[0] ?? aula.disciplina} · {aula.nome_autor}
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
