// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";
import { htmlLang } from "@/i18n/config";
import { indicadores, votacoesCamara } from "@/lib/dados";

// Os números são lidos das fontes oficiais e a página é refeita de tantas em tantas horas.
export const revalidate = 21600;

export async function generateMetadata({ params }: PageProps<"/[lang]/dados">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/dados", t.povo.title, t.povo.lead);
}

export default async function Dados({ params }: PageProps<"/[lang]/dados">) {
  const { lang, t } = await loadLang(params);
  const s = t.povo;
  const [lista, votacoes] = await Promise.all([indicadores(), votacoesCamara()]);
  const locale = htmlLang[lang];
  const data = (iso: string, mes = false) =>
    new Intl.DateTimeFormat(locale, mes ? { month: "long", year: "numeric", timeZone: "UTC" } : { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
  const numero = (valor: number, casas = 0) => new Intl.NumberFormat(locale, { minimumFractionDigits: casas, maximumFractionDigits: casas }).format(valor);
  const formato: Record<string, (valor: number) => string> = {
    salario: (valor) => new Intl.NumberFormat(locale, { style: "currency", currency: "BRL" }).format(valor),
    ipca: (valor) => `${numero(valor, 2)}%`,
    selic: (valor) => `${numero(valor, 2)}%`,
    desocupacao: (valor) => `${numero(valor, 1)}%`,
    populacao: (valor) => numero(valor),
    rendimento: (valor) => new Intl.NumberFormat(locale, { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(valor),
    informalidade: (valor) => `${numero(valor, 1)}%`,
    dolar: (valor) => new Intl.NumberFormat(locale, { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valor),
    rotativo: (valor) => `${numero(valor, 0)}%`,
    endividamento: (valor) => `${numero(valor, 1)}%`,
    comprometimento: (valor) => `${numero(valor, 1)}%`,
    inadimplencia: (valor) => `${numero(valor, 1)}%`,
  };
  const diarios = new Set(["selic", "dolar"]);
  const deDivida = new Set(["selic", "dolar", "rotativo", "endividamento", "comprometimento", "inadimplencia"]);
  const grupos: [string, typeof lista][] = [
    [s.economy, lista.filter((item) => !deDivida.has(item.id))],
    [s.debt, lista.filter((item) => deDivida.has(item.id))],
  ];
  const nomes = s.indicators as Record<string, string[]>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <PageHeading eyebrow={s.eyebrow} title={s.title}>
        {s.lead}
      </PageHeading>

      {lista.length === 0 && <p className="mt-10 text-ink-soft">{s.unavailable}</p>}
      {grupos.map(([titulo, itens]) =>
        itens.length === 0 ? null : (
          <section key={titulo} className="mt-10">
            <h2 className="text-3xl font-semibold">{titulo}</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {itens.map((item) => (
                <article key={item.id} className="cartao flex flex-col p-5">
                  <h3 className="rotulo">{nomes[item.id][0]}</h3>
                  <p className="mt-2 text-4xl font-semibold">{formato[item.id](item.valor)}</p>
                  <p className="mt-2 text-ink-soft">{nomes[item.id][1]}</p>
                  <p className="mt-auto pt-4 font-sans text-xs text-ink-soft">
                    {s.reference}: {data(item.referencia, !diarios.has(item.id))} ·{" "}
                    <a href={item.link} target="_blank" rel="noopener noreferrer nofollow" className="underline hover:text-oxblood">
                      {item.fonte}
                    </a>
                  </p>
                </article>
              ))}
            </div>
          </section>
        ),
      )}

      <section className="mt-14">
        <h2 className="text-3xl font-semibold">{s.votes}</h2>
        <p className="mt-2 text-ink-soft">{s.votesLead}</p>
        {votacoes.length === 0 ? (
          <p className="mt-4 text-ink-soft">{s.unavailable}</p>
        ) : (
          <ul className="mt-6 divide-y divide-rule border-y border-rule">
            {votacoes.map((votacao) => (
              <li key={votacao.id} className="py-4">
                <p className="font-sans text-sm text-ink-soft">
                  {data(votacao.data)}
                  {votacao.aprovada !== null && <span className={votacao.aprovada ? "text-ok" : "text-oxblood"}> · {votacao.aprovada ? s.approved : s.rejected}</span>}
                </p>
                <p className="mt-1 text-lg" lang="pt-BR">
                  {votacao.descricao}
                </p>
                <a href={votacao.link} target="_blank" rel="noopener noreferrer nofollow" className="font-sans text-sm underline hover:text-oxblood">
                  {s.seeSession}
                </a>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 font-sans text-xs text-ink-soft">{s.votesSource}</p>
      </section>

      <p className="mt-12 border-t border-rule pt-5 font-sans text-sm text-ink-soft">{s.note}</p>
    </div>
  );
}
