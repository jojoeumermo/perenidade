// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O que as telas novas da F3 (PLANO-ALUMIA §8 F3) usam juntas: saber se a Alumia nova está ligada, os textos dela, o post
// compacto das pranchas (comunidade e Salvos) e os ícones de traço. Tudo aqui só muda a tela com "rede-v2" + "alumia-2".
import "./alumia3.css";
import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "@/components/Link";
import { rede } from "@/lib/rede/cliente";
import { previaDaAlumiaLigada } from "@/lib/rede/conversa/exemplos";
import { preencher } from "@/lib/rede/preencher";
import { carregarTextosDaAlumia3, type TextosDaAlumia3 } from "@/lib/rede/textos-conversa";
import { enderecos, type Post } from "@/lib/rede/tipos";
import { tempoCurto, trilhaDoCaminho } from "@/lib/rede/tipos-conversa";
import { Avatar16 } from "../ui/Avatar16";

const nada = () => () => undefined;
const temAlumia2 = () => document.querySelector('[data-al="2"]') !== null;

/**
 * A Alumia nova está ligada nesta página? O layout (app/[lang]/alumia/layout.tsx) só põe [data-al="2"] com "rede-v2" e
 * "alumia-2" ligadas no servidor (inclusive pela decisão do painel), então a tela pergunta ao próprio HTML: a mesma resposta do
 * servidor, sem ler a flag de novo. Fora do navegador, não.
 */
export function useAlumia2(): boolean {
  return useSyncExternalStore(nada, temAlumia2, () => false);
}

/** Os textos das telas novas da F3 no idioma da página (nulo até chegar). */
export function useTextosAlumia3(lang: string): TextosDaAlumia3 | null {
  const [t, setT] = useState<{ lang: string; t: TextosDaAlumia3 } | null>(null);
  useEffect(() => {
    let vivo = true;
    carregarTextosDaAlumia3(lang).then((x) => vivo && setT({ lang, t: x }));
    return () => {
      vivo = false;
    };
  }, [lang]);
  return t?.lang === lang ? t.t : null;
}

/** A prévia com dados de exemplo (só com NEXT_PUBLIC_ALUMIA_PREVIA=sim). */
export const previa = previaDaAlumiaLigada;

/** A faixa que avisa que a tela mostra dados de exemplo (nunca some na prévia: ninguém pode achar que é de verdade). */
export function FaixaDaPrevia({ t }: { t: TextosDaAlumia3 }) {
  return previa() ? <p className="al3-previa" role="note">{t.comum.previa}</p> : null;
}

export function IconeVoltar() {
  return (
    <svg className="al3-icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}
export function IconeMais() {
  return (
    <svg className="al3-icone" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}
export function IconeAlfinete() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 3h8M9 3v6l-3 4h12l-3-4V3M12 13v8" />
    </svg>
  );
}
export function IconeLivro() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinejoin="round" aria-hidden>
      <path d="M3 5.5C5.5 4.5 8.5 4.5 12 6.5c3.5-2 6.5-2 9-1v13c-2.5-1-5.5-1-9 1-3.5-2-6.5-2-9-1z" />
      <path d="M12 6.5v13" />
    </svg>
  );
}
export function IconeGlobo() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />
    </svg>
  );
}
export function IconeEnviar() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinejoin="round" aria-hidden>
      <path d="M21 3L3 10.5l7.5 3L14 21z" />
      <path d="M21 3l-10.5 10.5" />
    </svg>
  );
}
export function IconeBusca() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

/** O link da aula citada (cartão azul das pranchas): "O que é mais-valia · aula do Instituto Lúcia · Marxismo". */
export function CartaoDeAula({ lang, cita, t }: { lang: string; cita: NonNullable<Post["cita"]>; t: TextosDaAlumia3 }) {
  const de = cita.tipo === "aula" ? preencher(t.conversa.aula, { trilha: trilhaDoCaminho(cita.caminho) }) : cita.tipo === "obra" ? t.conversa.obra : t.conversa.materia;
  const href = `/${lang}/${cita.caminho.replace(/^\/+/, "")}`;
  return (
    <Link href={href} className="al3-aula">
      <span className="al3-aula-icone">
        <IconeLivro />
      </span>
      <span>
        <span className="al3-aula-titulo">{cita.titulo || cita.caminho}</span>
        <span className="al3-aula-de">{de}</span>
      </span>
    </Link>
  );
}

