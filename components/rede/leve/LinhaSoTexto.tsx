// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Início só em texto (/alumia/leve): a mesma linha de sempre (rede_linha, com as mesmas regras de quem vê o quê), sem foto, sem
// vídeo e sem enfeite. Cada imagem é um botão: só depois do toque o endereço é pedido e a imagem baixa. O texto do post entra como
// texto (nunca como HTML).
import { useCallback, useEffect, useState } from "react";
import Link from "@/components/Link";
import { rede } from "@/lib/rede/cliente";
import { preencher } from "@/lib/rede/preencher";
import { nomeDoSlug, previaLigada, tempoCurto } from "@/lib/rede/publicar/alumia2";
import { imagemDeExemplo, sementeDoExemplo } from "@/lib/rede/publicar/exemplos-compositor";
import type { TextosDaRede } from "@/lib/rede/textos";
import { enderecos, type Aba, type MidiaDoPost, type Post, type Situacao } from "@/lib/rede/tipos";
import { enderecoDaMidia } from "../publicar/api";
import { Botao } from "../ui/Botao";
import { semRede } from "./aparelho";
import type { TextosDoLeve } from "./textos";

const ABAS: Aba[] = ["seguindo", "comunidades", "geral"];

/** Na prévia (sem banco), os posts das pranchas; o segundo ganha uma foto de exemplo, desenhada no código, para mostrar o botão. */
async function postsDaPrevia(): Promise<Post[]> {
  const { postsDeExemplo } = await import("@/lib/rede/publicar/exemplos-alumia2");
  return postsDeExemplo().map((p, i) =>
    i === 1 ? { ...p, midia: [{ id: "exemplo-leve-plenaria", alt: "Plenária lotada, com faixas penduradas na grade", largura: 1200, altura: 800, blurhash: null }] } : p,
  );
}

