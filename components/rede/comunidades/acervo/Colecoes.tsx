// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { Post } from "@/lib/rede/tipos";
import { PostCompacto, useTextosAlumia3 } from "../../conversa/base3";
import { IconeVoltarAcervo, Recado, useRecado } from "./base";
import { BuscaNaComunidade } from "./BuscaNaComunidade";
import { acervo } from "./cliente";
import { mover, postDoEndereco } from "./regras";
import { erroDoAcervo, type TextosDoAcervo } from "./textos";
import type { Colecao, ListaDeColecoes } from "./tipos";
import { confirmar } from "@/components/perguntar";

type Alvo = { slug: string } | { handle: string };

/**
 * As coleções públicas de posts (L3-28) de uma comunidade ou de uma pessoa: a lista em cartões, a coleção aberta na ordem escrita por
 * quem cuida e, para quem cuida, pôr, tirar, subir e descer, as sugestões (sem quem sugeriu). Quem escreveu um post tira o post
 * dele de qualquer coleção. Nenhuma contagem de quem segue ou abriu a coleção.
 */
export function Colecoes({ alvo, lang, s, t, logado }: { alvo: Alvo; lang: string; s: TextosDaRede; t: TextosDoAcervo; logado: boolean }) {
  const chave = "slug" in alvo ? `c:${alvo.slug}` : `p:${alvo.handle}`;
  const [lista, setLista] = useState<{ chave: string; dado: ListaDeColecoes | null; erro: string } | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [versao, setVersao] = useState(0);
  const { recado, mostrar } = useRecado();

  useEffect(() => {
    let vivo = true;
    acervo
      .colecoes(alvo)
      .then((dado) => vivo && setLista({ chave, dado, erro: "" }))
      .catch((e) => vivo && setLista({ chave, dado: null, erro: erroDoAcervo(t, e) }));
    return () => {
      vivo = false;
    };
    // `alvo` muda de identidade a cada render; a chave diz quando é outro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, versao, t]);

  if (aberta) {
    return (
      <ColecaoAberta
        id={aberta}
        slug={"slug" in alvo ? alvo.slug : null}
        podeSugerir={Boolean(lista?.dado?.pode_sugerir)}
        lang={lang}
        s={s}
        t={t}
        logado={logado}
        aoVoltar={() => (setAberta(null), setVersao((v) => v + 1))}
      />
    );
  }
  if (!lista || lista.chave !== chave) return <p role="status" className="acv-dica">{t.comum.carregando}</p>;
  if (!lista.dado) {
    return (
      <p role="alert" className="acv-aviso">
        {lista.erro}{" "}
        <button type="button" className="acv-link" onClick={() => setVersao((v) => v + 1)}>{t.comum.tentar}</button>
      </p>
    );
  }
  const dado = lista.dado;
  return (
    <section aria-labelledby={`acv-colecoes-${chave}`}>
      <div className="acv-cabeca">
        <div>
          <h2 id={`acv-colecoes-${chave}`} className="acv-cond">{t.colecoes.titulo}</h2>
          <p className="acv-intro">{t.colecoes.intro}</p>
        </div>
        {dado.pode_criar && !criando && (
          <button type="button" className="acv-botao" data-cheio="" onClick={() => setCriando(true)}>{t.colecoes.nova}</button>
        )}
      </div>
      <Recado recado={recado} />
      {criando && (
        <FormularioDaColecao
          t={t}
          aoCancelar={() => setCriando(false)}
          aoSalvar={async (titulo, descricao) => {
            const r = await acervo.salvarColecao(null, "slug" in alvo ? alvo.slug : null, titulo, descricao);
            setCriando(false);
            mostrar(t.colecoes.salva);
            setAberta(r.id);
          }}
        />
      )}
      {dado.itens.length === 0 ? (
        <p className="acv-dica" style={{ marginTop: "1rem" }}>{dado.pode_criar ? t.colecoes.vazioCuida : t.colecoes.vazio}</p>
      ) : (
        <ul className="acv-grade">
          {dado.itens.map((k) => (
            <li key={k.id} className="acv-cartao">
              <span className="acv-carimbo" aria-hidden>{t.colecoes.titulo}</span>
              <h3 className="acv-cond">{k.titulo}</h3>
              {k.descricao && <p className="acv-intro">{k.descricao}</p>}
              <div className="acv-cartao-pe">
                <span>
                  {k.posts === 0 ? t.colecoes.nenhumPost : k.posts === 1 ? t.colecoes.umPost : preencher(t.colecoes.posts, { n: k.posts.toLocaleString(lang) })}
                  {Boolean(k.sugestoes) && <> · <strong className="acv-selo-dourado">{preencher(t.colecoes.sugestoes, { n: k.sugestoes ?? 0 })}</strong></>}
                </span>
                <button type="button" className="acv-botao" data-pequeno="" onClick={() => setAberta(k.id)} aria-label={`${t.colecoes.abrir}: ${k.titulo}`}>
                  {t.colecoes.abrir}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FormularioDaColecao({ t, inicial, aoSalvar, aoCancelar }: { t: TextosDoAcervo; inicial?: { titulo: string; descricao: string }; aoSalvar: (titulo: string, descricao: string) => Promise<void>; aoCancelar: () => void }) {
  const id = useId();
  const [titulo, setTitulo] = useState(inicial?.titulo ?? "");
  const [descricao, setDescricao] = useState(inicial?.descricao ?? "");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <form
      className="acv-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setOcupado(true);
        setErro("");
        try {
          await aoSalvar(titulo, descricao);
        } catch (falha) {
          setErro(erroDoAcervo(t, falha));
        } finally {
          setOcupado(false);
        }
      }}
    >
      <label className="acv-rotulo" htmlFor={`${id}-t`}>{t.colecoes.tituloRotulo}</label>
      <input ref={ref} id={`${id}-t`} className="acv-campo" required minLength={2} maxLength={80} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
      <label className="acv-rotulo" htmlFor={`${id}-d`}>{t.colecoes.descricaoRotulo}</label>
      <textarea id={`${id}-d`} className="acv-area" style={{ minHeight: "5rem" }} maxLength={280} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      {erro && <p role="alert" className="acv-aviso">{erro}</p>}
      <div className="acv-botoes">
        <button type="submit" className="acv-botao" data-cheio="" disabled={ocupado || titulo.trim().length < 2}>{t.colecoes.salvar}</button>
        <button type="button" className="acv-botao" onClick={aoCancelar}>{t.colecoes.cancelar}</button>
      </div>
    </form>
  );
}

function ColecaoAberta({ id, slug, podeSugerir, lang, s, t, logado, aoVoltar }: { id: string; slug: string | null; podeSugerir: boolean; lang: string; s: TextosDaRede; t: TextosDoAcervo; logado: boolean; aoVoltar: () => void }) {
  const t3 = useTextosAlumia3(lang);
  const [estado, setEstado] = useState<{ dado: Colecao | null; erro: string } | null>(null);
  const [versao, setVersao] = useState(0);
  const [editando, setEditando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const { recado, mostrar } = useRecado();
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const idForm = useId();
  const [endereco, setEndereco] = useState("");
  const [nota, setNota] = useState("");

  useEffect(() => {
    let vivo = true;
    acervo
      .colecao(id)
      .then((dado) => vivo && setEstado({ dado, erro: "" }))
      .catch((e) => vivo && setEstado({ dado: null, erro: erroDoAcervo(t, e) }));
    return () => {
      vivo = false;
    };
  }, [id, versao, t]);
  useEffect(() => {
    if (estado?.dado && versao === 0) tituloRef.current?.focus();
  }, [estado, versao]);

  const aoErro = useCallback((e: unknown) => mostrar(erroDoAcervo(t, e), true), [mostrar, t]);

  async function fazer(tarefa: () => Promise<unknown>, ok: string) {
    setOcupado(true);
    try {
      await tarefa();
      mostrar(ok);
      setVersao((v) => v + 1);
    } catch (e) {
      aoErro(e);
    } finally {
      setOcupado(false);
    }
  }

  const voltar = (
    <button type="button" className="acv-link acv-voltar" onClick={aoVoltar}>
      <IconeVoltarAcervo />
      {t.colecoes.voltar}
    </button>
  );
  if (!estado || !t3) return <div>{voltar}<p role="status" className="acv-dica">{t.comum.carregando}</p></div>;
  if (!estado.dado) return <div>{voltar}<p role="alert" className="acv-aviso">{estado.erro}</p></div>;
  const k = estado.dado;
  const ids = k.itens.map((i) => i.post.id);

  async function porPeloEndereco(sugerir: boolean) {
    const post = postDoEndereco(endereco);
    if (!post) return mostrar(t.erros.post_invalido, true);
    await fazer(() => (sugerir ? acervo.sugerir(k.id, post) : acervo.porNaColecao(k.id, post, true, nota)), sugerir ? t.colecoes.sugerido : t.colecoes.posto);
    setEndereco("");
    setNota("");
  }

  return (
    <div>
      {voltar}
      <Recado recado={recado} />
      <div className="acv-colecao">
        <aside className="acv-colecao-capa acv-cartao" aria-labelledby={`${idForm}-titulo`}>
          <span className="acv-carimbo" aria-hidden>{t.colecoes.titulo}</span>
          <h2 id={`${idForm}-titulo`} ref={tituloRef} tabIndex={-1} className="acv-cond">{k.titulo}</h2>
          <p className="acv-dica">{k.dono.tipo === "comunidade" ? preencher(t.colecoes.daComunidade, { nome: k.dono.nome }) : preencher(t.colecoes.doPerfil, { nome: k.dono.nome })}</p>
          {k.descricao && <p className="acv-intro">{k.descricao}</p>}
          <p className="acv-regra">{t.colecoes.ordemRegra}</p>
          {k.pode_editar && !editando && (
            <div className="acv-botoes">
              <button type="button" className="acv-botao" data-pequeno="" onClick={() => setEditando(true)}>{t.colecoes.editar}</button>
              <button
                type="button"
                className="acv-botao"
                data-pequeno=""
                disabled={ocupado}
                onClick={async () => {
                  if (!(await confirmar(t.colecoes.confirmarApagar))) return;
                  void acervo.apagarColecao(k.id).then(aoVoltar, aoErro);
                }}
              >
                {t.colecoes.apagar}
              </button>
            </div>
          )}
          {editando && (
            <FormularioDaColecao
              t={t}
              inicial={{ titulo: k.titulo, descricao: k.descricao }}
              aoCancelar={() => setEditando(false)}
              aoSalvar={async (titulo, descricao) => {
                await acervo.salvarColecao(k.id, null, titulo, descricao);
                setEditando(false);
                mostrar(t.colecoes.salva);
                setVersao((v) => v + 1);
              }}
            />
          )}
        </aside>

        <div>
          {k.itens.length === 0 ? (
            <p className="acv-dica">{t.colecoes.nenhumPost}</p>
          ) : (
            <ol className="acv-itens" aria-label={k.titulo}>
              {k.itens.map((item, i) => (
                <li key={item.post.id} className="acv-item">
                  <span className="acv-num" aria-hidden>{i + 1}</span>
                  <div>
                    {item.nota && <p className="acv-nota">{item.nota}</p>}
                    <PostCompacto post={item.post} lang={lang} s={s} t={t3} logado={logado} aoErro={aoErro} comComunidade={k.dono.tipo === "pessoa"} />
                    {(k.pode_editar || item.meu) && (
                      <div className="acv-item-acoes" role="group" aria-label={preencher(t.colecoes.posicao, { n: i + 1, total: k.itens.length })}>
                        {k.pode_editar && (
                          <>
                            <button type="button" className="acv-botao" data-pequeno="" disabled={ocupado || i === 0} onClick={() => void fazer(() => acervo.ordenar(k.id, mover(ids, i, i - 1)), t.colecoes.ordemSalva)}>
                              {t.colecoes.subir}
                            </button>
                            <button type="button" className="acv-botao" data-pequeno="" disabled={ocupado || i === k.itens.length - 1} onClick={() => void fazer(() => acervo.ordenar(k.id, mover(ids, i, i + 1)), t.colecoes.ordemSalva)}>
                              {t.colecoes.descer}
                            </button>
                            <button type="button" className="acv-botao" data-pequeno="" disabled={ocupado} onClick={() => void fazer(() => acervo.porNaColecao(k.id, item.post.id, false), t.colecoes.tirado)}>
                              {t.colecoes.tirar}
                            </button>
                          </>
                        )}
                        {item.meu && (
                          <button type="button" className="acv-botao" data-pequeno="" disabled={ocupado} onClick={() => void fazer(() => acervo.tirarMeu(k.id, item.post.id), t.colecoes.tiradoMeu)}>
                            {t.colecoes.tirarMeu}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}

          {k.pode_editar && k.sugestoes && k.sugestoes.length > 0 && (
            <section className="acv-form" aria-labelledby={`${idForm}-sug`}>
              <h3 id={`${idForm}-sug`} className="acv-cond" style={{ fontSize: "1.3rem" }}>{t.colecoes.sugestoesTitulo}</h3>
              <p className="acv-dica">{t.colecoes.sugerirDica}</p>
              {k.sugestoes.map((p: Post) => (
                <div key={p.id}>
                  <PostCompacto post={p} lang={lang} s={s} t={t3} logado={logado} aoErro={aoErro} />
                  <div className="acv-item-acoes">
                    <button type="button" className="acv-botao" data-pequeno="" data-cheio="" disabled={ocupado} onClick={() => void fazer(() => acervo.porNaColecao(k.id, p.id, true), t.colecoes.posto)}>{t.colecoes.aceitar}</button>
                    <button type="button" className="acv-botao" data-pequeno="" disabled={ocupado} onClick={() => void fazer(() => acervo.descartar(k.id, p.id), t.colecoes.descartada)}>{t.colecoes.descartar}</button>
                  </div>
                </div>
              ))}
            </section>
          )}

          {(k.pode_editar || (podeSugerir && k.dono.tipo === "comunidade")) && (
            <form
              className="acv-form"
              onSubmit={(e) => {
                e.preventDefault();
                void porPeloEndereco(!k.pode_editar);
              }}
            >
              <h3 className="acv-cond" style={{ fontSize: "1.3rem" }}>{k.pode_editar ? t.colecoes.porPost : t.colecoes.sugerir}</h3>
              <label className="acv-rotulo" htmlFor={`${idForm}-end`}>{t.colecoes.porRotulo}</label>
              <input id={`${idForm}-end`} className="acv-campo" inputMode="url" required value={endereco} onChange={(e) => setEndereco(e.target.value)} aria-describedby={`${idForm}-dica`} />
              <p id={`${idForm}-dica`} className="acv-dica">{k.pode_editar ? t.colecoes.porDica : t.colecoes.sugerirDica}</p>
              {k.pode_editar && (
                <>
                  <label className="acv-rotulo" htmlFor={`${idForm}-nota`}>{t.colecoes.notaRotulo}</label>
                  <input id={`${idForm}-nota`} className="acv-campo" maxLength={140} value={nota} onChange={(e) => setNota(e.target.value)} />
                </>
              )}
              <div className="acv-botoes">
                <button type="submit" className="acv-botao" data-cheio="" disabled={ocupado || !endereco.trim()}>{k.pode_editar ? t.colecoes.por : t.colecoes.sugerir}</button>
              </div>
            </form>
          )}

          {k.pode_editar && slug && (
            <details className="acv-form acv-recolhe">
              <summary className="acv-cond">{t.busca.paraColecao}</summary>
              <BuscaNaComunidade
                slug={slug}
                lang={lang}
                s={s}
                t={t}
                logado={logado}
                jaNaColecao={ids}
                aoEscolher={(p) => void fazer(() => acervo.porNaColecao(k.id, p.id, true), t.colecoes.posto)}
              />
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
