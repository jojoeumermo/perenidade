// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { fill, localePath, type Locale } from "@/i18n/config";
import { apoiosParaAMeta, dataCurta, nomeDoMes, type NumerosDoSite, reais, VITRINE_INICIAL, type Vitrine } from "@/lib/apoio";
import { hasBackend, rpc } from "@/lib/backend";
import { site } from "@/lib/site";
import type { Dict } from "@/i18n/types";
import { L } from "../I18n";

type Textos = Dict["support"];

const secao = "mt-14 border-t border-rule pt-8";
const titulo = "text-3xl font-semibold";

/** O botão de apoiar: sai para a Benfeitoria em outra aba, dizendo isso a quem usa leitor de tela. */
function BotaoDeApoiar({ link, rotulo, extra }: { link: string; rotulo: string; extra: string }) {
  return (
    <a href={link} target="_blank" rel="noopener noreferrer" className="inline-block bg-oxblood px-8 py-3 font-sans text-base font-semibold text-parchment hover:bg-ink focus-visible:outline-3 focus-visible:outline-offset-2">
      {rotulo} <span aria-hidden>↗</span>
      <span className="sr-only"> {extra}</span>
    </a>
  );
}

/** Barra de meta com o texto equivalente ao lado (a barra não depende só de cor). */
function Barra({ atual, alvo, rotulo, texto }: { atual: number; alvo: number; rotulo: string; texto: string }) {
  const pct = Math.min(100, Math.round((100 * atual) / alvo));
  return (
    <div>
      <div className="h-4 border border-ink bg-parchment-deep" role="progressbar" aria-valuemin={0} aria-valuemax={alvo} aria-valuenow={atual} aria-valuetext={texto} aria-label={rotulo}>
        <div className="h-full bg-oxblood" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 font-mono text-sm">{texto} · {pct}%</p>
    </div>
  );
}

function FormularioDoMural({ p }: { p: Textos["page"] }) {
  const [nome, setNome] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [isca, setIsca] = useState("");
  const [estado, setEstado] = useState<"" | "enviando" | "ok" | "erro">("");
  if (!hasBackend) return null;
  return (
    <form
      className="mt-6 max-w-xl border border-rule bg-parchment-deep p-5 font-sans"
      onSubmit={async (e) => {
        e.preventDefault();
        setEstado("enviando");
        try {
          await rpc("apoio_mural_pedir", { p_nome: nome, p_mensagem: mensagem, p_site: isca });
          setEstado("ok");
          setNome("");
          setMensagem("");
        } catch {
          setEstado("erro");
        }
      }}
    >
      <h3 className="font-serif text-xl font-semibold">{p.wallFormTitle}</h3>
      <label className="mt-3 block text-sm">
        {p.wallName}
        <input required minLength={2} maxLength={80} value={nome} onChange={(e) => setNome(e.target.value)} className="mt-1 w-full border-2 border-ink bg-parchment px-3 py-2" autoComplete="nickname" />
      </label>
      <label className="mt-3 block text-sm">
        {p.wallMessage}
        <input maxLength={200} value={mensagem} onChange={(e) => setMensagem(e.target.value)} className="mt-1 w-full border-2 border-ink bg-parchment px-3 py-2" />
      </label>
      {/* Campo-isca: invisível para gente, robô preenche. */}
      <label className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden>
        Site
        <input tabIndex={-1} autoComplete="off" value={isca} onChange={(e) => setIsca(e.target.value)} />
      </label>
      <button type="submit" disabled={estado === "enviando" || nome.trim().length < 2} className="mt-4 cursor-pointer bg-ink px-5 py-2.5 font-semibold text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50">
        {p.wallSend}
      </button>
      <p role="status" className="mt-2 text-sm">{estado === "ok" ? p.wallSent : estado === "erro" ? p.wallError : ""}</p>
      <p className="mt-2 text-xs text-ink-soft">{p.wallPrivacy}</p>
    </form>
  );
}

