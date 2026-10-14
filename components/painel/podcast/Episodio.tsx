// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { areaSlugs } from "@/lib/areas";
import { BackendError, getClient, rpc } from "@/lib/backend";
import { type Capitulo, escreverCapitulos, escreverVtt, lerCapitulos, lerLegendas, type ObraCitada, relogio, TEMAS } from "@/lib/podcast";
import { analisarAudio, type Analise, baixarPublico, conselhoDeVolume, EnvioError, enviarCapa, enviarComProgresso, extensaoDe, LIMITE_BYTES, liberarEspaco, mensagensDeEnvio, nomeSorteado, prepararCapa, tipoDe, urlPublica } from "@/lib/podcast-audio";
import { useTrackOptions } from "../../useTrackOptions";
import { cleanSources, MarkdownEditor, type SourceDraft, SourcesField } from "../../Editor";
import { useI18n } from "../../I18n";
import { Aviso, Abas, botao, botaoClaro, campo, dataHora, elo, rotulo, textoDoErro, useLista } from "../comum";
import { editorPt, fontesPt } from "../Escrever";
import { EstudioDeArte } from "./Arte";
import { GeradorDeCortes } from "./Cortes";
import { GABARITO, PENDENCIAS } from "./Guia";
import { EnviarCapaSimples, linkDoConvidado, OuvirFechado } from "./Listas";
import { ChecarAfirmacao, CitarObra, FerramentasDoRoteiro, Teleprompter } from "./Roteiro";
import { bytes, type EpisodioCompleto, NOME_DA_ETAPA, type PainelDoPodcast } from "./tipos";

type Aba = "pauta" | "roteiro" | "convidados" | "arquivos" | "revisao" | "publicacao" | "divulgacao" | "historico";

interface ConvidadoBreve {
  id: string;
  nome: string;
  autoriza_voz: boolean;
  link: string | null;
}
interface TrilhaBreve {
  id: string;
  titulo: string;
  autor: string;
  licenca: string;
  tipo: string;
}

const TIPOS_DE_ARQUIVO: Record<string, string> = { bruto: "Bruto (gravação original)", editado: "Editado (para revisão)", final: "Final (vai ao ar)", video: "Vídeo", convidado: "Faixa de convidado", outro: "Outro" };
const NOME_DO_TEMA: Record<string, string> = { historia: "História", economia: "Economia", "luta-social": "Luta social", enem: "ENEM", filosofia: "Filosofia", cultura: "Cultura", ciencia: "Ciência", trabalho: "Trabalho", educacao: "Educação", internacional: "Internacional", memoria: "Memória", atualidade: "Atualidade" };

const mensagemDeErro = (erro: unknown) => {
  const codigo = erro instanceof BackendError ? erro.code : "";
  const proprios: Record<string, string> = {
    lista_incompleta: "Ainda falta coisa na lista de conferência (veja na aba Publicação).",
    aprovar_o_proprio: "Você não pode aprovar o que você mesmo enviou. Peça a outra pessoa da supervisão (ou à coordenação).",
    fora_de_revisao: "O episódio não está esperando aprovação.",
    ja_publicado: "O episódio já está no ar.",
    em_uso: "Este arquivo é o áudio que está no ar. Troque o áudio do episódio antes de remover.",
    falta_termo_convidado: "Para marcar a autorização à mão, anexe o termo assinado na ficha do convidado.",
  };
  return proprios[codigo.split(":")[0]] ?? textoDoErro(erro);
};

