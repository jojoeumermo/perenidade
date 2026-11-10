// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type RefObject } from "react";
import Link from "@/components/Link";
import { rede } from "@/lib/rede/cliente";
import { conversa } from "@/lib/rede/cliente-conversa";
import { arvoreDeExemplo, postDeExemplo } from "@/lib/rede/conversa/exemplos";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { TextosDaAlumia3 } from "@/lib/rede/textos-conversa";
import { enderecos, type Post, type Situacao } from "@/lib/rede/tipos";
import {
  contarNos,
  generoDoAjudou,
  montarArvore,
  REACOES,
  reacaoOk,
  reacoesParaMostrar,
  servidorDaResposta,
  tempoCurto,
  type Arvore,
  type NoDaArvore,
  type PostDaArvore,
  type ReacaoDoPost,
} from "@/lib/rede/tipos-conversa";
import { verificarAntesDePublicar } from "../encaixes";
import { textoDoErro } from "../erros";
import { EsqueletoDaLinha } from "../Esqueletos";
import { Avatar16 } from "../ui/Avatar16";
import {
  BotaoAcender,
  BotaoSalvar,
  CartaoDeAula,
  FaixaDaPrevia,
  IconeAspas,
  IconeEnviar,
  IconeGlobo,
  IconeMais,
  IconeSino,
  IconeVoltar,
  NomeDoAutor,
  previa,
  useAcenderSalvar,
  useTextosAlumia3,
} from "./base3";
import { pular, trazerParaVista, useFlip, useRegua } from "./movimento";

const LIMITE = 500;
/** O trecho citado cabe numa linha de citação: o resto da resposta é da pessoa. */
const TRECHO_MAX = 200;

/** O @ que aparece: "@liaquilombo", e para quem veio do Fediverso o endereço inteiro ("@porto@mastodon.social"). */
const arroba = (p: Post) => (p.autor.handle ? `@${p.autor.handle.replace(/^@/, "")}` : "");

/** Um trecho escolhido com o dedo ou o mouse num post da conversa, para citar na resposta. */
type Citacao = { post: Post; trecho: string };

/**
 * A conversa na Alumia nova (prancha celular-conversa-fediverso; PLANO-ALUMIA §3 e §8 F3): barra "CONVERSA · N respostas" com o
 * sininho de seguir a conversa, o post com a aula citada e as reações (só totais), "Mais antigas / Mais novas" com a régua que
 * desliza e as respostas que trocam de lugar sem pular (FLIP), o fio em árvore com as linhas que se desenham e os ramos que se
 * recolhem, o selo "ajudou a autora" (pelo pronome que a pessoa escreveu, nunca por palpite), a resposta vinda do Fediverso com o
 * selo do servidor (só o nome do servidor, que já é público no @; nada de IP), "citar trecho" (selecionar um pedaço e citar na
 * resposta) e a caixa "Responder para @…" fixa embaixo.
 *
 * Os dados vêm de rede_alumia_conversa (supabase/migracoes/20261109-alumia-f3.sql) e o "seguir" de rede_alumia_seguir_conversa
 * (20261110-alumia-comunidade.sql): ninguém vê quem segue (LGPD art. 5º, II, e art. 11), e o aviso chega agrupado.
 */
