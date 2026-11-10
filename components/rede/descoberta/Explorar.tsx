// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import Link from "@/components/Link";
import { conversa } from "@/lib/rede/cliente-conversa";
import { redeDescoberta } from "@/lib/rede/cliente-descoberta";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { TextosDaDescoberta } from "@/lib/rede/textos-descoberta";
import { enderecos } from "@/lib/rede/tipos";
import { corDaComunidadeNova } from "@/lib/rede/tipos-comunidades";
import { ORDENS, enderecosDescoberta, type Explorar as DadosDoExplorar, type Ordem, type PacoteDePessoas } from "@/lib/rede/tipos-descoberta";
import { textoDoErro } from "../erros";
import { EsqueletoDaLinha } from "../Esqueletos";
import type { PropsDaTelaDoPacote } from "../registro";
import { FaixaDaPrevia, IconeBusca, previa, Torradas, useTextosAlumia3, useTorrada } from "../conversa/base3";
import { ListaOrdenada } from "./ListaOrdenada";
import { PassoEscolhas } from "./PassoEscolhas";
import { descobertaDaPrevia } from "./previa";
import { useTextosDescoberta } from "./textos";
// O visual novo (só com "rede-v2" + "alumia-2": a folha só vale dentro de [data-al="2"]).
import "../conversa/alumia3.css";

const botao = "min-h-11 cursor-pointer rounded-full border-[1.5px] border-ink px-4 font-bold hover:bg-parchment-deep disabled:opacity-50";

/** Um pacote de pessoas para seguir: abre para ver quem está nele e segue todas de uma vez. */
function Pacote({ lang, slug, titulo, descricao, pessoas, d, s }: { lang: string; slug: string; titulo: string; descricao: string; pessoas: number; d: TextosDaDescoberta; s: TextosDaRede }) {
  const e = d.explorar;
  const [aberto, setAberto] = useState(false);
  const [dados, setDados] = useState<PacoteDePessoas | null>(null);
  const [msg, setMsg] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function abrir() {
    setAberto(!aberto);
    if (aberto || dados) return;
    try {
      setDados(await redeDescoberta.pacote(slug));
    } catch (x) {
      setMsg(textoDoErro(s, x));
    }
  }
  async function seguir() {
    setOcupado(true);
    setMsg("");
    try {
      const r = await redeDescoberta.seguirPacote(slug);
      setMsg(r.seguidos > 0 ? preencher(e.seguiu, { n: r.seguidos }) : e.jaSegue);
      setDados(await redeDescoberta.pacote(slug));
    } catch (x) {
      setMsg(textoDoErro(s, x));
    } finally {
      setOcupado(false);
    }
  }
  return (
    <li className="rounded-xl border border-rule p-3">
      <p className="font-bold">{titulo}</p>
      {descricao && <p className="text-sm text-ink-soft">{descricao}</p>}
      <p className="text-sm text-ink-soft">{preencher(e.pessoas, { n: pessoas })}</p>
      <button type="button" onClick={() => void abrir()} aria-expanded={aberto} className={`${botao} mt-2`}>
        {e.abrirPacote}
      </button>
      {aberto && dados && (
        <div className="mt-2">
          <ul className="space-y-1">
            {dados.pessoas.map((p) => (
              <li key={p.handle} className="flex flex-wrap items-baseline gap-x-2">
                <Link href={enderecos.perfil(lang, p.handle)} className="font-bold hover:underline">{p.codinome}</Link>
                <span className="text-sm text-ink-soft">@{p.handle}</span>
                {p.sigo && <span className="text-xs">{e.sigo}</span>}
                {p.bio && <span className="w-full text-sm">{p.bio}</span>}
              </li>
            ))}
          </ul>
          <button type="button" disabled={ocupado} onClick={() => void seguir()} className="mt-2 min-h-11 cursor-pointer rounded-full bg-[#c21f16] px-5 font-bold text-white hover:bg-[#1f1a14] disabled:opacity-50">
            {e.seguirTodos}
          </button>
        </div>
      )}
      {msg && (
        <p role="status" className="mt-2 text-sm">
          {msg}
        </p>
      )}
    </li>
  );
}

