// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import Link from "@/components/Link";
import { localePath } from "@/i18n/config";
import { redePerfil } from "@/lib/rede/cliente-perfil";
import { preencher } from "@/lib/rede/preencher";
import { enderecoDeEditarPerfil, estudandoDaUltimaAula, nomeDaTrilha, origemDaImagem, slugDoSelo, tipoDoSelo } from "@/lib/rede/perfil";
import type { TextosDaRede } from "@/lib/rede/textos";
import { enderecos, type Post, type Situacao } from "@/lib/rede/tipos";
import type { PerfilDaRede } from "@/lib/rede/tipos-perfil";
import { CartaoDePost } from "../CartaoDePost";
import { textoDoErro } from "../erros";
import { EsqueletoDaLinha } from "../Esqueletos";
import { Linha } from "../Linha";
import { Avatar } from "./Avatar";
import { useTextosDoPerfil } from "./useTextos";

/** O que a pessoa liga em "estudando agora" é lido do aparelho (a última aula aberta); só se ela ligou, e só aqui, no próprio perfil. */
function lerUltimaAula(): unknown {
  try {
    const bruto = window.localStorage.getItem("lucia:ultima-aula");
    return bruto ? JSON.parse(bruto) : null;
  } catch {
    return null;
  }
}

/**
 * A página de um perfil (/comunidade/u/[handle]): capa, rosto, codinome, @nome, selos, bio, "estudando agora", post fixado e a
 * linha da pessoa. Seguir (ou pedir para seguir, no perfil trancado). Sem contagem de seguidores, de seguidos ou de apoios, e
 * nada do nome civil. No próprio perfil: editar, pedidos pendentes e a atualização do "estudando agora" se estiver ligado.
 */
