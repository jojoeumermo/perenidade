// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "@/components/Link";
import { rede } from "@/lib/rede/cliente";
import { conversa } from "@/lib/rede/cliente-conversa";
import { arvoreDeExemplo, postDeExemplo } from "@/lib/rede/conversa/exemplos";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { TextosDaAlumia3 } from "@/lib/rede/textos-conversa";
import { enderecos, type Post, type Situacao } from "@/lib/rede/tipos";
import {
  generoDoAjudou,
  montarArvore,
  servidorDaResposta,
  tempoCurto,
  type Arvore,
  type NoDaArvore,
  type PostDaArvore,
} from "@/lib/rede/tipos-conversa";
import { verificarAntesDePublicar } from "../encaixes";
import { textoDoErro } from "../erros";
import { EsqueletoDaLinha } from "../Esqueletos";
import { Avatar16 } from "../ui/Avatar16";
import { CartaoDeAula, FaixaDaPrevia, IconeEnviar, IconeGlobo, IconeMais, IconeVoltar, NomeDoAutor, previa, useAcenderSalvar, useTextosAlumia3 } from "./base3";

const LIMITE = 500;

/** Os nós em fila, na ordem de leitura (cada resposta logo depois da que ela responde). */
function emFila(nos: readonly NoDaArvore[]): NoDaArvore[] {
  return nos.flatMap((no) => [no, ...emFila(no.filhos)]);
}

/** O @ que aparece: "@liaquilombo", e para quem veio do Fediverso o endereço inteiro ("@porto@mastodon.social"). */
const arroba = (p: Post) => (p.autor.handle ? `@${p.autor.handle.replace(/^@/, "")}` : "");

/**
 * A conversa na Alumia nova (prancha celular-conversa-fediverso; PLANO-ALUMIA §3 e §8 F3): barra "CONVERSA · N respostas", o post
 * com a aula citada, "Mais antigas / Mais novas", o fio
 * com as linhas, o selo "ajudou a autora" (pelo pronome que a pessoa escreveu, nunca por palpite), a resposta vinda do
 * Fediverso com o selo do servidor (só o nome do servidor, que já é público no @; nada de IP) e a caixa "Responder para @…"
 * fixa embaixo. O "…" de cada resposta abre Responder, Acender e (para quem abriu a conversa) "ajudou".
 *
 * As reações com emoji (PLANO-ALUMIA §6.3) NÃO aparecem aqui: a prancha não tem essa fileira e a função do banco ainda não
 * existe. Elas voltam quando a migração do back-end da F3 entrar, atrás de flag própria.
 */
