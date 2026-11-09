// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { rede } from "@/lib/rede/cliente";
import { comunidades as clienteComunidades } from "@/lib/rede/cliente-comunidades";
import { previaLigada, type CorDaComunidadeNum } from "@/lib/rede/publicar/alumia2";
import { COMUNIDADES_DE_EXEMPLO, SITUACAO_DE_EXEMPLO } from "@/lib/rede/publicar/exemplos-alumia2";
import { alumia2Ligada } from "@/lib/rede/rotas-novas";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { Aba, Comunidade, Post, Situacao, Tela } from "@/lib/rede/tipos";
import { Casca, type ItemDoMenu } from "./Casca";
import { PortaDaEntrada } from "./descoberta/PortaDaEntrada";
import { Entrada } from "./Entrada";
import { textoDoErro } from "./erros";
import { Escrever } from "./Escrever";
import { Linha } from "./Linha";
import { REGISTRO } from "./registro";
import { TelaDaComunidade, TelaDoPerfil } from "./Telas";
import { EsqueletoDaLinha } from "./Esqueletos";
import { CascaDaAlumia2, type TipoAoEscrever } from "./publicar/alumia2/CascaDaAlumia2";
import { ProvedorAlumia2, type ContextoAlumia2 } from "./publicar/alumia2/contexto";
import { EscreverDaAlumia2 } from "./publicar/alumia2/EscreverDaAlumia2";
import { useTextosAlumia2 } from "./publicar/alumia2/textos";
import { TopoDaLinha2 } from "./publicar/alumia2/TopoDaLinha2";
import { corDaComunidade } from "./ui/Pilula";

// A cara nova (flags "rede-v2" + "alumia-2", lidas na montagem) e a prévia com dados de exemplo (NEXT_PUBLIC_ALUMIA_PREVIA=sim).
const AL2 = alumia2Ligada();
const PREVIA = AL2 && previaLigada();

// A conversa em árvore (pacote conversa) só chega ao navegador quando um post é aberto.
const TelaDaConversa = dynamic(() => import("./conversa/TelaDaConversa"), { ssr: false, loading: () => <EsqueletoDaLinha rotulo="…" quantos={3} /> });

const ABAS_DO_MEMBRO: Aba[] = ["seguindo", "comunidades", "tudo", "geral"];

/** A aba pedida no endereço (?aba=), se o idioma da pessoa pode usá-la; senão a de sempre. */
function abaInicial(membro: boolean): Aba {
  try {
    const pedida = new URLSearchParams(window.location.search).get("aba");
    if (pedida && (ABAS_DO_MEMBRO as string[]).includes(pedida) && (membro || pedida === "geral")) return pedida as Aba;
  } catch {
    // sem endereço legível: vale o padrão
  }
  // Na cara nova (alumia-2), a aba das pranchas é "Seguindo"; na de hoje, "Tudo".
  return membro ? (AL2 ? "seguindo" : "tudo") : "geral";
}

/**
 * A Rede Lúcia v2, inteira, carregada sob demanda (components/rede/RedeSobDemanda.tsx). Descobre onde a pessoa está (visitante,
 * conta sem entrar na Rede, membro), mostra a casca e, dentro dela, a tela da rota: linha com as quatro abas, post, comunidade
 * ou perfil. Escrever abre em tela cheia no celular. Quem chega com ?t= ou ?sala= (endereços do Fórum antigo) e não foi
 * redirecionado pelo servidor é levado ao endereço novo daqui mesmo.
 */
