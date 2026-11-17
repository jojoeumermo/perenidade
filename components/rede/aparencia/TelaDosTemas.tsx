// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import Link from "@/components/Link";
import { b1 } from "@/lib/rede/cliente-b1";
import { preencher } from "@/lib/rede/preencher";
import type { Post } from "@/lib/rede/tipos";
import { enderecosDescoberta } from "@/lib/rede/tipos-descoberta";
import { erroDaB1, useTextosB1 } from "../b1/base";
import { FaixaDaPrevia, PostCompacto, previa, Torradas, useTextosAlumia3, useTorrada } from "../conversa/base3";
import { postsComTemas } from "../descoberta/previa";
import { textoDoErro } from "../erros";
import { EsqueletoDaLinha } from "../Esqueletos";
import { Icone } from "../publicar/alumia2/icones";
import type { PropsDaTelaDoPacote } from "../registro";
import { Botao, LinkBotao } from "../ui/Botao";
import { EstadoDaAlumia } from "../ui/Estado";
import { useTextosDoAcabamento } from "./base";
// O cartão compacto e a lista que entra são da folha da conversa (só vale dentro de [data-al="2"]).
import "../conversa/alumia3.css";

type Pagina = { itens: Post[]; proximo: string | null; tags: string[] };

/** Os temas de exemplo da prévia: os posts com #tema de components/rede/descoberta/previa.ts. Nada vai ao banco. */
const TEMAS_DA_PREVIA = ["tarifazero", "passelivre", "maisvalia"];
function linhaDaPrevia(tag: string | null): Pagina {
  const todos = postsComTemas();
  const itens = tag ? todos.filter((p) => p.texto.toLowerCase().includes(`#${tag}`)) : todos;
  return { itens, proximo: null, tags: TEMAS_DA_PREVIA };
}

/**
 * A linha dos #temas (/alumia/temas): os posts dos temas que a pessoa segue (rede_alumia_linha_tags), todos juntos ou um de cada
 * vez, sempre do mais novo para o mais antigo: a ordem é a mesma para todo mundo e não depende do que a pessoa fez. O que ela
 * segue só ela vê. Sem tema seguido, a tela leva ao Explorar; com temas e nada novo, diz que está tudo em dia.
 */
