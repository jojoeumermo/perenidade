// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import Link from "@/components/Link";
import { comunidades } from "@/lib/rede/cliente-comunidades";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { TextosDeComunidades } from "@/lib/rede/textos-comunidades";
import type { Comunidade, Post, Situacao } from "@/lib/rede/tipos";
import { enderecosCom, type SituacaoNaComunidade } from "@/lib/rede/tipos-comunidades";
import { CartaoDePost } from "../CartaoDePost";
import { EsqueletoDaLinha } from "../Esqueletos";
import { Linha } from "../Linha";
import { useAlumia2 } from "../conversa/base3";
import { AcoesDaComunidade } from "./AcoesDaComunidade";
import { PaginaDaComunidadeAlumia } from "./PaginaDaComunidadeAlumia";
import { erroCom, useCarregar } from "./util";

// As ferramentas da moderação só chegam ao navegador de quem modera (e só quando abre a aba Sobre).
const Moderar = dynamic(() => import("./Moderar"), { ssr: false, loading: () => <p className="px-[18px] py-3 font-sans text-sm text-ink-soft">…</p> });

function Falha({ texto }: { texto: string }) {
  return (
    <div className="px-[18px] py-8 font-sans" role="alert">
      <p className="text-ink-soft">{texto}</p>
    </div>
  );
}

/**
 * A página de uma comunidade (R4, itens 36 e 39): cabeçalho com tipo e botão de entrar, abas Posts e Sobre, posts fixados no alto, regras
 * numeradas, etiquetas, moderação por codinome, aulas e trilhas ligadas e as ferramentas de quem modera. Entra no lugar da página
 * simples da fundação quando a rota traz os textos do pacote (lib/rede/textos-comunidades.ts).
 */
