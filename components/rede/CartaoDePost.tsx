// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { useState } from "react";
import { localePath } from "@/i18n/config";
import { rede } from "@/lib/rede/cliente";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaRede } from "@/lib/rede/textos";
import { enderecos, type Post } from "@/lib/rede/tipos";
import { TextoComMencoes } from "./conversa/TextoComMencoes";
import { TextoComTags } from "./descoberta/TextoComTags";
import { textoDoErro } from "./erros";
import { AcoesDeCuidado, RotuloDoPost } from "./moderacao/NoCartao";
import { Avatar } from "./perfil/Avatar";
import { Complementos } from "./publicar/Complementos";

/** "há 3 min", "há 2 h", "há 5 d" no idioma da página; depois de um mês, a data. */
export function quandoFoi(iso: string, lang: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const seg = Math.round((t - Date.now()) / 1000);
  const abs = Math.abs(seg);
  try {
    const f = new Intl.RelativeTimeFormat(lang, { numeric: "auto", style: "short" });
    if (abs < 3600) return f.format(Math.round(seg / 60), "minute");
    if (abs < 86400) return f.format(Math.round(seg / 3600), "hour");
    if (abs < 86400 * 30) return f.format(Math.round(seg / 86400), "day");
    return new Intl.DateTimeFormat(lang, { dateStyle: "medium" }).format(t);
  } catch {
    return new Date(t).toISOString().slice(0, 10);
  }
}

/** A cor de uma comunidade (como os canais do Misskey): um tom fixo tirado do nome, igual em toda tela e sem dado de ninguém. */
export function corDaComunidade(slug: string): string {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) % 360;
  return `hsl(${h} 62% 42%)`;
}

