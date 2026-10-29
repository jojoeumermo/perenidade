// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import { fill, localePath, type Locale } from "@/i18n/config";
import { apoiosParaAMeta, dataCurta, nomeDoMes, type NumerosDoSite, reais, VITRINE_INICIAL, type Vitrine } from "@/lib/apoio";
import { hasBackend, rpc } from "@/lib/backend";
import { site } from "@/lib/site";
import type { Dict } from "@/i18n/types";
import { L } from "../I18n";

type Textos = Dict["support"];

const secao = "flex flex-col gap-5";

/** Título de seção no desenho do Caderno do Povo: a etiqueta preta, o fio e, se houver, um selo à direita. */
function Titulo({ id, children, selo }: { id: string; children: ReactNode; selo?: string }) {
  return (
    <h2 id={id} className="flex items-center gap-3 font-mono text-xs font-medium uppercase tracking-[0.2em]">
      <span className="bg-ink px-2.5 py-1.5 text-parchment">{children}</span>
      <span aria-hidden className="flex-1 border-t-2 border-ink" />
      {selo && <span className="max-sm:hidden">{selo}</span>}
    </h2>
  );
}

/** Destaca a primeira vez que a marca aparece no texto ("com ou sem"), em itálico vermelho. */
function destacar(texto: string, marca: string): ReactNode {
  const i = marca ? texto.indexOf(marca) : -1;
  if (i < 0) return texto;
  return (
    <>
      {texto.slice(0, i)}
      <em className="text-prelo-texto">{marca}</em>
      {texto.slice(i + marca.length)}
    </>
  );
}

/** O tijolinho da parede: os tijolos de cima e o vermelho, que é o de quem apoia. */
function Parede({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" stroke="#f4ecd8" strokeWidth="6" aria-hidden className={className}>
      <rect x="10" y="78" width="46" height="24" />
      <rect x="64" y="78" width="46" height="24" />
      <rect x="34" y="48" width="46" height="24" />
      <rect x="88" y="48" width="22" height="24" />
      <rect x="10" y="48" width="18" height="24" />
      <rect x="52" y="18" width="46" height="24" fill="#c21f16" />
    </svg>
  );
}

