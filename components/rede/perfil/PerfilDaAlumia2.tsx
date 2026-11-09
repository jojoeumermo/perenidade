// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O perfil na Alumia nova (flags "rede-v2" + "alumia-2"): se o @ é de uma organização (e "alumia-org" está ligada), o perfil de
// organização (components/rede/org/PerfilDaOrg.tsx); senão, o perfil de pessoa com abas Posts / Respostas / Mídia, status,
// pronomes, campos e destaques (PLANO-ALUMIA §8 F4). Sem contagem de seguidores e sem lista de quem segue (regra da casa); nada do
// nome civil; os campos nunca pedem dado pessoal (telefone, endereço, CPF).
import { useEffect, useId, useState, type ReactNode } from "react";
import Link from "@/components/Link";
import { redeOrg } from "@/lib/rede/cliente-org";
import { redePerfil } from "@/lib/rede/cliente-perfil";
import { dataCurta, linkSeguro } from "@/lib/rede/org/contagem";
import { orgLigada } from "@/lib/rede/org/flag";
import { enderecoDeEditarPerfil, origemDaImagem } from "@/lib/rede/perfil";
import { preencher } from "@/lib/rede/preencher";
import { carregarTextosDaOrg, type TextosDaOrg } from "@/lib/rede/textos-org";
import type { TextosDaRede } from "@/lib/rede/textos";
import { enderecos, type PaginaDaLinha, type Post, type Situacao } from "@/lib/rede/tipos";
import type { PerfilDaRede } from "@/lib/rede/tipos-perfil";
import { ABAS_DA_PESSOA, type AbaDaPessoa, type ExtrasDoPerfil, type OrgPublica } from "@/lib/rede/tipos-org";
import { CartaoDePost } from "../CartaoDePost";
import { textoDoErro } from "../erros";
import { EsqueletoDaLinha } from "../Esqueletos";
import { Linha } from "../Linha";
import { Abas } from "../org/Abas";
import type { AcoesDaOrg } from "../org/Blocos";
import { PerfilDaOrg } from "../org/PerfilDaOrg";
import { Botao, LinkBotao } from "../ui/Botao";
import { Avatar } from "./Avatar";
import { useTextosDoPerfil } from "./useTextos";
import "../org/org.css";

interface Props {
  handle: string;
  lang: string;
  s: TextosDaRede;
  situacao: Situacao;
  aoResponder: (p: Post) => void;
}

/** A aba pedida no endereço (?aba=plenarias), lida uma vez ao abrir. */
function abaDoEndereco(): string | null {
  try {
    return new URLSearchParams(window.location.search).get("aba");
  } catch {
    return null;
  }
}

/** As ações do perfil de organização de verdade: o banco (lib/rede/cliente-org.ts). */
function acoesDoBanco(handle: string): AcoesDaOrg {
  return {
    seguir: (sim) => redeOrg.seguir(handle, sim),
    sino: (sim) => redeOrg.sino(handle, sim),
    entrarNoNucleo: (id) => redeOrg.entrarNoNucleo(id),
    votar: (consulta, ranking) => redeOrg.votar(consulta, ranking),
    perguntar: (plenaria, texto, mostrar) => redeOrg.perguntar(plenaria, texto, mostrar),
  };
}

export default function PerfilDaAlumia2({ handle, lang, s, situacao, aoResponder }: Props) {
  const [t, setT] = useState<TextosDaOrg | null>(null);
  const [estado, setEstado] = useState<{ handle: string; org: OrgPublica | null; pessoa: PerfilDaRede | null; extras: ExtrasDoPerfil | null; erro: string } | null>(null);

  useEffect(() => {
    let vivo = true;
    carregarTextosDaOrg(lang).then((x) => vivo && setT(x)).catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [lang]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const org = orgLigada() ? await redeOrg.org(handle).catch(() => null) : null;
        if (org) return vivo && setEstado({ handle, org, pessoa: null, extras: null, erro: "" });
        const [pessoa, extras] = await Promise.all([redePerfil.perfil(handle), redeOrg.extras(handle).catch(() => null)]);
        if (vivo) setEstado({ handle, org: null, pessoa, extras, erro: "" });
      } catch (e) {
        if (vivo) setEstado({ handle, org: null, pessoa: null, extras: null, erro: textoDoErro(s, e) });
      }
    })();
    return () => {
      vivo = false;
    };
  }, [handle, s]);

  if (!t || !estado || estado.handle !== handle) return <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={3} />;
  if (estado.org) {
    return (
      <PerfilDaOrg
        org={estado.org}
        t={t}
        lang={lang}
        acoes={acoesDoBanco(estado.org.handle)}
        membro={situacao.membro}
        abaInicial={abaDoEndereco()}
        posts={<Linha aba={`u:${estado.org.handle}`} lang={lang} s={s} logado={situacao.logado} aoResponder={aoResponder} />}
      />
    );
  }
  if (!estado.pessoa) {
    return (
      <div className="al-perfil al-painel" role="alert">
        <p className="al-painel-vazio">{estado.erro || s.estados.naoEncontrado}</p>
      </div>
    );
  }
  return <PerfilDePessoa dado={estado.pessoa} extras={estado.extras} t={t} lang={lang} s={s} situacao={situacao} aoResponder={aoResponder} />;
}