export default function TelaDaConversaAlumia({ id, lang, s, situacao }: { id: string; lang: string; s: TextosDaRede; situacao: Situacao }) {
  const t = useTextosAlumia3(lang);
  const [ordem, setOrdem] = useState<"antigas" | "novas">("antigas");
  const [estado, setEstado] = useState<{ chave: string; dado: Arvore | null; erro: string } | null>(null);
  const [versao, setVersao] = useState(0);
  const [aviso, setAviso] = useState<{ texto: string; erro: boolean } | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<Post | null>(null);
  const chave = `${id}:${ordem}:${versao}`;

  useEffect(() => {
    let vivo = true;
    const pedir = previa() ? Promise.resolve(arvoreDeExemplo(id)) : conversa.arvore(id, ordem);
    pedir
      .then((dado) => {
        if (!vivo) return;
        // Na prévia a ordem é feita aqui (o banco já devolve na ordem pedida).
        if (previa() && ordem === "novas") dado = { ...dado, respostas: [...dado.respostas].reverse().sort((a, b) => (a.nivel - b.nivel) || 0) };
        setEstado({ chave, dado, erro: "" });
      })
      .catch((e) => vivo && setEstado({ chave, dado: null, erro: textoDoErro(s, e) }));
    return () => {
      vivo = false;
    };
  }, [id, ordem, chave, s]);

  const aoErro = useCallback((e: unknown) => setAviso({ texto: textoDoErro(s, e), erro: true }), [s]);

  if (!t || !estado) return <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={3} />;
  if (!estado.dado) {
    return (
      <div className="al3 al3-vazio" role="alert">
        <p>{estado.erro || s.estados.naoEncontrado}</p>
        <button type="button" className="al-botao al-botao-contorno al-botao-m" onClick={() => setVersao((n) => n + 1)}>
          {s.estados.tentar}
        </button>
      </div>
    );
  }
  const dado = estado.dado;
  const post = dado.post;
  const raizPost = post.id === dado.raiz ? post : dado.acima.find((p) => p.id === dado.raiz) ?? null;
  const aceitaId = raizPost?.aceita ?? null;
  const genero = generoDoAjudou(dado.pronomes_da_raiz);
  const seloAjudou = genero === "a" ? t.conversa.ajudouA : genero === "o" ? t.conversa.ajudouO : t.conversa.ajudouQuem;
  const nos = emFila(montarArvore(post.id, dado.respostas));
  const total = post.na_conversa ?? post.respostas;
  const podeResponder = situacao.logado && situacao.membro && !post.travado;
  const destino = alvo ?? post;

  async function marcarAjudou(resposta: Post, quer: boolean) {
    if (previa()) {
      setEstado((e) => e && e.dado ? { ...e, dado: { ...e.dado, post: { ...e.dado.post, aceita: quer ? resposta.id : null } } } : e);
      return;
    }
    try {
      await conversa.aceitar(resposta.id, quer);
      setVersao((n) => n + 1);
    } catch (e) {
      aoErro(e);
    }
  }

  return (
    <div className="al3 al3-conversa">
      <FaixaDaPrevia t={t} />
      <div className="al3-barra">
        <Link href={raizPost?.comunidade ? enderecos.comunidade(lang, raizPost.comunidade) : enderecos.linha(lang)} className="al3-voltar" aria-label={t.conversa.voltar}>
          <IconeVoltar />
        </Link>
        <h1 className="al3-cond">{t.conversa.titulo}</h1>
        <p className="al3-barra-conta">{total === 1 ? t.comum.respostaUma : preencher(t.comum.respostas, { n: total })}</p>
      </div>

      {post.id !== dado.raiz && (
        <p className="al3-aviso">
          <Link href={enderecos.post(lang, dado.raiz)}>{t.conversa.desdeOComeco}</Link>
        </p>
      )}

      <PostAberto post={post} lang={lang} t={t} logado={situacao.logado} aoErro={aoErro} />

      {aviso && (
        <p className="al3-aviso" role={aviso.erro ? "alert" : "status"}>
          {aviso.texto}
        </p>
      )}

      <div className="al3-ordem" role="group" aria-label={t.conversa.ordem}>
        <button type="button" aria-pressed={ordem === "antigas"} onClick={() => setOrdem("antigas")}>{t.conversa.antigas}</button>
        <button type="button" aria-pressed={ordem === "novas"} onClick={() => setOrdem("novas")}>{t.conversa.novas}</button>
      </div>

      <section aria-label={t.conversa.titulo}>
        {nos.length === 0 ? (
          <p className="al3-vazio">{t.conversa.nenhuma}</p>
        ) : (
          <ol className="al3-fio">
            {nos.map((no) => (
              <Resposta
                key={no.post.id}
                no={no}
                lang={lang}
                t={t}
                aberta={aberta === no.post.id}
                aoAbrir={() => setAberta((a) => (a === no.post.id ? null : no.post.id))}
                ajudou={aceitaId === no.post.id}
                seloAjudou={seloAjudou}
                podeAjudou={dado.pode_aceitar || (previa() && raizPost?.meu === true)}
                podeResponder={podeResponder}
                logado={situacao.logado}
                aoResponder={() => {
                  setAlvo(no.post);
                  setAberta(null);
                  document.getElementById("al3-responder")?.focus();
                }}
                aoAjudou={(quer) => void marcarAjudou(no.post, quer)}
                aoErro={aoErro}
              />
            ))}
          </ol>
        )}
      </section>

      <CaixaDeResposta
        lang={lang}
        s={s}
        t={t}
        situacao={situacao}
        destino={destino}
        raiz={post}
        pode={podeResponder}
        aoVoltarAoPost={() => setAlvo(null)}
        aoEnviar={(nova) => {
          setAlvo(null);
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

/** O post aberto (a dúvida da Lia na prancha), com a aula citada e uma linha discreta com Acender, Salvar e Compartilhar. */
function PostAberto({ post, lang, t, logado, aoErro }: { post: PostDaArvore; lang: string; t: TextosDaAlumia3; logado: boolean; aoErro: (e: unknown) => void }) {
  const { apoiei, salvei, ocupado, acender, salvar } = useAcenderSalvar(post, aoErro);
  const handle = post.org?.handle ?? post.autor.handle ?? post.id;
  const [copiado, setCopiado] = useState(false);
  async function compartilhar() {
    try {
      await navigator.clipboard.writeText(new URL(enderecos.post(lang, post.id), window.location.origin).toString());
      setCopiado(true);
    } catch (e) {
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
      <p className="al3-raiz-texto">{post.texto}</p>
      {post.cita && <CartaoDeAula lang={lang} cita={post.cita} t={t} />}
      <div className="al3-post-acoes al3-raiz-acoes">
        <button type="button" className="al3-acao" aria-pressed={apoiei} disabled={!logado || ocupado} onClick={() => void acender()}>
          {apoiei ? t.comum.aceso : t.comum.acender}
        </button>
        <button type="button" className="al3-acao" aria-pressed={salvei} disabled={!logado || ocupado} onClick={() => void salvar()}>
          {salvei ? t.comum.salvo : t.comum.salvar}
        </button>
        <button type="button" className="al3-acao" onClick={() => void compartilhar()}>{t.comum.compartilhar}</button>
        {copiado && <span className="al3-cinza" role="status">{t.comum.copiado}</span>}
      </div>
    </article>
  );
}

/**
 * Uma resposta do fio: rosto, nome, @, selo "ajudou", selo do servidor do Fediverso, texto e, ao lado do nome, um "…" visível
 * (disclosure com aria-expanded) que abre as ações. O texto fica fora do botão: o leitor de tela lê a resposta inteira.
 */
function Resposta({
  no,
  lang,
  t,
  aberta,
  aoAbrir,
  ajudou,
  seloAjudou,
  podeAjudou,
  podeResponder,
  logado,
  aoResponder,
  aoAjudou,
  aoErro,
}: {
  no: NoDaArvore;
  lang: string;
  t: TextosDaAlumia3;
  aberta: boolean;
  aoAbrir: () => void;
  ajudou: boolean;
  seloAjudou: string;
  podeAjudou: boolean;
  podeResponder: boolean;
  logado: boolean;
  aoResponder: () => void;
  aoAjudou: (quer: boolean) => void;
  aoErro: (e: unknown) => void;
}) {
  const p = no.post;
  const { apoiei, ocupado, acender } = useAcenderSalvar(p, aoErro);
  const servidor = servidorDaResposta(p);
  const nivel = Math.min(no.nivel, 5);
  if (p.silenciada) {
    return (
      <li className="al3-resposta" data-nivel={nivel}>
        <span />
        <p className="al3-silenciada">{t.conversa.silenciada}</p>
      </li>
    );
  }
  const idDasAcoes = `al3-acoes-${p.id}`;
  return (
    <li className="al3-resposta" data-nivel={nivel} data-tem-filhos={no.filhos.length > 0 ? "sim" : "nao"}>
      <Avatar16 handle={p.autor.handle ?? p.id} tamanho={32} />
      <div>
        <div className="al3-resposta-topo">
          <p className="al3-resposta-cabeca">
            <NomeDoAutor lang={lang} post={p} />
            <span className="al3-cinza al3-arroba">{arroba(p)}</span>
            {ajudou && <span className="al3-ajudou">{seloAjudou}</span>}
          </p>
          <button
            type="button"
            className="al3-resposta-mais"
            aria-expanded={aberta}
            aria-controls={idDasAcoes}
            aria-label={preencher(t.conversa.acoesDe, { codinome: p.autor.codinome })}
            onClick={aoAbrir}
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
        <p className="al3-resposta-texto">{p.texto}</p>
        <div className="al3-resposta-acoes" id={idDasAcoes} hidden={!aberta}>
          {podeResponder && (
            <button type="button" className="al3-acao" onClick={aoResponder}>{t.comum.responder}</button>
          )}
          <button type="button" className="al3-acao" aria-pressed={apoiei} disabled={!logado || ocupado} onClick={() => void acender()}>
            {apoiei ? t.comum.aceso : t.comum.acender}
          </button>
          {podeAjudou && (
            <button type="button" className="al3-acao" aria-pressed={ajudou} title={t.conversa.ajudouRegra} onClick={() => aoAjudou(!ajudou)}>
              {ajudou ? t.conversa.desmarcarAjudou : t.conversa.marcarAjudou}
            </button>
          )}
          {p.respostas > no.filhos.length && (
            <Link href={enderecos.post(lang, p.id)} className="al3-acao">{preencher(t.conversa.continuar, { n: p.respostas })}</Link>
          )}
        </div>
      </div>
    </li>
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
  aoVoltarAoPost: () => void;
  aoEnviar: (p: PostDaArvore) => void;
  aoErro: (e: unknown) => void;
}) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  // O resultado da última conferência: um alerta deixa "Enviar assim mesmo"; um bloqueio não (o servidor recusa de novo).
  const [conferir, setConferir] = useState<{ aviso: string; bloqueia: boolean } | null>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const handle = destino.autor.handle?.replace(/^@/, "");
  const rotulo = handle ? preencher(t.conversa.responderPara, { handle }) : preencher(t.conversa.responderParaNome, { codinome: destino.autor.codinome });

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
    setEnviando(true);
    try {
      if (!mesmoAssim) {
        const r = await verificarAntesDePublicar(
          { texto: limpo, tipo: "post", publico: raiz.publico, comunidade: raiz.comunidade, extras: { resposta_a: destino.id } },
          { lang, s, situacao },
        );
        if (!r.ok) {
          setConferir({ aviso: r.aviso, bloqueia: Boolean(r.bloqueia) });
          return;
        }
      }
      setConferir(null);
      const nova = previa()
        ? postDeExemplo({ id: crypto.randomUUID(), texto: limpo, resposta_a: destino.id, raiz: raiz.id, nivel: (destino.nivel ?? 0) + 1, meu: true, criado_em: new Date().toISOString() })
        : await rede.publicar({ texto: limpo, resposta_a: destino.id });
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
      onSubmit={(e) => {
        e.preventDefault();
        void enviar();
      }}
    >
      {(destino.id !== raiz.id || conferir) && (
        <div className="al3-responder-linha">
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
        maxLength={LIMITE}
        placeholder={rotulo}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          // Altura automática (sem a alça de redimensionar da prancha): cresce com o texto até o teto do CSS.
          const el = e.currentTarget;
          el.style.height = "auto";
          el.style.height = `${el.scrollHeight}px`;
        }}
        aria-describedby="al3-contador"
      />
      <button type="submit" className="al3-enviar" disabled={enviando || !texto.trim()} aria-label={enviando ? t.conversa.enviando : t.conversa.enviar}>
        <IconeEnviar />
      </button>
      <span id="al3-contador" className="al3-sr">{preencher(t.conversa.contador, { n: texto.length, max: LIMITE })}</span>
    </form>
  );
}
