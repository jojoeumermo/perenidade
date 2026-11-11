// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O perfil de pessoa no perfil livre: o cabeçalho que a pessoa montou (cor, clima, modelo, capa, faixa, rosto, bio, campos,
// status e "tocando agora") e as abas que ela escolheu, na ordem dela. Sem contagem de seguidores e sem lista de quem segue
// (regra da casa); organizações só as que a pessoa escolheu mostrar, uma a uma (LGPD art. 11).
import { useEffect, useId, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import Link from "@/components/Link";
import { SelosDaEscola } from "@/components/escola/percurso/SelosDaEscola";
import { selosDaEscola } from "@/lib/escola/conquistas";
import { hexDoAcento, PALETA_DO_PERFIL, type AbaDoPerfil } from "@/lib/rede/aparencia";
import { redePerfil } from "@/lib/rede/cliente-perfil";
import { enderecoDeEditarPerfil } from "@/lib/rede/perfil";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { TextosDoPerfil } from "@/lib/rede/textos-perfil";
import { enderecos, type PaginaDaLinha, type Post, type Situacao } from "@/lib/rede/tipos";
import type { ExtrasDoPerfil } from "@/lib/rede/tipos-org";
import type { PerfilDaRede } from "@/lib/rede/tipos-perfil";
import { CartaoDePost } from "../../CartaoDePost";
import { textoDoErro } from "../../erros";
import { EsqueletoDaLinha } from "../../Esqueletos";
import { Linha } from "../../Linha";
import { Abas } from "../../org/Abas";
import { Botao, LinkBotao } from "../../ui/Botao";
import { FileiraDoPerfil, fileiraDeDestaquesLigada } from "../FileiraDoPerfil";
import { CabecalhoDoPerfil, estiloDoAcento } from "./Cabecalho";
import { linhaDoPerfil, meusPosts, postsFixados, previa, type AparenciaLida } from "./dados";
import type { TextosDoPerfilLivre } from "./textos";

/** Troca de aba com View Transition onde houver (e sem ela, direto). */
export function comTransicao(mudar: () => void) {
  const d = document as Document & { startViewTransition?: (f: () => void) => unknown };
  const parado = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || document.documentElement.hasAttribute("data-parado");
  if (!d.startViewTransition || parado) return mudar();
  d.startViewTransition(() => flushSync(mudar));
}

export function PaginaDoPerfil({
  dado: inicial,
  extras,
  lida,
  t,
  sp,
  lang,
  s,
  situacao,
  aoResponder,
}: {
  dado: PerfilDaRede;
  extras: ExtrasDoPerfil | null;
  lida: AparenciaLida;
  t: TextosDoPerfilLivre;
  sp: TextosDoPerfil | null;
  lang: string;
  s: TextosDaRede;
  situacao: Situacao;
  aoResponder: (p: Post) => void;
}) {
  const id = useId();
  const a = lida.aparencia;
  const [dado, setDado] = useState(inicial);
  // Com a fileira única (B1), os destaques de post/ato vão para a mesma linha de bolinhas dos stories, acima das abas: a aba
  // "Destaques" sai (senão a pessoa veria os mesmos destaques em dois lugares).
  const fileira = fileiraDeDestaquesLigada();
  const abas = fileira ? a.abas.filter((x) => x !== "destaques") : a.abas;
  const [aba, setAba] = useState<AbaDoPerfil>(abas[0] ?? "posts");
  const destaquesDePosts = [
    ...a.destaques.map((d) => ({ chave: d.ref, tipo: d.tipo, titulo: d.titulo, href: d.tipo === "ato" ? `/${lang}/alumia/ato/${d.ref}` : enderecos.post(lang, d.ref), cor: PALETA_DO_PERFIL[d.cor] })),
    ...(extras?.destaques ?? [])
      .filter((d) => !a.destaques.some((x) => x.ref === d.id))
      .map((d) => ({ chave: d.id, tipo: d.tipo === "ato" ? ("ato" as const) : ("post" as const), titulo: d.titulo, href: d.href, cor: hexDoAcento(a.acento) })),
  ];
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  async function seguir(sim: boolean) {
    setOcupado(true);
    setErro("");
    if (previa()) {
      // Na prévia não há serviço de contas: o seguir só muda aqui (perfil trancado vira "pedido enviado").
      await new Promise((r) => setTimeout(r, 220));
      setDado((d) => ({ ...d, sigo: sim && d.modo !== "trancado", pendente: sim && d.modo === "trancado" }));
      setOcupado(false);
      return;
    }
    try {
      const r = await redePerfil.seguir(dado.handle, sim);
      setDado((d) => ({ ...d, sigo: r.sigo, pendente: r.pendente }));
    } catch (e) {
      setErro(textoDoErro(s, e));
    } finally {
      setOcupado(false);
    }
  }

  const acoes = dado.meu ? (
    <LinkBotao href={enderecoDeEditarPerfil(lang)} variante="contorno" icone={<IconeLapis />}>
      {t.perfil.editar}
    </LinkBotao>
  ) : dado.pendente ? (
    <Botao variante="contorno" disabled={ocupado} onClick={() => void seguir(false)}>
      {sp?.perfil.pedidoEnviado ?? "…"}
    </Botao>
  ) : (
    <>
      <Botao variante={dado.sigo ? "claro" : "primario"} pressionado={dado.sigo} disabled={ocupado || !situacao.membro} onClick={() => void seguir(!dado.sigo)}>
        {dado.sigo ? (sp?.perfil.seguindo ?? "…") : dado.modo === "trancado" ? (sp?.perfil.pedirParaSeguir ?? "…") : (sp?.perfil.seguir ?? "…")}
      </Botao>
      {situacao.logado && situacao.membro ? (
        <LinkBotao href={`${enderecos.linha(lang)}/conversas?com=${encodeURIComponent(dado.handle)}`} variante="contorno">
          {s.perfil.conversar}
        </LinkBotao>
      ) : null}
    </>
  );

  // Na faixa, o nome curto quando há um ("Escola"): as sete abas cabem na coluna sem cortar.
  const curtos = t.abas.curtos as Partial<Record<AbaDoPerfil, string>>;
  const nomesDasAbas = Object.fromEntries(abas.map((x) => [x, curtos[x] ?? t.abas.nomes[x]])) as Record<AbaDoPerfil, string>;

  const painel: Record<AbaDoPerfil, () => ReactNode> = {
    posts: () => (
      <>
        <Fixados ids={a.fixados} t={t} lang={lang} s={s} situacao={situacao} aoResponder={aoResponder} legado={dado.fixado} />
        {previa() ? <PostsDaPrevia handle={dado.handle} fora={a.fixados} lang={lang} s={s} situacao={situacao} aoResponder={aoResponder} /> : <Linha aba={`u:${dado.handle}`} lang={lang} s={s} logado={situacao.logado} aoResponder={aoResponder} />}
      </>
    ),
    respostas: () => <LinhaDaAba handle={dado.handle} aba="respostas" vazio={t.perfil.vazio.respostas} lang={lang} s={s} situacao={situacao} aoResponder={aoResponder} />,
    midia: () => <LinhaDaAba handle={dado.handle} aba="midia" vazio={t.perfil.vazio.midia} lang={lang} s={s} situacao={situacao} aoResponder={aoResponder} />,
    atos: () => <LinhaDaAba handle={dado.handle} aba="atos" vazio={t.perfil.vazio.atos} lang={lang} s={s} situacao={situacao} aoResponder={aoResponder} />,
    destaques: () => {
      const legado = (extras?.destaques ?? []).filter((d) => !a.destaques.some((x) => x.ref === d.id));
      if (a.destaques.length === 0 && legado.length === 0) return <p className="pf-vazio">{t.perfil.vazio.destaques}</p>;
      return (
        <ul className="pf-grade-destaques">
          {a.destaques.map((d) => (
            <li key={d.ref}>
              <Link href={enderecos.post(lang, d.ref)} className="pf-destaque" style={{ ["--pf-cor-destaque" as string]: PALETA_DO_PERFIL[d.cor] }}>
                <span className="pf-destaque-tipo">{d.tipo === "ato" ? t.vitrine.ato : t.vitrine.post}</span>
                <span className="pf-destaque-titulo">{d.titulo}</span>
              </Link>
            </li>
          ))}
          {legado.map((d) => (
            <li key={d.id}>
              <Link href={d.href} className="pf-destaque" style={{ ["--pf-cor-destaque" as string]: hexDoAcento(a.acento) }}>
                <span className="pf-destaque-tipo">{d.tipo === "ato" ? t.vitrine.ato : t.vitrine.post}</span>
                <span className="pf-destaque-titulo">{d.titulo}</span>
              </Link>
            </li>
          ))}
        </ul>
      );
    },
    organizacoes: () =>
      lida.orgs.length === 0 ? (
        <p className="pf-vazio">{t.perfil.vazio.organizacoes}</p>
      ) : (
        <ul className="pf-lista-orgs" aria-label={preencher(t.perfil.orgs, { codinome: dado.codinome })}>
          {lida.orgs.map((o) => (
            <li key={o.handle}>
              <Link href={enderecos.perfil(lang, o.handle)}>
                <span>
                  {o.codinome}
                  <small>@{o.handle}</small>
                </span>
                <span className="pf-org-selo">✓</span>
              </Link>
            </li>
          ))}
        </ul>
      ),
    escola: () => {
      const selos = selosDaEscola(dado.selos);
      if (selos.length === 0 || !sp) return <p className="pf-vazio">{t.perfil.vazio.escola}</p>;
      return (
        <div className="pf-escola">
          <SelosDaEscola selos={selos} t={sp.perfil.selosEscola} rotulo={sp.perfil.selosEscola.titulo} />
          <p className="al-perfil-nota" style={{ marginTop: 10 }}>{sp.perfil.selosEscola.ajuda}</p>
        </div>
      );
    },
  };

  return (
    <div className="al-perfil pf-pagina" style={estiloDoAcento(a.acento)}>
      <CabecalhoDoPerfil
        dados={{ codinome: dado.codinome, handle: dado.handle, pronomes: extras?.pronomes ?? null, bio: dado.bio, status: extras?.status ?? null, campos: extras?.campos ?? [], avatar: dado.avatar, capa: dado.capa }}
        aparencia={a}
        t={t}
        lang={lang}
        acoes={acoes}
        depois={
          <>
            {dado.modo === "trancado" ? <p className="al-perfil-nota">{s.perfil.trancado}</p> : null}
            <p className="al-perfil-nota">{s.perfil.semContagens}</p>
            {erro ? (
              <p className="al-perfil-erro" role="alert">
                {erro}
              </p>
            ) : null}
          </>
        }
      />
      {fileira ? <FileiraDoPerfil handle={dado.handle} lang={lang} s={s} situacao={situacao} posts={destaquesDePosts} /> : null}
      {abas.length > 1 ? (
        <Abas id={id} abas={abas} atual={aba} aoMudar={(n) => comTransicao(() => setAba(n))} rotulos={nomesDasAbas} rotulo={preencher(t.perfil.abas, { codinome: dado.codinome })} />
      ) : null}
      <div key={aba} id={`${id}-painel`} role={abas.length > 1 ? "tabpanel" : undefined} aria-labelledby={abas.length > 1 ? `${id}-aba-${aba}` : undefined} className="pf-painel">
        {painel[aba]()}
      </div>
    </div>
  );
}

function IconeLapis() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" />
      <path d="M13.5 6.5l4 4" />
    </svg>
  );
}

