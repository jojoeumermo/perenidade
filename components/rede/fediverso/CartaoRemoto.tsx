// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent as EventoDeMouse } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/Link";
import { localePath } from "@/i18n/config";
import { deFora, type Resultado } from "@/lib/rede/fediverso/tela/cliente";
import { hrefSeguro, linkDaOrigem } from "@/lib/rede/fediverso/tela/html";
import { deForaVale } from "@/lib/rede/fediverso/tela/linha";
import { textoDoErroDeFora, useTextosDoFediverso } from "@/lib/rede/fediverso/tela/textos";
import { contagemVisivel, contaDoHandle, enderecoDoFioRemoto, enderecoDoPerfilRemoto, type CartaoDeFora, type RelacaoComQuemEDeFora } from "@/lib/rede/fediverso/tela/tipos";
import { preencher } from "@/lib/rede/preencher";
import { tempoCurto } from "@/lib/rede/publicar/alumia2";
import { useAlumia2 } from "../publicar/alumia2/contexto";
import { detalhesQueFecham } from "../publicar/alumia2/fechar";
import { Icone } from "../publicar/alumia2/icones";
import { Avatar16 } from "../ui/Avatar16";
import { DenunciarDeFora } from "./DenunciarDeFora";
import { HtmlDeFora } from "./HtmlDeFora";
import { imagensDeFora, MidiaDeFora } from "./MidiaDeFora";
import { SeloDoServidor } from "./SeloDoServidor";

export type DensidadeDoCartaoRemoto = "lista" | "compacta" | "aberta";

/** As margens do texto que vem de fora (HtmlDeFora não traz estilo): parágrafos, listas, citação, código e links. */
const CLASSES_DO_HTML =
  "[&_p+p]:mt-2 [&_a]:underline [&_a]:underline-offset-2 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:my-1 [&_blockquote]:border-l-2 [&_blockquote]:border-[var(--al-superficie-2)] [&_blockquote]:pl-3 [&_pre]:my-1 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-[var(--al-superficie)] [&_pre]:p-2 [&_code]:font-mono [&_code]:text-[0.875em]";

/**
 * O cartão de um post de FORA (Fediverso), com a mesma estrutura e as mesmas classes do cartão daqui (CartaoDaAlumia2): rosto de
 * 16 cartões pelo endereço da pessoa (nunca a foto de fora), nome, @ (na linha, escondido no celular), a pílula do servidor, a hora, o
 * texto (convertido por lista permitida), as imagens (só pela rota-proxy daqui) e as ações Responder, Impulsionar, Curtir e abrir
 * no original; no "…", denunciar, silenciar e bloquear a pessoa. Nenhuma lista de quem curtiu ou impulsionou; número só a partir de 3.
 *
 * Só aparece com "fediverso-total" ligado (ou na prévia, com dados de exemplo e sem chamar rota nenhuma) e dentro da casca nova.
 *
 * `silenciado` e `bloqueado` são a relação com quem escreveu, quando quem desenha o cartão a conhece (o perfil de fora); sem
 * eles o cartão começa pelo que o banco mandou no próprio post (`post.silenciado`, `post.bloqueado`), ou em "não". `aoMudarRelacao` avisa quem desenha quando a pessoa silencia ou bloqueia pelo cartão.
 */
