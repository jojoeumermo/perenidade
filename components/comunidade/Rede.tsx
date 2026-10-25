// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dict } from "@/i18n/types";
import { BackendError, hasBackend, rpc, useMe } from "@/lib/backend";
import { L, useI18n } from "../I18n";
import { Formatado } from "../painel/Formatado";

// A Rede Lúcia (gatilho "Rede Lúcia"): a linha do tempo de posts curtos da Comunidade, ao lado do fórum. Em ordem de
// tempo, sem algoritmo e sem contagem de seguidores; com fio, repost com comentário, citação de aula, obra ou matéria,
// chamados à ação com "Eu vou", seguir, bloquear, alcance por post, aviso de conteúdo e perfil invisível. O banco está
// em supabase/install.sql, "Rede Lúcia".

type Textos = Dict["rede"];
type Modo = "tudo" | "seguindo" | "chamados" | "comunidade" | "perfil";

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
  meu: boolean;
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

/** As comunidades de luta e organização (as das disciplinas vêm das estantes). */
export const LUTAS = ["moradia", "trabalho", "antirracismo", "feminismo", "lgbt", "terra", "quebrada", "educacao-publica", "saude-publica"] as const;

const iniciais = (nome: string) => nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
const corDe = (id: string) => {
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

export function Rede({ s }: { s: Textos }) {
  const { lang, t } = useI18n();
  const me = useMe();
  const logado = me.status === "in";
  const [modo, setModo] = useState<Modo>("tudo");
  const [comunidade, setComunidade] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<string | null>(null);
  const [fio, setFio] = useState<string | null>(() => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("post")));
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [novos, setNovos] = useState(0);
  const [versao, setVersao] = useState(0);
  const carregadoEm = useRef(new Date().toISOString());
  const recarregar = useCallback(() => setVersao((v) => v + 1), []);
  const nomeDaComunidade = (slug: string) => (s.lutasLista as Record<string, string>)[slug] ?? (t.areas as Record<string, string[]>)[slug]?.[0] ?? slug;

  useEffect(() => {
    if (!hasBackend || fio) return;
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
    if (!hasBackend || fio || modo === "perfil") return;
    const relogio = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void rpc<number>("rede_novos", { p_desde: carregadoEm.current }).then((n) => setNovos(typeof n === "number" ? n : 0)).catch(() => undefined);
    }, 30000);
    return () => window.clearInterval(relogio);
  }, [fio, modo]);

  const abrir = (proximo: Modo, extra?: { comunidade?: string; perfil?: string }) => {
    setFio(null);
    setModo(proximo);
    setComunidade(extra?.comunidade ?? null);
    setPerfil(extra?.perfil ?? null);
    setPosts(null);
  };
  const vistos = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return termo ? (posts ?? []).filter((p) => `${p.texto} ${p.autor.nome}`.toLowerCase().includes(termo)) : (posts ?? []);
  }, [posts, busca]);

  const menu: [Modo, string][] = [["tudo", s.tudo], ["seguindo", s.seguindo], ["chamados", s.chamados]];

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] xl:grid-cols-[13rem_minmax(0,1fr)_18rem]">
      {/* À esquerda: o menu da rede e as comunidades. */}
      <nav aria-label={s.nome} className="lg:sticky lg:top-24 lg:self-start">
        <p className="font-serif text-xl font-semibold leading-none">{s.nome}</p>
        <p className="mt-1 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-ink-soft">{s.sub}</p>
        <ul className="mt-4 flex flex-wrap gap-1 lg:flex-col">
          {menu.map(([id, nome]) => (
            <li key={id}>
              <button type="button" onClick={() => abrir(id)} aria-pressed={modo === id && !fio} disabled={id === "seguindo" && !logado} className={`w-full cursor-pointer rounded-full px-3 py-2 text-left font-sans text-[0.95rem] font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${modo === id && !fio ? "bg-ink text-parchment" : "hover:bg-parchment-deep"}`}>
                {nome}
              </button>
            </li>
          ))}
          {logado && me.status === "in" && (
            <li>
              <button type="button" onClick={() => abrir("perfil", { perfil: me.me.id })} aria-pressed={modo === "perfil" && perfil === me.me.id} className={`w-full cursor-pointer rounded-full px-3 py-2 text-left font-sans text-[0.95rem] font-semibold ${modo === "perfil" && perfil === me.me.id ? "bg-ink text-parchment" : "hover:bg-parchment-deep"}`}>
                {s.perfil}
              </button>
            </li>
          )}
        </ul>
        <p className="mt-5 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-ink-soft">{s.lutas}</p>
        <ul className="mt-1.5 flex flex-wrap gap-1 lg:flex-col">
          {LUTAS.map((slug) => (
            <li key={slug}>
              <button type="button" onClick={() => abrir("comunidade", { comunidade: slug })} aria-pressed={modo === "comunidade" && comunidade === slug} className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-left font-sans text-sm ${modo === "comunidade" && comunidade === slug ? "bg-parchment-deep font-semibold" : "hover:bg-parchment-deep"}`}>
                <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[0.68rem] font-extrabold text-white" style={{ backgroundColor: corDe(slug) }}>{nomeDaComunidade(slug)[0]}</span>
                {nomeDaComunidade(slug)}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* No meio: escrever e a linha do tempo, ou o fio de um post, ou um perfil. */}
      <section className="min-w-0">
        {fio ? (
          <Fio id={fio} s={s} logado={logado} voltar={() => { setFio(null); recarregar(); }} abrirPerfil={(id) => abrir("perfil", { perfil: id })} abrirFio={setFio} />
        ) : (
          <>
            {modo === "perfil" && perfil && <CabecaDoPerfil id={perfil} s={s} logado={logado} mudou={recarregar} />}
            {modo === "comunidade" && comunidade && <h2 className="mb-3 font-serif text-2xl font-semibold">{nomeDaComunidade(comunidade)}</h2>}
            {modo !== "perfil" && <Escrever key={comunidade ?? "geral"} s={s} logado={logado} equipe={logado && me.status === "in" && me.me.papeis.length > 0} comunidade={comunidade} nomeDaComunidade={nomeDaComunidade} postou={recarregar} lang={lang} />}
            <p className="mt-4 border-b-2 border-ink pb-2 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-ink-soft">{s.regua}</p>
            {novos > 0 && (
              <button type="button" onClick={recarregar} className="mt-2 w-full cursor-pointer rounded-full bg-[#c21f16] px-4 py-2 font-sans text-sm font-bold text-white">
                {s.novos.replace("{n}", String(novos))}
              </button>
            )}
            {erro && <p className="mt-3 text-oxblood" role="alert">{erro}</p>}
            {posts === null && !erro && <p className="mt-4 text-ink-soft">…</p>}
            {posts && vistos.length === 0 && <p className="mt-6 text-ink-soft">{modo === "seguindo" ? s.vazioSeguindo : s.vazio}</p>}
            <ul className="mt-1">
              {vistos.map((post) => (
                <li key={post.id} className="border-b border-rule">
                  <CartaoDoPost post={post} s={s} logado={logado} mudou={recarregar} abrirFio={setFio} abrirPerfil={(id) => abrir("perfil", { perfil: id })} abrirComunidade={(c) => abrir("comunidade", { comunidade: c })} nomeDaComunidade={nomeDaComunidade} />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* À direita: busca, próximos chamados e segurança. */}
      <aside className="hidden space-y-5 xl:block xl:sticky xl:top-24 xl:self-start">
        <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={s.buscar} aria-label={s.buscar} className="w-full rounded-full border-2 border-ink bg-folha px-4 py-2 font-sans text-sm" />
        <ProximosChamados s={s} abrirFio={setFio} />
        <Seguranca s={s} logado={logado} />
      </aside>
    </div>
  );
}

function Escrever({ s, logado, equipe, comunidade, nomeDaComunidade, postou, lang, respondendo, repostando, cancelar }: {
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
}) {
  const [texto, setTexto] = useState("");
  const [alcance, setAlcance] = useState<Post["alcance"]>("publico");
  const [aviso, setAviso] = useState<string | null>(null);
  const [cita, setCita] = useState<string | null>(null);
  const [chamado, setChamado] = useState<{ tipo: string; quando: string; onde: string } | null>(null);
  const [onde, setOnde] = useState(comunidade ?? "");
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [idade, setIdade] = useState(false);

  if (!logado) {
    return (
      <p className="border-2 border-ink bg-folha p-4 font-sans text-sm">
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

  return (
    <div className="border-2 border-ink bg-folha p-4">
      {respondendo && <p className="mb-2 font-sans text-xs text-ink-soft">{s.respondendo} <strong>{respondendo.autor.nome}</strong></p>}
      {repostando && <p className="mb-2 font-sans text-xs text-ink-soft">{s.repostando}</p>}
      <label className="block">
        <span className="sr-only">{s.escrever}</span>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={500} rows={respondendo ? 2 : 3} placeholder={s.placeholder} className="w-full resize-y bg-transparent font-serif text-lg outline-none placeholder:text-ink-soft" />
      </label>
      {repostando && (
        <div className="mb-2 border-l-4 border-rule pl-3 text-sm text-ink-soft">
          <strong>{repostando.autor.nome}</strong>: {repostando.texto.slice(0, 160)}
        </div>
      )}
      {aviso !== null && (
        <label className="mt-1 block font-sans text-xs">
          {s.aviso}
          <input value={aviso} onChange={(e) => setAviso(e.target.value)} maxLength={80} placeholder={s.avisoAjuda} className="mt-1 w-full border border-rule bg-parchment px-2 py-1 text-sm" />
        </label>
      )}
      {cita !== null && (
        <label className="mt-2 block font-sans text-xs">
          {s.citarAula}
          <input value={cita} onChange={(e) => setCita(e.target.value)} placeholder={`https://institutolucia.org/${lang}/trilhas/…`} className="mt-1 w-full border border-rule bg-parchment px-2 py-1 font-mono text-xs" />
          <span className="text-ink-soft">{s.citarAjuda}</span>
        </label>
      )}
      {chamado && (
        <div className="mt-2 grid gap-2 font-sans text-xs sm:grid-cols-[10rem_12rem_minmax(0,1fr)]">
          <label>
            {s.chamado}
            <select value={chamado.tipo} onChange={(e) => setChamado({ ...chamado, tipo: e.target.value })} className="mt-1 w-full border border-rule bg-parchment px-2 py-1 text-sm">
              {Object.entries(s.tiposChamado).map(([id, nome]) => (
                <option key={id} value={id}>{nome}</option>
              ))}
            </select>
          </label>
          <label>
            {s.quando}
            <input type="datetime-local" value={chamado.quando} onChange={(e) => setChamado({ ...chamado, quando: e.target.value })} className="mt-1 w-full border border-rule bg-parchment px-2 py-1 text-sm" />
          </label>
          <label>
            {s.onde}
            <input value={chamado.onde} onChange={(e) => setChamado({ ...chamado, onde: e.target.value })} maxLength={160} className="mt-1 w-full border border-rule bg-parchment px-2 py-1 text-sm" />
            <span className="text-ink-soft">{s.ondeAjuda}</span>
          </label>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-rule pt-3 font-sans text-xs">
        {!respondendo && cita === null && <button type="button" className="cursor-pointer rounded-md bg-parchment-deep px-2 py-1 font-semibold hover:bg-rule" onClick={() => setCita("")}>+ {s.citarAula}</button>}
        {!respondendo && !chamado && <button type="button" className="cursor-pointer rounded-md bg-parchment-deep px-2 py-1 font-semibold hover:bg-rule" onClick={() => setChamado({ tipo: "ato", quando: "", onde: "" })}>+ {s.chamado}</button>}
        {aviso === null && <button type="button" className="cursor-pointer rounded-md bg-parchment-deep px-2 py-1 font-semibold hover:bg-rule" onClick={() => setAviso("")}>+ {s.aviso}</button>}
        {!respondendo && (
          <select value={onde} onChange={(e) => setOnde(e.target.value)} aria-label={s.comunidade} className="rounded-md border border-rule bg-parchment px-1.5 py-1">
            <option value="">{s.semComunidade}</option>
            {LUTAS.map((slug) => (
              <option key={slug} value={slug}>{nomeDaComunidade(slug)}</option>
            ))}
          </select>
        )}
        <select value={alcance} onChange={(e) => setAlcance(e.target.value as Post["alcance"])} aria-label={s.alcance} className="rounded-md border border-rule bg-parchment px-1.5 py-1">
          <option value="publico">{s.alcances.publico}</option>
          <option value="seguidores">{s.alcances.seguidores}</option>
          {equipe && <option value="equipe">{s.alcances.equipe}</option>}
        </select>
        <span className="ml-auto font-mono text-ink-soft">{500 - texto.length}</span>
        {cancelar && <button type="button" className="cursor-pointer px-2 py-1 underline" onClick={cancelar}>{s.cancelar}</button>}
        <button type="button" disabled={ocupado || (!texto.trim() && !repostando)} onClick={() => void postar()} className="cursor-pointer rounded-full bg-[#c21f16] px-4 py-1.5 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-40">
          {ocupado ? s.postando : s.postar}
        </button>
      </div>
      {mensagem && <p className="mt-2 font-sans text-sm text-oxblood" role="alert">{mensagem}</p>}
      {idade && (
        <div className="mt-3 border-2 border-ink bg-parchment-deep p-3 font-sans text-sm">
          <p className="font-semibold">{s.idadeTitulo}</p>
          <p className="mt-1">{s.idadeTexto}</p>
          <button
            type="button"
            className="mt-2 cursor-pointer rounded-full bg-ink px-4 py-1.5 font-bold text-parchment"
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
  );
}

function tempoDesde(iso: string, lang: string) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto", style: "short" });
  if (min < 60) return rtf.format(-min, "minute");
  if (min < 1440) return rtf.format(-Math.round(min / 60), "hour");
  return new Date(iso).toLocaleDateString(lang);
}

function CartaoDoPost({ post, s, logado, mudou, abrirFio, abrirPerfil, abrirComunidade, nomeDaComunidade, embutido = false }: {
  post: Post;
  s: Textos;
  logado: boolean;
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
  const acaoClasse = "flex cursor-pointer items-center gap-1.5 py-1 hover:text-prelo-texto disabled:cursor-not-allowed disabled:opacity-50";
  const cita = post.cita;
  return (
    <article className={`grid grid-cols-[2.75rem_minmax(0,1fr)] gap-3 ${embutido ? "rounded-lg border border-rule bg-parchment p-3" : "bg-folha px-4 py-4"} ${post.retido ? "opacity-70" : ""}`}>
      <button type="button" onClick={() => abrirPerfil(post.autor.id)} className="cursor-pointer self-start" aria-label={post.autor.nome}>
        <Rosto autor={post.autor} tamanho={embutido ? "h-8 w-8" : "h-11 w-11"} />
      </button>
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-x-1.5 font-sans text-sm">
          <button type="button" onClick={() => abrirPerfil(post.autor.id)} className="cursor-pointer font-bold hover:underline">{post.autor.nome}</button>
          {post.autor.equipe && <span className="rounded bg-ink px-1 text-[0.6rem] font-semibold uppercase tracking-wider text-parchment">{s.daEquipe}</span>}
          {post.comunidade && (
            <>
              <span className="text-ink-soft">·</span>
              <button type="button" onClick={() => abrirComunidade(post.comunidade!)} className="cursor-pointer text-ink-soft hover:underline">{nomeDaComunidade(post.comunidade)}</button>
            </>
          )}
          <span className="text-ink-soft">· {tempoDesde(post.criado_em, lang)}</span>
          {post.alcance !== "publico" && <span className="text-[0.7rem] text-ink-soft">· {s.alcances[post.alcance]}</span>}
        </p>
        {post.resposta_a && <p className="font-sans text-xs text-ink-soft">{s.respondendo} {post.resposta_a.autor}</p>}
        {post.retido && <p className="font-sans text-xs font-semibold text-oxblood">{s.retido}</p>}
        {post.aviso && !aberto ? (
          <p className="mt-1.5 flex flex-wrap items-center gap-2 rounded-md bg-parchment-deep px-3 py-2 font-sans text-sm">
            <strong>{s.aviso}:</strong> {post.aviso}
            <button type="button" className="cursor-pointer underline" onClick={() => setAberto(true)}>{s.mostrar}</button>
          </p>
        ) : (
          <>
            {post.texto && <p className="mt-1 whitespace-pre-line break-words font-serif text-[1.08rem] leading-relaxed"><Formatado texto={post.texto} /></p>}
            {cita && (
              <L href={cita.caminho} className="mt-2 flex items-center gap-3 rounded-lg border-2 border-ink bg-parchment p-2.5 text-ink hover:text-ink">
                <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#c21f16] font-sans text-sm font-extrabold text-white">{cita.tipo === "aula" ? "A" : cita.tipo === "obra" ? "O" : "J"}</span>
                <span className="min-w-0">
                  <span className="block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-ink-soft">{cita.tipo === "aula" ? s.aulaCitada : cita.tipo === "obra" ? s.obraCitada : s.materiaCitada}</span>
                  <span className="block truncate font-sans font-semibold">{cita.titulo}</span>
                </span>
              </L>
            )}
            {post.chamado && (
              <div className="mt-2 rounded-lg border-2 border-ink bg-[#f9e7a6] p-3 font-sans text-[#1f1a14]">
                <span className="rounded bg-[#c21f16] px-1.5 py-0.5 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-white">{s.tiposChamado[post.chamado.tipo]}</span>
                <p className="mt-1.5 font-mono text-[0.7rem] uppercase tracking-[0.1em]">
                  {new Date(post.chamado.quando).toLocaleString(lang, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
                </p>
                <p className="text-sm"><strong>{s.pontoPublico}:</strong> {post.chamado.onde}</p>
                <button
                  type="button"
                  disabled={!logado}
                  aria-pressed={vou.eu}
                  onClick={async () => {
                    const r = await rpc<{ vou: number }>("rede_vou", { p_id: post.id, p_sim: !vou.eu }).catch(() => null);
                    if (r) setVou({ n: r.vou, eu: !vou.eu });
                  }}
                  className={`mt-2 cursor-pointer rounded-full px-3 py-1 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50 ${vou.eu ? "bg-ink text-parchment" : "bg-[#c21f16] text-white"}`}
                >
                  {s.vou} · {vou.n}
                </button>
              </div>
            )}
            {post.original && (
              <div className="mt-2">
                <CartaoDoPost post={post.original} s={s} logado={logado} mudou={mudou} abrirFio={abrirFio} abrirPerfil={abrirPerfil} abrirComunidade={abrirComunidade} nomeDaComunidade={nomeDaComunidade} embutido />
              </div>
            )}
          </>
        )}
        {!embutido && (
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 font-sans text-[0.82rem] text-ink-soft">
            <button type="button" className={acaoClasse} onClick={() => abrirFio(post.id)}>{s.responder} · {post.respostas}</button>
            {post.alcance === "publico" && <button type="button" className={acaoClasse} disabled={!logado} onClick={() => setRepostando(!repostando)}>{s.repostar}</button>}
            <button
              type="button"
              className={`${acaoClasse} ${apoios.eu ? "font-bold text-prelo-texto" : ""}`}
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
            {post.meu ? (
              <button type="button" className={acaoClasse} onClick={async () => { await rpc("rede_apagar", { p_id: post.id }).catch(() => undefined); mudou(); }}>{s.apagar}</button>
            ) : (
              <button type="button" className={acaoClasse} onClick={() => setDenunciando(!denunciando)}>{s.denunciar}</button>
            )}
          </div>
        )}
        {repostando && (
          <div className="mt-2">
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
      className="mt-2 space-y-2 rounded-lg border-2 border-ink bg-parchment p-3 font-sans text-sm"
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
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={80} placeholder={s.denunciaMotivo} aria-label={s.denunciaMotivo} className="w-full border border-rule bg-folha px-2 py-1" />
          <textarea value={detalhes} onChange={(e) => setDetalhes(e.target.value)} maxLength={4000} rows={3} placeholder={s.denunciaDetalhes} aria-label={s.denunciaDetalhes} className="w-full border border-rule bg-folha px-2 py-1" />
          <p className="flex gap-2">
            <button type="submit" disabled={motivo.trim().length < 2 || detalhes.trim().length < 20} className="cursor-pointer rounded-full bg-ink px-3 py-1 font-bold text-parchment disabled:opacity-40">{s.denunciaEnviar}</button>
            <button type="button" className="cursor-pointer underline" onClick={fechar}>{s.cancelar}</button>
          </p>
        </>
      )}
    </form>
  );
}

function Fio({ id, s, logado, voltar, abrirPerfil, abrirFio }: { id: string; s: Textos; logado: boolean; voltar: () => void; abrirPerfil: (id: string) => void; abrirFio: (id: string) => void }) {
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
      <button type="button" className="mb-3 cursor-pointer font-sans text-sm font-bold underline" onClick={voltar}>← {s.voltar}</button>
      {erro && <p className="text-oxblood">{erro}</p>}
      {dados && (
        <>
          <div className="border-2 border-ink">
            <CartaoDoPost post={dados.post} s={s} logado={logado} mudou={() => setVersao((v) => v + 1)} abrirFio={nada} abrirPerfil={abrirPerfil} abrirComunidade={nada} nomeDaComunidade={nomeDaComunidade} />
          </div>
          <div className="mt-3">
            <Escrever s={s} logado={logado} equipe={false} comunidade={null} nomeDaComunidade={nomeDaComunidade} postou={() => setVersao((v) => v + 1)} lang={lang} respondendo={dados.post} />
          </div>
          <p className="mt-4 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-ink-soft">{s.fio} · {dados.respostas.length}</p>
          <ul className="mt-1 border-l-4 border-rule pl-3">
            {dados.respostas.map((r) => (
              <li key={r.id} className="border-b border-rule">
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
  if (p.invisivel && !p.eu) return <p className="mb-4 border-2 border-ink bg-folha p-4 font-sans">{p.nome} · {s.invisivel}</p>;
  const fazer = async (funcao: string, args: Record<string, unknown>) => {
    await rpc(funcao, args).catch(() => undefined);
    setVersao((v) => v + 1);
    mudou();
  };
  return (
    <div className="mb-4 border-2 border-ink bg-folha p-4">
      <div className="flex items-start gap-3">
        <Rosto autor={{ id: p.id ?? id, nome: p.nome }} tamanho="h-14 w-14" />
        <div className="min-w-0 flex-1">
          <p className="font-serif text-2xl font-semibold leading-tight">{p.nome}</p>
          <p className="font-sans text-xs text-ink-soft">{[p.equipe ? s.daEquipe : "", p.me_segue ? s.meSegue : ""].filter(Boolean).join(" · ")}</p>
          {p.bio && <p className="mt-1 whitespace-pre-line font-sans text-sm" data-original>{p.bio}</p>}
        </div>
      </div>
      {logado && !p.eu && (
        <p className="mt-3 flex flex-wrap gap-2 font-sans text-sm">
          {!p.bloqueei && <button type="button" className={`cursor-pointer rounded-full px-4 py-1.5 font-bold ${p.sigo ? "border-2 border-ink" : "bg-ink text-parchment"}`} onClick={() => void fazer("rede_seguir", { p_usuario: id, p_sim: !p.sigo })}>{p.sigo ? s.deixarDeSeguir : s.seguir}</button>}
          <button type="button" className="cursor-pointer rounded-full border-2 border-ink px-4 py-1.5 font-bold" onClick={() => void fazer("rede_bloquear", { p_usuario: id, p_sim: !p.bloqueei })}>{p.bloqueei ? s.desbloquear : s.bloquear}</button>
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

function ProximosChamados({ s, abrirFio }: { s: Textos; abrirFio: (id: string) => void }) {
  const { lang } = useI18n();
  const [lista, setLista] = useState<Post[] | null>(null);
  useEffect(() => {
    if (!hasBackend) return;
    rpc<Post[]>("rede_linha", { p_modo: "chamados" }).then((r) => setLista(r.slice(0, 4))).catch(() => setLista([]));
  }, []);
  return (
    <section className="border-2 border-ink bg-[#1f1a14] p-4 text-[#f4ecd8]">
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-[#e0837a]">{s.proximos}</p>
      {lista && lista.length === 0 && <p className="mt-2 font-sans text-sm text-[#cdbb91]">{s.nenhumChamado}</p>}
      <ul className="mt-2 space-y-2">
        {(lista ?? []).map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => abrirFio(p.id)} className="block w-full cursor-pointer text-left">
              <span className="block font-sans text-sm font-bold">{p.texto.slice(0, 60) || s.tiposChamado[p.chamado!.tipo]}</span>
              <span className="block font-mono text-[0.62rem] uppercase tracking-[0.1em] text-[#cdbb91]">
                {new Date(p.chamado!.quando).toLocaleString(lang, { weekday: "short", hour: "2-digit", minute: "2-digit" })} · {p.chamado!.onde.slice(0, 40)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Seguranca({ s }: { s: Textos; logado: boolean }) {
  const [registro, setRegistro] = useState<{ semana: string; ocultados: number; banimentos: number }[] | null>(null);
  return (
    <section className="border-2 border-dashed border-ink bg-parchment p-4 font-sans text-sm">
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-ink-soft">{s.seguranca}</p>
      <p className="mt-1.5 leading-snug">{s.segurancaTexto}</p>
      <details
        className="mt-3"
        onToggle={(e) => {
          if (e.currentTarget.open && !registro) void rpc<typeof registro>("rede_moderacao_publica").then(setRegistro).catch(() => setRegistro([]));
        }}
      >
        <summary className="cursor-pointer font-semibold">{s.moderacao}</summary>
        <p className="mt-1 text-xs text-ink-soft">{s.moderacaoTexto}</p>
        <ul className="mt-1 text-xs">
          {(registro ?? []).map((r) => (
            <li key={r.semana}>{new Date(`${r.semana}T12:00:00`).toLocaleDateString()}: {r.ocultados} {s.ocultados} · {r.banimentos} {s.banidas}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