/** Os fixados (até 3, na ordem da pessoa); sem eles, o fixado antigo (rede_perfil_fixar). */
function Fixados({ ids, legado, t, lang, s, situacao, aoResponder }: { ids: string[]; legado: Post | null; t: TextosDoPerfilLivre; lang: string; s: TextosDaRede; situacao: Situacao; aoResponder: (p: Post) => void }) {
  const chave = ids.join(",");
  const [posts, setPosts] = useState<{ chave: string; lista: Post[] } | null>(null);
  useEffect(() => {
    let vivo = true;
    postsFixados(chave ? chave.split(",") : []).then((lista) => vivo && setPosts({ chave, lista }));
    return () => {
      vivo = false;
    };
  }, [chave]);
  const lista = posts?.chave === chave && posts.lista.length > 0 ? posts.lista : legado ? [legado] : [];
  if (lista.length === 0) return null;
  return (
    <section aria-label={t.perfil.fixado}>
      {lista.map((p) => (
        <div key={p.id}>
          <p className="pf-fixado-rotulo">
            <svg aria-hidden viewBox="0 0 16 16" width="12" height="12">
              <path d="M9.5 1.5l5 5-2 .5-2.5 2.5.5 3-1.5 1.5-3-3L2 15l-1-1 4-4-3-3L3.5 5.5l3 .5L9 3.5z" fill="currentColor" />
            </svg>
            {t.perfil.fixado}
          </p>
          <CartaoDePost post={p} lang={lang} s={s} logado={situacao.logado} aoResponder={aoResponder} />
        </div>
      ))}
    </section>
  );
}

