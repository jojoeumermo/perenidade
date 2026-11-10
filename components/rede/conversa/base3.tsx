// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O que as telas novas da F3 (PLANO-ALUMIA §8 F3) usam juntas: saber se a Alumia nova está ligada, os textos dela, o post
// compacto das pranchas (comunidade e Salvos) e os ícones de traço. Tudo aqui só muda a tela com "rede-v2" + "alumia-2".
import "./alumia3.css";
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type MouseEvent as EventoDeMouse, type RefObject } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/Link";
import { rede } from "@/lib/rede/cliente";
import { listaDeExemplo, previaDaAlumiaLigada } from "@/lib/rede/conversa/exemplos";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaRede } from "@/lib/rede/textos";
import { carregarTextosDaAlumia3, type TextosDaAlumia3 } from "@/lib/rede/textos-conversa";
import { enderecos, type Post } from "@/lib/rede/tipos";
import { corDaComunidadeNova } from "@/lib/rede/tipos-comunidades";
import { tempoCurto, trilhaDoCaminho } from "@/lib/rede/tipos-conversa";
import { useIndice } from "@/components/estudo/indice";
import { AcoesDeCuidado } from "../moderacao/NoCartao";
import { CartaoDaAlumia2 } from "../publicar/alumia2/CartaoDaAlumia2";
import { useAlumia2 as useCascaNova } from "../publicar/alumia2/contexto";
import { Avatar16 } from "../ui/Avatar16";

/** A Alumia nova está ligada nesta página? Vem do layout por contexto (./Alumia2.tsx), com a decisão do servidor. */
export { useAlumia2 } from "./Alumia2";