export default function CartaoRemoto({
  post: inicial,
  lang,
  logado,
  densidade = "lista",
  aoResponder,
  silenciado: silenciadoDeFora,
  bloqueado: bloqueadoDeFora,
  aoMudarRelacao,
}: {
  post: CartaoDeFora;
  lang: string;
  logado: boolean;
  densidade?: DensidadeDoCartaoRemoto;
  aoResponder?: () => void;
  silenciado?: boolean;
  bloqueado?: boolean;
  aoMudarRelacao?: (parte: Partial<RelacaoComQuemEDeFora>) => void;
}) {
  const router = useRouter();
  const al2 = useAlumia2();
  const tf = useTextosDoFediverso(lang);
  const [post, setPost] = useState(inicial);
  // O cartão acompanha o que chega de novo (o fio relido depois de uma resposta traz a contagem nova).
  const [recebido, setRecebido] = useState(inicial);
  // A relação com quem escreveu começa pelo que o banco mandou no cartão e segue o que a pessoa fizer aqui.
  const [silenciadoAqui, setSilenciadoAqui] = useState(inicial.silenciado === true);
  const [bloqueadoAqui, setBloqueadoAqui] = useState(inicial.bloqueado === true);
  if (recebido !== inicial) {
    setRecebido(inicial);
    setPost(inicial);
    setSilenciadoAqui(inicial.silenciado === true);
    setBloqueadoAqui(inicial.bloqueado === true);
  }
  const silenciado = silenciadoDeFora ?? silenciadoAqui;
  const bloqueado = bloqueadoDeFora ?? bloqueadoAqui;
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [nota, setNota] = useState("");
  const [denunciando, setDenunciando] = useState(false);
  // A ação que a pessoa acabou de tocar: só ela anima.
  const [tocou, setTocou] = useState<"impulsionar" | "curtir" | null>(null);
  // Os avisos somem sozinhos; o relógio morre junto com o cartão.
  const relogio = useRef(0);
  useEffect(() => () => window.clearTimeout(relogio.current), []);
  const menu = useRef<HTMLDetailsElement | null>(null);
  const prenderMenu = useCallback((el: HTMLDetailsElement | null) => {
    menu.current = el;
    return detalhesQueFecham(el);
  }, []);

  if (!al2 || !tf) return null;
  const { t, previa } = al2;
  if (!deForaVale(previa)) return null;

  const aberta = densidade === "aberta";
  const handle = post.handle_remoto ?? post.autor?.handle ?? null;
  const conta = contaDoHandle(handle);
  const nomeDaPessoa = post.nome_remoto?.trim() || post.autor?.codinome || handle || post.servidor;
  const aviso = (post.aviso ?? "").trim();
  const caminhoDoFio = enderecoDoFioRemoto(lang, post.id);
  const perfilHref = conta ? enderecoDoPerfilRemoto(lang, conta) : hrefSeguro(post.ator_remoto) ? enderecoDoPerfilRemoto(lang, post.ator_remoto) : null;
  // "Abrir no original" só leva ao servidor de onde o post veio (o do id da nota); endereço com usuário e senha não serve.
  const original = linkDaOrigem(post.url, post.id);
  const quando = post.publicado_em ?? post.criado_em;
  const respostas = contagemVisivel(post.respostas);
  const soSeguidores = post.visibilidade === "seguidores";
  // Nota que o banco não guarda (lida agora na origem): não dá para curtir, impulsionar, responder nem denunciar daqui.
  const aoVivo = post.ao_vivo === true;
  const temOutraMidia = (post.midia?.length ?? 0) > imagensDeFora(post.midia).length;

  const avisar = (qual: "nota" | "erro", texto: string) => {
    window.clearTimeout(relogio.current);
    setNota(qual === "nota" ? texto : "");
    setErro(qual === "erro" ? texto : "");
    relogio.current = window.setTimeout(() => {
      setNota("");
      setErro("");
    }, qual === "erro" ? 5200 : 3200);
  };

  /** Muda na tela na hora; se o pedido falha, volta ao que era e mostra o porquê. Na prévia nada sai da tela. */
  async function otimista<T>(mudar: () => void, voltar: () => void, pedir: () => Promise<Resultado<T>>, acertar?: (dado: T) => void, depois?: (dado: T | null) => string | undefined) {
    if (ocupado) return;
    setOcupado(true);
    setErro("");
    setNota("");
    mudar();
    let dado: T | null = null;
    if (!previa) {
      const r = await pedir();
      if (!r.ok) {
        voltar();
        avisar("erro", textoDoErroDeFora(tf!, r.erro));
        setOcupado(false);
        return;
      }
      dado = r.dado;
      acertar?.(r.dado);
    }
    // O recado só sai com o que o banco confirmou (na prévia, com o que a tela mudou).
    const recado = depois?.(dado);
    if (recado) avisar("nota", recado);
    setOcupado(false);
  }

  const curtir = () => {
    const antes = post.curti;
    void otimista(
      () => setPost((p) => ({ ...p, curti: !antes })),
      () => setPost((p) => ({ ...p, curti: antes })),
      () => deFora.interagir(post.id, "like", !antes),
      (d) => setPost((p) => ({ ...p, curti: d.curti, impulsionei: d.impulsionei })),
    );
  };
  const impulsionar = () => {
    const antes = post.impulsionei;
    void otimista(
      () => setPost((p) => ({ ...p, impulsionei: !antes })),
      () => setPost((p) => ({ ...p, impulsionei: antes })),
      () => deFora.interagir(post.id, "announce", !antes),
      (d) => setPost((p) => ({ ...p, curti: d.curti, impulsionei: d.impulsionei })),
    );
  };
  const mudarSilenciado = (sim: boolean) => {
    setSilenciadoAqui(sim);
    aoMudarRelacao?.({ silenciado: sim });
  };
  const mudarBloqueado = (sim: boolean) => {
    setBloqueadoAqui(sim);
    // Bloquear desfaz o seguir dos dois lados (o banco faz o mesmo).
    aoMudarRelacao?.(sim ? { bloqueado: true, seguindo: "nao", segue_voce: false } : { bloqueado: false });
  };
  const silenciar = () => {
    const antes = silenciado;
    void otimista(
      () => mudarSilenciado(!antes),
      () => mudarSilenciado(antes),
      () => deFora.silenciarPessoa(post.ator_remoto, !antes),
      (d) => {
        mudarSilenciado(d.silenciado);
        // Pediu para silenciar e o banco não silenciou: a conta já está bloqueada (o bloqueio continua valendo).
        if (!antes && !d.silenciado) mudarBloqueado(true);
      },
      (d) => (antes ? undefined : (d ? d.silenciado : true) ? tf.perfil.silenciado : tf.perfil.bloqueado),
    );
  };
  const bloquear = () => {
    const antes = bloqueado;
    void otimista(
      () => mudarBloqueado(!antes),
      () => mudarBloqueado(antes),
      () => deFora.bloquearPessoa(post.ator_remoto, !antes),
      (d) => mudarBloqueado(d.bloqueado),
      (d) => (!antes && (d ? d.bloqueado : true) ? tf.perfil.bloqueado : undefined),
    );
  };
  const abrirDenuncia = () => {
    if (menu.current) menu.current.open = false;
    setDenunciando(true);
  };
  const fecharDenuncia = () => {
    setDenunciando(false);
    menu.current?.querySelector<HTMLElement>(":scope > summary")?.focus();
  };

  const nome = <span className="font-extrabold text-[var(--al-texto)]">{nomeDaPessoa}</span>;
  const tamanhoDoTexto = aberta ? "text-[1.2rem] text-[var(--al-texto)]" : densidade === "compacta" ? "text-[0.9375rem] text-[var(--al-texto)]" : "text-[0.9375rem] text-[var(--al-texto-2)]";
  // O rosto sai do endereço da pessoa (mosaico), nunca da foto que está em outro servidor.
  const rosto = handle ?? post.ator_remoto ?? post.servidor;
  const avatar = perfilHref ? (
    <Link href={perfilHref} className="shrink-0 self-start" tabIndex={-1} aria-hidden>
      <Avatar16 handle={rosto} tamanho={aberta ? 48 : 40} />
    </Link>
  ) : (
    <Avatar16 handle={rosto} tamanho={aberta ? 48 : 40} className="shrink-0 self-start" />
  );
  // Nas listas, o cartão inteiro abre o fio, menos nos botões, links, menus, formulário e quando a pessoa seleciona texto. No
  // teclado e no leitor de tela, quem abre é o link da hora.
  const abrir = (e: EventoDeMouse<HTMLElement>) => {
    if (aberta || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if ((e.target as HTMLElement).closest("a, button, input, textarea, select, label, summary, details, form, audio, video, [role=button], [role=status]")) return;
    if (window.getSelection()?.toString()) return;
    router.push(caminhoDoFio);
  };

  // Na linha, o @ some no celular (a pílula já diz o servidor); na conversa ele aparece inteiro, como na prancha.
  const arrobaNoCelular = densidade === "lista" ? "hidden md:inline" : "";
  const cabeca = (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[0.8125rem] text-[var(--al-texto-3)]">
      {perfilHref ? (
        <Link href={perfilHref} className="text-[0.9375rem] hover:underline">
          {nome}
        </Link>
      ) : (
        <span className="text-[0.9375rem]">{nome}</span>
      )}
      {handle &&
        (perfilHref ? (
          <Link href={perfilHref} className={`break-all hover:underline ${arrobaNoCelular}`}>
            @{handle}
          </Link>
        ) : (
          <span className={`break-all ${arrobaNoCelular}`}>@{handle}</span>
        ))}
      <SeloDoServidor servidor={post.servidor} rotulo={tf.cartao.doFediverso} curto={densidade === "compacta"} />
      <span aria-hidden>·</span>
      <Link href={caminhoDoFio} className="whitespace-nowrap hover:underline">
        <time dateTime={quando}>{tempoCurto(quando, lang)}</time>
      </Link>
      {post.editado_em && <span>({tf.cartao.editado})</span>}
      {(soSeguidores || post.visibilidade === "nao_listado") && (
        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--al-superficie-2)] px-1.5 py-0.5 text-[0.6875rem] font-semibold text-[var(--al-texto-2)]">
          {soSeguidores && <Icone nome="cadeado" className="h-3.5 w-3.5" />}
          {soSeguidores ? tf.cartao.soSeguidores : tf.cartao.naoListado}
        </span>
      )}
    </div>
  );

  const conteudo = (
    <>
      <HtmlDeFora html={post.html} texto={post.texto} className={`al2-texto break-words leading-relaxed ${tamanhoDoTexto} ${CLASSES_DO_HTML}`} />
      <MidiaDeFora midia={post.midia} sensivel={post.sensivel} t={tf.cartao} />
      {temOutraMidia && original && (
        <a href={original} rel="noopener noreferrer nofollow" target="_blank" className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold underline">
          <Icone nome="fediverso" className="h-4 w-4" />
          {tf.cartao.abrirOriginal}
        </a>
      )}
    </>
  );

  const rotuloDeRespostas = respostas === null ? null : preencher(t.cartao.respostas, { n: respostas });
  const corpo = (
    <>
      {aviso ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm font-bold">
            {tf.cartao.avisoDeConteudo}: {aviso}
          </summary>
          <div className="mt-1">{conteudo}</div>
        </details>
      ) : (
        <div className="mt-2">{conteudo}</div>
      )}

      <div className="-ml-1.5 mt-2 flex flex-wrap items-center gap-x-0.5 sm:gap-x-2">
        {logado && !post.travado && !aoVivo && aoResponder ? (
          <button type="button" className="al2-acao" onClick={() => aoResponder()} aria-label={rotuloDeRespostas ? `${tf.cartao.responder} · ${rotuloDeRespostas}` : tf.cartao.responder}>
            <Icone nome="responder" className="h-[18px] w-[18px]" />
            {respostas !== null && <span aria-hidden>{respostas}</span>}
          </button>
        ) : (
          <Link href={caminhoDoFio} className="al2-acao" aria-label={rotuloDeRespostas ? `${tf.cartao.responder} · ${rotuloDeRespostas}` : tf.cartao.responder}>
            <Icone nome="responder" className="h-[18px] w-[18px]" />
            {respostas !== null && <span aria-hidden>{respostas}</span>}
          </Link>
        )}
        {logado && (
          <button
            type="button"
            className="al2-acao al2-acao-repostar"
            aria-pressed={post.impulsionei}
            data-tocou={tocou === "impulsionar" ? "" : undefined}
            // Post só para seguidores não se espalha; o que já foi impulsionado pode ser desfeito.
            disabled={ocupado || ((aoVivo || soSeguidores) && !post.impulsionei)}
            title={soSeguidores ? tf.cartao.soSeguidores : aoVivo ? tf.cartao.soNoOriginal : undefined}
            onClick={() => {
              setTocou("impulsionar");
              impulsionar();
            }}
          >
            <Icone nome="repostar" className="h-[18px] w-[18px]" />
            {/* Nome fixo para o leitor de tela (o estado já vai no aria-pressed); "Impulsionado" é só para quem vê. */}
            <span className="sr-only">
              {tf.cartao.impulsionar}
              {soSeguidores ? ` (${tf.cartao.soSeguidores})` : ""}
            </span>
            <span aria-hidden className="max-[420px]:hidden">{post.impulsionei ? tf.cartao.impulsionado : tf.cartao.impulsionar}</span>
          </button>
        )}
        {logado && (
          <button
            type="button"
            className="al2-acao al2-acao-acender"
            aria-pressed={post.curti}
            data-tocou={tocou === "curtir" ? "" : undefined}
            disabled={ocupado || (aoVivo && !post.curti)}
            title={aoVivo ? tf.cartao.soNoOriginal : undefined}
            onClick={() => {
              setTocou("curtir");
              curtir();
            }}
          >
            <Icone nome="acender" className="h-[18px] w-[18px]" />
            <span className="sr-only">{tf.cartao.curtir}</span>
            <span aria-hidden className="max-[420px]:hidden">{post.curti ? tf.cartao.curtido : tf.cartao.curtir}</span>
          </button>
        )}
        {original && (
          <a href={original} rel="noopener noreferrer nofollow" target="_blank" className="al2-acao" aria-label={tf.cartao.abrirOriginal} title={tf.cartao.abrirOriginal}>
            <Icone nome="fediverso" className="h-[18px] w-[18px]" />
          </a>
        )}
        {/* Denunciar, silenciar e bloquear ficam num menu, para a linha de ações ser a da prancha. */}
        <details ref={prenderMenu} className="al2-mais-acoes relative">
          <summary className="al2-acao list-none [&::-webkit-details-marker]:hidden" aria-label={t.cartao.mais} title={t.cartao.mais}>
            <Icone nome="pontos" className="h-[18px] w-[18px]" />
          </summary>
          <div className="absolute right-0 z-20 mt-1 flex min-w-56 flex-col items-stretch rounded-xl border border-[var(--al-superficie-2)] bg-[var(--al-superficie)] p-1 text-sm shadow-xl">
            <Link href={caminhoDoFio} className="al2-acao justify-start">
              <Icone nome="responder" className="h-[18px] w-[18px]" />
              {rotuloDeRespostas ?? tf.fio.titulo}
            </Link>
            {original && (
              <a href={original} rel="noopener noreferrer nofollow" target="_blank" className="al2-acao justify-start">
                <Icone nome="fediverso" className="h-[18px] w-[18px]" />
                {tf.cartao.abrirOriginal}
              </a>
            )}
            {logado ? (
              <>
                <button type="button" className="al2-acao justify-start" aria-expanded={denunciando} disabled={aoVivo} title={aoVivo ? tf.cartao.soNoOriginal : undefined} onClick={abrirDenuncia}>
                  <Icone nome="alerta" className="h-[18px] w-[18px]" />
                  {tf.cartao.denunciar}
                </button>
                <button type="button" className="al2-acao justify-start" aria-pressed={silenciado} disabled={ocupado} onClick={silenciar}>
                  <Icone nome="silenciar" className="h-[18px] w-[18px]" />
                  {tf.cartao.silenciar}
                </button>
                <button type="button" className="al2-acao justify-start" aria-pressed={bloqueado} disabled={ocupado} onClick={bloquear}>
                  <Icone nome="escudo" className="h-[18px] w-[18px]" />
                  {tf.cartao.bloquear}
                </button>
              </>
            ) : (
              // Sem sessão, como no cartão daqui: a denúncia vai pela página Denunciar do site.
              <Link href={localePath(lang, "/denunciar")} className="al2-acao justify-start">
                <Icone nome="alerta" className="h-[18px] w-[18px]" />
                {tf.cartao.denunciar}
              </Link>
            )}
          </div>
        </details>
      </div>
      {aoVivo && logado && <p className="mt-1 text-xs text-[var(--al-texto-3)]">{tf.cartao.soNoOriginal}</p>}
      {denunciando && logado && <DenunciarDeFora alvo={post.id} t={tf} previa={previa} aoFechar={fecharDenuncia} />}
      <div aria-live="polite">
        {nota && (
          <p role="status" className="al2-torrada">
            <Icone nome="visto" className="h-4 w-4 shrink-0" grosso />
            <span className="min-w-0 break-words">{nota}</span>
          </p>
        )}
        {erro && (
          <p role="alert" className="al2-torrada">
            <Icone nome="alerta" className="h-4 w-4 shrink-0" grosso />
            <span className="min-w-0 break-words">{erro}</span>
          </p>
        )}
      </div>
    </>
  );

  // Chegou por impulso de alguém que a pessoa segue: só o nome, sem link para lista nenhuma.
  const impulso = post.impulsionado_por;
  const faixaDoImpulso = impulso ? (
    <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-[var(--al-texto-3)]">
      <Icone nome="repostar" className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 break-words">{preencher(tf.cartao.impulsionadoPor, { nome: impulso.nome?.trim() || (impulso.handle ? `@${impulso.handle}` : post.servidor) })}</span>
    </p>
  ) : null;

  return (
    <article
      className={`al2-cartao al2-cartao-${densidade} ${aberta ? "px-4 pb-3 pt-5 md:px-5" : `flex gap-3 px-4 md:px-5 ${densidade === "compacta" ? "py-4" : "py-5"}`}`}
      aria-label={`${nomeDaPessoa}: ${(post.texto ?? "").slice(0, 60)}`}
      data-tipo="post"
      data-origem="fediverso"
      data-abre={aberta ? undefined : ""}
      onClick={abrir}
    >
      {aberta ? (
        <>
          {faixaDoImpulso}
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
            {faixaDoImpulso}
            {cabeca}
            {corpo}
          </div>
        </>
      )}
    </article>
  );
}
