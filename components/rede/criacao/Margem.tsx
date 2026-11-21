// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Os rascunhos coletivos (item 33) e a margem do acervo (item 34). O rascunho é uma página da wiki da comunidade: as versões, o
// comparar e o voltar são os da wiki (o link "Ver as versões na wiki"). Aqui ficam as sugestões de troca, as anotações presas a um
// trecho e as respostas. Ninguém vê quem escreveu cada uma: só "sua". Só quem é da comunidade abre esta parte.
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "@/components/Link";
import { confirmar } from "@/components/perguntar";
import type { MinhaComunidade, PaginaComMargem, Rascunhos } from "@/lib/rede/criacao/cliente";
import { comSugestao, pedacos, reancorar, selecaoValida, trechoParaSugerir } from "@/lib/rede/criacao/margem";
import { Botao } from "../ui/Botao";
import { criacao } from "./cliente";
import { diaNoIdioma, por, textoDoErro, type TextosDaCriacao } from "./textos";

type T = TextosDaCriacao;

/** O estado de "ocupado", erro e ok de cada ação. */
export function useAcao(t: T) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState("");
  const fazer = useCallback(async (acao: () => Promise<string | void>) => {
    setOcupado(true);
    setErro("");
    setFeito("");
    try {
      const msg = await acao();
      if (msg) setFeito(msg);
    } catch (e) {
      setErro(textoDoErro(t.erros, e));
    } finally {
      setOcupado(false);
    }
  }, [t]);
  const avisos = (
    <>
      {erro && <p role="alert" className="cc-erro">{erro}</p>}
      {feito && <p role="status" className="cc-ok">{feito}</p>}
    </>
  );
  return { ocupado, fazer, avisos };
}

