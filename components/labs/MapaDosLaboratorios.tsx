// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As peças do mapa dos laboratórios (NOVAS TAREFAS, T21), todas de servidor: nenhum JavaScript vai para o navegador.
//  - CartaoDoLab: o cartão com "serve para", "para quem", "onde fica", disciplinas e aulas (página /laboratorios).
//  - SobreOLaboratorio: a faixa no alto de cada laboratório, com o mesmo resumo e as aulas que ele ajuda (volta às aulas).
//  - LabsDaAula: "Laboratórios para esta aula", no fim de cada aula (ida aos laboratórios).
// Os dados ficam em lib/mapa-dos-laboratorios.ts.
import Link from "@/components/Link";
import { Selo } from "@/components/Selo";
import catalogo from "@/content/labs-externos/catalogo.json";
import type { Locale } from "@/i18n/config";
import { fill, localePath } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { getTrack } from "@/lib/content";
import { labDoMapa, labsDaAula, textosDoLab, type LabNoMapa } from "@/lib/mapa-dos-laboratorios";

/** O nome do laboratório: dos dicionários (os do site), do catálogo (os de fora) ou do próprio mapa (os da aula). */
export function nomeDoLab(lab: LabNoMapa, t: Dict, lang: Locale): string {
  if (lab.nome) return lang === "pt" ? lab.nome.pt : lab.nome.en;
  if (lab.morada === "site") return (t.labs as unknown as Record<string, string>)[lab.id] ?? lab.id;
  return (catalogo as { id: string; nome: string }[]).find((l) => l.id === lab.id)?.nome ?? lab.id;
}

/** As aulas do laboratório, com o título no idioma (aula que não existe mais some sem quebrar a página). */
export function aulasDoLab(lab: LabNoMapa, lang: Locale): { titulo: string; href: string }[] {
  return lab.aulas.flatMap((chave) => {
    const [trilha, aula] = chave.split("/");
    const titulo = getTrack(trilha, lang)?.lessons.find((l) => l.slug === aula)?.title;
    return titulo ? [{ titulo, href: localePath(lang, `/trilhas/${trilha}/${aula}`) }] : [];
  });
}

const ondeFica = (lab: LabNoMapa, m: Dict["labs"]["mapa"]) => (lab.morada === "site" ? m.ondeSite : lab.morada === "fora" ? m.ondeFora : m.ondeAula);

/** Âncora estável do cartão na página /laboratorios. */
export const ancoraDoLab = (id: string) => `lab-${id.replace(/[^a-z0-9-]/g, "-")}`;