export default function TelaDaConversaAlumia({ id, lang, s, situacao }: { id: string; lang: string; s: TextosDaRede; situacao: Situacao }) {
  const t = useTextosAlumia3(lang);
  const [ordem, setOrdem] = useState<"antigas" | "novas">("antigas");
  const [estado, setEstado] = useState<{ chave: string; dado: Arvore | null; erro: string } | null>(null);
  const [versao, setVersao] = useState(0);
  const [aviso, setAviso] = useState<{ texto: string; erro: boolean } | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  const [recolhidas, setRecolhidas] = useState<ReadonlySet<string>>(() => new Set());
  const [alvo, setAlvo] = useState<Post | null>(null);
  const [citacao, setCitacao] = useState<Citacao | null>(null);
  const chave = `${id}:${ordem}:${versao}`;
  const fio = useRef<HTMLOListElement>(null);
  const ordemRef = useRef<HTMLDivElement>(null);
  const tela = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let vivo = true;
    // Banco sem a migração da F3 ainda: a árvore de hoje (sem reações; "ajudou" pelo `aceita` da dúvida).
    const pedir = previa() ? Promise.resolve(arvoreDeExemplo(id)) : conversa.alumia(id, ordem).catch(() => conversa.arvore(id, ordem));
    pedir
      .then((dado) => {
        if (!vivo) return;
        // Na prévia a ordem é feita aqui (o banco já devolve na ordem pedida).
        if (previa() && ordem === "novas") dado = { ...dado, respostas: [...dado.respostas].reverse().sort((a, b) => (a.nivel ?? 0) - (b.nivel ?? 0)) };
        setEstado({ chave, dado, erro: "" });
      })
      .catch((e) => vivo && setEstado({ chave, dado: null, erro: textoDoErro(s, e) }));
    return () => {
      vivo = false;
    };
  }, [id, ordem, chave, s]);

  const aoErro = useCallback((e: unknown) => setAviso({ texto: textoDoErro(s, e), erro: true }), [s]);
  const dado = estado?.dado ?? null;
  const nos = dado ? montarArvore(dado.post.id, dado.respostas) : [];
  // A ordem dos ids (com os ramos recolhidos) é a chave do FLIP: só uma troca de ordem anima.
  const assinatura = `${ordem}|${dado?.respostas.map((r) => r.id).join(",") ?? ""}|${[...recolhidas].join(",")}`;
  useFlip(fio, assinatura);
  useRegua(ordemRef, `${ordem}:${t ? "t" : ""}:${dado ? "d" : ""}`);

  if (!t || !estado) return <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={3} />;
  if (!dado) {
    return (
      <div className="al3 al3-vazio" role="alert">
        <p>{estado.erro || s.estados.naoEncontrado}</p>
        <button type="button" className="al-botao al-botao-contorno al-botao-m" onClick={() => setVersao((n) => n + 1)}>
          {s.estados.tentar}
        </button>
      </div>
    );
  }
  const post = dado.post;
  const raizPost = post.id === dado.raiz ? post : dado.acima.find((p) => p.id === dado.raiz) ?? null;
  // A marca nova (só da autora) quando o banco a manda; na prévia, o `aceita` dos exemplos.
  const aceitaId = dado.ajudou !== undefined ? dado.ajudou : raizPost?.aceita ?? null;
  const genero = generoDoAjudou(dado.pronomes_da_raiz);
  const seloAjudou = genero === "a" ? t.conversa.ajudouA : genero === "o" ? t.conversa.ajudouO : t.conversa.ajudouQuem;
  const total = post.na_conversa ?? post.respostas;
  const podeResponder = situacao.logado && situacao.membro && !post.travado;
  const destino = alvo ?? post;
  const podeAjudou = previa() ? raizPost?.meu === true : dado.pode_ajudou === true;

  async function marcarAjudou(resposta: Post, quer: boolean) {
    if (previa()) {
      setEstado((e) => (e && e.dado ? { ...e, dado: { ...e.dado, post: { ...e.dado.post, aceita: quer ? resposta.id : null } } } : e));
      return;
    }
    try {
      await conversa.ajudou(resposta.id, quer);
      setVersao((n) => n + 1);
    } catch (e) {
      aoErro(e);
    }
  }

  function responderA(p: Post) {
    setAlvo(p.id === post.id ? null : p);
    setAberta(null);
    const campo = document.getElementById("al3-responder");
    // Sem pulo: no celular a caixa já está presa embaixo; no computador ela vem para a vista devagar.
    trazerParaVista(campo);
    campo?.focus({ preventScroll: true });
  }

  function citar(c: Citacao) {
    setCitacao(c);
    responderA(c.post);
  }

  const contexto: ContextoDoFio = {
    lang,
    t,
    aberta,
    alternar: (pid) => setAberta((a) => (a === pid ? null : pid)),
    recolhidas,
    recolher: (pid) =>
      setRecolhidas((r) => {
        const n = new Set(r);
        if (n.has(pid)) n.delete(pid);
        else n.add(pid);
        return n;
      }),
    aceitaId,
    seloAjudou,
    podeAjudou,
    podeResponder,
    logado: situacao.logado,
    alvo: alvo?.id ?? null,
    aoResponder: responderA,
    aoAjudou: (p, quer) => void marcarAjudou(p, quer),
    aoErro,
  };

  return (
    <div className="al3 al3-conversa" ref={tela}>
      <FaixaDaPrevia t={t} />
      <div className="al3-barra">
        <Link href={raizPost?.comunidade ? enderecos.comunidade(lang, raizPost.comunidade) : enderecos.linha(lang)} className="al3-voltar" aria-label={t.conversa.voltar}>
          <IconeVoltar />
        </Link>
        <h1 className="al3-cond">{t.conversa.titulo}</h1>
        <p className="al3-barra-conta">{total === 1 ? t.comum.respostaUma : preencher(t.comum.respostas, { n: total })}</p>
        {situacao.logado && situacao.membro && <SeguirConversa raiz={dado.raiz} t={t} aoErro={aoErro} aoAvisar={(texto) => setAviso({ texto, erro: false })} />}
      </div>

      {post.id !== dado.raiz && (
        <p className="al3-aviso">
          <Link href={enderecos.post(lang, dado.raiz)}>{t.conversa.desdeOComeco}</Link>
        </p>
      )}

      <PostAberto post={post} lang={lang} t={t} logado={situacao.logado} aoErro={aoErro} />

      {aviso && (
        <p className="al3-aviso al3-entra" role={aviso.erro ? "alert" : "status"} key={aviso.texto}>
          {aviso.texto}
        </p>
      )}

      <div className="al3-ordem" role="group" aria-label={t.conversa.ordem} ref={ordemRef}>
        <span className="al3-regua" aria-hidden />
        <button type="button" aria-pressed={ordem === "antigas"} onClick={() => setOrdem("antigas")}>{t.conversa.antigas}</button>
        <button type="button" aria-pressed={ordem === "novas"} onClick={() => setOrdem("novas")}>{t.conversa.novas}</button>
      </div>

      <section aria-label={t.conversa.titulo} aria-busy={estado.chave !== chave}>
        {nos.length === 0 ? (
          <p className="al3-vazio">{t.conversa.nenhuma}</p>
        ) : (
          <ol className="al3-fio" ref={fio}>
            {nos.map((no, i) => (
              <Resposta key={no.post.id} no={no} indice={i} c={contexto} />
            ))}
          </ol>
        )}
      </section>

      <CitarTrecho raiz={tela} t={t} pode={podeResponder} posts={[post, ...dado.respostas]} aoCitar={citar} />

      <CaixaDeResposta
        lang={lang}
        s={s}
        t={t}
        situacao={situacao}
        destino={destino}
        raiz={post}
        pode={podeResponder}
        citacao={citacao}
        aoTirarCitacao={() => setCitacao(null)}
        aoVoltarAoPost={() => {
          setAlvo(null);
          setCitacao(null);
        }}
        aoEnviar={(nova) => {
          setAlvo(null);
          setCitacao(null);
          setAviso({ texto: t.conversa.enviada, erro: false });
          if (previa()) {
            setEstado((e) => (e && e.dado ? { ...e, dado: { ...e.dado, respostas: [...e.dado.respostas, { ...nova, servidor: null }] } } : e));
          } else setVersao((n) => n + 1);
        }}
        aoErro={aoErro}
      />
    </div>
  );
}