function PaginaDaComunidadeDeHoje({
  slug,
  lang,
  s,
  sc,
  situacao,
  aoEscrever,
  aoResponder,
  aoCarregar,
}: {
  slug: string;
  lang: string;
  s: TextosDaRede;
  sc: TextosDeComunidades;
  situacao: Situacao;
  aoEscrever: () => void;
  aoResponder: (p: Post) => void;
  aoCarregar: (c: Comunidade) => void;
}) {
  const { dado, erro, pronto, recarregar } = useCarregar(() => comunidades.pagina(slug), `pagina:${slug}`);
  const [aba, setAba] = useState<"posts" | "sobre">("posts");
  // Depois de entrar ou sair, o que a página mostra vem do banco de novo (fixados, ferramentas, quem pode escrever).
  const [mudou, setMudou] = useState(0);
  const [situacaoLocal, setSituacaoLocal] = useState<{ chave: string; valor: SituacaoNaComunidade } | null>(null);
  const comunidade = dado?.comunidade;
  useEffect(() => {
    if (comunidade) aoCarregar(comunidade);
  }, [comunidade, aoCarregar]);

  if (!pronto) return <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={3} />;
  if (!dado || !comunidade) return <Falha texto={erro ? erroCom(s, sc, erro) : s.estados.naoEncontrado} />;
  const minha: SituacaoNaComunidade = situacaoLocal?.chave === slug ? situacaoLocal.valor : dado.situacao;
  const tipo = comunidade.tipo === "aberta" ? sc.tipo.aberta : comunidade.tipo === "restrita" ? sc.tipo.restrita : sc.tipo.fechada;
  const pode = situacao.logado && situacao.membro;
  const tab = (chave: "posts" | "sobre", texto: string) => (
    <button type="button" role="tab" aria-selected={aba === chave} onClick={() => setAba(chave)} className={`min-h-11 flex-1 cursor-pointer px-3 font-sans font-bold ${aba === chave ? "border-b-[3px] border-[#c21f16]" : "text-ink-soft hover:bg-parchment-deep"}`}>
      {texto}
    </button>
  );
  const mudar = (v: SituacaoNaComunidade) => {
    setSituacaoLocal({ chave: slug, valor: v });
    setMudou((n) => n + 1);
  };
  return (
    <div>
      <header className="border-b border-rule px-[18px] py-4 font-sans">
        <h1 className="font-serif text-2xl font-extrabold">{comunidade.nome}</h1>
        <p className="mt-1 text-sm text-ink-soft">{tipo}</p>
        {comunidade.descricao && <p className="mt-2">{comunidade.descricao}</p>}
        {comunidade.banido && <p className="mt-2 text-oxblood" role="status">{s.comunidade.banido}</p>}
        <AcoesDaComunidade slug={comunidade.slug} tipo={comunidade.tipo} situacao={minha} podeEntrar={pode} s={s} sc={sc} aoMudar={mudar} />
        {pode && !comunidade.banido && (minha === "membro" || comunidade.tipo === "aberta") && (
          <button type="button" onClick={() => aoEscrever()} className="mt-3 min-h-11 cursor-pointer rounded-full bg-[#c21f16] px-5 font-bold text-white hover:bg-[#1f1a14]">
            {s.menu.escrever}
          </button>
        )}
        {dado.modero && Boolean(dado.pedidos) && <p className="mt-2 text-sm font-bold text-oxblood">{preencher(sc.pagina.pedidos, { n: dado.pedidos ?? 0 })}</p>}
      </header>
      <div role="tablist" aria-label={comunidade.nome} className="flex border-b border-rule">
        {tab("posts", s.comunidade.posts)}
        {tab("sobre", s.comunidade.sobre)}
      </div>
      {aba === "posts" ? (
        <div>
          {dado.fixados.length > 0 && (
            <section aria-label={sc.pagina.fixados} className="bg-parchment-deep">
              <h2 className="px-[18px] pt-3 font-sans text-xs font-bold uppercase tracking-wider text-ink-soft">{sc.pagina.fixados}</h2>
              {dado.fixados.map((p) => (
                <CartaoDePost key={p.id} post={p} lang={lang} s={s} logado={situacao.logado} aoResponder={aoResponder} />
              ))}
            </section>
          )}
          <Linha key={`${comunidade.slug}:${mudou}`} aba={`c:${comunidade.slug}`} lang={lang} s={s} logado={situacao.logado} aoResponder={aoResponder} />
        </div>
      ) : (
        <div className="space-y-5 px-[18px] py-4 font-sans">
          <section>
            <h2 className="font-serif text-lg font-semibold">{s.comunidade.regras}</h2>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              {comunidade.regras.map((r) => (
                <li key={r.numero}>
                  <strong>{r.titulo}</strong>
                  {r.texto && <span>: {r.texto}</span>}
                </li>
              ))}
            </ol>
          </section>
          {comunidade.etiquetas.length > 0 && (
            <section>
              <h2 className="font-serif text-lg font-semibold">{sc.pagina.etiquetas}</h2>
              <ul className="mt-1 flex flex-wrap gap-2">
                {comunidade.etiquetas.map((e) => (
                  <li key={e.nome} className="rounded border border-rule px-2 py-0.5 text-sm" style={e.cor ? { borderColor: e.cor } : undefined}>{e.nome}</li>
                ))}
              </ul>
            </section>
          )}
          {comunidade.moderacao.length > 0 && (
            <section>
              <h2 className="font-serif text-lg font-semibold">{sc.pagina.moderacao}</h2>
              <p>{comunidade.moderacao.join(", ")}</p>
            </section>
          )}
          <section>
            <h2 className="font-serif text-lg font-semibold">{sc.pagina.aulas}</h2>
            {comunidade.trilhas.length + comunidade.aulas.length === 0 ? (
              <p className="text-sm text-ink-soft">{sc.pagina.semAulas}</p>
            ) : (
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {comunidade.trilhas.map((t) => (
                  <li key={t}><Link href={`/${lang}/trilhas/${t}`} className="underline">{t.replace(/-/g, " ")}</Link></li>
                ))}
                {comunidade.aulas.map((a) => {
                  const [trilha, aula] = a.split("/");
                  return (
                    <li key={a}>
                      <Link href={enderecosCom.aula(lang, trilha, aula, comunidade.slug)} className="underline">{aula.replace(/-/g, " ")}</Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          {dado.modero && (
            <section aria-label={sc.pagina.cuidar} className="border-t border-rule pt-4">
              <h2 className="font-serif text-xl font-semibold">{sc.pagina.cuidar}</h2>
              <div className="mt-3">
                <Moderar comunidade={comunidade} s={s} sc={sc} aoMudar={recarregar} />
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

type PropsDaPagina = {
  slug: string;
  lang: string;
  s: TextosDaRede;
  sc: TextosDeComunidades;
  situacao: Situacao;
  aoEscrever: () => void;
  aoResponder: (p: Post) => void;
  aoCarregar: (c: Comunidade) => void;
};

/**
 * A página de uma comunidade. Com a Alumia nova ligada ("rede-v2" + "alumia-2", o layout põe [data-al="2"]) é a da prancha
 * celular-comunidade (PaginaDaComunidadeAlumia.tsx); desligada, a de hoje, sem mudar nada.
 */
export function PaginaDaComunidade(props: PropsDaPagina) {
  const nova = useAlumia2();
  return nova ? <PaginaDaComunidadeAlumia {...props} /> : <PaginaDaComunidadeDeHoje {...props} />;
}