function PerfilDePessoa({ dado: inicial, extras, t, lang, s, situacao, aoResponder }: { dado: PerfilDaRede; extras: ExtrasDoPerfil | null; t: TextosDaOrg; lang: string; s: TextosDaRede; situacao: Situacao; aoResponder: (p: Post) => void }) {
  const tp = t.pessoa;
  const sp = useTextosDoPerfil(lang);
  const id = useId();
  const [dado, setDado] = useState(inicial);
  const [aba, setAba] = useState<AbaDaPessoa>("posts");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const capa = origemDaImagem(dado.capa, "capa");

  async function seguir(sim: boolean) {
    setOcupado(true);
    setErro("");
    try {
      const r = await redePerfil.seguir(dado.handle, sim);
      setDado((d) => ({ ...d, sigo: r.sigo, pendente: r.pendente }));
    } catch (e) {
      setErro(textoDoErro(s, e));
    } finally {
      setOcupado(false);
    }
  }

  const painel: Record<AbaDaPessoa, ReactNode> = {
    posts: (
      <>
        {dado.fixado ? <CartaoDePost post={dado.fixado} lang={lang} s={s} logado={situacao.logado} aoResponder={aoResponder} /> : null}
        <Linha aba={`u:${dado.handle}`} lang={lang} s={s} logado={situacao.logado} aoResponder={aoResponder} />
      </>
    ),
    respostas: <LinhaDaAba handle={dado.handle} aba="respostas" vazio={tp.vazio.respostas} lang={lang} s={s} situacao={situacao} aoResponder={aoResponder} />,
    midia: <LinhaDaAba handle={dado.handle} aba="midia" vazio={tp.vazio.midia} lang={lang} s={s} situacao={situacao} aoResponder={aoResponder} />,
  };

  return (
    <div className="al-perfil">
      <div className="al-perfil-capa">
        {capa ? (
          // eslint-disable-next-line @next/next/no-img-element -- padrão SVG do projeto ou WebP já reencodado.
          <img src={capa} alt="" aria-hidden width={900} height={300} decoding="async" className="al-perfil-capa-imagem" />
        ) : (
          <div aria-hidden className="al-perfil-capa-vazia" />
        )}
      </div>
      <header className="al-perfil-cabeca">
        <div className="al-perfil-linha1">
          <Avatar imagem={dado.avatar} codinome={dado.codinome} tamanho={72} />
          <div className="al-perfil-nomes">
            <h1 className="al-cond al-perfil-nome">{dado.codinome}</h1>
            <p className="al-perfil-handle">
              @{dado.handle}
              {extras?.pronomes ? <span className="al-perfil-pronomes"> · {extras.pronomes}</span> : null}
            </p>
          </div>
        </div>
        {extras?.status ? (
          <p className="al-perfil-status">
            <span>{tp.status[extras.status.tipo]}</span>
            {extras.status.texto ? <span>· {extras.status.texto}</span> : null}
            {extras.status.ate ? <span>· {preencher(tp.ate, { data: dataCurta(extras.status.ate, lang) })}</span> : null}
          </p>
        ) : null}
        {dado.bio ? <p className="al-perfil-bio">{dado.bio}</p> : null}
        <div className="al-perfil-acoes">
          {dado.meu ? (
            <LinkBotao href={enderecoDeEditarPerfil(lang)} variante="contorno">
              {sp?.perfil.editar ?? "…"}
            </LinkBotao>
          ) : dado.pendente ? (
            <Botao variante="contorno" disabled={ocupado} onClick={() => void seguir(false)}>
              {sp?.perfil.pedidoEnviado ?? "…"}
            </Botao>
          ) : (
            <Botao variante={dado.sigo ? "claro" : "primario"} pressionado={dado.sigo} disabled={ocupado || !situacao.membro} onClick={() => void seguir(!dado.sigo)}>
              {dado.sigo ? t.perfil.seguindo : dado.modo === "trancado" ? (sp?.perfil.pedirParaSeguir ?? t.perfil.seguir) : t.perfil.seguir}
            </Botao>
          )}
          {!dado.meu && situacao.logado && situacao.membro ? (
            <LinkBotao href={`${enderecos.linha(lang)}/conversas?com=${encodeURIComponent(dado.handle)}`} variante="contorno">
              {s.perfil.conversar}
            </LinkBotao>
          ) : null}
        </div>
        {dado.modo === "trancado" ? <p className="al-perfil-nota">{s.perfil.trancado}</p> : null}
        <p className="al-perfil-nota">{s.perfil.semContagens}</p>
        {erro ? (
          <p className="al-perfil-erro" role="alert">
            {erro}
          </p>
        ) : null}
      </header>

      {extras && extras.campos.length > 0 ? (
        <section className="al-perfil-bloco" aria-labelledby={`${id}-campos`}>
          <h2 id={`${id}-campos`} className="sr-only">
            {preencher(tp.campos, { codinome: dado.codinome })}
          </h2>
          <dl className="al-perfil-campos">
            {extras.campos.map((c) => {
              const link = c.valor.startsWith("https://") ? linkSeguro(c.valor) : null;
              return (
                <div key={c.rotulo} style={{ display: "contents" }}>
                  <dt>{c.rotulo}</dt>
                  <dd>
                    {link ? (
                      <a href={link} target="_blank" rel="noopener noreferrer nofollow me">
                        {c.valor.replace(/^https:\/\//, "")}
                      </a>
                    ) : (
                      c.valor
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      ) : null}

      {extras && extras.destaques.length > 0 ? (
        <section className="al-perfil-bloco" aria-labelledby={`${id}-destaques`}>
          <h2 id={`${id}-destaques`} className="al-cond">
            {tp.destaques}
          </h2>
          <ul className="al-perfil-destaques">
            {extras.destaques.map((d) => (
              <li key={d.id}>
                <Link href={d.href}>
                  <span>{tp.destaqueTipos[d.tipo]}</span>
                  {d.titulo}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Abas id={id} abas={ABAS_DA_PESSOA} atual={aba} aoMudar={setAba} rotulos={tp.abas} rotulo={preencher(tp.abas.rotulo, { codinome: dado.codinome })} />
      <div id={`${id}-painel`} role="tabpanel" aria-labelledby={`${id}-aba-${aba}`}>
        {painel[aba]}
      </div>
    </div>
  );
}

/** Respostas e Mídia: a página da função rede_perfil_linha, com "carregar mais" pelo cursor. */
function LinhaDaAba({ handle, aba, vazio, lang, s, situacao, aoResponder }: { handle: string; aba: "respostas" | "midia"; vazio: string; lang: string; s: TextosDaRede; situacao: Situacao; aoResponder: (p: Post) => void }) {
  const [pagina, setPagina] = useState<{ chave: string; dado: PaginaDaLinha } | null>(null);
  const [erro, setErro] = useState("");
  const [mais, setMais] = useState(false);
  const chave = `${handle}:${aba}`;

  useEffect(() => {
    let vivo = true;
    redeOrg
      .linhaDaPessoa(handle, aba)
      .then((dado) => vivo && setPagina({ chave: `${handle}:${aba}`, dado }))
      .catch((e) => vivo && setErro(textoDoErro(s, e)));
    return () => {
      vivo = false;
    };
  }, [handle, aba, s]);

  if (erro) return <p className="al-painel-vazio" role="alert">{erro}</p>;
  if (!pagina || pagina.chave !== chave) return <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={2} />;
  if (pagina.dado.itens.length === 0) return <p className="al-painel-vazio">{vazio}</p>;
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
              redeOrg
                .linhaDaPessoa(handle, aba, pagina.dado.proximo)
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