/** Os ícones das ações do cartão (desenho próprio, traço de 24 px). O rótulo em texto continua ao lado. */
const ICONES = {
  respostas: "M4 5h16v11H10l-4.5 4v-4H4z",
  responder: "M10 8 5 12.5l5 4.5M5.5 12.5H14a5 5 0 0 1 5 5V19",
  apoiar: "M12 3.5c1.6 2.7 4.8 4.9 4.8 8.9a4.8 4.8 0 0 1-9.6 0c0-2.3 1.2-3.7 2.3-4.8.2 1.4.8 2.5 1.8 3C11 9 11.4 6 12 3.5z",
  util: "M7 11v8H4v-8zM7 11l4-7c1.4 0 2.3 1 2 2.4L12.5 10H18a2 2 0 0 1 2 2.3l-1.1 5.4A2 2 0 0 1 17 19H7",
  salvar: "M6 4h12v16l-6-4-6 4z",
};
function IconeDaAcao({ d }: { d: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-[1.1rem] w-[1.1rem] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

/**
 * O cartão de um post na linha, na página do post e nas respostas. Mostra só o que a matriz deixou chegar: o número de apoios só
 * aparece para o autor, o "eu vou" só para quem organizou, ninguém vê lista de nomes. Os pacotes acrescentam ações em
 * `extras` (editar, fixar, etiqueta de desinformação…) sem mexer aqui.
 */
export function CartaoDePost({
  post: inicial,
  lang,
  s,
  logado,
  completo = false,
  aoResponder,
  extras,
}: {
  post: Post;
  lang: string;
  s: TextosDaRede;
  logado: boolean;
  completo?: boolean;
  aoResponder?: (post: Post) => void;
  extras?: React.ReactNode;
}) {
  const [post, setPost] = useState(inicial);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const a = s.acoes;
  const longoTexto = completo && post.corpo ? post.corpo : post.texto;
  const comTitulo = post.tipo === "discussao" || post.tipo === "duvida";
  const aviso = post.aviso.trim();

  async function reagir(tipo: "apoio" | "util") {
    if (ocupado) return;
    setOcupado(true);
    setErro("");
    try {
      const quer = tipo === "apoio" ? !post.apoiei : !post.util_eu;
      const r = await rede.reagir(post.id, tipo, quer);
      // Ninguém que não escreveu o post fica sabendo do total de apoios: só o próprio estado volta.
      setPost((p) => ({ ...p, apoiei: r.apoiei, util_eu: r.util_eu, util: r.util, apoios: p.apoios === null ? null : Math.max(0, p.apoios + (tipo === "apoio" ? (quer ? 1 : -1) : 0)) }));
    } catch (e) {
      setErro(textoDoErro(s, e));
    } finally {
      setOcupado(false);
    }
  }

  async function salvar() {
    if (ocupado) return;
    setOcupado(true);
    setErro("");
    try {
      const r = await rede.salvar(post.id, !post.salvei);
      setPost((p) => ({ ...p, salvei: r.salvei }));
    } catch (e) {
      setErro(textoDoErro(s, e));
    } finally {
      setOcupado(false);
    }
  }

  const botao = "flex min-h-11 cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 hover:text-[#c21f16] disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:font-bold aria-pressed:text-[#c21f16]";
  const nomeDoAutor = (
    <span className="font-bold">{post.autor.codinome}</span>
  );

  return (
    <article
      className="flex gap-3 border-b border-rule px-[18px] py-4 font-sans"
      aria-label={post.titulo ?? post.texto.slice(0, 60)}
      data-tipo={post.tipo}
      style={post.comunidade ? ({ "--cor-da-comunidade": corDaComunidade(post.comunidade) } as React.CSSProperties) : undefined}
    >
      <Avatar usuario={post.autor.perfil ? post.autor.id : null} codinome={post.autor.codinome} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 text-sm text-ink-soft">
          {post.autor.handle && post.autor.perfil ? (
            <Link href={enderecos.perfil(lang, post.autor.handle)} className="text-ink hover:underline">
              {nomeDoAutor}
            </Link>
          ) : (
            <span className="text-ink">{nomeDoAutor}</span>
          )}
          {post.autor.equipe && <span className="rounded bg-ink px-1 text-[0.6rem] font-semibold uppercase tracking-wider text-parchment">{s.perfil.equipe}</span>}
          {post.comunidade && (
            <Link href={enderecos.comunidade(lang, post.comunidade)} className="alumia-comunidade inline-flex items-center rounded-full px-2 text-xs font-bold hover:underline">
              {post.comunidade}
            </Link>
          )}
          {post.flair && <span className="rounded border border-rule px-1 text-xs">{post.flair}</span>}
          <Link href={enderecos.post(lang, post.id)} className="hover:underline">
            <time dateTime={post.criado_em}>{quandoFoi(post.criado_em, lang)}</time>
          </Link>
          {post.editado_em && <span className="text-xs">({s.post.editado})</span>}
          {post.tipo !== "post" && <span data-tipo={post.tipo} className="alumia-tipo rounded-full bg-parchment-deep px-2 text-xs font-bold">{(s.tipos as Record<string, string>)[post.tipo]}</span>}
          {post.aceita && <span className="rounded bg-[#e8f0e0] px-1.5 text-xs text-ink">{s.post.resolvida}</span>}
        </div>

        {post.retido && (
          <p className="mt-1 rounded-md border border-dashed border-ink bg-parchment-deep px-2 py-1 text-sm" role="status">
            {s.post.retido}
          </p>
        )}

        {comTitulo && post.titulo && (
          <h3 className="mt-1 font-serif text-lg font-semibold leading-snug">
            {completo ? post.titulo : <Link href={enderecos.post(lang, post.id)} className="hover:underline">{post.titulo}</Link>}
          </h3>
        )}

        {aviso ? (
          <details className="mt-1">
            <summary className="cursor-pointer text-sm font-bold">
              {s.post.avisoConteudo}: {aviso}
            </summary>
            <p className="mt-1 whitespace-pre-line break-words"><TextoComTags texto={longoTexto} lang={lang} Resto={TextoComMencoes} /></p>
          </details>
        ) : (
          <p className="mt-1 whitespace-pre-line break-words"><TextoComTags texto={longoTexto} lang={lang} Resto={TextoComMencoes} /></p>
        )}
        {!completo && post.longo && (
          <Link href={enderecos.post(lang, post.id)} className="mt-1 inline-block text-sm underline">
            {s.post.verMais}
          </Link>
        )}

        {post.cita && (
          <Link href={localePath(lang, post.cita.caminho)} className="mt-2 block rounded-lg border border-rule bg-folha px-3 py-2 text-sm hover:border-ink">
            {post.cita.titulo || post.cita.caminho}
          </Link>
        )}
        {post.citado && ("restrito" in post.citado ? (
          <p className="mt-2 rounded-lg border border-dashed border-rule px-3 py-2 text-sm text-ink-soft">{s.post.restrito}</p>
        ) : (
          <Link href={enderecos.post(lang, post.citado.id)} className="mt-2 block rounded-lg border border-rule bg-folha px-3 py-2 text-sm hover:border-ink">
            <span className="font-bold">{post.citado.codinome}</span>: {post.citado.trecho}
          </Link>
        ))}

        {/* Pacote publicar: imagens, áudio, enquete, prévia de link, fio, editar e histórico (detalhes em lote, depois do texto). */}
        <Complementos post={post} lang={lang} s={s} logado={logado} completo={completo} aoAtualizar={setPost} />

        <RotuloDoPost post={post} lang={lang} />

        <div className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-ink-soft">
          <Link href={enderecos.post(lang, post.id)} className={botao}>
            <IconeDaAcao d={ICONES.respostas} />
            {post.respostas === 1 ? s.post.respostas.um : preencher(s.post.respostas.outros, { n: post.respostas })}
          </Link>
          {logado && !post.travado && aoResponder && (
            <button type="button" className={botao} onClick={() => aoResponder(post)}>
              <IconeDaAcao d={ICONES.responder} />
              {a.responder}
            </button>
          )}
          {logado && !post.meu && (
            <button type="button" className={botao} aria-pressed={post.apoiei} disabled={ocupado} onClick={() => void reagir("apoio")}>
              <IconeDaAcao d={ICONES.apoiar} />
              {a.apoiar}
            </button>
          )}
          {/* O número de apoios só chega para quem escreveu (decisão 3). */}
          {post.apoios !== null && post.meu && <span aria-label={a.apoiar}>{post.apoios}</span>}
          {logado && !post.meu && (post.tipo === "duvida" || post.tipo === "discussao") && (
            <button type="button" className={botao} aria-pressed={post.util_eu} disabled={ocupado} onClick={() => void reagir("util")}>
              <IconeDaAcao d={ICONES.util} />
              {a.util}
            </button>
          )}
          {(post.tipo === "duvida" || post.tipo === "discussao") && post.util > 0 && <span>{preencher(s.post.util, { n: post.util })}</span>}
          {logado && (
            <button type="button" className={botao} aria-pressed={post.salvei} disabled={ocupado} onClick={() => void salvar()}>
              <IconeDaAcao d={ICONES.salvar} />
              {a.salvar}
            </button>
          )}
          {/* Pacote moderacao: denunciar com protocolo, silenciar e moderar (visitante vai para a página Denunciar). */}
          <AcoesDeCuidado post={post} lang={lang} s={s} logado={logado} classe={botao} />
          {extras}
        </div>
        {post.travado && <p className="mt-1 text-xs text-ink-soft">{s.post.travado}</p>}
        {erro && (
          <p role="alert" className="mt-1 text-sm text-oxblood">
            {erro}
          </p>
        )}
      </div>
    </article>
  );
}
