// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState, type MouseEvent as EventoDeMouse, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/Link";
import { localePath } from "@/i18n/config";
import { rede } from "@/lib/rede/cliente";
import { redePub } from "@/lib/rede/cliente-publicar";
import { preencher } from "@/lib/rede/preencher";
import { enderecoParaCompartilhar, podeRepostar, servidorDoFediverso, tempoCurto } from "@/lib/rede/publicar/alumia2";
import { jaRepostei } from "@/lib/rede/publicar/repostados";
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
import { detalhesQueFecham } from "./fechar";
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

/** Post de exemplo da prévia (ids "exemplo-…"): as ações mudam só na tela, nada vai ao banco. Na prévia, todo post é de exemplo. */
const deExemplo = (id: string) => id.startsWith("exemplo-");

/**
 * O cartão de post da cara nova (pranchas computador-inicio e celular-inicio): rosto de 16 cartões, codinome, selo de
 * organização verificada, @nome ou o servidor do Fediverso, a comunidade em pílula, o texto, os anexos (imagens, áudio, enquete
 * com barras, aula citada, chamado pelo encaixe da F2) e as ações Responder, Repostar, Acender, Salvar e Compartilhar. Contagens:
 * respostas (o que a pessoa pode ver) e, do Acender, só o autor vê o total, como hoje (ESPEC decisão 3). Nunca lista de quem.
 *
 * É o MESMO cartão em todas as telas (Início, comunidade, #tema, busca, Salvos e o post aberto da conversa): as mesmas ações e o
 * mesmo selo de verificação; só a densidade muda ("lista" no Início, "compacta" nas listas das comunidades, "aberta" no alto da
 * conversa, com o texto maior e citável). Nas listas, tocar no cartão abre a conversa (no teclado, o link da hora faz isso).
 */
export type DensidadeDoCartao = "lista" | "compacta" | "aberta";

