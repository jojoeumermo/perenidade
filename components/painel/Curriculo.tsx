// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { areaSlugs, groups, stageAreas, stages, type Stage } from "@/lib/areas";
import { can, disciplinasQueEnsina, escreveEm, getClient, type Me } from "@/lib/backend";
import { useI18n } from "../I18n";
import { type TrackOption, useTrackOptions } from "../useTrackOptions";
import { Aviso, botao, botaoClaro, campo, dataHora, elo, rotulo, useAcao, useLista } from "./comum";
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
      <header className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-4">
        <div className="min-w-0">
          <p className={rotulo}>{decide ? "Currículo do site" : "As disciplinas que você ensina"}</p>
          <p className="mt-1 text-sm text-ink-soft">
            {decide ? `${areaSlugs.length} disciplinas` : `${minhas.length} disciplina(s) sua(s)`} · {totalDeTrilhas} trilhas · {aulasProntas.toLocaleString("pt-BR")} aulas escritas de {aulasNoRoteiro.toLocaleString("pt-BR")} no roteiro
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input value={busca} onChange={(e) => setBusca(e.target.value)} type="search" placeholder="Procurar disciplina ou trilha" aria-label="Procurar disciplina ou trilha" className={`${campo} mt-0 w-60 py-1.5`} />
          <button type="button" className={`${botaoClaro} relative py-1.5`} aria-expanded={mudancas} onClick={() => setMudancas(!mudancas)}>
            Mudanças
            {pendentes + falhas + perdidas.length > 0 && <span className="ml-2 bg-[#c21f16] px-1.5 py-0.5 font-mono text-[0.7rem] text-white">{pendentes + falhas + perdidas.length}</span>}
            {aCaminho > 0 && <span className="ml-2 bg-gold px-1.5 py-0.5 font-mono text-[0.7rem] text-parchment" title="A caminho do site">{aCaminho}</span>}
          </button>
          {decide && publicarAgora && aCaminho > 0 && (
            <button type="button" className={`${botaoClaro} py-1.5`} onClick={() => void pedirPublicacao()} title="Roda a rotina de publicação agora, sem esperar a da hora">
              Publicar agora
            </button>
          )}
          <button type="button" className={`${botao} py-2`} onClick={() => setDisciplina({ nova: true, slug: "", grupo: grupo === "todos" ? "humanidades" : grupo, etapas: ["medio"], nomes: {}, descricoes: {} })}>
            {decide ? "+ Disciplina" : "Sugerir disciplina"}
          </button>
        </div>
      </header>
      <Aviso texto={propostas.erro || acao.aviso} />
      {perdidas.length > 0 && decide && (
        <div className="border-l-4 border-[#c21f16] bg-parchment-deep px-4 py-3 text-sm">
          <strong>{perdidas.length} mudança(s) marcada(s) como publicada(s) não chegaram ao site.</strong> A rotina de publicação não guardava as mudanças de disciplina (nome, descrição, criação e remoção); já está consertada.{" "}
          <button type="button" className={elo} disabled={acao.ocupado} onClick={() => void Promise.all(perdidas.map((p) => acao.agir("curriculo_reaplicar", { p_id: p.id }, "Mandadas de novo: vão ao ar na próxima publicação.")))}>
            Mandar todas de novo
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
        {/* Grupos (filtro) e convites. */}
        <nav aria-label="Grupos de disciplinas" className="space-y-1 text-sm lg:sticky lg:top-4 lg:self-start">
          {[{ id: "todos", nome: "Todas" }, ...groups.map((g) => ({ id: g.id as string, nome: t.groups[g.id as keyof typeof t.groups] ?? g.id }))].map((g) => {
            const quantas = g.id === "todos" ? visiveisNoGrupo(null) : visiveisNoGrupo(g.id);
            if (!decide && quantas === 0 && g.id !== "todos") return null;
            return (
              <button key={g.id} type="button" onClick={() => { setGrupo(g.id); setVista("mapa"); setAberta(null); }} aria-pressed={grupo === g.id && vista === "mapa"} className={`flex w-full cursor-pointer items-center justify-between gap-2 px-2.5 py-1.5 text-left ${grupo === g.id && vista === "mapa" ? "bg-ink text-parchment" : "hover:bg-parchment-deep"}`}>
                <span className="truncate">{g.nome}</span>
                <span className="font-mono text-xs opacity-70">{quantas}</span>
              </button>
            );
          })}
          <hr className="my-3 border-rule" />
          <button type="button" onClick={() => { setVista("convites"); setAberta(null); }} aria-pressed={vista === "convites"} className={`flex w-full cursor-pointer items-center justify-between px-2.5 py-1.5 text-left ${vista === "convites" ? "bg-ink text-parchment" : "hover:bg-parchment-deep"}`}>
            <span>Convites para ajudar</span>
            <span className="font-mono text-xs opacity-70">{(convites.dados ?? []).length}</span>
          </button>
        </nav>

        <main className="min-w-0">
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
                <li key={p.id} className="border-2 border-dashed border-gold bg-parchment-deep p-4">
                  <p className="font-mono text-[0.65rem] uppercase tracking-widest text-gold">{p.status === "pendente" ? "sugestão esperando decisão" : "nova · vai ao ar na próxima publicação"}</p>
                  <p className="mt-1 font-serif text-xl font-semibold">{String((p.dados.nomes as Record<string, string> | undefined)?.pt ?? p.dados.slug)}</p>
                  <p className="mt-2 text-xs"><button type="button" className={elo} onClick={() => void acao.agir("curriculo_cancelar", { p_id: p.id }, "Cancelada.")}>Desfazer</button></p>
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
              {visiveis.length === 0 && <li className="text-ink-soft">{termo ? "Nenhuma disciplina ou trilha com esse nome." : "Você ainda não ensina nenhuma disciplina: quem ensina pode convidar você para ajudar, ou peça à coordenação a função de educador."}</li>}
            </ul>
          )}
        </main>
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
      <span className="h-1.5 flex-1 bg-rule">
        <span className="block h-full bg-oxblood" style={{ width: `${parte}%` }} />
      </span>
      <span className="font-mono text-[0.68rem] text-ink-soft">{prontas}/{total}</span>
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
      <button type="button" onClick={abrir} className={`painel-quadro group flex h-full w-full cursor-pointer flex-col gap-2 border border-rule border-t-4 border-t-ink bg-parchment-deep p-4 text-left transition hover:border-t-oxblood ${saindo ? "opacity-60" : ""}`}>
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0">
            <span className={`block font-serif text-xl font-semibold leading-tight ${saindo ? "line-through" : ""}`}>{nomeNovo?.pt && nomeNovo.pt !== nome ? nomeNovo.pt : nome}</span>
            <span className="font-mono text-[0.68rem] text-ink-soft">{slug}</span>
          </span>
          <span className="painel-seta text-ink-soft" aria-hidden="true">→</span>
        </span>
        <span className="flex flex-wrap gap-1">
          {etapas.map((e) => (
            <span key={e} className="border border-rule px-1.5 py-0.5 font-mono text-[0.62rem] uppercase tracking-wider text-ink-soft">{ETAPA_CURTA[e]}</span>
          ))}
          {convidado && <span className="bg-gold px-1.5 py-0.5 font-mono text-[0.62rem] uppercase text-parchment">convite</span>}
        </span>
        <span className="mt-auto text-xs text-ink-soft">{trilhas.length} trilha(s)</span>
        <Progresso prontas={prontas} total={total} />
        {mudancas.length > 0 && <span className="text-xs text-gold">{saindo ? "sai do site na próxima publicação" : nomeNovo ? "nome novo a caminho do site" : "mudança a caminho"}</span>}
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
      <button type="button" className="cursor-pointer text-sm text-ink-soft hover:text-ink" onClick={voltar}>← Todas as disciplinas</button>
      <header className="border-b-2 border-ink pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className={`font-serif text-4xl font-semibold leading-tight ${saindo ? "line-through opacity-60" : ""}`}>{nome}</h2>
            <p className="mt-1 max-w-2xl text-ink-soft">{descricao || "Sem descrição."}</p>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-mono text-ink-soft">{slug}</span>
              {etapas.map((e) => <span key={e} className="border border-rule px-1.5 py-0.5 font-mono uppercase tracking-wider text-ink-soft">{t.stages[e]}</span>)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {posso && <button type="button" className={`${botaoClaro} py-1.5`} onClick={editar}>Editar nome e descrição</button>}
            {posso && <button type="button" className={`${botao} py-2`} onClick={() => editarTrilha(null)}>+ Trilha</button>}
            {decide && !saindo && <button type="button" className="cursor-pointer px-2 text-sm text-oxblood underline" onClick={() => setRemover("perguntar")}>Remover disciplina</button>}
          </div>
        </div>
        {mudancasDaDisciplina.map((p) => (
          <p key={p.id} className="mt-3 flex flex-wrap items-center gap-2 border-l-4 border-gold bg-parchment-deep px-3 py-2 text-sm">
            <span>{TIPOS[p.tipo]} · {p.status === "pendente" ? "esperando decisão" : "vai ao ar na próxima publicação"}</span>
            <button type="button" className={elo} onClick={() => cancelar(p)}>Desfazer</button>
          </p>
        ))}
        {remover === "perguntar" && (
          <div className="mt-4 max-w-2xl border-2 border-oxblood bg-parchment p-4 text-sm">
            <p className="font-semibold">Remover {nome} do site?</p>
            {trilhas.length === 0 ? (
              <p className="mt-1 text-ink-soft">A disciplina não tem trilhas: sai inteira na próxima publicação.</p>
            ) : (
              <fieldset className="mt-2 space-y-2">
                <legend className="text-ink-soft">Ela tem {trilhas.length} trilha(s). O que fazer com elas?</legend>
                <label className="flex items-center gap-2"><input type="radio" checked={modo === "mover"} onChange={() => setModo("mover")} /> Levar para outra disciplina:
                  <select value={destino} onChange={(e) => setDestino(e.target.value)} className="border border-ink bg-parchment-deep px-2 py-1" disabled={modo !== "mover"}>
                    <option value="">escolha…</option>
                    {outras.map((s) => <option key={s} value={s}>{nomeDaArea(s)}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-2"><input type="radio" checked={modo === "arquivar"} onChange={() => setModo("arquivar")} /> Arquivar (saem do site; as aulas ficam guardadas em content/arquivo)</label>
              </fieldset>
            )}
            <p className="mt-3 flex gap-2">
              <button type="button" className={botao} disabled={ocupado || (trilhas.length > 0 && modo === "mover" && !destino)} onClick={async () => { await propor("remover_disciplina", trilhas.length === 0 ? { slug } : modo === "mover" ? { slug, destino } : { slug, arquivar: true }, "Remoção marcada."); setRemover(""); }}>Remover</button>
              <button type="button" className={botaoClaro} onClick={() => setRemover("")}>Cancelar</button>
            </p>
          </div>
        )}
      </header>

      {porEtapa.length === 0 && <p className="text-ink-soft">Nenhuma trilha ainda.{posso ? " Comece pela primeira: o roteiro pode ser só a lista de aulas que vão existir." : ""}</p>}
      {porEtapa.map(({ etapa, lista }) => (
        <section key={etapa}>
          <h3 className="jornal-secao"><span className="jornal-editoria">{t.stages[etapa]}</span></h3>
          <ol className="mt-3 divide-y divide-rule border border-rule bg-parchment-deep">
            {lista.map((x, i) => {
              const ms = mudancasDaTrilha(x.slug);
              const tirando = ms.find((p) => p.tipo === "remover_trilha" || p.tipo === "arquivar_trilha");
              const editada = ms.find((p) => p.tipo === "editar_trilha");
              const prontas = x.plan?.filter((p) => p.ready).length ?? 0;
              return (
                <li key={x.slug} className={`grid gap-3 p-3 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-center ${tirando ? "opacity-60" : ""}`}>
                  <span className="font-mono text-sm text-ink-soft">{String(i + 1).padStart(2, "0")}</span>
                  <span className="min-w-0">
                    <span className={`block font-semibold ${tirando ? "line-through" : ""}`}>{editada?.dados.titulo ? String(editada.dados.titulo) : x.title}</span>
                    {(editada?.dados.resumo || x.summary) && <span className="block truncate text-sm text-ink-soft">{editada?.dados.resumo ? String(editada.dados.resumo) : x.summary}</span>}
                    <span className="mt-1.5 block max-w-sm"><Progresso prontas={prontas} total={x.plan?.length ?? 0} /></span>
                    {ms.map((p) => (
                      <span key={p.id} className="mt-1 flex flex-wrap gap-2 text-xs text-gold">
                        {TIPOS[p.tipo]} · {p.status === "pendente" ? "esperando decisão" : "a caminho do site"}
                        <button type="button" className={elo} onClick={() => cancelar(p)}>desfazer</button>
                      </span>
                    ))}
                  </span>
                  <span className="flex flex-wrap items-center gap-1 text-sm">
                    {posso && <button type="button" aria-label="Subir" disabled={i === 0 || ocupado} className="cursor-pointer px-1.5 text-ink-soft hover:text-ink disabled:opacity-30" onClick={() => void reordenar(lista, i, -1)}>▲</button>}
                    {posso && <button type="button" aria-label="Descer" disabled={i === lista.length - 1 || ocupado} className="cursor-pointer px-1.5 text-ink-soft hover:text-ink disabled:opacity-30" onClick={() => void reordenar(lista, i, 1)}>▼</button>}
                    {posso && <button type="button" className={elo} onClick={() => editarTrilha(x)}>editar</button>}
                    {decide && <button type="button" className={elo} onClick={() => { setMover(mover === x.slug ? null : x.slug); setDestinoDaTrilha(""); }}>mover</button>}
                    {decide && !tirando && <button type="button" className={`${elo} text-oxblood`} onClick={() => setTirar(tirar === x.slug ? null : x.slug)}>{prontas ? "arquivar" : "remover"}</button>}
                    <a className={elo} href={`/pt/trilhas/${x.slug}`} target="_blank" rel="noopener noreferrer">ver</a>
                  </span>
                  {mover === x.slug && (
                    <span className="flex flex-wrap items-center gap-2 text-sm sm:col-span-3">
                      Levar para
                      <select value={destinoDaTrilha} onChange={(e) => setDestinoDaTrilha(e.target.value)} className="border border-ink bg-parchment px-2 py-1">
                        <option value="">escolha a disciplina…</option>
                        {outras.map((s) => <option key={s} value={s}>{nomeDaArea(s)}</option>)}
                      </select>
                      <button type="button" className={botaoClaro} disabled={!destinoDaTrilha || ocupado} onClick={async () => { await propor("editar_trilha", { slug: x.slug, disciplina: destinoDaTrilha, etapa: x.stage ?? "medio" }, "Trilha movida."); setMover(null); }}>Mover</button>
                    </span>
                  )}
                  {tirar === x.slug && (
                    <span className="flex flex-wrap items-center gap-2 border-l-4 border-oxblood bg-parchment px-3 py-2 text-sm sm:col-span-3">
                      {prontas ? `Arquivar “${x.title}”? Sai do site; as ${prontas} aula(s) escritas ficam guardadas em content/arquivo.` : `Remover “${x.title}”? Ela ainda não tem aulas escritas.`}
                      <button type="button" className={botao} disabled={ocupado} onClick={async () => { await propor(prontas ? "arquivar_trilha" : "remover_trilha", { slug: x.slug, disciplina: x.area }, prontas ? "Trilha arquivada." : "Trilha removida."); setTirar(null); }}>{prontas ? "Arquivar" : "Remover"}</button>
                      <button type="button" className={elo} onClick={() => setTirar(null)}>cancelar</button>
                    </span>
                  )}
                </li>
              );
            })}
            {novas.filter((p) => (p.dados.etapa ?? "medio") === etapa).map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-l-4 border-gold p-3 text-sm">
                <span><strong>{String(p.dados.titulo)}</strong> <span className="text-gold">· nova · {p.status === "pendente" ? "esperando decisão" : "a caminho do site"}</span></span>
                <button type="button" className={elo} onClick={() => cancelar(p)}>desfazer</button>
              </li>
            ))}
          </ol>
        </section>
      ))}

      {convites.length > 0 && (
        <section>
          <h3 className={rotulo}>Quem ajuda por convite</h3>
          <ul className="mt-2 flex flex-wrap gap-2 text-sm">
            {convites.map((c) => <li key={c.id} className="border border-rule px-2 py-1">{c.meu ? "Você" : c.convidado}{c.trilha ? ` · ${c.trilha}` : ""}</li>)}
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
  return createPortal(
    <div className="fixed inset-0 z-[90] flex justify-end bg-[rgba(23,19,14,0.45)]" onPointerDown={(e) => e.target === e.currentTarget && fechar()}>
      <aside role="dialog" aria-label="Mudanças no currículo" className="flex h-full w-full max-w-lg flex-col border-l-4 border-ink bg-parchment shadow-2xl">
        <div className="flex items-center justify-between border-b-2 border-ink px-5 py-4">
          <h2 className="font-serif text-2xl font-semibold">Mudanças no currículo</h2>
          <button type="button" className="cursor-pointer px-2 text-2xl leading-none text-ink-soft hover:text-ink" onClick={fechar} aria-label="Fechar">×</button>
        </div>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-4">
          <p className="text-sm text-ink-soft">A rotina de publicação escreve as mudanças nos arquivos do site (de hora em hora; o GitHub às vezes atrasa) e o build confere tudo antes de ir ao ar.</p>
          {grupos.map((g) =>
            g.itens.length === 0 ? null : (
              <section key={g.titulo}>
                <h3 className={rotulo}>{g.titulo} · {g.itens.length}</h3>
                <ul className="mt-2 space-y-2">
                  {g.itens.map((p) => (
                    <li key={p.id} className="border border-rule bg-parchment-deep p-3 text-sm">
                      <p className="font-mono text-[0.65rem] uppercase tracking-widest text-ink-soft">{TIPOS[p.tipo]} · {p.autor}{p.minha ? " (você)" : ""} · {dataHora(p.criado_em)}</p>
                      <p className="mt-0.5 font-semibold">{titulo(p)} <span className="font-mono text-xs font-normal text-ink-soft">{String(p.dados.slug)}</span></p>
                      {p.status === "falhou" && <p className="mt-1 text-oxblood">{p.nota}</p>}
                      {naoChegou(p) && <p className="mt-1 text-oxblood">Marcada como publicada, mas não chegou ao site.</p>}
                      {p.status === "recusada" && p.nota && <p className="mt-1 text-ink-soft">Motivo: {p.nota}</p>}
                      <p className="mt-2 flex flex-wrap gap-3">
                        {decide && p.status === "pendente" && <button type="button" className={botao} disabled={acao.ocupado} onClick={() => void acao.agir("curriculo_decidir", { p_id: p.id, p_aprovar: true }, "Aprovada: vai ao ar na próxima publicação.")}>Aprovar</button>}
                        {decide && p.status === "pendente" && <button type="button" className={botaoClaro} onClick={() => { setRecusando(p.id); setNota(""); }}>Recusar</button>}
                        {decide && (p.status === "falhou" || naoChegou(p)) && <button type="button" className={botaoClaro} disabled={acao.ocupado} onClick={() => void acao.agir("curriculo_reaplicar", { p_id: p.id }, "Mandada de novo para a publicação.")}>Tentar de novo</button>}
                        {(p.status === "pendente" || p.status === "aprovada" || p.status === "falhou") && (decide || p.minha) && <button type="button" className={elo} disabled={acao.ocupado} onClick={() => void acao.agir("curriculo_cancelar", { p_id: p.id }, "Cancelada.")}>Cancelar</button>}
                      </p>
                      {recusando === p.id && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={500} placeholder="Motivo (vai para quem propôs)" className={`${campo} mt-0 flex-1 py-1.5`} />
                          <button type="button" className={botao} disabled={acao.ocupado} onClick={async () => { if (await acao.agir("curriculo_decidir", { p_id: p.id, p_aprovar: false, p_nota: nota }, "Recusada.")) setRecusando(null); }}>Recusar</button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ),
          )}
          {lista.length === 0 && <p className="text-ink-soft">Nenhuma mudança ainda.</p>}
        </div>
      </aside>
    </div>,
    document.body,
  );
}

/** Uma gaveta lateral com o formulário (trilha ou disciplina). */
function Gaveta({ titulo, fechar, children, rodape }: { titulo: string; fechar: () => void; children: ReactNode; rodape: ReactNode }) {
  return createPortal(
    <div className="fixed inset-0 z-[90] flex justify-end bg-[rgba(23,19,14,0.45)]" onPointerDown={(e) => e.target === e.currentTarget && fechar()}>
      <aside role="dialog" aria-label={titulo} className="flex h-full w-full max-w-2xl flex-col border-l-4 border-ink bg-parchment shadow-2xl">
        <div className="flex items-center justify-between border-b-2 border-ink px-5 py-4">
          <h2 className="font-serif text-2xl font-semibold">{titulo}</h2>
          <button type="button" className="cursor-pointer px-2 text-2xl leading-none text-ink-soft hover:text-ink" onClick={fechar} aria-label="Fechar">×</button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">{children}</div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t-2 border-ink px-5 py-3">{rodape}</div>
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
          <button type="button" className={botaoClaro} onClick={fechar}>Cancelar</button>
          <button type="button" className={botao} disabled={ocupado || !valida} onClick={() => salvar(e)}>{decide ? (e.nova ? "Criar trilha" : "Salvar") : "Enviar sugestão"}</button>
        </>
      }
    >
      <label className="block">Título<input value={e.titulo} onChange={(ev) => mudar({ titulo: ev.target.value, slug: e.nova ? slugDe(ev.target.value) : e.slug })} maxLength={120} className={campo} /></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">Disciplina<select value={e.disciplina} onChange={(ev) => mudar({ disciplina: ev.target.value })} className={campo}>{disciplinas.map((s) => <option key={s} value={s}>{nomeDaArea(s)}</option>)}</select></label>
        <label className="block">Etapa<select value={e.etapa} onChange={(ev) => mudar({ etapa: ev.target.value as Stage })} className={campo}>{stages.map((s) => <option key={s} value={s}>{t.stages[s]}</option>)}</select></label>
      </div>
      <label className="block">Resumo (uma frase)<input value={e.resumo} onChange={(ev) => mudar({ resumo: ev.target.value })} maxLength={220} className={campo} /></label>
      <label className="block text-sm text-ink-soft">Identificador no endereço (/trilhas/…)<input value={e.slug} disabled={!e.nova} onChange={(ev) => mudar({ slug: ev.target.value.toLowerCase() })} maxLength={60} className={`${campo} font-mono`} /></label>
      <section>
        <p className="flex items-baseline justify-between">
          <span className={rotulo}>Roteiro · {aulas.length} aula(s)</span>
          <span className="text-xs text-ink-soft">{prontas} escrita(s): não saem nem mudam de nome</span>
        </p>
        <ol className="mt-2 divide-y divide-rule border border-rule bg-parchment-deep">
          {aulas.map((a, i) => (
            <li key={a.chave} className="flex items-center gap-2 px-2 py-1.5">
              <span className="w-6 text-right font-mono text-xs text-ink-soft">{i + 1}</span>
              {a.pronta ? (
                <span className="flex-1 py-1"><span className="mr-2 text-[#2f5d34]" title="Escrita">✓</span>{a.titulo}</span>
              ) : (
                <input value={a.titulo} onChange={(ev) => mudar({ aulas: aulas.map((x) => (x.chave === a.chave ? { ...x, titulo: ev.target.value } : x)) })} placeholder="Título da aula" maxLength={120} className="flex-1 border border-rule bg-parchment px-2 py-1" />
              )}
              <button type="button" aria-label="Subir" disabled={i === 0} className="cursor-pointer px-1 text-ink-soft disabled:opacity-30" onClick={() => moverAula(i, -1)}>▲</button>
              <button type="button" aria-label="Descer" disabled={i === aulas.length - 1} className="cursor-pointer px-1 text-ink-soft disabled:opacity-30" onClick={() => moverAula(i, 1)}>▼</button>
              {!a.pronta && <button type="button" aria-label="Tirar do roteiro" className="cursor-pointer px-1 text-oxblood" onClick={() => mudar({ aulas: aulas.filter((x) => x.chave !== a.chave) })}>×</button>}
            </li>
          ))}
        </ol>
        <button type="button" className={`${elo} mt-2 text-sm`} onClick={() => mudar({ aulas: [...aulas, { chave: chave(), titulo: "", pronta: false }] })}>+ Aula no roteiro</button>
      </section>
      {e.nova && <label className="block">Apresentação da trilha (opcional, Markdown)<textarea value={e.intro} onChange={(ev) => mudar({ intro: ev.target.value })} rows={4} maxLength={4000} className={campo} /></label>}
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
          <button type="button" className={botaoClaro} onClick={fechar}>Cancelar</button>
          <button type="button" className={botao} disabled={ocupado || !valida} onClick={() => salvar(e)}>{decide ? "Salvar" : "Enviar sugestão"}</button>
        </>
      }
    >
      <label className="block">Nome<input value={e.nomes.pt ?? ""} onChange={(ev) => mudar({ nomes: { ...e.nomes, pt: ev.target.value }, slug: e.nova ? slugDe(ev.target.value) : e.slug })} maxLength={60} className={campo} /></label>
      <label className="block">Descrição em uma frase<input value={e.descricoes.pt ?? ""} onChange={(ev) => mudar({ descricoes: { ...e.descricoes, pt: ev.target.value } })} maxLength={300} className={campo} /></label>
      {e.nova && (
        <>
          <label className="block text-sm text-ink-soft">Identificador no endereço<input value={e.slug} onChange={(ev) => mudar({ slug: ev.target.value.toLowerCase() })} maxLength={60} className={`${campo} font-mono`} /></label>
          <label className="block">Grupo<select value={e.grupo} onChange={(ev) => mudar({ grupo: ev.target.value })} className={campo}>{grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}</select></label>
          <fieldset>
            <legend>Etapas</legend>
            <div className="mt-1 flex flex-wrap gap-4">
              {stages.map((s) => (
                <label key={s} className="inline-flex items-center gap-2"><input type="checkbox" checked={e.etapas.includes(s)} onChange={(ev) => mudar({ etapas: ev.target.checked ? [...e.etapas, s] : e.etapas.filter((x) => x !== s) })} />{etapasNomes[s]}</label>
              ))}
            </div>
          </fieldset>
        </>
      )}
      <button type="button" className={`${elo} text-sm`} aria-expanded={idiomas} onClick={() => setIdiomas(!idiomas)}>{idiomas ? "Esconder" : "Nome e descrição nos outros idiomas"}</button>
      {idiomas &&
        IDIOMAS.filter(([k]) => k !== "pt").map(([k, nome]) => (
          <div key={k} className="grid gap-2 sm:grid-cols-[6rem_1fr]">
            <span className="pt-2 text-xs text-ink-soft">{nome}</span>
            <span className="space-y-1">
              <input value={e.nomes[k] ?? ""} onChange={(ev) => mudar({ nomes: { ...e.nomes, [k]: ev.target.value } })} placeholder="Nome" maxLength={60} className={`${campo} mt-0`} />
              <input value={e.descricoes[k] ?? ""} onChange={(ev) => mudar({ descricoes: { ...e.descricoes, [k]: ev.target.value } })} placeholder="Descrição" maxLength={300} className={`${campo} mt-0`} />
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
      <p className="max-w-3xl text-ink-soft">Cada educador cuida da própria disciplina. Para alguém de outra disciplina ajudar numa aula ou numa trilha da sua, convide aqui: a pessoa passa a ver a sua disciplina em Escrever e aqui, até o convite acabar.</p>
      {convidaEm.length > 0 && (
        <section className="painel-cartao max-w-3xl p-5">
          <h2 className="font-serif text-xl font-semibold">Convidar para ajudar</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">Disciplina<select value={convite.disciplina} onChange={(e) => setConvite({ ...convite, disciplina: e.target.value, trilha: "" })} className={campo}><option value="">Escolha…</option>{convidaEm.map((s) => <option key={s} value={s}>{nomeDaArea(s)}</option>)}</select></label>
            <label className="block">Trilha (vazio: a disciplina toda)<select value={convite.trilha} onChange={(e) => setConvite({ ...convite, trilha: e.target.value })} className={campo}><option value="">A disciplina toda</option>{tracks.filter((x) => x.area === convite.disciplina).map((x) => <option key={x.slug} value={x.slug}>{x.title}</option>)}</select></label>
            <label className="block sm:col-span-2">Quem
              <select value={convite.pessoa} onChange={(e) => setConvite({ ...convite, pessoa: e.target.value })} className={campo}>
                <option value="">Escolha a pessoa…</option>
                {membros.filter((m) => !m.eu && !m.papeis.some((p) => (p.papel === "educacao" || p.papel === "educacao_secundaria") && p.disciplina === convite.disciplina)).map((m) => (
                  <option key={m.id} value={m.id}>{m.nome}</option>
                ))}
              </select>
            </label>
            <label className="block sm:col-span-2">Para quê (aparece para a pessoa)<input value={convite.nota} onChange={(e) => setConvite({ ...convite, nota: e.target.value })} maxLength={500} placeholder="Ex.: a aula de estatística das revoltas" className={campo} /></label>
          </div>
          <button type="button" className={`mt-3 ${botao}`} disabled={acao.ocupado || !convite.disciplina || !convite.pessoa} onClick={async () => { if (await acao.agir("disciplina_convidar", { p_usuario: convite.pessoa, p_disciplina: convite.disciplina, p_trilha: convite.trilha || null, p_nota: convite.nota }, "Convite enviado: a pessoa foi avisada.")) setConvite({ disciplina: "", trilha: "", pessoa: "", nota: "" }); }}>Convidar</button>
        </section>
      )}
      <ul className="max-w-3xl space-y-2">
        {convites.length === 0 && <li className="text-ink-soft">Nenhum convite ativo.</li>}
        {convites.map((c) => (
          <li key={c.id} className="painel-cartao flex flex-wrap items-start justify-between gap-2 p-3">
            <span>
              <strong>{c.meu ? "Você" : c.convidado}</strong> ajuda em <strong>{nomeDaArea(c.disciplina)}</strong>{c.trilha ? ` (trilha ${tracks.find((x) => x.slug === c.trilha)?.title ?? c.trilha})` : ""}
              <span className="block text-xs text-ink-soft">convite de {c.por || "?"} · {dataHora(c.criado_em)}{c.nota ? ` · ${c.nota}` : ""}</span>
            </span>
            {c.posso_revogar && <button type="button" className={elo} onClick={() => void acao.agir("disciplina_convite_revogar", { p_id: c.id }, "Convite encerrado.")}>{c.meu ? "Sair" : "Encerrar"}</button>}
          </li>
        ))}
      </ul>
    </div>
  );
}