/**
 * Seguir a conversa (Onda B, X/Threads): um sininho na barra. Quem segue recebe UM aviso agrupado por conversa quando chegam
 * respostas; ninguém vê quem segue, nem quem escreveu o post (LGPD art. 5º, II, e art. 11).
 */
function SeguirConversa({ raiz, t, aoErro, aoAvisar }: { raiz: string; t: TextosDaAlumia3; aoErro: (e: unknown) => void; aoAvisar: (texto: string) => void }) {
  const [seguindo, setSeguindo] = useState<boolean | null>(previa() ? false : null);
  const [ocupado, setOcupado] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (previa()) return;
    let vivo = true;
    conversa
      .seguindo(raiz)
      .then((r) => vivo && setSeguindo(r.conversa === true))
      // Banco sem a migração ainda: o sininho não aparece (não promete o que não faz).
      .catch(() => vivo && setSeguindo(null));
    return () => {
      vivo = false;
    };
  }, [raiz]);
  if (seguindo === null) return null;
  async function alternar() {
    if (ocupado) return;
    const quer = !seguindo;
    setSeguindo(quer);
    pular(botao.current, 1.22);
    if (previa()) {
      aoAvisar(quer ? t.conversa.seguiu : t.conversa.deixouDeSeguir);
      return;
    }
    setOcupado(true);
    try {
      const r = await conversa.seguir(raiz, quer);
      setSeguindo(r.seguindo);
      aoAvisar(r.seguindo ? t.conversa.seguiu : t.conversa.deixouDeSeguir);
    } catch (e) {
      setSeguindo(!quer);
      aoErro(e);
    } finally {
      setOcupado(false);
    }
  }
  return (
    <button
      ref={botao}
      type="button"
      className="al3-sino"
      aria-pressed={seguindo}
      aria-label={seguindo ? t.conversa.seguindo : t.conversa.seguir}
      title={t.conversa.seguirRegra}
      disabled={ocupado}
      onClick={() => void alternar()}
    >
      <IconeSino aceso={seguindo} />
    </button>
  );
}

