// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { rpc } from "@/lib/backend";
import { minutos } from "@/lib/podcast";
import { urlPublica } from "@/lib/podcast-audio";
import { useI18n } from "../../I18n";
import { Abas, Aviso, botao, campo, dia, rotulo, textoDoErro, useLista } from "../comum";
import { EstudioDeArte } from "./Arte";
import { GeradorDeCortes } from "./Cortes";
import { EditorDeEpisodio } from "./Episodio";
import { Guia, PENDENCIAS } from "./Guia";
import { Agenda, Ajustes, Convidados, Entregas, Numeros, Pautas, Pedidos, Perguntas, Trilhas } from "./Listas";
import { ETAPAS, NOME_DA_ETAPA, type PainelDoPodcast, type ResumoDoEpisodio, SOBRE_A_ETAPA } from "./tipos";

type Aba = "episodios" | "agenda" | "pautas" | "perguntas" | "convidados" | "trilhas" | "artes" | "cortes" | "pedidos" | "entregas" | "numeros" | "guia" | "ajustes";

function Cartao({ e, abrir, series }: { e: ResumoDoEpisodio; abrir: () => void; series: PainelDoPodcast["series"] }) {
  const serie = series.find((s) => s.id === e.serie);
  return (
    <button type="button" onClick={abrir} className="block w-full cursor-pointer border-2 border-ink bg-parchment p-2 text-left hover:border-oxblood">
      <span className="flex gap-2">
        {e.capa_mini ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={urlPublica(e.capa_mini)} alt="" width={48} height={48} className="h-12 w-12 shrink-0 object-cover" />
        ) : (
          <span aria-hidden className="podcast-capa-cartaz block h-12 w-12 shrink-0" />
        )}
        <span className="min-w-0">
          <span className="line-clamp-2 font-serif text-base font-semibold leading-tight">{e.titulo}</span>
          <span className="block truncate text-xs text-ink-soft">
            {[serie?.titulo, e.numero != null ? `#${e.numero}` : "", e.responsavel?.nome].filter(Boolean).join(" · ")}
          </span>
        </span>
      </span>
      <span className="mt-2 flex flex-wrap gap-1.5 font-mono text-[0.65rem]">
        {e.gravacao_em && e.status !== "publicado" && <span className="bg-parchment-deep px-1">🎙 {dia(e.gravacao_em)}</span>}
        {e.publicar_em && e.status !== "publicado" && <span className="bg-parchment-deep px-1">◷ {dia(e.publicar_em)}</span>}
        {e.publicado_em && <span className="bg-parchment-deep px-1">★ {dia(e.publicado_em.slice(0, 10))}</span>}
        {e.duracao > 0 && <span className="bg-parchment-deep px-1">{minutos(e.duracao)}</span>}
        {e.comentarios > 0 && <span className="bg-oxblood px-1 text-parchment">{e.comentarios} coment.</span>}
        {e.status === "aprovado" && e.pendencias.length > 0 && <span className="bg-gold px-1 text-ink">falta {e.pendencias.length}</span>}
        {e.status === "publicado" && !e.audio_guardado && !e.externo && <span className="bg-oxblood px-1 text-parchment">sem áudio</span>}
      </span>
    </button>
  );
}

/**
 * A área do podcast no painel. O quadro mostra cada episódio na etapa em que está (ideia → roteiro → gravação → edição →
 * revisão → aprovado → no ar); um clique abre o editor. As outras abas são o que o programa precisa em volta.
 */