function Compartilhar({ lang, s }: { lang: Locale; s: Textos }) {
  const p = s.page;
  const [copiado, setCopiado] = useState(false);
  const url = `${site.url}${localePath(lang, "/apoie")}`;
  const texto = `${p.shareText} ${url}`;
  const destinos: [string, string][] = [
    ["WhatsApp", `https://wa.me/?text=${encodeURIComponent(texto)}`],
    ["Telegram", `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(p.shareText)}`],
    [p.shareEmail, `mailto:?subject=${encodeURIComponent(s.title)}&body=${encodeURIComponent(texto)}`],
  ];
  return (
    <div className="mt-6">
      <h3 className="font-serif text-xl font-semibold">{p.shareTitle}</h3>
      <p className="mt-2 flex flex-wrap gap-3 font-sans text-sm">
        <button
          type="button"
          className="cursor-pointer border-2 border-ink px-4 py-2 font-semibold hover:border-oxblood hover:text-oxblood"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopiado(true);
              setTimeout(() => setCopiado(false), 2500);
            } catch {
              /* sem acesso à área de transferência: o endereço continua visível na barra */
            }
          }}
        >
          {copiado ? p.copied : p.copyLink}
        </button>
        {destinos.map(([nome, href]) => (
          <a key={nome} href={href} target="_blank" rel="noopener noreferrer" className="border-2 border-rule px-4 py-2 hover:border-oxblood hover:text-oxblood">
            {nome} <span aria-hidden>↗</span>
            <span className="sr-only"> {p.opensOutside}</span>
          </a>
        ))}
      </p>
    </div>
  );
}

/**
 * Tudo abaixo do título da página de Apoie. Começa com a configuração inicial (o que o build já conhece) e troca pelo
 * que a coordenação publicou no painel. Seção sem dado não aparece; texto "a confirmar" só aparece depois de confirmado.
 */
