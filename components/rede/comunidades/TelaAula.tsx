// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "@/components/Link";
import { comunidades } from "@/lib/rede/cliente-comunidades";
import { enderecos, slugOk, type Post } from "@/lib/rede/tipos";
import { aulaOk } from "@/lib/rede/tipos-comunidades";
import { CartaoDePost } from "../CartaoDePost";
import { EsqueletoDaLinha } from "../Esqueletos";
import type { PropsDaTelaDoPacote } from "../registro";
import { Compositor } from "./Compositor";
import { erroCom, textosDe, useCarregar } from "./util";
import { conquistas } from "../estudo/conquistas/cliente";
import type { TopicoDaAula } from "../estudo/conquistas/regras";
import { useNomesDasTrilhas, useTituloDaAula } from "../estudo/conquistas/usarNomesDasTrilhas";
import { previaLigada } from "@/lib/rede/publicar/alumia2";
import { useTextosDasConquistas } from "../estudo/conquistas/usarTextos";
// O visual novo (só com "rede-v2" + "alumia-2": a folha só vale dentro de [data-al="2"]).
import "../conversa/alumia3.css";
import "../estudo/conquistas/conquistas.css";

/**
 * "Discutir na Alumia" (R4, item 38; onda 11, L2-50): o tópico de uma aula na comunidade da disciplina. O tópico é o primeiro post
 * ligado à aula que a pessoa pode ver (public.alumia_aula_topico): se existe, o botão grande abre ele; se não, quem chega primeiro
 * começa pelo compositor de sempre (o post é publicado na comunidade e ligado à aula em seguida) e quem vem depois cai nele. Embaixo,
 * as outras conversas ligadas à aula (a visibilidade de cada uma vem do banco), e os caminhos de volta à aula e à comunidade.
 * Parâmetros: `track`, `lesson` e `c` (a comunidade, vinda do botão da aula).
 */
