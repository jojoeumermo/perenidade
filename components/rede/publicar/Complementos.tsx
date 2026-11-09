// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { rede } from "@/lib/rede/cliente";
import { redePub } from "@/lib/rede/cliente-publicar";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { TextosPublicar } from "@/lib/rede/textos-publicar";
import type { MidiaDoPost, Post } from "@/lib/rede/tipos";
import type { DetalhesDoPost, EdicaoAnterior, EnqueteDoPost } from "@/lib/rede/tipos-publicar";
import { textoDoErro } from "../erros";
import { enderecoDaMidia } from "./api";
import { detalhesDe, invalidar, publicarVencidosUmaVez } from "./detalhes";
import { textoDoErroPublicar, useTextosPublicar } from "./textos";
import { useAlumia2 } from "./alumia2/contexto";
import { EnqueteDaAlumia2 } from "./alumia2/EnqueteDaAlumia2";

const codigoDe = (e: unknown) => (typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : "falha");
const quando = (iso: string, lang: string) => {
  try {
    return new Intl.DateTimeFormat(lang, { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
};
const botao = "min-h-11 cursor-pointer rounded-full border-[1.5px] border-ink px-4 font-sans text-sm font-bold hover:bg-parchment-deep disabled:cursor-not-allowed disabled:opacity-50";

/** Uma imagem do post: o endereço assinado é pedido só quando o cartão aparece; sem ele, o texto alternativo fica no lugar. */
function ImagemDoPost({ m, n, total, t }: { m: MidiaDoPost; n: number; total: number; t: TextosPublicar }) {
  const [url, setUrl] = useState("");
  const [falhou, setFalhou] = useState(false);
  useEffect(() => {
    let vivo = true;
    enderecoDaMidia(m.id).then(
      (u) => vivo && setUrl(u),
      () => vivo && setFalhou(true),
    );
    return () => {
      vivo = false;
    };
  }, [m.id]);
  const proporcao = m.largura && m.altura ? { aspectRatio: `${m.largura} / ${m.altura}` } : { aspectRatio: "4 / 3" };
  return (
    <figure className="m-0 overflow-hidden rounded-lg border border-rule bg-parchment-deep" style={proporcao}>
      {url ? (
        // Imagem do depósito privado (endereço assinado): o next/image não otimiza esse endereço.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={m.alt || preencher(t.imagens.ver, { n: n + 1, total })} loading="lazy" decoding="async" width={m.largura ?? undefined} height={m.altura ?? undefined} className="h-full w-full object-cover" onError={() => setFalhou(true)} />
      ) : (
        <figcaption className="flex h-full items-center justify-center p-2 text-center text-sm text-ink-soft">{falhou ? m.alt || t.imagens.semAcesso : m.alt || t.audio.carregando}</figcaption>
      )}
    </figure>
  );
}

function AudioDoPost({ id, duracao, t }: { id: string; duracao: number; t: TextosPublicar }) {
  const [url, setUrl] = useState("");
  const [estado, setEstado] = useState<"parado" | "carregando" | "falhou">("parado");
  if (url)
    return (
      <audio controls autoPlay src={url} className="mt-2 h-11 w-full max-w-sm" />
    );
  return (
    <div className="mt-2">
      <button
        type="button"
        className={botao}
        disabled={estado === "carregando"}
        onClick={() => {
          setEstado("carregando");
          enderecoDaMidia(id).then(setUrl, () => setEstado("falhou"));
        }}
      >
        {estado === "carregando" ? t.audio.carregando : preencher(t.audio.ouvir, { s: duracao })}
      </button>
      {estado === "falhou" && <p role="alert" className="text-sm text-oxblood">{t.audio.falha}</p>}
    </div>
  );
}

/** A enquete: votar (voto secreto, só uma vez) e os totais para quem pode vê-los. */
function EnqueteDoPost({ post, inicial, t, lang, logado, s }: { post: Post; inicial: EnqueteDoPost; t: TextosPublicar; lang: string; logado: boolean; s: TextosDaRede }) {
  const [e, setE] = useState(inicial);
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const jaVotei = e.votei.length > 0;
  const mostra = e.opcoes.some((o) => o.votos !== null && o.votos !== undefined);
  const total = Math.max(1, e.total ?? 0);
  const podeVotar = logado && !e.encerrada && !jaVotei;

  async function votar() {
    if (!marcadas.length || ocupado) return;
    setOcupado(true);
    setErro("");
    try {
      setE(await redePub.votar(post.id, marcadas));
      invalidar(post.id);
    } catch (x) {
      const c = codigoDe(x);
      setErro(textoDoErroPublicar(t, c) ?? textoDoErro(s, x));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <fieldset className="mt-2 rounded-lg border border-rule bg-folha p-3">
      <legend className="px-1 text-sm font-bold">{t.enquete.rotulo}</legend>
      <ul className="space-y-2">
        {e.opcoes.map((o) => {
          const votos = o.votos ?? null;
          const pct = votos === null ? 0 : Math.round((votos / total) * 100);
          return (
            <li key={o.id}>
              {podeVotar ? (
                <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                  <input
                    type={e.multipla ? "checkbox" : "radio"}
                    name={`enquete-${post.id}`}
                    checked={marcadas.includes(o.id)}
                    onChange={(ev) => setMarcadas((m) => (e.multipla ? (ev.target.checked ? [...m, o.id] : m.filter((x) => x !== o.id)) : [o.id]))}
                  />
                  {o.texto}
                </label>
              ) : (
                <div className="text-sm">
                  <div className="flex justify-between gap-2">
                    <span className={e.votei.includes(o.id) ? "font-bold" : ""}>{o.texto}</span>
                    {votos !== null && <span>{votos === 1 ? t.enquete.voto : preencher(t.enquete.votos, { n: votos })} ({pct}%)</span>}
                  </div>
                  {votos !== null && (
                    <div className="mt-1 h-2 overflow-hidden rounded bg-parchment-deep" aria-hidden="true">
                      <div className="h-full bg-[#c21f16]" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {podeVotar && (
        <button type="button" className={`${botao} mt-2`} disabled={!marcadas.length || ocupado} onClick={() => void votar()}>
          {t.enquete.votar}
        </button>
      )}
      <p className="mt-2 text-xs text-ink-soft" role="status">
        {jaVotei && t.enquete.votou} {e.encerrada ? t.enquete.encerrada : preencher(t.enquete.termina, { quando: quando(e.prazo, lang) })}
        {podeVotar && !mostra && ` ${t.enquete.depois}`}
        {` ${t.enquete.secreto}`}
      </p>
      {erro && <p role="alert" className="text-sm text-oxblood">{erro}</p>}
    </fieldset>
  );
}

/** O editor do próprio post: 15 minutos sem marca; depois, "editado" e o texto anterior fica visível. */
function Editor({ post, t, s, janela, aoSalvar, aoFechar }: { post: Post; t: TextosPublicar; s: TextosDaRede; janela: boolean; aoSalvar: (p: Post) => void; aoFechar: () => void }) {
  const longo = post.tipo === "discussao" || post.tipo === "duvida";
  const [titulo, setTitulo] = useState(post.titulo ?? "");
  const [texto, setTexto] = useState(longo ? (post.corpo ?? "") : post.texto);
  const [pronto, setPronto] = useState(!longo || post.corpo !== null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    if (pronto) return;
    let vivo = true;
    // O corpo inteiro só vem na página do post: busca quando a pessoa abre o editor.
    rede.post(post.id).then(
      (r) => {
        if (!vivo) return;
        setTitulo(r.post.titulo ?? "");
        setTexto(r.post.corpo ?? r.post.texto);
        setPronto(true);
      },
      (x) => vivo && setErro(textoDoErro(s, x)),
    );
    return () => {
      vivo = false;
    };
  }, [pronto, post.id, s]);

  async function salvar() {
    setOcupado(true);
    setErro("");
    try {
      const novo = await redePub.editar(post.id, longo ? { titulo: titulo.trim(), corpo: texto.trim() } : { texto: texto.trim() });
      invalidar(post.id);
      aoSalvar(novo);
      if (novo.retido) return setAviso(t.editar.retido);
      aoFechar();
    } catch (x) {
      setErro(textoDoErroPublicar(t, codigoDe(x)) ?? textoDoErro(s, x));
    } finally {
      setOcupado(false);
    }
  }

  const campo = "block w-full rounded-md border border-rule bg-folha px-2 py-2 font-sans text-ink";
  return (
    <div className="mt-2 space-y-2 rounded-lg border border-ink bg-folha p-3" role="group" aria-label={t.editar.titulo}>
      <p className="text-sm font-bold">{t.editar.titulo}</p>
      <p className="text-xs text-ink-soft">{janela ? t.editar.livre : t.editar.marca}</p>
      {longo && <input className={`${campo} min-h-11`} value={titulo} maxLength={140} onChange={(e) => setTitulo(e.target.value)} aria-label={s.casca.tituloDica} />}
      <textarea className={`${campo} min-h-32 resize-y`} value={texto} maxLength={longo ? 10_000 : 500} disabled={!pronto} onChange={(e) => setTexto(e.target.value)} aria-label={s.casca.textoDica} />
      <div className="flex flex-wrap gap-2">
        <button type="button" className="min-h-11 cursor-pointer rounded-full bg-[#c21f16] px-5 font-sans font-bold text-white hover:bg-[#1f1a14] disabled:opacity-50" disabled={!pronto || ocupado || !texto.trim()} onClick={() => void salvar()}>
          {t.editar.salvar}
        </button>
        <button type="button" className={botao} onClick={aoFechar}>
          {t.editar.cancelar}
        </button>
      </div>
      <div aria-live="polite">
        {erro && <p role="alert" className="text-sm text-oxblood">{erro}</p>}
        {aviso && <p role="status" className="text-sm">{aviso}</p>}
      </div>
    </div>
  );
}

function HistoricoDoPost({ id, t, lang }: { id: string; t: TextosPublicar; lang: string }) {
  const [lista, setLista] = useState<EdicaoAnterior[] | null>(null);
  const [aberto, setAberto] = useState(false);
  return (
    <div className="mt-1 text-sm">
      <button
        type="button"
        className="min-h-11 cursor-pointer underline"
        aria-expanded={aberto}
        onClick={() => {
          setAberto((a) => !a);
          if (!lista) void redePub.historico(id).then(setLista, () => setLista([]));
        }}
      >
        {aberto ? t.editar.esconder : t.editar.historico}
      </button>
      {aberto && (
        <ol className="mt-1 space-y-2">
          {(lista ?? []).map((e, i) => (
            <li key={i} className="rounded-md border border-dashed border-rule bg-folha px-2 py-1">
              <p className="text-xs text-ink-soft">{preencher(t.editar.anterior, { quando: quando(e.quando, lang) })}</p>
              <p className="whitespace-pre-line break-words">{e.texto}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/**
 * O que um post tem além do texto, no cartão (components/rede/CartaoDePost.tsx): imagens com texto alternativo, áudio, enquete,
 * prévia de link (gerada no servidor), fio, "quem pode responder", o botão de editar para quem escreveu e o histórico de edições.
 * Os detalhes chegam em lote e só depois do texto: o cartão nunca espera por eles.
 */
export function Complementos({
  post,
  lang,
  s,
  logado,
  completo,
  aoAtualizar,
  detalhesIniciais,
}: {
  post: Post;
  lang: string;
  s: TextosDaRede;
  logado: boolean;
  completo?: boolean;
  aoAtualizar?: (p: Post) => void;
  /** Detalhes já conhecidos (a prévia da Alumia nova, com dados de exemplo): não pergunta ao banco. */
  detalhesIniciais?: DetalhesDoPost | null;
}) {
  const t = useTextosPublicar(lang);
  // Dentro da casca nova (flag "alumia-2"), a enquete sai com as barras da prancha.
  const al2 = useAlumia2();
  const [det, setDet] = useState<DetalhesDoPost | null>(detalhesIniciais ?? null);
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    if (detalhesIniciais) return;
    let vivo = true;
    detalhesDe(post.id).then((d) => vivo && setDet(d));
    return () => {
      vivo = false;
    };
  }, [post.id, post.editado_em, detalhesIniciais]);
  useEffect(() => {
    if (logado) publicarVencidosUmaVez();
  }, [logado]);

  const podeEditar = post.meu && !post.retido && !post.travado && post.tipo !== "aviso" && post.tipo !== "enquete" && post.tipo !== "chamado";
  const temAlgo = post.midia.length > 0 || det || podeEditar;
  if (!t || !temAlgo) return null;

  return (
    <div>
      {post.midia.length > 0 && (
        <div className={`mt-2 grid gap-1.5 ${post.midia.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {post.midia.map((m, n) => (
            <ImagemDoPost key={m.id} m={m} n={n} total={post.midia.length} t={t} />
          ))}
        </div>
      )}
      {det?.audio && <AudioDoPost id={det.audio.id} duracao={det.audio.duracao} t={t} />}
      {det?.enquete &&
        (al2 ? (
          <EnqueteDaAlumia2 postId={post.id} inicial={det.enquete} t={al2.t} tp={t} s={s} lang={lang} logado={logado} />
        ) : (
          <EnqueteDoPost post={post} inicial={det.enquete} t={t} lang={lang} logado={logado} s={s} />
        ))}
      {det?.previa && (
        <a href={det.previa.url} target="_blank" rel="noopener noreferrer nofollow ugc" className="mt-2 flex overflow-hidden rounded-lg border border-rule bg-folha text-sm hover:border-ink">
          {det.previa.imagem && (
            // O proxy assinado do nosso servidor: o navegador de quem lê não toca no site de fora.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={det.previa.imagem} alt="" loading="lazy" decoding="async" className="h-auto w-24 shrink-0 object-cover" />
          )}
          <span className="min-w-0 px-3 py-2">
            <span className="block text-xs text-ink-soft">{det.previa.dominio}</span>
            {det.previa.titulo && <span className="block font-serif font-semibold">{det.previa.titulo}</span>}
            {det.previa.descricao && <span className="block text-ink-soft">{det.previa.descricao}</span>}
          </span>
        </a>
      )}
      <div className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-ink-soft">
        {det?.fio && <span className="rounded bg-parchment-deep px-1.5">{t.fio.badge}</span>}
        {det && det.responde_quem !== "todos" && <span>{preencher(t.quem.so, { quem: t.quem[det.responde_quem].toLowerCase() })}</span>}
        {podeEditar && !editando && (
          <button type="button" className="min-h-11 cursor-pointer font-bold underline" onClick={() => setEditando(true)}>
            {t.editar.botao}
          </button>
        )}
      </div>
      {editando && <Editor post={post} t={t} s={s} janela={Boolean(det?.janela_livre)} aoSalvar={(p) => aoAtualizar?.(p)} aoFechar={() => setEditando(false)} />}
      {(det?.historico || (completo && post.editado_em)) && <HistoricoDoPost id={post.id} t={t} lang={lang} />}
    </div>
  );
}