function ImagemAoToque({ m, n, total, t }: { m: MidiaDoPost; n: number; total: number; t: TextosDoLeve["linha"] }) {
  // "guardada" até o toque; depois, o endereço da imagem (ou "carregando"/"falhou").
  const [estado, setEstado] = useState<string>("guardada");
  const rotulo = total > 1 ? preencher(t.imagens, { n: n + 1, total }) : t.imagem;
  async function abrir() {
    const semente = sementeDoExemplo(m.id);
    if (semente !== null) return setEstado(imagemDeExemplo(semente, m.largura ?? 800, m.altura ?? 600));
    setEstado("carregando");
    try {
      setEstado(await enderecoDaMidia(m.id));
    } catch {
      setEstado("falhou");
    }
  }
  if (estado === "guardada" || estado === "carregando" || estado === "falhou")
    return (
      <button type="button" className="lv-ver-imagem" onClick={() => void abrir()} disabled={estado === "carregando"}>
        {rotulo}
        {m.alt ? <span className="sr-only">: {m.alt}</span> : null}
      </button>
    );
  return (
    <figure className="lv-imagem" data-lv-ver="">
      {/* Endereço assinado do depósito privado, pedido só agora: o next/image não otimiza esse endereço. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="lv-img" src={estado} alt={m.alt || t.semDescricao} width={m.largura ?? undefined} height={m.altura ?? undefined} decoding="async" />
      {m.alt ? <figcaption>{m.alt}</figcaption> : null}
    </figure>
  );
}

function PostEmTexto({ post, lang, t }: { post: Post; lang: string; t: TextosDoLeve["linha"] }) {
  const [abrirAviso, setAbrirAviso] = useState(false);
  const comAviso = Boolean(post.aviso?.trim());
  const midia = post.midia ?? [];
  return (
    <li className="lv-post">
      <p className="lv-post-cabeca">
        <span className="lv-post-autor">{post.autor.codinome}</span>
        {post.autor.handle ? <span>@{post.autor.handle}</span> : null}
        {post.comunidade ? <span>{preencher(t.naComunidade, { comunidade: nomeDoSlug(post.comunidade) })}</span> : null}
        <time dateTime={post.criado_em}>{tempoCurto(post.criado_em, lang)}</time>
      </p>
      {comAviso && (
        <p className="lv-aviso-conteudo">
          {preencher(t.aviso, { aviso: post.aviso })}{" "}
          <button type="button" className="lv-link" aria-expanded={abrirAviso} onClick={() => setAbrirAviso((x) => !x)}>
            {abrirAviso ? t.esconder : t.mostrar}
          </button>
        </p>
      )}
      {(!comAviso || abrirAviso) && (
        <>
          {post.titulo ? <h3 className="lv-post-titulo">{post.titulo}</h3> : null}
          {post.chamado ? <p className="lv-post-cabeca">{t.ato}: {post.chamado.tipo}</p> : null}
          {post.texto ? <p className="lv-post-texto">{post.texto}</p> : null}
          {midia.length > 0 && (
            <div className="lv-imagens">
              {midia.map((m, i) => (
                <ImagemAoToque key={m.id} m={m} n={i} total={midia.length} t={t} />
              ))}
            </div>
          )}
        </>
      )}
      <p className="lv-post-pe">
        <Link href={enderecos.post(lang, post.id)} className="lv-link">
          {t.abrir}
        </Link>
      </p>
    </li>
  );
}

export function LinhaSoTexto({ lang, s, situacao, t }: { lang: string; s: TextosDaRede; situacao: Situacao; t: TextosDoLeve["linha"] }) {
  const [aba, setAba] = useState<Aba>("seguindo");
  const [itens, setItens] = useState<Post[] | null>(null);
  const [proximo, setProximo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const previa = previaLigada();

  const carregar = useCallback(
    async (qual: Aba, cursor: string | null) => {
      setOcupado(true);
      setErro(null);
      try {
        if (previa) {
          setItens(await postsDaPrevia());
          setProximo(null);
          return;
        }
        const pagina = await rede.linha(qual, cursor, 20);
        setItens((antes) => (cursor && antes ? [...antes, ...pagina.itens] : pagina.itens));
        setProximo(pagina.proximo);
      } catch {
        setErro(semRede() ? t.semRede : t.erro);
        if (!cursor) setItens([]);
      } finally {
        setOcupado(false);
      }
    },
    [previa, t],
  );

  useEffect(() => {
    if (!situacao.logado) return;
    const id = window.setTimeout(() => void carregar(aba, null), 0);
    return () => window.clearTimeout(id);
  }, [aba, carregar, situacao.logado]);

  if (!situacao.logado) return <p className="lv-vazio">{t.visitante}</p>;
  return (
    <>
      <div className="lv-abas" role="group" aria-label={s.abas.rotulo}>
        {ABAS.map((a) => (
          <button key={a} type="button" className="lv-aba" aria-pressed={aba === a} onClick={() => aba !== a && (setItens(null), setAba(a))}>
            {s.abas[a as "seguindo" | "comunidades" | "geral"]}
          </button>
        ))}
      </div>
      {itens === null ? (
        <p className="lv-vazio" role="status">{t.carregando}</p>
      ) : itens.length === 0 && !erro ? (
        <p className="lv-vazio">{t.vazio}</p>
      ) : (
        <ul className="lv-posts">
          {itens.map((p) => (
            <PostEmTexto key={p.id} post={p} lang={lang} t={t} />
          ))}
        </ul>
      )}
      {erro && (
        <p className="lv-recado" role="alert">
          {erro}{" "}
          <button type="button" className="lv-link" onClick={() => void carregar(aba, null)}>
            {t.tentar}
          </button>
        </p>
      )}
      {proximo && !erro && (
        <p className="mt-3">
          <Botao variante="contorno" tamanho="p" disabled={ocupado} onClick={() => void carregar(aba, proximo)}>
            {t.mais}
          </Botao>
        </p>
      )}
    </>
  );
}
