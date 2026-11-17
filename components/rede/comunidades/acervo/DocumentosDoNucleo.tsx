// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { preencher } from "@/lib/rede/preencher";
import { dataCurta, Diferenca, IconeVoltarAcervo, Recado, useRecado } from "./base";
import { acervo } from "./cliente";
import { codigoDoErro } from "../../erros";
import { erroDoAcervo, type TextosDoAcervo } from "./textos";
import type { Doc, DocResumo, VersaoDoDoc } from "./tipos";

/**
 * A pasta colaborativa do núcleo (L3-27): documentos de texto que quem é do núcleo escreve e edita junto. Toda versão fica guardada
 * e qualquer pessoa do núcleo volta a uma versão antiga (vira uma versão nova). Quem editou cada versão aparece só para a mediação;
 * não existe registro de quem leu. Salvar em cima de uma versão velha não apaga o trabalho de ninguém.
 */
export function DocumentosDoNucleo({ nucleo, lang, t }: { nucleo: string; lang: string; t: TextosDoAcervo }) {
  const id = useId();
  const [lista, setLista] = useState<{ itens: DocResumo[]; media: boolean } | null>(null);
  const [erro, setErro] = useState("");
  const [versao, setVersao] = useState(0);
  const [aberto, setAberto] = useState<string | null>(null);
  const [novo, setNovo] = useState(false);
  const { recado, mostrar } = useRecado();

  useEffect(() => {
    let vivo = true;
    acervo
      .docs(nucleo)
      .then((r) => vivo && (setLista(r), setErro("")))
      .catch((e) => vivo && setErro(erroDoAcervo(t, e)));
    return () => {
      vivo = false;
    };
  }, [nucleo, versao, t]);

  return (
    <section className="acv-nucleo" aria-labelledby={`${id}-t`}>
      <div className="acv-cabeca">
        <div>
          <h2 id={`${id}-t`} className="acv-cond">{t.docs.titulo}</h2>
          <p className="acv-intro">{t.docs.intro}</p>
        </div>
        {!aberto && !novo && lista && (
          <button type="button" className="acv-botao" data-cheio="" onClick={() => setNovo(true)}>{t.docs.novo}</button>
        )}
      </div>
      <Recado recado={recado} />
      {erro && <p role="alert" className="acv-aviso">{erro}</p>}
      {novo ? (
        <EditorDoDoc
          nucleo={nucleo}
          t={t}
          doc={null}
          aoSalvar={(r) => {
            setNovo(false);
            mostrar(t.docs.salvo);
            setVersao((v) => v + 1);
            setAberto(r.id);
          }}
          aoCancelar={() => setNovo(false)}
        />
      ) : aberto ? (
        <DocAberto
          id={aberto}
          nucleo={nucleo}
          lang={lang}
          t={t}
          avisar={mostrar}
          aoVoltar={() => (setAberto(null), setVersao((v) => v + 1))}
        />
      ) : !lista ? (
        !erro && <p role="status" className="acv-dica">{t.comum.carregando}</p>
      ) : lista.itens.length === 0 ? (
        <p className="acv-dica">{t.docs.vazio}</p>
      ) : (
        <ul className="acv-lista">
          {lista.itens.map((d) => (
            <li key={d.id} className="acv-linha">
              <span className="acv-tipo" aria-hidden>TXT</span>
              <span className="acv-linha-nome">
                <strong>{d.titulo}</strong>
                <small>
                  {preencher(t.docs.versao, { n: d.versao })} · {preencher(t.docs.atualizado, { quando: dataCurta(lang, d.editado_em) })} · {preencher(t.docs.tamanho, { n: d.tamanho.toLocaleString(lang) })}
                </small>
              </span>
              <button type="button" className="acv-botao" data-pequeno="" onClick={() => setAberto(d.id)} aria-label={`${t.docs.abrir}: ${d.titulo}`}>{t.docs.abrir}</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DocAberto({ id, nucleo, lang, t, avisar, aoVoltar }: { id: string; nucleo: string; lang: string; t: TextosDoAcervo; avisar: (texto: string, erro?: boolean) => void; aoVoltar: () => void }) {
  const [doc, setDoc] = useState<Doc | null>(null);
  const [vendo, setVendo] = useState<Doc | null>(null);
  const [comparar, setComparar] = useState(false);
  const [historico, setHistorico] = useState<{ media: boolean; versoes: VersaoDoDoc[] } | null>(null);
  const [editando, setEditando] = useState(false);
  const [versao, setVersao] = useState(0);
  const [ocupado, setOcupado] = useState(false);
  const titulo = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let vivo = true;
    acervo
      .doc(id)
      .then((d) => vivo && setDoc(d))
      .catch((e) => vivo && avisar(erroDoAcervo(t, e), true));
    return () => {
      vivo = false;
    };
  }, [id, versao, t, avisar]);
  useEffect(() => {
    if (doc && !editando) titulo.current?.focus();
  }, [doc, editando]);

  const voltar = (
    <button type="button" className="acv-link acv-voltar" onClick={aoVoltar}>
      <IconeVoltarAcervo />
      {t.docs.voltar}
    </button>
  );
  if (!doc) return <div>{voltar}<p role="status" className="acv-dica">{t.comum.carregando}</p></div>;

  async function abrirHistorico() {
    if (historico) return setHistorico(null);
    try {
      setHistorico(await acervo.historicoDoDoc(id));
    } catch (e) {
      avisar(erroDoAcervo(t, e), true);
    }
  }
  async function ver(n: number) {
    try {
      setVendo(n === doc?.versao ? null : await acervo.doc(id, n));
      setComparar(false);
    } catch (e) {
      avisar(erroDoAcervo(t, e), true);
    }
  }
  async function fazer(tarefa: () => Promise<unknown>, ok: string, depois?: () => void) {
    setOcupado(true);
    try {
      await tarefa();
      avisar(ok);
      depois?.();
    } catch (e) {
      avisar(erroDoAcervo(t, e), true);
    } finally {
      setOcupado(false);
    }
  }

  if (editando) {
    return (
      <div>
        {voltar}
        <EditorDoDoc
          nucleo={nucleo}
          t={t}
          doc={doc}
          aoSalvar={() => {
            setEditando(false);
            avisar(t.docs.salvo);
            setVendo(null);
            setHistorico(null);
            setVersao((v) => v + 1);
          }}
          aoCancelar={() => setEditando(false)}
        />
      </div>
    );
  }

  const mostrado = vendo ?? doc;
  return (
    <div>
      {voltar}
      <article className="acv-cartao" style={{ minHeight: 0, marginTop: "0.5rem" }} aria-labelledby={`doc-${doc.id}`}>
        <h3 id={`doc-${doc.id}`} ref={titulo} tabIndex={-1} className="acv-cond" style={{ fontSize: "1.7rem" }}>{mostrado.titulo}</h3>
        <p className="acv-dica">
          {preencher(t.docs.versao, { n: mostrado.versao })} · {preencher(t.docs.atualizado, { quando: dataCurta(lang, mostrado.editado_em) })}
          {vendo?.editou && <> · {preencher(t.docs.editou, { quem: vendo.editou })}</>}
        </p>
        {vendo && (
          <p role="status" className="acv-aviso">
            {preencher(t.docs.vendoAntiga, { n: vendo.versao })}{" "}
            <button type="button" className="acv-link" onClick={() => setVendo(null)}>{t.docs.verAtual}</button>
            {" · "}
            <button type="button" className="acv-link" aria-expanded={comparar} onClick={() => setComparar((c) => !c)}>{comparar ? t.wiki.fecharComparacao : t.docs.comparar}</button>
          </p>
        )}
        {vendo && comparar ? (
          <>
            <p className="acv-dica">{preencher(t.wiki.comparando, { n: vendo.versao })}</p>
            <Diferenca antes={vendo.corpo} agora={doc.corpo} t={t} />
          </>
        ) : (
          <p className="acv-texto">{mostrado.corpo}</p>
        )}
        <div className="acv-botoes">
          {!vendo && <button type="button" className="acv-botao" data-cheio="" onClick={() => setEditando(true)}>{t.docs.editar}</button>}
          {vendo && (
            <button type="button" className="acv-botao" data-cheio="" disabled={ocupado} onClick={() => void fazer(() => acervo.restaurarDoc(id, vendo.versao), preencher(t.docs.voltou, { n: vendo.versao }), () => (setVendo(null), setHistorico(null), setVersao((v) => v + 1)))}>
              {t.docs.voltarVersao}
            </button>
          )}
          <button type="button" className="acv-botao" aria-expanded={historico !== null} onClick={() => void abrirHistorico()}>{historico ? t.docs.fecharHistorico : t.docs.historico}</button>
          {doc.media && (
            <button
              type="button"
              className="acv-botao"
              disabled={ocupado}
              onClick={() => {
                if (window.confirm(t.docs.confirmarApagar)) void fazer(() => acervo.apagarDoc(id), t.docs.apagado, aoVoltar);
              }}
            >
              {t.docs.apagar}
            </button>
          )}
        </div>
        {historico && (
          <section aria-label={t.docs.historico}>
            <ol className="acv-lista">
              {historico.versoes.map((v) => (
                <li key={v.versao} className="acv-linha">
                  <span className="acv-linha-nome">
                    <strong>{preencher(t.docs.versao, { n: v.versao })} · <time dateTime={v.criado_em}>{dataCurta(lang, v.criado_em)}</time></strong>
                    <small>
                      {v.resumo && <>{v.resumo} · </>}
                      {preencher(t.docs.tamanho, { n: v.tamanho.toLocaleString(lang) })}
                      {v.editou && <> · {preencher(t.docs.editou, { quem: v.editou })}</>}
                    </small>
                  </span>
                  <button type="button" className="acv-botao" data-pequeno="" aria-pressed={(vendo?.versao ?? doc.versao) === v.versao} onClick={() => void ver(v.versao)}>{t.docs.ver}</button>
                </li>
              ))}
            </ol>
            <p className="acv-regra">{t.docs.quemEditou}</p>
          </section>
        )}
      </article>
    </div>
  );
}

function EditorDoDoc({ nucleo, t, doc, aoSalvar, aoCancelar }: { nucleo: string; t: TextosDoAcervo; doc: Doc | null; aoSalvar: (r: { id: string; versao: number }) => void; aoCancelar: () => void }) {
  const id = useId();
  const [titulo, setTitulo] = useState(doc?.titulo ?? "");
  const [corpo, setCorpo] = useState(doc?.corpo ?? "");
  const [resumo, setResumo] = useState("");
  const [base, setBase] = useState<number | null>(doc?.versao ?? null);
  const [conflito, setConflito] = useState<Doc | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);

  async function salvar() {
    setOcupado(true);
    setErro("");
    try {
      aoSalvar(await acervo.salvarDoc(nucleo, doc?.id ?? null, titulo, corpo, resumo, base));
    } catch (e) {
      if (codigoDoErro(e) === "conflito" && doc) {
        // A versão nova aparece acima; o texto da pessoa fica na caixa. A base só passa para a nova depois que ela está na tela.
        try {
          const nova = await acervo.doc(doc.id);
          setConflito(nova);
          setBase(nova.versao);
        } catch {
          // fica como está: a pessoa pode copiar o texto
        }
        setErro(t.docs.conflito);
      } else setErro(erroDoAcervo(t, e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form
      className="acv-form"
      onSubmit={(e) => {
        e.preventDefault();
        void salvar();
      }}
    >
      {conflito && (
        <section className="acv-cartao" style={{ minHeight: 0 }} aria-labelledby={`${id}-conf`}>
          <h3 id={`${id}-conf`} className="acv-cond" style={{ fontSize: "1.2rem" }}>{preencher(t.docs.conflitoNova, { n: conflito.versao })}</h3>
          <p className="acv-texto">{conflito.corpo}</p>
        </section>
      )}
      <label className="acv-rotulo" htmlFor={`${id}-t`}>{t.docs.tituloRotulo}</label>
      <input ref={ref} id={`${id}-t`} className="acv-campo" required minLength={2} maxLength={120} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
      <label className="acv-rotulo" htmlFor={`${id}-c`}>{t.docs.corpoRotulo}</label>
      <textarea id={`${id}-c`} className="acv-area" required maxLength={50000} value={corpo} onChange={(e) => setCorpo(e.target.value)} />
      <p className="acv-dica" aria-live="polite">{corpo.length.toLocaleString()} / 50.000</p>
      <label className="acv-rotulo" htmlFor={`${id}-r`}>{t.docs.resumoRotulo}</label>
      <input id={`${id}-r`} className="acv-campo" maxLength={140} value={resumo} onChange={(e) => setResumo(e.target.value)} />
      {erro && <p role="alert" className="acv-aviso">{erro}</p>}
      <div className="acv-botoes">
        <button type="submit" className="acv-botao" data-cheio="" disabled={ocupado || titulo.trim().length < 2 || !corpo.trim()}>{t.docs.salvar}</button>
        <button type="button" className="acv-botao" onClick={aoCancelar}>{t.docs.cancelar}</button>
      </div>
    </form>
  );
}