/** O post aberto (a dúvida da Lia na prancha), com a aula citada, as reações e uma linha discreta com Acender, Salvar e Compartilhar. */
function PostAberto({ post, lang, t, logado, aoErro }: { post: PostDaArvore; lang: string; t: TextosDaAlumia3; logado: boolean; aoErro: (e: unknown) => void }) {
  const acoes = useAcenderSalvar(post, aoErro);
  const handle = post.org?.handle ?? post.autor.handle ?? post.id;
  const [copiado, setCopiado] = useState(false);
  async function compartilhar() {
    const url = new URL(enderecos.post(lang, post.id), window.location.origin).toString();
    try {
      // No celular, a folha de compartilhar do aparelho; no computador, copiar o link.
      if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2400);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      aoErro(e);
    }
  }
  return (
    <article className="al3-raiz" aria-labelledby="al3-raiz-autor">
      <div className="al3-raiz-autor">
        <Avatar16 handle={handle} tamanho={48} />
        <div>
          <p id="al3-raiz-autor" className="al3-raiz-nome">
            <NomeDoAutor lang={lang} post={post} />
          </p>
          <p className="al3-cinza">
            {post.org ? <span title={t.comum.orgRegra}>{t.comum.orgVerificada}</span> : arroba(post)} ·{" "}
            <time dateTime={post.criado_em}>{tempoCurto(post.criado_em, lang)}</time>
          </p>
        </div>
      </div>
      {post.titulo && <h2 className="al3-raiz-titulo">{post.titulo}</h2>}
      <p className="al3-raiz-texto" data-citavel={post.id}>{post.texto}</p>
      {post.cita && <CartaoDeAula lang={lang} cita={post.cita} t={t} />}
      {post.reacoes && <Reacoes post={post} t={t} logado={logado} aoErro={aoErro} />}
      <div className="al3-post-acoes al3-raiz-acoes">
        <BotaoAcender t={t} logado={logado} {...acoes} />
        <BotaoSalvar t={t} logado={logado} {...acoes} />
        <button type="button" className="al3-acao" onClick={() => void compartilhar()}>{t.comum.compartilhar}</button>
        {copiado && <span className="al3-cinza al3-entra" role="status">{t.comum.copiado}</span>}
      </div>
    </article>
  );
}

/**
 * As reações com emoji (PLANO-ALUMIA §6.3): lista FECHADA, total por emoji (abaixo de 3, "poucas"), e a minha marcada. Ninguém vê
 * quem reagiu, nem quem escreveu. "Reagir" abre a paleta com os 8 da lista (Escape fecha e devolve o foco); a escolhida dá um pulo
 * e o número sobe no lugar. O banco confere a lista de novo (rede_alumia_reagir).
 */