export default function TelaDoPerfil({ handle, lang, s, situacao, aoResponder }: { handle: string; lang: string; s: TextosDaRede; situacao: Situacao; aoResponder: (p: Post) => void }) {
  const sp = useTextosDoPerfil(lang);
  const [estado, setEstado] = useState<{ handle: string; dado: PerfilDaRede | null; erro: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let vivo = true;
    redePerfil
      .perfil(handle)
      .then((dado) => vivo && setEstado({ handle, dado, erro: "" }))
      .catch((e) => vivo && setEstado({ handle, dado: null, erro: textoDoErro(s, e) }));
    return () => {
      vivo = false;
    };
  }, [handle, s]);

  const dado = estado?.handle === handle ? estado.dado : null;

  // "Estudando agora" ligado: a aula do aparelho entra no perfil (no máximo uma vez por abertura desta página).
  useEffect(() => {
    if (!dado?.meu) return;
    let vivo = true;
    redePerfil
      .meu()
      .then((meu) => {
        if (!vivo || !meu.estudando) return;
        const atual = estudandoDaUltimaAula(lerUltimaAula());
        if (atual && (atual.aula !== meu.estudando.aula || atual.titulo !== meu.estudando.titulo)) return redePerfil.editar({ estudando: { ligado: true, ...atual } });
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [dado?.meu]);

  if (!sp || !estado || estado.handle !== handle) return <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={3} />;
  if (!dado) {
    return (
      <div className="px-[18px] py-8 font-sans" role="alert">
        <p className="text-ink-soft">{estado.erro || s.estados.naoEncontrado}</p>
      </div>
    );
  }

  async function seguir(sim: boolean) {
    setOcupado(true);
    setErro("");
    try {
      const r = await redePerfil.seguir(dado!.handle, sim);
      setEstado((e) => (e && e.dado ? { ...e, dado: { ...e.dado, sigo: r.sigo, pendente: r.pendente } } : e));
    } catch (e) {
      setErro(textoDoErro(s, e));
    } finally {
      setOcupado(false);
    }
  }

  const capa = origemDaImagem(dado.capa, "capa");
  const botao = "min-h-11 cursor-pointer rounded-full px-5 font-sans font-bold disabled:cursor-not-allowed disabled:opacity-50";
  const selos = dado.selos.filter((x) => tipoDoSelo(x) !== null);
  const aula = dado.estudando?.aula;

  return (
    <div>
      <header className="border-b border-rule font-sans">
        {capa ? (
          // eslint-disable-next-line @next/next/no-img-element -- padrão SVG do projeto ou WebP já reencodado.
          <img src={capa} alt="" aria-hidden width={900} height={300} decoding="async" className="aspect-[3/1] w-full object-cover" />
        ) : (
          <div aria-hidden className="aspect-[6/1] w-full bg-parchment-deep" />
        )}
        <div className="px-[18px] pb-4">
          <div className="-mt-9 flex items-end justify-between gap-3">
            <Avatar imagem={dado.avatar} codinome={dado.codinome} tamanho={72} className="border-4 border-parchment" />
            <div className="flex flex-wrap justify-end gap-2 pb-1">
              {dado.meu ? (
                <Link href={enderecoDeEditarPerfil(lang)} className={`${botao} inline-flex items-center border-[1.5px] border-ink hover:bg-parchment-deep`}>
                  {sp.perfil.editar}
                </Link>
              ) : dado.pendente ? (
                <button type="button" disabled={ocupado} onClick={() => void seguir(false)} className={`${botao} border-[1.5px] border-ink hover:bg-parchment-deep`}>
                  {sp.perfil.pedidoEnviado}
                </button>
              ) : dado.sigo ? (
                <button type="button" disabled={ocupado} aria-pressed="true" onClick={() => void seguir(false)} className={`${botao} border-[1.5px] border-ink hover:bg-parchment-deep`}>
                  {sp.perfil.seguindo}
                </button>
              ) : (
                <button type="button" disabled={ocupado || !situacao.membro} onClick={() => void seguir(true)} className={`${botao} bg-[#c21f16] text-white hover:bg-[#1f1a14]`}>
                  {dado.modo === "trancado" ? sp.perfil.pedirParaSeguir : sp.perfil.seguir}
                </button>
              )}
              {/* Chat privado cifrado (docs/rede/CHAT-PRIVADO.md): só membro logado, nunca no próprio perfil. O servidor decide se abre,
                  vira pedido ou fica fechado (bloqueio, preferência da pessoa), sem revelar o motivo. */}
              {!dado.meu && situacao.logado && situacao.membro && (
                <Link href={`${enderecos.linha(lang)}/conversas?com=${encodeURIComponent(dado.handle)}`} className={`${botao} inline-flex items-center border-[1.5px] border-ink hover:bg-parchment-deep`}>
                  {s.perfil.conversar}
                </Link>
              )}
            </div>
          </div>

          <h1 className="mt-2 truncate font-serif text-2xl font-extrabold">{dado.codinome}</h1>
          <p className="text-sm text-ink-soft">@{dado.handle}</p>

          {(dado.equipe || selos.length > 0) && (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={sp.editar.selosTitulo}>
              {dado.equipe && !selos.includes("equipe") && (
                <li className="rounded bg-ink px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-parchment">{s.perfil.equipe}</li>
              )}
              {selos.map((selo) => {
                const tipo = tipoDoSelo(selo);
                const slug = slugDoSelo(selo);
                const texto = tipo === "trilha" && slug ? preencher(sp.perfil.selos.trilha, { nome: nomeDaTrilha(slug) }) : sp.perfil.selos[tipo as "equipe" | "educador" | "moderacao"];
                return (
                  <li key={selo} className={`rounded px-1.5 py-0.5 text-xs font-semibold ${tipo === "trilha" ? "border border-rule bg-folha" : "bg-ink uppercase tracking-wider text-parchment"}`}>
                    {slug ? <Link href={localePath(lang, `/trilhas/${slug}`)} className="hover:underline">{texto}</Link> : texto}
                  </li>
                );
              })}
            </ul>
          )}
          {selos.some((x) => slugDoSelo(x)) && <p className="mt-1 text-xs text-ink-soft">{sp.perfil.selosAjuda}</p>}

          {dado.bio && <p className="mt-2 whitespace-pre-line break-words">{dado.bio}</p>}

          {dado.estudando && (aula || dado.estudando.titulo) && (
            <p className="mt-2 rounded-lg border border-rule bg-folha px-3 py-2 text-sm">
              <span className="font-bold">{sp.perfil.estudandoAgora}: </span>
              {aula ? (
                <Link href={localePath(lang, aula)} className="underline">
                  {dado.estudando.titulo || sp.perfil.abrirAula}
                </Link>
              ) : (
                dado.estudando.titulo
              )}
            </p>
          )}

          {dado.modo === "trancado" && <p className="mt-2 text-sm text-ink-soft">{s.perfil.trancado}</p>}
          <p className="mt-2 text-xs text-ink-soft">{s.perfil.semContagens}</p>
          {dado.meu && dado.pedidos ? (
            <p className="mt-2 text-sm" role="status">
              <Link href={enderecoDeEditarPerfil(lang)} className="font-bold underline">
                {sp.editar.pedidosTitulo}: {dado.pedidos}
              </Link>
            </p>
          ) : null}
          {erro && <p role="alert" className="mt-2 text-sm text-oxblood">{erro}</p>}
        </div>
      </header>
      {dado.fixado && (
        <section aria-label={sp.perfil.fixado}>
          <p className="border-b border-rule bg-parchment-deep px-[18px] py-1 font-sans text-xs font-bold uppercase tracking-wider text-ink-soft">{sp.perfil.fixado}</p>
          <CartaoDePost post={dado.fixado} lang={lang} s={s} logado={situacao.logado} aoResponder={aoResponder} />
        </section>
      )}
      <Linha aba={`u:${dado.handle}`} lang={lang} s={s} logado={situacao.logado} aoResponder={aoResponder} />
    </div>
  );
}