export default function Rede({ lang, s, tela }: { lang: string; s: TextosDaRede; tela: Tela }) {
  // Prévia: a Faísca das pranchas (nada vai ao banco; os posts de exemplo têm id "exemplo-…").
  const [situacao, setSituacao] = useState<Situacao | null>(PREVIA ? SITUACAO_DE_EXEMPLO : null);
  const [falha, setFalha] = useState("");
  const [escrevendo, setEscrevendo] = useState<{ respostaA: Post | null; comunidade: Comunidade | null; texto?: string; tipo?: TipoAoEscrever } | null>(null);
  // Alumia nova: os textos dela (só baixados com a flag ligada) e o nome e a cor das comunidades para as pílulas do cartão.
  const t2 = useTextosAlumia2(lang, AL2);
  const [nomesDasComunidades, setNomesDasComunidades] = useState<ContextoAlumia2["comunidades"]>(() =>
    PREVIA ? Object.fromEntries(Object.entries(COMUNIDADES_DE_EXEMPLO).map(([k, c]) => [k, { nome: c.nome, cor: c.cor }])) : {},
  );
  const [aba, setAba] = useState<Aba | null>(null);
  const [recarregar, setRecarregar] = useState(0);
  const [comunidade, setComunidade] = useState<Comunidade | null>(null);

  useEffect(() => {
    if (!AL2 || PREVIA) return;
    let vivo = true;
    clienteComunidades.lista().then(
      (r) => vivo && setNomesDasComunidades(Object.fromEntries(r.itens.map((c) => [c.slug, { nome: c.nome, cor: corDaComunidade(c.slug) as CorDaComunidadeNum }]))),
      () => undefined,
    );
    return () => {
      vivo = false;
    };
  }, []);
  const contexto2 = useMemo<ContextoAlumia2 | null>(() => (AL2 && t2 ? { t: t2, previa: PREVIA, comunidades: nomesDasComunidades } : null), [t2, nomesDasComunidades]);

  useEffect(() => {
    let vivo = true;
    if (PREVIA) return;
    rede
      .situacao()
      .then((x) => vivo && setSituacao(x))
      .catch((e) => {
        if (!vivo) return;
        setFalha(textoDoErro(s, e));
        setSituacao({ logado: false, membro: false, regras_versao: 1 });
      });
    return () => {
      vivo = false;
    };
  }, [s]);

  // Endereços antigos do Fórum: o servidor já redireciona (301); isto só pega o que passou por fora dele.
  useEffect(() => {
    if (tela.tipo !== "linha") return;
    const q = new URLSearchParams(window.location.search);
    const t = q.get("t");
    const sala = q.get("sala");
    const pedido = t ? rede.antigo("topico", t) : sala ? rede.antigo("sala", sala) : null;
    pedido
      ?.then((r) => {
        if (r) window.location.replace(r.tipo === "post" ? `/${lang}/alumia/p/${r.novo}` : `/${lang}/alumia/c/${r.novo}`);
      })
      .catch(() => undefined);
  }, [lang, tela.tipo]);

  const aoComunidade = useCallback((c: Comunidade) => setComunidade(c), []);
  const aoResponder = useCallback((post: Post) => setEscrevendo({ respostaA: post, comunidade: null }), []);

  const aberta = situacao;
  const doPacote = tela.tipo === "pacote" ? REGISTRO[tela.nome] : undefined;
  const ativo: ItemDoMenu = doPacote ? doPacote.menu : tela.tipo === "perfil" ? "perfil" : tela.tipo === "comunidade" || (tela.tipo === "linha" && aba === "comunidades") ? "comunidades" : "inicio";
  const aoEscrever = (respostaA: Post | null = null) => setEscrevendo({ respostaA, comunidade: tela.tipo === "comunidade" && !respostaA ? comunidade : null });
  const aoEscrever2 = (tipo?: TipoAoEscrever) => setEscrevendo({ respostaA: null, comunidade: tela.tipo === "comunidade" ? comunidade : null, tipo });
  const pode = Boolean(aberta?.logado && aberta.membro);
  const abaAtual: Aba = aba ?? abaInicial(Boolean(aberta?.membro));

  // Com a flag ligada e os textos ainda a caminho, o esqueleto (nada pula quando chegam).
  if (AL2 && !contexto2) return <Casca lang={lang} s={s} situacao={null} ativo={ativo} aoEscrever={aoEscrever}>{null}</Casca>;
  const CascaDaVez = contexto2 ? CascaDaAlumia2 : Casca;
  const conteudo = (
    <CascaDaVez lang={lang} s={s} situacao={aberta} ativo={ativo} aoEscrever={contexto2 ? aoEscrever2 : () => aoEscrever()}>
      {aberta && (
        <>
          {falha && <p role="alert" className="px-[18px] py-3 font-sans text-oxblood">{falha}</p>}
          {/* Conta ou visitante que ainda não entrou na Rede: a primeira entrada vem antes; as dúvidas abertas seguem visíveis. */}
          {aberta.logado ? (
            <PortaDaEntrada lang={lang} s={s} situacao={aberta} aoSituacao={setSituacao} alternativa={!pode ? <Entrada s={s} lang={lang} situacao={aberta} aoEntrar={setSituacao} /> : null} />
          ) : (
            <Entrada s={s} lang={lang} situacao={aberta} aoEntrar={setSituacao} />
          )}

          {tela.tipo === "linha" && contexto2 && (
            <>
              <TopoDaLinha2 lang={lang} situacao={aberta} abas={pode ? ABAS_DO_MEMBRO.filter((a) => a !== "geral") : ["geral"]} aba={abaAtual === "geral" && pode ? "tudo" : abaAtual} aoAba={setAba} aoEscrever={aoEscrever2} />
              <Linha
                key={`${abaAtual}:${recarregar}`}
                aba={abaAtual === "geral" && pode ? "tudo" : abaAtual}
                lang={lang}
                s={s}
                logado={aberta.logado}
                aoResponder={aoResponder}
                vazio={abaAtual === "seguindo" ? s.estados.vazioSeguindo : abaAtual === "comunidades" ? s.estados.vazioComunidades : undefined}
                aoEscreverCom={pode ? (texto) => setEscrevendo({ respostaA: null, comunidade: null, texto }) : undefined}
              />
            </>
          )}
          {tela.tipo === "linha" && !contexto2 && (
            <>
              {/* "O que você quer contar?" no alto da linha (como no Mastodon e no Bluesky): abre a mesma caixa de escrever. */}
              {pode && (
                <button
                  type="button"
                  onClick={() => aoEscrever()}
                  className="mx-3 mt-3 flex min-h-12 w-[calc(100%-1.5rem)] cursor-text items-center gap-3 rounded-full border-[1.5px] border-rule bg-folha px-4 text-left font-sans text-ink-soft hover:border-ink"
                >
                  <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-[#c21f16]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />
                  </svg>
                  <span className="truncate">{s.visual.escreverConvite}</span>
                </button>
              )}
              <div role="tablist" aria-label={s.abas.rotulo} className="alumia-abas sticky top-[var(--altura-topo,0px)] z-10 mt-2 flex gap-1 border-b border-rule px-3 py-2">
                {(pode ? ABAS_DO_MEMBRO : (["geral"] as Aba[])).map((a) => (
                  <button
                    key={a}
                    type="button"
                    role="tab"
                    aria-selected={abaAtual === a}
                    onClick={() => setAba(a)}
                    className={`min-h-11 flex-1 cursor-pointer rounded-full px-2 font-sans text-sm font-bold sm:text-base ${abaAtual === a ? "bg-[#1f1a14] text-[#f4ecd8] shadow-[2px_2px_0_#c21f16]" : "text-ink-soft hover:bg-parchment-deep hover:text-ink"}`}
                  >
                    {s.abas[a as "seguindo" | "comunidades" | "tudo" | "geral"]}
                  </button>
                ))}
              </div>
              <Linha
                key={`${abaAtual}:${recarregar}`}
                aba={abaAtual}
                lang={lang}
                s={s}
                logado={aberta.logado}
                aoResponder={aoResponder}
                vazio={abaAtual === "seguindo" ? s.estados.vazioSeguindo : abaAtual === "comunidades" ? s.estados.vazioComunidades : undefined}
                aoEscreverCom={pode ? (texto) => setEscrevendo({ respostaA: null, comunidade: null, texto }) : undefined}
              />
            </>
          )}
          {tela.tipo === "post" && <TelaDaConversa key={`${tela.id}:${recarregar}`} id={tela.id} lang={lang} s={s} situacao={aberta} aoResponder={aoResponder} />}
          {tela.tipo === "comunidade" && <TelaDaComunidade slug={tela.slug} lang={lang} s={s} situacao={aberta} aoEscrever={aoEscrever} aoResponder={aoResponder} aoCarregar={aoComunidade} />}
          {tela.tipo === "perfil" && <TelaDoPerfil handle={tela.handle} lang={lang} s={s} situacao={aberta} aoResponder={aoResponder} />}

          {tela.tipo === "pacote" &&
            (doPacote ? (
              <doPacote.componente lang={lang} s={s} situacao={aberta} params={tela.params ?? {}} aoEscrever={aoEscrever} />
            ) : (
              <p className="px-[18px] py-8 font-sans text-ink-soft">{s.estados.emBreve}</p>
            ))}

          {escrevendo && pode && contexto2 && (
            <EscreverDaAlumia2
              s={s}
              lang={lang}
              situacao={aberta}
              comunidade={escrevendo.comunidade}
              respostaA={escrevendo.respostaA}
              textoInicial={escrevendo.texto}
              tipoInicial={escrevendo.tipo}
              aoFechar={() => setEscrevendo(null)}
              aoPublicar={() => setRecarregar((n) => n + 1)}
            />
          )}
          {escrevendo && pode && !contexto2 && (
            <Escrever
              s={s}
              situacao={aberta}
              comunidade={escrevendo.comunidade}
              respostaA={escrevendo.respostaA}
              textoInicial={escrevendo.texto}
              aoFechar={() => setEscrevendo(null)}
              aoPublicar={() => setRecarregar((n) => n + 1)}
            />
          )}
        </>
      )}
    </CascaDaVez>
  );
  return contexto2 ? <ProvedorAlumia2 value={contexto2}>{conteudo}</ProvedorAlumia2> : conteudo;
}
