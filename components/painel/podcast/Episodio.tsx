// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { ArrowLeft, Check, CircleCheck, CircleX, ExternalLink, Link2, Plus, Save, Send, Trash2, Undo2, Upload } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { areaSlugs } from "@/lib/areas";
import { BackendError, getClient, rpc } from "@/lib/backend";
import { type Capitulo, escreverCapitulos, escreverVtt, lerCapitulos, lerLegendas, type ObraCitada, relogio, TEMAS } from "@/lib/podcast";
import { analisarAudio, type Analise, baixarPublico, conselhoDeVolume, EnvioError, enviarCapa, enviarComProgresso, extensaoDe, LIMITE_BYTES, liberarEspaco, mensagensDeEnvio, nomeSorteado, prepararCapa, tipoDe, urlPublica } from "@/lib/podcast-audio";
import { useTrackOptions } from "../../useTrackOptions";
import { cleanSources, MarkdownEditor, type SourceDraft, SourcesField } from "../../Editor";
import { useI18n } from "../../I18n";
import { Aviso, botao, botaoClaro, dataHora, textoDoErro, useLista } from "../comum";
import { editorPt, fontesPt } from "../Escrever";
import { EstudioDeArte } from "./Arte";
import { GeradorDeCortes } from "./Cortes";
import { GABARITO, PENDENCIAS } from "./Guia";
import { EnviarCapaSimples, linkDoConvidado, OuvirFechado } from "./Listas";
import { ChecarAfirmacao, CitarObra, FerramentasDoRoteiro, Teleprompter } from "./Roteiro";
import { bytes, type Etapa, type EpisodioCompleto, NOME_DA_ETAPA, type PainelDoPodcast } from "./tipos";
import { Abas, Area, Botao, CabecalhoDeSecao, Campo, Cartao, confirmarFrase, Esqueleto, Faixa, ItemDeLista, Lista, Marca, perguntarTexto, Selecao, Selo, type TomDoSelo, useComandosDaSecao, Vazio } from "../ui";

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
/** O tom do selo de cada etapa (a palavra diz a etapa; a cor só acompanha). */
const TOM_DA_ETAPA: Record<Etapa, TomDoSelo> = { ideia: "neutro", roteiro: "neutro", gravacao: "info", edicao: "info", revisao: "bordo", aprovado: "ouro", publicado: "ok" };
/** O rótulo que abre a escolha de arquivo mostra o foco do campo escondido (quem usa o teclado vê onde está). */
const FOCO_DO_ARQUIVO = "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--pn-foco)]";

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
  // "passo" no endereço abre direto a aba pedida pelo passo a passo de publicação.
  const passo = useSearchParams().get("passo");
  const [aba, setAba] = useState<Aba>(soDesign ? "publicacao" : passo && ["pauta", "roteiro", "convidados", "arquivos", "revisao", "publicacao", "divulgacao", "historico"].includes(passo) ? (passo as Aba) : "pauta");
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

  if (ver.erro)
    return (
      <Faixa tom="erro" acao={<><Botao pequeno onClick={ver.recarregar}>Tentar de novo</Botao><Botao pequeno variante="discreto" simbolo={ArrowLeft} onClick={voltar}>Voltar</Botao></>}>
        {ver.erro}
      </Faixa>
    );
  if (!e) return <Esqueleto forma="cartoes" />;

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
    <div className="space-y-5">
      <p>
        <Botao variante="discreto" pequeno simbolo={ArrowLeft} onClick={async () => (sujo && !(await confirmarFrase("Há alterações sem guardar. Sair mesmo assim?")) ? null : voltar())}>Episódios</Botao>
      </p>
      <Cartao as="div">
        <div className="flex flex-wrap items-start gap-5">
          <div className="w-24 shrink-0">
            {e.capa_mini ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={urlPublica(e.capa_mini)} alt="" width={96} height={96} className="aspect-square w-full rounded-[var(--pn-raio)] border border-[var(--pn-borda)] object-cover" />
            ) : (
              <div aria-hidden className="podcast-capa-cartaz aspect-square w-full rounded-[var(--pn-raio)] border border-[var(--pn-borda)]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <CabecalhoDeSecao
              nivel={2}
              titulo={valor("titulo")}
              rotulo={
                <span className="flex flex-wrap items-center gap-2">
                  <Selo tom={TOM_DA_ETAPA[e.status]} ponto>{NOME_DA_ETAPA[e.status]}</Selo>
                  {serie && <span className="text-gold">{serie.titulo}</span>}
                  {e.numero != null && <span className="text-gold">#{e.numero}</span>}
                  {e.responsavel_nome && <span>resp.: {e.responsavel_nome}</span>}
                </span>
              }
              acoes={
                <>
                  {e.status === "publicado" && e.slug && (
                    <a href={`/pt/podcasts/${e.slug}`} target="_blank" rel="noopener noreferrer" className="pn-elo inline-flex items-center gap-1">Ver no site <ExternalLink aria-hidden className="h-3.5 w-3.5" /></a>
                  )}
                  {podeEditar && (
                    <Botao variante="principal" simbolo={Save} carregando={ocupado} onClick={() => void guardar()} disabled={!sujo || ocupado}>
                      {ocupado ? "Guardando…" : sujo ? "Guardar (Ctrl+S)" : "Tudo guardado"}
                    </Botao>
                  )}
                </>
              }
            />
            {e.nota_supervisao && e.status !== "publicado" && (
              <Faixa tom="bordo" className="mt-3">
                <strong>Supervisão:</strong> {e.nota_supervisao}
              </Faixa>
            )}
            <Acoes e={e} eu={eu} podeEditar={podeEditar} ocupado={ocupado} agir={agir} publicar={publicar} />
          </div>
        </div>
      </Cartao>
      <Aviso texto={aviso} />

      {audioDoEpisodio && (
        <div className="pn-cartao sticky top-[var(--pn-barra-altura)] z-20 p-2!">
          <audio ref={tocador} controls preload="metadata" src={audioDoEpisodio} className="h-10 w-full" />
        </div>
      )}

      <Abas rotulo="Etapas do episódio" valor={aba} aoMudar={(x) => setAba(x)} opcoes={abas} />

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
        <Lista rotulo="Histórico">
          <ItemDeLista titulo={<span className="font-mono text-xs">{e.plays} audições no site</span>} />
          {e.historico.map((h, i) => (
            <ItemDeLista
              key={i}
              titulo={
                <span className="whitespace-normal">
                  <strong>{h.nome}</strong> · {h.acao.replace("etapa:", "etapa → ").replace(/_/g, " ")}
                </span>
              }
              meta={
                <span className="whitespace-normal">
                  <span className="font-mono">{dataHora(h.criado_em)}</span>
                  {h.nota && <span className="block">{h.nota}</span>}
                </span>
              }
            />
          ))}
        </Lista>
      )}
    </div>
  );
}

