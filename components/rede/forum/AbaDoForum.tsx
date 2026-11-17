// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "@/components/Link";
import { forum, topicosDeExemplo, ESTADOS_DO_TOPICO, ORDENS_DO_FORUM, type EstadoDoTopico, type FiltroDoForum, type OrdemDoForum, type PaginaDoForum, type TopicoDoForum } from "@/lib/rede/forum-conversa";
import { armazemDoAparelho, lerRegistro, temNovidade, type RegistroDeLeitura } from "@/lib/rede/leitura-conversa";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDoForum } from "@/lib/rede/textos-forum-conversa";
import { enderecos } from "@/lib/rede/tipos";
import { tempoCurto } from "@/lib/rede/tipos-conversa";
import type { ContextoDoEncaixe } from "../encaixes";
import { previa } from "../conversa/base3";
import { CarimboDoEstado, erroDoForum, useTextosDoForum } from "./base";
import { NovoTopico } from "./NovoTopico";
import "./forum.css";

/**
 * A aba "Fórum" da comunidade (onda 10, 10A; pendurada pelo encaixe abasDaComunidade de components/rede/conversa/encaixe.tsx). Cada
 * assunto é um tópico: título, etiqueta da comunidade, situação (aberto, encaminhado, resolvido) em carimbo com ícone e texto, o
 * resumo de uma linha quando há, quantas respostas e há quanto tempo veio a última. A ordem é uma das três cronológicas, escolhida
 * à vista e com a regra escrita embaixo; é a mesma para todo mundo (nada de reação, alcance ou perfil de quem lê). A marca "Novas"
 * sai só do que este aparelho lembra (lib/rede/leitura-conversa.ts): o servidor não recebe o que cada pessoa leu.
 */