/** Os textos das telas novas da F3 no idioma da página (nulo até chegar; com `lang` nulo, nunca baixa). */
export function useTextosAlumia3(lang: string | null): TextosDaAlumia3 | null {
  const [t, setT] = useState<{ lang: string; t: TextosDaAlumia3 } | null>(null);
  useEffect(() => {
    // Nulo: a tela não precisa dos textos (a rede de hoje), e nada é baixado.
    if (lang === null) return;
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

/** Um aviso que flutua por cima da tela (não empurra nada) e some sozinho; com "Desfazer" quando a ação volta atrás. */
export interface Torrada {
  id: number;
  texto: string;
  erro?: boolean;
  acao?: { rotulo: string; fazer: () => void };
}

/**
 * Os avisos flutuantes de uma tela: `mostrar` troca o aviso da vez; ele some em 4 s (6 s com erro ou com "Desfazer"). Enquanto o
 * mouse ou o foco estão nele, o tempo para (WCAG 2.2.1: dá tempo de chegar ao "Desfazer" pelo teclado).
 */
export function useTorrada() {
  const [torrada, setTorrada] = useState<Torrada | null>(null);
  const relogio = useRef<number | null>(null);
  const parar = useCallback(() => {
    if (relogio.current !== null) window.clearTimeout(relogio.current);
    relogio.current = null;
  }, []);
  const contar = useCallback(
    (t: Torrada | null) => {
      parar();
      if (!t) return;
      relogio.current = window.setTimeout(() => setTorrada(null), t.acao || t.erro ? 6000 : 4000);
    },
    [parar],
  );
  useEffect(() => {
    contar(torrada);
    return parar;
  }, [torrada, contar, parar]);
  const mostrar = useCallback((t: Omit<Torrada, "id">) => setTorrada({ ...t, id: Date.now() + Math.random() }), []);
  const fechar = useCallback(() => setTorrada(null), []);
  return { torrada, mostrar, fechar, segurar: parar, soltar: () => contar(torrada) };
}

/** Onde o aviso flutuante aparece: duas regiões vivas fixas (status e alerta), sempre na página, para o leitor de tela anunciar. */
export function Torradas({ estado }: { estado: ReturnType<typeof useTorrada> }) {
  const { torrada, fechar, segurar, soltar } = estado;
  const corpo = (erro: boolean) =>
    torrada && Boolean(torrada.erro) === erro ? (
      <div key={torrada.id} className="al3-torrada" data-erro={erro ? "sim" : undefined} onPointerEnter={segurar} onPointerLeave={soltar} onFocus={segurar} onBlur={soltar}>
        <span>{torrada.texto}</span>
        {torrada.acao && (
          <button
            type="button"
            onClick={() => {
              torrada.acao?.fazer();
              fechar();
            }}
          >
            {torrada.acao.rotulo}
          </button>
        )}
      </div>
    ) : null;
  return (
    <div className="al3-torradas">
      <div role="status">{corpo(false)}</div>
      <div role="alert">{corpo(true)}</div>
    </div>
  );
}

/**
 * A pergunta antes de uma ação que muda algo ("Sair de Passe Livre SP?"): uma folha que sobe de baixo no celular e um cartão no
 * computador, no <dialog> do navegador (foco preso, Escape fecha, o fundo fica inerte). Começa no botão que não muda nada.
 */
export function Confirmar({
  aberto,
  titulo,
  texto,
  sim,
  nao,
  aoSim,
  aoFechar,
  voltarPara,
}: {
  aberto: boolean;
  titulo: string;
  texto: string;
  sim: string;
  nao: string;
  aoSim: () => void;
  aoFechar: () => void;
  voltarPara?: RefObject<HTMLElement | null>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  const idTexto = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto]);
  return (
    <dialog
      ref={ref}
      className="al3-folha"
      aria-labelledby={idTitulo}
      aria-describedby={idTexto}
      onClose={() => {
        aoFechar();
        voltarPara?.current?.focus();
      }}
      // Tocar fora do cartão (no fundo escurecido) fecha, como Escape.
      onClick={(e) => e.target === ref.current && ref.current?.close()}
    >
      <div className="al3-folha-corpo">
        <h2 id={idTitulo} className="al3-cond">{titulo}</h2>
        <p id={idTexto}>{texto}</p>
        <div className="al3-folha-botoes">
          <button type="button" className="al3-folha-nao" autoFocus onClick={() => ref.current?.close()}>
            {nao}
          </button>
          <button
            type="button"
            className="al3-folha-sim"
            onClick={() => {
              aoSim();
              ref.current?.close();
            }}
          >
            {sim}
          </button>
        </div>
      </div>
    </dialog>
  );
}

/** O nome de uma comunidade pelo slug: o que a casca já sabe, os exemplos na prévia ou, por fim, o slug escrito como nome. */
export function useComunidadeDoPost(slug: string | null): { nome: string; cor: 1 | 2 | 3 | 4 | 5 } | null {
  const casca = useCascaNova();
  if (!slug) return null;
  const daCasca = casca?.comunidades[slug];
  const exemplo = previa() ? listaDeExemplo().find((c) => c.slug === slug) : undefined;
  const nome = exemplo?.nome ?? daCasca?.nome ?? slug.replace(/-/g, " ").replace(/^./, (l) => l.toUpperCase());
  return { nome, cor: corDaComunidadeNova(slug, exemplo?.cor) };
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

/** O sino de seguir (conversa, #tema): contorno quando não segue, cheio e com as ondinhas quando segue. */
export function IconeSino({ aceso }: { aceso: boolean }) {
  return (
    <svg className="al3-icone al3-icone-sino" viewBox="0 0 24 24" fill={aceso ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" />
      <path d="M10 20.5a2.2 2.2 0 0 0 4 0" fill="none" />
      {aceso && <path className="al3-sino-onda" d="M3 8.5C3.6 6.6 4.6 5 6 3.8M21 8.5c-.6-1.9-1.6-3.5-3-4.7" fill="none" />}
    </svg>
  );
}
export function IconeAspas() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M4 17.5c0-4.6 1.7-8.4 5.6-11l1.2 1.5C8.4 9.9 7.4 11.8 7.3 13H10v5.5H4zM13.5 17.5c0-4.6 1.7-8.4 5.6-11l1.2 1.5c-2.4 1.9-3.4 3.8-3.5 5H19.5v5.5h-6z" />
    </svg>
  );
}
/** A chama de Acender: contorno quando apagada, cheia quando acesa (o CSS faz ela tremer ao acender). */
export function IconeChama({ acesa }: { acesa: boolean }) {
  return (
    <svg className="al3-icone-acao al3-chama" viewBox="0 0 24 24" fill={acesa ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinejoin="round" aria-hidden>
      <path d="M12 3c.6 3 3.2 4.6 4.6 7.2 1.6 3 .6 7.3-3.2 8.6.9-1.5.6-3.5-1.4-5-.2 1.9-1.3 2.9-2.4 3.7-1 .8-1.4 2-.9 3.3C5.2 19 4.4 14.6 6.3 11.6c.5 1 1.3 1.6 2.2 1.8C8 9.9 9.9 6 12 3z" />
    </svg>
  );
}
/** O marcador de Salvar: contorno quando não salvo, cheio quando salvo. */
export function IconeMarcador({ salvo }: { salvo: boolean }) {
  return (
    <svg className="al3-icone-acao al3-marcador" viewBox="0 0 24 24" fill={salvo ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinejoin="round" aria-hidden>
      <path d="M6.5 3.5h11v17L12 16.5l-5.5 4z" />
    </svg>
  );
}

/** "Acender" com a chama: o estado muda na hora, a chama acende com um pulo e o banco confirma depois (ou desfaz). */
export function BotaoAcender({ t, logado, apoiei, ocupado, acender }: { t: TextosDaAlumia3; logado: boolean; apoiei: boolean; ocupado: boolean; acender: () => Promise<void> }) {
  return (
    <button type="button" className="al3-acao al3-acao-acender" aria-pressed={apoiei} disabled={!logado || ocupado} onClick={() => void acender()}>
      <IconeChama acesa={apoiei} />
      {apoiei ? t.comum.aceso : t.comum.acender}
    </button>
  );
}
/** "Salvar" com o marcador (os salvos são só seus: ninguém vê quem salvou). */
export function BotaoSalvar({ t, logado, salvei, ocupado, salvar }: { t: TextosDaAlumia3; logado: boolean; salvei: boolean; ocupado: boolean; salvar: () => Promise<void> }) {
  return (
    <button type="button" className="al3-acao al3-acao-salvar" aria-pressed={salvei} disabled={!logado || ocupado} onClick={() => void salvar()}>
      <IconeMarcador salvo={salvei} />
      {salvei ? t.comum.salvo : t.comum.salvar}
    </button>
  );
}

/** O link da aula citada (cartão azul das pranchas): "O que é mais-valia · aula do Instituto Lúcia · Marxismo". */
export function CartaoDeAula({ lang, cita, t }: { lang: string; cita: NonNullable<Post["cita"]>; t: TextosDaAlumia3 }) {
  // O nome da aula e da disciplina vêm do índice das trilhas do site (o mesmo do Meu estudo, guardado uma vez por visita), no
  // idioma da página; sem o índice, o título gravado e o nome tirado do endereço.
  const indice = useIndice(lang);
  const partes = cita.caminho.replace(/^\/+/, "").replace(/^trilhas\//, "").split("/");
  const daAula = partes.length >= 2 ? indice?.aulas.get(`${partes[0]}/${partes[1]}`) : undefined;
  const daTrilha = indice?.trilhas.find((x) => x[0] === partes[0]);
  const titulo = (cita.tipo === "materia" ? daTrilha?.[1] : undefined) ?? (cita.titulo || daAula?.titulo || trilhaDoCaminho(cita.caminho));
  const area = daAula?.nomeDaArea ?? daTrilha?.[3] ?? trilhaDoCaminho(cita.caminho);
  const de = cita.tipo === "aula" ? preencher(t.conversa.aula, { trilha: area }) : cita.tipo === "obra" ? t.conversa.obra : t.conversa.materia;
  const href = `/${lang}/${cita.caminho.replace(/^\/+/, "")}`;
  return (
    <Link href={href} className="al3-aula">
      <span className="al3-aula-icone">
        <IconeLivro />
      </span>
      <span>
        <span className="al3-aula-titulo">{titulo}</span>
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
 * texto, e "18 respostas · Acender · Salvar". Responder abre a conversa. Sem contagem de quem acendeu (só o autor sabe). O "…" no
 * canto abre as ações de cuidado do cartão de hoje (Denunciar com protocolo, Silenciar e, para quem modera, Moderar): a página
 * nova não pode ficar sem como denunciar um post. É o MESMO cartão em todas as telas da F3 (comunidade, #tema, busca, Salvos):
 * nas listas misturadas (`comComunidade`), ganha a ficha com o nome da comunidade e a borda na cor dela.
 */
export function PostCompacto({
  post,
  lang,
  s,
  t,
  logado,
  aoErro,
  comComunidade = false,
  aoSalvar,
}: {
  post: Post;
  lang: string;
  s: TextosDaRede;
  t: TextosDaAlumia3;
  logado: boolean;
  aoErro: (e: unknown) => void;
  comComunidade?: boolean;
  /** Avisa a lista quando o post entra ou sai dos salvos (Salvos tira o cartão da lista). */
  aoSalvar?: (salvo: boolean) => void;
}) {
  const acoes = useAcenderSalvar(post, aoErro);
  const casca = useCascaNova();
  const [cuidado, setCuidado] = useState(false);
  const idDoCuidado = useId();
  const com = useComunidadeDoPost(comComunidade ? post.comunidade : null);
  const handle = post.org?.handle ?? post.autor.handle ?? "";
  const respostas = post.respostas === 1 ? t.comum.respostaUma : preencher(t.comum.respostas, { n: post.respostas });
  const salvar = async () => {
    const quer = !acoes.salvei;
    await acoes.salvar();
    aoSalvar?.(quer);
  };
  const router = useRouter();
  // O cartão inteiro abre a conversa (como nas outras redes), menos nos botões, links e quando a pessoa seleciona texto. No
  // teclado e no leitor de tela, quem abre é o link do texto: o clique no cartão é só um atalho para o dedo e o mouse.
  const abrir = (e: EventoDeMouse<HTMLElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if ((e.target as HTMLElement).closest("a, button, input, textarea, select, label, summary, [role=button], .al3-post-cuidado")) return;
    if (window.getSelection()?.toString()) return;
    router.push(enderecos.post(lang, post.id));
  };
  // Na casca nova, o cartão é o MESMO do Início (mesmas ações, mesmo selo de verificação), só mais denso.
  if (casca) {
    return <CartaoDaAlumia2 post={post} lang={lang} s={s} logado={logado} densidade="compacta" semComunidade={!comComunidade} aoSalvar={aoSalvar} />;
  }
  return (
    <article className={`al3-post al3-post-abre${com ? ` al3-post-com al3-cor-${com.cor}` : ""}`} aria-labelledby={`al3-p-${post.id}`} onClick={abrir}>
      <Avatar16 handle={handle || post.id} tamanho={40} />
      <div className="al3-post-corpo">
        <button
          type="button"
          className="al3-post-mais"
          aria-expanded={cuidado}
          aria-controls={idDoCuidado}
          aria-label={preencher(t.comum.maisDoPost, { codinome: post.org?.codinome ?? post.autor.codinome })}
          onClick={() => setCuidado((c) => !c)}
        >
          <IconeMais />
        </button>
        {com && post.comunidade && (
          <Link href={enderecos.comunidade(lang, post.comunidade)} className="al3-post-ficha">
            <span className="al3-post-ficha-ponto" aria-hidden />
            {com.nome}
          </Link>
        )}
        <p className="al3-post-cabeca" id={`al3-p-${post.id}`}>
          <NomeDoAutor lang={lang} post={post} />
          {post.org ? (
            <span className="al3-cinza al3-post-quem" title={t.comum.orgRegra}>{t.comum.orgVerificada}</span>
          ) : handle ? (
            <span className="al3-cinza al3-post-quem">@{handle}</span>
          ) : null}
          <span className="al3-cinza al3-post-tempo">
            <span aria-hidden>· </span>
            <time dateTime={post.criado_em}>{tempoCurto(post.criado_em, lang)}</time>
          </span>
        </p>
        {post.titulo && <p className="al3-post-texto"><strong>{post.titulo}</strong></p>}
        <p className="al3-post-texto">
          <Link href={enderecos.post(lang, post.id)}>{post.texto}</Link>
        </p>
        {post.cita && <CartaoDeAula lang={lang} cita={post.cita} t={t} />}
        <div className="al3-post-acoes">
          <Link href={enderecos.post(lang, post.id)} className="al3-acao">{respostas}</Link>
          <BotaoAcender t={t} logado={logado} {...acoes} />
          <BotaoSalvar t={t} logado={logado} {...acoes} salvar={salvar} />
        </div>
        <div className="al3-post-cuidado" id={idDoCuidado} hidden={!cuidado}>
          {cuidado && <AcoesDeCuidado post={post} lang={lang} s={s} logado={logado} classe="al3-acao" />}
        </div>
      </div>
    </article>
  );
}

/** Uma lista de posts com o cartão único da F3 (a ordem e a paginação são de quem chama). */
export function ListaDePostsCompactos({ posts, lang, s, t, logado, aoErro, comComunidade = true }: { posts: readonly Post[]; lang: string; s: TextosDaRede; t: TextosDaAlumia3; logado: boolean; aoErro: (e: unknown) => void; comComunidade?: boolean }) {
  return (
    <>
      {posts.map((p, i) => (
        <div key={p.id} className="al3-post-entra" style={{ "--i": i } as CSSProperties}>
          <PostCompacto post={p} lang={lang} s={s} t={t} logado={logado} aoErro={aoErro} comComunidade={comComunidade} />
        </div>
      ))}
    </>
  );
}
