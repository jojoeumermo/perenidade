// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Dict } from "@/i18n/types";
import { BackendError, hasBackend, rpc, useMe } from "@/lib/backend";
import { L, useI18n } from "../I18n";
import { Formatado } from "../painel/Formatado";

// A Rede Lúcia (gatilho "Rede Lúcia"): a linha do tempo de posts curtos da Comunidade, ao lado do fórum. Em ordem de
// tempo, sem algoritmo e sem contagem de seguidores; com fio, repost com comentário, citação de aula, obra ou matéria,
// chamados à ação com "Eu vou", seguir, bloquear, alcance por post, aviso de conteúdo e perfil invisível. O banco está
// em supabase/install.sql, "Rede Lúcia". O desenho segue o RedeLucia do canvas: menu à esquerda, linha no meio e, à
// direita, busca, comunidades de luta, próximos chamados e segurança.

type Textos = Dict["rede"];
type Modo = "tudo" | "seguindo" | "minhas" | "chamados" | "comunidade" | "perfil";
/** O que ocupa o meio da tela. "inicio" é a linha com as abas Seguindo, Comunidades e Tudo. */
type Vista = "inicio" | "comunidades" | "chamados" | "espacos" | "avisos" | "perfil" | "comunidade";
type Aba = "seguindo" | "minhas" | "tudo";

interface Autor {
  id: string;
  nome: string;
  avatar: string | null;
  equipe: boolean;
}
interface Post {
  id: string;
  texto: string;
  comunidade: string | null;
  criado_em: string;
  aviso: string;
  cita: { tipo: "aula" | "obra" | "materia"; caminho: string; titulo: string } | null;
  chamado: { tipo: "ato" | "mutirao" | "assembleia" | "roda"; quando: string; onde: string } | null;
  alcance: "publico" | "seguidores" | "equipe";
  /** Numa resposta de debate: a favor, contra ou síntese. */
  posicao: "favor" | "contra" | "sintese" | null;
  meu: boolean;
  /** Quem está vendo modera esta comunidade (ou cuida do espaço fechado). */
  modero: boolean;
  retido: boolean;
  autor: Autor;
  respostas: number;
  apoios: number;
  apoiei: boolean;
  vou: number | null;
  vou_eu: boolean;
  resposta_a: { id: string; autor: string } | null;
  original: Post | null;
}
interface Espaco {
  slug: string;
  nome: string;
  descricao: string;
  cuido: boolean;
  codigo: string | null;
  membros: number;
}
interface Perfil {
  id?: string;
  nome: string;
  avatar?: string | null;
  bio?: string;
  invisivel: boolean;
  equipe?: boolean;
  sigo?: boolean;
  me_segue?: boolean;
  bloqueei?: boolean;
  eu?: boolean;
}
interface Aviso {
  id: string;
  texto: string;
  lido: boolean;
  criado_em: string;
}

/** As comunidades de luta e organização (as das disciplinas vêm das estantes). */
export const LUTAS = ["moradia", "trabalho", "antirracismo", "feminismo", "lgbt", "terra", "quebrada", "educacao-publica", "saude-publica"] as const;
/** A cor da letra de cada comunidade de luta, a mesma do desenho. */
const COR_DA_LUTA: Record<string, string> = {
  moradia: "#c21f16",
  trabalho: "#1f1a14",
  antirracismo: "#6e1f1a",
  feminismo: "#7a3b8f",
  lgbt: "#b5446e",
  terra: "#2f5d34",
  quebrada: "#e01b22",
  "educacao-publica": "#1f3a5f",
  "saude-publica": "#2f6f4f",
};

const CHAVE_SILENCIADAS = "lucia:rede-silenciadas";
function lerSilenciadas(): string[] {
  try {
    return (localStorage.getItem(CHAVE_SILENCIADAS) ?? "").split(",").map((p) => p.trim().toLowerCase()).filter(Boolean);
  } catch {
    return [];
  }
}

const iniciais = (nome: string) => nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
const corDe = (id: string) => {
  if (COR_DA_LUTA[id]) return COR_DA_LUTA[id];
  const cores = ["#c21f16", "#6e1f1a", "#2f6f4f", "#1f3a5f", "#7b4b94", "#8a5a2b", "#b5446e", "#3d5a80"];
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return cores[h % cores.length];
};

function Rosto({ autor, tamanho = "h-11 w-11" }: { autor: Pick<Autor, "id" | "nome">; tamanho?: string }) {
  return (
    <span aria-hidden className={`flex shrink-0 items-center justify-center rounded-xl font-sans text-sm font-extrabold text-white ${tamanho}`} style={{ backgroundColor: corDe(autor.id) }}>
      {iniciais(autor.nome)}
    </span>
  );
}

