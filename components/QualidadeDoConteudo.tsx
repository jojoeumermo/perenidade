// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
// Componente do servidor: a conta (lib/qualidade.ts) roda na montagem e só os números chegam à página.
import { fill, htmlLang, isLocale } from "@/i18n/config";
import en from "@/i18n/escola/acesso/en.json";
import es from "@/i18n/escola/acesso/es.json";
import fr from "@/i18n/escola/acesso/fr.json";
import pt from "@/i18n/escola/acesso/pt.json";
import ru from "@/i18n/escola/acesso/ru.json";
import zh from "@/i18n/escola/acesso/zh.json";
import { calcularQualidade, type Qualidade } from "@/lib/qualidade";
import "@/styles/escola-acesso.css";

const TEXTOS = { pt, en, es, fr, ru, zh };

function Linha({ rotulo, n, total, lang, s }: { rotulo: string; n: number; total: number; lang: string; s: typeof pt.qualidade }) {
  const numero = new Intl.NumberFormat(lang);
  const parte = total > 0 ? Math.round((n / total) * 100) : 0;
  return (
    <li className="py-3">
      <p className="flex flex-wrap items-baseline justify-between gap-x-4">
        <span>{rotulo}</span>
        <span className="font-mono text-sm">
          {fill(s.deTotal, { n: numero.format(n), total: numero.format(total) })} · {parte}%
        </span>
      </p>
      <div className="qualidade-barra mt-1.5" aria-hidden>
        <span style={{ width: `${parte}%` }} />
      </div>
    </li>
  );
}

/** O painel público de qualidade (R1-90), em /status: estado do conteúdo, sem ranking de pessoas. */
export function QualidadeDoConteudo({ lang, qualidade = calcularQualidade() }: { lang: string; qualidade?: Qualidade }) {
  const idioma = isLocale(lang) ? lang : "pt";
  const s = TEXTOS[idioma].qualidade;
  const q = qualidade;
  const data = new Intl.DateTimeFormat(htmlLang[idioma], { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${q.data}T12:00:00Z`));
  const aulas: [string, number][] = [
    [s.revisadas, q.revisadas],
    [s.emRevisaoProntas, q.emRevisaoProntas],
    [s.emRevisaoFaltam, q.emRevisaoFaltam],
    [s.comFontes, q.comFontes],
    [s.comTeste, q.comTeste],
    [s.comExercicio, q.comExercicio],
  ];
  return (
    <section aria-labelledby="qualidade-titulo" className="mt-12 font-sans" data-qualidade>
      <h2 id="qualidade-titulo" className="font-serif text-2xl font-semibold">
        {s.titulo}
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-ink-soft">{s.lead}</p>
      <p className="mt-4 border-2 border-ink p-4">
        <span className="font-mono text-3xl font-bold">{new Intl.NumberFormat(idioma).format(q.aulas)}</span> <span className="font-semibold">{s.aulas}</span>
      </p>
      <ul className="mt-4 divide-y divide-rule border-y-2 border-ink">
        {aulas.map(([rotulo, n]) => (
          <Linha key={rotulo} rotulo={rotulo} n={n} total={q.aulas} lang={idioma} s={s} />
        ))}
      </ul>
      <h3 className="mt-8 font-serif text-xl font-semibold">{s.trilhas}</h3>
      <ul className="mt-2 divide-y divide-rule border-y-2 border-ink">
        <Linha rotulo={s.trilhasComAula} n={q.trilhasComAula} total={q.trilhas} lang={idioma} s={s} />
        <Linha rotulo={s.trilhasSemAula} n={q.trilhasSemAula} total={q.trilhas} lang={idioma} s={s} />
      </ul>
      <p className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-ink-soft">
        <span>{fill(s.calculadoEm, { data })}</span>
        <a href={`/${idioma}/contribuir/guia#revisar`} className="underline hover:text-oxblood">
          {s.guia}
        </a>
      </p>
    </section>
  );
}