/** O botão de apoiar: sai para a Benfeitoria em outra aba, dizendo isso a quem usa leitor de tela. */
function BotaoDeApoiar({ link, rotulo, extra }: { link: string; rotulo: string; extra: string }) {
  return (
    <a href={link} target="_blank" rel="noopener noreferrer" className="botao botao-prelo text-base">
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
 * A página de Apoie inteira, abaixo do cabeçalho do site. Começa com a configuração inicial (o que o build já conhece)
 * e troca pelo que a coordenação publicou no painel. Seção sem dado não aparece; texto "a confirmar" só aparece depois
 * de confirmado. No alto, o desenho aprovado: a faixa vermelha, a escolha do tijolo com a conta da meta, para onde vai o
 * dinheiro e o índice do resto da página (metas, o que já fizemos, contas, mural, outras formas de ajudar, perguntas).
 */
export function PaginaDeApoio({ lang, numeros, s, slogan }: { lang: Locale; numeros: NumerosDoSite; s: Textos; slogan: string }) {
  const p = s.page;
  const [v, setV] = useState<Vitrine>(VITRINE_INICIAL);
  // A faixa de R$ 25 (a segunda) vem marcada, como no desenho: é a do meio entre as mais escolhidas.
  const [faixa, setFaixa] = useState(1);
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
  const indice = Math.max(0, Math.min(faixa, v.faixas.length - 1));
  const escolhida = v.faixas[indice];
  const n = escolhida ? apoiosParaAMeta(meta1.alvo, escolhida.valor) : 0;
  const frase = escolhida ? (n <= 1 ? fill(p.worthOne, { valor: r(escolhida.valor) }) : `${fill(p.worth, { n, valor: r(escolhida.valor) })} ${p.yourBrick}`) : "";
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
  const ondeVai: { titulo: string; texto: string; valor?: number | null; dolar?: boolean; doPainel?: boolean }[] =
    v.custos.length > 0 ? v.custos.map((c) => ({ titulo: c.categoria, texto: c.descricao, valor: c.valor, dolar: c.dolar, doPainel: true })) : p.whereDefault.map((c) => ({ titulo: c.title, texto: c.text }));
  const indiceDaPagina: [string, string][] = [
    ["#apoie-metas", p.goalsTitle],
    ["#apoie-feito", p.doneTitle],
    ["#apoie-transparencia", p.accounts.title],
    ["#apoie-mural", s.wallTitle],
    ["#apoie-outras", p.navOther],
    ["#apoie-como", p.navCancel],
    ["#apoie-faq", p.navFaq],
  ];
  // As setas andam entre as faixas, como num grupo de opções do sistema.
  const moverFaixa = (evento: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const destino = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: v.faixas.length - 1 }[evento.key];
    if (destino === undefined) return;
    evento.preventDefault();
    const proxima = (destino + v.faixas.length) % v.faixas.length;
    setFaixa(proxima);
    document.getElementById(`faixa-de-apoio-${proxima}`)?.focus();
  };

  return (
    <div className="flex flex-col gap-10">
      {v.previa && <p className="border-2 border-gold bg-parchment-deep p-3 font-sans text-sm font-semibold" role="status">{p.preview}</p>}

      {/* ── A faixa vermelha: o tijolo, o nome da campanha e a meta das contas fixas ── */}
      <div className="flex flex-wrap border-[3px] border-ink bg-[#c21f16] text-white shadow-[6px_6px_0_var(--sombra)]">
        <div className="flex min-h-[7.5rem] w-[8.75rem] shrink-0 items-center justify-center bg-[#1f1a14] max-sm:min-h-0 max-sm:w-[5.25rem]">
          <Parede className="h-20 w-20 max-sm:h-12 max-sm:w-12" />
        </div>
        <div className="flex min-w-0 flex-[999_1_26rem] flex-col justify-center gap-2 px-6 py-[1.1rem] max-sm:flex-[1_1_0] max-sm:px-4">
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-[#f4ecd8]">{s.eyebrow}</span>
          <h1 className="lambe text-[clamp(2rem,6vw,4.2rem)] leading-[0.9] tracking-[-0.03em] text-balance">{s.title}</h1>
        </div>
        <div className="flex flex-[1_1_17.5rem] flex-col justify-center gap-1.5 border-l border-[#f4ecd8]/45 px-6 py-[1.1rem] max-lg:basis-full max-lg:border-t max-lg:border-l-0 max-sm:px-4">
          <span className="font-serif text-xl italic leading-tight">{slogan}</span>
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-[#f4ecd8]">
            {p.goal1} · {fill(p.goalTarget, { alvo: r(meta1.alvo) })}
          </span>
        </div>
      </div>

      {/* ── Por que, em duas frases, e a escolha do tijolo com a conta de quantos cobrem as contas ── */}
      <div className="flex flex-wrap items-start gap-10">
        <div className="flex min-w-0 flex-[1_1_23.75rem] flex-col gap-[1.1rem]">
          <p className="font-serif text-[1.625rem] leading-[1.3] max-sm:text-[1.4rem]">{destacar(s.lead, p.leadMark)}</p>
          <p className="max-w-[58ch] font-serif text-[1.19rem] leading-[1.55] text-ink-soft">{p.intro}</p>
          <p className="-rotate-2 self-start border-[3px] border-prelo-texto px-3.5 py-2 font-sans text-[0.94rem] font-black uppercase italic tracking-[0.03em] text-prelo-texto">{p.stamp}</p>
        </div>
        <section aria-labelledby="apoie-escolha" className="flex min-w-0 flex-[1_1_28.75rem] flex-col gap-[1.1rem] border-2 border-ink bg-folha p-6 shadow-[6px_6px_0_var(--prelo)] max-sm:p-4">
          <h2 id="apoie-escolha" className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-prelo-texto">
            {p.pickTitle}
          </h2>
          {escolhida ? (
            <>
              <div role="radiogroup" aria-label={p.pickLabel} className="grid grid-cols-[repeat(auto-fill,minmax(7.4rem,1fr))] gap-2.5">
                {v.faixas.map((f, i) => {
                  const marcada = i === indice;
                  return (
                    <button
                      key={`${f.valor}-${f.nome}`}
                      id={`faixa-de-apoio-${i}`}
                      type="button"
                      role="radio"
                      aria-checked={marcada}
                      tabIndex={marcada ? 0 : -1}
                      onClick={() => setFaixa(i)}
                      onKeyDown={(evento) => moverFaixa(evento, i)}
                      className={`flex min-h-[4.75rem] cursor-pointer flex-col items-start justify-center gap-1.5 border-2 border-ink px-3 py-2.5 text-left ${marcada ? "bg-[#c21f16] text-white shadow-[3px_3px_0_var(--sombra)]" : "bg-parchment text-ink hover:bg-parchment-deep"}`}
                    >
                      <span className="font-sans text-[1.625rem] font-black italic leading-none">{r(f.valor)}</span>
                      <span className="font-mono text-[0.66rem] uppercase tracking-[0.16em]" lang={doPainel}>
                        {f.nome}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="font-sans text-sm text-ink-soft" lang={escolhida.descricao ? doPainel : undefined}>
                {escolhida.descricao || p.tierDefault}
              </p>
              <div className="flex flex-col gap-2">
                <p className="font-serif text-xl leading-snug" aria-live="polite">
                  {frase}
                </p>
                <div aria-hidden className="flex flex-wrap gap-1">
                  {Array.from({ length: n }, (_, i) => (
                    <span key={i} className={`h-3 w-[1.375rem] border-[1.5px] border-ink ${i === 0 ? "bg-[#c21f16]" : ""}`} />
                  ))}
                </div>
              </div>
              <a href={v.link} target="_blank" rel="noopener noreferrer" className="botao botao-prelo self-start text-base">
                {fill(p.supportWith, { valor: r(escolhida.valor) })} <span aria-hidden>↗</span>
                <span className="sr-only"> {p.opensOutside}</span>
              </a>
              <p className="font-sans text-[0.8rem] leading-normal text-ink-soft">{fill(p.pickNote, { nome: escolhida.nome })}</p>
            </>
          ) : (
            <>
              <BotaoDeApoiar link={v.link} rotulo={s.button} extra={p.opensOutside} />
              <p className="font-sans text-[0.8rem] leading-normal text-ink-soft">
                {s.note} {p.leaving}
              </p>
            </>
          )}
        </section>
      </div>

      {/* ── Para onde vai o dinheiro, de conta aberta ── */}
      <section className={secao} aria-labelledby="apoie-onde">
        <Titulo id="apoie-onde" selo={p.whereLabel}>
          {p.whereTitle}
        </Titulo>
        <div className="overflow-hidden border-2 border-ink bg-folha">
          <ol className="-mr-px -mb-px grid sm:grid-cols-2 lg:grid-cols-4">
            {ondeVai.map((c, i) => (
              <li key={c.titulo} className="flex flex-col gap-1.5 border-r border-b border-rule px-5 py-[1.1rem]">
                <span className="font-mono text-[0.7rem] tracking-[0.14em] text-prelo-texto">{String(i + 1).padStart(2, "0")}</span>
                <strong className="font-serif text-[1.3rem] font-semibold leading-tight" lang={c.doPainel ? doPainel : undefined}>
                  {c.titulo}
                </strong>
                {c.valor != null && <span className="font-sans text-lg font-semibold text-oxblood">{fill(p.monthly, { valor: r(c.valor) })}</span>}
                {c.dolar && <span className="font-mono text-xs uppercase tracking-widest text-ink-soft">{p.dollar}</span>}
                {c.texto && (
                  <span className="font-serif text-base leading-snug text-ink-soft" lang={c.doPainel ? doPainel : undefined}>
                    {c.texto}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── O índice do resto da página ── */}
      <nav aria-label={p.moreNav} className="flex flex-wrap items-center gap-2.5">
        <span className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-ink-soft">{p.moreNav}</span>
        {indiceDaPagina.map(([href, nome]) => (
          <a key={href} href={href} className="border-[1.5px] border-ink px-3 py-[0.45rem] font-sans text-sm font-medium text-ink no-underline hover:bg-folha hover:text-ink">
            {nome}
          </a>
        ))}
      </nav>

      <section className={secao} aria-labelledby="apoie-metas">
        <Titulo id="apoie-metas">{p.goalsTitle}</Titulo>
        <div className="grid gap-6 md:grid-cols-2">
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
              <div key={nome} className="border-2 border-ink bg-folha p-5">
                <p className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-prelo-texto">{nome}</p>
                <p className="mt-1 font-sans text-3xl font-black italic">{fill(p.goalTarget, { alvo: r(meta.alvo) })}</p>
                {meta.texto && <p className="mt-1 font-serif text-lg text-ink-soft" lang={doPainel}>{meta.texto}</p>}
                {v.campanha && <div className="mt-3"><Barra atual={v.campanha.mensal} alvo={meta.alvo} rotulo={nome} texto={fill(p.goalProgress, { atual: r(v.campanha.mensal), alvo: r(meta.alvo) })} /></div>}
              </div>
            ) : null,
          )}
        </div>
        <p className="font-sans text-sm text-ink-soft">{v.campanha ? fill(p.updatedAt, { data: dataCurta(v.campanha.em, lang) }) : p.goalNoData}</p>
      </section>

      <section className={secao} aria-labelledby="apoie-feito">
        <Titulo id="apoie-feito">{p.doneTitle}</Titulo>
        <div className="overflow-hidden border-2 border-ink bg-folha">
          <ul className="-mr-px -mb-px grid grid-cols-2 md:grid-cols-3">
            {contadores.filter(([valor]) => valor > 0).map(([valor, rotulo]) => (
              <li key={rotulo} className="border-r border-b border-rule px-5 py-4">
                <p className="font-sans text-4xl font-black italic">{fmt(valor)}</p>
                <p className="mt-1 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-ink-soft">{rotulo}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={secao} aria-labelledby="apoie-como">
        <Titulo id="apoie-como">{p.howTitle}</Titulo>
        <ul className="grid gap-3 md:grid-cols-3">
          {p.how.map((item, i) => (
            <li key={item} className="flex gap-3 border-2 border-ink bg-folha p-4">
              <span aria-hidden className="font-mono text-[0.7rem] tracking-[0.14em] text-prelo-texto">{String(i + 1).padStart(2, "0")}</span>
              <span className="font-serif text-lg leading-snug">{item}</span>
            </li>
          ))}
        </ul>
        {v.cancelamento && (
          <details className="max-w-3xl font-sans text-sm">
            <summary className="cursor-pointer underline">{p.cancelSteps}</summary>
            <p className="mt-2 whitespace-pre-line" lang={doPainel}>{v.cancelamento}</p>
          </details>
        )}
      </section>

      <section className={secao} aria-labelledby="apoie-porque">
        <Titulo id="apoie-porque">{p.whyTitle}</Titulo>
        <div className="prose-lesson">
          {s.paragraphs.map((paragrafo) => <p key={paragrafo}>{paragrafo}</p>)}
          <ul>{s.costs.map((custo) => <li key={custo}>{custo}</li>)}</ul>
          <p>{s.optional}</p>
        </div>
      </section>

      <section className={secao} aria-labelledby="apoie-outras">
        <Titulo id="apoie-outras">{p.otherTitle}</Titulo>
        <ul className="grid gap-3 sm:grid-cols-2">
          {p.other.map((o) => (
            <li key={o.title}>
              <L href={o.href} className="block h-full border-2 border-ink bg-folha p-4 text-ink shadow-[4px_4px_0_var(--sombra)] hover:text-ink hover:shadow-[4px_4px_0_var(--prelo)]">
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
          <Titulo id="apoie-quem">{p.responsibleTitle}</Titulo>
          <p className="max-w-3xl whitespace-pre-line text-lg" lang={doPainel}>{v.responsavel}</p>
        </section>
      )}

      <section className={secao} aria-labelledby="apoie-mural">
        {v.mural.length > 0 ? (
          <>
            <Titulo id="apoie-mural">{s.wallTitle}</Titulo>
            <p className="font-sans text-sm text-ink-soft">{s.wallLead}</p>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {v.mural.map((a) => (
                <li key={a.id} className="border-2 border-ink bg-folha p-4">
                  <p className="text-xl font-semibold">{a.nome}</p>
                  {a.mensagem && <p className="mt-1 font-sans text-sm italic text-ink-soft">“{a.mensagem}”</p>}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <Titulo id="apoie-mural">{p.helpersTitle}</Titulo>
            {(v.contribuicoes_publicadas > 0 || v.voluntarios > 0) && <p className="text-lg">{fill(v.contribuicoes_publicadas > 0 ? p.helpers : p.helpersVolunteers, { c: fmt(v.contribuicoes_publicadas), v: fmt(v.voluntarios) })}</p>}
            {v.nomes_voluntarios.length > 0 && (
              <p className="font-sans text-sm">
                <span className="text-ink-soft">{p.helpersNames} </span>
                {v.nomes_voluntarios.join(" · ")}
              </p>
            )}
          </>
        )}
        <FormularioDoMural p={p} />
      </section>

      <section className={secao} aria-labelledby="apoie-transparencia">
        <Titulo id="apoie-transparencia">{p.transparencyTitle}</Titulo>
        {v.relatorio ? (
          <div>
            <p className="font-semibold">{fill(p.lastMonth, { mes: nomeDoMes(v.relatorio.mes, lang) })}</p>
            <dl className="mt-3 grid max-w-xl grid-cols-3 gap-3 font-sans">
              <div className="border-2 border-ink bg-folha p-3"><dt className="text-sm text-ink-soft">{p.income}</dt><dd className="text-xl font-bold">{r(Number(v.relatorio.dados.total_entradas))}</dd></div>
              <div className="border-2 border-ink bg-folha p-3"><dt className="text-sm text-ink-soft">{p.expenses}</dt><dd className="text-xl font-bold">{r(Number(v.relatorio.dados.total_saidas))}</dd></div>
              <div className="border-2 border-ink bg-folha p-3"><dt className="text-sm text-ink-soft">{p.balance}</dt><dd className="text-xl font-bold">{r(Number(v.relatorio.dados.saldo))}</dd></div>
            </dl>
          </div>
        ) : (
          <p className="text-ink-soft">{p.transparencyEmpty}</p>
        )}
        <p className="font-sans text-sm"><L href="/apoie/contas" className="underline hover:text-oxblood">{p.seeAccounts} →</L></p>
      </section>

      <section className={secao} aria-labelledby="apoie-faq">
        <Titulo id="apoie-faq">{p.faqTitle}</Titulo>
        <div className="max-w-3xl divide-y divide-rule border-y-2 border-ink">
          {faq.map((item) => (
            <details key={item.q} className="py-3">
              <summary className="cursor-pointer font-semibold">{item.q}</summary>
              <p className="mt-2 whitespace-pre-line text-ink-soft" lang={item.lang && item.lang !== (lang === "pt" ? "pt-BR" : lang) ? item.lang : undefined}>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── O fim: o mesmo botão, para quem leu tudo ── */}
      <section className="pont flex flex-col items-center gap-4 border-2 border-ink px-5 py-10 text-center" aria-labelledby="apoie-fim">
        <h2 id="apoie-fim" className="lambe text-4xl text-balance sm:text-5xl">{p.endTitle}</h2>
        <BotaoDeApoiar link={v.link} rotulo={s.button} extra={p.opensOutside} />
        <p className="mx-auto max-w-2xl font-sans text-sm text-ink-soft">{s.note}</p>
      </section>
    </div>
  );
}
