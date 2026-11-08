// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Clock, Plus, Star } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { rpc } from "@/lib/backend";
import { minutos } from "@/lib/podcast";
import { urlPublica } from "@/lib/podcast-audio";
import { useI18n } from "../../I18n";
import { Aviso, dia, textoDoErro, useLista } from "../comum";
import { Abas, Botao, Busca, Campo, Cartao, Esqueleto, Faixa, ItemDeLista, Lista, Selecao, Selo, type TomDoSelo, Vazio } from "../ui";
import { EstudioAoVivo } from "./AoVivo";
import { EstudioDeArte } from "./Arte";
import { GeradorDeCortes } from "./Cortes";
import { EditorDeEpisodio } from "./Episodio";
import { Guia, PENDENCIAS } from "./Guia";
import { Publicar } from "./Publicar";
import { CadernoNoPainel } from "../Caderno";
import { Agenda, Ajustes, Convidados, Numeros, Pautas, Pedidos, Perguntas, Trilhas } from "./Listas";
import { ETAPAS, type Etapa, NOME_DA_ETAPA, type PainelDoPodcast, type ResumoDoEpisodio, SOBRE_A_ETAPA } from "./tipos";

type Aba = "episodios" | "publicar" | "aovivo" | "caderno" | "agenda" | "pautas" | "perguntas" | "convidados" | "trilhas" | "artes" | "cortes" | "pedidos" | "numeros" | "guia" | "ajustes";

/** O tom do selo de cada etapa: a palavra diz a etapa; a cor só acompanha. */
const TOM_DA_ETAPA: Record<Etapa, TomDoSelo> = { ideia: "neutro", roteiro: "neutro", gravacao: "info", edicao: "info", revisao: "bordo", aprovado: "ouro", publicado: "ok" };

