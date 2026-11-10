// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import Link from "@/components/Link";
import { localePath } from "@/i18n/config";
import { rede } from "@/lib/rede/cliente";
import { comunidades } from "@/lib/rede/cliente-comunidades";
import { paginaDeExemplo, postsDeExemplo } from "@/lib/rede/conversa/exemplos";
import { preencher } from "@/lib/rede/preencher";
import { comReserva } from "@/lib/rede/reserva";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { TextosDaAlumia3 } from "@/lib/rede/textos-conversa";
import type { TextosDeComunidades } from "@/lib/rede/textos-comunidades";
import { enderecos, type Comunidade, type Post, type Situacao } from "@/lib/rede/tipos";
import { corDaComunidadeNova, enderecosCom, postsDaSemana, type PaginaDaComunidade, type SituacaoNaComunidade } from "@/lib/rede/tipos-comunidades";
import { totalVisivel } from "@/lib/rede/tipos-conversa";
import { ENCAIXES } from "../encaixes";
import { codigoDoErro, textoDoErro } from "../erros";
import { EsqueletoDaLinha } from "../Esqueletos";
import { useTextosMod } from "../moderacao/base";
import { FormularioDeDenuncia } from "../moderacao/FormularioDeDenuncia";
import { CartaoDeAula, Confirmar, FaixaDaPrevia, IconeAlfinete, IconeMais, IconeVoltar, PostCompacto, previa, Torradas, useTextosAlumia3, useTorrada } from "../conversa/base3";
import { MOLA_PULO, pular, semMovimento, useRegua } from "../conversa/movimento";

// As ferramentas da moderação só chegam ao navegador de quem modera (e só quando abre a aba Sobre).
const Moderar = dynamic(() => import("./Moderar"), { ssr: false });

type AbaDaComunidade = "posts" | "atos" | "aulas" | "sobre";

/**
 * A página da comunidade na Alumia nova (prancha celular-comunidade; PLANO-ALUMIA §3 e §8 F3): capa na cor da comunidade com
 * voltar e "…", o nome em Archivo condensada, a descrição, Entrar, Regras (n) e "N posts esta semana" (só posts, agregado, a
 * partir de 3: LGPD art. 5º, II, e art. 11, opinião política e filiação são dado sensível, por isso nunca quem escreveu nem
 * quantos membros); abas Posts, Atos (encaixe da F2), Aulas e Sobre; o post "Fixado pela moderação"; os posts compactos com
 * "N respostas · Acender · Salvar". Com NEXT_PUBLIC_ALUMIA_PREVIA=sim mostra os dados de exemplo da prancha.
 */