/** Respostas, Mídia e Atos: a página de rede_perfil_linha, com "carregar mais" pelo cursor. */
function LinhaDaAba({ handle, aba, vazio, lang, s, situacao, aoResponder }: { handle: string; aba: "respostas" | "midia" | "atos"; vazio: string; lang: string; s: TextosDaRede; situacao: Situacao; aoResponder: (p: Post) => void }) {
  const chave = `${handle}:${aba}`;
  const [pagina, setPagina] = useState<{ chave: string; dado: PaginaDaLinha } | null>(null);
  const [erro, setErro] = useState("");
  const [mais, setMais] = useState(false);
  useEffect(() => {
    let vivo = true;
    linhaDoPerfil(handle, aba)
      .then((dado) => vivo && setPagina({ chave: `${handle}:${aba}`, dado }))
      .catch((e) => vivo && setErro(textoDoErro(s, e)));
    return () => {
      vivo = false;
    };
  }, [handle, aba, s]);
  if (erro) return <p className="pf-vazio" role="alert">{erro}</p>;
  if (!pagina || pagina.chave !== chave) return <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={2} />;
  if (pagina.dado.itens.length === 0) return <p className="pf-vazio">{vazio}</p>;
  return (
    <>
      {pagina.dado.itens.map((p) => (
        <CartaoDePost key={p.id} post={p} lang={lang} s={s} logado={situacao.logado} aoResponder={aoResponder} />
      ))}
      {pagina.dado.proximo ? (
        <div className="al-painel">
          <Botao
            variante="contorno"
            disabled={mais}
            onClick={() => {
              setMais(true);
              linhaDoPerfil(handle, aba, pagina.dado.proximo)
                .then((n) => setPagina((p) => (p ? { chave: p.chave, dado: { itens: [...p.dado.itens, ...n.itens], proximo: n.proximo } } : p)))
                .catch((e) => setErro(textoDoErro(s, e)))
                .finally(() => setMais(false));
            }}
          >
            {s.estados.maisPosts}
          </Botao>
        </div>
      ) : null}
    </>
  );
}