export default function TelaAula({ lang, s, situacao, params, aoEscrever }: PropsDaTelaDoPacote) {
  const sc = textosDe(s);
  const trilha = params.track ?? "";
  const aulaSlug = params.lesson ?? "";
  const comunidade = params.c ?? "";
  const aula = `${trilha}/${aulaSlug}`;
  const valido = aulaOk(aula) && slugOk(comunidade);
  const pagina = useCarregar(() => (valido ? comunidades.pagina(comunidade) : Promise.reject(new Error("invalido"))), `aula-pagina:${comunidade}`);
  const [itens, setItens] = useState<Post[]>([]);
  const [proximo, setProximo] = useState<string | null>(null);
  const [estado, setEstado] = useState<"carregando" | "ok" | "erro">("carregando");
  const [falha, setFalha] = useState("");
  const [escrevendo, setEscrevendo] = useState(false);
  const [versao, setVersao] = useState(0);
  const [membroLocal, setMembroLocal] = useState(false);
  const tq = useTextosDasConquistas(lang);
  const trilhas = useNomesDasTrilhas(lang);
  const tituloDaAula = useTituloDaAula(lang, trilha, aulaSlug);
  const [entrando, setEntrando] = useState<"" | "indo" | "pendente" | "erro">("");
  const [topico, setTopico] = useState<{ chave: string; dado: TopicoDaAula | null } | null>(null);
  const chaveDoTopico = `${comunidade}|${aula}|${versao}`;

  useEffect(() => {
    if (!valido) return;
    let vivo = true;
    conquistas
      .topico(comunidade, aula)
      .then((dado) => vivo && setTopico({ chave: chaveDoTopico, dado }))
      .catch(() => vivo && setTopico({ chave: chaveDoTopico, dado: null }));
    return () => {
      vivo = false;
    };
  }, [valido, comunidade, aula, chaveDoTopico]);

  useEffect(() => {
    if (!valido || !sc) return;
    let vivo = true;
    // Na prévia sem banco, a lista da aula vem vazia (nada de erro embaixo do tópico).
    (previaLigada() ? Promise.resolve({ itens: [] as Post[], proximo: null }) : comunidades.linhaDaAula(comunidade, aula, null, 20))
      .then((r) => {
        if (!vivo) return;
        setItens(r.itens);
        setProximo(r.proximo);
        setEstado("ok");
      })
      .catch((e) => {
        if (!vivo) return;
        setFalha(erroCom(s, sc, e));
        setEstado("erro");
      });
    return () => {
      vivo = false;
    };
  }, [valido, comunidade, aula, versao, s, sc]);

  const maisPosts = useCallback(async () => {
    if (!proximo) return;
    try {
      const r = await comunidades.linhaDaAula(comunidade, aula, proximo, 20);
      setItens((l) => [...l, ...r.itens.filter((n) => !l.some((x) => x.id === n.id))]);
      setProximo(r.proximo);
    } catch (e) {
      if (sc) setFalha(erroCom(s, sc, e));
    }
  }, [proximo, comunidade, aula, s, sc]);

  if (!sc) return <p className="px-[18px] py-8 font-sans text-ink-soft">{s.estados.emBreve}</p>;
  if (!valido) return <p role="alert" className="px-[18px] py-8 font-sans text-ink-soft">{s.estados.naoEncontrado}</p>;
  const a = sc.aula;
  // O título de verdade (com acento) da lista do site; o fim do endereço só se a lista não chegar.
  const nomeDaAula = tituloDaAula ?? aulaSlug.replace(/-/g, " ");
  const resumo = pagina.dado;
  const pode = situacao.logado && situacao.membro;
  const dentro = membroLocal || resumo?.situacao === "membro" || resumo?.comunidade.tipo === "aberta";
  const slugReal = resumo?.comunidade.slug ?? comunidade;
  const topicoPronto = topico?.chave === chaveDoTopico;
  const idDoTopico = topicoPronto ? (topico.dado?.id ?? null) : null;

  return (
    <div className="al3-tela font-sans">
      <header className="border-b border-rule px-[18px] py-4">
        <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">{a.titulo} · {trilhas.nome(trilha)}</p>
        {tituloDaAula === undefined ? (
          <p className="mt-2 h-7 w-2/3 animate-pulse rounded bg-parchment-deep" aria-hidden />
        ) : (
          <h1 className={`mt-1 font-serif text-2xl font-extrabold ${tituloDaAula ? "" : "capitalize"}`}>{nomeDaAula}</h1>
        )}
        <p className="mt-1 text-sm text-ink-soft">{a.intro}</p>
        <p className="mt-2 flex flex-wrap gap-x-4 text-sm font-bold">
          <Link href={`/${lang}/trilhas/${trilha}/${aulaSlug}`} className="inline-flex min-h-11 items-center underline">{a.voltar}</Link>
          <Link href={enderecos.comunidade(lang, slugReal)} className="inline-flex min-h-11 items-center underline">{a.comunidade}</Link>
        </p>
        {tq && topicoPronto && idDoTopico && (
          <div className="cq-topico">
            <p className="cq-topico-carimbo cq-cond">{tq.aula.topicoCarimbo}</p>
            {topico.dado?.titulo && <p className="cq-topico-titulo">{topico.dado.titulo}</p>}
            <p>
              <Link href={enderecos.post(lang, idDoTopico)} className="al-botao al-botao-primario al-botao-m">{tq.aula.abrirTopico}</Link>
            </p>
          </div>
        )}
        {tq && topicoPronto && !idDoTopico && (
          <div className="cq-topico">
            <p className="cq-topico-carimbo cq-cond">{tq.aula.topicoCarimbo}</p>
            <p className="text-sm text-ink-soft">{tq.aula.semTopico}</p>
            {pode && dentro && !escrevendo && (
              <p>
                <button type="button" onClick={() => setEscrevendo(true)} className="al-botao al-botao-primario al-botao-m">
                  {tq.aula.criarTopico}
                </button>
              </p>
            )}
            {/* Sem poder começar: o que falta, com o caminho. */}
            {pode && resumo && !dentro && (
              entrando === "pendente" ? (
                <p role="status" className="text-sm font-semibold">{sc.acao.pendente}</p>
              ) : (
                <>
                  <p className="text-sm">{a.entrarNaComunidade}</p>
                  <p>
                    <button
                      type="button"
                      disabled={entrando === "indo"}
                      aria-busy={entrando === "indo" || undefined}
                      onClick={async () => {
                        setEntrando("indo");
                        try {
                          const r = await comunidades.entrar(slugReal);
                          if (r.situacao === "membro") {
                            setMembroLocal(true);
                            setEntrando("");
                          } else setEntrando("pendente");
                        } catch {
                          setEntrando("erro");
                        }
                      }}
                      className="al-botao al-botao-primario al-botao-m"
                    >
                      {entrando === "indo" ? sc.acao.trabalhando : resumo.comunidade.tipo === "aberta" ? sc.acao.entrar : sc.acao.pedir}
                    </button>
                  </p>
                  {entrando === "erro" && <p role="alert" className="text-sm">{s.estados.erro}</p>}
                </>
              )
            )}
            {pode && !resumo && pagina.pronto && !previaLigada() && (
              <>
                <p role="alert" className="text-sm">{s.estados.erro}</p>
                <p>
                  <button type="button" onClick={pagina.recarregar} className="al-botao al-botao-contorno al-botao-m">{s.estados.tentar}</button>
                </p>
              </>
            )}
            {!pode && <p className="text-sm">{sc.acao.entrePrimeiro}</p>}
          </div>
        )}
        {!pode && !(tq && topicoPronto && !idDoTopico) && <p className="mt-3 text-sm text-ink-soft">{sc.acao.entrePrimeiro}</p>}
      </header>
      {escrevendo && pode && (
        <Compositor
          s={s}
          sc={sc}
          destino={{ comunidade: slugReal }}
          aoCancelar={() => setEscrevendo(false)}
          aoPublicar={async (post) => {
            await comunidades.ligarAula(post.id, aula, nomeDaAula);
            setMembroLocal(true);
            setEscrevendo(false);
            setVersao((n) => n + 1);
          }}
        />
      )}
      {estado === "carregando" ? (
        <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={3} />
      ) : estado === "erro" ? (
        <p role="alert" className="px-[18px] py-8 text-ink-soft">{falha}</p>
      ) : itens.length === 0 ? (
        <p className="px-[18px] py-8 text-ink-soft">{a.vazio}</p>
      ) : (
        <div>
          {tq && <h2 className="cq-cond px-[18px] pt-5 pb-1 text-lg">{tq.aula.outros}</h2>}
          {itens.map((p) => (
            <CartaoDePost key={p.id} post={p} lang={lang} s={s} logado={situacao.logado} aoResponder={(post) => aoEscrever(post)} />
          ))}
          {proximo && (
            <button type="button" onClick={maisPosts} className="m-4 min-h-11 cursor-pointer rounded-full border border-ink px-4 font-bold hover:bg-parchment-deep">{s.estados.maisPosts}</button>
          )}
        </div>
      )}
    </div>
  );
}