function Reacoes({ post, t, logado, aoErro }: { post: Post; t: TextosDaAlumia3; logado: boolean; aoErro: (e: unknown) => void }) {
  const [reacoes, setReacoes] = useState<ReacaoDoPost[]>(post.reacoes ?? []);
  const [paleta, setPaleta] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const idDaRegra = useId();
  const idDaPaleta = useId();
  const bloco = useRef<HTMLDivElement>(null);
  const abrir = useRef<HTMLButtonElement>(null);
  const mostrar = reacoesParaMostrar(reacoes);

  useEffect(() => {
    if (!paleta) return;
    bloco.current?.querySelector<HTMLButtonElement>(".al3-paleta button")?.focus();
    const fora = (e: PointerEvent) => {
      if (!bloco.current?.contains(e.target as Node)) setPaleta(false);
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [paleta]);

  function pularEmoji(emoji: string) {
    requestAnimationFrame(() => pular(bloco.current?.querySelector(`[data-emoji="${CSS.escape(emoji)}"]`), 1.25));
  }

  async function reagir(emoji: string) {
    if (!reacaoOk(emoji) || ocupado) return;
    const minha = reacoes.find((r) => r.emoji === emoji)?.minha ?? false;
    const daPaleta = paleta;
    setPaleta(false);
    if (daPaleta) abrir.current?.focus();
    pularEmoji(emoji);
    if (previa()) {
      setReacoes((lista) => {
        const achada = lista.find((r) => r.emoji === emoji);
        if (!achada) return [...lista, { emoji, total: null, minha: true }];
        return lista.map((r) => (r.emoji === emoji ? { ...r, minha: !minha, total: r.total === null ? null : r.total + (minha ? -1 : 1) } : r));
      });
      return;
    }
    setOcupado(true);
    try {
      const r = await conversa.reagirEmoji(post.id, emoji, !minha);
      setReacoes(r.reacoes);
    } catch (e) {
      aoErro(e);
    } finally {
      setOcupado(false);
    }
  }

  if (mostrar.length === 0 && !logado) return null;
  return (
    <div className="al3-reacoes-bloco" ref={bloco}>
      <div className="al3-reacoes" role="group" aria-label={t.reacoes.rotulo} aria-describedby={idDaRegra}>
        {mostrar.map((r) => (
          <button
            key={r.emoji}
            type="button"
            className="al3-reacao"
            data-emoji={r.emoji}
            aria-pressed={r.minha}
            disabled={!logado || ocupado}
            aria-label={`${t.reacoes.nomes[r.nome]}: ${r.total ?? t.reacoes.poucas}${r.minha ? ` (${t.reacoes.minha})` : ""}`}
            onClick={() => void reagir(r.emoji)}
          >
            <span aria-hidden className="al3-reacao-emoji">{r.emoji}</span>
            <span aria-hidden className="al3-reacao-n" key={`${r.total ?? "p"}`}>{r.total ?? t.reacoes.poucas}</span>
          </button>
        ))}
        {logado && (
          <button
            ref={abrir}
            type="button"
            className="al3-reacao al3-reacao-abrir"
            aria-expanded={paleta}
            aria-controls={idDaPaleta}
            disabled={ocupado}
            onClick={() => setPaleta((p) => !p)}
          >
            {paleta ? t.reacoes.fechar : `+ ${t.reacoes.reagir}`}
          </button>
        )}
      </div>
      <div
        className="al3-paleta"
        id={idDaPaleta}
        role="group"
        aria-label={t.reacoes.reagir}
        hidden={!paleta}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            setPaleta(false);
            abrir.current?.focus();
          }
        }}
      >
        {paleta &&
          REACOES.map((r, i) => (
            <button
              key={r.emoji}
              type="button"
              style={{ "--i": i } as CSSProperties}
              aria-label={preencher(t.conversa.reagirComo, { nome: t.reacoes.nomes[r.nome] })}
              onClick={() => void reagir(r.emoji)}
            >
              {r.emoji}
            </button>
          ))}
      </div>
      <p className="al3-regra" id={idDaRegra}>{t.reacoes.regra}</p>
    </div>
  );
}

/** O que cada resposta do fio precisa saber da tela (um objeto só, em vez de doze props repetidas pela árvore). */
interface ContextoDoFio {
  lang: string;
  t: TextosDaAlumia3;
  aberta: string | null;
  alternar: (id: string) => void;
  recolhidas: ReadonlySet<string>;
  recolher: (id: string) => void;
  aceitaId: string | null;
  seloAjudou: string;
  podeAjudou: boolean;
  podeResponder: boolean;
  logado: boolean;
  alvo: string | null;
  aoResponder: (p: Post) => void;
  aoAjudou: (p: Post, quer: boolean) => void;
  aoErro: (e: unknown) => void;
}

/**
 * Uma resposta do fio, em árvore: rosto com a linha que desce até as respostas a ela, nome, @, selo "ajudou", selo do servidor do
 * Fediverso, texto e um "…" visível (disclosure com aria-expanded) que abre as ações deslizando, sem empurrar a página de uma vez.
 * As respostas a ela ficam numa lista dentro (o leitor de tela anuncia o nível), com o cotovelo que liga cada uma ao fio, e podem
 * ser recolhidas ("Recolher N respostas").
 */
