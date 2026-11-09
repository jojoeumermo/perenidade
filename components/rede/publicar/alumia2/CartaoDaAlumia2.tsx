// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import Link from "@/components/Link";
import { localePath } from "@/i18n/config";
import { rede } from "@/lib/rede/cliente";
import { redePub } from "@/lib/rede/cliente-publicar";
import { preencher } from "@/lib/rede/preencher";
import { enderecoParaCompartilhar, servidorDoFediverso, tempoCurto } from "@/lib/rede/publicar/alumia2";
import { enqueteDeExemplo } from "@/lib/rede/publicar/exemplos-alumia2";
import type { TextosDaRede } from "@/lib/rede/textos";
import { enderecos, type Post } from "@/lib/rede/tipos";
import { TextoComMencoes } from "../../conversa/TextoComMencoes";
import { TextoComTags } from "../../descoberta/TextoComTags";
import { ENCAIXES } from "../../encaixes";
import { codigoDoErro, textoDoErro } from "../../erros";
import { AcoesDeCuidado, RotuloDoPost } from "../../moderacao/NoCartao";
import { Avatar16 } from "../../ui/Avatar16";
import { Pilula } from "../../ui/Pilula";
import { Selo } from "../../ui/Selo";
import { Complementos } from "../Complementos";
import { useAlumia2 } from "./contexto";
import { Icone } from "./icones";
import { AnexoDoChamadoDuble } from "./previa/Dubles";

/** A chamada caiu porque o banco ainda não tem a função nova (a etapa de back-end da F1 cria)? */
export function faltaNoBanco(e: unknown): boolean {
  const c = codigoDoErro(e);
  return c.includes("desatualizado") || c === "PGRST202" || c === "42883";
}

/**
 * O Repostar depende de rede_pub_repostar, que só chega com a migração 20261109-alumia-f1. Na primeira vez que o banco diz que
 * ela não existe, o botão fica desativado em todos os cartões desta página (com o porquê no title), em vez de dar erro a cada toque.
 */
let repostarForaDoBanco = false;

/** Post de exemplo da prévia (ids "exemplo-…"): as ações mudam só na tela, nada vai ao banco. */
const deExemplo = (id: string) => id.startsWith("exemplo-");

/**
 * O cartão de post da cara nova (pranchas computador-inicio e celular-inicio): rosto de 16 cartões, codinome, selo de
 * organização verificada, @nome ou o servidor do Fediverso, a comunidade em pílula, o texto, os anexos (imagens, áudio, enquete
 * com barras, aula citada, chamado pelo encaixe da F2) e as ações Responder, Repostar, Acender, Salvar e Compartilhar. Contagens:
 * respostas (o que a pessoa pode ver) e, do Acender, só o autor vê o total, como hoje (ESPEC decisão 3). Nunca lista de quem.
 */