/** Na prévia, os posts das pranchas (a linha de verdade pede o banco). */
export function PostsDaPrevia({ handle, fora = [], lang, s, situacao, aoResponder }: { handle: string; fora?: string[]; lang: string; s: TextosDaRede; situacao: Situacao; aoResponder: (p: Post) => void }) {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const chave = fora.join(",");
  useEffect(() => {
    let vivo = true;
    // Só os posts da própria pessoa; os fixados já aparecem no alto.
    meusPosts(handle).then((l) => vivo && setPosts(l.filter((p) => !chave.split(",").includes(p.id))));
    return () => {
      vivo = false;
    };
  }, [handle, chave]);
  if (!posts) return <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={2} />;
  return (
    <>
      {posts.map((p) => (
        <CartaoDePost key={p.id} post={p} lang={lang} s={s} logado={situacao.logado} aoResponder={aoResponder} />
      ))}
    </>
  );
}
/** O @ que não existe (ou não quer ser achado): um estado próprio, nunca a mensagem de erro de serviço. */
export function PerfilNaoAchado({ handle, lang, t }: { handle: string; lang: string; t: TextosDoPerfilLivre }) {
  return (
    <div className="al-perfil pf-pagina">
      <div className="pf-nao-achado" role="status">
        <svg aria-hidden viewBox="0 0 48 48" width="56" height="56" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <circle cx="21" cy="21" r="12" />
          <path d="M30 30l10 10M16 21h10" />
        </svg>
        <h1 className="al-cond">{t.perfil.naoAchado.titulo}</h1>
        <p>{preencher(t.perfil.naoAchado.texto, { handle })}</p>
        <LinkBotao href={enderecos.linha(lang)} variante="contorno">
          {t.perfil.naoAchado.voltar}
        </LinkBotao>
      </div>
    </div>
  );
}