function Resposta({ no, indice, c }: { no: NoDaArvore; indice: number; c: ContextoDoFio }) {
  const p = no.post;
  const { t, lang } = c;
  const acoes = useAcenderSalvar(p, c.aoErro);
  const servidor = servidorDaResposta(p);
  const nivel = Math.min(no.nivel, 5);
  const temFilhos = no.filhos.length > 0;
  const recolhida = c.recolhidas.has(p.id);
  const aberta = c.aberta === p.id;
  const idDasAcoes = `al3-acoes-${p.id}`;
  const idDosFilhos = `al3-filhos-${p.id}`;
  const estilo = { "--i": indice } as CSSProperties;

  const filhos = temFilhos && (
    <div className="al3-ramo" data-recolhido={recolhida ? "sim" : "nao"} id={idDosFilhos} inert={recolhida}>
      <ol className={`al3-filhos${nivel >= 4 ? " al3-filhos-raso" : ""}`}>
        {no.filhos.map((f, i) => (
          <Resposta key={f.post.id} no={f} indice={i} c={c} />
        ))}
      </ol>
    </div>
  );

  if (p.silenciada) {
    return (
      <li className="al3-resposta al3-resposta-silenciada" data-nivel={nivel} data-flip={p.id} style={estilo}>
        <span className="al3-resposta-lado" aria-hidden>
          <span className="al3-fio-linha" />
        </span>
        <p className="al3-silenciada">{t.conversa.silenciada}</p>
        {filhos}
      </li>
    );
  }
  return (
    <li
      className="al3-resposta"
      data-nivel={nivel}
      data-flip={p.id}
      data-tem-filhos={temFilhos ? "sim" : "nao"}
      data-alvo={c.alvo === p.id ? "sim" : undefined}
      style={estilo}
    >
      <span className="al3-resposta-lado">
        <Avatar16 handle={p.autor.handle ?? p.id} tamanho={32} />
        {temFilhos && !recolhida && <span className="al3-fio-linha" aria-hidden />}
      </span>
      <div className="al3-resposta-corpo">
        <div className="al3-resposta-topo">
          <p className="al3-resposta-cabeca">
            <NomeDoAutor lang={lang} post={p} />
            <span className="al3-cinza al3-arroba">{arroba(p)}</span>
            {c.aceitaId === p.id && <span className="al3-ajudou">{c.seloAjudou}</span>}
          </p>
          <button
            type="button"
            className="al3-resposta-mais"
            aria-expanded={aberta}
            aria-controls={idDasAcoes}
            aria-label={preencher(t.conversa.acoesDe, { codinome: p.autor.codinome })}
            onClick={() => c.alternar(p.id)}
          >
            <IconeMais />
          </button>
        </div>
        {servidor && (
          <span className="al3-servidor" role="note" aria-label={preencher(t.conversa.fediverso, { servidor })} title={preencher(t.conversa.fediverso, { servidor })}>
            <IconeGlobo />
            <span aria-hidden>{servidor}</span>
          </span>
        )}
        <p className="al3-resposta-texto" data-citavel={p.id}>{p.texto}</p>
        <div className="al3-gaveta" data-aberta={aberta ? "sim" : "nao"} id={idDasAcoes} inert={!aberta}>
          <div className="al3-resposta-acoes">
            {c.podeResponder && (
              <button type="button" className="al3-acao" onClick={() => c.aoResponder(p)}>{t.comum.responder}</button>
            )}
            <BotaoAcender t={t} logado={c.logado} {...acoes} />
            {c.podeAjudou && !p.meu && (
              <button type="button" className="al3-acao" aria-pressed={c.aceitaId === p.id} title={t.conversa.ajudouRegra} onClick={() => c.aoAjudou(p, c.aceitaId !== p.id)}>
                {c.aceitaId === p.id ? t.conversa.desmarcarAjudou : t.conversa.marcarAjudou}
              </button>
            )}
            {p.respostas > no.filhos.length && (
              <Link href={enderecos.post(lang, p.id)} className="al3-acao">{preencher(t.conversa.continuar, { n: p.respostas })}</Link>
            )}
          </div>
        </div>
        {temFilhos && (
          <button type="button" className="al3-recolher" aria-expanded={!recolhida} aria-controls={idDosFilhos} onClick={() => c.recolher(p.id)}>
            <span className="al3-recolher-seta" aria-hidden />
            {contarNos(no.filhos) === 1
              ? recolhida ? t.conversa.mostrarUma : t.conversa.recolherUma
              : preencher(recolhida ? t.conversa.mostrarRamo : t.conversa.recolherRamo, { n: contarNos(no.filhos) })}
          </button>
        )}
      </div>
      {filhos}
    </li>
  );
}