export function CartaoDaAlumia2({
  post: inicial,
  lang,
  s,
  logado,
  completo = false,
  aoResponder,
  extras,
}: {
  post: Post;
  lang: string;
  s: TextosDaRede;
  logado: boolean;
  completo?: boolean;
  aoResponder?: (post: Post) => void;
  extras?: React.ReactNode;
}) {
  const al2 = useAlumia2();
  const [post, setPost] = useState(inicial);
  const [repostei, setRepostei] = useState(false);
  const [semRepostar, setSemRepostar] = useState(repostarForaDoBanco);
  const [erro, setErro] = useState("");
  const [nota, setNota] = useState("");
  const [ocupado, setOcupado] = useState(false);
  if (!al2) return null;
  const { t, previa, comunidades } = al2;
  const exemplo = previa && deExemplo(post.id);
  const ctx = { lang, s, situacao: { logado, membro: logado, regras_versao: 1 } };

  const servidor = servidorDoFediverso(post.autor.handle);
  const handle = post.autor.handle ?? post.autor.codinome;
  const com = post.comunidade ? comunidades[post.comunidade] : undefined;
  const comTitulo = post.tipo === "discussao" || post.tipo === "duvida";
  const longoTexto = completo && post.corpo ? post.corpo : post.texto;
  const aviso = post.aviso.trim();
  const caminhoDoPost = enderecos.post(lang, post.id);
  const perfilHref = post.autor.handle && post.autor.perfil && !servidor ? enderecos.perfil(lang, post.autor.handle) : null;

  async function acao(fazer: () => Promise<void>) {
    if (ocupado) return;
    setOcupado(true);
    setErro("");
    setNota("");
    try {
      await fazer();
    } catch (e) {
      setErro(faltaNoBanco(e) ? t.cartao.indisponivel : textoDoErro(s, e));
    } finally {
      setOcupado(false);
    }
  }

  const acender = () =>
    acao(async () => {
      const quer = !post.apoiei;
      if (exemplo) return setPost((p) => ({ ...p, apoiei: quer }));
      const r = await rede.reagir(post.id, "apoio", quer);
      // O total de "Acender" só volta para quem escreveu; para os outros, só o próprio estado.
      setPost((p) => ({ ...p, apoiei: r.apoiei, apoios: p.apoios === null ? null : Math.max(0, p.apoios + (quer ? 1 : -1)) }));
    });
  const util = () =>
    acao(async () => {
      const quer = !post.util_eu;
      if (exemplo) return setPost((p) => ({ ...p, util_eu: quer }));
      const r = await rede.reagir(post.id, "util", quer);
      setPost((p) => ({ ...p, util_eu: r.util_eu, util: r.util }));
    });
  const salvar = () =>
    acao(async () => {
      const quer = !post.salvei;
      if (exemplo) return setPost((p) => ({ ...p, salvei: quer }));
      const r = await rede.salvar(post.id, quer);
      setPost((p) => ({ ...p, salvei: r.salvei }));
    });
  const repostar = () =>
    acao(async () => {
      const quer = !repostei;
      if (exemplo) return setRepostei(quer);
      try {
        const r = await redePub.repostar(post.id, quer);
        setRepostei(r.repostei);
      } catch (e) {
        if (faltaNoBanco(e)) {
          repostarForaDoBanco = true;
          setSemRepostar(true);
        }
        throw e;
      }
    });
  const compartilhar = () =>
    acao(async () => {
      const url = enderecoParaCompartilhar(window.location.origin, caminhoDoPost);
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({ url });
          return;
        } catch {
          // a pessoa fechou a janela de compartilhar, ou o aparelho recusou: cai na cópia do link
        }
      }
      await navigator.clipboard.writeText(url);
      setNota(t.cartao.copiado);
    });

  const nome = <span className="font-extrabold text-[var(--al-texto)]">{post.autor.codinome}</span>;

  return (
    <article
      className="al2-cartao flex gap-3 px-4 py-5 md:px-5"
      aria-label={post.titulo ?? post.texto.slice(0, 60)}
      data-tipo={post.tipo}
    >
      {perfilHref ? (
        <Link href={perfilHref} className="shrink-0 self-start" tabIndex={-1} aria-hidden>
          <Avatar16 handle={handle} cor={com?.cor} tamanho={40} />
        </Link>
      ) : (
        <Avatar16 handle={handle} cor={com?.cor} tamanho={40} className="shrink-0" />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[0.8125rem] text-[var(--al-texto-3)]">
          {perfilHref ? (
            <Link href={perfilHref} className="text-[0.9375rem] hover:underline">
              {nome}
            </Link>
          ) : (
            <span className="text-[0.9375rem]">{nome}</span>
          )}
          {post.org?.verificada_em && <Selo texto={t.cartao.orgVerificada} regra={t.cartao.regraDoSelo} />}
          {post.autor.equipe && <span className="rounded bg-[var(--al-texto)] px-1 text-[0.6rem] font-bold uppercase tracking-wider text-[var(--al-fundo)]">{s.perfil.equipe}</span>}
          {post.autor.handle && <span className={servidor ? "hidden md:inline" : ""}>@{post.autor.handle}</span>}
          {servidor && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--al-superficie-2)] px-1.5 py-0.5 text-[0.6875rem] font-semibold text-[var(--al-texto-2)]">
              <Icone nome="fediverso" className="h-3.5 w-3.5" />
              <span className="md:hidden">{servidor}</span>
              <span className="hidden md:inline">{preencher(t.cartao.doFediverso, { servidor })}</span>
            </span>
          )}
          <span aria-hidden>·</span>
          <Link href={caminhoDoPost} className="whitespace-nowrap hover:underline">
            <time dateTime={post.criado_em}>{tempoCurto(post.criado_em, lang)}</time>
          </Link>
          {post.editado_em && <span>({s.post.editado})</span>}
        </div>

        {(post.comunidade || post.tipo !== "post" || post.flair) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {post.comunidade && <Pilula texto={com?.nome ?? post.comunidade} cor={com?.cor} slug={post.comunidade} href={enderecos.comunidade(lang, post.comunidade)} />}
            {post.tipo !== "post" && post.tipo !== "enquete" && <span className="rounded-full border border-[var(--al-superficie-2)] px-2 text-xs font-bold">{(s.tipos as Record<string, string>)[post.tipo]}</span>}
            {post.flair && <span className="rounded border border-[var(--al-superficie-2)] px-1 text-xs">{post.flair}</span>}
            {post.aceita && <span className="rounded bg-[var(--al-superficie-2)] px-1.5 text-xs">{s.post.resolvida}</span>}
          </div>
        )}

        {post.retido && (
          <p className="mt-2 rounded-md border border-dashed border-[var(--al-texto-3)] px-2 py-1 text-sm" role="status">
            {s.post.retido}
          </p>
        )}

        {comTitulo && post.titulo && (
          <h3 className="mt-2 text-lg font-extrabold leading-snug">
            {completo ? post.titulo : <Link href={caminhoDoPost} className="hover:underline">{post.titulo}</Link>}
          </h3>
        )}

        {aviso ? (
          <details className="mt-2">
            <summary className="cursor-pointer text-sm font-bold">
              {s.post.avisoConteudo}: {aviso}
            </summary>
            <p className="mt-1 whitespace-pre-line break-words text-[0.9375rem] leading-relaxed text-[var(--al-texto-2)]"><TextoComTags texto={longoTexto} lang={lang} Resto={TextoComMencoes} /></p>
          </details>
        ) : (
          <p className="mt-2 whitespace-pre-line break-words text-[0.9375rem] leading-relaxed text-[var(--al-texto-2)]"><TextoComTags texto={longoTexto} lang={lang} Resto={TextoComMencoes} /></p>
        )}
        {!completo && post.longo && (
          <Link href={caminhoDoPost} className="mt-1 inline-block text-sm underline">
            {s.post.verMais}
          </Link>
        )}

        {/* O chamado embutido ("16 NOV · Panfletagem no RU · Eu vou") é da F2, pelo encaixe; na prévia, sem a F2, um dublê. */}
        {ENCAIXES.anexosDoCartao.map((Anexo, i) => (
          <Anexo key={i} {...ctx} post={post} />
        ))}
        {previa && ENCAIXES.anexosDoCartao.length === 0 && post.chamado && <AnexoDoChamadoDuble post={post} lang={lang} t={t} />}

        {post.cita && (
          <Link href={localePath(lang, post.cita.caminho)} className="mt-3 flex items-center gap-3 rounded-xl border border-[color-mix(in_srgb,var(--al-com-4)_45%,transparent)] bg-[color-mix(in_srgb,var(--al-com-4)_14%,var(--al-superficie))] p-3 hover:border-[var(--al-com-4)]">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[var(--al-com-4)] text-[var(--al-fundo)]">
              <Icone nome="livro" className="h-6 w-6" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-bold text-[var(--al-com-4)]">{post.cita.tipo === "aula" ? t.cartao.aula : post.cita.tipo === "obra" ? t.cartao.obra : t.cartao.materia}</span>
              <span className="block font-extrabold text-[var(--al-texto)]">{post.cita.titulo || post.cita.caminho}</span>
            </span>
          </Link>
        )}
        {post.citado &&
          ("restrito" in post.citado ? (
            <p className="mt-3 rounded-xl border border-dashed border-[var(--al-superficie-2)] px-3 py-2 text-sm text-[var(--al-texto-3)]">{s.post.restrito}</p>
          ) : (
            <Link href={enderecos.post(lang, post.citado.id)} className="mt-3 block rounded-xl border border-[var(--al-superficie-2)] px-3 py-2 text-sm hover:border-[var(--al-texto-3)]">
              <span className="font-bold">{post.citado.codinome}</span>: {post.citado.trecho}
            </Link>
          ))}

        {/* Imagens, áudio, enquete com barras, prévia de link, fio, editar e histórico (pacote publicar). */}
        <Complementos post={post} lang={lang} s={s} logado={logado} completo={completo} aoAtualizar={setPost} detalhesIniciais={exemplo && post.tipo === "enquete" ? { enquete: enqueteDeExemplo(), responde_quem: "todos", fio: false, editado: false, historico: false } : undefined} />

        {!exemplo && <RotuloDoPost post={post} lang={lang} />}

        <div className="-ml-1.5 mt-2 flex flex-wrap items-center gap-x-0.5 sm:gap-x-2">
          {logado && !post.travado && aoResponder ? (
            <button type="button" className="al2-acao" onClick={() => aoResponder(post)} aria-label={`${t.cartao.responder} · ${preencher(t.cartao.respostas, { n: post.respostas })}`}>
              <Icone nome="responder" className="h-[18px] w-[18px]" />
              <span aria-hidden>{post.respostas}</span>
            </button>
          ) : (
            <Link href={caminhoDoPost} className="al2-acao" aria-label={preencher(t.cartao.respostas, { n: post.respostas })}>
              <Icone nome="responder" className="h-[18px] w-[18px]" />
              <span aria-hidden>{post.respostas}</span>
            </Link>
          )}
          {logado && (
            <button type="button" className="al2-acao" aria-pressed={repostei} disabled={ocupado || (semRepostar && !exemplo)} title={semRepostar && !exemplo ? t.cartao.indisponivel : undefined} onClick={() => void repostar()}>
              <Icone nome="repostar" className="h-[18px] w-[18px]" />
              <span className="max-[420px]:sr-only">{repostei ? t.cartao.repostado : t.cartao.repostar}</span>
            </button>
          )}
          {logado && !post.meu && (
            <button type="button" className="al2-acao al2-acao-acender" aria-pressed={post.apoiei} disabled={ocupado} onClick={() => void acender()}>
              <Icone nome="acender" className="h-[18px] w-[18px]" />
              <span className="max-[420px]:sr-only">{post.apoiei ? t.cartao.aceso : t.cartao.acender}</span>
            </button>
          )}
          {/* O total do Acender só chega para quem escreveu (decisão 3 da ESPEC). */}
          {post.meu && post.apoios !== null && (
            <span className="al2-acao cursor-default">
              <Icone nome="acender" className="h-[18px] w-[18px]" />
              {preencher(t.cartao.acesoSoVoce, { n: post.apoios })}
            </span>
          )}
          {logado && !post.meu && comTitulo && (
            <button type="button" className="al2-acao" aria-pressed={post.util_eu} disabled={ocupado} onClick={() => void util()}>
              <Icone nome="util" className="h-[18px] w-[18px]" />
              {t.cartao.util}
              {post.util > 0 && <span>{post.util}</span>}
            </button>
          )}
          {logado && (
            <button type="button" className="al2-acao" aria-pressed={post.salvei} aria-label={post.salvei ? t.cartao.salvo : t.cartao.salvar} title={post.salvei ? t.cartao.salvo : t.cartao.salvar} disabled={ocupado} onClick={() => void salvar()}>
              <Icone nome="salvos" className="h-[18px] w-[18px]" />
            </button>
          )}
          <button type="button" className="al2-acao" aria-label={t.cartao.compartilhar} title={t.cartao.compartilhar} onClick={() => void compartilhar()}>
            <Icone nome="compartilhar" className="h-[18px] w-[18px]" />
          </button>
          {/* Denunciar, silenciar, moderar e o que as frentes encaixam ficam num menu, para a linha de ações ser a da prancha. */}
          <details className="relative">
            <summary className="al2-acao list-none [&::-webkit-details-marker]:hidden" aria-label={t.cartao.mais} title={t.cartao.mais}>
              <Icone nome="pontos" className="h-[18px] w-[18px]" />
            </summary>
            <div className="absolute right-0 z-20 mt-1 flex min-w-56 flex-col items-stretch rounded-xl border border-[var(--al-superficie-2)] bg-[var(--al-superficie)] p-1 text-sm shadow-xl">
              <Link href={caminhoDoPost} className="al2-acao justify-start">
                <Icone nome="responder" className="h-[18px] w-[18px]" />
                {preencher(t.cartao.respostas, { n: post.respostas })}
              </Link>
              {!exemplo && <AcoesDeCuidado post={post} lang={lang} s={s} logado={logado} classe="al2-acao justify-start" />}
              {ENCAIXES.acoesDoCartao.map((Acao, i) => (
                <Acao key={i} {...ctx} post={post} />
              ))}
              {extras}
            </div>
          </details>
        </div>
        {post.travado && <p className="mt-1 text-xs text-[var(--al-texto-3)]">{s.post.travado}</p>}
        <div aria-live="polite">
          {nota && <p role="status" className="mt-1 text-sm text-[var(--al-texto-2)]">{nota}</p>}
          {erro && (
            <p role="alert" className="mt-1 text-sm text-oxblood">
              {erro}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