/** O editor de um episódio, da pauta à divulgação. Cada aba é uma etapa do trabalho; nada se perde ao trocar de aba. */
export function EditorDeEpisodio({ id, painel, voltar, recarregarPainel }: { id: string; painel: PainelDoPodcast; voltar: () => void; recarregarPainel: () => void }) {
  const { t } = useI18n();
  const { eu } = painel;
  const ver = useLista<EpisodioCompleto>("podcast_ver", { p_id: id });
  const e = ver.dados;
  const soDesign = eu.design && !eu.revisor;
  const [aba, setAba] = useState<Aba>(soDesign ? "publicacao" : "pauta");
  const [rascunho, setRascunho] = useState<Partial<EpisodioCompleto>>({});
  const [capitulosTexto, setCapitulosTexto] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const tocador = useRef<HTMLAudioElement>(null);
  const podeProduzir = eu.producao || eu.supervisao;
  const podeEditar = podeProduzir || eu.edicao;
  const sujo = Object.keys(rascunho).length > 0 || capitulosTexto !== null;

  const valor = <K extends keyof EpisodioCompleto>(chave: K): EpisodioCompleto[K] => (chave in rascunho ? (rascunho[chave] as EpisodioCompleto[K]) : (e as EpisodioCompleto)[chave]);
  const mudar = <K extends keyof EpisodioCompleto>(chave: K, novo: EpisodioCompleto[K]) => setRascunho((r) => ({ ...r, [chave]: novo }));

  // Sair com coisa sem guardar pede confirmação.
  useEffect(() => {
    if (!sujo) return;
    const antes = (ev: BeforeUnloadEvent) => ev.preventDefault();
    window.addEventListener("beforeunload", antes);
    return () => window.removeEventListener("beforeunload", antes);
  }, [sujo]);

  const recarregar = useCallback(() => {
    ver.recarregar();
    recarregarPainel();
  }, [ver, recarregarPainel]);

  async function guardar(): Promise<boolean> {
    if (!e || !sujo) return true;
    setOcupado(true);
    setAviso("");
    try {
      const p: Record<string, unknown> = { ...rascunho };
      if ("fontes" in p) p.fontes = cleanSources((p.fontes as SourceDraft[]) ?? []);
      if (capitulosTexto !== null) p.capitulos = lerCapitulos(capitulosTexto);
      for (const chave of ["temporada", "numero", "duracao_prevista"] as const) if (chave in p) p[chave] = p[chave] === null || p[chave] === undefined ? "" : String(p[chave]);
      await rpc("podcast_salvar", { p_id: e.id, p, p_versao: e.versao });
      setRascunho({});
      setCapitulosTexto(null);
      setAviso("Guardado.");
      recarregar();
      return true;
    } catch (erro) {
      setAviso(mensagemDeErro(erro));
      return false;
    } finally {
      setOcupado(false);
    }
  }

  // Ctrl+S guarda.
  const guardarRef = useRef(guardar);
  useEffect(() => {
    guardarRef.current = guardar;
  });
  useEffect(() => {
    const tecla = (ev: KeyboardEvent) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "s") {
        ev.preventDefault();
        void guardarRef.current();
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);

  async function agir(funcao: string, argumentos: Record<string, unknown>, sucesso: string) {
    if (sujo && !(await guardar())) return null;
    setOcupado(true);
    setAviso("");
    try {
      const r = await rpc<unknown>(funcao, argumentos);
      setAviso(sucesso);
      recarregar();
      return r;
    } catch (erro) {
      setAviso(mensagemDeErro(erro));
      return null;
    } finally {
      setOcupado(false);
    }
  }

  async function publicar() {
    const r = (await agir("podcast_publicar", { p_id: id }, "No ar! O episódio aparece no site em até cinco minutos e nas plataformas na próxima leitura do feed.")) as { liberar?: { deposito: string; caminho: string }[] } | null;
    if (r?.liberar?.length) await liberarEspaco(r.liberar).catch(() => 0);
  }

  if (ver.erro) return <p className="text-oxblood">{ver.erro} <button type="button" className={elo} onClick={voltar}>Voltar</button></p>;
  if (!e) return <p className="font-mono text-xs text-ink-soft">Carregando…</p>;

  const audioDoEpisodio = e.audio && e.audio_guardado ? urlPublica(e.audio) : e.audio_externo;
  const tempoAtual = () => Math.floor(tocador.current?.currentTime ?? 0);
  const serie = painel.series.find((s) => s.id === valor("serie"));
  const abas: { id: Aba; nome: string; conta?: number }[] = soDesign
    ? [
        { id: "publicacao", nome: "Capa" },
        { id: "divulgacao", nome: "Artes" },
      ]
    : [
        { id: "pauta", nome: "Pauta" },
        { id: "roteiro", nome: "Roteiro" },
        { id: "convidados", nome: "Convidados e trilhas" },
        { id: "arquivos", nome: "Arquivos" },
        { id: "revisao", nome: "Revisão", conta: e.comentarios.filter((c) => !c.resolvido).length },
        { id: "publicacao", nome: "Publicação", conta: e.pendencias.length },
        { id: "divulgacao", nome: "Divulgação" },
        { id: "historico", nome: "Histórico" },
      ];

  return (
    <div className="space-y-6">
      <p>
        <button type="button" className={elo} onClick={() => (sujo && !window.confirm("Há alterações sem guardar. Sair mesmo assim?") ? null : voltar())}>← Episódios</button>
      </p>
      <header className="flex flex-wrap items-start gap-5 border-b-4 border-ink pb-5">
        <div className="w-24 shrink-0">
          {e.capa_mini ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={urlPublica(e.capa_mini)} alt="" width={96} height={96} className="aspect-square w-full border-2 border-ink object-cover" />
          ) : (
            <div aria-hidden className="podcast-capa-cartaz aspect-square w-full border-2 border-ink" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-widest">
            <span className={`px-1.5 py-0.5 ${e.status === "publicado" ? "bg-ok text-parchment" : e.status === "revisao" ? "bg-oxblood text-parchment" : "bg-ink text-parchment"}`}>{NOME_DA_ETAPA[e.status]}</span>
            {serie && <span className="text-gold">{serie.titulo}</span>}
            {e.numero != null && <span className="text-gold">#{e.numero}</span>}
            {e.responsavel_nome && <span className="text-ink-soft">resp.: {e.responsavel_nome}</span>}
          </p>
          <h2 className="mt-2 font-serif text-3xl font-semibold leading-tight">{valor("titulo")}</h2>
          {e.nota_supervisao && e.status !== "publicado" && (
            <p className="mt-2 border-l-4 border-oxblood pl-3">
              <strong>Supervisão:</strong> {e.nota_supervisao}
            </p>
          )}
          <Acoes e={e} eu={eu} podeEditar={podeEditar} ocupado={ocupado} agir={agir} publicar={publicar} />
        </div>
        <div className="flex flex-col items-end gap-2">
          {podeEditar && (
            <button type="button" onClick={() => void guardar()} disabled={!sujo || ocupado} className={botao}>
              {ocupado ? "Guardando…" : sujo ? "Guardar (Ctrl+S)" : "Tudo guardado"}
            </button>
          )}
          {e.status === "publicado" && e.slug && (
            <a href={`/pt/podcasts/${e.slug}`} target="_blank" rel="noopener noreferrer" className={elo}>Ver no site ↗</a>
          )}
        </div>
      </header>
      <Aviso texto={aviso} />

      {audioDoEpisodio && (
        <div className="sticky top-14 z-20 border-2 border-ink bg-parchment p-2 lg:top-0">
          <audio ref={tocador} controls preload="metadata" src={audioDoEpisodio} className="h-10 w-full" />
        </div>
      )}

      <Abas atual={aba} escolher={(x) => setAba(x)} opcoes={abas} />

      {aba === "pauta" && <AbaPauta valor={valor} mudar={mudar} painel={painel} podeProduzir={podeProduzir} lang={t} />}
      {aba === "roteiro" && <AbaRoteiro valor={valor} mudar={mudar} podeProduzir={podeProduzir} />}
      {aba === "convidados" && <AbaConvidados valor={valor} mudar={mudar} podeProduzir={podeProduzir} podeEditar={podeEditar} />}
      {aba === "arquivos" && <AbaArquivos e={e} podeEditar={podeEditar} recarregar={recarregar} />}
      {aba === "revisao" && <AbaRevisao e={e} tempoAtual={tempoAtual} irPara={(s) => { if (tocador.current) { tocador.current.currentTime = s; void tocador.current.play(); } }} recarregar={recarregar} />}
      {aba === "publicacao" && (
        <AbaPublicacao
          e={e}
          valor={valor}
          mudar={mudar}
          capitulosTexto={capitulosTexto ?? escreverCapitulos(e.capitulos)}
          setCapitulosTexto={setCapitulosTexto}
          tempoAtual={tempoAtual}
          painel={painel}
          podeEditar={podeEditar}
          soDesign={soDesign}
          recarregar={recarregar}
        />
      )}
      {aba === "divulgacao" && <AbaDivulgacao e={e} painel={painel} recarregar={recarregar} soDesign={soDesign} />}
      {aba === "historico" && (
        <ul className="divide-y divide-rule border-y border-rule">
          <li className="py-2 font-mono text-xs">{e.plays} audições no site</li>
          {e.historico.map((h, i) => (
            <li key={i} className="py-2">
              <span className="font-mono text-xs text-ink-soft">{dataHora(h.criado_em)}</span> · <strong>{h.nome}</strong> · {h.acao.replace("etapa:", "etapa → ").replace(/_/g, " ")}
              {h.nota && <span className="block text-ink-soft">{h.nota}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Os botões de etapa, aprovação e publicação, conforme a função de quem está usando. */
function Acoes({ e, eu, podeEditar, ocupado, agir, publicar }: { e: EpisodioCompleto; eu: PainelDoPodcast["eu"]; podeEditar: boolean; ocupado: boolean; agir: (f: string, a: Record<string, unknown>, s: string) => Promise<unknown>; publicar: () => Promise<void> }) {
  const [nota, setNota] = useState("");
  const [copiado, setCopiado] = useState(false);
  const podeAprovar = eu.supervisao && e.status === "revisao" && (e.enviado_por !== eu.id || eu.coordenacao);
  async function linkRevisao() {
    const r = (await agir("podcast_revisao_link", { p_id: e.id }, "Link de revisão pronto: vale 30 dias.")) as { token?: string } | null;
    if (r?.token) {
      await navigator.clipboard.writeText(`${window.location.origin}/pt/podcasts/revisao?t=${r.token}`).catch(() => {});
      setCopiado(true);
    }
  }
  return (
    <div className="mt-3 space-y-3">
      <p className="flex flex-wrap items-center gap-2">
        {podeEditar && e.status !== "publicado" && (
          <label className="flex items-center gap-2">
            Etapa
            <select
              value={["ideia", "roteiro", "gravacao", "edicao"].includes(e.status) ? e.status : ""}
              onChange={(ev) => ev.target.value && void agir("podcast_etapa", { p_id: e.id, p_status: ev.target.value }, `Etapa: ${NOME_DA_ETAPA[ev.target.value as keyof typeof NOME_DA_ETAPA]}.`)}
              disabled={ocupado}
              className="border-2 border-ink bg-parchment-deep px-2 py-1"
            >
              {!["ideia", "roteiro", "gravacao", "edicao"].includes(e.status) && <option value="">{NOME_DA_ETAPA[e.status]} (voltar para…)</option>}
              {(["ideia", "roteiro", "gravacao", "edicao"] as const).map((s) => <option key={s} value={s}>{NOME_DA_ETAPA[s]}</option>)}
            </select>
          </label>
        )}
        {podeEditar && ["ideia", "roteiro", "gravacao", "edicao"].includes(e.status) && (
          <button type="button" className={botaoClaro} disabled={ocupado} onClick={() => void agir("podcast_etapa", { p_id: e.id, p_status: "revisao" }, "Enviado para a supervisão aprovar.")}>Enviar para aprovação</button>
        )}
        {(eu.producao || eu.supervisao) && e.status === "aprovado" && (
          <button type="button" className={`${botao} ${e.pendencias.length ? "opacity-60" : ""}`} disabled={ocupado} onClick={() => void publicar()} title={e.pendencias.length ? "Ainda falta coisa na lista de conferência" : ""}>
            Publicar
          </button>
        )}
        {eu.supervisao && e.status === "publicado" && (
          <button type="button" className={botaoClaro} disabled={ocupado} onClick={() => { const motivo = window.prompt("Por que tirar do ar? (fica no histórico)"); if (motivo) void agir("podcast_despublicar", { p_id: e.id, p_nota: motivo }, "Tirado do ar."); }}>Tirar do ar</button>
        )}
        {eu.time && <button type="button" className={elo} onClick={() => void linkRevisao()}>{copiado ? "Link de revisão copiado ✓" : "Link privado de revisão"}</button>}
        {(eu.coordenacao || ((eu.producao || eu.supervisao) && !e.publicado_em)) && (
          <button type="button" className={`${elo} text-oxblood`} onClick={async () => { if (!window.confirm("Apagar o episódio e todos os arquivos dele? Não tem volta.")) return; const r = (await agir("podcast_apagar", { p_id: e.id }, "Episódio apagado.")) as { liberar?: { deposito: string; caminho: string }[] } | null; if (r) { await liberarEspaco(r.liberar ?? []).catch(() => 0); window.history.back(); } }}>
            Apagar
          </button>
        )}
      </p>
      {podeAprovar && (
        <div className="border-2 border-ink p-3">
          <p className="font-semibold">Supervisão: {e.enviado_por_nome ?? "alguém"} enviou para aprovação.</p>
          <textarea value={nota} onChange={(ev) => setNota(ev.target.value)} rows={2} maxLength={2000} placeholder="Para devolver, diga o que precisa mudar. Para aprovar, uma nota é opcional." className={campo} />
          <p className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="cursor-pointer bg-ok px-4 py-2 font-semibold text-parchment" disabled={ocupado} onClick={() => void agir("podcast_aprovar", { p_id: e.id, p_aprovar: true, p_nota: nota }, "Aprovado.")}>Aprovar</button>
            <button type="button" className="cursor-pointer border-2 border-oxblood px-4 py-2 font-semibold text-oxblood" disabled={ocupado || nota.trim().length < 3} onClick={() => void agir("podcast_aprovar", { p_id: e.id, p_aprovar: false, p_nota: nota }, "Devolvido para a edição.")}>Devolver com ajuste</button>
          </p>
        </div>
      )}
      {eu.supervisao && e.status === "revisao" && e.enviado_por === eu.id && !eu.coordenacao && <p className="text-ink-soft">Você enviou este episódio: outra pessoa da supervisão (ou a coordenação) precisa aprovar.</p>}
    </div>
  );
}

type Valor = <K extends keyof EpisodioCompleto>(chave: K) => EpisodioCompleto[K];
type Mudar = <K extends keyof EpisodioCompleto>(chave: K, novo: EpisodioCompleto[K]) => void;

function AbaPauta({ valor, mudar, painel, podeProduzir, lang }: { valor: Valor; mudar: Mudar; painel: PainelDoPodcast; podeProduzir: boolean; lang: ReturnType<typeof useI18n>["t"] }) {
  const trilhas = useTrackOptions("pt");
  const equipe = useLista<{ id: string; nome: string }[]>("podcast_equipe");
  const disciplina = valor("disciplina") ?? "";
  const ro = !podeProduzir;
  const numero = (texto: string) => (texto.trim() === "" ? null : Number(texto));
  return (
    <fieldset disabled={ro} className="grid max-w-4xl gap-4">
      <label className="block">
        Título
        <input value={valor("titulo")} onChange={(ev) => mudar("titulo", ev.target.value)} maxLength={140} className={campo} />
      </label>
      <label className="block">
        Resumo (aparece nas listas, no feed e na conversa da comunidade)
        <textarea value={valor("resumo")} onChange={(ev) => mudar("resumo", ev.target.value)} maxLength={400} rows={2} className={campo} />
        <span className="block text-right font-mono text-xs text-ink-soft">{valor("resumo").length}/400</span>
      </label>
      <label className="block">
        Tema e ângulo
        <input value={valor("tema")} onChange={(ev) => mudar("tema", ev.target.value)} maxLength={300} className={campo} />
      </label>
      <label className="block">
        Pauta (tópicos, perguntas para o convidado, o que não pode faltar)
        <textarea value={valor("pauta")} onChange={(ev) => mudar("pauta", ev.target.value)} maxLength={6000} rows={6} className={campo} />
      </label>
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="block sm:col-span-2">
          Série
          <select value={valor("serie") ?? ""} onChange={(ev) => mudar("serie", ev.target.value || null)} className={campo}>
            <option value="">Sem série</option>
            {painel.series.map((s) => <option key={s.id} value={s.id}>{s.titulo}</option>)}
          </select>
        </label>
        <label className="block">
          Temporada
          <input type="number" min={1} max={99} value={valor("temporada") ?? ""} onChange={(ev) => mudar("temporada", numero(ev.target.value))} className={campo} />
        </label>
        <label className="block">
          Número
          <input type="number" min={0} max={9999} value={valor("numero") ?? ""} onChange={(ev) => mudar("numero", numero(ev.target.value))} className={campo} />
        </label>
      </div>
      <fieldset>
        <legend className={rotulo}>Temas (as playlists do site; até cinco)</legend>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
          {TEMAS.map((tema) => {
            const marcados = valor("temas");
            return (
              <label key={tema} className="flex items-center gap-1.5">
                <input type="checkbox" checked={marcados.includes(tema)} disabled={!marcados.includes(tema) && marcados.length >= 5} onChange={(ev) => mudar("temas", ev.target.checked ? [...marcados, tema] : marcados.filter((x) => x !== tema))} />
                {NOME_DO_TEMA[tema]}
              </label>
            );
          })}
        </p>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          Disciplina (o episódio aparece na estante dela como material complementar)
          <select value={disciplina} onChange={(ev) => { mudar("disciplina", ev.target.value || null); mudar("trilha", null); }} className={campo}>
            <option value="">Nenhuma</option>
            {areaSlugs.map((slug) => <option key={slug} value={slug}>{lang.areas[slug][0]}</option>)}
          </select>
        </label>
        <label className="block">
          Curso (aparece também na página do curso)
          <select value={valor("trilha") ?? ""} onChange={(ev) => mudar("trilha", ev.target.value || null)} className={campo}>
            <option value="">Nenhum</option>
            {trilhas.filter((x) => !disciplina || x.area === disciplina).map((x) => <option key={x.slug} value={x.slug}>{x.title}</option>)}
          </select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="block sm:col-span-2">
          Responsável
          <select value={valor("responsavel") ?? ""} onChange={(ev) => mudar("responsavel", ev.target.value || null)} className={campo}>
            <option value="">Ninguém</option>
            {equipe.dados?.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </label>
        <label className="block">
          Gravação
          <input type="date" value={valor("gravacao_em") ?? ""} onChange={(ev) => mudar("gravacao_em", ev.target.value || null)} className={campo} />
        </label>
        <label className="block">
          Publicação prevista
          <input type="date" value={valor("publicar_em") ?? ""} onChange={(ev) => mudar("publicar_em", ev.target.value || null)} className={campo} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="block">
          Duração prevista (min)
          <input type="number" min={0} max={600} value={valor("duracao_prevista") || ""} onChange={(ev) => mudar("duracao_prevista", Number(ev.target.value) || 0)} className={campo} />
        </label>
        <label className="block sm:col-span-3">
          Sala da gravação a distância (Jitsi, Meet, Zoom)
          <span className="mt-1 flex gap-2">
            <input value={valor("sala")} onChange={(ev) => mudar("sala", ev.target.value)} placeholder="https://" className={`${campo} mt-0`} />
            {!valor("sala") && !ro && (
              <button type="button" className={botaoClaro} onClick={() => mudar("sala", `https://meet.jit.si/InstitutoLucia-${crypto.randomUUID().slice(0, 8)}`)}>Criar sala no Jitsi</button>
            )}
            {valor("sala") && <a href={valor("sala")} target="_blank" rel="noopener noreferrer" className={`${botaoClaro} whitespace-nowrap`}>Abrir ↗</a>}
          </span>
        </label>
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={valor("explicito")} onChange={(ev) => mudar("explicito", ev.target.checked)} /> Conteúdo explícito (palavrão, violência descrita)
      </label>
    </fieldset>
  );
}

function AbaRoteiro({ valor, mudar, podeProduzir }: { valor: Valor; mudar: Mudar; podeProduzir: boolean }) {
  const [painel, setPainel] = useState<"" | "citar" | "checar">("");
  const [prompter, setPrompter] = useState(false);
  const [selecao, setSelecao] = useState("");
  const obras = valor("obras");
  const roteiro = valor("roteiro");
  const citar = (obra: ObraCitada, texto: string) => {
    if (!obras.some((o) => o.id === obra.id)) mudar("obras", [...obras, obra]);
    mudar("roteiro", `${roteiro.replace(/\s+$/, "")}\n\n${texto}\n`);
    setPainel("");
  };
  const pegarSelecao = () => {
    const area = document.getElementById("podcast-roteiro") as HTMLTextAreaElement | null;
    setSelecao(area && area.selectionEnd > area.selectionStart ? area.value.slice(area.selectionStart, area.selectionEnd) : "");
    setPainel("checar");
  };
  return (
    <div className="max-w-4xl space-y-5">
      {podeProduzir && (
        <FerramentasDoRoteiro
          gabarito={() => { if (!roteiro.trim() || window.confirm("Pôr o gabarito no fim do roteiro?")) mudar("roteiro", roteiro.trim() ? `${roteiro}\n\n${GABARITO}` : GABARITO); }}
          citar={() => setPainel("citar")}
          checar={pegarSelecao}
          prompter={() => setPrompter(true)}
        />
      )}
      {!podeProduzir && <button type="button" className={botao} onClick={() => setPrompter(true)}>Teleprompter</button>}
      {painel === "citar" && <CitarObra aoCitar={citar} fechar={() => setPainel("")} />}
      {painel === "checar" && <ChecarAfirmacao inicial={selecao} fechar={() => setPainel("")} />}
      {prompter && <Teleprompter texto={roteiro} fechar={() => setPrompter(false)} />}
      {podeProduzir ? (
        <MarkdownEditor id="podcast-roteiro" value={roteiro} onChange={(v) => mudar("roteiro", v)} labels={editorPt} rows={22} placeholder="Escreva o roteiro, ou comece pelo gabarito." />
      ) : (
        <pre className="whitespace-pre-wrap border border-rule bg-parchment-deep p-4 font-serif text-lg">{roteiro || "Sem roteiro ainda."}</pre>
      )}
      <section>
        <h3 className={rotulo}>Obras do acervo citadas ({obras.length})</h3>
        <ul className="mt-2 space-y-1">
          {obras.map((o) => (
            <li key={o.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-rule py-1">
              <span><strong>{o.titulo}</strong> · {o.autor} <span className="text-xs text-ink-soft">({o.licenca}; {o.fonte})</span></span>
              {podeProduzir && <button type="button" className={elo} onClick={() => mudar("obras", obras.filter((x) => x.id !== o.id))}>tirar</button>}
            </li>
          ))}
        </ul>
      </section>
      {podeProduzir && <SourcesField value={(valor("fontes") as SourceDraft[]).map((f) => ({ titulo: f.titulo ?? "", autor: f.autor ?? "", url: f.url ?? "" }))} onChange={(v) => mudar("fontes", v)} labels={fontesPt} />}
    </div>
  );
}

function AbaConvidados({ valor, mudar, podeProduzir, podeEditar }: { valor: Valor; mudar: Mudar; podeProduzir: boolean; podeEditar: boolean }) {
  const convidados = useLista<ConvidadoBreve[]>("podcast_convidados_listar");
  const trilhas = useLista<TrilhaBreve[]>("podcast_trilhas_listar");
  const marcados = valor("convidados");
  const usadas = valor("trilhas");
  const [nome, setNome] = useState("");
  const [aviso, setAviso] = useState("");
  async function novo() {
    try {
      const r = await rpc<{ id: string }>("podcast_convidado_salvar", { p_id: null, p: { nome } });
      mudar("convidados", [...marcados, r.id]);
      setNome("");
      convidados.recarregar();
    } catch (erro) {
      setAviso(textoDoErro(erro));
    }
  }
  return (
    <div className="grid max-w-4xl gap-8 lg:grid-cols-2">
      <section>
        <h3 className={rotulo}>Convidados do episódio</h3>
        <p className="mt-1 text-ink-soft">O episódio só publica com a autorização de voz de todos. Mande o link do convidado: ele lê o termo, aceita e testa o microfone.</p>
        <ul className="mt-3 divide-y divide-rule border-y border-rule">
          {convidados.dados?.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <label className="flex items-center gap-2">
                <input type="checkbox" disabled={!podeProduzir} checked={marcados.includes(c.id)} onChange={(ev) => mudar("convidados", ev.target.checked ? [...marcados, c.id] : marcados.filter((x) => x !== c.id))} />
                {c.nome}
              </label>
              <span className={`font-mono text-xs ${c.autoriza_voz ? "text-ok" : "text-oxblood"}`}>{c.autoriza_voz ? "autorizado" : "sem autorização"}</span>
              {c.link && <button type="button" className={elo} onClick={() => void navigator.clipboard.writeText(linkDoConvidado(c.link!))}>copiar link</button>}
            </li>
          ))}
        </ul>
        {podeProduzir && (
          <p className="mt-3 flex gap-2">
            <input value={nome} onChange={(ev) => setNome(ev.target.value)} placeholder="Nome de um convidado novo" className={`${campo} mt-0`} />
            <button type="button" className={botaoClaro} disabled={nome.trim().length < 2} onClick={() => void novo()}>Cadastrar</button>
          </p>
        )}
        <p className="mt-2 text-ink-soft">Contato, minibio, link e termo assinado ficam na aba Convidados do podcast.</p>
        <Aviso texto={aviso} />
      </section>
      <section>
        <h3 className={rotulo}>Trilhas e vinhetas usadas</h3>
        <p className="mt-1 text-ink-soft">Só faixas da biblioteca, que têm a licença registrada.</p>
        <ul className="mt-3 divide-y divide-rule border-y border-rule">
          {trilhas.dados?.map((x) => (
            <li key={x.id} className="py-2">
              <label className="flex items-start gap-2">
                <input type="checkbox" disabled={!podeEditar} checked={usadas.includes(x.id)} onChange={(ev) => mudar("trilhas", ev.target.checked ? [...usadas, x.id] : usadas.filter((y) => y !== x.id))} />
                <span>
                  {x.titulo} <span className="text-ink-soft">· {x.autor}</span>
                  <span className="block font-mono text-xs text-ink-soft">{x.tipo} · {x.licenca}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        {trilhas.dados?.length === 0 && <p className="mt-2 text-ink-soft">A biblioteca está vazia. Cadastre as faixas na aba Biblioteca de áudios.</p>}
      </section>
    </div>
  );
}

function AbaArquivos({ e, podeEditar, recarregar }: { e: EpisodioCompleto; podeEditar: boolean; recarregar: () => void }) {
  const [tipo, setTipo] = useState<keyof typeof TIPOS_DE_ARQUIVO>("bruto");
  const [nota, setNota] = useState("");
  const [usar, setUsar] = useState(true);
  const [andamento, setAndamento] = useState<{ fase: string; fracao: number } | null>(null);
  const [analise, setAnalise] = useState<Analise | null>(null);
  const [aviso, setAviso] = useState("");
  const [link, setLink] = useState({ nome: "", link: "" });

  async function definir(arquivoId: string, a: Analise) {
    await rpc("podcast_audio_definir", { p_episodio: e.id, p_arquivo: arquivoId, p_duracao: Math.max(1, a.duracao), p_picos: a.picos });
  }

  async function enviar(arquivo: File | undefined) {
    if (!arquivo) return;
    setAviso("");
    setAnalise(null);
    const final = tipo === "final";
    const formato = tipoDe(arquivo);
    if (final && !["audio/mpeg", "audio/mp4", "audio/ogg", "audio/opus"].includes(formato)) return setAviso("O áudio final precisa ser MP3 (ou M4A, OGG). Exporte do Audacity em MP3 de 96 a 128 kbps.");
    if (arquivo.size > LIMITE_BYTES) return setAviso(mensagensDeEnvio.tamanho);
    const caminho = `ep/${e.id}/${nomeSorteado(tipo, extensaoDe(arquivo))}`;
    try {
      setAndamento({ fase: "Enviando", fracao: 0 });
      await enviarComProgresso(final ? "podcast" : "podcast-producao", caminho, arquivo, (f) => setAndamento({ fase: "Enviando", fracao: f }), formato);
      const { id } = await rpc<{ id: string }>("podcast_arquivo_registrar", { p_episodio: e.id, p: { tipo, deposito: final ? "podcast" : "podcast-producao", caminho, nome: arquivo.name.slice(0, 200), bytes: arquivo.size, mime: formato, nota } });
      if (final || tipo === "editado") {
        setAndamento({ fase: "Medindo o volume", fracao: 0 });
        const a = await analisarAudio(arquivo, (f) => setAndamento({ fase: "Medindo o volume", fracao: f }));
        setAnalise(a);
        if (final && usar) await definir(id, a);
      }
      setNota("");
      setAviso(final && usar ? "Áudio final enviado e definido como o áudio do episódio." : "Arquivo enviado.");
      recarregar();
    } catch (erro) {
      setAviso(erro instanceof EnvioError ? (mensagensDeEnvio[erro.message] ?? mensagensDeEnvio.envio) : mensagemDeErro(erro));
    } finally {
      setAndamento(null);
    }
  }

  async function medir(arquivoId: string, caminho: string, definirDepois: boolean) {
    setAviso("");
    try {
      setAndamento({ fase: "Baixando", fracao: 0 });
      const blob = await baixarPublico(caminho);
      setAndamento({ fase: "Medindo o volume", fracao: 0 });
      const a = await analisarAudio(blob, (f) => setAndamento({ fase: "Medindo o volume", fracao: f }));
      setAnalise(a);
      if (definirDepois) {
        await definir(arquivoId, a);
        setAviso("Definido como o áudio do episódio.");
        recarregar();
      }
    } catch (erro) {
      setAviso(mensagemDeErro(erro));
    } finally {
      setAndamento(null);
    }
  }

  async function remover(arquivoId: string) {
    if (!window.confirm("Tirar este arquivo do depósito? O registro fica no histórico de versões.")) return;
    try {
      const r = await rpc<{ liberar: { deposito: string; caminho: string }[] }>("podcast_arquivo_remover", { p_id: arquivoId });
      await liberarEspaco(r.liberar);
      recarregar();
    } catch (erro) {
      setAviso(mensagemDeErro(erro));
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      {podeEditar && (
        <section className="space-y-3 border border-rule bg-parchment-deep p-5">
          <h3 className="font-serif text-xl font-semibold">Enviar uma versão</h3>
          <p className="text-ink-soft">
            Até 50 MB por arquivo. O final vai em MP3 (96 a 128 kbps; mono para conversa). Bruto em WAV costuma passar disso: guarde no Internet Archive ou no Drive e registre só o link, logo abaixo.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              Tipo
              <select value={tipo} onChange={(ev) => setTipo(ev.target.value as keyof typeof TIPOS_DE_ARQUIVO)} className={campo}>
                {Object.entries(TIPOS_DE_ARQUIVO).map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
              </select>
            </label>
            <label className="block">
              Nota (opcional)
              <input value={nota} onChange={(ev) => setNota(ev.target.value)} maxLength={500} placeholder="ex.: cortei o bloco 2" className={campo} />
            </label>
          </div>
          {tipo === "final" && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={usar} onChange={(ev) => setUsar(ev.target.checked)} /> Usar como o áudio do episódio (mede o volume e desenha a onda)
            </label>
          )}
          <label className={`${botao} inline-block ${andamento ? "pointer-events-none opacity-50" : ""}`}>
            {andamento ? `${andamento.fase}… ${Math.round(andamento.fracao * 100)}%` : "Escolher arquivo"}
            <input type="file" accept={tipo === "video" ? "video/*" : tipo === "outro" ? undefined : "audio/*"} className="sr-only" onChange={(ev) => { void enviar(ev.target.files?.[0]); ev.target.value = ""; }} />
          </label>
          {andamento && (
            <span className="block h-2 w-full max-w-md bg-parchment">
              <span className="block h-full bg-oxblood" style={{ width: `${Math.round(andamento.fracao * 100)}%` }} />
            </span>
          )}
          <details>
            <summary className="cursor-pointer">Registrar só o link (arquivo grande, cópia de segurança)</summary>
            <form className="mt-2 grid gap-2 sm:grid-cols-[1fr_2fr_auto]" onSubmit={async (ev) => { ev.preventDefault(); try { await rpc("podcast_arquivo_registrar", { p_episodio: e.id, p: { tipo, nome: link.nome, link: link.link, nota } }); setLink({ nome: "", link: "" }); recarregar(); } catch (erro) { setAviso(mensagemDeErro(erro)); } }}>
              <input value={link.nome} onChange={(ev) => setLink({ ...link, nome: ev.target.value })} placeholder="Nome" required className={`${campo} mt-0`} />
              <input value={link.link} onChange={(ev) => setLink({ ...link, link: ev.target.value })} placeholder="https://archive.org/…" required className={`${campo} mt-0`} />
              <button type="submit" className={botaoClaro}>Registrar</button>
            </form>
          </details>
        </section>
      )}
      <Aviso texto={aviso} />
      {analise && (
        <section className="border-l-4 border-gold pl-4">
          <p className="font-mono text-xs">
            Duração {relogio(analise.duracao)} · volume {analise.lufs ?? "?"} LUFS · pico {analise.pico ?? "?"} dB · partes quietas {analise.ruido ?? "?"} LUFS
          </p>
          <ul className="mt-1 list-disc pl-5">
            {conselhoDeVolume(analise).map((d) => <li key={d}>{d}</li>)}
          </ul>
          {analise.lufs !== null && <p className="mt-1 text-xs text-ink-soft">Medida feita aqui no navegador, pela norma BS.1770 (a mesma das plataformas). Use para conferir o item &quot;volume&quot; da lista.</p>}
        </section>
      )}
      <section>
        <h3 className={rotulo}>Versões ({e.arquivos.length})</h3>
        <ul className="mt-2 divide-y divide-rule border-y border-rule">
          {e.arquivos.map((a) => {
            const noAr = a.caminho !== "" && a.caminho === e.audio;
            return (
              <li key={a.id} className={`space-y-1 py-3 ${a.guardado || a.link ? "" : "opacity-60"}`}>
                <p className="flex flex-wrap items-baseline justify-between gap-2">
                  <span>
                    <span className="mr-2 bg-ink px-1.5 py-0.5 font-mono text-[0.65rem] uppercase text-parchment">{a.tipo}</span>
                    <strong>{a.nome}</strong>
                    {noAr && <span className="ml-2 font-mono text-xs text-ok">← áudio do episódio</span>}
                  </span>
                  <span className="font-mono text-xs text-ink-soft">{a.bytes ? bytes(a.bytes) : ""} · {a.enviado_por_nome ?? "—"} · {dataHora(a.criado_em)}</span>
                </p>
                {a.nota && <p className="text-ink-soft">{a.nota}</p>}
                <div className="flex flex-wrap items-center gap-3">
                  {a.guardado && a.deposito === "podcast" && <audio controls preload="none" src={urlPublica(a.caminho)} className="h-10 w-full max-w-md" />}
                  {a.guardado && a.deposito === "podcast-producao" && <OuvirFechado caminho={a.caminho} video={a.tipo === "video"} />}
                  {a.link && <a href={a.link} target="_blank" rel="noopener noreferrer" className={elo}>Abrir o link ↗</a>}
                  {!a.guardado && !a.link && <span className="text-xs text-ink-soft">saiu do depósito</span>}
                  {podeEditar && a.guardado && a.tipo === "final" && a.deposito === "podcast" && !noAr && <button type="button" className={elo} onClick={() => void medir(a.id, a.caminho, true)}>Usar como áudio do episódio</button>}
                  {podeEditar && a.guardado && a.deposito === "podcast" && <button type="button" className={elo} onClick={() => void medir(a.id, a.caminho, false)}>Medir o volume</button>}
                  {podeEditar && a.guardado && a.caminho && <button type="button" className={`${elo} text-oxblood`} onClick={() => void remover(a.id)}>Tirar do depósito</button>}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function AbaRevisao({ e, tempoAtual, irPara, recarregar }: { e: EpisodioCompleto; tempoAtual: () => number; irPara: (s: number) => void; recarregar: () => void }) {
  const [texto, setTexto] = useState("");
  const [comTempo, setComTempo] = useState(true);
  const [aviso, setAviso] = useState("");
  async function comentar() {
    try {
      await rpc("podcast_comentar", { p_episodio: e.id, p_texto: texto, p_tempo: comTempo ? tempoAtual() : null });
      setTexto("");
      recarregar();
    } catch (erro) {
      setAviso(mensagemDeErro(erro));
    }
  }
  return (
    <div className="max-w-3xl space-y-5">
      <p className="text-ink-soft">Ouça no tocador acima e comente no ponto exato: o comentário guarda o tempo, e um clique no tempo leva o áudio até lá. Quem cuida do episódio é avisado a cada comentário.</p>
      <form className="space-y-2" onSubmit={(ev) => { ev.preventDefault(); void comentar(); }}>
        <textarea value={texto} onChange={(ev) => setTexto(ev.target.value)} rows={3} maxLength={2000} required placeholder="O que precisa mudar? (ex.: cortar a respiração longa; repetir a data)" className={campo} />
        <p className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={comTempo} onChange={(ev) => setComTempo(ev.target.checked)} /> Marcar o tempo do tocador agora
          </label>
          <button type="submit" className={botao} disabled={!texto.trim()}>Comentar</button>
        </p>
      </form>
      <Aviso texto={aviso} />
      <ul className="space-y-3">
        {e.comentarios.map((c) => (
          <li key={c.id} className={`border-l-4 pl-3 ${c.resolvido ? "border-rule text-ink-soft" : "border-oxblood"}`}>
            <p className="text-xs text-ink-soft">
              <strong className="text-ink">{c.autor}</strong> · {dataHora(c.criado_em)}
              {c.tempo !== null && <button type="button" onClick={() => irPara(c.tempo ?? 0)} className="ml-2 cursor-pointer font-mono text-oxblood underline">{relogio(c.tempo)}</button>}
            </p>
            <p className={`whitespace-pre-line ${c.resolvido ? "line-through" : ""}`}>{c.texto}</p>
            <button type="button" className={`${elo} text-xs`} onClick={() => rpc("podcast_comentario_resolver", { p_id: c.id, p_resolvido: !c.resolvido }).then(recarregar).catch(() => {})}>
              {c.resolvido ? "reabrir" : "marcar como resolvido"}
            </button>
          </li>
        ))}
      </ul>
      {e.comentarios.length === 0 && <p className="text-ink-soft">Nenhum comentário ainda.</p>}
    </div>
  );
}

function AbaPublicacao({ e, valor, mudar, capitulosTexto, setCapitulosTexto, tempoAtual, painel, podeEditar, soDesign, recarregar }: {
  e: EpisodioCompleto; valor: Valor; mudar: Mudar; capitulosTexto: string; setCapitulosTexto: (v: string) => void; tempoAtual: () => number; painel: PainelDoPodcast; podeEditar: boolean; soDesign: boolean; recarregar: () => void;
}) {
  const [aviso, setAviso] = useState("");
  const [transcrevendo, setTranscrevendo] = useState(false);
  const checklist = valor("checklist");
  const serie = painel.series.find((s) => s.id === e.serie);

  async function capa(caminhoCapa: string, mini: string) {
    await rpc("podcast_capa_definir", { p_episodio: e.id, p_capa: caminhoCapa, p_capa_mini: mini });
    recarregar();
  }

  async function importar(arquivo: File | undefined) {
    if (!arquivo) return;
    const texto = await arquivo.text();
    if (/-->/.test(texto)) {
      const trechos = lerLegendas(texto);
      if (trechos.length === 0) return setAviso("Não achei falas com tempo neste arquivo.");
      mudar("legendas", escreverVtt(trechos));
      // A transcrição em texto corrido: um parágrafo a cada pausa maior que dois segundos.
      const paragrafos: string[] = [];
      let atual = "";
      trechos.forEach((t, i) => {
        atual += `${atual ? " " : ""}${t.texto}`;
        if (i === trechos.length - 1 || trechos[i + 1].inicio - t.fim > 2) {
          paragrafos.push(atual);
          atual = "";
        }
      });
      mudar("transcricao", paragrafos.join("\n\n"));
      setAviso(`${trechos.length} falas importadas com tempo. Guarde para valer.`);
    } else {
      mudar("transcricao", texto.trim());
      setAviso("Texto importado (sem tempo). Guarde para valer.");
    }
  }

  async function transcrever() {
    setTranscrevendo(true);
    setAviso("Transcrevendo… um episódio de uma hora leva de um a três minutos.");
    try {
      const supabase = await getClient();
      const { data, error } = await supabase.functions.invoke<{ texto?: string; vtt?: string; erro?: string }>("transcrever-podcast", { body: { episodio: e.id } });
      if (error || !data || data.erro || !data.texto) throw new Error(data?.erro ?? "falha");
      mudar("transcricao", data.texto);
      if (data.vtt) mudar("legendas", data.vtt);
      setAviso("Transcrição pronta. Revise os nomes próprios e guarde.");
    } catch (erro) {
      const motivo = String((erro as Error).message ?? "");
      setAviso(
        motivo === "grande"
          ? "O áudio passa de 25 MB, o limite do serviço gratuito. Exporte uma cópia em MP3 64 kbps mono só para transcrever, ou use o Buzz no computador e importe o .srt."
          : "A transcrição automática não está ligada no servidor (ou falhou). Use o Buzz no computador e importe o arquivo .srt ou .vtt. Veja o Guia.",
      );
    } finally {
      setTranscrevendo(false);
    }
  }

  function montarNotas() {
    const linhas: string[] = [];
    if (valor("resumo")) linhas.push(valor("resumo"), "");
    const caps = lerCapitulos(capitulosTexto);
    if (caps.length) linhas.push("## Capítulos", ...caps.map((c: Capitulo) => `- ${relogio(c.t)} ${c.titulo}`), "");
    const convidados = e.convidados_dados;
    if (convidados.length) linhas.push("## Convidados", ...convidados.map((c) => `- **${c.nome}**${c.minibio ? `: ${c.minibio}` : ""}`), "");
    const obras = valor("obras");
    if (obras.length) linhas.push("## Para ler no acervo", ...obras.map((o) => `- [*${o.titulo}*, de ${o.autor}](/acervo/${o.id}) (${o.licenca})`), "");
    const fontes = valor("fontes");
    if (fontes.length) linhas.push("## Fontes", ...fontes.filter((f) => f.titulo).map((f) => `- ${f.url ? `[${f.titulo}](${f.url})` : f.titulo}${f.autor ? `, ${f.autor}` : ""}`), "");
    if (e.trilhas_dados.length) linhas.push("## Trilhas", ...e.trilhas_dados.map((x) => `- ${x.titulo}${x.autor ? `, de ${x.autor}` : ""} (${x.licenca})`), "");
    linhas.push("Este episódio é livre (CC BY-SA 4.0): pode ouvir, copiar e compartilhar, citando o Instituto Lúcia.");
    if (valor("notas").trim() && !window.confirm("Trocar as notas atuais pelas montadas?")) return;
    mudar("notas", linhas.join("\n"));
  }

  return (
    <div className="max-w-4xl space-y-10">
      <section className="space-y-3">
        <h3 className="font-serif text-2xl font-semibold">Capa</h3>
        <div className="flex flex-wrap items-start gap-5">
          <div className="w-40">
            {e.capa ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={urlPublica(e.capa_mini || e.capa)} alt="Capa atual" width={160} height={160} className="aspect-square w-full border-2 border-ink object-cover" />
            ) : (
              <p className="flex aspect-square items-center justify-center border-2 border-dashed border-ink p-3 text-center text-ink-soft">Sem capa</p>
            )}
          </div>
          <div className="space-y-2">
            <EnviarCapaSimples aoEnviar={capa} pasta={e.id} rotuloBotao="Enviar a capa pronta (recorte quadrado, 3000 × 3000)" />
            <p className="text-ink-soft">Ou crie com um dos modelos do instituto, logo abaixo: troque o título e pronto.</p>
          </div>
        </div>
        <details className="border border-rule p-4" open={!e.capa}>
          <summary className="cursor-pointer font-semibold">Criar a capa com um modelo</summary>
          <div className="mt-4">
            <EstudioDeArte
              inicial={{ titulo: e.titulo, programa: painel.config.nome, serie: serie?.titulo ?? "", numero: e.numero != null ? String(e.numero) : "", temporada: e.temporada ? String(e.temporada) : "", convidado: e.convidados_dados.map((c) => c.nome).join(" e ") }}
              aoUsarComoCapa={async (tela) => {
                const enviada = await enviarCapa(e.id, await prepararCapa(tela));
                await capa(enviada.capa, enviada.mini);
              }}
            />
          </div>
        </details>
      </section>

      {!soDesign && (
        <>
          <section className="space-y-3">
            <h3 className="font-serif text-2xl font-semibold">Notas do episódio</h3>
            {podeEditar && <button type="button" className={botaoClaro} onClick={montarNotas}>Montar as notas (resumo, capítulos, convidados, obras, fontes e trilhas)</button>}
            <MarkdownEditor id="podcast-notas" value={valor("notas")} onChange={(v) => mudar("notas", v)} labels={editorPt} rows={12} />
          </section>

          <section className="space-y-3">
            <h3 className="font-serif text-2xl font-semibold">Capítulos</h3>
            <p className="text-ink-soft">Uma linha por capítulo: o tempo e o título (ex.: 12:40 O cerco de Paris). Aparecem no site, nos tocadores que leem capítulos e nas notas.</p>
            <textarea value={capitulosTexto} onChange={(ev) => setCapitulosTexto(ev.target.value)} rows={6} className={`${campo} font-mono`} />
            {podeEditar && <button type="button" className={elo} onClick={() => setCapitulosTexto(`${capitulosTexto.replace(/\s+$/, "")}${capitulosTexto.trim() ? "\n" : ""}${relogio(tempoAtual())} `)}>+ Inserir o tempo do tocador ({relogio(tempoAtual())})</button>}
          </section>

          <section className="space-y-3">
            <h3 className="font-serif text-2xl font-semibold">Transcrição</h3>
            <p className="text-ink-soft">Para quem não ouve e para a busca do site. Com legendas (.vtt ou .srt), a transcrição fica clicável na página e alimenta a legenda dos cortes.</p>
            {podeEditar && (
              <p className="flex flex-wrap gap-2">
                <button type="button" className={botaoClaro} disabled={transcrevendo || !(e.audio && e.audio_guardado)} onClick={() => void transcrever()}>{transcrevendo ? "Transcrevendo…" : "Transcrever automaticamente (Whisper)"}</button>
                <label className={`${botaoClaro} inline-block`}>
                  Importar .srt, .vtt ou .txt
                  <input type="file" accept=".srt,.vtt,.txt,text/plain,text/vtt" className="sr-only" onChange={(ev) => { void importar(ev.target.files?.[0]); ev.target.value = ""; }} />
                </label>
                {valor("legendas") && <span className="self-center font-mono text-xs text-ok">legendas com tempo ✓ ({lerLegendas(valor("legendas")).length} falas)</span>}
              </p>
            )}
            <textarea value={valor("transcricao")} onChange={(ev) => mudar("transcricao", ev.target.value)} rows={10} className={campo} placeholder="A transcrição em texto corrido." />
          </section>

          <section className="space-y-3">
            <h3 className="font-serif text-2xl font-semibold">Cópia de fora</h3>
            <p className="text-ink-soft">
              O depósito do site guarda o áudio só dos episódios mais recentes ({painel.config.guardados}). Para este continuar tocando depois, suba o MP3 final no Internet Archive (archive.org → Upload, licença CC BY-SA)
              e cole aqui o link direto do arquivo .mp3 (o que termina em .mp3).
            </p>
            <input value={valor("audio_externo")} onChange={(ev) => mudar("audio_externo", ev.target.value)} placeholder="https://archive.org/download/…/episodio.mp3" className={campo} />
          </section>

          <section className="space-y-3">
            <h3 className="font-serif text-2xl font-semibold">Lista de conferência</h3>
            <p className="text-ink-soft">O episódio só publica com tudo certo. Os itens marcados à mão ficam com quem edita; os outros o sistema confere (atualizam ao guardar).</p>
            <ul className="space-y-1">
              {(["volume", "ruido", "fontes", "trilhas"] as const).map((item) => (
                <li key={item}>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" disabled={!podeEditar} checked={Boolean(checklist[item])} onChange={(ev) => mudar("checklist", { ...checklist, [item]: ev.target.checked })} />
                    {PENDENCIAS[item]}
                  </label>
                </li>
              ))}
            </ul>
            <ul className="mt-3 space-y-1 border-t border-rule pt-3">
              {Object.entries(PENDENCIAS)
                .filter(([item]) => !["volume", "ruido", "fontes", "trilhas"].includes(item))
                .map(([item, nome]) => {
                  const falta = e.pendencias.includes(item);
                  return (
                    <li key={item} className={falta ? "text-oxblood" : "text-ok"}>
                      {falta ? "✗" : "✓"} {nome}
                    </li>
                  );
                })}
            </ul>
          </section>
        </>
      )}
      <Aviso texto={aviso} />
    </div>
  );
}

function AbaDivulgacao({ e, painel, recarregar, soDesign }: { e: EpisodioCompleto; painel: PainelDoPodcast; recarregar: () => void; soDesign: boolean }) {
  const [pedido, setPedido] = useState("");
  const [aviso, setAviso] = useState("");
  const serie = painel.series.find((s) => s.id === e.serie);
  async function pedir() {
    try {
      await rpc("podcast_design_pedir", { p_episodio: e.id, p_texto: pedido });
      setPedido("");
      setAviso("Pedido enviado ao design.");
      recarregar();
    } catch (erro) {
      setAviso(mensagemDeErro(erro));
    }
  }
  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h3 className="font-serif text-2xl font-semibold">Artes de divulgação</h3>
        <p className="text-ink-soft">Post quadrado, post em pé e story, com a cara do instituto. Baixe e publique, ou agende na Agenda.</p>
        <EstudioDeArte inicial={{ titulo: e.titulo, programa: painel.config.nome, serie: serie?.titulo ?? "", numero: e.numero != null ? String(e.numero) : "", temporada: e.temporada ? String(e.temporada) : "", convidado: e.convidados_dados.map((c) => c.nome).join(" e ") }} />
      </section>
      {!soDesign && (
        <section className="space-y-3">
          <h3 className="font-serif text-2xl font-semibold">Cortes para as redes</h3>
          <GeradorDeCortes episodio={{ titulo: e.titulo, programa: painel.config.nome, capa: e.capa_mini || e.capa, audio: e.audio && e.audio_guardado ? e.audio : "", legendas: e.legendas }} />
        </section>
      )}
      {painel.eu.time && (
        <section className="space-y-3">
          <h3 className="font-serif text-2xl font-semibold">Pedir arte ao design</h3>
          <textarea value={pedido} onChange={(ev) => setPedido(ev.target.value)} rows={3} maxLength={1000} placeholder="O que precisa (capa especial, carrossel, ajuste de modelo), formato e prazo." className={campo} />
          <button type="button" className={botao} disabled={pedido.trim().length < 5} onClick={() => void pedir()}>Pedir ao design</button>
          <ul className="space-y-2">
            {e.pedidos.map((p) => (
              <li key={p.id} className="border-l-2 border-gold pl-3">
                <span className="font-mono text-xs uppercase">{p.status}</span> · {p.pedido_por} · {dataHora(p.criado_em)}
                <span className="block">{p.texto}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Aviso texto={aviso} />
    </div>
  );
}
