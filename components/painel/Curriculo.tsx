// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { areaSlugs, groups, stageAreas, stages, type Stage } from "@/lib/areas";
import { can, disciplinasQueEnsina, escreveEm, getClient, type Me } from "@/lib/backend";
import { useI18n } from "../I18n";
import { type TrackOption, useTrackOptions } from "../useTrackOptions";
import { ArrowDown, ArrowUp, ArrowUpRight, Check, ChevronLeft, ChevronRight, FolderInput, GitPullRequestArrow, Pencil, Plus, Send, Trash2, Undo2, UserPlus, X } from "lucide-react";
import { dataHora, useAcao, useLista } from "./comum";
import { Abas, Area, Botao, Busca, CabecalhoDeSecao, Campo, Cartao, Contador, Faixa, Marca, Selecao, Selo, Vazio } from "./ui";
import type { Membro } from "./Equipe";

interface Convite {
  id: string;
  disciplina: string;
  trilha: string | null;
  nota: string;
  criado_em: string;
  convidado: string;
  convidado_id: string;
  por: string;
  meu: boolean;
  posso_revogar: boolean;
}

type TipoDeProposta = "disciplina" | "trilha" | "editar_disciplina" | "editar_trilha" | "remover_disciplina" | "remover_trilha" | "arquivar_trilha";
interface Proposta {
  id: string;
  tipo: TipoDeProposta;
  dados: Record<string, unknown>;
  status: "pendente" | "aprovada" | "recusada" | "aplicada" | "falhou" | "cancelada";
  nota: string;
  criado_em: string;
  decidido_em: string | null;
  aplicada_em: string | null;
  autor: string;
  minha: boolean;
}

const TIPOS: Record<TipoDeProposta, string> = {
  disciplina: "Nova disciplina",
  trilha: "Nova trilha",
  editar_disciplina: "Disciplina editada",
  editar_trilha: "Trilha editada",
  remover_disciplina: "Disciplina removida",
  remover_trilha: "Trilha removida",
  arquivar_trilha: "Trilha arquivada",
};
const IDIOMAS: [string, string][] = [["pt", "Português"], ["en", "Inglês"], ["es", "Espanhol"], ["fr", "Francês"], ["ru", "Russo"], ["zh", "Chinês"]];
const ETAPA_CURTA: Record<Stage, string> = { fundamental: "Fund.", medio: "Médio", superior: "Sup." };
const slugDe = (t: string) => t.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
const andando = (p: Proposta) => p.status === "pendente" || p.status === "aprovada";
const semAcento = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
/** Uma mudança aplicada leva o tempo de um build para aparecer no site; depois disso, se não apareceu, se perdeu. */
const PRAZO_DO_SITE = 2 * 60 * 60 * 1000;

/** O roteiro no editor: cada aula com o título e se já está escrita (escrita não sai nem muda de nome). */
interface AulaDoRoteiro {
  chave: string;
  titulo: string;
  pronta: boolean;
}
interface EdicaoDeTrilha {
  nova: boolean;
  slug: string;
  disciplina: string;
  titulo: string;
  resumo: string;
  etapa: Stage;
  ordem: number;
  intro: string;
  aulas: AulaDoRoteiro[];
}
interface EdicaoDeDisciplina {
  nova: boolean;
  slug: string;
  grupo: string;
  etapas: Stage[];
  nomes: Record<string, string>;
  descricoes: Record<string, string>;
}

let proximaChave = 0;
const chave = () => `a${++proximaChave}`;

/**
 * Disciplinas e trilhas pelo painel: a coordenação e a coordenação pedagógica criam, editam, reordenam, movem, arquivam e
 * removem (a rotina de publicação escreve nos arquivos do site, e o build confere); quem ensina sugere mudanças nas
 * disciplinas que ensina e convida colegas de outras para ajudar. O mapa já mostra o efeito do que está a caminho.
 */