function Disciplinas({ lab, t, lang }: { lab: LabNoMapa; t: Dict; lang: Locale }) {
  return (
    <ul className="mt-1 flex flex-wrap gap-1.5">
      {lab.disciplinas.map((area) => (
        <li key={area}>
          <Link href={localePath(lang, `/estantes/${area}`)} className="inline-block border border-rule px-2 py-0.5 text-xs text-ink hover:border-oxblood hover:text-oxblood">
            {t.areas[area][0]}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Aulas({ lab, t, lang, mostrar = 3 }: { lab: LabNoMapa; t: Dict; lang: Locale; mostrar?: number }) {
  const m = t.labs.mapa;
  const aulas = aulasDoLab(lab, lang);
  if (aulas.length === 0) return <p className="mt-1 text-xs text-ink-soft">{m.nenhumaAula}</p>;
  const item = (a: { titulo: string; href: string }) => (
    <li key={a.href}>
      <Link href={a.href} className="underline decoration-rule underline-offset-2 hover:text-oxblood">{a.titulo}</Link>
    </li>
  );
  return (
    <>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">{aulas.slice(0, mostrar).map(item)}</ul>
      {aulas.length > mostrar && (
        <details className="mt-1">
          <summary className="cursor-pointer text-xs font-semibold text-ink-soft hover:text-oxblood">{fill(m.maisAulas, { n: aulas.length - mostrar })}</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">{aulas.slice(mostrar).map(item)}</ul>
        </details>
      )}
    </>
  );
}

/** O cartão de um laboratório na página /laboratorios. */
export function CartaoDoLab({ lab, t, lang, i = 0 }: { lab: LabNoMapa; t: Dict; lang: Locale; i?: number }) {
  const m = t.labs.mapa;
  const tx = textosDoLab(lab, lang);
  const nome = nomeDoLab(lab, t, lang);
  const rotulo = "mt-3 block text-[0.7rem] font-bold uppercase tracking-[0.12em] text-ink-soft";
  return (
    <article id={ancoraDoLab(lab.id)} className={`flex scroll-mt-24 flex-col p-5 font-sans text-sm ${i % 2 ? "cartao-v" : "cartao"}`}>
      <div className="flex items-start gap-3">
        <span className="selo h-12 w-12 shrink-0" aria-hidden>
          <Selo nome={lab.selo} className="h-8 w-8" />
        </span>
        <div className="min-w-0">
          <h3 className="font-serif text-xl font-semibold leading-tight">{nome}</h3>
          <p className="mt-0.5 text-xs text-ink-soft">{ondeFica(lab, m)}</p>
        </div>
      </div>
      <p className="mt-3 leading-snug"><strong>{m.serve}:</strong> {tx.serve}</p>
      <p className="mt-1.5 leading-snug text-ink-soft"><strong className="text-ink">{m.quem}:</strong> {tx.quem}</p>
      <span className={rotulo}>{m.ajudaEm}</span>
      <Disciplinas lab={lab} t={t} lang={lang} />
      <span className={rotulo}>{m.aulas}</span>
      <Aulas lab={lab} t={t} lang={lang} />
      <span className="mt-auto pt-4">
        <Link href={localePath(lang, lab.rota)} className="botao botao-menor" aria-label={`${m.abrir}: ${nome}`}>
          {m.abrir} →
        </Link>
      </span>
    </article>
  );
}

/** A faixa no alto de cada laboratório: para que serve, para quem, disciplinas e as aulas em que ajuda. */
export function SobreOLaboratorio({ id, t, lang }: { id: string; t: Dict; lang: Locale }) {
  const lab = labDoMapa(id);
  if (!lab) return null;
  const m = t.labs.mapa;
  const tx = textosDoLab(lab, lang);
  return (
    <section aria-label={m.serve} className="no-print mt-6 grid gap-4 border-y-2 border-ink py-4 font-sans text-sm md:grid-cols-[1fr_1fr]">
      <div>
        <p className="leading-snug"><strong>{m.serve}:</strong> {tx.serve}</p>
        <p className="mt-1.5 leading-snug text-ink-soft"><strong className="text-ink">{m.quem}:</strong> {tx.quem}</p>
        <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">{m.ajudaEm}</p>
        <Disciplinas lab={lab} t={t} lang={lang} />
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">{m.aulas}</p>
        <Aulas lab={lab} t={t} lang={lang} mostrar={4} />
        <p className="mt-3">
          <Link href={`${localePath(lang, "/laboratorios")}#${ancoraDoLab(lab.id)}`} className="underline underline-offset-4 hover:text-oxblood">← {m.todos}</Link>
        </p>
      </div>
    </section>
  );
}

/** "Laboratórios para esta aula": os que a citam primeiro, depois os da disciplina. Nada aparece se não houver nenhum. */
export function LabsDaAula({ trilha, aula, area, t, lang }: { trilha: string; aula: string; area: string; t: Dict; lang: Locale }) {
  const lista = labsDaAula(trilha, aula, area);
  if (lista.length === 0) return null;
  const m = t.labs.mapa;
  return (
    <section className="no-print no-leve no-pacote mt-10" aria-labelledby="labs-da-aula">
      <h2 id="labs-da-aula" className="font-serif text-2xl font-semibold">{m.daAula}</h2>
      <ul className="mt-3 grid gap-3 font-sans text-sm sm:grid-cols-2">
        {lista.map(({ lab, nestaAula }) => {
          // O simulador que já está no texto desta aula leva ao cartão dele no mapa (com as outras aulas que o trazem).
          const href = lab.morada === "aula" ? `${localePath(lang, "/laboratorios")}#${ancoraDoLab(lab.id)}` : localePath(lang, lab.rota);
          return (
            <li key={lab.id} className="border border-rule bg-parchment-deep p-3">
              <Link href={href} className="font-semibold underline underline-offset-4 hover:text-oxblood">{nomeDoLab(lab, t, lang)} →</Link>
              <span className="ml-2 text-[0.7rem] font-bold uppercase tracking-[0.1em] text-ink-soft">{nestaAula ? m.nestaAula : m.daDisciplina}</span>
              <p className="mt-1 leading-snug text-ink-soft">{textosDoLab(lab, lang).serve}</p>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 font-sans text-sm">
        <Link href={localePath(lang, "/laboratorios")} className="underline underline-offset-4 hover:text-oxblood">{m.todos} →</Link>
      </p>
    </section>
  );
}
