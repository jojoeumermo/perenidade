// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useMemo, useState } from "react";
import Link from "@/components/Link";
import { comunidades } from "@/lib/rede/cliente-comunidades";
import { listaDeExemplo } from "@/lib/rede/conversa/exemplos";
import { preencher } from "@/lib/rede/preencher";
import { enderecos } from "@/lib/rede/tipos";
import { enderecosCom, type ItemDaLista, type SituacaoNaComunidade } from "@/lib/rede/tipos-comunidades";
import type { TextosDeComunidades } from "@/lib/rede/textos-comunidades";
import { EsqueletoDaLinha } from "../Esqueletos";
import type { PropsDaTelaDoPacote } from "../registro";
import { FaixaDaPrevia, previa, useTextosAlumia3 } from "../conversa/base3";
import { AcoesDaComunidade } from "./AcoesDaComunidade";
import { erroCom, textosDe, useCarregar } from "./util";
// O visual novo (só com "rede-v2" + "alumia-2": a folha só vale dentro de [data-al="2"]).
import "../conversa/alumia3.css";

const ORDEM: ItemDaLista["categoria"][] = ["lutas", "disciplinas", "instituto"];

/** Tira acento e caixa, para a busca achar "educacao" em "Educação". */
const simples = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** A regra pública da ordem (a mesma do banco): mais posts na semana primeiro, depois a ordem alfabética. */
const pelaRegra = (a: ItemDaLista, b: ItemDaLista) => (b.posts_7d ?? 0) - (a.posts_7d ?? 0) || a.nome.localeCompare(b.nome, "pt");

/**
 * A vitrine das comunidades (/alumia/comunidades), T32 item 3. Lutas, Disciplinas e Instituto em seções recolhíveis, com
 * busca e filtro; a ordem é pública e está escrita na tela. Cada cartão mostra só contagens AGREGADAS e anônimas da semana (posts
 * e pessoas, estas só a partir de 3: abaixo disso, "poucas"), nunca quem: estar numa luta pode revelar opinião política (LGPD,
 * art. 5º, II e art. 11; minimização, art. 6º, III). Um único chamado por cartão: quem tem conta, o botão de entrar; visitante, o
 * nome que abre a comunidade (disciplinas) ou a prévia com as regras (lutas e Instituto, sem posts) e UM convite no alto.
 */