export function PaginaDaComunidadeAlumia({
  slug,
  lang,
  s,
  sc,
  situacao,
  aoEscrever,
  aoCarregar,
}: {
  slug: string;
  lang: string;
  s: TextosDaRede;
  sc: TextosDeComunidades;
  situacao: Situacao;
  aoEscrever: () => void;
  aoCarregar: (c: Comunidade) => void;
}) {
  const t = useTextosAlumia3(lang);
  const [estado, setEstado] = useState<{ slug: string; dado: PaginaDaComunidade | null; erro: string } | null>(null);
  const [versao, setVersao] = useState(0);
  const [aba, setAba] = useState<AbaDaComunidade>("posts");
  const [minha, setMinha] = useState<{ slug: string; valor: SituacaoNaComunidade } | null>(null);
  const torradas = useTorrada();
  const avisar = torradas.mostrar;
  const [ocupado, setOcupado] = useState(false);
  const [menu, setMenu] = useState(false);
  const [perguntaSair, setPerguntaSair] = useState(false);
  // A capa entra subindo só na primeira visita desta comunidade na sessão: voltar a ela (ou trocar de aba) não refaz a cascata.
  const [primeira] = useState(() => {
    try {
      const chave = `al3-capa:${slug}`;
      if (sessionStorage.getItem(chave)) return false;
      sessionStorage.setItem(chave, "1");
      return true;
    } catch {
      return true;
    }
  });
  const regrasRef = useRef<HTMLElement>(null);
  const maisRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const idDoMenu = useId();
  const idDoMotivo = useId();
  const abasRef = useRef<HTMLDivElement>(null);
  const entrarRef = useRef<HTMLButtonElement>(null);
  useRegua(abasRef, `${aba}:${t ? "t" : ""}:${estado?.dado ? "d" : ""}`);

  // O "…" é um disclosure (lista de botões, sem os papéis de menu): ao abrir, o foco vai para o primeiro item; Escape e clique
  // fora fecham e devolvem o foco a "Mais".
  useEffect(() => {
    if (!menu) return;
    menuRef.current?.querySelector<HTMLElement>("button, a")?.focus();
    const fora = (e: PointerEvent) => {
      const alvo = e.target as Node;
      if (!menuRef.current?.contains(alvo) && !maisRef.current?.contains(alvo)) setMenu(false);
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [menu]);
  function fecharMenu() {
    setMenu(false);
    maisRef.current?.focus();
  }

  useEffect(() => {
    let vivo = true;
    // rede_alumia_com_pagina (20261109-alumia-f3.sql): a página de hoje + "N posts esta semana", agregado e nulo abaixo de 3. Banco
    // sem a migração da F3 ainda (e SÓ nesse caso): cai na página de hoje, sem a contagem. Limite, conta suspensa, sem permissão e
    // não encontrada vão direto para a tela (lib/rede/reserva.ts), sem uma segunda chamada que gastaria a cota de novo.
    // Na prévia, a comunidade do slug (com nome, cor e descrição dela); slug que não existe: nulo, e a tela diz "não encontrada".
    const pedir = previa()
      ? Promise.resolve(paginaDeExemplo(slug))
      : comReserva(() => comunidades.paginaAlumia(slug), () => comunidades.pagina(slug));
    pedir
      .then((dado) => vivo && setEstado({ slug, dado, erro: "" }))
      // "Não encontrada" (não existe, é fechada para a pessoa): a tela própria de 404, a mesma nos dois casos (sem dizer qual).
      .catch((e) => vivo && setEstado({ slug, dado: null, erro: codigoDoErro(e) === "nao_encontrado" ? "" : textoDoErro(s, e) }));
    return () => {
      vivo = false;
    };
  }, [slug, versao, s]);

  const comunidade = estado?.slug === slug ? estado.dado?.comunidade : undefined;
  useEffect(() => {
    if (comunidade) aoCarregar(comunidade);
  }, [comunidade, aoCarregar]);

  const aoErro = useCallback((e: unknown) => avisar({ texto: textoDoErro(s, e), erro: true }), [s, avisar]);

  if (!t || !estado || estado.slug !== slug) return <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={3} />;
  // Comunidade que não existe (ou que a pessoa não pode ver): uma tela própria, com o caminho de volta, nunca a de outra.
  if (!estado.dado && !estado.erro) {
    return (
      <div className="al3 al3-nao-achou">
        <FaixaDaPrevia t={t} />
        <div className="al3-nao-achou-corpo">
          <p className="al3-nao-achou-sinal al3-cond" aria-hidden>404</p>
          <h1 className="al3-cond">{t.comunidade.naoEncontrada}</h1>
          <p>{t.comunidade.naoEncontradaTexto}</p>
          <Link href={enderecosCom.lista(lang)} className="al3-capa-acao al3-capa-acao-cheia al3-nao-achou-ir">{t.comunidade.verComunidades}</Link>
        </div>
      </div>
    );
  }
  if (!estado.dado || !comunidade) {
    return (
      <div className="al3 al3-vazio" role="alert">
        <p>{estado.erro || s.estados.naoEncontrado}</p>
        <button type="button" className="al-botao al-botao-contorno al-botao-m" onClick={() => setVersao((n) => n + 1)}>
          {s.estados.tentar}
        </button>
      </div>
    );
  }
  const dado = estado.dado;
  const situacaoAqui: SituacaoNaComunidade = minha?.slug === slug ? minha.valor : dado.situacao;
  const cor = corDaComunidadeNova(comunidade.slug, comunidade.cor);
  const semana = postsDaSemana(dado.posts_7d);
  const podeEntrar = situacao.logado && situacao.membro && !comunidade.banido;
  const podeEscrever = podeEntrar && (situacaoAqui === "membro" || comunidade.tipo === "aberta");
  const soConvite = comunidade.tipo === "fechada" && situacaoAqui !== "membro";
  // Por que não dá para entrar, em texto visível (o title não aparece no celular e um botão disabled não recebe foco).
  const motivo = !situacao.logado || !situacao.membro ? t.comunidade.entreNaAlumia : comunidade.banido ? s.comunidade.banido : soConvite ? t.comunidade.soConvite : null;
  const bloqueado = Boolean(motivo);
  const abaDosAtos = ENCAIXES.abasDaComunidade.find((a) => a.chave === "atos");

  async function entrarOuSair() {
    if (ocupado || !t || bloqueado) return;
    // Sair pergunta antes, na folha da Alumia (não no confirm do navegador, que não traduz os botões).
    if (situacaoAqui === "membro") return setPerguntaSair(true);
    await mudarParticipacao();
  }

  async function mudarParticipacao() {
    if (!t) return;
    const sair = situacaoAqui === "membro" || situacaoAqui === "pendente";
    setOcupado(true);
    try {
      const r = previa()
        ? { situacao: (sair ? null : comunidade!.tipo === "aberta" ? "membro" : "pendente") as SituacaoNaComunidade }
        : await (sair ? comunidades.sair(slug) : comunidades.entrar(slug));
      setMinha({ slug, valor: r.situacao });
      if (r.situacao === "membro") carimbar(entrarRef.current);
      else pular(entrarRef.current, 1.06);
      avisar({ texto: r.situacao === "membro" ? t.comunidade.entrou : r.situacao === "pendente" ? t.comunidade.pediu : t.comunidade.saiu });
    } catch (e) {
      aoErro(e);
    } finally {
      setOcupado(false);
    }
  }

  function verRegras() {
    setAba("sobre");
    setMenu(false);
    requestAnimationFrame(() => regrasRef.current?.focus());
  }

  async function copiarLink() {
    setMenu(false);
    try {
      await navigator.clipboard.writeText(new URL(enderecos.comunidade(lang, comunidade!.slug), window.location.origin).toString());
      avisar({ texto: t!.comum.copiado });
    } catch (e) {
      aoErro(e);
    }
  }

  const rotuloEntrar =
    situacaoAqui === "membro" ? t.comunidade.participa
    : situacaoAqui === "pendente" ? t.comunidade.pendente
    : comunidade.tipo === "aberta" ? t.comunidade.entrar
    : comunidade.tipo === "restrita" ? t.comunidade.pedir
    : t.comunidade.fechadaSo;
  // Todos os rótulos que este botão pode ter, para reservar a largura do maior.
  const rotulos = [...new Set([comunidade.tipo === "aberta" ? t.comunidade.entrar : comunidade.tipo === "restrita" ? t.comunidade.pedir : t.comunidade.fechadaSo, t.comunidade.participa, ...(comunidade.tipo === "aberta" ? [] : [t.comunidade.pendente]), rotuloEntrar])];
  const abas: [AbaDaComunidade, string][] = [
    ["posts", t.comunidade.posts],
    ["atos", t.comunidade.atos],
    ["aulas", t.comunidade.aulas],
    ["sobre", t.comunidade.sobre],
  ];

  return (
    <div className="al3 al3-comunidade">
      <FaixaDaPrevia t={t} />
      <header className="al3-capa" data-cor={cor} data-primeira={primeira ? "sim" : undefined}>
        <div className="al3-capa-topo">
          <Link href={enderecosCom.lista(lang)} className="al3-capa-botao" aria-label={t.comunidade.voltarLista}>
            <IconeVoltar />
          </Link>
          <button
            ref={maisRef}
            type="button"
            className="al3-capa-botao"
            aria-label={t.comunidade.mais}
            aria-expanded={menu}
            aria-controls={idDoMenu}
            onClick={() => setMenu((m) => !m)}
          >
            <IconeMais />
          </button>
          <div
            ref={menuRef}
            id={idDoMenu}
            className="al3-menu"
            hidden={!menu}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                fecharMenu();
              }
            }}
          >
            <button type="button" onClick={() => void copiarLink()}>{t.comunidade.copiarLink}</button>
            <button type="button" onClick={verRegras}>{t.comunidade.verRegras}</button>
            {podeEscrever && (
              <button type="button" onClick={() => (setMenu(false), aoEscrever())}>{t.comunidade.escreverAqui}</button>
            )}
            {dado.modero && (
              <button type="button" onClick={() => (setMenu(false), setAba("sobre"))}>{t.comunidade.cuidar}</button>
            )}
          </div>
        </div>
        <h1 className="al3-cond">{comunidade.nome}</h1>
        {comunidade.descricao && <p className="al3-capa-descricao">{comunidade.descricao}</p>}
        <div className="al3-capa-acoes">
          {!situacao.logado || !situacao.membro ? (
            <Link href={enderecos.linha(lang)} className="al3-capa-acao al3-capa-acao-cheia" aria-describedby={idDoMotivo}>
              {t.comunidade.entrarNaAlumia}
            </Link>
          ) : (
            <button
              ref={entrarRef}
              type="button"
              className="al3-capa-acao al3-capa-acao-cheia"
              aria-pressed={situacaoAqui === "membro" || situacaoAqui === "pendente"}
              aria-disabled={ocupado || bloqueado ? "true" : undefined}
              aria-describedby={motivo ? idDoMotivo : undefined}
              onClick={() => void entrarOuSair()}
            >
              {/* Os rótulos possíveis empilhados na mesma célula: o botão tem desde o início a largura do maior, e nada pula ao trocar. */}
              <span className="al3-rotulos">
                {rotulos.map((r) => (
                  <span key={r} data-vale={r === rotuloEntrar ? "sim" : undefined} aria-hidden={r !== rotuloEntrar ? true : undefined}>
                    {r === t.comunidade.participa && <IconeCheck />}
                    {r}
                  </span>
                ))}
              </span>
            </button>
          )}
          <button type="button" className="al3-capa-acao al3-capa-acao-contorno" onClick={verRegras}>
            {preencher(t.comunidade.regras, { n: comunidade.regras.length })}
          </button>
          {/* Sem o campo (banco ainda sem a F3), nada: "poucos" seria afirmar o que não se sabe. */}
          {dado.posts_7d !== undefined && (
            <p className="al3-capa-semana" title={t.comunidade.semanaRegra}>
              {semana === null ? t.comunidade.semanaPoucos : preencher(t.comunidade.semana, { n: semana.toLocaleString(lang) })}
            </p>
          )}
        </div>
        {motivo && <p className="al3-capa-aviso" id={idDoMotivo}>{motivo}</p>}
        {dado.modero && Boolean(dado.pedidos) && <p className="al3-capa-aviso">{preencher(t.comunidade.pedidos, { n: dado.pedidos ?? 0 })}</p>}
      </header>
      <Torradas estado={torradas} />
      <Confirmar
        aberto={perguntaSair}
        titulo={preencher(t.comunidade.sairTitulo, { nome: comunidade.nome })}
        texto={t.comunidade.sairTexto}
        sim={t.comunidade.sim}
        nao={t.comunidade.nao}
        aoSim={() => void mudarParticipacao()}
        aoFechar={() => setPerguntaSair(false)}
        voltarPara={entrarRef}
      />

      <div className={`al3-cor-${cor}`}>
        <div role="tablist" aria-label={t.comunidade.abas} className="al3-abas" ref={abasRef}>
          <span className="al3-abas-linha" aria-hidden />
          {abas.map(([chave, rotulo]) => (
            <button
              key={chave}
              type="button"
              role="tab"
              id={`al3-aba-${chave}`}
              aria-controls={`al3-painel-${chave}`}
              aria-selected={aba === chave}
              tabIndex={aba === chave ? 0 : -1}
              className="al3-aba"
              onClick={() => setAba(chave)}
              onKeyDown={(e) => {
                const i = abas.findIndex(([c]) => c === chave);
                const prox =
                  e.key === "ArrowRight" ? abas[(i + 1) % abas.length]
                  : e.key === "ArrowLeft" ? abas[(i + abas.length - 1) % abas.length]
                  : e.key === "Home" ? abas[0]
                  : e.key === "End" ? abas[abas.length - 1]
                  : null;
                if (prox) {
                  e.preventDefault();
                  setAba(prox[0]);
                  document.getElementById(`al3-aba-${prox[0]}`)?.focus();
                }
              }}
            >
              {rotulo}
            </button>
          ))}
        </div>

        <div role="tabpanel" id="al3-painel-posts" aria-labelledby="al3-aba-posts" hidden={aba !== "posts"} className="al3-painel">
          {aba === "posts" && (
            <>
              {dado.fixados.map((p) => (
                <section key={p.id} className="al3-fixado" aria-label={t.comunidade.fixado}>
                  <p className="al3-fixado-rotulo">
                    <IconeAlfinete />
                    {t.comunidade.fixado}
                  </p>
                  <h2>
                    <Link href={enderecos.post(lang, p.id)}>{p.titulo || p.texto.slice(0, 90)}</Link>
                  </h2>
                  {p.titulo && <p className="al3-fixado-texto">{p.texto}</p>}
                </section>
              ))}
              <PostsDaComunidade key={`${slug}:${versao}`} slug={slug} lang={lang} t={t} logado={situacao.logado} aoErro={aoErro} s={s} />
            </>
          )}
        </div>
        <div role="tabpanel" id="al3-painel-atos" aria-labelledby="al3-aba-atos" hidden={aba !== "atos"} className="al3-painel">
          {aba === "atos" &&
            (abaDosAtos ? (
              <abaDosAtos.Componente lang={lang} s={s} situacao={situacao} slug={slug} />
            ) : (
              <div className="al3-vazio">
                <p>{t.comunidade.atosVazio}</p>
                <p className="al3-regra">{t.comunidade.atosDica}</p>
              </div>
            ))}
        </div>
        <div role="tabpanel" id="al3-painel-aulas" aria-labelledby="al3-aba-aulas" hidden={aba !== "aulas"} className="al3-painel">
          {aba === "aulas" &&
            (comunidade.aulas.length + comunidade.trilhas.length === 0 ? (
              <p className="al3-vazio">{t.comunidade.aulasVazio}</p>
            ) : (
              <div className="al3-secao al3-aulas">
                {comunidade.aulas.map((a) => {
                  const [trilha, aula] = a.split("/");
                  return (
                    <div key={a} className="al3-aula-com-conversa">
                      <CartaoDeAula lang={lang} t={t} cita={{ tipo: "aula", caminho: `/trilhas/${a}`, titulo: "" }} />
                      <Link href={enderecosCom.aula(lang, trilha, aula, comunidade.slug)} className="al3-aula-discutir">
                        {t.comunidade.discutir}
                        <span aria-hidden> →</span>
                      </Link>
                    </div>
                  );
                })}
                {comunidade.trilhas.map((tr) => (
                  <CartaoDeAula key={tr} lang={lang} t={t} cita={{ tipo: "materia", caminho: `/trilhas/${tr}`, titulo: "" }} />
                ))}
              </div>
            ))}
        </div>
        <div role="tabpanel" id="al3-painel-sobre" aria-labelledby="al3-aba-sobre" hidden={aba !== "sobre"} className="al3-painel">
          {aba === "sobre" && (
            <div>
              <section className="al3-secao" ref={regrasRef} tabIndex={-1} aria-labelledby="al3-regras">
                <h2 id="al3-regras" className="al3-cond">{t.comunidade.regrasTitulo}</h2>
                <ol className="al3-regras">
                  {comunidade.regras.map((r) => (
                    <li key={r.numero}>
                      <span>
                        <strong>{r.titulo}</strong>
                        {r.texto && <span className="al3-cinza-2"> {r.texto}</span>}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
              <section className="al3-secao">
                <h2 className="al3-cond">{t.comunidade.tipo}</h2>
                <p className="al3-cinza-2">{comunidade.tipo === "aberta" ? sc.tipo.aberta : comunidade.tipo === "restrita" ? sc.tipo.restrita : sc.tipo.fechada}</p>
              </section>
              {comunidade.etiquetas.length > 0 && (
                <section className="al3-secao">
                  <h2 className="al3-cond">{t.comunidade.etiquetas}</h2>
                  <ul className="al3-etiquetas">
                    {comunidade.etiquetas.map((e) => (
                      <li key={e.nome}>{e.nome}</li>
                    ))}
                  </ul>
                </section>
              )}
              <section className="al3-secao">
                <h2 className="al3-cond">{t.comunidade.moderacao}</h2>
                <MuralDaModeracao comunidade={comunidade} lang={lang} s={s} t={t} logado={situacao.logado && situacao.membro} />
              </section>
              {dado.modero && !previa() && (
                <section className="al3-secao al3-tela" aria-label={t.comunidade.cuidar}>
                  <h2 className="al3-cond">{t.comunidade.cuidar}</h2>
                  <Moderar comunidade={comunidade} s={s} sc={sc} aoMudar={() => setVersao((n) => n + 1)} />
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Os posts da comunidade (a linha "c:<slug>", em ordem de chegada), compactos como na prancha, com "Carregar mais". */
function PostsDaComunidade({ slug, lang, t, s, logado, aoErro }: { slug: string; lang: string; t: TextosDaAlumia3; s: TextosDaRede; logado: boolean; aoErro: (e: unknown) => void }) {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [buscando, setBuscando] = useState(false);

  const buscar = useCallback(
    async (depois: string | null) => {
      setBuscando(true);
      setErro("");
      try {
        if (previa()) {
          setPosts(postsDeExemplo(slug));
          setCursor(null);
        } else {
          const r = await rede.linha(`c:${slug}`, depois);
          setPosts((atual) => [...(depois ? atual ?? [] : []), ...r.itens]);
          setCursor(r.proximo);
        }
      } catch (e) {
        setErro(textoDoErro(s, e));
      } finally {
        setBuscando(false);
      }
    },
    [slug, s],
  );

  useEffect(() => {
    const id = setTimeout(() => void buscar(null), 0);
    return () => clearTimeout(id);
  }, [buscar]);

  if (posts === null && !erro) return <EsqueletoDaLinha rotulo={t.comum.carregando} quantos={2} />;
  return (
    <section aria-label={t.comunidade.posts} aria-busy={buscando}>
      {erro && (
        <p className="al3-aviso" role="alert">
          {erro}{" "}
          <button type="button" className="al3-acao" onClick={() => void buscar(null)}>{t.comum.tentar}</button>
        </p>
      )}
      {posts && posts.length === 0 && <p className="al3-vazio">{t.comunidade.vazio}</p>}
      {posts?.map((p, i) => (
        <div key={p.id} className="al3-post-entra" style={{ "--i": i } as CSSProperties}>
          <PostCompacto post={p} lang={lang} s={s} t={t} logado={logado} aoErro={aoErro} />
        </div>
      ))}
      {cursor && (
        <div className="al3-mais">
          <button type="button" className="al-botao al-botao-contorno al-botao-m" disabled={buscando} onClick={() => void buscar(cursor)}>
            {t.comum.carregarMais}
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * Quem modera, sem lista de pessoas: só quantas (a partir de 3; abaixo, "poucas") e um canal para falar com a moderação. Uma lista
 * de codinomes ligada a uma comunidade política diz a opinião e a filiação de cada pessoa, que são dado sensível (LGPD art. 5º,
 * II, e art. 11), e faz de quem cuida um alvo. O canal é a denúncia da comunidade com protocolo (categoria "outro"), que chega à
 * fila da moderação sem expor nomes de nenhum dos lados.
 */
function MuralDaModeracao({ comunidade, lang, s, t, logado }: { comunidade: Comunidade; lang: string; s: TextosDaRede; t: TextosDaAlumia3; logado: boolean }) {
  const [aberto, setAberto] = useState(false);
  const sm = useTextosMod(lang, aberto);
  const n = totalVisivel(comunidade.moderacao.length);
  return (
    <>
      <p className="al3-cinza-2">{n === null ? t.comunidade.moderadaPoucas : preencher(t.comunidade.moderadaPor, { n })}</p>
      {logado ? (
        <button type="button" className="al3-capa-acao al3-capa-acao-contorno al3-falar" aria-expanded={aberto} onClick={() => setAberto((a) => !a)}>
          {t.comunidade.falarModeracao}
        </button>
      ) : (
        <Link href={localePath(lang, "/denunciar")} className="al3-capa-acao al3-capa-acao-contorno al3-falar">{t.comunidade.falarModeracao}</Link>
      )}
      {aberto && !sm && <p className="al3-cinza" role="status">{t.comum.carregando}</p>}
      {aberto && sm && (
        <div className="al3-tela al3-falar-form">
          <FormularioDeDenuncia lang={lang} s={s} sm={sm} alvoTipo="comunidade" alvo={comunidade.slug} aoFechar={() => setAberto(false)} />
        </div>
      )}
    </>
  );
}

/** O "Participando": um carimbo (cresce, gira um tico e assenta) em vez do pulo pequeno; parado para quem pediu menos movimento. */
function carimbar(el: HTMLElement | null) {
  if (!el || typeof el.animate !== "function" || semMovimento()) return;
  el.animate(
    [
      { transform: "scale(1.16) rotate(-4deg)" },
      { transform: "scale(0.97) rotate(1deg)", offset: 0.55 },
      { transform: "none" },
    ],
    { duration: 560, easing: MOLA_PULO },
  );
}

function IconeCheck() {
  return (
    <svg className="al3-check" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}