export function PaginaDeApoio({ lang, numeros, s }: { lang: Locale; numeros: NumerosDoSite; s: Textos }) {
  const p = s.page;
  const [v, setV] = useState<Vitrine>(VITRINE_INICIAL);
  const [faixa, setFaixa] = useState(0);
  const r = (valor: number) => reais(valor, lang);

  useEffect(() => {
    if (!hasBackend) return;
    let vivo = true;
    const previa = new URLSearchParams(window.location.search).has("previa");
    (previa ? rpc<Vitrine>("apoio_previa").catch(() => rpc<Vitrine>("apoio_publico")) : rpc<Vitrine>("apoio_publico"))
      .then((dados) => {
        if (vivo && dados && Array.isArray(dados.faixas)) setV(dados);
      })
      .catch(() => null);
    return () => {
      vivo = false;
    };
  }, []);

  const meta1 = v.metas.meta1;
  const escolhida = v.faixas[Math.min(faixa, v.faixas.length - 1)];
  const n = escolhida ? apoiosParaAMeta(meta1.alvo, escolhida.valor) : 0;
  const temDolar = v.custos.some((c) => c.dolar);
  const contadores: [number, string][] = [
    [numeros.obras, p.counters.works],
    [numeros.aulas, p.counters.lessons],
    [numeros.traducoes, p.counters.translations],
    [numeros.idiomas, p.counters.languages],
    [v.voluntarios, p.counters.volunteers],
    [v.contribuicoes_publicadas, p.counters.contributions],
  ];
  const fmt = (x: number) => x.toLocaleString(lang === "pt" ? "pt-BR" : lang);
  const faq: { q: string; a: string; lang?: string }[] = [
    p.faq.mandatory,
    p.faq.tiers,
    p.faq.anonymous,
    ...(v.taxa ? [{ q: p.faq.fee.q, a: v.taxa, lang: "pt-BR" }] : []),
    { q: p.faq.cancel.q, a: v.cancelamento ? `${p.faq.cancel.a} ${v.cancelamento}` : p.faq.cancel.a },
    ...(temDolar ? [p.faq.dollar] : []),
    p.faq.surplus,
    p.faq.data,
    ...v.faq.map((x) => ({ q: x.p, a: x.r, lang: "pt-BR" })),
  ];
  const doPainel = lang === "pt" ? undefined : "pt-BR";

  return (
    <>
      {v.previa && <p className="mt-6 border-2 border-gold bg-parchment-deep p-3 font-sans text-sm font-semibold" role="status">{p.preview}</p>}

      <div className="mt-8">
        <BotaoDeApoiar link={v.link} rotulo={s.button} extra={p.opensOutside} />
        <p className="mt-3 max-w-2xl font-sans text-sm text-ink-soft">{s.note} {p.leaving}</p>
      </div>

      <section className={secao} aria-labelledby="apoie-como">
        <h2 id="apoie-como" className={titulo}>{p.howTitle}</h2>
        <ul className="mt-4 max-w-3xl list-disc space-y-2 pl-6 text-lg">
          {p.how.map((item) => <li key={item}>{item}</li>)}
        </ul>
        {v.cancelamento && (
          <details className="mt-3 max-w-3xl font-sans text-sm">
            <summary className="cursor-pointer underline">{p.cancelSteps}</summary>
            <p className="mt-2 whitespace-pre-line" lang={doPainel}>{v.cancelamento}</p>
          </details>
        )}
      </section>

      <section className={secao} aria-labelledby="apoie-faixas">
        <h2 id="apoie-faixas" className={titulo}>{p.tiersTitle}</h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {v.faixas.map((f) => (
            <li key={`${f.valor}-${f.nome}`} className="flex flex-col border-2 border-ink bg-parchment-deep p-4">
              <p className="font-sans text-3xl font-black text-oxblood">{r(f.valor)}</p>
              <p className="font-mono text-xs uppercase tracking-widest text-ink-soft">{p.perMonth}</p>
              <p className="mt-2 font-serif text-xl font-semibold">{f.nome}</p>
              <p className="mt-1 font-sans text-sm text-ink-soft" lang={f.descricao ? doPainel : undefined}>{f.descricao || p.tierDefault}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={secao} aria-labelledby="apoie-metas">
        <h2 id="apoie-metas" className={titulo}>{p.goalsTitle}</h2>
        <div className="mt-5 grid gap-6 md:grid-cols-2">
          {v.metas.intermediaria && (
            <div className="md:col-span-2">
              <p className="font-semibold" lang={doPainel}>{p.goalMid}: {v.metas.intermediaria.texto}</p>
              {v.campanha ? (
                <Barra
                  atual={v.metas.intermediaria.unidade === "apoiadores" ? v.campanha.apoiadores : v.campanha.mensal}
                  alvo={v.metas.intermediaria.alvo}
                  rotulo={p.goalMid}
                  texto={v.metas.intermediaria.unidade === "apoiadores" ? fill(p.goalSupporters, { atual: v.campanha.apoiadores, alvo: v.metas.intermediaria.alvo }) : fill(p.goalProgress, { atual: r(v.campanha.mensal), alvo: r(v.metas.intermediaria.alvo) })}
                />
              ) : (
                <p className="font-mono text-sm">{v.metas.intermediaria.unidade === "apoiadores" ? fill(p.goalSupporters, { atual: "—", alvo: v.metas.intermediaria.alvo }) : fill(p.goalTarget, { alvo: r(v.metas.intermediaria.alvo) })}</p>
              )}
            </div>
          )}
          {([[p.goal1, meta1], [p.goal2, v.metas.meta2]] as const).map(([nome, meta]) =>
            meta ? (
              <div key={nome}>
                <p className="font-semibold">{nome}: {fill(p.goalTarget, { alvo: r(meta.alvo) })}</p>
                {meta.texto && <p className="font-sans text-sm text-ink-soft" lang={doPainel}>{meta.texto}</p>}
                {v.campanha && <div className="mt-2"><Barra atual={v.campanha.mensal} alvo={meta.alvo} rotulo={nome} texto={fill(p.goalProgress, { atual: r(v.campanha.mensal), alvo: r(meta.alvo) })} /></div>}
              </div>
            ) : null,
          )}
        </div>
        <p className="mt-4 font-sans text-sm text-ink-soft">{v.campanha ? fill(p.updatedAt, { data: dataCurta(v.campanha.em, lang) }) : p.goalNoData}</p>
      </section>

      {escolhida && (
        <section className={secao} aria-labelledby="apoie-vale">
          <h2 id="apoie-vale" className={titulo}>{p.worthTitle}</h2>
          <label className="mt-4 block max-w-xs font-sans text-sm">
            {p.worthPick}
            <select value={faixa} onChange={(e) => setFaixa(Number(e.target.value))} className="mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2">
              {v.faixas.map((f, i) => <option key={i} value={i}>{f.nome} · {r(f.valor)}</option>)}
            </select>
          </label>
          <p className="mt-3 text-2xl" aria-live="polite">{n <= 1 ? fill(p.worthOne, { valor: r(escolhida.valor) }) : fill(p.worth, { n, valor: r(escolhida.valor) })}</p>
        </section>
      )}

      <section className={secao} aria-labelledby="apoie-onde">
        <h2 id="apoie-onde" className={titulo}>{p.whereTitle}</h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {v.custos.length > 0
            ? v.custos.map((c) => (
                <li key={c.categoria} className="border border-rule p-4">
                  <p className="font-serif text-xl font-semibold" lang={doPainel}>{c.categoria}</p>
                  {c.valor !== null && <p className="font-sans text-lg font-semibold text-oxblood">{fill(p.monthly, { valor: r(c.valor) })}</p>}
                  {c.dolar && <p className="font-mono text-xs uppercase tracking-widest text-ink-soft">{p.dollar}</p>}
                  {c.descricao && <p className="mt-1 font-sans text-sm text-ink-soft" lang={doPainel}>{c.descricao}</p>}
                </li>
              ))
            : p.whereDefault.map((c) => (
                <li key={c.title} className="border border-rule p-4">
                  <p className="font-serif text-xl font-semibold">{c.title}</p>
                  <p className="mt-1 font-sans text-sm text-ink-soft">{c.text}</p>
                </li>
              ))}
        </ul>
      </section>

      <section className={secao} aria-labelledby="apoie-feito">
        <h2 id="apoie-feito" className={titulo}>{p.doneTitle}</h2>
        <ul className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
          {contadores.filter(([valor]) => valor > 0).map(([valor, rotulo]) => (
            <li key={rotulo} className="border-l-4 border-oxblood bg-parchment-deep p-4">
              <p className="font-sans text-4xl font-black">{fmt(valor)}</p>
              <p className="font-sans text-sm text-ink-soft">{rotulo}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={secao} aria-labelledby="apoie-porque">
        <h2 id="apoie-porque" className={titulo}>{p.whyTitle}</h2>
        <div className="prose-lesson mt-4">
          {s.paragraphs.map((paragrafo) => <p key={paragrafo}>{paragrafo}</p>)}
          <ul>{s.costs.map((custo) => <li key={custo}>{custo}</li>)}</ul>
          <p>{s.optional}</p>
        </div>
      </section>

      <section className={secao} aria-labelledby="apoie-outras">
        <h2 id="apoie-outras" className={titulo}>{p.otherTitle}</h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {p.other.map((o) => (
            <li key={o.title}>
              <L href={o.href} className="block h-full border-2 border-rule p-4 hover:border-oxblood">
                <span className="block font-serif text-xl font-semibold">{o.title} →</span>
                <span className="mt-1 block font-sans text-sm text-ink-soft">{o.text}</span>
              </L>
            </li>
          ))}
        </ul>
        <Compartilhar lang={lang} s={s} />
      </section>

      {v.responsavel && (
        <section className={secao} aria-labelledby="apoie-quem">
          <h2 id="apoie-quem" className={titulo}>{p.responsibleTitle}</h2>
          <p className="mt-4 max-w-3xl whitespace-pre-line text-lg" lang={doPainel}>{v.responsavel}</p>
        </section>
      )}

      <section className={secao} aria-labelledby="apoie-mural">
        {v.mural.length > 0 ? (
          <>
            <h2 id="apoie-mural" className={titulo}>{s.wallTitle}</h2>
            <p className="mt-2 font-sans text-sm text-ink-soft">{s.wallLead}</p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {v.mural.map((a) => (
                <li key={a.id} className="border border-rule bg-parchment-deep p-4">
                  <p className="text-xl font-semibold">{a.nome}</p>
                  {a.mensagem && <p className="mt-1 font-sans text-sm italic text-ink-soft">“{a.mensagem}”</p>}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <h2 id="apoie-mural" className={titulo}>{p.helpersTitle}</h2>
            {(v.contribuicoes_publicadas > 0 || v.voluntarios > 0) && <p className="mt-3 text-lg">{fill(v.contribuicoes_publicadas > 0 ? p.helpers : p.helpersVolunteers, { c: fmt(v.contribuicoes_publicadas), v: fmt(v.voluntarios) })}</p>}
            {v.nomes_voluntarios.length > 0 && (
              <p className="mt-3 font-sans text-sm">
                <span className="text-ink-soft">{p.helpersNames} </span>
                {v.nomes_voluntarios.join(" · ")}
              </p>
            )}
          </>
        )}
        <FormularioDoMural p={p} />
      </section>

      <section className={secao} aria-labelledby="apoie-transparencia">
        <h2 id="apoie-transparencia" className={titulo}>{p.transparencyTitle}</h2>
        {v.relatorio ? (
          <div className="mt-4">
            <p className="font-semibold">{fill(p.lastMonth, { mes: nomeDoMes(v.relatorio.mes, lang) })}</p>
            <dl className="mt-3 grid max-w-xl grid-cols-3 gap-3 font-sans">
              <div className="border border-rule p-3"><dt className="text-sm text-ink-soft">{p.income}</dt><dd className="text-xl font-bold">{r(Number(v.relatorio.dados.total_entradas))}</dd></div>
              <div className="border border-rule p-3"><dt className="text-sm text-ink-soft">{p.expenses}</dt><dd className="text-xl font-bold">{r(Number(v.relatorio.dados.total_saidas))}</dd></div>
              <div className="border border-rule p-3"><dt className="text-sm text-ink-soft">{p.balance}</dt><dd className="text-xl font-bold">{r(Number(v.relatorio.dados.saldo))}</dd></div>
            </dl>
          </div>
        ) : (
          <p className="mt-3 text-ink-soft">{p.transparencyEmpty}</p>
        )}
        <p className="mt-3 font-sans text-sm"><L href="/apoie/contas" className="underline hover:text-oxblood">{p.seeAccounts} →</L></p>
      </section>

      <section className={secao} aria-labelledby="apoie-faq">
        <h2 id="apoie-faq" className={titulo}>{p.faqTitle}</h2>
        <div className="mt-4 max-w-3xl divide-y divide-rule border-y border-rule">
          {faq.map((item) => (
            <details key={item.q} className="py-3">
              <summary className="cursor-pointer font-semibold">{item.q}</summary>
              <p className="mt-2 whitespace-pre-line text-ink-soft" lang={item.lang && item.lang !== (lang === "pt" ? "pt-BR" : lang) ? item.lang : undefined}>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className={`${secao} text-center`} aria-labelledby="apoie-fim">
        <h2 id="apoie-fim" className={titulo}>{p.endTitle}</h2>
        <div className="mt-5">
          <BotaoDeApoiar link={v.link} rotulo={s.button} extra={p.opensOutside} />
        </div>
        <p className="mx-auto mt-3 max-w-2xl font-sans text-sm text-ink-soft">{s.note}</p>
      </section>
    </>
  );
}