/**
 * "Citar trecho" (Onda B, Medium/Kindle): quem seleciona um pedaço de um post da conversa ganha um botão logo abaixo da seleção.
 * Tocar leva o trecho para a caixa de resposta, como citação ("> trecho"), respondendo ao post de onde ele saiu. Só lê a seleção
 * dentro dos textos marcados com [data-citavel]; nada sai do aparelho até a pessoa enviar.
 */
function CitarTrecho({
  raiz,
  t,
  pode,
  posts,
  aoCitar,
}: {
  raiz: RefObject<HTMLDivElement | null>;
  t: TextosDaAlumia3;
  pode: boolean;
  posts: readonly Post[];
  aoCitar: (c: Citacao) => void;
}) {
  const [achado, setAchado] = useState<{ x: number; y: number; post: string; trecho: string } | null>(null);
  useEffect(() => {
    if (!pode) return;
    let quadro = 0;
    const ver = () => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) return setAchado(null);
        const de = (n: Node | null) => (n instanceof Element ? n : n?.parentElement)?.closest<HTMLElement>("[data-citavel]") ?? null;
        const a = de(sel.anchorNode);
        const b = de(sel.focusNode);
        const trecho = sel.toString().replace(/\s+/g, " ").trim();
        if (!a || a !== b || !raiz.current?.contains(a) || trecho.length < 3) return setAchado(null);
        const r = sel.getRangeAt(0).getBoundingClientRect();
        setAchado({ x: Math.min(Math.max(r.left + r.width / 2, 90), window.innerWidth - 90), y: r.bottom + 10, post: a.dataset.citavel ?? "", trecho });
      });
    };
    document.addEventListener("selectionchange", ver);
    window.addEventListener("scroll", ver, { passive: true });
    return () => {
      cancelAnimationFrame(quadro);
      document.removeEventListener("selectionchange", ver);
      window.removeEventListener("scroll", ver);
    };
  }, [pode, raiz]);
  if (!achado) return null;
  const post = posts.find((p) => p.id === achado.post);
  if (!post) return null;
  return (
    <button
      type="button"
      className="al3-citar-trecho"
      style={{ left: achado.x, top: achado.y }}
      // Sem tirar a seleção ao tocar (o toque não vira clique no texto).
      onPointerDown={(e) => e.preventDefault()}
      onClick={() => {
        const trecho = achado.trecho.length > TRECHO_MAX ? `${achado.trecho.slice(0, TRECHO_MAX - 1)}…` : achado.trecho;
        window.getSelection()?.removeAllRanges();
        setAchado(null);
        aoCitar({ post, trecho });
      }}
    >
      <IconeAspas />
      {t.conversa.citarTrecho}
    </button>
  );
}