/**
 * Explorar (/alumia/explorar): comunidades, linhas temáticas com a regra pública, pacotes de pessoas para seguir e as hashtags da
 * semana. Com ?linha=<slug> mostra a linha temática, com a ordenação escrita. Nada aqui é "para você": é o mesmo para quem tem a mesma permissão.
 */
export default function Explorar({ lang, s, situacao, aoEscrever }: PropsDaTelaDoPacote) {
  const d = useTextosDescoberta(lang);
  const linhaPedida = useSearchParams().get("linha") ?? "";
  const [versao, setVersao] = useState(0);
  const [estado, setEstado] = useState<{ versao: number; dados: DadosDoExplorar | null; erro: string } | null>(null);
  const [editando, setEditando] = useState(false);
  const t = useTextosAlumia3(lang);
  const torradas = useTorrada();
  // Os #temas que a própria pessoa segue (20261110-alumia-comunidade.sql): só ela vê. Banco sem a migração: a faixa não aparece.
  const [minhasTags, setMinhasTags] = useState<string[]>(() => (previa() ? ["tarifazero", "moradiadigna"] : []));
  const fonte = previa() ? descobertaDaPrevia : redeDescoberta;

  useEffect(() => {
    if (previa() || !situacao.logado) return;
    let vivo = true;
    conversa
      .tagsSeguidas()
      .then((r) => vivo && setMinhasTags(r.tags))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [situacao.logado]);

  useEffect(() => {
    let vivo = true;
    (previa() ? descobertaDaPrevia : redeDescoberta)
      .explorar()
      .then((dados) => vivo && setEstado({ versao, dados, erro: "" }))
      .catch((x) => vivo && setEstado({ versao, dados: null, erro: textoDoErro(s, x) }));
    return () => {
      vivo = false;
    };
  }, [versao, s]);

  if (!d || !t || estado?.versao !== versao) return <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={4} />;
  if (!estado.dados) {
    return (
      <div className="px-[18px] py-6 font-sans" role="alert">
        <p className="text-oxblood">{estado.erro || d.estados.erro}</p>
        <button type="button" onClick={() => setVersao((n) => n + 1)} className={`${botao} mt-3`}>
          {d.estados.tentar}
        </button>
      </div>
    );
  }
  const x = estado.dados;
  const e = d.explorar;
  const linha = x.linhas.find((l) => l.slug === linhaPedida) ?? null;
  const categorias = ["lutas", "disciplinas", "instituto"] as const;

  // Ligar ou desligar "aparecer nos pacotes" muda só o botão: uma falha vira aviso flutuante e o resto do Explorar fica como está.
  // Na prévia (sem conta), a escolha fica só nesta tela.
  async function aparecer(sim: boolean) {
    const marcar = () =>
      setEstado((atual) => (atual?.dados ? { ...atual, dados: { ...atual.dados, eu: { ...(atual.dados.eu ?? { passo: "pronto", regras_versao: 0 }), aparece: sim } } } : atual));
    if (previa()) return marcar();
    try {
      await redeDescoberta.aparecer(sim);
      marcar();
    } catch (erro) {
      torradas.mostrar({ texto: textoDoErro(s, erro) || (d?.estados.erro ?? ""), erro: true });
    }
  }

  return (
    <div className="al3-tela al3-explorar font-sans">
      <FaixaDaPrevia t={t} />
      <header className="border-b border-rule px-[18px] py-4">
        <h1 className="al3-cond al3-titulo-tela">{e.titulo}</h1>
        <p className="mt-1 text-ink-soft">{e.lead}</p>
        {/* A busca mora aqui no celular (a aba Explorar da barra de baixo) e no topo da página no computador. */}
        <form action={enderecosDescoberta.buscar(lang)} method="get" role="search" className="al3-buscar-form">
          <label className="sr-only" htmlFor="al3-explorar-q">{t.descoberta.buscar}</label>
          <span className="al3-busca">
            <IconeBusca />
            <input id="al3-explorar-q" name="q" type="search" maxLength={200} placeholder={t.descoberta.buscar} enterKeyHint="search" />
          </span>
        </form>
        {situacao.membro && !previa() && x.eu?.passo !== "entrar" && (
          <button type="button" onClick={() => setEditando(!editando)} aria-expanded={editando} className={`${botao} mt-3`}>
            {e.mudarEscolhas}
          </button>
        )}
      </header>

      {editando && (
        <div className="border-b border-rule px-[18px] py-4">
          <PassoEscolhas
            lang={lang}
            s={s}
            d={d}
            inicial={x.eu}
            aoSalvar={() => {
              setEditando(false);
              setVersao((n) => n + 1);
            }}
          />
        </div>
      )}

      {linha ? (
        <section aria-labelledby="explorar-linha">
          <div className="border-b border-rule px-[18px] py-3">
            <h2 id="explorar-linha" className="font-serif text-xl font-semibold">{preencher(e.linhaAtiva, { titulo: linha.titulo })}</h2>
            <p className="text-sm text-ink-soft">
              {e.regra}: {linha.regra}
            </p>
            <Link href={enderecosDescoberta.explorar(lang)} className="mt-1 inline-block text-sm underline">
              {e.fecharLinha}
            </Link>
          </div>
          <ListaOrdenada
            lang={lang}
            s={s}
            d={d}
            logado={situacao.logado}
            chave={`linha:${linha.slug}`}
            ordens={ORDENS}
            ordemInicial="novos"
            carregar={(ordem, cursor) => fonte.linha(situacao.logado ? "tudo" : "geral", ordem as Ordem, cursor, 20, { linha: linha.slug })}
            vazio={d.tag.vazio}
            aoResponder={aoEscrever}
          />
        </section>
      ) : (
        <div className="al3-explorar-corpo space-y-7 px-[18px] py-5">
          {minhasTags.length > 0 && (
            <section aria-labelledby="explorar-minhas" className="al3-entra">
              <h2 id="explorar-minhas" className="al3-cond al3-titulo-secao">{t.descoberta.suasTags}</h2>
              <p className="text-sm text-ink-soft">{t.descoberta.seguirTagRegra}</p>
              <ul className="al3-fichas mt-2">
                {minhasTags.map((tag, i) => (
                  <li key={tag} style={{ "--i": i } as CSSProperties}>
                    <Link href={enderecosDescoberta.tag(lang, tag)} className="al3-ficha al3-ficha-minha">
                      <span className="font-bold">#{tag}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="explorar-tags">
            <h2 id="explorar-tags" className="al3-cond al3-titulo-secao">{e.tags}</h2>
            <p className="text-sm text-ink-soft">{e.tagsAjuda}</p>
            {x.tags.length === 0 ? (
              <p className="mt-2 text-ink-soft">{e.tagsVazio}</p>
            ) : (
              // Duas ou mais por linha também no celular; a barrinha embaixo mostra o volume da semana (relativo ao #tema maior).
              <ul className="al3-fichas al3-fichas-volume mt-2">
                {x.tags.map((tg, i) => (
                  <li key={tg.tag} style={{ "--i": i, "--vol": tg.posts / Math.max(1, ...x.tags.map((z) => z.posts)) } as CSSProperties}>
                    <Link href={enderecosDescoberta.tag(lang, tg.tag)} className="al3-ficha">
                      <span className="font-bold">#{tg.tag}</span>
                      <span className="al3-ficha-n" aria-hidden>{tg.posts.toLocaleString(lang)}</span>
                      <span className="sr-only">{preencher(e.posts, { n: tg.posts })}</span>
                      <span className="al3-ficha-barra" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="explorar-linhas">
            <h2 id="explorar-linhas" className="al3-cond al3-titulo-secao">{e.linhas}</h2>
            <p className="text-sm text-ink-soft">{e.linhasAjuda}</p>
            <ul className="al3-cartoes mt-2">
              {x.linhas.map((l, i) => (
                <li key={l.slug} style={{ "--i": i } as CSSProperties}>
                  <Link href={enderecosDescoberta.explorar(lang, l.slug)} className="al3-cartao">
                    <span className="al3-cartao-titulo">{l.titulo}</span>
                    <span className="al3-cartao-regra">
                      {e.regra}: {l.regra}
                    </span>
                    <span className="al3-cartao-ir" aria-hidden>→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {situacao.logado && (
            <section aria-labelledby="explorar-pacotes">
              <h2 id="explorar-pacotes" className="al3-cond al3-titulo-secao">{e.pacotes}</h2>
              <p className="text-sm text-ink-soft">{e.pacotesAjuda}</p>
              {x.pacotes.length === 0 ? (
                <p className="mt-2 text-ink-soft">{e.pacotesVazio}</p>
              ) : (
                <ul className="mt-2 grid gap-2">
                  {x.pacotes.map((p) => (
                    <Pacote key={p.slug} lang={lang} slug={p.slug} titulo={p.titulo} descricao={p.descricao} pessoas={p.pessoas} d={d} s={s} />
                  ))}
                </ul>
              )}
              {situacao.membro && (
                <div className="mt-3 rounded-xl border border-dashed border-ink p-3">
                  <p className="font-bold">{e.aparecerTitulo}</p>
                  <p className="text-sm text-ink-soft">{e.aparecerAjuda}</p>
                  <button type="button" onClick={() => void aparecer(!x.eu?.aparece)} className={`${botao} mt-2`}>
                    {x.eu?.aparece ? e.aparecerDesligar : e.aparecerLigar}
                  </button>
                </div>
              )}
            </section>
          )}

          <section aria-labelledby="explorar-comunidades">
            <h2 id="explorar-comunidades" className="al3-cond al3-titulo-secao">{e.comunidades}</h2>
            {categorias.map((cat) => {
              const lista = x.comunidades.filter((c) => c.categoria === cat);
              if (lista.length === 0) return null;
              return (
                // Seções recolhíveis (T32, item 3): as 77 disciplinas começam fechadas, para as lutas e o Instituto aparecerem.
                <details key={cat} open={cat !== "disciplinas"} className="group mt-3">
                  <summary className="al3-sumario flex min-h-11 cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
                    <span aria-hidden className="al3-sumario-seta" />
                    <h3 className="font-bold">{e.categorias[cat]}</h3>
                    <span className="al3-sumario-n">{lista.length}</span>
                  </summary>
                  <ul className="al3-cartoes mt-1">
                    {lista.map((c, i) => (
                      <li key={c.slug} className={`al3-cor-${corDaComunidadeNova(c.slug, c.cor)}`} style={{ "--i": i } as CSSProperties}>
                        {/* A mini-capa: a faixa na cor da comunidade com o nome na letra condensada, como a capa dela. */}
                        <Link href={enderecos.comunidade(lang, c.slug)} className="al3-cartao al3-minicapa">
                          <span className="al3-minicapa-faixa">
                            <span className="al3-minicapa-nome al3-cond">{c.nome}</span>
                          </span>
                          <span className="al3-minicapa-pe">
                            {c.membro && (
                              <span className="al3-cartao-membro">
                                <span aria-hidden>✓ </span>
                                {e.membro}
                              </span>
                            )}
                            {c.descricao && <span className="al3-cartao-regra">{c.descricao}</span>}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </details>
              );
            })}
          </section>
        </div>
      )}
      <Torradas estado={torradas} />
    </div>
  );
}