export function Podcast() {
  const painel = useLista<PainelDoPodcast>("podcast_painel");
  const params = useSearchParams();
  const router = useRouter();
  const { lang } = useI18n();
  const ep = params.get("ep");
  const [aba, setAba] = useState<Aba>("episodios");
  const [titulo, setTitulo] = useState("");
  const [aviso, setAviso] = useState("");
  const [busca, setBusca] = useState("");
  const [cortarDe, setCortarDe] = useState("");

  const abrir = (id: string | null) => router.replace(`/${lang}/painel?aba=podcast${id ? `&ep=${id}` : ""}`);

  if (painel.erro) return <Aviso texto={painel.erro} />;
  const p = painel.dados;
  if (!p) return <p className="font-mono text-xs text-ink-soft">Carregando…</p>;
  const { eu } = p;

  if (ep) return <EditorDeEpisodio key={ep} id={ep} painel={p} voltar={() => abrir(null)} recarregarPainel={painel.recarregar} />;

  const soDesign = eu.design && !eu.revisor;
  const opcoes: { id: Aba; nome: string; conta?: number }[] = soDesign
    ? [
        { id: "pedidos", nome: "Pedidos de arte", conta: p.contagens.pedidos },
        { id: "artes", nome: "Modelos de arte" },
        { id: "guia", nome: "Guia" },
      ]
    : [
        { id: "episodios", nome: "Episódios", conta: p.contagens.revisao },
        { id: "agenda", nome: "Agenda" },
        { id: "pautas", nome: "Pautas", conta: p.contagens.sugestoes },
        { id: "perguntas", nome: "Perguntas", conta: p.contagens.perguntas },
        { id: "convidados", nome: "Convidados" },
        { id: "trilhas", nome: "Biblioteca de áudios" },
        { id: "artes", nome: "Modelos de arte" },
        { id: "cortes", nome: "Cortes" },
        { id: "pedidos", nome: "Pedidos de arte", conta: eu.design ? p.contagens.pedidos : undefined },
        { id: "entregas", nome: "Entregas" },
        { id: "numeros", nome: "Números" },
        { id: "guia", nome: "Guia" },
        ...(eu.supervisao || eu.coordenacao ? [{ id: "ajustes" as const, nome: "Ajustes" }] : []),
      ];
  const atual = opcoes.some((o) => o.id === aba) ? aba : opcoes[0].id;

  async function criar() {
    setAviso("");
    try {
      const r = await rpc<{ id: string }>("podcast_salvar", { p_id: null, p: { titulo } });
      setTitulo("");
      painel.recarregar();
      abrir(r.id);
    } catch (erro) {
      setAviso(textoDoErro(erro));
    }
  }

  const termo = busca.trim().toLowerCase();
  const visiveis = p.episodios.filter((e) => !termo || e.titulo.toLowerCase().includes(termo));
  const paraCortar = p.episodios.find((e) => e.id === cortarDe);

  return (
    <div>
      {eu.supervisao && p.contagens.revisao > 0 && (
        <p className="mb-5 border-l-4 border-oxblood pl-3">
          <strong>{p.contagens.revisao}</strong> episódio(s) esperando a sua aprovação: estão na coluna Revisão.
        </p>
      )}
      <Abas atual={atual} escolher={setAba} opcoes={opcoes} />

      {atual === "episodios" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-end gap-3">
            {(eu.producao || eu.supervisao) && (
              <form className="flex flex-1 flex-wrap items-end gap-2" onSubmit={(ev) => { ev.preventDefault(); void criar(); }}>
                <label className="block min-w-60 flex-1">
                  Novo episódio
                  <input value={titulo} onChange={(ev) => setTitulo(ev.target.value)} placeholder="Título provisório" minLength={3} maxLength={140} required className={campo} />
                </label>
                <button type="submit" className={botao}>Criar</button>
              </form>
            )}
            <label className="block w-56">
              Procurar
              <input type="search" value={busca} onChange={(ev) => setBusca(ev.target.value)} className={campo} />
            </label>
          </div>
          <Aviso texto={aviso} />
          {/* O quadro: uma coluna por etapa, que rola de lado em tela pequena. */}
          <div className="-mx-5 overflow-x-auto px-5 pb-3 sm:-mx-8 sm:px-8">
            <div className="grid min-w-[70rem] grid-cols-7 gap-3">
              {ETAPAS.map((etapa) => {
                const coluna = visiveis.filter((e) => e.status === etapa);
                return (
                  <section key={etapa} aria-label={NOME_DA_ETAPA[etapa]} className={`min-h-40 p-2 ${etapa === "revisao" && coluna.length ? "bg-[#c21f16]/10" : "bg-parchment-deep"}`}>
                    <h3 className="flex items-baseline justify-between border-b-2 border-ink pb-1 font-sans text-xs font-black uppercase italic">
                      {NOME_DA_ETAPA[etapa]}
                      <span className="font-mono not-italic">{coluna.length}</span>
                    </h3>
                    <p className="mt-1 text-[0.7rem] leading-tight text-ink-soft">{SOBRE_A_ETAPA[etapa]}</p>
                    <ul className="mt-2 space-y-2">
                      {coluna.map((e) => (
                        <li key={e.id}>
                          <Cartao e={e} abrir={() => abrir(e.id)} series={p.series} />
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          </div>
          {p.episodios.length === 0 && <p className="text-ink-soft">Nenhum episódio ainda. Crie o primeiro acima, ou escolha uma pauta na aba Pautas.</p>}
          <details className="text-ink-soft">
            <summary className="cursor-pointer">O que precisa para publicar</summary>
            <ul className="mt-2 list-disc pl-5">
              {Object.values(PENDENCIAS).map((x) => <li key={x}>{x}</li>)}
            </ul>
          </details>
        </div>
      )}
      {atual === "agenda" && <Agenda painel={p} />}
      {atual === "pautas" && <Pautas podeDecidir={eu.producao || eu.supervisao} abrir={(id) => abrir(id)} />}
      {atual === "perguntas" && <Perguntas painel={p} podeDecidir={eu.producao || eu.supervisao} />}
      {atual === "convidados" && <Convidados podeEditar={eu.producao || eu.supervisao} />}
      {atual === "trilhas" && <Trilhas podeEditar={eu.producao || eu.edicao || eu.supervisao} />}
      {atual === "artes" && (
        <div className="space-y-3">
          <p className="text-ink-soft">Capas e artes com a identidade do instituto. Para pôr a capa direto num episódio, abra o episódio (aba Publicação).</p>
          <EstudioDeArte inicial={{ programa: p.config.nome }} />
        </div>
      )}
      {atual === "cortes" && (
        <div className="space-y-4">
          <label className="block max-w-md">
            Episódio
            <select value={cortarDe} onChange={(ev) => setCortarDe(ev.target.value)} className={campo}>
              <option value="">Escolha…</option>
              {p.episodios.map((e) => <option key={e.id} value={e.id}>{e.titulo}</option>)}
            </select>
          </label>
          {paraCortar ? (
            <CortesDoEpisodio id={paraCortar.id} programa={p.config.nome} />
          ) : (
            <p className="text-ink-soft">Escolha um episódio: o corte usa o áudio final, a capa e as legendas dele.</p>
          )}
        </div>
      )}
      {atual === "pedidos" && <Pedidos abrir={(id) => abrir(id)} />}
      {atual === "entregas" && <Entregas coordenacao={eu.coordenacao} painel={p} />}
      {atual === "numeros" && <Numeros />}
      {atual === "guia" && <Guia />}
      {atual === "ajustes" && <Ajustes painel={p} recarregar={painel.recarregar} />}
      <p className={`${rotulo} mt-10`}>Episódios no site: {p.episodios.filter((e) => e.status === "publicado").length}</p>
    </div>
  );
}

function CortesDoEpisodio({ id, programa }: { id: string; programa: string }) {
  const ver = useLista<{ titulo: string; capa: string; capa_mini: string; audio: string; audio_guardado: boolean; legendas: string }>("podcast_ver", { p_id: id });
  const e = ver.dados;
  if (!e) return <p className="font-mono text-xs text-ink-soft">Carregando…</p>;
  return <GeradorDeCortes key={id} episodio={{ titulo: e.titulo, programa, capa: e.capa_mini || e.capa, audio: e.audio_guardado ? e.audio : "", legendas: e.legendas }} />;
}