export function Curriculo({ me }: { me: Me }) {
  const { t, lang } = useI18n();
  const decide = can(me, "coordenacao", "vice");
  const tracks = useTrackOptions(lang);
  const propostas = useLista<Proposta[]>("curriculo_listar");
  const convites = useLista<Convite[]>("disciplina_convites");
  const membros = useLista<Membro[]>("equipe_membros", {}, { quieta: true });
  const acao = useAcao(() => {
    propostas.recarregar();
    convites.recarregar();
  });
  const [aberta, setAberta] = useState<string | null>(null);
  const [vista, setVista] = useState<"mapa" | "convites">("mapa");
  const [grupo, setGrupo] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [trilha, setTrilha] = useState<EdicaoDeTrilha | null>(null);
  const [disciplina, setDisciplina] = useState<EdicaoDeDisciplina | null>(null);
  const [mudancas, setMudancas] = useState(false);
  const [publicarAgora, setPublicarAgora] = useState(false);
  const [agora] = useState(() => Date.now());

  useEffect(() => {
    if (!decide) return;
    let vivo = true;
    fetch("/api/painel/publicar-agora")
      .then((r) => r.json())
      .then((r: { configurado?: boolean }) => vivo && setPublicarAgora(Boolean(r.configurado)))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [decide]);

  const minhas = disciplinasQueEnsina(me);
  const posso = (slug: string) => decide || escreveEm(me, slug);
  const nomeDaArea = (slug: string) => t.areas[slug as keyof typeof t.areas]?.[0] ?? slug;
  const descricaoDaArea = (slug: string) => t.areas[slug as keyof typeof t.areas]?.[1] ?? "";
  const etapasDa = (slug: string) => stages.filter((e) => (stageAreas[e] as readonly string[]).includes(slug));
  const lista = propostas.dados ?? [];
  const ativas = lista.filter(andando);
  const daDisciplina = (slug: string) => ativas.filter((p) => (p.tipo === "editar_disciplina" || p.tipo === "remover_disciplina") && p.dados.slug === slug);
  const daTrilha = (slug: string) => ativas.filter((p) => (p.tipo === "editar_trilha" || p.tipo === "remover_trilha" || p.tipo === "arquivar_trilha") && p.dados.slug === slug);
  const trilhasNovas = (slug: string) => ativas.filter((p) => p.tipo === "trilha" && p.dados.disciplina === slug);
  const novasDisciplinas = ativas.filter((p) => p.tipo === "disciplina");

  /** Uma mudança dada como aplicada que não chegou ao site (a rotina perdia as de disciplina): dá para mandar de novo. */
  const naoChegou = (p: Proposta): boolean => {
    if (p.status !== "aplicada" || !p.aplicada_em || agora - new Date(p.aplicada_em).getTime() < PRAZO_DO_SITE) return false;
    const slug = String(p.dados.slug ?? "");
    const trilhas = tracks.length > 0;
    switch (p.tipo) {
      case "disciplina":
        return !(areaSlugs as readonly string[]).includes(slug);
      case "remover_disciplina":
        return (areaSlugs as readonly string[]).includes(slug);
      case "editar_disciplina": {
        const nome = (p.dados.nomes as Record<string, string> | undefined)?.[lang] ?? (lang === "pt" ? (p.dados.nomes as Record<string, string> | undefined)?.pt : undefined);
        return Boolean(nome) && nomeDaArea(slug) !== nome;
      }
      case "trilha":
        return trilhas && !tracks.some((x) => x.slug === slug);
      case "remover_trilha":
      case "arquivar_trilha":
        return trilhas && tracks.some((x) => x.slug === slug);
      case "editar_trilha":
        return trilhas && Boolean(p.dados.titulo) && lang === "pt" && tracks.find((x) => x.slug === slug)?.title !== p.dados.titulo;
    }
  };
  const perdidas = lista.filter(naoChegou);
  const pendentes = lista.filter((p) => p.status === "pendente").length;
  const falhas = lista.filter((p) => p.status === "falhou").length;
  const aCaminho = lista.filter((p) => p.status === "aprovada").length;

  const termo = semAcento(busca.trim());
  const visiveis = groups.flatMap((g) =>
    g.areas
      .filter((slug) => (decide ? true : posso(slug)))
      .filter(() => grupo === "todos" || grupo === g.id)
      .filter((slug) => !termo || semAcento(`${nomeDaArea(slug)} ${slug} ${tracks.filter((x) => x.area === slug).map((x) => x.title).join(" ")}`).includes(termo))
      .map((slug) => ({ slug, grupo: g.id as string })),
  );
  const totalDeTrilhas = tracks.length;
  const aulasProntas = tracks.reduce((s, x) => s + (x.plan?.filter((p) => p.ready).length ?? x.ready ?? 0), 0);
  const aulasNoRoteiro = tracks.reduce((s, x) => s + (x.plan?.length ?? 0), 0);

  async function propor(tipo: TipoDeProposta, dados: Record<string, unknown>, feito: string) {
    return acao.agir("curriculo_propor", { p_tipo: tipo, p_dados: dados }, decide ? `${feito} Vai ao ar na próxima publicação.` : "Sugestão enviada: a coordenação foi avisada.");
  }

  async function pedirPublicacao() {
    try {
      const supabase = await getClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const r = await fetch("/api/painel/publicar-agora", { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const corpo = (await r.json().catch(() => ({}))) as { erro?: string };
      acao.setAviso(r.ok ? "Publicação pedida: em alguns minutos o GitHub roda a rotina, e o site atualiza depois do build." : (corpo.erro ?? "Não deu para pedir a publicação."));
    } catch {
      acao.setAviso("Não deu para pedir a publicação.");
    }
  }

  const abrirEditorDeTrilha = (x: TrackOption | null, area: string) => {
    setTrilha(
      x
        ? { nova: false, slug: x.slug, disciplina: x.area, titulo: x.title, resumo: x.summary ?? "", etapa: (x.stage ?? "medio") as Stage, ordem: 0, intro: "", aulas: (x.plan ?? []).map((p) => ({ chave: chave(), titulo: p.title, pronta: p.ready })) }
        : { nova: true, slug: "", disciplina: area, titulo: "", resumo: "", etapa: etapasDa(area)[0] ?? "medio", ordem: tracks.filter((t2) => t2.area === area).length + 1, intro: "", aulas: [{ chave: chave(), titulo: "", pronta: false }] },
    );
  };

  return (
    <div className="space-y-5">
      {/* Cabeçalho: os números do currículo, a busca e o que está a caminho do site. */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-4">
        <div className="min-w-0">
          <p className="pn-rotulo-mono">{decide ? "Currículo do site" : "As disciplinas que você ensina"}</p>
          <p className="tabular mt-1 text-sm text-ink-soft">
            {decide ? `${areaSlugs.length} disciplinas` : `${minhas.length} disciplina(s) sua(s)`} · {totalDeTrilhas} trilhas · {aulasProntas.toLocaleString("pt-BR")} aulas escritas de {aulasNoRoteiro.toLocaleString("pt-BR")} no roteiro
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Busca rotulo="Procurar disciplina ou trilha" placeholder="Procurar disciplina ou trilha" valor={busca} aoMudar={setBusca} className="w-60" />
          <Botao simbolo={GitPullRequestArrow} aria-expanded={mudancas} onClick={() => setMudancas(!mudancas)}>
            Mudanças
            <Contador n={pendentes + falhas + perdidas.length} />
            {aCaminho > 0 && (
              <Selo tom="ouro" titulo="A caminho do site">
                {aCaminho}
              </Selo>
            )}
          </Botao>
          {decide && publicarAgora && aCaminho > 0 && (
            <Botao simbolo={Send} onClick={() => void pedirPublicacao()} title="Roda a rotina de publicação agora, sem esperar a da hora">
              Publicar agora
            </Botao>
          )}
          <Botao variante="principal" simbolo={decide ? Plus : undefined} aria-label={decide ? "Nova disciplina" : undefined} onClick={() => setDisciplina({ nova: true, slug: "", grupo: grupo === "todos" ? "humanidades" : grupo, etapas: ["medio"], nomes: {}, descricoes: {} })}>
            {decide ? "Disciplina" : "Sugerir disciplina"}
          </Botao>
        </div>
      </header>
      {propostas.erro && (
        <Faixa
          tom="erro"
          acao={
            <Botao pequeno onClick={propostas.recarregar}>
              Tentar de novo
            </Botao>
          }
        >
          {propostas.erro}
        </Faixa>
      )}
      {!propostas.erro && acao.aviso && <Faixa tom="info">{acao.aviso}</Faixa>}
      {perdidas.length > 0 && decide && (
        <Faixa
          tom="aviso"
          titulo={`${perdidas.length} mudança(s) marcada(s) como publicada(s) não chegaram ao site.`}
          acao={
            <Botao pequeno disabled={acao.ocupado} onClick={() => void Promise.all(perdidas.map((p) => acao.agir("curriculo_reaplicar", { p_id: p.id }, "Mandadas de novo: vão ao ar na próxima publicação.")))}>
              Mandar todas de novo
            </Botao>
          }
        >
          A rotina de publicação não guardava as mudanças de disciplina (nome, descrição, criação e remoção); já está consertada.
        </Faixa>
      )}
      <Abas
        rotulo="Currículo"
        valor={vista}
        aoMudar={(v) => {
          setVista(v);
          setAberta(null);
        }}
        opcoes={[
          { id: "mapa", nome: "Disciplinas e trilhas" },
          { id: "convites", nome: "Convites para ajudar", conta: (convites.dados ?? []).length },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
        {/* Grupos (filtro) e convites. */}
        <nav aria-label="Grupos de disciplinas" className="pn-lista self-start text-sm lg:sticky lg:top-16">
          {[{ id: "todos", nome: "Todas" }, ...groups.map((g) => ({ id: g.id as string, nome: t.groups[g.id as keyof typeof t.groups] ?? g.id }))].map((g) => {
            const quantas = g.id === "todos" ? visiveisNoGrupo(null) : visiveisNoGrupo(g.id);
            if (!decide && quantas === 0 && g.id !== "todos") return null;
            const atual = grupo === g.id && vista === "mapa";
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  setGrupo(g.id);
                  setVista("mapa");
                  setAberta(null);
                }}
                aria-pressed={atual}
                className="pn-item pn-item-botao justify-between"
                style={atual ? { background: "var(--pn-ativo)", fontWeight: 600, boxShadow: "inset 2px 0 0 var(--pn-destaque-vivo)" } : undefined}
              >
                <span className="truncate">{g.nome}</span>
                <span className="tabular font-mono text-xs text-ink-soft">{quantas}</span>
              </button>
            );
          })}
        </nav>

        <div className="min-w-0">
          {vista === "convites" ? (
            <Convites decide={decide} minhas={minhas} convites={convites.dados ?? []} membros={membros.dados ?? []} tracks={tracks} nomeDaArea={nomeDaArea} acao={acao} />
          ) : aberta ? (
            <Detalhe
              slug={aberta}
              decide={decide}
              posso={posso(aberta)}
              nome={nomeDaArea(aberta)}
              descricao={descricaoDaArea(aberta)}
              etapas={etapasDa(aberta)}
              trilhas={tracks.filter((x) => x.area === aberta)}
              novas={trilhasNovas(aberta)}
              mudancasDaDisciplina={daDisciplina(aberta)}
              mudancasDaTrilha={daTrilha}
              convites={(convites.dados ?? []).filter((c) => c.disciplina === aberta)}
              outras={areaSlugs.filter((s) => s !== aberta)}
              nomeDaArea={nomeDaArea}
              voltar={() => setAberta(null)}
              editar={() => setDisciplina({ nova: false, slug: aberta, grupo: groups.find((g) => (g.areas as readonly string[]).includes(aberta))?.id ?? "", etapas: etapasDa(aberta), nomes: { pt: nomeDaArea(aberta) }, descricoes: { pt: descricaoDaArea(aberta) } })}
              editarTrilha={(x) => abrirEditorDeTrilha(x, aberta)}
              propor={propor}
              cancelar={(p) => void acao.agir("curriculo_cancelar", { p_id: p.id }, "Mudança cancelada.")}
              ocupado={acao.ocupado}
            />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {novasDisciplinas.filter((p) => grupo === "todos" || p.dados.grupo === grupo).map((p) => (
                <li key={p.id} className="pn-cartao" style={{ borderStyle: "dashed", borderColor: "var(--pn-ouro)" }}>
                  <Selo tom="ouro">{p.status === "pendente" ? "sugestão esperando decisão" : "nova · vai ao ar na próxima publicação"}</Selo>
                  <p className="mt-2 font-serif text-xl font-semibold">{String((p.dados.nomes as Record<string, string> | undefined)?.pt ?? p.dados.slug)}</p>
                  <p className="mt-2 text-xs">
                    <Botao pequeno variante="discreto" simbolo={Undo2} onClick={() => void acao.agir("curriculo_cancelar", { p_id: p.id }, "Cancelada.")}>
                      Desfazer
                    </Botao>
                  </p>
                </li>
              ))}
              {visiveis.map(({ slug }) => (
                <CartaoDaDisciplina
                  key={slug}
                  slug={slug}
                  nome={nomeDaArea(slug)}
                  etapas={etapasDa(slug)}
                  trilhas={tracks.filter((x) => x.area === slug)}
                  mudancas={daDisciplina(slug)}
                  convidado={!decide && !minhas.includes(slug)}
                  abrir={() => setAberta(slug)}
                />
              ))}
              {visiveis.length === 0 && (
                <li className="sm:col-span-2 xl:col-span-3">
                  <Vazio titulo={termo ? "Nenhuma disciplina ou trilha com esse nome." : "Você ainda não ensina nenhuma disciplina: quem ensina pode convidar você para ajudar, ou peça à coordenação a função de educador."} />
                </li>
              )}
            </ul>
          )}
        </div>
      </div>

      {mudancas && (
        <Mudancas
          lista={lista}
          decide={decide}
          naoChegou={naoChegou}
          nomeDaArea={nomeDaArea}
          fechar={() => setMudancas(false)}
          acao={acao}
        />
      )}
      {trilha && (
        <EditorDeTrilha
          inicial={trilha}
          decide={decide}
          disciplinas={areaSlugs.filter(posso)}
          nomeDaArea={nomeDaArea}
          fechar={() => setTrilha(null)}
          salvar={async (e) => {
            const dados: Record<string, unknown> = { slug: e.slug, disciplina: e.disciplina, titulo: e.titulo, etapa: e.etapa, resumo: e.resumo, aulas: e.aulas.map((a) => a.titulo.trim()).filter(Boolean) };
            if (e.nova) Object.assign(dados, { ordem: e.ordem, intro: e.intro });
            if (await propor(e.nova ? "trilha" : "editar_trilha", dados, e.nova ? "Trilha criada." : "Trilha atualizada.")) setTrilha(null);
          }}
          ocupado={acao.ocupado}
        />
      )}
      {disciplina && (
        <EditorDeDisciplina
          inicial={disciplina}
          decide={decide}
          grupos={groups.map((g) => ({ id: g.id as string, nome: t.groups[g.id as keyof typeof t.groups] ?? g.id }))}
          etapasNomes={t.stages}
          fechar={() => setDisciplina(null)}
          salvar={async (e) => {
            const dados: Record<string, unknown> = { slug: e.slug, nomes: e.nomes, descricoes: e.descricoes };
            if (e.nova) Object.assign(dados, { grupo: e.grupo, etapas: e.etapas });
            if (await propor(e.nova ? "disciplina" : "editar_disciplina", dados, e.nova ? "Disciplina criada." : "Disciplina atualizada.")) setDisciplina(null);
          }}
          ocupado={acao.ocupado}
        />
      )}
    </div>
  );

  function visiveisNoGrupo(id: string | null) {
    return groups.filter((g) => !id || g.id === id).reduce((s, g) => s + g.areas.filter((slug) => decide || posso(slug)).length, 0);
  }
}

/** A barrinha de progresso das aulas: escritas sobre o total do roteiro. */
function Progresso({ prontas, total }: { prontas: number; total: number }) {
  const parte = total ? Math.round((prontas / total) * 100) : 0;
  return (
    <span className="flex items-center gap-2" title={`${prontas} de ${total} aulas escritas`}>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-rule">
        <span className="block h-full rounded-full bg-oxblood" style={{ width: `${parte}%` }} />
      </span>
      <span className="tabular font-mono text-[0.68rem] text-ink-soft">
        {prontas}/{total}
      </span>
    </span>
  );
}

function CartaoDaDisciplina({ slug, nome, etapas, trilhas, mudancas, convidado, abrir }: { slug: string; nome: string; etapas: Stage[]; trilhas: TrackOption[]; mudancas: Proposta[]; convidado: boolean; abrir: () => void }) {
  const prontas = trilhas.reduce((s, x) => s + (x.plan?.filter((p) => p.ready).length ?? 0), 0);
  const total = trilhas.reduce((s, x) => s + (x.plan?.length ?? 0), 0);
  const saindo = mudancas.find((p) => p.tipo === "remover_disciplina");
  const nomeNovo = mudancas.find((p) => p.tipo === "editar_disciplina")?.dados.nomes as Record<string, string> | undefined;
  return (
    <li>
      <button type="button" onClick={abrir} className={`pn-cartao pn-cartao-interativo group flex h-full w-full cursor-pointer flex-col gap-2 text-left ${saindo ? "opacity-60" : ""}`}>
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0">
            <span className={`block font-serif text-xl font-semibold leading-tight ${saindo ? "line-through" : ""}`}>{nomeNovo?.pt && nomeNovo.pt !== nome ? nomeNovo.pt : nome}</span>
            <span className="font-mono text-[0.68rem] text-ink-soft">{slug}</span>
          </span>
          <ChevronRight aria-hidden width={16} height={16} className="mt-1 flex-none text-ink-soft" />
        </span>
        <span className="flex flex-wrap gap-1">
          {etapas.map((e) => (
            <Selo key={e}>{ETAPA_CURTA[e]}</Selo>
          ))}
          {convidado && <Selo tom="ouro">convite</Selo>}
        </span>
        <span className="mt-auto text-xs text-ink-soft">{trilhas.length} trilha(s)</span>
        <Progresso prontas={prontas} total={total} />
        {mudancas.length > 0 && <Selo tom="ouro">{saindo ? "sai do site na próxima publicação" : nomeNovo ? "nome novo a caminho do site" : "mudança a caminho"}</Selo>}
      </button>
    </li>
  );
}

function Detalhe({
  slug,
  decide,
  posso,
  nome,
  descricao,
  etapas,
  trilhas,
  novas,
  mudancasDaDisciplina,
  mudancasDaTrilha,
  convites,
  outras,
  nomeDaArea,
  voltar,
  editar,
  editarTrilha,
  propor,
  cancelar,
  ocupado,
}: {
  slug: string;
  decide: boolean;
  posso: boolean;
  nome: string;
  descricao: string;
  etapas: Stage[];
  trilhas: TrackOption[];
  novas: Proposta[];
  mudancasDaDisciplina: Proposta[];
  mudancasDaTrilha: (slug: string) => Proposta[];
  convites: Convite[];
  outras: readonly string[];
  nomeDaArea: (s: string) => string;
  voltar: () => void;
  editar: () => void;
  editarTrilha: (x: TrackOption | null) => void;
  propor: (tipo: TipoDeProposta, dados: Record<string, unknown>, feito: string) => Promise<unknown>;
  cancelar: (p: Proposta) => void;
  ocupado: boolean;
}) {
  const { t } = useI18n();
  const [remover, setRemover] = useState<"" | "perguntar">("");
  const [destino, setDestino] = useState("");
  const [modo, setModo] = useState<"mover" | "arquivar">("mover");
  const [mover, setMover] = useState<string | null>(null);
  const [destinoDaTrilha, setDestinoDaTrilha] = useState("");
  const [tirar, setTirar] = useState<string | null>(null);
  const saindo = mudancasDaDisciplina.find((p) => p.tipo === "remover_disciplina");
  const porEtapa = stages.map((e) => ({ etapa: e, lista: trilhas.filter((x) => (x.stage ?? "medio") === e) })).filter((g) => g.lista.length > 0 || novas.some((p) => p.dados.etapa === g.etapa));

  /** Sobe ou desce uma trilha dentro da etapa: as que mudam de lugar ganham a ordem nova (1, 2, 3...). */
  async function reordenar(lista: TrackOption[], indice: number, passo: -1 | 1) {
    const nova = [...lista];
    const [x] = nova.splice(indice, 1);
    nova.splice(indice + passo, 0, x);
    for (const [i, item] of nova.entries()) if (lista[i]?.slug !== item.slug) await propor("editar_trilha", { slug: item.slug, disciplina: item.area, ordem: i + 1, etapa: item.stage ?? "medio" }, "Ordem atualizada.");
  }

  return (
    <article className="space-y-6">
      <Botao pequeno variante="discreto" simbolo={ChevronLeft} onClick={voltar}>
        Todas as disciplinas
      </Botao>
      <div className="space-y-3 border-b border-rule pb-4">
        <CabecalhoDeSecao
          titulo={<span className={saindo ? "line-through opacity-60" : ""}>{nome}</span>}
          sobre={
            <>
              {descricao || "Sem descrição."}
              <span className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono text-ink-soft">{slug}</span>
                {etapas.map((e) => (
                  <Selo key={e}>{t.stages[e]}</Selo>
                ))}
              </span>
            </>
          }
          acoes={
            <>
              {posso && (
                <Botao simbolo={Pencil} onClick={editar}>
                  Editar nome e descrição
                </Botao>
              )}
              {posso && (
                <Botao variante="principal" simbolo={Plus} aria-label="Nova trilha" onClick={() => editarTrilha(null)}>
                  Trilha
                </Botao>
              )}
              {decide && !saindo && (
                <Botao variante="discreto" perigo simbolo={Trash2} onClick={() => setRemover("perguntar")}>
                  Remover disciplina
                </Botao>
              )}
            </>
          }
        />
        {mudancasDaDisciplina.map((p) => (
          <Faixa
            key={p.id}
            tom="aviso"
            semSimbolo
            acao={
              <Botao pequeno variante="discreto" simbolo={Undo2} onClick={() => cancelar(p)}>
                Desfazer
              </Botao>
            }
          >
            {TIPOS[p.tipo]} · {p.status === "pendente" ? "esperando decisão" : "vai ao ar na próxima publicação"}
          </Faixa>
        ))}
        {remover === "perguntar" && (
          <Cartao as="div" variante="alerta" className="max-w-2xl text-sm">
            <p className="font-semibold">Remover {nome} do site?</p>
            {trilhas.length === 0 ? (
              <p className="mt-1 text-ink-soft">A disciplina não tem trilhas: sai inteira na próxima publicação.</p>
            ) : (
              <fieldset className="mt-2 space-y-2">
                <legend className="text-ink-soft">Ela tem {trilhas.length} trilha(s). O que fazer com elas?</legend>
                <label className="flex items-center gap-2"><input type="radio" checked={modo === "mover"} onChange={() => setModo("mover")} /> Levar para outra disciplina:
                  <select value={destino} onChange={(e) => setDestino(e.target.value)} className="pn-campo w-auto" disabled={modo !== "mover"}>
                    <option value="">escolha…</option>
                    {outras.map((s) => <option key={s} value={s}>{nomeDaArea(s)}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-2"><input type="radio" checked={modo === "arquivar"} onChange={() => setModo("arquivar")} /> Arquivar (saem do site; as aulas ficam guardadas em content/arquivo)</label>
              </fieldset>
            )}
            <p className="mt-3 flex gap-2">
              <Botao
                perigo
                simbolo={Trash2}
                disabled={ocupado || (trilhas.length > 0 && modo === "mover" && !destino)}
                onClick={async () => {
                  await propor("remover_disciplina", trilhas.length === 0 ? { slug } : modo === "mover" ? { slug, destino } : { slug, arquivar: true }, "Remoção marcada.");
                  setRemover("");
                }}
              >
                Remover
              </Botao>
              <Botao variante="discreto" onClick={() => setRemover("")}>
                Cancelar
              </Botao>
            </p>
          </Cartao>
        )}
      </div>

      {porEtapa.length === 0 && <Vazio titulo="Nenhuma trilha ainda." texto={posso ? "Comece pela primeira: o roteiro pode ser só a lista de aulas que vão existir." : undefined} />}
      {porEtapa.map(({ etapa, lista }) => (
        <section key={etapa} className="pn-secao">
          <CabecalhoDeSecao titulo={t.stages[etapa]} />
          <ol aria-label={t.stages[etapa]} className="pn-lista">
            {lista.map((x, i) => {
              const ms = mudancasDaTrilha(x.slug);
              const tirando = ms.find((p) => p.tipo === "remover_trilha" || p.tipo === "arquivar_trilha");
              const editada = ms.find((p) => p.tipo === "editar_trilha");
              const prontas = x.plan?.filter((p) => p.ready).length ?? 0;
              return (
                <li key={x.slug} className={`grid gap-3 border-b border-rule p-3 last:border-b-0 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-center ${tirando ? "opacity-60" : ""}`}>
                  <span className="font-mono text-sm text-ink-soft">{String(i + 1).padStart(2, "0")}</span>
                  <span className="min-w-0">
                    <span className={`block font-semibold ${tirando ? "line-through" : ""}`}>{editada?.dados.titulo ? String(editada.dados.titulo) : x.title}</span>
                    {(editada?.dados.resumo || x.summary) && <span className="block truncate text-sm text-ink-soft">{editada?.dados.resumo ? String(editada.dados.resumo) : x.summary}</span>}
                    <span className="mt-1.5 block max-w-sm"><Progresso prontas={prontas} total={x.plan?.length ?? 0} /></span>
                    {ms.map((p) => (
                      <span key={p.id} className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <Selo tom="ouro">
                          {TIPOS[p.tipo]} · {p.status === "pendente" ? "esperando decisão" : "a caminho do site"}
                        </Selo>
                        <Botao pequeno variante="discreto" onClick={() => cancelar(p)}>
                          desfazer
                        </Botao>
                      </span>
                    ))}
                  </span>
                  <span className="flex flex-wrap items-center gap-1 text-sm">
                    {posso && <Botao pequeno icone variante="discreto" simbolo={ArrowUp} aria-label="Subir" dica="Subir" disabled={i === 0 || ocupado} onClick={() => void reordenar(lista, i, -1)} />}
                    {posso && <Botao pequeno icone variante="discreto" simbolo={ArrowDown} aria-label="Descer" dica="Descer" disabled={i === lista.length - 1 || ocupado} onClick={() => void reordenar(lista, i, 1)} />}
                    {posso && (
                      <Botao pequeno variante="discreto" simbolo={Pencil} onClick={() => editarTrilha(x)}>
                        editar
                      </Botao>
                    )}
                    {decide && (
                      <Botao
                        pequeno
                        variante="discreto"
                        simbolo={FolderInput}
                        aria-expanded={mover === x.slug}
                        onClick={() => {
                          setMover(mover === x.slug ? null : x.slug);
                          setDestinoDaTrilha("");
                        }}
                      >
                        mover
                      </Botao>
                    )}
                    {decide && !tirando && (
                      <Botao pequeno variante="discreto" perigo simbolo={Trash2} aria-expanded={tirar === x.slug} onClick={() => setTirar(tirar === x.slug ? null : x.slug)}>
                        {prontas ? "arquivar" : "remover"}
                      </Botao>
                    )}
                    <a className="pn-botao pn-botao-pequeno pn-botao-discreto" href={`/pt/trilhas/${x.slug}`} target="_blank" rel="noopener noreferrer">
                      ver
                      <ArrowUpRight aria-hidden />
                    </a>
                  </span>
                  {mover === x.slug && (
                    <span className="flex flex-wrap items-center gap-2 text-sm sm:col-span-3">
                      Levar para
                      <select value={destinoDaTrilha} onChange={(e) => setDestinoDaTrilha(e.target.value)} aria-label="Levar para" className="pn-campo w-auto">
                        <option value="">escolha a disciplina…</option>
                        {outras.map((s) => (
                          <option key={s} value={s}>
                            {nomeDaArea(s)}
                          </option>
                        ))}
                      </select>
                      <Botao
                        pequeno
                        disabled={!destinoDaTrilha || ocupado}
                        onClick={async () => {
                          await propor("editar_trilha", { slug: x.slug, disciplina: destinoDaTrilha, etapa: x.stage ?? "medio" }, "Trilha movida.");
                          setMover(null);
                        }}
                      >
                        Mover
                      </Botao>
                    </span>
                  )}
                  {tirar === x.slug && (
                    <span className="sm:col-span-3">
                      <Faixa
                        tom="erro"
                        acao={
                          <>
                            <Botao
                              pequeno
                              perigo
                              disabled={ocupado}
                              onClick={async () => {
                                await propor(prontas ? "arquivar_trilha" : "remover_trilha", { slug: x.slug, disciplina: x.area }, prontas ? "Trilha arquivada." : "Trilha removida.");
                                setTirar(null);
                              }}
                            >
                              {prontas ? "Arquivar" : "Remover"}
                            </Botao>
                            <Botao pequeno variante="discreto" onClick={() => setTirar(null)}>
                              cancelar
                            </Botao>
                          </>
                        }
                      >
                        {prontas ? `Arquivar “${x.title}”? Sai do site; as ${prontas} aula(s) escritas ficam guardadas em content/arquivo.` : `Remover “${x.title}”? Ela ainda não tem aulas escritas.`}
                      </Faixa>
                    </span>
                  )}
                </li>
              );
            })}
            {novas.filter((p) => (p.dados.etapa ?? "medio") === etapa).map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-rule p-3 text-sm last:border-b-0" style={{ boxShadow: "inset 3px 0 0 var(--pn-ouro)" }}>
                <span className="flex flex-wrap items-center gap-2">
                  <strong>{String(p.dados.titulo)}</strong>
                  <Selo tom="ouro">nova · {p.status === "pendente" ? "esperando decisão" : "a caminho do site"}</Selo>
                </span>
                <Botao pequeno variante="discreto" simbolo={Undo2} onClick={() => cancelar(p)}>
                  desfazer
                </Botao>
              </li>
            ))}
          </ol>
        </section>
      ))}

      {convites.length > 0 && (
        <section>
          <h3 className="pn-rotulo-mono">Quem ajuda por convite</h3>
          <ul className="mt-2 flex flex-wrap gap-2 text-sm">
            {convites.map((c) => (
              <li key={c.id}>
                <Selo>
                  {c.meu ? "Você" : c.convidado}
                  {c.trilha ? ` · ${c.trilha}` : ""}
                </Selo>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

/** A gaveta das mudanças: o que espera decisão, o que está a caminho, o que falhou e o que já foi (ou se perdeu). */
function Mudancas({ lista, decide, naoChegou, nomeDaArea, fechar, acao }: { lista: Proposta[]; decide: boolean; naoChegou: (p: Proposta) => boolean; nomeDaArea: (s: string) => string; fechar: () => void; acao: ReturnType<typeof useAcao> }) {
  const [recusando, setRecusando] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  const grupos: { titulo: string; itens: Proposta[] }[] = [
    { titulo: "Esperando decisão", itens: lista.filter((p) => p.status === "pendente") },
    { titulo: "A caminho do site", itens: lista.filter((p) => p.status === "aprovada") },
    { titulo: "Não deram certo", itens: lista.filter((p) => p.status === "falhou" || naoChegou(p)) },
    { titulo: "Já no site", itens: lista.filter((p) => p.status === "aplicada" && !naoChegou(p)).slice(0, 15) },
    { titulo: "Recusadas e canceladas", itens: lista.filter((p) => p.status === "recusada" || p.status === "cancelada").slice(0, 10) },
  ];
  const titulo = (p: Proposta) => String((p.dados.nomes as Record<string, string> | undefined)?.pt ?? p.dados.titulo ?? (p.tipo.includes("disciplina") ? nomeDaArea(String(p.dados.slug)) : p.dados.slug));
  // No body: a área de conteúdo do painel tem transform (da animação de entrada), que prenderia o "fixed" dentro dela.
  return (
    <Gaveta titulo="Mudanças no currículo" fechar={fechar}>
      <p className="pn-ajuda text-sm">A rotina de publicação escreve as mudanças nos arquivos do site (uma vez por dia, ou na hora pelo botão Publicar agora; o GitHub às vezes atrasa) e o build confere tudo antes de ir ao ar.</p>
      {grupos.map((g) =>
        g.itens.length === 0 ? null : (
          <section key={g.titulo}>
            <h3 className="pn-rotulo-mono">
              {g.titulo} · {g.itens.length}
            </h3>
            <ul className="mt-2 space-y-2">
              {g.itens.map((p) => (
                <li key={p.id} className="pn-cartao text-sm">
                  <p className="pn-rotulo-mono">
                    {TIPOS[p.tipo]} · {p.autor}
                    {p.minha ? " (você)" : ""} · {dataHora(p.criado_em)}
                  </p>
                  <p className="mt-0.5 font-semibold">
                    {titulo(p)} <span className="font-mono text-xs font-normal text-ink-soft">{String(p.dados.slug)}</span>
                  </p>
                  {p.status === "falhou" && <p className="pn-erro mt-1">{p.nota}</p>}
                  {naoChegou(p) && <p className="pn-erro mt-1">Marcada como publicada, mas não chegou ao site.</p>}
                  {p.status === "recusada" && p.nota && <p className="mt-1 text-ink-soft">Motivo: {p.nota}</p>}
                  <p className="mt-2 flex flex-wrap gap-2">
                    {decide && p.status === "pendente" && (
                      <Botao pequeno variante="principal" simbolo={Check} disabled={acao.ocupado} onClick={() => void acao.agir("curriculo_decidir", { p_id: p.id, p_aprovar: true }, "Aprovada: vai ao ar na próxima publicação.")}>
                        Aprovar
                      </Botao>
                    )}
                    {decide && p.status === "pendente" && (
                      <Botao
                        pequeno
                        simbolo={X}
                        aria-expanded={recusando === p.id}
                        onClick={() => {
                          setRecusando(p.id);
                          setNota("");
                        }}
                      >
                        Recusar
                      </Botao>
                    )}
                    {decide && (p.status === "falhou" || naoChegou(p)) && (
                      <Botao pequeno disabled={acao.ocupado} onClick={() => void acao.agir("curriculo_reaplicar", { p_id: p.id }, "Mandada de novo para a publicação.")}>
                        Tentar de novo
                      </Botao>
                    )}
                    {(p.status === "pendente" || p.status === "aprovada" || p.status === "falhou") && (decide || p.minha) && (
                      <Botao pequeno variante="discreto" disabled={acao.ocupado} onClick={() => void acao.agir("curriculo_cancelar", { p_id: p.id }, "Cancelada.")}>
                        Cancelar
                      </Botao>
                    )}
                  </p>
                  {recusando === p.id && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={500} placeholder="Motivo (vai para quem propôs)" aria-label="Motivo (vai para quem propôs)" className="pn-campo min-w-48 flex-1" />
                      <Botao
                        pequeno
                        perigo
                        disabled={acao.ocupado}
                        onClick={async () => {
                          if (await acao.agir("curriculo_decidir", { p_id: p.id, p_aprovar: false, p_nota: nota }, "Recusada.")) setRecusando(null);
                        }}
                      >
                        Recusar
                      </Botao>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ),
      )}
      {lista.length === 0 && <Vazio titulo="Nenhuma mudança ainda." />}
    </Gaveta>
  );
}

/**
 * Uma gaveta lateral (o formulário de trilha ou de disciplina, ou as mudanças). No body: a área de conteúdo do painel tem
 * transform (da animação de entrada), que prenderia o "fixed" dentro dela. Esc fecha; o foco entra na gaveta ao abrir,
 * fica preso nela (Tab e Shift+Tab dão a volta) e volta para onde estava ao fechar.
 */
function Gaveta({ titulo, fechar, children, rodape }: { titulo: string; fechar: () => void; children: ReactNode; rodape?: ReactNode }) {
  const caixa = useRef<HTMLElement>(null);
  const fecharAgora = useRef(fechar);
  useEffect(() => {
    fecharAgora.current = fechar;
  });
  useEffect(() => {
    const antes = document.activeElement as HTMLElement | null;
    caixa.current?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        fecharAgora.current();
        return;
      }
      if (e.key !== "Tab" || !caixa.current) return;
      const focaveis = [...caixa.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      if (focaveis.length === 0) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      if (e.shiftKey && (document.activeElement === primeiro || document.activeElement === caixa.current)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    };
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("keydown", tecla);
      antes?.focus?.();
    };
  }, []);
  return createPortal(
    <div className="pn-portal fixed inset-0 z-[90] flex justify-end" style={{ background: "var(--pn-veu)" }} onPointerDown={(e) => e.target === e.currentTarget && fechar()}>
      <aside ref={caixa} tabIndex={-1} role="dialog" aria-modal="true" aria-label={titulo} className="flex h-full w-full max-w-2xl flex-col border-l border-rule bg-parchment outline-none" style={{ boxShadow: "var(--pn-sombra-flutuante)" }}>
        <div className="flex items-center justify-between border-b border-rule px-5 py-4">
          <h2 className="pn-secao-titulo">{titulo}</h2>
          <Botao icone variante="discreto" simbolo={X} onClick={fechar} aria-label="Fechar" />
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">{children}</div>
        {rodape && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-rule px-5 py-3">{rodape}</div>}
      </aside>
    </div>,
    document.body,
  );
}

function EditorDeTrilha({ inicial, decide, disciplinas, nomeDaArea, fechar, salvar, ocupado }: { inicial: EdicaoDeTrilha; decide: boolean; disciplinas: string[]; nomeDaArea: (s: string) => string; fechar: () => void; salvar: (e: EdicaoDeTrilha) => void; ocupado: boolean }) {
  const { t } = useI18n();
  const [e, setE] = useState(inicial);
  const mudar = (parcial: Partial<EdicaoDeTrilha>) => setE((x) => ({ ...x, ...parcial }));
  const aulas = e.aulas;
  const moverAula = (i: number, passo: -1 | 1) => {
    const nova = [...aulas];
    const [a] = nova.splice(i, 1);
    nova.splice(i + passo, 0, a);
    mudar({ aulas: nova });
  };
  const valida = /^[a-z0-9][a-z0-9-]{1,59}$/.test(e.slug) && e.titulo.trim().length >= 3;
  const prontas = aulas.filter((a) => a.pronta).length;
  return (
    <Gaveta
      titulo={e.nova ? "Nova trilha" : "Editar trilha"}
      fechar={fechar}
      rodape={
        <>
          <span className="mr-auto text-xs text-ink-soft">{decide ? "Vai ao ar na próxima publicação." : "Vira uma sugestão para a coordenação."}</span>
          <Botao variante="discreto" onClick={fechar}>
            Cancelar
          </Botao>
          <Botao variante="principal" disabled={ocupado || !valida} carregando={ocupado} onClick={() => salvar(e)}>
            {decide ? (e.nova ? "Criar trilha" : "Salvar") : "Enviar sugestão"}
          </Botao>
        </>
      }
    >
      <Campo rotulo="Título" value={e.titulo} onChange={(ev) => mudar({ titulo: ev.target.value, slug: e.nova ? slugDe(ev.target.value) : e.slug })} maxLength={120} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Selecao rotulo="Disciplina" value={e.disciplina} onChange={(ev) => mudar({ disciplina: ev.target.value })}>
          {disciplinas.map((s) => (
            <option key={s} value={s}>
              {nomeDaArea(s)}
            </option>
          ))}
        </Selecao>
        <Selecao rotulo="Etapa" value={e.etapa} onChange={(ev) => mudar({ etapa: ev.target.value as Stage })}>
          {stages.map((s) => (
            <option key={s} value={s}>
              {t.stages[s]}
            </option>
          ))}
        </Selecao>
      </div>
      <Campo rotulo="Resumo (uma frase)" value={e.resumo} onChange={(ev) => mudar({ resumo: ev.target.value })} maxLength={220} />
      <Campo rotulo="Identificador no endereço (/trilhas/…)" value={e.slug} disabled={!e.nova} onChange={(ev) => mudar({ slug: ev.target.value.toLowerCase() })} maxLength={60} className="font-mono" />
      <section>
        <p className="flex items-baseline justify-between gap-2">
          <span className="pn-rotulo-mono">Roteiro · {aulas.length} aula(s)</span>
          <span className="text-xs text-ink-soft">{prontas} escrita(s): não saem nem mudam de nome</span>
        </p>
        <ol aria-label="Roteiro" className="pn-lista mt-2">
          {aulas.map((a, i) => (
            <li key={a.chave} className="pn-item gap-2" style={{ paddingInline: "0.5rem" }}>
              <span className="tabular w-6 text-right font-mono text-xs text-ink-soft">{i + 1}</span>
              {a.pronta ? (
                <span className="flex flex-1 items-center gap-2 py-1">
                  <Check aria-hidden width={14} height={14} className="text-ok" />
                  <span className="sr-only">Escrita: </span>
                  {a.titulo}
                </span>
              ) : (
                <input value={a.titulo} onChange={(ev) => mudar({ aulas: aulas.map((x) => (x.chave === a.chave ? { ...x, titulo: ev.target.value } : x)) })} placeholder="Título da aula" aria-label={`Título da aula ${i + 1}`} maxLength={120} className="pn-campo flex-1" />
              )}
              <Botao pequeno icone variante="discreto" simbolo={ArrowUp} aria-label="Subir" disabled={i === 0} onClick={() => moverAula(i, -1)} />
              <Botao pequeno icone variante="discreto" simbolo={ArrowDown} aria-label="Descer" disabled={i === aulas.length - 1} onClick={() => moverAula(i, 1)} />
              {!a.pronta && <Botao pequeno icone variante="discreto" perigo simbolo={X} aria-label="Tirar do roteiro" onClick={() => mudar({ aulas: aulas.filter((x) => x.chave !== a.chave) })} />}
            </li>
          ))}
        </ol>
        <Botao className="mt-2" pequeno variante="discreto" simbolo={Plus} onClick={() => mudar({ aulas: [...aulas, { chave: chave(), titulo: "", pronta: false }] })}>
          Aula no roteiro
        </Botao>
      </section>
      {e.nova && <Area rotulo="Apresentação da trilha (opcional, Markdown)" value={e.intro} onChange={(ev) => mudar({ intro: ev.target.value })} rows={4} maxLength={4000} />}
    </Gaveta>
  );
}

function EditorDeDisciplina({ inicial, decide, grupos, etapasNomes, fechar, salvar, ocupado }: { inicial: EdicaoDeDisciplina; decide: boolean; grupos: { id: string; nome: string }[]; etapasNomes: Record<Stage, string>; fechar: () => void; salvar: (e: EdicaoDeDisciplina) => void; ocupado: boolean }) {
  const [e, setE] = useState(inicial);
  const [idiomas, setIdiomas] = useState(false);
  const mudar = (parcial: Partial<EdicaoDeDisciplina>) => setE((x) => ({ ...x, ...parcial }));
  const valida = /^[a-z0-9][a-z0-9-]{1,59}$/.test(e.slug) && (e.nomes.pt ?? "").trim().length >= 2 && (!e.nova || e.etapas.length > 0);
  return (
    <Gaveta
      titulo={e.nova ? (decide ? "Nova disciplina" : "Sugerir disciplina") : "Editar disciplina"}
      fechar={fechar}
      rodape={
        <>
          <span className="mr-auto text-xs text-ink-soft">{decide ? "Vai ao ar na próxima publicação." : "Vira uma sugestão para a coordenação."}</span>
          <Botao variante="discreto" onClick={fechar}>
            Cancelar
          </Botao>
          <Botao variante="principal" disabled={ocupado || !valida} carregando={ocupado} onClick={() => salvar(e)}>
            {decide ? "Salvar" : "Enviar sugestão"}
          </Botao>
        </>
      }
    >
      <Campo rotulo="Nome" value={e.nomes.pt ?? ""} onChange={(ev) => mudar({ nomes: { ...e.nomes, pt: ev.target.value }, slug: e.nova ? slugDe(ev.target.value) : e.slug })} maxLength={60} />
      <Campo rotulo="Descrição em uma frase" value={e.descricoes.pt ?? ""} onChange={(ev) => mudar({ descricoes: { ...e.descricoes, pt: ev.target.value } })} maxLength={300} />
      {e.nova && (
        <>
          <Campo rotulo="Identificador no endereço" value={e.slug} onChange={(ev) => mudar({ slug: ev.target.value.toLowerCase() })} maxLength={60} className="font-mono" />
          <Selecao rotulo="Grupo" value={e.grupo} onChange={(ev) => mudar({ grupo: ev.target.value })}>
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome}
              </option>
            ))}
          </Selecao>
          <fieldset>
            <legend className="pn-rotulo">Etapas</legend>
            <div className="mt-1 flex flex-wrap gap-4">
              {stages.map((s) => (
                <Marca key={s} rotulo={etapasNomes[s]} checked={e.etapas.includes(s)} onChange={(ev) => mudar({ etapas: ev.target.checked ? [...e.etapas, s] : e.etapas.filter((x) => x !== s) })} />
              ))}
            </div>
          </fieldset>
        </>
      )}
      <Botao pequeno variante="discreto" aria-expanded={idiomas} onClick={() => setIdiomas(!idiomas)}>
        {idiomas ? "Esconder" : "Nome e descrição nos outros idiomas"}
      </Botao>
      {idiomas &&
        IDIOMAS.filter(([k]) => k !== "pt").map(([k, nome]) => (
          <div key={k} className="grid gap-2 sm:grid-cols-[6rem_1fr]">
            <span className="pt-2 text-xs text-ink-soft">{nome}</span>
            <span className="space-y-1">
              <input value={e.nomes[k] ?? ""} onChange={(ev) => mudar({ nomes: { ...e.nomes, [k]: ev.target.value } })} placeholder="Nome" aria-label={`Nome · ${nome}`} maxLength={60} className="pn-campo" />
              <input value={e.descricoes[k] ?? ""} onChange={(ev) => mudar({ descricoes: { ...e.descricoes, [k]: ev.target.value } })} placeholder="Descrição" aria-label={`Descrição · ${nome}`} maxLength={300} className="pn-campo" />
            </span>
          </div>
        ))}
      <p className="text-xs text-ink-soft">Sem tradução, os outros idiomas mostram o português até alguém traduzir.</p>
    </Gaveta>
  );
}

function Convites({ decide, minhas, convites, membros, tracks, nomeDaArea, acao }: { decide: boolean; minhas: string[]; convites: Convite[]; membros: Membro[]; tracks: TrackOption[]; nomeDaArea: (s: string) => string; acao: ReturnType<typeof useAcao> }) {
  const [convite, setConvite] = useState({ disciplina: "", trilha: "", pessoa: "", nota: "" });
  const convidaEm = useMemo(() => (decide ? [...areaSlugs] : minhas), [decide, minhas]);
  return (
    <div className="space-y-6">
      <p className="pn-sobre">Cada educador cuida da própria disciplina. Para alguém de outra disciplina ajudar numa aula ou numa trilha da sua, convide aqui: a pessoa passa a ver a sua disciplina em Escrever e aqui, até o convite acabar.</p>
      {convidaEm.length > 0 && (
        <Cartao titulo="Convidar para ajudar" className="max-w-3xl">
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Selecao rotulo="Disciplina" value={convite.disciplina} onChange={(e) => setConvite({ ...convite, disciplina: e.target.value, trilha: "" })}>
              <option value="">Escolha…</option>
              {convidaEm.map((s) => (
                <option key={s} value={s}>
                  {nomeDaArea(s)}
                </option>
              ))}
            </Selecao>
            <Selecao rotulo="Trilha (vazio: a disciplina toda)" value={convite.trilha} onChange={(e) => setConvite({ ...convite, trilha: e.target.value })}>
              <option value="">A disciplina toda</option>
              {tracks
                .filter((x) => x.area === convite.disciplina)
                .map((x) => (
                  <option key={x.slug} value={x.slug}>
                    {x.title}
                  </option>
                ))}
            </Selecao>
            <div className="sm:col-span-2">
              <Selecao rotulo="Quem" value={convite.pessoa} onChange={(e) => setConvite({ ...convite, pessoa: e.target.value })}>
                <option value="">Escolha a pessoa…</option>
                {membros
                  .filter((m) => !m.eu && !m.papeis.some((p) => (p.papel === "educacao" || p.papel === "educacao_secundaria") && p.disciplina === convite.disciplina))
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome}
                    </option>
                  ))}
              </Selecao>
            </div>
            <div className="sm:col-span-2">
              <Campo rotulo="Para quê (aparece para a pessoa)" value={convite.nota} onChange={(e) => setConvite({ ...convite, nota: e.target.value })} maxLength={500} placeholder="Ex.: a aula de estatística das revoltas" />
            </div>
          </div>
          <Botao
            className="mt-3"
            variante="principal"
            simbolo={UserPlus}
            disabled={acao.ocupado || !convite.disciplina || !convite.pessoa}
            onClick={async () => {
              if (await acao.agir("disciplina_convidar", { p_usuario: convite.pessoa, p_disciplina: convite.disciplina, p_trilha: convite.trilha || null, p_nota: convite.nota }, "Convite enviado: a pessoa foi avisada.")) setConvite({ disciplina: "", trilha: "", pessoa: "", nota: "" });
            }}
          >
            Convidar
          </Botao>
        </Cartao>
      )}
      {convites.length === 0 ? (
        <Vazio simbolo={UserPlus} titulo="Nenhum convite ativo." />
      ) : (
        <ul aria-label="Convites para ajudar" className="pn-lista max-w-3xl">
          {convites.map((c) => (
            <li key={c.id} className="pn-item flex-wrap justify-between" style={{ alignItems: "flex-start", paddingBlock: "0.6rem" }}>
              <span className="min-w-0 flex-1">
                <strong>{c.meu ? "Você" : c.convidado}</strong> ajuda em <strong>{nomeDaArea(c.disciplina)}</strong>
                {c.trilha ? ` (trilha ${tracks.find((x) => x.slug === c.trilha)?.title ?? c.trilha})` : ""}
                <span className="block text-xs text-ink-soft">
                  convite de {c.por || "?"} · {dataHora(c.criado_em)}
                  {c.nota ? ` · ${c.nota}` : ""}
                </span>
              </span>
              {c.posso_revogar && (
                <Botao pequeno variante="discreto" perigo onClick={() => void acao.agir("disciplina_convite_revogar", { p_id: c.id }, "Convite encerrado.")}>
                  {c.meu ? "Sair" : "Encerrar"}
                </Botao>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
