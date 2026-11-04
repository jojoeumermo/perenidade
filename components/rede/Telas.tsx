// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { rede } from "@/lib/rede/cliente";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { Comunidade, Post, Situacao } from "@/lib/rede/tipos";
import { PaginaDaComunidade } from "./comunidades/PaginaDaComunidade";
import { textosDe } from "./comunidades/util";
import { textoDoErro } from "./erros";
import { EsqueletoDaLinha } from "./Esqueletos";
import { Linha } from "./Linha";

/** Carrega uma coisa do banco com os três estados da tela: esperando (esqueleto), erro (com texto e botão) e pronto. */
function useCarregado<T>(buscar: () => Promise<T>, s: TextosDaRede, chave: string) {
  // O resultado leva a chave do pedido: trocar de post, comunidade ou perfil volta a "esperando" sem mexer no estado dentro do efeito.
  const [estado, setEstado] = useState<{ chave: string; dado: T | null; erro: string } | null>(null);
  useEffect(() => {
    let vivo = true;
    buscar()
      .then((dado) => vivo && setEstado({ chave, dado, erro: "" }))
      .catch((e) => vivo && setEstado({ chave, dado: null, erro: textoDoErro(s, e) }));
    return () => {
      vivo = false;
    };
    // buscar muda a cada render; a chave é o que identifica o pedido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, s]);
  const pronto = estado?.chave === chave;
  return { dado: pronto ? estado.dado : null, erro: pronto ? estado.erro : "", pronto };
}

function Falha({ texto, s }: { texto: string; s: TextosDaRede }) {
  return (
    <div className="px-[18px] py-8 font-sans" role="alert">
      <p className="text-ink-soft">{texto || s.estados.naoEncontrado}</p>
    </div>
  );
}

/** A página simples de uma comunidade: cabeçalho, abas Posts e Sobre (regras, moderação por codinome). */
function TelaDaComunidadeBase({
  slug,
  lang,
  s,
  situacao,
  aoEscrever,
  aoResponder,
  aoCarregar,
}: {
  slug: string;
  lang: string;
  s: TextosDaRede;
  situacao: Situacao;
  aoEscrever: () => void;
  aoResponder: (p: Post) => void;
  aoCarregar: (c: Comunidade) => void;
}) {
  const { dado, erro, pronto } = useCarregado<Comunidade>(() => rede.comunidade(slug), s, `comunidade:${slug}`);
  const [aba, setAba] = useState<"posts" | "sobre">("posts");
  useEffect(() => {
    if (dado) aoCarregar(dado);
  }, [dado, aoCarregar]);
  if (!pronto) return <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={3} />;
  if (!dado) return <Falha texto={erro} s={s} />;
  const tipo = dado.tipo === "aberta" ? s.comunidade.tipoAberta : dado.tipo === "restrita" ? s.comunidade.tipoRestrita : s.comunidade.tipoFechada;
  const tab = (chave: "posts" | "sobre", texto: string) => (
    <button type="button" role="tab" aria-selected={aba === chave} onClick={() => setAba(chave)} className={`min-h-11 flex-1 cursor-pointer px-3 font-sans font-bold ${aba === chave ? "border-b-[3px] border-[#c21f16]" : "text-ink-soft hover:bg-parchment-deep"}`}>
      {texto}
    </button>
  );
  return (
    <div>
      <header className="border-b border-rule px-[18px] py-4 font-sans">
        <h1 className="font-serif text-2xl font-extrabold">{dado.nome}</h1>
        <p className="mt-1 text-sm text-ink-soft">{tipo}</p>
        {dado.descricao && <p className="mt-2">{dado.descricao}</p>}
        {dado.banido && <p className="mt-2 text-oxblood" role="status">{s.comunidade.banido}</p>}
        {situacao.membro && !dado.banido && (
          <button type="button" onClick={() => aoEscrever()} className="mt-3 min-h-11 cursor-pointer rounded-full bg-[#c21f16] px-5 font-bold text-white hover:bg-[#1f1a14]">
            {s.menu.escrever}
          </button>
        )}
      </header>
      <div role="tablist" aria-label={dado.nome} className="flex border-b border-rule">
        {tab("posts", s.comunidade.posts)}
        {tab("sobre", s.comunidade.sobre)}
      </div>
      {aba === "posts" ? (
        <Linha key={dado.slug} aba={`c:${dado.slug}`} lang={lang} s={s} logado={situacao.logado} aoResponder={aoResponder} />
      ) : (
        <div className="space-y-4 px-[18px] py-4 font-sans">
          <section>
            <h2 className="font-serif text-lg font-semibold">{s.comunidade.regras}</h2>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              {dado.regras.map((r) => (
                <li key={r.numero}>
                  <strong>{r.titulo}</strong>
                  {r.texto && <span>: {r.texto}</span>}
                </li>
              ))}
            </ol>
          </section>
          {dado.moderacao.length > 0 && (
            <section>
              <h2 className="font-serif text-lg font-semibold">{s.comunidade.moderacao}</h2>
              <p>{dado.moderacao.join(", ")}</p>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * A página de um perfil (pacote perfil, components/rede/perfil/TelaDoPerfil.tsx): capa, rosto, @nome, selos, bio, "estudando agora",
 * post fixado e a linha. Carrega sob demanda; o esqueleto ocupa o lugar até chegar. Sem contagem pública de seguidores ou de apoios.
 */
const PerfilDoPacote = dynamic(() => import("./perfil/TelaDoPerfil"), { ssr: false, loading: () => <EsqueletoDaLinha rotulo="…" quantos={3} /> });
export function TelaDoPerfil(props: { handle: string; lang: string; s: TextosDaRede; situacao: Situacao; aoResponder: (p: Post) => void }) {
  return <PerfilDoPacote {...props} />;
}

/**
 * A página de uma comunidade. Com os textos do pacote comunidades (rota com `comTextos`, lib/rede/textos-comunidades.ts) ganha entrar e
 * sair, fixados, etiquetas, aulas ligadas e as ferramentas da moderação; sem eles, a página simples.
 */
export function TelaDaComunidade(props: Parameters<typeof TelaDaComunidadeBase>[0]) {
  const sc = textosDe(props.s);
  return sc ? <PaginaDaComunidade {...props} sc={sc} /> : <TelaDaComunidadeBase {...props} />;
}
