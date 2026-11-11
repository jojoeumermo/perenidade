// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { b1 } from "@/lib/rede/cliente-b1";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaRede } from "@/lib/rede/textos";
import { blocosDaWiki, type VersaoDaWiki, type WikiDaComunidade as Wiki } from "@/lib/rede/tipos-b1";
import type { Situacao } from "@/lib/rede/tipos";
import { Contador, erroDaB1, quandoCurto, useTextosB1 } from "../b1/base";
import { previa } from "../conversa/base3";
import { codigoDoErro } from "../erros";

/** A wiki da prévia: uma página de exemplo (a cartilha), só nesta tela. */
function wikiDaPrevia(slug: string): Wiki {
  const agora = new Date().toISOString();
  const pagina = {
    pagina: "cartilha-de-direitos",
    titulo: "Cartilha de direitos",
    corpo: "# Num despejo\n1. Peça para ver a ordem judicial.\n2. Ninguém entra sem a ordem, de dia, com oficial de justiça.\n3. Chame a Defensoria Pública.\n\n# Contatos\n- Defensoria Pública: atendimento pelo site oficial.\n- OAB, comissão de direitos humanos.",
    versao: 3,
    editado_em: agora,
    travada: false,
  };
  return { comunidade: { slug, nome: slug, cor: "" }, paginas: [pagina], pagina, pode_editar: true, pode_criar: true, modera: false };
}

/** O texto da wiki desenhado sem HTML cru: títulos ("# "), listas ("- " e "1. ") e parágrafos. */
function TextoDaWiki({ corpo }: { corpo: string }) {
  return (
    <div className="b1-wiki-texto">
      {blocosDaWiki(corpo).map((b, i) =>
        b.tipo === "titulo" ? (
          <h3 key={i} className="al3-cond">{b.texto}</h3>
        ) : b.tipo === "lista" ? (
          b.numerada ? (
            <ol key={i}>{b.itens.map((x, j) => <li key={j}>{x}</li>)}</ol>
          ) : (
            <ul key={i}>{b.itens.map((x, j) => <li key={j}>{x}</li>)}</ul>
          )
        ) : (
          <p key={i}>{b.texto}</p>
        ),
      )}
    </div>
  );
}

/**
 * A wiki da comunidade (Onda B, F3, alta): cartilha de direitos e contatos de advogados populares. Quem vê a comunidade lê; quem é
 * dela edita, com o histórico de todas as versões; a moderação trava, volta versões e apaga. Quem editou aparece só para a
 * moderação (LGPD art. 11). Editar em cima de uma versão velha não apaga o trabalho de ninguém: a tela avisa e guarda o texto.
 */