export default function TelaDosTemas({ lang, s, situacao }: PropsDaTelaDoPacote) {
  const t = useTextosDoAcabamento(lang);
  const tb = useTextosB1(lang);
  const t3 = useTextosAlumia3(lang);
  const torradas = useTorrada();
  const [tag, setTag] = useState<string | null>(null);
  const [tags, setTags] = useState<string[] | null>(null);
  const [pagina, setPagina] = useState<{ tag: string | null; itens: Post[]; proximo: string | null } | null>(null);
  const [erro, setErro] = useState<{ tag: string | null; texto: string } | null>(null);
  const [vez, setVez] = useState(0);
  const [mais, setMais] = useState(false);
  const membro = situacao.logado && situacao.membro;

  useEffect(() => {
    if (!membro) return;
    let vivo = true;
    (previa() ? Promise.resolve(linhaDaPrevia(tag)) : b1.linhaDosTemas(tag))
      .then((r) => {
        if (!vivo) return;
        setTags(r.tags ?? []);
        setPagina({ tag, itens: r.itens ?? [], proximo: r.proximo ?? null });
        setErro(null);
      })
      .catch((e) => {
        if (!vivo) return;
        setErro({ tag, texto: tb ? erroDaB1(s, tb, e) : textoDoErro(s, e) });
      });
    return () => {
      vivo = false;
    };
    // `vez` muda quando a pessoa toca em "Tentar de novo".
  }, [membro, tag, vez, s, tb]);

  async function carregarMais() {
    if (!pagina?.proximo || mais) return;
    setMais(true);
    try {
      const r = await b1.linhaDosTemas(tag, pagina.proximo);
      setPagina((atual) => (atual && atual.tag === tag ? { tag, itens: [...atual.itens, ...r.itens.filter((p) => !atual.itens.some((x) => x.id === p.id))], proximo: r.proximo } : atual));
    } catch (e) {
      torradas.mostrar({ texto: textoDoErro(s, e), erro: true });
    } finally {
      setMais(false);
    }
  }

  if (!t || !tb || !t3) return <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={3} />;
  const x = t.temas;
  const daVez = pagina?.tag === tag ? pagina : null;
  const erroDaVez = erro?.tag === tag ? erro.texto : null;
  return (
    <section className="ac-tela al3-tela" aria-labelledby="ac-temas-titulo">
      <FaixaDaPrevia t={t3} />
      <header className="ac-cabeca">
        <h1 id="ac-temas-titulo" className="al-cond ac-titulo">{tb.temas.titulo}</h1>
        <p className="ac-lead">{tb.temas.descricao}</p>
        {membro && tags && tags.length > 0 && (
          <div role="radiogroup" aria-label={x.filtro} className="ac-fichas ac-fichas-rolam mt-4">
            <button type="button" role="radio" aria-checked={tag === null} className="ac-ficha" onClick={() => setTag(null)}>
              {tb.temas.todos}
            </button>
            {tags.map((nome) => (
              <button key={nome} type="button" role="radio" aria-checked={tag === nome} className="ac-ficha" onClick={() => setTag(nome)}>
                #{nome}
              </button>
            ))}
          </div>
        )}
      </header>

      {!membro ? (
        <EstadoDaAlumia icone="cadeado" texto={x.entre} />
      ) : erroDaVez ? (
        <EstadoDaAlumia erro titulo={x.erroTitulo} texto={erroDaVez}>
          <Botao variante="claro" onClick={() => { setErro(null); setVez((n) => n + 1); }}>{x.tentar}</Botao>
        </EstadoDaAlumia>
      ) : !daVez || !tags ? (
        <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={3} />
      ) : tags.length === 0 ? (
        <EstadoDaAlumia icone="tema" titulo={x.vazioTitulo} texto={tb.temas.vazio}>
          <LinkBotao href={enderecosDescoberta.explorar(lang)} variante="claro">{x.explorar}</LinkBotao>
        </EstadoDaAlumia>
      ) : daVez.itens.length === 0 ? (
        <EstadoDaAlumia mosaico titulo={x.nadaTitulo} texto={tb.temas.nada}>
          {tag && <LinkBotao href={enderecosDescoberta.tag(lang, tag)} variante="contorno">{preencher(x.abrirTema, { tag })}</LinkBotao>}
        </EstadoDaAlumia>
      ) : (
        <>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-[var(--al-linha)] px-[18px] py-2 text-xs text-[var(--al-texto-3)]">
            <span>{x.ordem}</span>
            {tag && (
              <Link href={enderecosDescoberta.tag(lang, tag)} className="inline-flex min-h-11 items-center gap-1 font-bold text-[var(--al-texto-2)] underline">
                {preencher(x.abrirTema, { tag })}
                <Icone nome="chevron" className="h-4 w-4" />
              </Link>
            )}
          </p>
          <ol aria-label={tb.temas.titulo} className="al3-lista-entra">
            {daVez.itens.map((p, i) => (
              <li key={p.id} style={{ "--i": i } as React.CSSProperties}>
                <PostCompacto post={p} lang={lang} s={s} t={t3} logado={situacao.logado} comComunidade aoErro={(e) => torradas.mostrar({ texto: textoDoErro(s, e), erro: true })} />
              </li>
            ))}
          </ol>
          {daVez.proximo ? (
            <div className="px-[18px] py-4 text-center">
              <Botao variante="contorno" disabled={mais} onClick={() => void carregarMais()}>{mais ? s.estados.carregando : tb.temas.mais}</Botao>
            </div>
          ) : (
            <p className="px-[18px] py-6 text-center text-sm text-[var(--al-texto-3)]">{s.estados.fim}</p>
          )}
        </>
      )}
      <Torradas estado={torradas} />
    </section>
  );
}