/** Um episódio no quadro: capa pequena, título, série e número, e os selos do que importa (datas, comentários, o que falta). */
function Episodio({ e, series }: { e: ResumoDoEpisodio; series: PainelDoPodcast["series"] }) {
  const serie = series.find((s) => s.id === e.serie);
  return (
    <span className="flex w-full gap-2 whitespace-normal py-1">
      {e.capa_mini ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={urlPublica(e.capa_mini)} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-[var(--pn-raio)] object-cover" />
      ) : (
        <span aria-hidden className="podcast-capa-cartaz block h-10 w-10 shrink-0 rounded-[var(--pn-raio)]" />
      )}
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 font-serif text-[0.98rem] font-semibold leading-tight">{e.titulo}</span>
        <span className="pn-item-meta block">{[serie?.titulo, e.numero != null ? `#${e.numero}` : "", e.responsavel?.nome].filter(Boolean).join(" · ")}</span>
        <span className="mt-1.5 flex flex-wrap gap-1">
          {e.status === "publicado" && <Selo tom={TOM_DA_ETAPA[e.status]} ponto>{NOME_DA_ETAPA[e.status]}</Selo>}
          {e.gravacao_em && e.status !== "publicado" && <Selo>{dia(e.gravacao_em)}</Selo>}
          {e.publicar_em && e.status !== "publicado" && (
            <Selo>
              <Clock aria-hidden className="h-3 w-3" /> {dia(e.publicar_em)}
            </Selo>
          )}
          {e.publicado_em && (
            <Selo tom="ouro">
              <Star aria-hidden className="h-3 w-3" /> {dia(e.publicado_em.slice(0, 10))}
            </Selo>
          )}
          {e.duracao > 0 && <Selo>{minutos(e.duracao)}</Selo>}
          {e.comentarios > 0 && <Selo tom="bordo">{e.comentarios} coment.</Selo>}
          {e.status === "aprovado" && e.pendencias.length > 0 && <Selo tom="aviso">falta {e.pendencias.length}</Selo>}
          {e.status === "publicado" && !e.audio_guardado && !e.externo && <Selo tom="erro">sem áudio</Selo>}
        </span>
      </span>
    </span>
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

  const abrir = (id: string | null, passo?: string) => router.replace(`/${lang}/painel?aba=podcast${id ? `&ep=${id}` : ""}${id && passo ? `&passo=${passo}` : ""}`);

  if (painel.erro) return <Faixa tom="erro" acao={<Botao pequeno onClick={painel.recarregar}>Tentar de novo</Botao>}>{painel.erro}</Faixa>;
  const p = painel.dados;
  if (!p) return <Esqueleto forma="cartoes" />;
  const { eu } = p;

  if (ep) return <EditorDeEpisodio key={ep} id={ep} painel={p} voltar={() => abrir(null)} recarregarPainel={painel.recarregar} />;

  const soDesign = eu.design && !eu.revisor;
  // Curadoria e mediação leem os episódios em andamento e pedem ajustes, sem fazer parte da equipe do podcast: as outras
  // abas (agenda, pautas, convidados, números…) são da produção e o banco não as abre para quem só revisa.
  const soRevisao = !soDesign && eu.revisor && !eu.time;
  const opcoes: { id: Aba; nome: string; conta?: number }[] = soDesign
    ? [
        { id: "pedidos", nome: "Pedidos de arte", conta: p.contagens.pedidos },
        { id: "artes", nome: "Modelos de arte" },
        // Quem é da arte e também tem função no podcast (eu.time = interno.podcaster()) pode pôr o programa no ar.
        ...(eu.time ? [{ id: "aovivo" as const, nome: "Ao vivo" }] : []),
        { id: "guia", nome: "Guia" },
      ]
    : soRevisao
    ? [
        { id: "episodios", nome: "Episódios", conta: p.contagens.revisao },
        { id: "guia", nome: "Guia" },
      ]
    : [
        { id: "episodios", nome: "Episódios", conta: p.contagens.revisao },
        { id: "publicar", nome: "Publicar: passo a passo" },
        { id: "aovivo", nome: "Ao vivo" },
        { id: "caderno", nome: "Caderno" },
        { id: "agenda", nome: "Agenda" },
        { id: "pautas", nome: "Pautas", conta: p.contagens.sugestoes },
        { id: "perguntas", nome: "Perguntas", conta: p.contagens.perguntas },
        { id: "convidados", nome: "Convidados" },
        { id: "trilhas", nome: "Biblioteca de áudios" },
        { id: "artes", nome: "Modelos de arte" },
        { id: "cortes", nome: "Cortes" },
        { id: "pedidos", nome: "Pedidos de arte", conta: eu.design ? p.contagens.pedidos : undefined },
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
  const noAr = visiveis.filter((e) => e.status === "publicado").sort((x, y) => (y.publicado_em ?? "").localeCompare(x.publicado_em ?? ""));

  return (
    <div className="space-y-5">
      {eu.supervisao && p.contagens.revisao > 0 && (
        <Faixa tom="bordo">
          <strong>{p.contagens.revisao}</strong> episódio(s) esperando a sua aprovação: estão na coluna Revisão.
        </Faixa>
      )}
      <Abas rotulo="Podcast" valor={atual} aoMudar={setAba} opcoes={opcoes} />

      {atual === "episodios" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-end gap-3">
            {(eu.producao || eu.supervisao) && (
              <form className="flex min-w-60 flex-1 flex-wrap items-end gap-2" onSubmit={(ev) => { ev.preventDefault(); void criar(); }}>
                <div className="min-w-60 flex-1">
                  <Campo rotulo="Novo episódio" value={titulo} onChange={(ev) => setTitulo(ev.target.value)} placeholder="Título provisório" minLength={3} maxLength={140} required />
                </div>
                <Botao type="submit" variante="principal" simbolo={Plus}>Criar</Botao>
              </form>
            )}
            <div className="w-56">
              <Busca rotulo="Procurar" rotuloVisivel valor={busca} aoMudar={setBusca} />
            </div>
          </div>
          <Aviso texto={aviso} />
          {/* O quadro: uma coluna por etapa de trabalho (rola de lado em tela pequena). O que já está no ar vem embaixo, em lista. */}
          <div className="-mx-1 overflow-x-auto px-1 pb-3">
            <div className="grid min-w-[60rem] grid-cols-6 gap-2">
              {ETAPAS.filter((etapa) => etapa !== "publicado").map((etapa) => {
                const coluna = visiveis.filter((e) => e.status === etapa);
                const chama = (etapa === "revisao" || etapa === "aprovado") && coluna.length > 0;
                return (
                  <Cartao
                    key={etapa}
                    aria-label={NOME_DA_ETAPA[etapa]}
                    variante={chama ? "destaque" : "plano"}
                    className="min-h-40 p-2!"
                  >
                    <h3 className="flex items-center justify-between gap-1 border-b border-[var(--pn-borda)] pb-1.5">
                      <Selo tom={TOM_DA_ETAPA[etapa]} ponto>{NOME_DA_ETAPA[etapa]}</Selo>
                      <span className="pn-rotulo-mono">{coluna.length}</span>
                    </h3>
                    <p className="mt-1.5 text-[0.72rem] leading-tight text-ink-soft">{SOBRE_A_ETAPA[etapa]}</p>
                    {coluna.length > 0 && (
                      <Lista rotulo={NOME_DA_ETAPA[etapa]} className="mt-2!">
                        {coluna.map((e) => (
                          <ItemDeLista key={e.id} titulo={<Episodio e={e} series={p.series} />} aoClicar={() => abrir(e.id)} />
                        ))}
                      </Lista>
                    )}
                  </Cartao>
                );
              })}
            </div>
          </div>
          {noAr.length > 0 && (
            <section aria-labelledby="no-ar" className="space-y-2">
              <h3 id="no-ar" className="flex items-center gap-2">
                <span className="pn-rotulo-mono">{NOME_DA_ETAPA.publicado}</span>
                <span className="pn-rotulo-mono">{noAr.length}</span>
              </h3>
              <Lista rotulo={NOME_DA_ETAPA.publicado} className="grid sm:grid-cols-2 lg:grid-cols-3">
                {noAr.map((e) => (
                  <ItemDeLista key={e.id} titulo={<Episodio e={e} series={p.series} />} aoClicar={() => abrir(e.id)} />
                ))}
              </Lista>
            </section>
          )}
          {p.episodios.length === 0 && <Vazio titulo="Nenhum episódio ainda." texto="Crie o primeiro acima, ou escolha uma pauta na aba Pautas." />}
          <Faixa tom="info">
            Não sabe como o episódio chega ao site? A aba <button type="button" className="pn-elo" onClick={() => setAba("publicar")}>Publicar: passo a passo</button> mostra os seis passos, com o que já está feito e um botão para cada um.
          </Faixa>
          <details className="text-ink-soft">
            <summary className="cursor-pointer rounded-[var(--pn-raio)] focus-visible:outline-2">O que precisa para publicar</summary>
            <ul className="mt-2 list-disc pl-5">
              {Object.values(PENDENCIAS).map((x) => <li key={x}>{x}</li>)}
            </ul>
          </details>
        </div>
      )}
      {atual === "publicar" && <Publicar painel={p} abrir={(id, passo) => abrir(id, passo)} recarregarPainel={painel.recarregar} />}
      {atual === "aovivo" && <EstudioAoVivo />}
      {atual === "caderno" && <CadernoNoPainel modo="podcast" />}
      {atual === "agenda" && <Agenda painel={p} />}
      {atual === "pautas" && <Pautas podeDecidir={eu.producao || eu.supervisao} abrir={(id) => abrir(id)} />}
      {atual === "perguntas" && <Perguntas painel={p} podeDecidir={eu.producao || eu.supervisao} />}
      {atual === "convidados" && <Convidados podeEditar={eu.producao || eu.supervisao} />}
      {atual === "trilhas" && <Trilhas podeEditar={eu.producao || eu.edicao || eu.supervisao} />}
      {atual === "artes" && (
        <div className="space-y-3">
          <p className="pn-sobre">Capas e artes com a identidade do instituto. Para pôr a capa direto num episódio, abra o episódio (aba Publicação).</p>
          <EstudioDeArte inicial={{ programa: p.config.nome }} />
        </div>
      )}
      {atual === "cortes" && (
        <div className="space-y-4">
          <div className="max-w-md">
            <Selecao rotulo="Episódio" value={cortarDe} onChange={(ev) => setCortarDe(ev.target.value)}>
              <option value="">Escolha…</option>
              {p.episodios.map((e) => <option key={e.id} value={e.id}>{e.titulo}</option>)}
            </Selecao>
          </div>
          {paraCortar ? (
            <CortesDoEpisodio id={paraCortar.id} programa={p.config.nome} />
          ) : (
            <Vazio titulo="Escolha um episódio: o corte usa o áudio final, a capa e as legendas dele." />
          )}
        </div>
      )}
      {atual === "pedidos" && <Pedidos abrir={(id) => abrir(id)} />}
      {atual === "numeros" && <Numeros />}
      {atual === "guia" && <Guia />}
      {atual === "ajustes" && <Ajustes painel={p} recarregar={painel.recarregar} />}
      <p className="pn-rotulo-mono mt-10">Episódios no site: {p.episodios.filter((e) => e.status === "publicado").length}</p>
    </div>
  );
}

function CortesDoEpisodio({ id, programa }: { id: string; programa: string }) {
  const ver = useLista<{ titulo: string; capa: string; capa_mini: string; audio: string; audio_guardado: boolean; legendas: string }>("podcast_ver", { p_id: id });
  const e = ver.dados;
  if (ver.erro) return <Faixa tom="erro" acao={<Botao pequeno onClick={ver.recarregar}>Tentar de novo</Botao>}>{ver.erro}</Faixa>;
  if (!e) return <Esqueleto forma="linhas" />;
  return <GeradorDeCortes key={id} episodio={{ titulo: e.titulo, programa, capa: e.capa_mini || e.capa, audio: e.audio_guardado ? e.audio : "", legendas: e.legendas }} />;
}