/** Os botões de etapa, aprovação e publicação, conforme a função de quem está usando. */
function Acoes({ e, eu, podeEditar, ocupado, agir, publicar }: { e: EpisodioCompleto; eu: PainelDoPodcast["eu"]; podeEditar: boolean; ocupado: boolean; agir: (f: string, a: Record<string, unknown>, s: string) => Promise<unknown>; publicar: () => Promise<void> }) {
  const [nota, setNota] = useState("");
  const [copiado, setCopiado] = useState(false);
  const notaRef = useRef<HTMLTextAreaElement>(null);
  const podeAprovar = eu.supervisao && e.status === "revisao" && (e.enviado_por !== eu.id || eu.coordenacao);
  const podeEnviar = podeEditar && ["ideia", "roteiro", "gravacao", "edicao"].includes(e.status);
  async function linkRevisao() {
    const r = (await agir("podcast_revisao_link", { p_id: e.id }, "Link de revisão pronto: vale 30 dias.")) as { token?: string } | null;
    if (r?.token) {
      await navigator.clipboard.writeText(`${window.location.origin}/pt/podcasts/revisao?t=${r.token}`).catch(() => {});
      setCopiado(true);
    }
  }
  const aprovar = () => void agir("podcast_aprovar", { p_id: e.id, p_aprovar: true, p_nota: nota }, "Aprovado.");
  const devolver = (texto: string) => void agir("podcast_aprovar", { p_id: e.id, p_aprovar: false, p_nota: texto }, "Devolvido para a edição.");

  // Na paleta (Ctrl K): as decisões que esta tela já oferece, sem o mouse. Pedir ajuste sem nota pergunta o que mudar.
  useComandosDaSecao(
    [
      ...(podeAprovar
        ? [
            { id: "podcast-aprovar", nome: "Aprovar episódio", sobre: e.titulo, simbolo: Check, fazer: aprovar },
            {
              id: "podcast-ajuste",
              nome: "Pedir ajuste",
              sobre: e.titulo,
              simbolo: Undo2,
              fazer: async () => {
                if (nota.trim().length >= 3) return devolver(nota);
                const texto = await perguntarTexto("Para devolver, diga o que precisa mudar. Para aprovar, uma nota é opcional.", nota, { multilinha: true, obrigatorio: true });
                if (texto && texto.trim().length >= 3) {
                  setNota(texto);
                  devolver(texto);
                } else notaRef.current?.focus();
              },
            },
          ]
        : []),
      ...(podeEnviar ? [{ id: "podcast-enviar", nome: "Enviar para aprovação", sobre: e.titulo, simbolo: Send, fazer: () => void agir("podcast_etapa", { p_id: e.id, p_status: "revisao" }, "Enviado para a supervisão aprovar.") }] : []),
    ],
    [e.id, e.status, podeAprovar, podeEnviar],
  );

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        {podeEditar && e.status !== "publicado" && (
          <div className="w-52">
            <Selecao
              rotulo="Etapa"
              value={["ideia", "roteiro", "gravacao", "edicao"].includes(e.status) ? e.status : ""}
              onChange={(ev) => ev.target.value && void agir("podcast_etapa", { p_id: e.id, p_status: ev.target.value }, `Etapa: ${NOME_DA_ETAPA[ev.target.value as keyof typeof NOME_DA_ETAPA]}.`)}
              disabled={ocupado}
            >
              {!["ideia", "roteiro", "gravacao", "edicao"].includes(e.status) && <option value="">{NOME_DA_ETAPA[e.status]} (voltar para…)</option>}
              {(["ideia", "roteiro", "gravacao", "edicao"] as const).map((s) => <option key={s} value={s}>{NOME_DA_ETAPA[s]}</option>)}
            </Selecao>
          </div>
        )}
        {podeEnviar && (
          <Botao simbolo={Send} disabled={ocupado} onClick={() => void agir("podcast_etapa", { p_id: e.id, p_status: "revisao" }, "Enviado para a supervisão aprovar.")}>Enviar para aprovação</Botao>
        )}
        {(eu.producao || eu.supervisao) && e.status === "aprovado" && (
          <Botao variante="principal" className={e.pendencias.length ? "opacity-60" : ""} disabled={ocupado} onClick={() => void publicar()} title={e.pendencias.length ? "Ainda falta coisa na lista de conferência" : ""}>
            Publicar
          </Botao>
        )}
        {eu.supervisao && e.status === "publicado" && (
          <Botao disabled={ocupado} onClick={async () => { const motivo = (await perguntarTexto("Por que tirar do ar? (fica no histórico)")); if (motivo) void agir("podcast_despublicar", { p_id: e.id, p_nota: motivo }, "Tirado do ar."); }}>Tirar do ar</Botao>
        )}
        {eu.time && (
          <Botao variante="discreto" simbolo={copiado ? Check : Link2} onClick={() => void linkRevisao()}>
            {copiado ? "Link de revisão copiado" : "Link privado de revisão"}
          </Botao>
        )}
        {(eu.coordenacao || ((eu.producao || eu.supervisao) && !e.publicado_em)) && (
          <Botao variante="discreto" perigo simbolo={Trash2} onClick={async () => { if (!(await confirmarFrase("Apagar o episódio e todos os arquivos dele? Não tem volta."))) return; const r = (await agir("podcast_apagar", { p_id: e.id }, "Episódio apagado.")) as { liberar?: { deposito: string; caminho: string }[] } | null; if (r) { await liberarEspaco(r.liberar ?? []).catch(() => 0); window.history.back(); } }}>
            Apagar
          </Botao>
        )}
      </div>
      {podeAprovar && (
        <Cartao as="div" variante="destaque" titulo={`Supervisão: ${e.enviado_por_nome ?? "alguém"} enviou para aprovação.`} nivelDoTitulo={3}>
          <textarea ref={notaRef} value={nota} onChange={(ev) => setNota(ev.target.value)} rows={2} maxLength={2000} aria-label="Para devolver, diga o que precisa mudar. Para aprovar, uma nota é opcional." placeholder="Para devolver, diga o que precisa mudar. Para aprovar, uma nota é opcional." className="pn-campo mt-2" />
          <p className="mt-2 flex flex-wrap gap-2">
            <Botao variante="principal" simbolo={Check} disabled={ocupado} onClick={aprovar}>Aprovar</Botao>
            <Botao simbolo={Undo2} disabled={ocupado || nota.trim().length < 3} onClick={() => devolver(nota)}>Devolver com ajuste</Botao>
          </p>
        </Cartao>
      )}
      {eu.supervisao && e.status === "revisao" && e.enviado_por === eu.id && !eu.coordenacao && <Faixa tom="info">Você enviou este episódio: outra pessoa da supervisão (ou a coordenação) precisa aprovar.</Faixa>}
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
    <fieldset disabled={ro} className="max-w-4xl space-y-4">
      <Cartao titulo="Pauta" nivelDoTitulo={3}>
        <div className="grid gap-4">
          <Campo rotulo="Título" value={valor("titulo")} onChange={(ev) => mudar("titulo", ev.target.value)} maxLength={140} />
          <div>
            <Area rotulo="Resumo (aparece nas listas, no feed e na conversa da comunidade)" value={valor("resumo")} onChange={(ev) => mudar("resumo", ev.target.value)} maxLength={400} rows={2} />
            <span className="block text-right font-mono text-xs text-ink-soft">{valor("resumo").length}/400</span>
          </div>
          <Campo rotulo="Tema e ângulo" value={valor("tema")} onChange={(ev) => mudar("tema", ev.target.value)} maxLength={300} />
          <Area rotulo="Pauta (tópicos, perguntas para o convidado, o que não pode faltar)" value={valor("pauta")} onChange={(ev) => mudar("pauta", ev.target.value)} maxLength={6000} rows={6} />
        </div>
      </Cartao>
      <Cartao titulo="Série" nivelDoTitulo={3}>
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <Selecao rotulo="Série" value={valor("serie") ?? ""} onChange={(ev) => mudar("serie", ev.target.value || null)}>
                <option value="">Sem série</option>
                {painel.series.map((s) => <option key={s.id} value={s.id}>{s.titulo}</option>)}
              </Selecao>
            </div>
            <Campo rotulo="Temporada" type="number" min={1} max={99} value={valor("temporada") ?? ""} onChange={(ev) => mudar("temporada", numero(ev.target.value))} />
            <Campo rotulo="Número" type="number" min={0} max={9999} value={valor("numero") ?? ""} onChange={(ev) => mudar("numero", numero(ev.target.value))} />
          </div>
          <fieldset>
            <legend className="pn-rotulo-mono">Temas (as playlists do site; até cinco)</legend>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
              {TEMAS.map((tema) => {
                const marcados = valor("temas");
                return (
                  <Marca
                    key={tema}
                    rotulo={NOME_DO_TEMA[tema]}
                    checked={marcados.includes(tema)}
                    disabled={!marcados.includes(tema) && marcados.length >= 5}
                    onChange={(ev) => mudar("temas", ev.target.checked ? [...marcados, tema] : marcados.filter((x) => x !== tema))}
                  />
                );
              })}
            </p>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <Selecao rotulo="Disciplina (o episódio aparece na estante dela como material complementar)" value={disciplina} onChange={(ev) => { mudar("disciplina", ev.target.value || null); mudar("trilha", null); }}>
              <option value="">Nenhuma</option>
              {areaSlugs.map((slug) => <option key={slug} value={slug}>{lang.areas[slug][0]}</option>)}
            </Selecao>
            <Selecao rotulo="Curso (aparece também na página do curso)" value={valor("trilha") ?? ""} onChange={(ev) => mudar("trilha", ev.target.value || null)}>
              <option value="">Nenhum</option>
              {trilhas.filter((x) => !disciplina || x.area === disciplina).map((x) => <option key={x.slug} value={x.slug}>{x.title}</option>)}
            </Selecao>
          </div>
        </div>
      </Cartao>
      <Cartao titulo="Gravação" nivelDoTitulo={3}>
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <Selecao rotulo="Responsável" value={valor("responsavel") ?? ""} onChange={(ev) => mudar("responsavel", ev.target.value || null)}>
                <option value="">Ninguém</option>
                {equipe.dados?.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </Selecao>
            </div>
            <Campo rotulo="Gravação" type="date" value={valor("gravacao_em") ?? ""} onChange={(ev) => mudar("gravacao_em", ev.target.value || null)} />
            <Campo rotulo="Publicação prevista" type="date" value={valor("publicar_em") ?? ""} onChange={(ev) => mudar("publicar_em", ev.target.value || null)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <Campo rotulo="Duração prevista (min)" type="number" min={0} max={600} value={valor("duracao_prevista") || ""} onChange={(ev) => mudar("duracao_prevista", Number(ev.target.value) || 0)} />
            <label className="pn-campo-bloco block sm:col-span-3">
              <span className="pn-rotulo">Sala da gravação a distância (Jitsi, Meet, Zoom)</span>
              <span className="mt-1 flex gap-2">
                <input value={valor("sala")} onChange={(ev) => mudar("sala", ev.target.value)} placeholder="https://" className="pn-campo" />
                {!valor("sala") && !ro && (
                  <Botao simbolo={Plus} className="whitespace-nowrap" onClick={() => mudar("sala", `https://meet.jit.si/InstitutoLucia-${crypto.randomUUID().slice(0, 8)}`)}>Criar sala no Jitsi</Botao>
                )}
                {valor("sala") && <a href={valor("sala")} target="_blank" rel="noopener noreferrer" className={`${botaoClaro} whitespace-nowrap`}>Abrir <ExternalLink aria-hidden /></a>}
              </span>
            </label>
          </div>
          <Marca rotulo="Conteúdo explícito (palavrão, violência descrita)" checked={valor("explicito")} onChange={(ev) => mudar("explicito", ev.target.checked)} />
        </div>
      </Cartao>
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
          gabarito={async () => { if (!roteiro.trim() || (await confirmarFrase("Pôr o gabarito no fim do roteiro?"))) mudar("roteiro", roteiro.trim() ? `${roteiro}\n\n${GABARITO}` : GABARITO); }}
          citar={() => setPainel("citar")}
          checar={pegarSelecao}
          prompter={() => setPrompter(true)}
        />
      )}
      {!podeProduzir && <Botao variante="principal" onClick={() => setPrompter(true)}>Teleprompter</Botao>}
      {painel === "citar" && <CitarObra aoCitar={citar} fechar={() => setPainel("")} />}
      {painel === "checar" && <ChecarAfirmacao inicial={selecao} fechar={() => setPainel("")} />}
      {prompter && <Teleprompter texto={roteiro} fechar={() => setPrompter(false)} />}
      {podeProduzir ? (
        <MarkdownEditor id="podcast-roteiro" value={roteiro} onChange={(v) => mudar("roteiro", v)} labels={editorPt} rows={22} placeholder="Escreva o roteiro, ou comece pelo gabarito." blocos />
      ) : (
        <Cartao as="div">
          <pre className="whitespace-pre-wrap font-serif text-lg">{roteiro || "Sem roteiro ainda."}</pre>
        </Cartao>
      )}
      <section className="space-y-2">
        <h3 className="pn-rotulo-mono">Obras do acervo citadas ({obras.length})</h3>
        {obras.length > 0 && (
          <Lista rotulo="Obras do acervo citadas">
            {obras.map((o) => (
              <ItemDeLista
                key={o.id}
                titulo={<>{o.titulo} · {o.autor}</>}
                meta={`${o.licenca}; ${o.fonte}`}
                acoes={podeProduzir && <Botao variante="discreto" pequeno onClick={() => mudar("obras", obras.filter((x) => x.id !== o.id))}>tirar</Botao>}
              />
            ))}
          </Lista>
        )}
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
    <div className="grid max-w-5xl gap-5 lg:grid-cols-2">
      <Cartao titulo="Convidados do episódio" nivelDoTitulo={3} sobre="O episódio só publica com a autorização de voz de todos. Mande o link do convidado: ele lê o termo, aceita e testa o microfone.">
        {convidados.erro && <Faixa tom="erro" className="mt-2" acao={<Botao pequeno onClick={convidados.recarregar}>Tentar de novo</Botao>}>{convidados.erro}</Faixa>}
        {convidados.dados === null && !convidados.erro && <Esqueleto linhas={3} />}
        {convidados.dados && convidados.dados.length > 0 && (
          <Lista rotulo="Convidados do episódio" className="mt-2!">
            {convidados.dados.map((c) => (
              <li key={c.id} className="pn-item flex-wrap justify-between">
                <Marca rotulo={c.nome} disabled={!podeProduzir} checked={marcados.includes(c.id)} onChange={(ev) => mudar("convidados", ev.target.checked ? [...marcados, c.id] : marcados.filter((x) => x !== c.id))} />
                <Selo tom={c.autoriza_voz ? "ok" : "erro"} ponto>{c.autoriza_voz ? "autorizado" : "sem autorização"}</Selo>
                {c.link && <Botao variante="discreto" pequeno simbolo={Link2} onClick={() => void navigator.clipboard.writeText(linkDoConvidado(c.link!))}>copiar link</Botao>}
              </li>
            ))}
          </Lista>
        )}
        {podeProduzir && (
          <form className="mt-3 flex items-end gap-2" onSubmit={(ev) => { ev.preventDefault(); if (nome.trim().length >= 2) void novo(); }}>
            <input value={nome} onChange={(ev) => setNome(ev.target.value)} placeholder="Nome de um convidado novo" aria-label="Nome de um convidado novo" className="pn-campo" />
            <Botao type="submit" simbolo={Plus} disabled={nome.trim().length < 2}>Cadastrar</Botao>
          </form>
        )}
        <p className="mt-2 text-sm text-ink-soft">Contato, minibio, link e termo assinado ficam na aba Convidados do podcast.</p>
        <Aviso texto={aviso} />
      </Cartao>
      <Cartao titulo="Trilhas e vinhetas usadas" nivelDoTitulo={3} sobre="Só faixas da biblioteca, que têm a licença registrada.">
        {trilhas.erro && <Faixa tom="erro" className="mt-2" acao={<Botao pequeno onClick={trilhas.recarregar}>Tentar de novo</Botao>}>{trilhas.erro}</Faixa>}
        {trilhas.dados === null && !trilhas.erro && <Esqueleto linhas={3} />}
        {trilhas.dados && trilhas.dados.length > 0 && (
          <Lista rotulo="Trilhas e vinhetas usadas" className="mt-2!">
            {trilhas.dados.map((x) => (
              <li key={x.id} className="pn-item">
                <label className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1" disabled={!podeEditar} checked={usadas.includes(x.id)} onChange={(ev) => mudar("trilhas", ev.target.checked ? [...usadas, x.id] : usadas.filter((y) => y !== x.id))} />
                  <span>
                    {x.titulo} <span className="text-ink-soft">· {x.autor}</span>
                    <span className="block font-mono text-xs text-ink-soft">{x.tipo} · {x.licenca}</span>
                  </span>
                </label>
              </li>
            ))}
          </Lista>
        )}
        {trilhas.dados?.length === 0 && <Vazio titulo="A biblioteca está vazia." texto="Cadastre as faixas na aba Biblioteca de áudios." />}
      </Cartao>
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
    if (!(await confirmarFrase("Tirar este arquivo do depósito? O registro fica no histórico de versões."))) return;
    try {
      const r = await rpc<{ liberar: { deposito: string; caminho: string }[] }>("podcast_arquivo_remover", { p_id: arquivoId });
      await liberarEspaco(r.liberar);
      recarregar();
    } catch (erro) {
      setAviso(mensagemDeErro(erro));
    }
  }

  return (
    <div className="max-w-4xl space-y-5">
      {podeEditar && (
        <Cartao titulo="Enviar uma versão" nivelDoTitulo={3} sobre="Até 50 MB por arquivo. O final vai em MP3 (96 a 128 kbps; mono para conversa). Bruto em WAV costuma passar disso: guarde no Internet Archive ou no Drive e registre só o link, logo abaixo.">
          <div className="mt-2 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Selecao rotulo="Tipo" value={tipo} onChange={(ev) => setTipo(ev.target.value as keyof typeof TIPOS_DE_ARQUIVO)}>
                {Object.entries(TIPOS_DE_ARQUIVO).map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
              </Selecao>
              <Campo rotulo="Nota (opcional)" value={nota} onChange={(ev) => setNota(ev.target.value)} maxLength={500} placeholder="ex.: cortei o bloco 2" />
            </div>
            {tipo === "final" && <Marca rotulo="Usar como o áudio do episódio (mede o volume e desenha a onda)" checked={usar} onChange={(ev) => setUsar(ev.target.checked)} />}
            <label className={`${botao} ${FOCO_DO_ARQUIVO} ${andamento ? "pointer-events-none opacity-50" : ""}`} aria-busy={andamento ? true : undefined}>
              <Upload aria-hidden />
              {andamento ? `${andamento.fase}… ${Math.round(andamento.fracao * 100)}%` : "Escolher arquivo"}
              <input type="file" accept={tipo === "video" ? "video/*" : tipo === "outro" ? undefined : "audio/*"} className="sr-only" disabled={Boolean(andamento)} onChange={(ev) => { void enviar(ev.target.files?.[0]); ev.target.value = ""; }} />
            </label>
            {andamento && (
              <span role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(andamento.fracao * 100)} aria-label={andamento.fase} className="block h-1.5 w-full max-w-md overflow-hidden rounded-full bg-[var(--pn-ativo)]">
                <span className="block h-full bg-[var(--pn-destaque)]" style={{ width: `${Math.round(andamento.fracao * 100)}%` }} />
              </span>
            )}
            <details>
              <summary className="cursor-pointer rounded-[var(--pn-raio)]">Registrar só o link (arquivo grande, cópia de segurança)</summary>
              <form className="mt-2 grid gap-2 sm:grid-cols-[1fr_2fr_auto]" onSubmit={async (ev) => { ev.preventDefault(); try { await rpc("podcast_arquivo_registrar", { p_episodio: e.id, p: { tipo, nome: link.nome, link: link.link, nota } }); setLink({ nome: "", link: "" }); recarregar(); } catch (erro) { setAviso(mensagemDeErro(erro)); } }}>
                <input value={link.nome} onChange={(ev) => setLink({ ...link, nome: ev.target.value })} placeholder="Nome" aria-label="Nome" required className="pn-campo" />
                <input value={link.link} onChange={(ev) => setLink({ ...link, link: ev.target.value })} placeholder="https://archive.org/…" aria-label="https://archive.org/…" required className="pn-campo" />
                <Botao type="submit">Registrar</Botao>
              </form>
            </details>
          </div>
        </Cartao>
      )}
      <Aviso texto={aviso} />
      {analise && (
        <Faixa tom="aviso">
          <p className="font-mono text-xs">
            Duração {relogio(analise.duracao)} · volume {analise.lufs ?? "?"} LUFS · pico {analise.pico ?? "?"} dB · partes quietas {analise.ruido ?? "?"} LUFS
          </p>
          <ul className="mt-1 list-disc pl-5">
            {conselhoDeVolume(analise).map((d) => <li key={d}>{d}</li>)}
          </ul>
          {analise.lufs !== null && <p className="mt-1 text-xs text-ink-soft">Medida feita aqui no navegador, pela norma BS.1770 (a mesma das plataformas). Use para conferir o item &quot;volume&quot; da lista.</p>}
        </Faixa>
      )}
      <section className="space-y-2">
        <h3 className="pn-rotulo-mono">Versões ({e.arquivos.length})</h3>
        {e.arquivos.length > 0 && (
          <Lista rotulo="Versões">
            {e.arquivos.map((a) => {
              const noAr = a.caminho !== "" && a.caminho === e.audio;
              return (
                <li key={a.id} className={`space-y-1 border-b border-[var(--pn-borda)] px-3.5 py-3 last:border-b-0 ${a.guardado || a.link ? "" : "opacity-60"}`}>
                  <p className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="flex flex-wrap items-center gap-2">
                      <Selo>{a.tipo}</Selo>
                      <strong>{a.nome}</strong>
                      {noAr && <Selo tom="ok" ponto>áudio do episódio</Selo>}
                    </span>
                    <span className="font-mono text-xs text-ink-soft">{a.bytes ? bytes(a.bytes) : ""} · {a.enviado_por_nome ?? "—"} · {dataHora(a.criado_em)}</span>
                  </p>
                  {a.nota && <p className="text-ink-soft">{a.nota}</p>}
                  <div className="flex flex-wrap items-center gap-2">
                    {a.guardado && a.deposito === "podcast" && <audio controls preload="none" src={urlPublica(a.caminho)} className="h-10 w-full max-w-md" />}
                    {a.guardado && a.deposito === "podcast-producao" && <OuvirFechado caminho={a.caminho} video={a.tipo === "video"} />}
                    {a.link && <a href={a.link} target="_blank" rel="noopener noreferrer" className="pn-elo inline-flex items-center gap-1">Abrir o link <ExternalLink aria-hidden className="h-3.5 w-3.5" /></a>}
                    {!a.guardado && !a.link && <span className="text-xs text-ink-soft">saiu do depósito</span>}
                    {podeEditar && a.guardado && a.tipo === "final" && a.deposito === "podcast" && !noAr && <Botao variante="discreto" pequeno onClick={() => void medir(a.id, a.caminho, true)}>Usar como áudio do episódio</Botao>}
                    {podeEditar && a.guardado && a.deposito === "podcast" && <Botao variante="discreto" pequeno onClick={() => void medir(a.id, a.caminho, false)}>Medir o volume</Botao>}
                    {podeEditar && a.guardado && a.caminho && <Botao variante="discreto" pequeno perigo simbolo={Trash2} onClick={() => void remover(a.id)}>Tirar do depósito</Botao>}
                  </div>
                </li>
              );
            })}
          </Lista>
        )}
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
      <p className="pn-sobre">Ouça no tocador acima e comente no ponto exato: o comentário guarda o tempo, e um clique no tempo leva o áudio até lá. Quem cuida do episódio é avisado a cada comentário.</p>
      <Cartao as="div">
        <form className="space-y-2" onSubmit={(ev) => { ev.preventDefault(); void comentar(); }}>
          <textarea value={texto} onChange={(ev) => setTexto(ev.target.value)} rows={3} maxLength={2000} required aria-label="O que precisa mudar?" placeholder="O que precisa mudar? (ex.: cortar a respiração longa; repetir a data)" className="pn-campo" />
          <p className="flex flex-wrap items-center gap-4">
            <Marca rotulo="Marcar o tempo do tocador agora" checked={comTempo} onChange={(ev) => setComTempo(ev.target.checked)} />
            <Botao type="submit" variante="principal" disabled={!texto.trim()}>Comentar</Botao>
          </p>
        </form>
      </Cartao>
      <Aviso texto={aviso} />
      {e.comentarios.length > 0 && (
        <ul className="space-y-2">
          {e.comentarios.map((c) => (
            <li key={c.id} className={`pn-cartao border-l-4! p-3! ${c.resolvido ? "border-l-[var(--pn-borda)]! text-ink-soft" : "border-l-[var(--pn-destaque)]!"}`}>
              <p className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                <strong className="text-ink">{c.autor}</strong> · {dataHora(c.criado_em)}
                {c.tempo !== null && <button type="button" onClick={() => irPara(c.tempo ?? 0)} className="pn-elo font-mono">{relogio(c.tempo)}</button>}
              </p>
              <p className={`mt-1 whitespace-pre-line ${c.resolvido ? "line-through" : ""}`} data-original>{c.texto}</p>
              <Botao variante="discreto" pequeno simbolo={c.resolvido ? Undo2 : CircleCheck} onClick={() => rpc("podcast_comentario_resolver", { p_id: c.id, p_resolvido: !c.resolvido }).then(recarregar).catch(() => {})}>
                {c.resolvido ? "reabrir" : "marcar como resolvido"}
              </Botao>
            </li>
          ))}
        </ul>
      )}
      {e.comentarios.length === 0 && <Vazio titulo="Nenhum comentário ainda." />}
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
      const motivos: Record<string, string> = {
        grande: "O áudio passa de 25 MB, o limite do serviço gratuito de transcrição. Use o Buzz no computador (de graça, sem internet) e importe o arquivo .srt ou .vtt.",
        cota: "A cota gratuita do serviço de transcrição acabou por hoje. Tente amanhã, ou use o Buzz no computador e importe o .srt.",
        sem_audio: "O episódio ainda não tem áudio final no depósito.",
        desligada: "A transcrição automática ainda não foi ligada no servidor (veja docs/podcast-setup.md). Enquanto isso, use o Buzz no computador e importe o arquivo .srt ou .vtt.",
      };
      setAviso(motivos[motivo] ?? "A transcrição automática falhou ou não está ligada no servidor. Use o Buzz no computador e importe o arquivo .srt ou .vtt. Veja o Guia.");
    } finally {
      setTranscrevendo(false);
    }
  }

  async function montarNotas() {
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
    if (valor("notas").trim() && !(await confirmarFrase("Trocar as notas atuais pelas montadas?"))) return;
    mudar("notas", linhas.join("\n"));
  }

  return (
    <div className="max-w-4xl space-y-5">
      <Cartao titulo="Capa" nivelDoTitulo={3}>
        <div className="mt-2 flex flex-wrap items-start gap-5">
          <div className="w-40">
            {e.capa ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={urlPublica(e.capa_mini || e.capa)} alt="Capa atual" width={160} height={160} className="aspect-square w-full rounded-[var(--pn-raio)] border border-[var(--pn-borda)] object-cover" />
            ) : (
              <p className="flex aspect-square items-center justify-center rounded-[var(--pn-raio)] border border-dashed border-[var(--pn-borda-forte)] p-3 text-center text-ink-soft">Sem capa</p>
            )}
          </div>
          <div className="space-y-2">
            <EnviarCapaSimples aoEnviar={capa} pasta={e.id} rotuloBotao="Enviar a capa pronta (recorte quadrado, 3000 × 3000)" />
            <p className="text-ink-soft">Ou crie com um dos modelos do instituto, logo abaixo: troque o título e pronto.</p>
          </div>
        </div>
        <details className="mt-4 rounded-[var(--pn-raio)] border border-[var(--pn-borda)] p-4" open={!e.capa}>
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
      </Cartao>

      {!soDesign && (
        <>
          <Cartao titulo="Notas do episódio" nivelDoTitulo={3} acoes={podeEditar && <Botao pequeno onClick={montarNotas}>Montar as notas (resumo, capítulos, convidados, obras, fontes e trilhas)</Botao>}>
            <div className="mt-2">
              <MarkdownEditor id="podcast-notas" value={valor("notas")} onChange={(v) => mudar("notas", v)} labels={editorPt} rows={12} />
            </div>
          </Cartao>

          <Cartao titulo="Capítulos" nivelDoTitulo={3} sobre="Uma linha por capítulo: o tempo e o título (ex.: 12:40 O cerco de Paris). Aparecem no site, nos tocadores que leem capítulos e nas notas.">
            <textarea value={capitulosTexto} onChange={(ev) => setCapitulosTexto(ev.target.value)} rows={6} aria-label="Capítulos" className="pn-campo mt-2 font-mono" />
            {podeEditar && <Botao variante="discreto" pequeno simbolo={Plus} className="mt-2" onClick={() => setCapitulosTexto(`${capitulosTexto.replace(/\s+$/, "")}${capitulosTexto.trim() ? "\n" : ""}${relogio(tempoAtual())} `)}>Inserir o tempo do tocador ({relogio(tempoAtual())})</Botao>}
          </Cartao>

          <Cartao titulo="Transcrição" nivelDoTitulo={3} sobre="Para quem não ouve e para a busca do site. Com legendas (.vtt ou .srt), a transcrição fica clicável na página e alimenta a legenda dos cortes.">
            {podeEditar && (
              <p className="mt-2 flex flex-wrap items-center gap-2">
                <Botao carregando={transcrevendo} disabled={transcrevendo || !(e.audio && e.audio_guardado)} onClick={() => void transcrever()}>{transcrevendo ? "Transcrevendo…" : "Transcrever automaticamente (Whisper)"}</Botao>
                <label className={`${botaoClaro} ${FOCO_DO_ARQUIVO}`}>
                  <Upload aria-hidden />
                  Importar .srt, .vtt ou .txt
                  <input type="file" accept=".srt,.vtt,.txt,text/plain,text/vtt" className="sr-only" onChange={(ev) => { void importar(ev.target.files?.[0]); ev.target.value = ""; }} />
                </label>
                {valor("legendas") && <Selo tom="ok" ponto>legendas com tempo ({lerLegendas(valor("legendas")).length} falas)</Selo>}
              </p>
            )}
            <textarea value={valor("transcricao")} onChange={(ev) => mudar("transcricao", ev.target.value)} rows={10} aria-label="Transcrição" className="pn-campo mt-2" placeholder="A transcrição em texto corrido." />
          </Cartao>

          <Cartao titulo="Cópia de fora" nivelDoTitulo={3}>
            <p className="pn-cartao-sobre">
              O depósito do site guarda o áudio só dos episódios mais recentes ({painel.config.guardados}). Para este continuar tocando depois, suba o MP3 final no Internet Archive (archive.org → Upload, licença CC BY-SA)
              e cole aqui o link direto do arquivo .mp3 (o que termina em .mp3).
            </p>
            <input value={valor("audio_externo")} onChange={(ev) => mudar("audio_externo", ev.target.value)} placeholder="https://archive.org/download/…/episodio.mp3" aria-label="Cópia de fora" className="pn-campo mt-2" />
          </Cartao>

          <Cartao titulo="Lista de conferência" nivelDoTitulo={3} sobre="O episódio só publica com tudo certo. Os itens marcados à mão ficam com quem edita; os outros o sistema confere (atualizam ao guardar).">
            <ul className="mt-2 space-y-1.5">
              {(["volume", "ruido", "fontes", "trilhas"] as const).map((item) => (
                <li key={item}>
                  <Marca rotulo={PENDENCIAS[item]} disabled={!podeEditar} checked={Boolean(checklist[item])} onChange={(ev) => mudar("checklist", { ...checklist, [item]: ev.target.checked })} />
                </li>
              ))}
            </ul>
            <ul className="mt-3 space-y-1 border-t border-[var(--pn-borda)] pt-3">
              {Object.entries(PENDENCIAS)
                .filter(([item]) => !["volume", "ruido", "fontes", "trilhas"].includes(item))
                .map(([item, nome]) => {
                  const falta = e.pendencias.includes(item);
                  return (
                    <li key={item} className={`flex items-start gap-2 ${falta ? "text-oxblood" : "text-ok"}`}>
                      {falta ? <CircleX aria-hidden className="mt-0.5 h-4 w-4 shrink-0" /> : <CircleCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />}
                      <span>
                        <span className="sr-only">{falta ? "✗" : "✓"} </span>
                        {nome}
                      </span>
                    </li>
                  );
                })}
            </ul>
          </Cartao>
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
    <div className="space-y-5">
      <Cartao titulo="Artes de divulgação" nivelDoTitulo={3} sobre="Post quadrado, post em pé e story, com a cara do instituto. Baixe e publique, ou agende na Agenda.">
        <div className="mt-3">
          <EstudioDeArte inicial={{ titulo: e.titulo, programa: painel.config.nome, serie: serie?.titulo ?? "", numero: e.numero != null ? String(e.numero) : "", temporada: e.temporada ? String(e.temporada) : "", convidado: e.convidados_dados.map((c) => c.nome).join(" e ") }} />
        </div>
      </Cartao>
      {!soDesign && (
        <Cartao titulo="Cortes para as redes" nivelDoTitulo={3}>
          <div className="mt-3">
            <GeradorDeCortes episodio={{ titulo: e.titulo, programa: painel.config.nome, capa: e.capa_mini || e.capa, audio: e.audio && e.audio_guardado ? e.audio : "", legendas: e.legendas }} />
          </div>
        </Cartao>
      )}
      {painel.eu.time && (
        <Cartao titulo="Pedir arte ao design" nivelDoTitulo={3}>
          <div className="mt-2 space-y-3">
            <textarea value={pedido} onChange={(ev) => setPedido(ev.target.value)} rows={3} maxLength={1000} aria-label="Pedir arte ao design" placeholder="O que precisa (capa especial, carrossel, ajuste de modelo), formato e prazo." className="pn-campo" />
            <Botao variante="principal" disabled={pedido.trim().length < 5} onClick={() => void pedir()}>Pedir ao design</Botao>
            {e.pedidos.length > 0 && (
              <Lista rotulo="Pedidos ao design">
                {e.pedidos.map((p) => (
                  <ItemDeLista key={p.id} titulo={<span className="whitespace-normal">{p.texto}</span>} meta={`${p.pedido_por ?? ""} · ${dataHora(p.criado_em)}`} selo={<Selo tom={p.status === "aberto" ? "bordo" : "ok"}>{p.status}</Selo>} />
                ))}
              </Lista>
            )}
          </div>
        </Cartao>
      )}
      <Aviso texto={aviso} />
    </div>
  );
}