export function CartaoDaAlumia2({
  post: inicial,
  lang,
  s,
  logado,
  completo = false,
  aoResponder,
  extras,
  densidade = "lista",
  semComunidade = false,
  aoSalvar,
  antesDasAcoes,
}: {
  /** `repostado_em`: o post chegou à aba Seguindo por um repost de quem a pessoa segue (sem dizer quem). */
  post: Post & { repostado_em?: string };
  lang: string;
  s: TextosDaRede;
  logado: boolean;
  completo?: boolean;
  aoResponder?: (post: Post) => void;
  extras?: React.ReactNode;
  densidade?: DensidadeDoCartao;
  /** Na página da própria comunidade a pílula com o nome dela sobra. */
  semComunidade?: boolean;
  /** Avisa a lista quando o post entra ou sai dos salvos (Salvos tira o cartão da lista). */
  aoSalvar?: (salvo: boolean) => void;
  /** O que vem logo antes da linha de ações (as reações com emoji do post aberto da conversa). */
  antesDasAcoes?: ReactNode;
}) {
  const router = useRouter();
  const al2 = useAlumia2();
  const [post, setPost] = useState(inicial);
  const [repostei, setRepostei] = useState(false);
  const [semRepostar, setSemRepostar] = useState(repostarForaDoBanco);
  const [erro, setErro] = useState("");
  const [nota, setNota] = useState("");
  const [ocupado, setOcupado] = useState(false);
  // A ação que a pessoa acabou de tocar: só ela anima (o que já vinha aceso, salvo ou repostado aparece parado).
  const [tocou, setTocou] = useState<"repostar" | "acender" | "salvar" | null>(null);
  const repostavel = podeRepostar(post);
  // O estado do Repostar vem do banco (um pedido por página, rede_pub_repostados): só o da própria pessoa.
  const buscarRepost = logado && repostavel && !deExemplo(post.id) && !al2?.previa && !repostarForaDoBanco;
  useEffect(() => {
    if (!buscarRepost) return;
    let vivo = true;
    jaRepostei(post.id).then(
      (sim) => vivo && setRepostei(sim),
      (e) => {
        if (vivo && faltaNoBanco(e)) {
          repostarForaDoBanco = true;
          setSemRepostar(true);
        }
      },
    );
    return () => {
      vivo = false;
    };
  }, [buscarRepost, post.id]);
  if (!al2) return null;
  const { t, previa, comunidades } = al2;
  const exemplo = previa;
  const aberta = densidade === "aberta";
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
      if (exemplo) {
        setPost((p) => ({ ...p, salvei: quer }));
        aoSalvar?.(quer);
        return;
      }
      const r = await rede.salvar(post.id, quer);
      setPost((p) => ({ ...p, salvei: r.salvei }));
      aoSalvar?.(r.salvei);
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
  const tamanhoDoTexto = aberta ? "text-[1.2rem] text-[var(--al-texto)]" : densidade === "compacta" ? "text-[0.9375rem] text-[var(--al-texto)]" : "text-[0.9375rem] text-[var(--al-texto-2)]";
  const avatar = perfilHref ? (
    <Link href={perfilHref} className="shrink-0 self-start" tabIndex={-1} aria-hidden>
      <Avatar16 handle={handle} cor={com?.cor} tamanho={aberta ? 48 : 40} />
    </Link>
  ) : (
    <Avatar16 handle={handle} cor={com?.cor} tamanho={aberta ? 48 : 40} className="shrink-0 self-start" />
  );
  // Nas listas, o cartão inteiro abre a conversa (como nas outras redes), menos nos botões, links, menus e quando a pessoa
  // seleciona texto. No teclado e no leitor de tela, quem abre é o link da hora: o clique no cartão é só um atalho do dedo e do mouse.
  const abrir = (e: EventoDeMouse<HTMLElement>) => {
    if (aberta || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if ((e.target as HTMLElement).closest("a, button, input, textarea, select, label, summary, details, audio, video, [role=button]")) return;
    if (window.getSelection()?.toString()) return;
    router.push(caminhoDoPost);
  };
  const cabeca = (
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
  );

  const corpo = (
    <>
      {((post.comunidade && !semComunidade) || post.tipo !== "post" || post.flair) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {post.comunidade && !semComunidade && <Pilula texto={com?.nome ?? post.comunidade} cor={com?.cor} slug={post.comunidade} href={enderecos.comunidade(lang, post.comunidade)} />}
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

      {post.titulo && (comTitulo || densidade !== "lista") && (
        <h3 className={`mt-2 font-extrabold leading-snug ${aberta ? "text-[1.4rem]" : "text-lg"}`}>
          {completo ? post.titulo : <Link href={caminhoDoPost} className="hover:underline">{post.titulo}</Link>}
        </h3>
      )}

      {aviso ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm font-bold">
            {s.post.avisoConteudo}: {aviso}
          </summary>
          <p className={`mt-1 whitespace-pre-line break-words leading-relaxed ${tamanhoDoTexto}`} data-citavel={aberta ? post.id : undefined}><TextoComTags texto={longoTexto} lang={lang} Resto={TextoComMencoes} /></p>
        </details>
      ) : (
        <p className={`mt-2 whitespace-pre-line break-words leading-relaxed ${tamanhoDoTexto}`} data-citavel={aberta ? post.id : undefined}><TextoComTags texto={longoTexto} lang={lang} Resto={TextoComMencoes} /></p>
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

      {antesDasAcoes}

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
          <button
            type="button"
            className="al2-acao al2-acao-repostar"
            aria-pressed={repostei}
            data-tocou={tocou === "repostar" ? "" : undefined}
            disabled={ocupado || (!exemplo && (semRepostar || (!repostavel && !repostei)))}
            title={exemplo ? undefined : semRepostar ? t.cartao.indisponivel : !repostavel && !repostei ? t.cartao.naoRepostavel : undefined}
            onClick={() => {
              setTocou("repostar");
              void repostar();
            }}
          >
            <Icone nome="repostar" className="h-[18px] w-[18px]" />
            {/* Nome fixo para o leitor de tela (o estado já vai no aria-pressed); "Repostado" é só para quem vê. */}
            <span className="sr-only">{t.cartao.repostar}</span>
            <span aria-hidden className="max-[420px]:hidden">{repostei ? t.cartao.repostado : t.cartao.repostar}</span>
          </button>
        )}
        {logado && !post.meu && (
          <button type="button" className="al2-acao al2-acao-acender" aria-pressed={post.apoiei} data-tocou={tocou === "acender" ? "" : undefined} disabled={ocupado} onClick={() => {
              setTocou("acender");
              void acender();
            }}>
            <Icone nome="acender" className="h-[18px] w-[18px]" />
            <span className="sr-only">{t.cartao.acender}</span>
            <span aria-hidden className="max-[420px]:hidden">{post.apoiei ? t.cartao.aceso : t.cartao.acender}</span>
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
          <button type="button" className="al2-acao al2-acao-salvar" aria-pressed={post.salvei} data-tocou={tocou === "salvar" ? "" : undefined} aria-label={t.cartao.salvar} title={post.salvei ? t.cartao.salvo : t.cartao.salvar} disabled={ocupado} onClick={() => {
            setTocou("salvar");
            void salvar();
          }}>
            <Icone nome="salvos" className="h-[18px] w-[18px]" />
          </button>
        )}
        <button type="button" className="al2-acao" aria-label={t.cartao.compartilhar} title={t.cartao.compartilhar} onClick={() => void compartilhar()}>
          <Icone nome="compartilhar" className="h-[18px] w-[18px]" />
        </button>
        {/* Denunciar, silenciar, moderar e o que as frentes encaixam ficam num menu, para a linha de ações ser a da prancha. */}
        <details ref={detalhesQueFecham} className="al2-mais-acoes relative">
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
    </>
  );

  return (
    <article
      className={`al2-cartao al2-cartao-${densidade} ${aberta ? "px-4 pb-3 pt-5 md:px-5" : `flex gap-3 px-4 md:px-5 ${densidade === "compacta" ? "py-4" : "py-5"}`}`}
      aria-label={post.titulo ?? post.texto.slice(0, 60)}
      data-tipo={post.tipo}
      data-abre={aberta ? undefined : ""}
      onClick={abrir}
    >
      {aberta ? (
        <>
          <div className="flex items-center gap-3">
            {avatar}
            <div className="min-w-0 flex-1 text-[1.05rem]">{cabeca}</div>
          </div>
          {corpo}
        </>
      ) : (
        <>
          {avatar}
          <div className="min-w-0 flex-1">
            {/* Chegou por um repost de quem a pessoa segue: nunca o nome de quem repostou nem quantos (LGPD art. 11). */}
            {post.repostado_em && (
              <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-[var(--al-texto-3)]">
                <Icone nome="repostar" className="h-3.5 w-3.5" />
                {t.cartao.veioDeRepost}
              </p>
            )}
            {cabeca}
            {corpo}
          </div>
        </>
      )}
    </article>
  );
}