/** "Acender" e "Salvar" de um post, com o estado guardado aqui até o banco responder (na prévia, só na tela). */
export function useAcenderSalvar(post: Post, aoErro: (e: unknown) => void) {
  const [apoiei, setApoiei] = useState(post.apoiei);
  const [salvei, setSalvei] = useState(post.salvei);
  const [ocupado, setOcupado] = useState(false);
  async function acender() {
    if (ocupado) return;
    const quer = !apoiei;
    setApoiei(quer);
    if (previa()) return;
    setOcupado(true);
    try {
      const r = await rede.reagir(post.id, "apoio", quer);
      setApoiei(r.apoiei);
    } catch (e) {
      setApoiei(!quer);
      aoErro(e);
    } finally {
      setOcupado(false);
    }
  }
  async function salvar() {
    if (ocupado) return;
    const quer = !salvei;
    setSalvei(quer);
    if (previa()) return;
    setOcupado(true);
    try {
      const r = await rede.salvar(post.id, quer);
      setSalvei(r.salvei);
    } catch (e) {
      setSalvei(!quer);
      aoErro(e);
    } finally {
      setOcupado(false);
    }
  }
  return { apoiei, salvei, ocupado, acender, salvar };
}

/** O nome de quem escreveu, com link para o perfil (quem veio do Fediverso não tem perfil daqui: só o nome). */
export function NomeDoAutor({ lang, post, className = "" }: { lang: string; post: Post; className?: string }) {
  const nome = post.org?.codinome ?? post.autor.codinome;
  if (post.autor.perfil && post.autor.handle && /^[a-z0-9_]{3,20}$/.test(post.autor.handle)) {
    return (
      <Link href={enderecos.perfil(lang, post.autor.handle)} className={`al3-nome ${className}`.trim()}>
        {nome}
      </Link>
    );
  }
  return <span className={`al3-nome ${className}`.trim()}>{nome}</span>;
}

/**
 * O post compacto das pranchas (celular-comunidade): rosto de 16 cartões, nome, @nome (ou "organização verificada") e tempo, o
 * texto, e "18 respostas · Acender · Salvar". Responder abre a conversa. Sem contagem de quem acendeu (só o autor sabe).
 */
export function PostCompacto({ post, lang, t, logado, aoErro }: { post: Post; lang: string; t: TextosDaAlumia3; logado: boolean; aoErro: (e: unknown) => void }) {
  const { apoiei, salvei, ocupado, acender, salvar } = useAcenderSalvar(post, aoErro);
  const handle = post.org?.handle ?? post.autor.handle ?? "";
  const respostas = post.respostas === 1 ? t.comum.respostaUma : preencher(t.comum.respostas, { n: post.respostas });
  return (
    <article className="al3-post" aria-labelledby={`al3-p-${post.id}`}>
      <Avatar16 handle={handle || post.id} tamanho={40} />
      <div>
        <p className="al3-post-cabeca" id={`al3-p-${post.id}`}>
          <NomeDoAutor lang={lang} post={post} />
          {post.org ? (
            <span className="al3-cinza" title={t.comum.orgRegra}>{t.comum.orgVerificada}</span>
          ) : handle ? (
            <span className="al3-cinza">@{handle}</span>
          ) : null}
          <span className="al3-cinza" aria-hidden>·</span>
          <time className="al3-cinza" dateTime={post.criado_em}>{tempoCurto(post.criado_em, lang)}</time>
        </p>
        {post.titulo && <p className="al3-post-texto"><strong>{post.titulo}</strong></p>}
        <p className="al3-post-texto">
          <Link href={enderecos.post(lang, post.id)}>{post.texto}</Link>
        </p>
        {post.cita && <CartaoDeAula lang={lang} cita={post.cita} t={t} />}
        <div className="al3-post-acoes">
          <Link href={enderecos.post(lang, post.id)} className="al3-acao">{respostas}</Link>
          <button type="button" className="al3-acao" aria-pressed={apoiei} disabled={!logado || ocupado} onClick={() => void acender()}>
            {apoiei ? t.comum.aceso : t.comum.acender}
          </button>
          <button type="button" className="al3-acao" aria-pressed={salvei} disabled={!logado || ocupado} onClick={() => void salvar()}>
            {salvei ? t.comum.salvo : t.comum.salvar}
          </button>
        </div>
      </div>
    </article>
  );
}