/** "Responder para @liaquilombo" + enviar (vermelho). Passa pelas verificações das frentes antes (o servidor confere de novo). */
function CaixaDeResposta({
  lang,
  s,
  t,
  situacao,
  destino,
  raiz,
  pode,
  citacao,
  aoTirarCitacao,
  aoVoltarAoPost,
  aoEnviar,
  aoErro,
}: {
  lang: string;
  s: TextosDaRede;
  t: TextosDaAlumia3;
  situacao: Situacao;
  destino: Post;
  raiz: Post;
  pode: boolean;
  citacao: Citacao | null;
  aoTirarCitacao: () => void;
  aoVoltarAoPost: () => void;
  aoEnviar: (p: PostDaArvore) => void;
  aoErro: (e: unknown) => void;
}) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  // O resultado da última conferência: um alerta deixa "Enviar assim mesmo"; um bloqueio não (o servidor recusa de novo).
  const [conferir, setConferir] = useState<{ aviso: string; bloqueia: boolean } | null>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const enviar$ = useRef<HTMLButtonElement>(null);
  const handle = destino.autor.handle?.replace(/^@/, "");
  const rotulo = handle ? preencher(t.conversa.responderPara, { handle }) : preencher(t.conversa.responderParaNome, { codinome: destino.autor.codinome });
  const cabecaDaCitacao = citacao ? `> ${citacao.trecho}\n\n` : "";
  const limite = LIMITE - cabecaDaCitacao.length;

  if (!pode) {
    return (
      <div className="al3-responder">
        <p className="al3-cinza" style={{ gridColumn: "1 / -1", margin: 0 }}>{raiz.travado ? t.conversa.travada : t.conversa.entrePrimeiro}</p>
      </div>
    );
  }

  async function enviar(mesmoAssim = false) {
    const limpo = texto.trim();
    if (!limpo || enviando) return;
    // Um bloqueio nunca é contornado pela tela: "assim mesmo" só vale depois de um alerta.
    if (mesmoAssim && conferir?.bloqueia !== false) return;
    const final = `${cabecaDaCitacao}${limpo}`.slice(0, LIMITE);
    setEnviando(true);
    try {
      if (!mesmoAssim) {
        const r = await verificarAntesDePublicar(
          { texto: final, tipo: "post", publico: raiz.publico, comunidade: raiz.comunidade, extras: { resposta_a: destino.id } },
          { lang, s, situacao },
        );
        if (!r.ok) {
          setConferir({ aviso: r.aviso, bloqueia: Boolean(r.bloqueia) });
          return;
        }
      }
      setConferir(null);
      const nova = previa()
        ? postDeExemplo({ id: crypto.randomUUID(), texto: final, resposta_a: destino.id, raiz: raiz.id, nivel: (destino.nivel ?? 0) + 1, meu: true, criado_em: new Date().toISOString() })
        : await rede.publicar({ texto: final, resposta_a: destino.id });
      pular(enviar$.current, 1.15);
      setTexto("");
      if (campo.current) campo.current.style.height = "";
      aoEnviar(nova);
    } catch (e) {
      aoErro(e);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form
      className="al3-responder"
      data-enviando={enviando ? "sim" : undefined}
      onSubmit={(e) => {
        e.preventDefault();
        void enviar();
      }}
    >
      {(destino.id !== raiz.id || conferir || citacao) && (
        <div className="al3-responder-linha al3-entra">
          {citacao && (
            <span className="al3-citacao">
              <IconeAspas />
              <span className="al3-citacao-texto">{preencher(t.conversa.citando, { trecho: citacao.trecho })}</span>
              <button type="button" onClick={aoTirarCitacao}>{t.conversa.tirarCitacao}</button>
            </span>
          )}
          {destino.id !== raiz.id && <button type="button" onClick={aoVoltarAoPost}>{t.conversa.voltarAoPost}</button>}
          {conferir && (
            <>
              <span role="alert">{preencher(t.conversa.conferirAntes, { aviso: conferir.aviso })}</span>
              <button type="button" onClick={() => (setConferir(null), campo.current?.focus())}>{t.conversa.revisar}</button>
              {!conferir.bloqueia && <button type="button" onClick={() => void enviar(true)}>{t.conversa.enviarMesmo}</button>}
            </>
          )}
        </div>
      )}
      <label className="al3-sr" htmlFor="al3-responder">{rotulo}</label>
      <textarea
        id="al3-responder"
        ref={campo}
        rows={1}
        maxLength={limite}
        placeholder={rotulo}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          // Altura automática (sem a alça de redimensionar da prancha): cresce com o texto até o teto do CSS.
          const el = e.currentTarget;
          el.style.height = "auto";
          el.style.height = `${el.scrollHeight}px`;
        }}
        onKeyDown={(e) => {
          // Ctrl/⌘ + Enter envia (Enter sozinho quebra a linha, como em toda caixa de texto).
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void enviar();
          }
        }}
        aria-describedby="al3-contador"
      />
      <button ref={enviar$} type="submit" className="al3-enviar" disabled={enviando || !texto.trim()} aria-label={enviando ? t.conversa.enviando : t.conversa.enviar}>
        <IconeEnviar />
      </button>
      <span id="al3-contador" className="al3-sr">{preencher(t.conversa.contador, { n: texto.length, max: limite })}</span>
      {texto.length > limite - 60 && (
        <span className="al3-contador-visivel" aria-hidden data-perto={texto.length >= limite ? "fim" : "perto"}>
          {limite - texto.length}
        </span>
      )}
    </form>
  );
}