/** A letra colorida de uma comunidade (o "bolinho" do desenho). */
function Letra({ slug, nome, tamanho = "h-6 w-6 text-[0.68rem]" }: { slug: string; nome: string; tamanho?: string }) {
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center rounded-[7px] font-sans font-extrabold text-white ${tamanho}`} style={{ backgroundColor: slug.startsWith("fechado-") ? "#2f5d34" : corDe(slug) }}>
      {nome[0]?.toUpperCase()}
    </span>
  );
}

/** Os ícones do menu, os mesmos traços do desenho. */
const ICONES: Record<string, ReactNode> = {
  inicio: <path d="M4 11l8-7 8 7v9h-5.5v-6h-5v6H4z" />,
  comunidades: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </>
  ),
  chamados: <path d="M4 4h16v6H4zM6 10v10M18 10v10M4 20h16" />,
  espacos: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
  avisos: <path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0" />,
  perfil: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
    </>
  ),
  forum: <path d="M4 5h16v11H9l-5 4zM8 9h8M8 12h5" />,
};
function Icone({ nome }: { nome: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
      {ICONES[nome]}
    </svg>
  );
}

/** As etiquetas do desenho: + CITAR AULA, + CHAMADO À AÇÃO… (e os seletores no mesmo estilo). */
const etiqueta = "cursor-pointer rounded-[5px] border-[1.5px] border-ink bg-folha px-[7px] py-[2px] font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-ink hover:bg-parchment-deep";
const pilula = "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full px-4 py-[9px] font-sans text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-40";

export function Rede({ s, abrirForum }: { s: Textos; abrirForum?: () => void }) {
  const { lang, t } = useI18n();
  const me = useMe();
  const logado = me.status === "in";
  const [vista, setVista] = useState<Vista>("inicio");
  const [aba, setAba] = useState<Aba>("tudo");
  const escolheuAba = useRef(false);
  const [comunidade, setComunidade] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<string | null>(null);
  const [fio, setFio] = useState<string | null>(() => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("post")));
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [achados, setAchados] = useState<Post[] | null>(null);
  const [silenciadas, setSilenciadas] = useState<string[]>([]);
  const [seguidas, setSeguidas] = useState<string[]>([]);
  const [espacos, setEspacos] = useState<Espaco[]>([]);
  const [novos, setNovos] = useState(0);
  const [versao, setVersao] = useState(0);
  const carregadoEm = useRef(new Date().toISOString());
  const caixa = useRef<HTMLTextAreaElement>(null);
  const recarregar = useCallback(() => setVersao((v) => v + 1), []);
  const nomeDaComunidade = (slug: string) => espacos.find((e) => e.slug === slug)?.nome ?? (s.lutasLista as Record<string, string>)[slug] ?? (t.areas as Record<string, string[]>)[slug]?.[0] ?? slug;
  const equipe = logado && me.status === "in" && me.me.papeis.length > 0;
  const modo: Modo | null = vista === "inicio" ? aba : vista === "chamados" || vista === "comunidade" || vista === "perfil" ? vista : null;

  // Quem entra na conta começa pela aba Seguindo, como no desenho (enquanto não escolher outra).
  useEffect(() => {
    if (logado && !escolheuAba.current) setAba("seguindo");
  }, [logado]);
  // As palavras silenciadas ficam neste aparelho; as comunidades seguidas e os espaços fechados, na conta.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- o que a pessoa silenciou só existe no navegador
    setSilenciadas(lerSilenciadas());
  }, []);
  useEffect(() => {
    if (!logado) return;
    rpc<string[]>("rede_comunidades_minhas").then(setSeguidas).catch(() => undefined);
    rpc<Espaco[]>("rede_meus_espacos").then(setEspacos).catch(() => undefined);
  }, [logado, versao]);
  // A busca vai ao servidor (texto e #hashtags), um pouco depois de parar de digitar.
  useEffect(() => {
    const termo = busca.trim();
    if (termo.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpar a busca é imediato
      setAchados(null);
      return;
    }
    const espera = window.setTimeout(() => {
      void rpc<Post[]>("rede_buscar", { p_termo: termo }).then(setAchados).catch(() => setAchados([]));
    }, 400);
    return () => window.clearTimeout(espera);
  }, [busca]);

  useEffect(() => {
    if (!hasBackend || fio || !modo) return;
    let vivo = true;
    rpc<Post[]>("rede_linha", { p_modo: modo, p_comunidade: comunidade, p_usuario: perfil, p_antes: null })
      .then((r) => {
        if (!vivo) return;
        setPosts(r);
        setErro("");
        setNovos(0);
        carregadoEm.current = new Date().toISOString();
      })
      .catch(() => vivo && setErro(s.erro));
    return () => {
      vivo = false;
    };
  }, [modo, comunidade, perfil, fio, versao, s.erro]);

  // "N posts novos": de tempos em tempos pergunta quantos chegaram, sem mexer na lista que a pessoa está lendo.
  useEffect(() => {
    if (!hasBackend || fio || !modo || modo === "perfil") return;
    const relogio = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void rpc<number>("rede_novos", { p_desde: carregadoEm.current }).then((n) => setNovos(typeof n === "number" ? n : 0)).catch(() => undefined);
    }, 30000);
    return () => window.clearInterval(relogio);
  }, [fio, modo]);

  const abrir = (proxima: Vista, extra?: { comunidade?: string; perfil?: string }) => {
    setFio(null);
    setBusca("");
    setVista(proxima);
    setComunidade(extra?.comunidade ?? null);
    setPerfil(extra?.perfil ?? null);
    setPosts(null);
    window.scrollTo({ top: 0 });
  };
  const trocarAba = (proxima: Aba) => {
    escolheuAba.current = true;
    setAba(proxima);
    setPosts(null);
  };
  const seguirComunidade = async (slug: string, sim: boolean) => {
    await rpc("rede_comunidade_seguir", { p_comunidade: slug, p_sim: sim }).catch(() => undefined);
    setSeguidas(sim ? [...seguidas, slug] : seguidas.filter((c) => c !== slug));
  };
  const escrever = () => {
    if (vista !== "inicio" && vista !== "comunidade") abrir("inicio");
    window.setTimeout(() => caixa.current?.focus(), 50);
  };
  const vistos = useMemo(() => {
    const lista = achados ?? posts ?? [];
    return silenciadas.length ? lista.filter((p) => !silenciadas.some((palavra) => p.texto.toLowerCase().includes(palavra))) : lista;
  }, [posts, achados, silenciadas]);

  const menu: [Vista | "forum", string][] = [["inicio", s.seguindo], ["comunidades", s.comunidades], ["chamados", s.chamados], ["espacos", s.espacos], ["avisos", s.avisos], ["perfil", s.perfil]];
  const suas = [...seguidas, ...espacos.map((e) => e.slug)];
  const ativo = (id: string) => !fio && (vista === id || (id === "perfil" && vista === "perfil" && me.status === "in" && perfil === me.me.id));
  const buscaCampo = (
    <label className="flex items-center gap-2 rounded-full bg-parchment-deep px-3.5 py-2.5">
      <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2" className="shrink-0 text-ink-soft"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5 20 20" /></svg>
      <span className="sr-only">{s.buscar}</span>
      <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={s.buscar} className="min-w-0 flex-1 bg-transparent font-sans text-sm outline-none placeholder:text-ink-soft" />
    </label>
  );

  return (
    <div className="rede-lucia grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[76px_minmax(0,1fr)] xl:grid-cols-[270px_minmax(0,640px)_330px] xl:justify-center">
      {/* À esquerda: a marca da rede, o menu, o botão de escrever e as comunidades da pessoa. */}
      <nav aria-label={s.nome} className="flex min-w-0 flex-col gap-1 border-rule px-2 py-3 max-lg:border-b lg:sticky lg:top-[var(--altura-topo,0px)] lg:max-h-[calc(100dvh-var(--altura-topo,0px))] lg:self-start lg:overflow-y-auto lg:border-r lg:py-4 xl:px-[18px]">
        <div className="flex items-center gap-2.5 px-2.5 pb-3.5 max-lg:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element -- a marca do instituto */}
          <img src="/marca-96.png" alt="" width={38} height={38} className="h-[38px] w-[38px] rounded-full" />
          <span className="max-xl:hidden">
            <span className="block font-serif text-xl font-semibold leading-none">{s.nome}</span>
            <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-[#c21f16]">{s.sub}</span>
          </span>
        </div>
        <ul className="flex gap-1 max-lg:overflow-x-auto lg:flex-col">
          {menu.map(([id, nome]) => (
            <li key={id} className="shrink-0">
              <button
                type="button"
                title={nome}
                aria-current={ativo(id) ? "page" : undefined}
                disabled={(id === "avisos" || id === "espacos" || id === "perfil") && !logado}
                onClick={() => (id === "perfil" && me.status === "in" ? abrir("perfil", { perfil: me.me.id }) : abrir(id as Vista))}
                className={`flex w-full cursor-pointer items-center gap-3 rounded-full px-3 py-2.5 text-left font-sans text-base font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${ativo(id) ? "bg-ink text-parchment" : "hover:bg-parchment-deep"}`}
              >
                <Icone nome={id} />
                <span className="lg:max-xl:sr-only">{nome}</span>
              </button>
            </li>
          ))}
          {abrirForum && (
            <li className="shrink-0">
              <button type="button" title={s.forum} onClick={abrirForum} className="flex w-full cursor-pointer items-center gap-3 rounded-full px-3 py-2.5 text-left font-sans text-base font-semibold hover:bg-parchment-deep">
                <Icone nome="forum" />
                <span className="lg:max-xl:sr-only">{s.forum}</span>
              </button>
            </li>
          )}
        </ul>
        <button type="button" onClick={escrever} className={`${pilula} mt-2.5 bg-[#c21f16] py-[13px] text-white shadow-[3px_3px_0_var(--ink)] max-xl:hidden`}>
          {s.escreverBotao}
        </button>
        {suas.length > 0 && (
          <div className="max-xl:hidden">
            <p className="mx-2.5 mt-5 mb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-prelo-texto">{s.suas}</p>
            <ul>
              {suas.map((slug) => (
                <li key={slug}>
                  <button type="button" onClick={() => abrir("comunidade", { comunidade: slug })} aria-current={vista === "comunidade" && comunidade === slug ? "page" : undefined} className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left font-sans text-sm ${vista === "comunidade" && comunidade === slug ? "bg-parchment-deep font-semibold" : "hover:bg-parchment-deep"}`}>
                    <Letra slug={slug} nome={nomeDaComunidade(slug)} />
                    <span className="min-w-0 truncate">{nomeDaComunidade(slug)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>

      {/* No meio: as abas, escrever e a linha do tempo, ou o fio, um perfil, as comunidades, os núcleos fechados, os avisos. */}
      <section aria-label={s.nome} className="min-w-0 border-rule xl:border-r">
        <header className="sticky top-[var(--altura-topo,0px)] z-10 border-b border-rule bg-parchment">
          {vista === "inicio" && !fio ? (
            <div role="tablist" aria-label={s.nome} className="flex">
              {([["seguindo", s.seguindo], ["minhas", s.comunidades], ["tudo", s.abaTudo]] as [Aba, string][]).map(([id, nome]) => (
                <button key={id} type="button" role="tab" aria-selected={aba === id} disabled={id !== "tudo" && !logado} onClick={() => trocarAba(id)} className={`flex-1 cursor-pointer border-b-[3px] pt-4 pb-3 text-center font-sans disabled:cursor-not-allowed disabled:opacity-40 ${aba === id ? "border-[#c21f16] font-extrabold text-ink" : "border-transparent font-semibold text-ink-soft hover:text-ink"}`}>
                  {nome}
                </button>
              ))}
            </div>
          ) : (
            <TituloDaVista vista={vista} fio={Boolean(fio)} s={s} comunidade={comunidade} nome={comunidade ? nomeDaComunidade(comunidade) : ""} logado={logado} seguida={comunidade ? seguidas.includes(comunidade) : false} seguir={(sim) => comunidade && void seguirComunidade(comunidade, sim)} voltar={() => (fio ? (setFio(null), recarregar()) : abrir("inicio"))} />
          )}
          <p className="bg-parchment-deep px-[18px] py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft">{s.regua}</p>
          <div className="border-t border-rule p-3 xl:hidden">{buscaCampo}</div>
        </header>

        {fio ? (
          <Fio id={fio} s={s} logado={logado} abrirPerfil={(id) => abrir("perfil", { perfil: id })} abrirFio={setFio} />
        ) : vista === "comunidades" ? (
          <IndiceDeComunidades s={s} logado={logado} seguidas={seguidas} nome={nomeDaComunidade} abrir={(slug) => abrir("comunidade", { comunidade: slug })} seguir={seguirComunidade} />
        ) : vista === "espacos" ? (
          <EspacosFechados s={s} espacos={espacos} equipe={equipe} abrir={(slug) => abrir("comunidade", { comunidade: slug })} mudou={recarregar} />
        ) : vista === "avisos" ? (
          <Avisos s={s} />
        ) : (
          <>
            {vista === "perfil" && perfil && <CabecaDoPerfil id={perfil} s={s} logado={logado} mudou={recarregar} />}
            {achados && <p className="border-b border-rule px-[18px] py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">{s.resultados} · {achados.length}</p>}
            {vista !== "perfil" && vista !== "chamados" && !achados && <Escrever key={comunidade ?? "geral"} s={s} logado={logado} equipe={equipe} comunidade={comunidade} nomeDaComunidade={nomeDaComunidade} postou={recarregar} lang={lang} caixa={caixa} eu={me.status === "in" ? me.me.nome : ""} />}
            {novos > 0 && (
              <button type="button" onClick={recarregar} className={`${pilula} m-3 w-[calc(100%-1.5rem)] bg-[#c21f16] text-white`}>
                {s.novos.replace("{n}", String(novos))}
              </button>
            )}
            {erro && <p className="px-[18px] py-4 text-oxblood" role="alert">{erro}</p>}
            {posts === null && !erro && <p className="px-[18px] py-4 text-ink-soft">…</p>}
            {posts && vistos.length === 0 && (
              <p className="px-[18px] py-6 text-ink-soft">
                {modo === "seguindo" ? s.vazioSeguindo : s.vazio}{" "}
                {vista === "inicio" && aba !== "tudo" && <button type="button" className="cursor-pointer font-semibold underline" onClick={() => trocarAba("tudo")}>{s.verTudo}</button>}
              </p>
            )}
            <ul>
              {vistos.map((post) => (
                <li key={post.id}>
                  <CartaoDoPost post={post} s={s} logado={logado} equipe={equipe} mudou={recarregar} abrirFio={setFio} abrirPerfil={(id) => abrir("perfil", { perfil: id })} abrirComunidade={(c) => abrir("comunidade", { comunidade: c })} nomeDaComunidade={nomeDaComunidade} />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* À direita: busca, comunidades de luta, próximos chamados e segurança. Abaixo da linha nas telas menores. */}
      <aside className="flex min-w-0 flex-col gap-[18px] px-4 py-4 lg:col-start-2 xl:sticky xl:top-[var(--altura-topo,0px)] xl:col-start-auto xl:max-h-[calc(100dvh-var(--altura-topo,0px))] xl:self-start xl:overflow-y-auto xl:px-5">
        <div className="max-xl:hidden">{buscaCampo}</div>
        <ComunidadesDeLuta s={s} logado={logado} seguidas={seguidas} nome={nomeDaComunidade} abrir={(slug) => abrir("comunidade", { comunidade: slug })} seguir={seguirComunidade} verTodas={() => abrir("comunidades")} />
        <ProximosChamados s={s} abrirFio={setFio} />
        <Seguranca key={silenciadas.join(",")} s={s} logado={logado} silenciadas={silenciadas} silenciar={(lista) => { setSilenciadas(lista); try { localStorage.setItem(CHAVE_SILENCIADAS, lista.join(", ")); } catch { /* sem armazenamento */ } }} />
      </aside>
    </div>
  );
}

/** O alto do meio fora da linha inicial: o nome da vista (ou da comunidade, com o botão de entrar) e o voltar. */
function TituloDaVista({ vista, fio, s, comunidade, nome, logado, seguida, seguir, voltar }: { vista: Vista; fio: boolean; s: Textos; comunidade: string | null; nome: string; logado: boolean; seguida: boolean; seguir: (sim: boolean) => void; voltar: () => void }) {
  const titulos: Partial<Record<Vista, string>> = { comunidades: s.comunidades, chamados: s.chamados, espacos: s.espacos, avisos: s.avisos, perfil: s.perfil };
  return (
    <div className="flex min-h-[3.4rem] items-center gap-3 px-[18px] py-2">
      <button type="button" onClick={voltar} aria-label={s.voltar} className="cursor-pointer rounded-full px-2 py-1 font-sans text-lg font-bold hover:bg-parchment-deep">←</button>
      {fio ? (
        <h2 className="font-sans text-lg font-extrabold">{s.fio}</h2>
      ) : vista === "comunidade" && comunidade ? (
        <>
          <Letra slug={comunidade} nome={nome} tamanho="h-8 w-8 text-sm" />
          <h2 className="min-w-0 flex-1 truncate font-serif text-[1.45rem] font-semibold leading-tight">{nome}</h2>
          {logado && !comunidade.startsWith("fechado-") && (
            <button type="button" onClick={() => seguir(!seguida)} className={`${pilula} px-3.5 py-1.5 text-xs ${seguida ? "border-[1.5px] border-ink" : "bg-ink text-parchment"}`}>
              {seguida ? s.sairComunidade : s.entrarComunidade}
            </button>
          )}
        </>
      ) : (
        <h2 className="font-sans text-lg font-extrabold">{titulos[vista] ?? s.nome}</h2>
      )}
    </div>
  );
}

/** O botão "Entrar" / "Sair" de uma comunidade; sem conta, só abre a comunidade para ler. */
function BotaoDaComunidade({ s, logado, seguida, abrir, seguir }: { s: Textos; logado: boolean; seguida: boolean; abrir: () => void; seguir: (sim: boolean) => void }) {
  return (
    <button type="button" onClick={() => (logado ? seguir(!seguida) : abrir())} className={`${pilula} shrink-0 px-3 py-[5px] text-xs ${seguida ? "border-[1.5px] border-ink text-ink" : "bg-ink text-parchment"}`}>
      {!logado ? s.verComunidade : seguida ? s.sairComunidade : s.entrarComunidade}
    </button>
  );
}

/** À direita: quatro comunidades de luta (primeiro as que a pessoa ainda não segue) e o "ver todas". */
function ComunidadesDeLuta({ s, logado, seguidas, nome, abrir, seguir, verTodas }: { s: Textos; logado: boolean; seguidas: string[]; nome: (slug: string) => string; abrir: (slug: string) => void; seguir: (slug: string, sim: boolean) => void; verTodas: () => void }) {
  const lista = [...LUTAS].sort((a, b) => Number(seguidas.includes(a)) - Number(seguidas.includes(b))).slice(0, 4);
  return (
    <section className="overflow-hidden rounded-[14px] border-[1.5px] border-ink bg-folha">
      <h2 className="px-4 pt-3.5 pb-2 font-serif text-[21px] font-semibold">{s.lutas}</h2>
      <ul>
        {lista.map((slug) => (
          <li key={slug} className="flex items-center gap-2.5 px-4 py-[9px] hover:bg-parchment-deep">
            <button type="button" onClick={() => abrir(slug)} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left font-sans text-sm">
              <Letra slug={slug} nome={nome(slug)} />
              <span className="min-w-0 truncate">{nome(slug)}</span>
            </button>
            <BotaoDaComunidade s={s} logado={logado} seguida={seguidas.includes(slug)} abrir={() => abrir(slug)} seguir={(sim) => seguir(slug, sim)} />
          </li>
        ))}
      </ul>
      <button type="button" onClick={verTodas} className="block cursor-pointer px-4 pt-2.5 pb-3.5 font-sans text-[13px] font-bold text-oxblood underline-offset-2 hover:underline">
        {s.verTodas} →
      </button>
    </section>
  );
}

/** A vista "Comunidades": todas as de luta e as das disciplinas, com entrar e sair. */
function IndiceDeComunidades({ s, logado, seguidas, nome, abrir, seguir }: { s: Textos; logado: boolean; seguidas: string[]; nome: (slug: string) => string; abrir: (slug: string) => void; seguir: (slug: string, sim: boolean) => void }) {
  const { t } = useI18n();
  const areas = Object.keys(t.areas as Record<string, string[]>);
  const linha = (slug: string) => (
    <li key={slug} className="flex items-center gap-3 border-b border-rule bg-folha px-[18px] py-3">
      <button type="button" onClick={() => abrir(slug)} className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left">
        <Letra slug={slug} nome={nome(slug)} tamanho="h-9 w-9 text-sm" />
        <span className="min-w-0 truncate font-sans font-semibold">{nome(slug)}</span>
      </button>
      <BotaoDaComunidade s={s} logado={logado} seguida={seguidas.includes(slug)} abrir={() => abrir(slug)} seguir={(sim) => seguir(slug, sim)} />
    </li>
  );
  return (
    <div>
      <p className="px-[18px] py-4 font-sans text-sm text-ink-soft">{s.comunidadesLead}</p>
      <h3 className="px-[18px] pb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-prelo-texto">{s.lutas}</h3>
      <ul className="border-t border-rule">{LUTAS.map(linha)}</ul>
      <h3 className="px-[18px] pt-6 pb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-prelo-texto">{s.disciplinas}</h3>
      <ul className="border-t border-rule">{areas.map(linha)}</ul>
    </div>
  );
}

/** Os avisos da conta (moderação, menções, recados da equipe), com "marcar como lido". */
function Avisos({ s }: { s: Textos }) {
  const { lang } = useI18n();
  const [lista, setLista] = useState<Aviso[] | null>(null);
  const [versao, setVersao] = useState(0);
  useEffect(() => {
    rpc<Aviso[]>("avisos_meus").then(setLista).catch(() => setLista([]));
  }, [versao]);
  const ler = async (id?: string) => {
    await rpc("aviso_ler", { p_id: id ?? null }).catch(() => undefined);
    setVersao((v) => v + 1);
  };
  if (!lista) return <p className="px-[18px] py-4 text-ink-soft">…</p>;
  if (lista.length === 0) return <p className="px-[18px] py-6 text-ink-soft">{s.nenhumAviso}</p>;
  return (
    <div>
      {lista.some((a) => !a.lido) && (
        <p className="border-b border-rule px-[18px] py-2 text-right">
          <button type="button" onClick={() => void ler()} className="cursor-pointer font-sans text-xs font-semibold underline">{s.lerTodos}</button>
        </p>
      )}
      <ul>
        {lista.map((a) => (
          <li key={a.id} className={`flex gap-3 border-b border-rule px-[18px] py-3.5 font-sans text-[15px] ${a.lido ? "bg-parchment" : "bg-folha"}`}>
            <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.lido ? "bg-transparent" : "bg-[#c21f16]"}`} />
            <div className="min-w-0 flex-1">
              <p className="whitespace-pre-line break-words">{a.texto}</p>
              <p className="mt-1 text-xs text-ink-soft">
                {tempoDesde(a.criado_em, lang)}
                {!a.lido && (
                  <>
                    {" · "}
                    <button type="button" onClick={() => void ler(a.id)} aria-label={s.lerTodos} title={s.lerTodos} className="cursor-pointer font-bold">✓</button>
                  </>
                )}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A vista "Núcleos fechados": os espaços da pessoa, entrar com o código do convite e (a equipe) abrir um novo. */
function EspacosFechados({ s, espacos, equipe, abrir, mudou }: { s: Textos; espacos: Espaco[]; equipe: boolean; abrir: (slug: string) => void; mudou: () => void }) {
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [recado, setRecado] = useState("");
  const campo = "min-w-0 flex-1 rounded-full border-[1.5px] border-ink bg-folha px-4 py-2 font-sans text-sm";
  return (
    <div>
      <p className="px-[18px] py-4 font-sans text-sm text-ink-soft">{s.espacosAjuda}</p>
      <ul className="border-t border-rule">
        {espacos.map((e) => (
          <li key={e.slug} className="border-b border-rule bg-folha px-[18px] py-3">
            <button type="button" onClick={() => abrir(e.slug)} className="flex w-full cursor-pointer items-center gap-3 text-left">
              <Letra slug={e.slug} nome={e.nome} tamanho="h-9 w-9 text-sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-sans font-semibold">{e.nome}</span>
                <span className="block font-sans text-xs text-ink-soft">{e.membros} {s.membros}</span>
              </span>
            </button>
            {e.cuido && e.codigo && (
              <p className="mt-2 ml-12 rounded-md bg-parchment-deep px-2 py-1 font-sans text-xs">
                {s.codigoConvite}: <code className="select-all font-mono">{e.codigo}</code>
              </p>
            )}
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2 px-[18px] pt-5"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const r = await rpc<{ slug: string }>("rede_espaco_entrar", { p_codigo: codigo.trim() });
            setCodigo("");
            mudou();
            abrir(r.slug);
          } catch {
            setRecado(s.erro);
          }
        }}
      >
        <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder={s.convitePlaceholder} aria-label={s.entrarConvite} className={`${campo} font-mono`} />
        <button type="submit" disabled={codigo.trim().length !== 12} className={`${pilula} bg-ink text-parchment`}>{s.entrarConvite}</button>
      </form>
      {equipe && (
        <form
          className="flex gap-2 px-[18px] pt-3"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const r = await rpc<{ slug: string }>("rede_espaco_criar", { p_nome: nome, p_descricao: "" });
              setNome("");
              mudou();
              abrir(r.slug);
            } catch {
              setRecado(s.erro);
            }
          }}
        >
          <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} placeholder={s.nomeEspaco} aria-label={s.nomeEspaco} className={campo} />
          <button type="submit" disabled={nome.trim().length < 3} className={`${pilula} bg-[#c21f16] text-white`}>{s.abrirEspaco}</button>
        </form>
      )}
      {recado && <p className="px-[18px] pt-2 font-sans text-sm text-oxblood">{recado}</p>}
    </div>
  );
}

function Escrever({ s, logado, equipe, comunidade, nomeDaComunidade, postou, lang, respondendo, repostando, cancelar, caixa, eu = "" }: {
  s: Textos;
  logado: boolean;
  equipe: boolean;
  comunidade: string | null;
  nomeDaComunidade: (slug: string) => string;
  postou: () => void;
  lang: string;
  respondendo?: Post;
  repostando?: Post;
  cancelar?: () => void;
  caixa?: React.RefObject<HTMLTextAreaElement | null>;
  eu?: string;
}) {
  const [texto, setTexto] = useState("");
  const [alcance, setAlcance] = useState<Post["alcance"]>("publico");
  const [aviso, setAviso] = useState<string | null>(null);
  const [cita, setCita] = useState<string | null>(null);
  const [chamado, setChamado] = useState<{ tipo: string; quando: string; onde: string } | null>(null);
  const [onde, setOnde] = useState(comunidade ?? "");
  const [posicao, setPosicao] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [idade, setIdade] = useState(false);
  const embutido = Boolean(respondendo || repostando);

  if (!logado) {
    return (
      <p className="border-b border-rule bg-parchment px-[18px] py-4 font-sans text-sm">
        {s.entrarParaEscrever} <L href="/entrar" className="font-bold underline">{s.entrar}</L>
      </p>
    );
  }

  /** O endereço colado vira citação: /trilhas/…, /acervo/… ou /jornal/…, com o título tirado do próprio endereço. */
  const citacao = () => {
    if (!cita) return undefined;
    let caminho = cita.trim();
    try {
      caminho = new URL(caminho, window.location.origin).pathname;
    } catch {
      return undefined;
    }
    caminho = caminho.replace(/^\/(pt|en|es|fr|ru|zh)(?=\/)/, "");
    const tipo = caminho.startsWith("/trilhas/") ? "aula" : caminho.startsWith("/acervo/") ? "obra" : caminho.startsWith("/jornal/") ? "materia" : null;
    if (!tipo) return undefined;
    const ultima = caminho.split("/").filter(Boolean).pop() ?? "";
    return { tipo, caminho, titulo: ultima.replace(/-/g, " ").replace(/^\w/, (l) => l.toUpperCase()) };
  };

  async function postar() {
    setOcupado(true);
    setMensagem("");
    try {
      await rpc("rede_postar", {
        p: {
          texto,
          alcance,
          aviso: aviso ?? "",
          comunidade: onde || null,
          resposta_a: respondendo?.id ?? null,
          posicao: respondendo && posicao ? posicao : null,
          repost_de: repostando?.id ?? null,
          cita: citacao(),
          chamado: chamado && chamado.quando ? { tipo: chamado.tipo, quando: new Date(chamado.quando).toISOString(), onde: chamado.onde } : undefined,
        },
      });
      setTexto("");
      setAviso(null);
      setCita(null);
      setChamado(null);
      postou();
      cancelar?.();
    } catch (e) {
      const codigo = e instanceof BackendError ? e.code : "";
      if (codigo === "confirme_idade") setIdade(true);
      else setMensagem((s.erros as Record<string, string>)[codigo] ?? s.erro);
    } finally {
      setOcupado(false);
    }
  }

  const campo = "mt-1 w-full rounded-md border border-rule bg-parchment px-2 py-1 text-sm";
  return (
    <div className={embutido ? "rounded-xl border-[1.5px] border-ink bg-parchment p-3" : "grid grid-cols-[44px_minmax(0,1fr)] gap-3 border-b border-rule bg-parchment px-[18px] py-4"}>
      {!embutido && <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-xl bg-parchment-deep font-sans text-sm font-extrabold">{iniciais(eu) || "·"}</span>}
      <div className="min-w-0">
        {respondendo && <p className="mb-2 font-sans text-xs text-ink-soft">{s.respondendo} <strong>{respondendo.autor.nome}</strong></p>}
        {repostando && <p className="mb-2 font-sans text-xs text-ink-soft">{s.repostando}</p>}
        <label className="block">
          <span className="sr-only">{s.escrever}</span>
          <textarea ref={caixa} value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={500} rows={2} placeholder={s.placeholder} className="w-full resize-y bg-transparent font-sans text-lg text-ink outline-none placeholder:text-ink-soft" />
        </label>
        {repostando && (
          <div className="mb-2 border-l-4 border-rule pl-3 text-sm text-ink-soft">
            <strong>{repostando.autor.nome}</strong>: {repostando.texto.slice(0, 160)}
          </div>
        )}
        {aviso !== null && (
          <label className="mt-1 block font-sans text-xs">
            {s.aviso}
            <input value={aviso} onChange={(e) => setAviso(e.target.value)} maxLength={80} placeholder={s.avisoAjuda} className={campo} />
          </label>
        )}
        {cita !== null && (
          <label className="mt-2 block font-sans text-xs">
            {s.citarAula}
            <input value={cita} onChange={(e) => setCita(e.target.value)} placeholder={`https://institutolucia.org/${lang}/trilhas/…`} className={`${campo} font-mono text-xs`} />
            <span className="text-ink-soft">{s.citarAjuda}</span>
          </label>
        )}
        {chamado && (
          <div className="mt-2 grid gap-2 font-sans text-xs sm:grid-cols-[9rem_11rem_minmax(0,1fr)]">
            <label>
              {s.chamado}
              <select value={chamado.tipo} onChange={(e) => setChamado({ ...chamado, tipo: e.target.value })} className={campo}>
                {Object.entries(s.tiposChamado).map(([id, nome]) => (
                  <option key={id} value={id}>{nome}</option>
                ))}
              </select>
            </label>
            <label>
              {s.quando}
              <input type="datetime-local" value={chamado.quando} onChange={(e) => setChamado({ ...chamado, quando: e.target.value })} className={campo} />
            </label>
            <label>
              {s.onde}
              <input value={chamado.onde} onChange={(e) => setChamado({ ...chamado, onde: e.target.value })} maxLength={160} className={campo} />
              <span className="text-ink-soft">{s.ondeAjuda}</span>
            </label>
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-rule pt-2.5 font-sans">
          {!respondendo && cita === null && <button type="button" className={etiqueta} onClick={() => setCita("")}>+ {s.citarAula}</button>}
          {!respondendo && !chamado && <button type="button" className={etiqueta} onClick={() => setChamado({ tipo: "ato", quando: "", onde: "" })}>+ {s.chamado}</button>}
          {aviso === null && <button type="button" className={etiqueta} onClick={() => setAviso("")}>+ {s.aviso}</button>}
          {respondendo && (
            <select value={posicao} onChange={(e) => setPosicao(e.target.value)} aria-label={s.posicao} className={etiqueta}>
              <option value="">{s.semPosicao}</option>
              {Object.entries(s.posicoes).map(([id, nome]) => (
                <option key={id} value={id}>{nome}</option>
              ))}
            </select>
          )}
          {!respondendo && (
            <select value={onde} onChange={(e) => setOnde(e.target.value)} aria-label={s.comunidade} className={etiqueta}>
              <option value="">{s.semComunidade}</option>
              {LUTAS.map((slug) => (
                <option key={slug} value={slug}>{nomeDaComunidade(slug)}</option>
              ))}
              {comunidade && !(LUTAS as readonly string[]).includes(comunidade) && <option value={comunidade}>{nomeDaComunidade(comunidade)}</option>}
            </select>
          )}
          <select value={alcance} onChange={(e) => setAlcance(e.target.value as Post["alcance"])} aria-label={s.alcance} className={etiqueta}>
            <option value="publico">{s.alcances.publico}</option>
            <option value="seguidores">{s.alcances.seguidores}</option>
            {equipe && <option value="equipe">{s.alcances.equipe}</option>}
          </select>
          <span className="ml-auto flex items-center gap-2 text-xs text-ink-soft">
            {!embutido && eu && <span className="max-sm:hidden">{s.postandoComo} <strong className="text-ink">{eu}</strong></span>}
            <span className="font-mono">{500 - texto.length}</span>
          </span>
          {cancelar && <button type="button" className="cursor-pointer px-2 py-1 text-xs underline" onClick={cancelar}>{s.cancelar}</button>}
          <button type="button" disabled={ocupado || (!texto.trim() && !repostando)} onClick={() => void postar()} className={`${pilula} bg-ink text-parchment`}>
            {ocupado ? s.postando : s.postar}
          </button>
        </div>
        {mensagem && <p className="mt-2 font-sans text-sm text-oxblood" role="alert">{mensagem}</p>}
        {idade && (
          <div className="mt-3 rounded-xl border-[1.5px] border-ink bg-parchment-deep p-3 font-sans text-sm">
            <p className="font-semibold">{s.idadeTitulo}</p>
            <p className="mt-1">{s.idadeTexto}</p>
            <button
              type="button"
              className={`${pilula} mt-2 bg-ink text-parchment`}
              onClick={async () => {
                await rpc("rede_confirmar_idade").catch(() => undefined);
                setIdade(false);
                void postar();
              }}
            >
              {s.idadeOk}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function tempoDesde(iso: string, lang: string) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto", style: "short" });
  if (min < 60) return rtf.format(-min, "minute");
  if (min < 1440) return rtf.format(-Math.round(min / 60), "hour");
  return new Date(iso).toLocaleDateString(lang);
}

function CartaoDoPost({ post, s, logado, equipe = false, mudou, abrirFio, abrirPerfil, abrirComunidade, nomeDaComunidade, embutido = false }: {
  post: Post;
  s: Textos;
  logado: boolean;
  equipe?: boolean;
  mudou: () => void;
  abrirFio: (id: string) => void;
  abrirPerfil: (id: string) => void;
  abrirComunidade: (slug: string) => void;
  nomeDaComunidade: (slug: string) => string;
  embutido?: boolean;
}) {
  const { lang } = useI18n();
  const [aberto, setAberto] = useState(!post.aviso);
  const [apoios, setApoios] = useState({ n: post.apoios, eu: post.apoiei });
  const [vou, setVou] = useState({ n: post.vou ?? 0, eu: post.vou_eu });
  const [repostando, setRepostando] = useState(false);
  const [denunciando, setDenunciando] = useState(false);
  const [recado, setRecado] = useState("");
  // O chamado à ação sai em cartão escuro, como no desenho.
  const escuro = Boolean(post.chamado) && !embutido;
  const suave = escuro ? "text-[#b3a584]" : "text-ink-soft";
  const acaoClasse = `flex cursor-pointer items-center gap-1.5 py-1 hover:text-[#c21f16] disabled:cursor-not-allowed disabled:opacity-50`;
  const cita = post.cita;
  return (
    <article className={`grid grid-cols-[44px_minmax(0,1fr)] gap-3 ${embutido ? "rounded-xl border border-rule bg-parchment p-3" : `border-b px-[18px] py-4 ${escuro ? "border-[#3a3020] bg-[#1f1a14] text-[#f4ecd8]" : "border-rule bg-folha"}`} ${post.retido ? "opacity-70" : ""}`}>
      <button type="button" onClick={() => abrirPerfil(post.autor.id)} className="cursor-pointer self-start" aria-label={post.autor.nome}>
        <Rosto autor={post.autor} tamanho={embutido ? "h-8 w-8" : "h-11 w-11"} />
      </button>
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-x-1.5 font-sans text-sm">
          <button type="button" onClick={() => abrirPerfil(post.autor.id)} className="cursor-pointer font-bold hover:underline">{post.autor.nome}</button>
          {post.autor.equipe && <span className="rounded bg-ink px-1 text-[0.6rem] font-semibold uppercase tracking-wider text-parchment">{s.daEquipe}</span>}
          {post.chamado && !embutido && <span className={suave}>· {s.chamado.toLowerCase()}</span>}
          {post.comunidade && (
            <span className={suave}>
              · {s.em}{" "}
              <button type="button" onClick={() => abrirComunidade(post.comunidade!)} className={`cursor-pointer underline underline-offset-2 ${escuro ? "text-[#f4ecd8]" : "text-oxblood"} hover:text-[#c21f16]`}>{nomeDaComunidade(post.comunidade)}</button>
            </span>
          )}
          <span className={suave}>· {tempoDesde(post.criado_em, lang)}</span>
          {post.alcance !== "publico" && <span className={`text-[0.7rem] ${suave}`}>· {s.alcances[post.alcance]}</span>}
        </p>
        {post.resposta_a && <p className={`font-sans text-xs ${suave}`}>{s.respondendo} {post.resposta_a.autor}</p>}
        {post.posicao && (
          <span className={`mt-1 inline-block rounded-[5px] px-[7px] py-[2px] font-mono text-[10px] font-semibold uppercase tracking-[0.12em] ${post.posicao === "favor" ? "bg-ok/20" : post.posicao === "contra" ? "bg-oxblood/15 text-oxblood" : "bg-gold/30"}`}>{s.posicoes[post.posicao]}</span>
        )}
        {post.retido && <p className="font-sans text-xs font-semibold text-oxblood">{s.retido}</p>}
        {post.aviso && !aberto ? (
          <p className="mt-1.5 flex flex-wrap items-center gap-2 rounded-lg bg-parchment-deep px-3 py-2 font-sans text-sm text-ink">
            <strong>{s.aviso}:</strong> {post.aviso}
            <button type="button" className="cursor-pointer underline" onClick={() => setAberto(true)}>{s.mostrar}</button>
          </p>
        ) : post.chamado && !embutido ? (
          <div className="mt-2 rounded-xl border-[1.5px] border-[#f4ecd8] p-3.5">
            <span className="rounded-[5px] bg-[#e01b22] px-[7px] py-[2px] font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-white">{s.tiposChamado[post.chamado.tipo]}</span>
            {post.texto && <p className="mt-2 whitespace-pre-line break-words font-serif text-2xl font-semibold leading-[1.1]"><Formatado texto={post.texto} /></p>}
            <p className="mt-2 font-mono text-xs uppercase text-[#b3a584]">
              {new Date(post.chamado.quando).toLocaleString(lang, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })} · {s.pontoPublico}: {post.chamado.onde}
            </p>
            <div className="mt-3 flex flex-wrap gap-2.5">
              <button
                type="button"
                disabled={!logado}
                aria-pressed={vou.eu}
                onClick={async () => {
                  const r = await rpc<{ vou: number }>("rede_vou", { p_id: post.id, p_sim: !vou.eu }).catch(() => null);
                  if (r) setVou({ n: r.vou, eu: !vou.eu });
                }}
                className={`${pilula} ${vou.eu ? "bg-[#c21f16] text-white" : "bg-[#f4ecd8] text-[#1f1a14]"}`}
              >
                {s.vou} · {vou.n}
              </button>
            </div>
          </div>
        ) : (
          <>
            {post.texto && <p className="mt-1.5 whitespace-pre-line break-words font-sans text-base leading-normal"><Formatado texto={post.texto} /></p>}
            {cita && (
              <L href={cita.caminho} className="mt-2.5 flex items-center gap-3 rounded-xl border-[1.5px] border-ink bg-parchment p-3 text-ink no-underline hover:text-ink">
                <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[7px] bg-ink font-sans text-base font-extrabold text-parchment">{cita.tipo === "aula" ? "A" : cita.tipo === "obra" ? "O" : "J"}</span>
                <span className="min-w-0">
                  <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-[#c21f16]">{cita.tipo === "aula" ? s.aulaCitada : cita.tipo === "obra" ? s.obraCitada : s.materiaCitada}</span>
                  <span className="block truncate font-serif text-lg font-semibold">{cita.titulo}</span>
                </span>
              </L>
            )}
            {post.chamado && (
              <p className="mt-2 rounded-lg border border-rule px-3 py-2 font-mono text-xs uppercase">
                {s.tiposChamado[post.chamado.tipo]} · {new Date(post.chamado.quando).toLocaleString(lang, { weekday: "short", hour: "2-digit", minute: "2-digit" })} · {post.chamado.onde}
              </p>
            )}
            {post.original && (
              <div className="mt-2">
                <CartaoDoPost post={post.original} s={s} logado={logado} mudou={mudou} abrirFio={abrirFio} abrirPerfil={abrirPerfil} abrirComunidade={abrirComunidade} nomeDaComunidade={nomeDaComunidade} embutido />
              </div>
            )}
          </>
        )}
        {!embutido && (
          <div className={`mt-2.5 flex flex-wrap gap-x-[26px] gap-y-1 font-sans text-[13px] ${escuro ? "text-[#b3a584]" : "text-ink-soft"}`}>
            <button type="button" className={acaoClasse} onClick={() => abrirFio(post.id)}>{s.responder} · {post.respostas}</button>
            {post.alcance === "publico" && <button type="button" className={acaoClasse} disabled={!logado} onClick={() => setRepostando(!repostando)}>{s.repostar}</button>}
            <button
              type="button"
              className={`${acaoClasse} ${apoios.eu ? "font-bold text-[#c21f16]" : ""}`}
              disabled={!logado}
              aria-pressed={apoios.eu}
              onClick={async () => {
                const sim = !apoios.eu;
                setApoios({ n: apoios.n + (sim ? 1 : -1), eu: sim });
                await rpc("rede_apoiar", { p_id: post.id, p_sim: sim }).catch(() => setApoios(apoios));
              }}
            >
              {s.apoiar} · {apoios.n}
            </button>
            <button
              type="button"
              className={acaoClasse}
              onClick={async () => {
                // Para levar ao grupo do núcleo: o link do post, pronto para colar.
                const url = `${window.location.origin}/${lang}/comunidade?post=${post.id}`;
                await navigator.clipboard.writeText(url).then(() => setRecado(s.levado), () => setRecado(url));
              }}
            >
              {s.levarNucleo}
            </button>
            {equipe && post.texto && (
              <button
                type="button"
                className={acaoClasse}
                onClick={async () => {
                  await rpc("pauta_salvar", { p_id: null, p: { titulo: post.texto.slice(0, 160), descricao: `Da Rede Lúcia, post de ${post.autor.nome}.`, tipo: post.cita?.tipo === "aula" ? "aula" : "jornal" } })
                    .then(() => setRecado(s.pautaFeita), () => setRecado(s.erro));
                }}
              >
                {s.virarPauta}
              </button>
            )}
            {post.modero && !post.meu && <button type="button" className={acaoClasse} onClick={async () => { await rpc("rede_moderar", { p_id: post.id, p_ocultar: true }).catch(() => undefined); mudou(); }}>{s.ocultar}</button>}
            {post.meu ? (
              <button type="button" className={acaoClasse} onClick={async () => { await rpc("rede_apagar", { p_id: post.id }).catch(() => undefined); mudou(); }}>{s.apagar}</button>
            ) : (
              <button type="button" className={acaoClasse} onClick={() => setDenunciando(!denunciando)}>{s.denunciar}</button>
            )}
          </div>
        )}
        {recado && <p className={`mt-1 font-sans text-xs ${suave}`} role="status">{recado}</p>}
        {repostando && (
          <div className="mt-2 text-ink">
            <Escrever s={s} logado={logado} equipe={false} comunidade={null} nomeDaComunidade={nomeDaComunidade} postou={mudou} lang={lang} repostando={post} cancelar={() => setRepostando(false)} />
          </div>
        )}
        {denunciando && <Denunciar post={post} s={s} fechar={() => setDenunciando(false)} />}
      </div>
    </article>
  );
}

function Denunciar({ post, s, fechar }: { post: Post; s: Textos; fechar: () => void }) {
  const [motivo, setMotivo] = useState("");
  const [detalhes, setDetalhes] = useState("");
  const [feito, setFeito] = useState("");
  return (
    <form
      className="mt-2 space-y-2 rounded-xl border-[1.5px] border-ink bg-parchment p-3 font-sans text-sm text-ink"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await rpc("denunciar", { p_alvo: `/comunidade?post=${post.id}`, p_motivo: motivo, p_detalhes: detalhes, p_site: "" });
          setFeito(s.denunciaFeita);
        } catch {
          setFeito(s.erro);
        }
      }}
    >
      <p className="font-semibold">{s.denunciaTitulo}</p>
      {feito ? (
        <p>{feito} <button type="button" className="underline" onClick={fechar}>{s.cancelar}</button></p>
      ) : (
        <>
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={80} placeholder={s.denunciaMotivo} aria-label={s.denunciaMotivo} className="w-full rounded-md border border-rule bg-folha px-2 py-1" />
          <textarea value={detalhes} onChange={(e) => setDetalhes(e.target.value)} maxLength={4000} rows={3} placeholder={s.denunciaDetalhes} aria-label={s.denunciaDetalhes} className="w-full rounded-md border border-rule bg-folha px-2 py-1" />
          <p className="flex gap-2">
            <button type="submit" disabled={motivo.trim().length < 2 || detalhes.trim().length < 20} className={`${pilula} bg-ink py-1.5 text-parchment`}>{s.denunciaEnviar}</button>
            <button type="button" className="cursor-pointer underline" onClick={fechar}>{s.cancelar}</button>
          </p>
        </>
      )}
    </form>
  );
}

/** O fio de um post: o post, a resposta e as respostas, em ordem de chegada. O voltar fica no alto do meio. */
function Fio({ id, s, logado, abrirPerfil, abrirFio }: { id: string; s: Textos; logado: boolean; abrirPerfil: (id: string) => void; abrirFio: (id: string) => void }) {
  const { lang, t } = useI18n();
  const [dados, setDados] = useState<{ post: Post; respostas: Post[] } | null>(null);
  const [erro, setErro] = useState("");
  const [versao, setVersao] = useState(0);
  useEffect(() => {
    rpc<{ post: Post; respostas: Post[] }>("rede_post_ver", { p_id: id }).then(setDados).catch(() => setErro(s.erro));
  }, [id, versao, s.erro]);
  const nomeDaComunidade = (slug: string) => (s.lutasLista as Record<string, string>)[slug] ?? (t.areas as Record<string, string[]>)[slug]?.[0] ?? slug;
  const nada = () => undefined;
  return (
    <div>
      {erro && <p className="px-[18px] py-4 text-oxblood">{erro}</p>}
      {dados && (
        <>
          <CartaoDoPost post={dados.post} s={s} logado={logado} mudou={() => setVersao((v) => v + 1)} abrirFio={nada} abrirPerfil={abrirPerfil} abrirComunidade={nada} nomeDaComunidade={nomeDaComunidade} />
          <div className="border-b border-rule px-[18px] py-3">
            <Escrever s={s} logado={logado} equipe={false} comunidade={null} nomeDaComunidade={nomeDaComunidade} postou={() => setVersao((v) => v + 1)} lang={lang} respondendo={dados.post} />
          </div>
          <p className="border-b border-rule bg-parchment-deep px-[18px] py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">{s.fio} · {dados.respostas.length}</p>
          <ul className="border-l-4 border-rule">
            {dados.respostas.map((r) => (
              <li key={r.id}>
                <CartaoDoPost post={r} s={s} logado={logado} mudou={() => setVersao((v) => v + 1)} abrirFio={abrirFio} abrirPerfil={abrirPerfil} abrirComunidade={nada} nomeDaComunidade={nomeDaComunidade} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function CabecaDoPerfil({ id, s, logado, mudou }: { id: string; s: Textos; logado: boolean; mudou: () => void }) {
  const [p, setP] = useState<Perfil | null>(null);
  const [versao, setVersao] = useState(0);
  const [invisivel, setInvisivel] = useState(false);
  useEffect(() => {
    rpc<Perfil>("rede_perfil", { p_usuario: id }).then((r) => { setP(r); setInvisivel(r.invisivel); }).catch(() => undefined);
  }, [id, versao]);
  if (!p) return null;
  if (p.invisivel && !p.eu) return <p className="border-b border-rule bg-folha px-[18px] py-4 font-sans">{p.nome} · {s.invisivel}</p>;
  const fazer = async (funcao: string, args: Record<string, unknown>) => {
    await rpc(funcao, args).catch(() => undefined);
    setVersao((v) => v + 1);
    mudou();
  };
  return (
    <div className="border-b border-rule bg-folha px-[18px] py-5">
      <div className="flex items-start gap-3">
        <Rosto autor={{ id: p.id ?? id, nome: p.nome }} tamanho="h-16 w-16 text-lg" />
        <div className="min-w-0 flex-1">
          <p className="font-serif text-[1.7rem] font-semibold leading-tight">{p.nome}</p>
          <p className="font-sans text-xs text-ink-soft">{[p.equipe ? s.daEquipe : "", p.me_segue ? s.meSegue : ""].filter(Boolean).join(" · ")}</p>
          {p.bio && <p className="mt-1.5 whitespace-pre-line font-sans text-sm" data-original>{p.bio}</p>}
        </div>
      </div>
      {logado && !p.eu && (
        <p className="mt-3 flex flex-wrap gap-2">
          {!p.bloqueei && <button type="button" className={`${pilula} py-1.5 ${p.sigo ? "border-[1.5px] border-ink" : "bg-ink text-parchment"}`} onClick={() => void fazer("rede_seguir", { p_usuario: id, p_sim: !p.sigo })}>{p.sigo ? s.deixarDeSeguir : s.seguir}</button>}
          <button type="button" className={`${pilula} border-[1.5px] border-ink py-1.5`} onClick={() => void fazer("rede_bloquear", { p_usuario: id, p_sim: !p.bloqueei })}>{p.bloqueei ? s.desbloquear : s.bloquear}</button>
        </p>
      )}
      {p.eu && (
        <label className="mt-3 flex items-start gap-2 font-sans text-sm">
          <input type="checkbox" checked={invisivel} onChange={async (e) => { setInvisivel(e.target.checked); await rpc("rede_config", { p_invisivel: e.target.checked }).catch(() => undefined); }} className="mt-1" />
          <span><strong>{s.perfilInvisivel}</strong>. {s.perfilInvisivelAjuda}</span>
        </label>
      )}
    </div>
  );
}

/** À direita: os próximos chamados à ação, no cartão preto com a sombra vermelha do desenho. */
function ProximosChamados({ s, abrirFio }: { s: Textos; abrirFio: (id: string) => void }) {
  const { lang } = useI18n();
  const [lista, setLista] = useState<Post[] | null>(null);
  useEffect(() => {
    if (!hasBackend) return;
    rpc<Post[]>("rede_linha", { p_modo: "chamados" }).then((r) => setLista(r.slice(0, 4))).catch(() => setLista([]));
  }, []);
  return (
    <section className="rounded-[14px] bg-[#1f1a14] p-4 text-[#f4ecd8] shadow-[5px_5px_0_#c21f16]">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#e0837a]">{s.proximos}</p>
      {lista && lista.length === 0 && <p className="mt-2.5 font-sans text-sm text-[#b3a584]">{s.nenhumChamado}</p>}
      <ul>
        {(lista ?? []).map((p) => (
          <li key={p.id} className="mt-2.5">
            <button type="button" onClick={() => abrirFio(p.id)} className="block w-full cursor-pointer text-left">
              <span className="block font-sans font-bold">{p.texto.slice(0, 60) || s.tiposChamado[p.chamado!.tipo]}</span>
              <span className="mt-0.5 block font-mono text-[11px] uppercase text-[#b3a584]">
                {new Date(p.chamado!.quando).toLocaleString(lang, { weekday: "short", hour: "2-digit", minute: "2-digit" })} · {p.chamado!.onde.slice(0, 40)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** À direita: a segurança de quem participa, com o registro público de moderação, palavras silenciadas e baixar posts. */
function Seguranca({ s, logado, silenciadas, silenciar }: { s: Textos; logado: boolean; silenciadas: string[]; silenciar: (lista: string[]) => void }) {
  const [registro, setRegistro] = useState<{ semana: string; ocultados: number; banimentos: number }[] | null>(null);
  const [palavras, setPalavras] = useState(silenciadas.join(", "));
  async function baixar() {
    const posts = await rpc<unknown[]>("rede_meus_posts").catch(() => []);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([JSON.stringify(posts, null, 2)], { type: "application/json" }));
    link.download = "rede-lucia-meus-posts.json";
    link.click();
    URL.revokeObjectURL(link.href);
  }
  return (
    <section className="rounded-[14px] border-[1.5px] border-dashed border-ink bg-folha p-4 font-sans">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#2f5d34]">{s.seguranca}</p>
      <p className="mt-2 text-[13.5px] leading-normal">{s.segurancaTexto}</p>
      <details
        className="mt-3 text-[13px]"
        onToggle={(e) => {
          if (e.currentTarget.open && !registro) void rpc<typeof registro>("rede_moderacao_publica").then(setRegistro).catch(() => setRegistro([]));
        }}
      >
        <summary className="cursor-pointer font-bold">{s.moderacao}</summary>
        <p className="mt-1 text-xs text-ink-soft">{s.moderacaoTexto}</p>
        <ul className="mt-1 text-xs">
          {(registro ?? []).map((r) => (
            <li key={r.semana}>{new Date(`${r.semana}T12:00:00`).toLocaleDateString()}: {r.ocultados} {s.ocultados} · {r.banimentos} {s.banidas}</li>
          ))}
        </ul>
      </details>
      <details className="mt-2 text-[13px]">
        <summary className="cursor-pointer font-bold">{s.silenciar}</summary>
        <p className="mt-1 text-xs text-ink-soft">{s.silenciarAjuda}</p>
        <input value={palavras} onChange={(e) => setPalavras(e.target.value)} onBlur={() => silenciar(palavras.split(",").map((p) => p.trim().toLowerCase()).filter(Boolean))} className="mt-1 w-full rounded-md border border-rule bg-parchment px-2 py-1 text-xs" aria-label={s.silenciar} />
      </details>
      {logado && <button type="button" className="mt-2 cursor-pointer text-[13px] font-bold text-oxblood hover:underline" onClick={() => void baixar()}>{s.baixar}</button>}
    </section>
  );
}