/** A lista da comunidade: os rascunhos (com o "começar") e as outras páginas do acervo. */
function Lista({ t, lang, slug, aoAbrir }: { t: T; lang: string; slug: string; aoAbrir: (pagina: string) => void }) {
  const [dados, setDados] = useState<Rascunhos | null>(null);
  const [erro, setErro] = useState("");
  const [novo, setNovo] = useState({ titulo: "", tipo: "manifesto" as "nota" | "manifesto", corpo: "" });
  const { ocupado, fazer, avisos } = useAcao(t);
  const id = useId();
  const carregar = useCallback(() => {
    criacao.rascunhos(slug).then(setDados, (e) => setErro(textoDoErro(t.erros, e)));
  }, [slug, t]);
  useEffect(() => {
    let vivo = true;
    criacao.rascunhos(slug).then((d) => vivo && setDados(d), (e) => vivo && setErro(textoDoErro(t.erros, e)));
    return () => {
      vivo = false;
    };
  }, [slug, t]);
  if (erro) return <p role="alert" className="cc-erro">{erro}</p>;
  if (!dados) return <p className="cc-nota">{t.carregando}</p>;
  const m = t.margem;
  const criar = () => fazer(async () => {
    const r = await criacao.criarRascunho(slug, novo.titulo.trim(), novo.tipo, novo.corpo);
    setNovo({ titulo: "", tipo: novo.tipo, corpo: "" });
    carregar();
    aoAbrir(r.pagina);
    return m.criado;
  });
  return (
    <>
      <section className="cc-bloco" aria-labelledby={`${id}-r`}>
        <h2 id={`${id}-r`} className="al-cond">{m.rascunhos}</h2>
        {dados.rascunhos.length === 0 ? <p className="cc-nota">{m.semRascunhos}</p> : (
          <ul className="cc-lista">
            {dados.rascunhos.map((r) => (
              <li key={r.pagina} className="cc-item">
                <div>
                  <strong>{r.titulo}</strong>
                  <span className="cc-selo">{m.tipos[r.tipo]}</span>
                  <p className="cc-nota">
                    {r.situacao === "aberto" ? m.aberto : m.fechado} · {por(m.versao, { n: r.versao })} · {diaNoIdioma(lang, r.editado_em)}
                    {r.sugestoes_abertas ? ` · ${m.comSugestoes}` : ""}
                  </p>
                </div>
                <Botao variante="contorno" tamanho="p" onClick={() => aoAbrir(r.pagina)} aria-label={`${m.abrir}: ${r.titulo}`}>{m.abrir}</Botao>
              </li>
            ))}
          </ul>
        )}
        <h3 className="mt-5">{m.novo}</h3>
        {dados.pode_criar ? (
          <form className="cc-form" onSubmit={(e) => { e.preventDefault(); void criar(); }}>
            <div className="cc-grade">
              <label className="cc-campo"><span>{m.tituloDoRascunho}</span><input value={novo.titulo} onChange={(e) => setNovo({ ...novo, titulo: e.target.value })} minLength={2} maxLength={120} required /></label>
              <label className="cc-campo"><span>{m.tipo}</span>
                <select value={novo.tipo} onChange={(e) => setNovo({ ...novo, tipo: e.target.value as "nota" | "manifesto" })}>
                  <option value="manifesto">{m.tipos.manifesto}</option>
                  <option value="nota">{m.tipos.nota}</option>
                </select>
              </label>
            </div>
            <label className="cc-campo"><span>{m.texto}</span><textarea value={novo.corpo} onChange={(e) => setNovo({ ...novo, corpo: e.target.value })} maxLength={20000} required /></label>
            <div className="cc-acoes"><Botao type="submit" disabled={ocupado}>{m.criar}</Botao></div>
            {avisos}
          </form>
        ) : <p className="cc-nota">{m.soQuemEdita}</p>}
      </section>
      <section className="cc-bloco" aria-labelledby={`${id}-a`}>
        <h2 id={`${id}-a`} className="al-cond">{m.acervo}</h2>
        {dados.paginas.length === 0 ? <p className="cc-nota">{m.semPaginas}</p> : (
          <ul className="cc-lista">
            {dados.paginas.map((p) => (
              <li key={p.pagina} className="cc-item">
                <div><strong>{p.titulo}</strong><p className="cc-nota">{por(m.versao, { n: p.versao })} · {diaNoIdioma(lang, p.editado_em)}</p></div>
                <Botao variante="contorno" tamanho="p" onClick={() => aoAbrir(p.pagina)} aria-label={`${m.abrir}: ${p.titulo}`}>{m.abrir}</Botao>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

/** Onde a seleção está, em letras do texto (o corpo é texto puro: os pedaços somam exatamente o corpo). */
function selecaoNoCorpo(el: HTMLElement): { inicio: number; fim: number } | null {
  const sel = typeof window !== "undefined" ? window.getSelection() : null;
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const r = sel.getRangeAt(0);
  if (!el.contains(r.startContainer) || !el.contains(r.endContainer)) return null;
  const antes = document.createRange();
  antes.setStart(el, 0);
  antes.setEnd(r.startContainer, r.startOffset);
  const inicio = antes.toString().length;
  return { inicio, fim: inicio + r.toString().length };
}

/** Uma página com a margem: o texto pintado, a escolha do trecho, as sugestões (rascunho) e as anotações com respostas. */
function Pagina({ t, lang, slug, pagina, aoVoltar }: { t: T; lang: string; slug: string; pagina: string; aoVoltar: () => void }) {
  const m = t.margem;
  const [dados, setDados] = useState<PaginaComMargem | null>(null);
  const [erro, setErro] = useState("");
  const [sel, setSel] = useState<{ inicio: number; fim: number; trecho: string } | null>(null);
  const [modo, setModo] = useState<"anotar" | "sugerir" | "comentar" | null>(null);
  const [texto, setTexto] = useState("");
  const [proposta, setProposta] = useState("");
  const [motivo, setMotivo] = useState("");
  const [ativa, setAtiva] = useState<string | null>(null);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const corpo = useRef<HTMLDivElement>(null);
  const { ocupado, fazer, avisos } = useAcao(t);
  const id = useId();

  const carregar = useCallback(async () => {
    try {
      setDados(await criacao.pagina(slug, pagina));
    } catch (e) {
      setErro(textoDoErro(t.erros, e));
    }
  }, [slug, pagina, t]);
  useEffect(() => {
    let vivo = true;
    criacao.pagina(slug, pagina).then((d) => vivo && setDados(d), (e) => vivo && setErro(textoDoErro(t.erros, e)));
    return () => {
      vivo = false;
    };
  }, [slug, pagina, t]);

  const lugares = useMemo(() => {
    if (!dados) return new Map<string, { inicio: number; fim: number } | null>();
    return new Map(dados.anotacoes.map((a) => [a.id, reancorar(dados.pagina.corpo, a, dados.pagina.versao)]));
  }, [dados]);
  const marcas = useMemo(() => (dados?.anotacoes ?? []).filter((a) => !a.resolvida && lugares.get(a.id)).map((a) => ({ id: a.id, ...lugares.get(a.id)! })), [dados, lugares]);

  if (erro) return (<><p role="alert" className="cc-erro">{erro}</p><div className="cc-acoes"><Botao variante="contorno" onClick={aoVoltar}>{m.voltar}</Botao></div></>);
  if (!dados) return <p className="cc-nota">{t.carregando}</p>;

  const p = dados.pagina;
  const escolher = () => {
    if (!corpo.current) return;
    const s = selecaoNoCorpo(corpo.current);
    const v = s ? selecaoValida(p.corpo, s.inicio, s.fim) : null;
    setSel(v);
    if (!v && modo !== "comentar") setModo(null);
  };
  const limpar = () => {
    setModo(null);
    setTexto("");
    setProposta("");
    setMotivo("");
    setSel(null);
  };
  const repetido = sel && modo === "sugerir" ? trechoParaSugerir(p.corpo, sel.trecho) : null;
  const enviar = () => fazer(async () => {
    if (modo === "sugerir" && sel) {
      await criacao.sugerir(slug, pagina, p.versao, sel.trecho, proposta, motivo);
      limpar();
      await carregar();
      return m.sugerido;
    }
    const comTrecho = modo === "anotar" && sel;
    await criacao.anotar(slug, pagina, p.versao, comTrecho ? sel.inicio : null, comTrecho ? sel.fim : null, texto);
    limpar();
    await carregar();
    return m.anotado;
  });
  const decidir = (sid: string, aceitar: boolean) => fazer(async () => {
    await criacao.decidir(sid, aceitar);
    await carregar();
  });
  const apagar = (tipo: "anotacao" | "resposta" | "sugestao", aid: string) => fazer(async () => {
    if (!(await confirmar(m.confirmarApagar, { perigo: true }))) return;
    await criacao.apagar(tipo, aid);
    await carregar();
  });
  const resolver = (aid: string, sim: boolean) => fazer(async () => {
    await criacao.resolver(aid, sim);
    await carregar();
  });
  const responder = (aid: string) => fazer(async () => {
    await criacao.responder(aid, respostas[aid] ?? "");
    setRespostas({ ...respostas, [aid]: "" });
    await carregar();
  });
  const fechar = (sim: boolean) => fazer(async () => {
    if (sim && !(await confirmar(m.confirmarFechar))) return;
    await criacao.fechar(slug, pagina, sim);
    await carregar();
  });

  const abertas = dados.sugestoes.filter((s) => s.situacao === "aberta");
  const decididas = dados.sugestoes.filter((s) => s.situacao !== "aberta");

  return (
    <div>
      <div className="cc-acoes mb-4">
        <Botao variante="contorno" onClick={aoVoltar}>← {m.voltar}</Botao>
        <Link href={`/${lang}/alumia/c/${encodeURIComponent(slug)}/wiki`} className="al-botao al-botao-fantasma al-botao-m">{m.historico}</Link>
      </div>
      <h2 className="al-cond text-3xl">{p.titulo}</h2>
      <p className="cc-nota">
        {dados.rascunho ? `${m.tipos[dados.rascunho.tipo]} · ${dados.rascunho.situacao === "aberto" ? m.aberto : m.fechado} · ` : ""}
        {por(m.versao, { n: p.versao })}
      </p>
      <p className="cc-aviso mt-3">{m.quemVe}</p>
      {dados.rascunho?.situacao === "fechado" && <p className="cc-aviso">{m.fechadoAviso}</p>}
      {!dados.rascunho && p.travada && <p className="cc-aviso">{m.travada}</p>}

      <div className="cc-leitura">
        <div>
          <div ref={corpo} className="cc-corpo" onMouseUp={escolher} onKeyUp={escolher} onTouchEnd={() => setTimeout(escolher, 0)} tabIndex={0} aria-describedby={`${id}-dica`}>
            {pedacos(p.corpo, marcas).map((x) =>
              x.ids.length ? (
                <mark key={x.inicio} className="cc-marca" data-ativa={x.ids.includes(ativa ?? "") ? "" : undefined} onClick={() => setAtiva(x.ids[0])}>{x.texto}</mark>
              ) : <span key={x.inicio}>{x.texto}</span>,
            )}
          </div>
          <p id={`${id}-dica`} className="cc-nota">{m.selecionar}</p>
          <div className="cc-acoes mt-3">
            <Botao variante="contorno" tamanho="p" disabled={!sel || !dados.pode.anotar} onClick={() => setModo("anotar")} pressionado={modo === "anotar"}>{m.anotar}</Botao>
            {dados.pode.sugerir && <Botao variante="contorno" tamanho="p" disabled={!sel} onClick={() => setModo("sugerir")} pressionado={modo === "sugerir"}>{m.sugerir}</Botao>}
            <Botao variante="fantasma" tamanho="p" onClick={() => { setSel(null); setModo("comentar"); }} pressionado={modo === "comentar"}>{m.comentar}</Botao>
          </div>
          {modo && (
            <form className="cc-form cc-bloco mt-3" onSubmit={(e) => { e.preventDefault(); void enviar(); }}>
              {modo !== "comentar" && sel && (<><span className="cc-nota">{m.trecho}</span><blockquote className="cc-trecho">{sel.trecho}</blockquote></>)}
              {modo === "sugerir" ? (
                <>
                  {repetido && <p role="alert" className="cc-erro">{repetido === "repetido" ? m.trechoRepetido : t.erros["invalido:trecho"]}</p>}
                  <label className="cc-campo"><span>{m.proposta}</span><textarea value={proposta} onChange={(e) => setProposta(e.target.value)} maxLength={2000} /></label>
                  <label className="cc-campo"><span>{m.motivo}</span><input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={280} /></label>
                  {sel && !repetido && <p className="cc-nota">{m.previaDaTroca}: <span className="cc-del">{sel.trecho}</span> {proposta && <span className="cc-ins">{proposta}</span>}</p>}
                </>
              ) : (
                <label className="cc-campo"><span>{m.suaAnotacao}</span><textarea value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={1000} required /></label>
              )}
              <div className="cc-acoes">
                <Botao type="submit" disabled={ocupado || (modo === "sugerir" && (!sel || !!repetido))}>{m.enviar}</Botao>
                <Botao variante="fantasma" onClick={limpar}>{m.cancelar}</Botao>
              </div>
            </form>
          )}
          {avisos}
          {dados.pode.fechar && dados.rascunho && (
            <div className="cc-acoes mt-4">
              {dados.rascunho.situacao === "aberto"
                ? <Botao variante="contorno" onClick={() => fechar(true)}>{m.fechar}</Botao>
                : <Botao variante="contorno" onClick={() => fechar(false)}>{m.reabrirRascunho}</Botao>}
            </div>
          )}
        </div>

        <div>
          {dados.rascunho && (
            <section className="cc-bloco" aria-labelledby={`${id}-s`}>
              <h3 id={`${id}-s`}>{m.sugestoes}</h3>
              {dados.sugestoes.length === 0 ? <p className="cc-nota">{m.semSugestoes}</p> : (
                <ul className="cc-lista">
                  {[...abertas, ...decididas].map((s) => (
                    <li key={s.id} className="cc-cartao" data-resolvida={s.situacao !== "aberta" ? "" : undefined}>
                      <p>
                        {s.proposta ? <>{m.trocar} <span className="cc-del">{s.trecho}</span> {m.por} <span className="cc-ins">{s.proposta}</span></> : <>{m.tirar} <span className="cc-del">{s.trecho}</span></>}
                      </p>
                      {s.motivo && <p className="cc-nota">{m.porque}: {s.motivo}</p>}
                      <p className="cc-nota">{m.situacoes[s.situacao]}{s.minha ? ` · ${m.sua}` : ""} · {diaNoIdioma(lang, s.criado_em)}</p>
                      {s.situacao === "aberta" && s.proposta && trechoParaSugerir(p.corpo, s.trecho) === null && (
                        <p className="cc-nota">{m.previaDaTroca}: {comSugestao(p.corpo, s.trecho, s.proposta).slice(Math.max(0, p.corpo.indexOf(s.trecho) - 40), p.corpo.indexOf(s.trecho) + s.proposta.length + 40)}</p>
                      )}
                      <div className="cc-acoes">
                        {s.situacao === "aberta" && dados.pode.decidir && (
                          <>
                            <Botao tamanho="p" disabled={ocupado} onClick={() => decidir(s.id, true)}>{m.aceitar}</Botao>
                            <Botao variante="contorno" tamanho="p" disabled={ocupado} onClick={() => decidir(s.id, false)}>{m.recusar}</Botao>
                          </>
                        )}
                        {s.situacao === "aberta" && (s.minha || dados.pode.moderar) && <Botao variante="fantasma" tamanho="p" onClick={() => apagar("sugestao", s.id)}>{m.apagar}</Botao>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          <section className="cc-bloco" aria-labelledby={`${id}-m`}>
            <h3 id={`${id}-m`}>{m.anotacoes}</h3>
            {dados.anotacoes.length === 0 ? <p className="cc-nota">{m.semAnotacoes}</p> : (
              <ul className="cc-lista">
                {dados.anotacoes.map((a) => {
                  const lugar = lugares.get(a.id);
                  return (
                    <li key={a.id} className="cc-cartao" data-ativa={ativa === a.id ? "" : undefined} data-resolvida={a.resolvida ? "" : undefined}>
                      {a.trecho ? <blockquote className="cc-trecho" onClick={() => setAtiva(a.id)}>{a.trecho}</blockquote> : <p className="cc-nota">{m.paginaInteira}</p>}
                      {a.trecho && !lugar && <p className="cc-nota">{por(m.trechoMudou, { n: a.versao })}</p>}
                      <p>{a.texto}</p>
                      <p className="cc-nota">{a.resolvida ? `${m.resolvida} · ` : ""}{a.minha ? `${m.sua} · ` : ""}{diaNoIdioma(lang, a.criado_em)}</p>
                      {a.respostas.length > 0 && (
                        <ul className="cc-respostas">
                          {a.respostas.map((r) => (
                            <li key={r.id}>
                              <p>{r.texto}</p>
                              <p className="cc-nota">{r.minha ? `${m.sua} · ` : ""}{diaNoIdioma(lang, r.criado_em)}
                                {(r.minha || dados.pode.moderar) && <> · <button type="button" className="al-botao al-botao-fantasma al-botao-p" onClick={() => apagar("resposta", r.id)}>{m.apagar}</button></>}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                      <form className="cc-form mt-2" onSubmit={(e) => { e.preventDefault(); void responder(a.id); }}>
                        <label className="cc-campo"><span className="sr-only">{m.suaResposta}</span>
                          <input value={respostas[a.id] ?? ""} onChange={(e) => setRespostas({ ...respostas, [a.id]: e.target.value })} placeholder={m.suaResposta} maxLength={1000} />
                        </label>
                        <div className="cc-acoes">
                          <Botao type="submit" variante="contorno" tamanho="p" disabled={ocupado || !(respostas[a.id] ?? "").trim()}>{m.responder}</Botao>
                          {(a.minha || dados.pode.decidir || dados.pode.moderar) && (
                            <Botao variante="fantasma" tamanho="p" onClick={() => resolver(a.id, !a.resolvida)}>{a.resolvida ? m.reabrir : m.resolver}</Botao>
                          )}
                          {(a.minha || dados.pode.moderar) && <Botao variante="fantasma" tamanho="p" onClick={() => apagar("anotacao", a.id)}>{m.apagar}</Botao>}
                        </div>
                      </form>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

/** A parte dos rascunhos e da margem: escolher a comunidade, a lista e a página aberta. */
export function Margem({ t, lang, inicial, aoMudar }: { t: T; lang: string; inicial: { c?: string; p?: string }; aoMudar: (c: string | null, p: string | null) => void }) {
  const [comunidades, setComunidades] = useState<MinhaComunidade[] | null>(null);
  const [erro, setErro] = useState("");
  const [slug, setSlug] = useState<string | null>(inicial.c ?? null);
  const [pagina, setPagina] = useState<string | null>(inicial.p ?? null);
  const id = useId();
  useEffect(() => {
    let vivo = true;
    criacao.minhasComunidades().then((l) => {
      if (!vivo) return;
      setComunidades(l);
      setSlug((atual) => (atual && l.some((c) => c.slug === atual) ? atual : l[0]?.slug ?? null));
    }, (e) => vivo && setErro(textoDoErro(t.erros, e)));
    return () => {
      vivo = false;
    };
  }, [t]);
  const m = t.margem;
  if (erro) return <p role="alert" className="cc-erro">{erro}</p>;
  if (!comunidades) return <p className="cc-nota">{t.carregando}</p>;
  if (comunidades.length === 0) return <p className="cc-aviso">{m.nenhumaComunidade}</p>;
  const abrir = (p: string | null) => {
    setPagina(p);
    aoMudar(slug, p);
  };
  return (
    <div>
      {!pagina && (
        <>
          <label className="cc-campo mb-4" htmlFor={`${id}-c`}>
            <span>{m.comunidade}</span>
            <select id={`${id}-c`} value={slug ?? ""} onChange={(e) => { setSlug(e.target.value); aoMudar(e.target.value, null); }}>
              {comunidades.map((c) => <option key={c.slug} value={c.slug}>{c.nome}</option>)}
            </select>
          </label>
          <p className="cc-aviso">{m.quemVe} {m.nucleo}</p>
        </>
      )}
      {slug && (pagina
        ? <Pagina key={`${slug}/${pagina}`} t={t} lang={lang} slug={slug} pagina={pagina} aoVoltar={() => abrir(null)} />
        : <Lista key={slug} t={t} lang={lang} slug={slug} aoAbrir={(p) => abrir(p)} />)}
    </div>
  );
}