export function WikiDaComunidade({ slug, lang, s, situacao, aoAvisar }: { slug: string; lang: string; s: TextosDaRede; situacao: Situacao; aoAvisar: (texto: string, erro?: boolean) => void }) {
  const t = useTextosB1(lang);
  const [estado, setEstado] = useState<{ chave: string; wiki: Wiki | null; erro: string } | null>(null);
  const [pagina, setPagina] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [editando, setEditando] = useState<{ pagina: string | null; base: number | null } | null>(null);
  const [titulo, setTitulo] = useState("");
  const [corpo, setCorpo] = useState("");
  const [resumo, setResumo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [historico, setHistorico] = useState<{ versoes: VersaoDaWiki[]; modera: boolean } | null>(null);
  const [vendo, setVendo] = useState<{ versao: number; corpo: string; editou: string | null } | null>(null);
  const id = useId();
  const tituloRef = useRef<HTMLInputElement>(null);
  const leitura = useRef<HTMLElement>(null);
  const chave = `${slug}:${pagina ?? ""}:${versao}`;

  useEffect(() => {
    if (!t) return;
    let vivo = true;
    (previa() ? Promise.resolve(wikiDaPrevia(slug)) : b1.wiki(slug, pagina))
      .then((w) => vivo && setEstado({ chave, wiki: w, erro: "" }))
      .catch((e) => vivo && setEstado({ chave, wiki: null, erro: erroDaB1(s, t, e) }));
    return () => {
      vivo = false;
    };
  }, [chave, slug, pagina, s, t]);

  useEffect(() => {
    if (editando) tituloRef.current?.focus();
  }, [editando]);

  if (!t || !estado) return <p role="status" className="al3-vazio">{s.estados.carregando}</p>;
  const w = t.wiki;
  if (!estado.wiki) return <p role="alert" className="al3-vazio">{estado.erro}</p>;
  const wiki = estado.wiki;
  const atual = wiki.pagina;

  function abrirEdicao(nova: boolean) {
    setHistorico(null);
    setVendo(null);
    if (nova || !atual) {
      setEditando({ pagina: null, base: null });
      setTitulo("");
      setCorpo("");
    } else {
      setEditando({ pagina: atual.pagina, base: atual.versao });
      setTitulo(atual.titulo);
      setCorpo(atual.corpo);
    }
    setResumo("");
  }

  async function salvar() {
    if (!t || !editando) return;
    setOcupado(true);
    try {
      const r = previa() ? { pagina: editando.pagina ?? "nova", versao: (editando.base ?? 0) + 1 } : await b1.wikiSalvar(slug, editando.pagina, titulo, corpo, resumo, editando.base);
      aoAvisar(w.salva);
      setEditando(null);
      setPagina(r.pagina);
      setVersao((v) => v + 1);
      requestAnimationFrame(() => leitura.current?.focus());
    } catch (e) {
      if (codigoDoErro(e) === "conflito") {
        // A versão nova vem para a leitura; o texto da pessoa fica na caixa (nada se perde).
        aoAvisar(w.conflito, true);
        try {
          const nova = await b1.wiki(slug, editando.pagina);
          if (nova.pagina) setEditando({ pagina: nova.pagina.pagina, base: nova.pagina.versao });
          setEstado({ chave, wiki: nova, erro: "" });
        } catch {
          // fica como está: a pessoa pode copiar o texto
        }
      } else aoAvisar(erroDaB1(s, t, e), true);
    } finally {
      setOcupado(false);
    }
  }

  async function abrirHistorico() {
    if (!t || !atual) return;
    if (historico) return setHistorico(null);
    try {
      setHistorico(previa() ? { modera: false, versoes: [{ versao: atual.versao, criado_em: atual.editado_em, resumo: "", tamanho: atual.corpo.length, editou: null }] } : await b1.wikiHistorico(slug, atual.pagina));
    } catch (e) {
      aoAvisar(erroDaB1(s, t, e), true);
    }
  }

  async function verVersao(n: number) {
    if (!t || !atual) return;
    try {
      const v = await b1.wikiVersao(slug, atual.pagina, n);
      setVendo({ versao: v.versao, corpo: v.corpo, editou: v.editou });
    } catch (e) {
      aoAvisar(erroDaB1(s, t, e), true);
    }
  }

  async function moderar(acao: "restaurar" | "travar" | "destravar" | "apagar", n?: number) {
    if (!t || !atual) return;
    if (acao === "apagar" && !window.confirm(w.confirmarApagar)) return;
    setOcupado(true);
    try {
      if (acao === "restaurar" && n) {
        await b1.wikiRestaurar(slug, atual.pagina, n);
        aoAvisar(preencher(w.restaurada, { n }));
      } else if (acao === "apagar") {
        await b1.wikiTravar(slug, atual.pagina, true, true);
        aoAvisar(w.apagada);
        setPagina(null);
      } else await b1.wikiTravar(slug, atual.pagina, acao === "travar");
      setHistorico(null);
      setVendo(null);
      setVersao((v) => v + 1);
    } catch (e) {
      aoAvisar(erroDaB1(s, t, e), true);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="al3-secao b1-entra" aria-busy={estado.chave !== chave}>
      <h2 className="al3-cond">{w.titulo}</h2>
      <p className="b1-cinza">{w.descricao}</p>

      {wiki.paginas.length > 0 && (
        <nav aria-label={w.paginas} className="mt-3">
          <ul className="b1-fichas">
            {wiki.paginas.map((p) => (
              <li key={p.pagina}>
                <button type="button" className="b1-ficha" aria-current={atual?.pagina === p.pagina ? "true" : undefined} onClick={() => (setEditando(null), setHistorico(null), setVendo(null), setPagina(p.pagina))}>
                  {p.travada && <IconeCadeado />}
                  {p.titulo}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {!editando && (
        <>
          {atual ? (
            <article ref={leitura} tabIndex={-1} className="b1-cartao mt-2" aria-labelledby={`${id}-titulo`}>
              <h3 id={`${id}-titulo`} className="al3-cond" style={{ fontSize: "1.5rem" }}>{atual.titulo}</h3>
              <p className="b1-cinza">
                {preencher(w.atualizada, { quando: quandoCurto(lang, atual.editado_em) })} · {preencher(w.versao, { n: atual.versao })}
                {atual.travada && <> · {w.travada}</>}
              </p>
              <TextoDaWiki corpo={vendo ? vendo.corpo : atual.corpo} />
            </article>
          ) : (
            <p className="al3-vazio">{w.vazia}</p>
          )}
          <div className="b1-botoes">
            {atual && wiki.pode_editar && (
              <button type="button" className="b1-botao" data-cheio="" onClick={() => abrirEdicao(false)}>
                {w.editar}
              </button>
            )}
            {wiki.pode_criar && (
              <button type="button" className="b1-botao" onClick={() => abrirEdicao(true)}>
                {w.nova}
              </button>
            )}
            {atual && (
              <button type="button" className="b1-botao" aria-expanded={historico !== null} aria-controls={`${id}-hist`} onClick={() => void abrirHistorico()}>
                {historico ? w.fecharHistorico : w.historico}
              </button>
            )}
            {atual && wiki.modera && (
              <>
                <button type="button" className="b1-botao" disabled={ocupado} onClick={() => void moderar(atual.travada ? "destravar" : "travar")}>
                  {atual.travada ? w.destravar : w.travar}
                </button>
                <button type="button" className="b1-botao" disabled={ocupado} onClick={() => void moderar("apagar")}>
                  {w.apagar}
                </button>
              </>
            )}
          </div>
          {situacao.logado && !wiki.pode_criar && <p className="b1-cinza mt-2">{w.soComConta}</p>}
        </>
      )}

      {historico && atual && !editando && (
        <section id={`${id}-hist`} className="b1-painel" aria-label={w.historico}>
          <ol className="b1-lista">
            {historico.versoes.map((v) => (
              <li key={v.versao}>
                <div>
                  <p className="font-bold">
                    {preencher(w.versao, { n: v.versao })} · <time dateTime={v.criado_em}>{quandoCurto(lang, v.criado_em)}</time>
                  </p>
                  <p className="b1-cinza">
                    {v.resumo && <>{v.resumo} · </>}
                    {preencher(w.tamanho, { n: v.tamanho })}
                    {v.editou && <> · {preencher(w.editou, { quem: v.editou })}</>}
                  </p>
                </div>
                <div className="flex flex-col items-end">
                  {!previa() && (
                    <button type="button" className="b1-link" aria-pressed={vendo?.versao === v.versao} onClick={() => void verVersao(v.versao)}>
                      {w.ver}
                    </button>
                  )}
                  {historico.modera && v.versao !== atual.versao && (
                    <button type="button" className="b1-link" disabled={ocupado} onClick={() => void moderar("restaurar", v.versao)}>
                      {w.restaurar}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {editando && (
        <form
          className="b1-painel"
          onSubmit={(e) => {
            e.preventDefault();
            void salvar();
          }}
        >
          <label className="b1-rotulo" htmlFor={`${id}-t`}>{w.tituloRotulo}</label>
          <input ref={tituloRef} id={`${id}-t`} className="b1-campo" maxLength={120} required minLength={2} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          <label className="b1-rotulo" htmlFor={`${id}-c`}>{w.corpoRotulo}</label>
          <textarea id={`${id}-c`} className="b1-area" style={{ minHeight: "16rem" }} maxLength={20000} required value={corpo} onChange={(e) => setCorpo(e.target.value)} aria-describedby={`${id}-dica`} />
          <Contador n={corpo.length} max={20000} modelo="{n} / 20000" />
          <p id={`${id}-dica`} className="b1-cinza">{w.dica}</p>
          <label className="b1-rotulo" htmlFor={`${id}-r`}>{w.resumoRotulo}</label>
          <input id={`${id}-r`} className="b1-campo" maxLength={140} value={resumo} onChange={(e) => setResumo(e.target.value)} />
          <div className="b1-botoes">
            <button type="submit" className="b1-botao" data-cheio="" disabled={ocupado || titulo.trim().length < 2 || !corpo.trim()}>
              {w.salvar}
            </button>
            <button type="button" className="b1-botao" onClick={() => setEditando(null)}>
              {w.cancelar}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function IconeCadeado() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