export default function Lista({ lang, s, situacao }: PropsDaTelaDoPacote) {
  const sc = textosDe(s);
  const t3 = useTextosAlumia3(lang);
  // Na prévia, as comunidades de exemplo (as mesmas de Explorar e de "Comunidades ativas"); a Passe Livre já tem a Faísca dentro.
  const { dado, erro, pronto } = useCarregar(
    () => (previa() ? Promise.resolve({ itens: listaDeExemplo().map((c) => (c.slug === "passe-livre-sp" ? { ...c, situacao: "membro" as const } : c)) }) : comunidades.lista()),
    "lista",
  );
  const [mudancas, setMudancas] = useState<Record<string, SituacaoNaComunidade>>({});
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState<ItemDaLista["categoria"] | "todas">("todas");
  const [soAtivas, setSoAtivas] = useState(false);

  const itens = useMemo(() => {
    const termo = simples(busca.trim());
    return (dado?.itens ?? [])
      .filter((i) => !termo || simples(`${i.nome} ${i.descricao}`).includes(termo))
      .filter((i) => !soAtivas || (i.posts_7d ?? 0) > 0)
      .sort(pelaRegra);
  }, [dado, busca, soAtivas]);

  if (!sc) return <p className="px-[18px] py-8 font-sans text-ink-soft">{s.estados.emBreve}</p>;
  if (!pronto) return <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={4} />;
  // Mesmo com erro a tela tem o título (quem chega pelo "voltar" da comunidade sabe onde está) e o caminho para tentar de novo.
  if (!dado) {
    return (
      <div className="al3-tela font-sans">
        <header className="border-b border-rule px-[18px] py-4">
          <h1 className="al3-cond al3-titulo-tela">{sc.lista.titulo}</h1>
        </header>
        <p role="alert" className="px-[18px] py-8 text-ink-soft">{erro ? erroCom(s, sc, erro) : s.estados.erro}</p>
      </div>
    );
  }
  const pode = situacao.logado && situacao.membro;
  const l = sc.lista;
  const nomes = l as unknown as Record<string, string>;
  const temContagem = dado.itens.some((i) => typeof i.posts_7d === "number");
  const procurando = busca.trim().length > 0 || soAtivas;

  return (
    <div className="al3-tela font-sans">
      {t3 && <FaixaDaPrevia t={t3} />}
      <header className="border-b border-rule px-[18px] py-4">
        <h1 className="al3-cond al3-titulo-tela">{l.titulo}</h1>
        <p className="mt-1 text-sm text-ink-soft">{l.intro}</p>
        {(pode || !situacao.logado) && (
          <p className="mt-3 flex flex-wrap gap-4 text-sm">
            {pode && <Link href={enderecosCom.propor(lang)} className="font-bold underline">{l.propor}</Link>}
            {pode && <Link href={enderecosCom.nucleos(lang)} className="font-bold underline">{l.turma}</Link>}
          </p>
        )}
      </header>

      {/* Visitante: o convite a entrar já está no alto da Alumia (Entrada); aqui só diz o que ele vê, uma vez. Quem tem conta mas
          ainda não entrou na Alumia: UM convite, em vez da mesma frase repetida em cada cartão. */}
      {!situacao.logado && <p className="mx-[18px] mt-3 rounded-xl bg-parchment-deep p-3 text-sm">{l.conviteTexto}</p>}
      {situacao.logado && !pode && (
        <section className="m-3 overflow-hidden rounded-[18px] border-[1.5px] border-ink bg-[#1f1a14] text-[#f4ecd8]" aria-labelledby="vitrine-convite">
          <div className="alumia-convite-faixa h-1.5" aria-hidden />
          <div className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1 basis-64">
              <h2 id="vitrine-convite" className="font-serif text-lg font-extrabold">{l.conviteTitulo}</h2>
              <p className="mt-1 text-sm opacity-90">{l.conviteTexto}</p>
            </div>
            <Link href={enderecos.linha(lang)} className="alumia-botao inline-flex min-h-11 items-center rounded-full bg-[#c21f16] px-5 font-bold text-white hover:bg-white hover:text-[#1f1a14]">
              {l.conviteBotao}
            </Link>
          </div>
        </section>
      )}

      <div className="space-y-3 border-b border-rule px-[18px] py-3">
        <div role="search">
          <label htmlFor="vitrine-busca" className="sr-only">{l.buscar}</label>
          <input id="vitrine-busca" type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={l.buscar} className="min-h-11 w-full rounded-full border border-rule bg-folha px-4" />
        </div>
        <fieldset className="flex flex-wrap items-center gap-2 text-sm">
          <legend className="sr-only">{l.filtro}</legend>
          {(["todas", ...ORDEM] as const).map((c) => (
            <label key={c} className={`inline-flex min-h-9 cursor-pointer items-center rounded-full border-[1.5px] px-3 font-bold has-focus-visible:outline-2 ${categoria === c ? "border-ink bg-[#1f1a14] text-[#f4ecd8]" : "border-rule hover:border-ink"}`}>
              <input type="radio" name="vitrine-categoria" value={c} checked={categoria === c} onChange={() => setCategoria(c)} className="sr-only" />
              {c === "todas" ? l.todas : nomes[c]}
            </label>
          ))}
          {temContagem && (
            <label className="ml-auto inline-flex min-h-9 cursor-pointer items-center gap-2">
              <input type="checkbox" checked={soAtivas} onChange={(e) => setSoAtivas(e.target.checked)} className="h-4 w-4 accent-[#c21f16]" />
              {l.soAtivas}
            </label>
          )}
        </fieldset>
        <p className="text-xs text-ink-soft">
          {l.regraOrdem} {temContagem && l.privacidade}
        </p>
      </div>

      {itens.length === 0 && <p className="px-[18px] py-6 text-ink-soft">{dado.itens.length === 0 ? l.vazio : l.nenhuma}</p>}
      {ORDEM.filter((c) => categoria === "todas" || categoria === c).map((cat) => {
        const daqui = itens.filter((i) => i.categoria === cat);
        if (daqui.length === 0) return null;
        // As 77 disciplinas começam recolhidas (a não ser que a pessoa esteja buscando ou tenha escolhido só elas).
        const aberta = cat !== "disciplinas" || procurando || categoria === "disciplinas";
        return (
          <details key={`${cat}-${aberta}`} open={aberta} className="group border-b border-rule">
            <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-[18px] py-3 [&::-webkit-details-marker]:hidden">
              <span aria-hidden className="text-[#c21f16] transition-transform group-open:rotate-90">▸</span>
              <h2 className="font-serif text-xl font-semibold">{nomes[cat]}</h2>
              <span className="rounded-full bg-parchment-deep px-2 text-sm font-bold">{daqui.length}</span>
            </summary>
            <ul className="grid gap-3 px-3 pb-4 sm:grid-cols-2">
              {daqui.map((i) => (
                <li key={i.slug}>
                  <Cartao item={i} lang={lang} atual={i.slug in mudancas ? mudancas[i.slug] : i.situacao} pode={pode} s={s} sc={sc} aoMudar={(v) => setMudancas((m) => ({ ...m, [i.slug]: v }))} />
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </div>
  );
}

function Cartao({
  item: i,
  lang,
  atual,
  pode,
  s,
  sc,
  aoMudar,
}: {
  item: ItemDaLista;
  lang: string;
  atual: SituacaoNaComunidade;
  pode: boolean;
  s: PropsDaTelaDoPacote["s"];
  sc: TextosDeComunidades;
  aoMudar: (v: SituacaoNaComunidade) => void;
}) {
  const l = sc.lista;
  const cor = /^#[0-9a-f]{6}$/i.test(i.cor) ? i.cor : undefined;
  const semana =
    typeof i.posts_7d !== "number"
      ? null
      : i.posts_7d === 0
        ? l.semanaQuieta
        : i.pessoas_7d
          ? preencher(l.semana, { posts: i.posts_7d, pessoas: i.pessoas_7d })
          : preencher(l.semanaPoucas, { posts: i.posts_7d });
  return (
    <article style={cor ? ({ "--cor-da-comunidade": cor } as React.CSSProperties) : undefined} className="alumia-vitrine-cartao flex h-full flex-col rounded-[18px] border-[1.5px] border-rule bg-folha p-4">
      <div className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 font-serif text-lg font-bold leading-snug">
          {i.amostra ? i.nome : <Link href={enderecos.comunidade(lang, i.slug)} className="underline decoration-1 underline-offset-2 hover:decoration-2">{i.nome}</Link>}
        </h3>
        <span title={sc.tipo[i.tipo]} className="shrink-0 rounded-full border border-current px-2 text-[0.7rem] font-bold uppercase leading-5 tracking-wider text-ink-soft">
          {i.amostra ? l.amostraSelo : l.tipoCurto[i.tipo]}
          <span className="sr-only">: {sc.tipo[i.tipo]}</span>
        </span>
      </div>
      {i.descricao && <p className="mt-1 line-clamp-3 text-sm text-ink-soft">{i.descricao}</p>}
      {semana && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-bold">
          <span aria-hidden className={`h-2 w-2 rounded-full ${i.posts_7d ? "bg-[#c21f16]" : "border border-current"}`} />
          {semana}
        </p>
      )}
      {i.amostra && i.regras && i.regras.length > 0 && (
        <details className="mt-2 text-sm">
          <summary className="min-h-9 cursor-pointer font-bold underline">{l.verRegras}</summary>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            {i.regras.map((r) => (
              <li key={r.numero}>
                <strong>{r.titulo}</strong>
                {r.texto && <span className="text-ink-soft">: {r.texto}</span>}
              </li>
            ))}
          </ol>
        </details>
      )}
      {/* Um chamado só: quem tem conta, o botão; visitante não recebe a mesma frase em cada cartão (o convite está no alto). */}
      {pode && (
        <div className="mt-auto">
          <AcoesDaComunidade slug={i.slug} tipo={i.tipo} situacao={atual} podeEntrar={pode} s={s} sc={sc} aoMudar={aoMudar} />
        </div>
      )}
    </article>
  );
}
