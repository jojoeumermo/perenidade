// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "@/components/Link";
import { redeDescoberta } from "@/lib/rede/cliente-descoberta";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { TextosDaDescoberta } from "@/lib/rede/textos-descoberta";
import { enderecos } from "@/lib/rede/tipos";
import { ORDENS, enderecosDescoberta, type Explorar as DadosDoExplorar, type Ordem, type PacoteDePessoas } from "@/lib/rede/tipos-descoberta";
import { textoDoErro } from "../erros";
import { EsqueletoDaLinha } from "../Esqueletos";
import type { PropsDaTelaDoPacote } from "../registro";
import { ListaOrdenada } from "./ListaOrdenada";
import { PassoEscolhas } from "./PassoEscolhas";
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

  useEffect(() => {
    let vivo = true;
    redeDescoberta
      .explorar()
      .then((dados) => vivo && setEstado({ versao, dados, erro: "" }))
      .catch((x) => vivo && setEstado({ versao, dados: null, erro: textoDoErro(s, x) }));
    return () => {
      vivo = false;
    };
  }, [versao, s]);

  if (!d || estado?.versao !== versao) return <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={4} />;
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

  async function aparecer(sim: boolean) {
    try {
      await redeDescoberta.aparecer(sim);
      setVersao((n) => n + 1);
    } catch {
      setEstado({ versao, dados: null, erro: d?.estados.erro ?? "" });
    }
  }

  return (
    <div className="al3-tela font-sans">
      <header className="border-b border-rule px-[18px] py-4">
        <h1 className="font-serif text-2xl font-extrabold">{e.titulo}</h1>
        <p className="mt-1 text-ink-soft">{e.lead}</p>
        {situacao.membro && x.eu?.passo !== "entrar" && (
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
            carregar={(ordem, cursor) => redeDescoberta.linha(situacao.logado ? "tudo" : "geral", ordem as Ordem, cursor, 20, { linha: linha.slug })}
            vazio={d.tag.vazio}
            aoResponder={aoEscrever}
          />
        </section>
      ) : (
        <div className="space-y-6 px-[18px] py-4">
          <section aria-labelledby="explorar-linhas">
            <h2 id="explorar-linhas" className="font-serif text-xl font-semibold">{e.linhas}</h2>
            <p className="text-sm text-ink-soft">{e.linhasAjuda}</p>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {x.linhas.map((l) => (
                <li key={l.slug} className="rounded-xl border border-rule p-3">
                  <p className="font-bold">{l.titulo}</p>
                  <p className="text-sm text-ink-soft">
                    {e.regra}: {l.regra}
                  </p>
                  <Link href={enderecosDescoberta.explorar(lang, l.slug)} className="mt-1 inline-flex min-h-11 items-center text-sm font-bold underline">
                    {e.ver}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="explorar-tags">
            <h2 id="explorar-tags" className="font-serif text-xl font-semibold">{e.tags}</h2>
            <p className="text-sm text-ink-soft">{e.tagsAjuda}</p>
            {x.tags.length === 0 ? (
              <p className="mt-2 text-ink-soft">{e.tagsVazio}</p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-2">
                {x.tags.map((t) => (
                  <li key={t.tag}>
                    <Link href={enderecosDescoberta.tag(lang, t.tag)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-rule px-3 hover:border-ink">
                      <span className="font-bold">#{t.tag}</span>
                      <span className="text-xs text-ink-soft">{preencher(e.posts, { n: t.posts })}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {situacao.logado && (
            <section aria-labelledby="explorar-pacotes">
              <h2 id="explorar-pacotes" className="font-serif text-xl font-semibold">{e.pacotes}</h2>
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
            <h2 id="explorar-comunidades" className="font-serif text-xl font-semibold">{e.comunidades}</h2>
            {categorias.map((cat) => {
              const lista = x.comunidades.filter((c) => c.categoria === cat);
              if (lista.length === 0) return null;
              return (
                // Seções recolhíveis (T32, item 3): as 77 disciplinas começam fechadas, para as lutas e o Instituto aparecerem.
                <details key={cat} open={cat !== "disciplinas"} className="group mt-3">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
                    <span aria-hidden className="text-[#c21f16] transition-transform group-open:rotate-90">▸</span>
                    <h3 className="font-bold">{e.categorias[cat]}</h3>
                    <span className="rounded-full bg-parchment-deep px-2 text-sm font-bold">{lista.length}</span>
                  </summary>
                  <ul className="mt-1 grid gap-2 sm:grid-cols-2">
                    {lista.map((c) => (
                      <li key={c.slug} className="rounded-xl border border-rule p-3">
                        <Link href={enderecos.comunidade(lang, c.slug)} className="font-bold hover:underline">
                          {c.nome}
                        </Link>
                        {c.membro && <span className="ml-2 text-xs text-ink-soft">{e.membro}</span>}
                        {c.descricao && <p className="text-sm text-ink-soft">{c.descricao}</p>}
                      </li>
                    ))}
                  </ul>
                </details>
              );
            })}
          </section>
        </div>
      )}
    </div>
  );
}