export function AbaDoForum({ lang, s, situacao, slug }: ContextoDoEncaixe & { slug: string }) {
  const tf = useTextosDoForum(lang);
  const [ordem, setOrdem] = useState<OrdemDoForum>("ultima");
  const [estado, setEstado] = useState<EstadoDoTopico | null>(null);
  const [etiqueta, setEtiqueta] = useState<string | null>(null);
  const [pagina, setPagina] = useState<{ chave: string; dado: PaginaDoForum | null; erro: string } | null>(null);
  const [mais, setMais] = useState<{ itens: TopicoDoForum[]; proximo: PaginaDoForum["proximo"]; buscando: boolean }>({ itens: [], proximo: null, buscando: false });
  const [versao, setVersao] = useState(0);
  const [abrindo, setAbrindo] = useState(false);
  const [aviso, setAviso] = useState("");
  // O que este aparelho lembra de cada conversa (lido uma vez ao abrir a aba; nada vai ao servidor).
  const [lidos] = useState<RegistroDeLeitura>(() => lerRegistro(armazemDoAparelho()));
  const idTitulo = useId();
  const idEtiqueta = useId();
  const botaoAbrir = useRef<HTMLButtonElement>(null);
  const chave = `${slug}:${ordem}:${estado ?? ""}:${etiqueta ?? ""}:${versao}`;

  useEffect(() => {
    let vivo = true;
    const filtro: FiltroDoForum = { ordem, estado, etiqueta };
    const pedir = previa() ? Promise.resolve(topicosDeExemplo(slug, filtro)) : forum.lista(slug, filtro);
    pedir
      .then((dado) => {
        if (!vivo) return;
        setPagina({ chave, dado, erro: "" });
        setMais({ itens: [], proximo: dado.proximo, buscando: false });
      })
      .catch((e) => vivo && setPagina({ chave, dado: null, erro: tf ? erroDoForum(tf, s, e) : String(e) }));
    return () => {
      vivo = false;
    };
  }, [slug, ordem, estado, etiqueta, chave, s, tf]);

  const carregarMais = useCallback(async () => {
    if (!mais.proximo || mais.buscando || !tf) return;
    setMais((m) => ({ ...m, buscando: true }));
    try {
      const r = await forum.lista(slug, { ordem, estado, etiqueta, depois: mais.proximo });
      setMais((m) => ({ itens: [...m.itens, ...r.itens], proximo: r.proximo, buscando: false }));
    } catch (e) {
      setMais((m) => ({ ...m, buscando: false }));
      setAviso(erroDoForum(tf, s, e));
    }
  }, [mais.proximo, mais.buscando, slug, ordem, estado, etiqueta, tf, s]);

  if (!tf) return null;
  const dado = pagina?.dado ?? null;
  const carregando = !pagina || pagina.chave !== chave;
  const itens = dado ? [...dado.itens, ...mais.itens] : [];
  const filtrando = Boolean(estado || etiqueta || ordem === "sem_resposta");
  // O filtro vale também para os fixados: com "Resolvidos", um fixado aberto não fica no alto contradizendo a lista vazia.
  const fixadosVisiveis = (dado?.fixados ?? []).filter(
    (t) => (!estado || t.estado === estado) && (!etiqueta || t.etiqueta === etiqueta) && (ordem !== "sem_resposta" || t.respostas === 0),
  );

  return (
    <section className="f10 f10-forum" aria-labelledby={idTitulo} aria-busy={carregando}>
      <header className="f10-cabeca">
        <div className="f10-cabeca-texto">
          <h2 id={idTitulo} className="f10-cond">{tf.titulo}</h2>
          <p className="f10-lead">{tf.lead}</p>
        </div>
        {dado?.pode_abrir ? (
          <button
            ref={botaoAbrir}
            type="button"
            className="al-botao al-botao-primario al-botao-m f10-abrir"
            aria-expanded={abrindo}
            onClick={() => setAbrindo((a) => !a)}
          >
            <IconeMais />
            {tf.abrir}
          </button>
        ) : (
          dado && situacao.logado && <p className="f10-nota">{tf.entrarParaAbrir}</p>
        )}
      </header>

      {abrindo && dado && (
        <NovoTopico
          slug={slug}
          lang={lang}
          s={s}
          situacao={situacao}
          tf={tf}
          etiquetas={dado.etiquetas}
          aoFechar={() => {
            setAbrindo(false);
            botaoAbrir.current?.focus();
          }}
          aoPublicar={(texto) => {
            setAbrindo(false);
            setAviso(texto);
            setOrdem("novos");
            setVersao((n) => n + 1);
          }}
        />
      )}

      <div className="f10-controles">
        <div className="f10-ordem" role="group" aria-label={tf.ordem.rotulo}>
          {ORDENS_DO_FORUM.map((o) => (
            <button key={o} type="button" aria-pressed={ordem === o} onClick={() => setOrdem(o)}>
              {tf.ordem[o]}
            </button>
          ))}
        </div>
        <p className="f10-regra" aria-live="polite">{tf.ordem.regra[ordem]}</p>
        <div className="f10-filtros">
          <div className="f10-fichas" role="group" aria-label={tf.estado.rotulo}>
            <button type="button" aria-pressed={estado === null} onClick={() => setEstado(null)}>{tf.estado.todos}</button>
            {ESTADOS_DO_TOPICO.map((e) => (
              <button key={e} type="button" aria-pressed={estado === e} title={tf.estado.regra[e]} onClick={() => setEstado(e)}>
                {tf.estado.filtro[e]}
              </button>
            ))}
          </div>
          {dado && dado.etiquetas.length > 0 && (
            <label className="f10-etiqueta" htmlFor={idEtiqueta}>
              <span className="f10-visivel-so-leitor">{tf.etiqueta.rotulo}</span>
              <select id={idEtiqueta} value={etiqueta ?? ""} onChange={(e) => setEtiqueta(e.target.value || null)}>
                <option value="">{tf.etiqueta.todas}</option>
                {dado.etiquetas.map((nome) => (
                  <option key={nome} value={nome}>{nome}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      {aviso && (
        <p className="f10-status" role="status">
          {aviso}
        </p>
      )}

      {carregando && !dado ? (
        <p className="f10-nota" role="status">{tf.carregando}</p>
      ) : !dado ? (
        <div className="f10-vazio" role="alert">
          <p>{pagina?.erro || tf.erro}</p>
          <button type="button" className="al-botao al-botao-contorno al-botao-m" onClick={() => setVersao((n) => n + 1)}>{tf.tentar}</button>
        </div>
      ) : (
        <>
          {fixadosVisiveis.length > 0 && (
            <section className="f10-bloco" aria-label={tf.fixados}>
              <h3 className="f10-sub">
                <IconeAlfinete />
                {tf.fixados}
              </h3>
              <ol className="f10-lista">
                {fixadosVisiveis.map((t) => (
                  <ItemDoTopico key={t.id} t={t} tf={tf} lang={lang} novas={temNovidade(lidos, t.id, t.ultima_em)} ordem={ordem} />
                ))}
              </ol>
            </section>
          )}
          <section className="f10-bloco" aria-label={tf.lista}>
            {itens.length === 0 ? (
              <p className="f10-vazio">{filtrando ? tf.vazio.filtro : tf.vazio.todos}</p>
            ) : (
              <ol className="f10-lista">
                {itens.map((t) => (
                  <ItemDoTopico key={t.id} t={t} tf={tf} lang={lang} novas={temNovidade(lidos, t.id, t.ultima_em)} ordem={ordem} />
                ))}
              </ol>
            )}
            {mais.proximo && (
              <div className="f10-mais">
                <button type="button" className="al-botao al-botao-contorno al-botao-m" disabled={mais.buscando} onClick={() => void carregarMais()}>
                  {tf.carregarMais}
                </button>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}

/**
 * Um tópico da lista: a situação em carimbo, o título (o link para a conversa), o resumo de uma linha com quem o escreveu (o papel,
 * nunca a pessoa), e a linha de baixo com o tipo, a etiqueta, as respostas e o tempo. O número de respostas fica num ladrilho à
 * direita no computador.
 */
function ItemDoTopico({ t, tf, lang, novas, ordem }: { t: TopicoDoForum; tf: TextosDoForum; lang: string; novas: boolean; ordem: OrdemDoForum }) {
  const quando = ordem === "ultima" && t.respostas > 0 ? preencher(tf.item.ultima, { quando: tempoCurto(t.ultima_em, lang) }) : preencher(tf.item.aberto, { quando: tempoCurto(t.criado_em, lang) });
  const respostas = t.respostas === 0 ? tf.item.nenhuma : t.respostas === 1 ? tf.item.resposta : preencher(tf.item.respostas, { n: t.respostas.toLocaleString(lang) });
  return (
    <li className="f10-item" data-estado={t.estado}>
      <article className="f10-topico">
        <div className="f10-topico-estado">
          <CarimboDoEstado estado={t.estado} tf={tf} pequeno />
        </div>
        <div className="f10-topico-corpo">
          <h3 className="f10-topico-titulo">
            <Link href={enderecos.post(lang, t.id)}>{t.titulo}</Link>
            {novas && (
              <span className="f10-novas" title={tf.item.novasRegra}>
                {tf.item.novas}
              </span>
            )}
          </h3>
          {t.resumo && (
            <p className="f10-resumo">
              <span className="f10-resumo-de">{t.resumo_de === "moderacao" ? tf.resumo.daModeracao : tf.resumo.daAutora}</span>
              <span className="f10-resumo-texto">{t.resumo}</span>
            </p>
          )}
          <p className="f10-meta">
            <span className="f10-tipo">{t.tipo === "duvida" ? tf.item.duvida : tf.item.discussao}</span>
            {t.etiqueta && <span className="f10-etiqueta-ficha">{t.etiqueta}</span>}
            <span className="f10-respostas-texto">{respostas}</span>
            <span>{quando}</span>
            <span>{preencher(tf.item.por, { codinome: t.autor })}</span>
            {t.travado && <span className="f10-marca">{tf.item.travado}</span>}
            {t.veio && <span className="f10-marca">{tf.item.veio}</span>}
          </p>
        </div>
        <p className="f10-ladrilho" aria-hidden>
          <span className="f10-ladrilho-n">{t.respostas.toLocaleString(lang)}</span>
        </p>
      </article>
    </li>
  );
}

function IconeMais() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconeAlfinete() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 4h6l-1 6 3 3H7l3-3-1-6zM12 13v7" />
    </svg>
  );
}
