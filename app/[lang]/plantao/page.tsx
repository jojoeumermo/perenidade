// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { Cartaz } from "@/components/Cartaz";
import { localePath } from "@/i18n/config";
import { loadLang } from "@/i18n";
import { textosDoPlantao } from "@/i18n/plantao";
import { ligado } from "@/lib/recursos";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/plantao">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const p = textosDoPlantao(lang);
  return paginaMeta(lang, "/plantao", p.titulo, p.meta.descricao);
}

/**
 * O Plantão de dúvidas (Etapa 3, lacuna pedagógica "onde tiro a minha dúvida?"): uma página que só reúne os canais que já
 * existem (reforço com voluntários, assistente, comunidade, aulas ao vivo, estudo em grupo, sala livre). Nenhum canal novo
 * e nenhum horário inventado: o único com agenda marcada é o das aulas ao vivo, e a página manda para a agenda. Sem
 * leitura de disco (nada de fs: não pesa no deploy). Docs: docs/escola/lacunas-pedagogicas.md.
 */
export default async function Plantao({ params }: PageProps<"/[lang]/plantao">) {
  const { lang, t } = await loadLang(params);
  const p = textosDoPlantao(lang);
  const to = (caminho: string) => localePath(lang, caminho);
  const d = t.more.items as Record<string, string>;

  // O que cada canal é vem das páginas deles; o "como funciona" é daqui.
  const canais = [
    { id: "reforco", href: "/reforco", titulo: t.tutoring.title, oque: t.tutoring.lead, ...p.canais.reforco },
    { id: "assistente", href: "/reforco", titulo: t.tutoring.assistant.title, oque: t.tutoring.assistant.lead, ...p.canais.assistente, extra: ligado("escola") ? { href: "/escola/acompanhante", texto: p.canais.assistente.acompanhante } : null },
    { id: "comunidade", href: "/alumia", titulo: t.community.title, oque: t.community.lead, ...p.canais.comunidade },
    { id: "aovivo", href: "/ao-vivo", titulo: t.live.title, oque: t.live.lead, ...p.canais.aovivo },
    { id: "grupo", href: "/estudo-em-grupo", titulo: t.studyGroup.title, oque: t.studyGroup.lead, ...p.canais.grupo },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Cartaz eyebrow={p.eyebrow} title={p.titulo} tone="vermelho">
        {p.lead}
      </Cartaz>

      <p className="mt-6 border-l-4 border-gold pl-4 font-sans text-sm text-ink-soft" data-plantao-sem-horario="">
        {p.semHorario}
      </p>

      <section aria-labelledby="antes" className="mt-10">
        <h2 id="antes" className="font-serif text-2xl font-semibold">{p.antesTitulo}</h2>
        <p className="mt-1 font-sans text-sm text-ink-soft">{p.antesTexto}</p>
        <ul className="mt-3 flex flex-wrap gap-2 font-sans text-sm">
          {[
            [t.nav.search, "/busca"],
            [t.nav.questions, "/perguntas"],
            [t.nav.glossary, "/glossario"],
          ].map(([texto, href]) => (
            <li key={href}>
              <Link href={to(href)} className="inline-block min-h-11 border-2 border-ink bg-parchment px-3 py-2.5 font-semibold hover:border-oxblood hover:text-oxblood">{texto}</Link>
            </li>
          ))}
        </ul>
        <p className="mt-2 font-sans text-xs text-ink-soft">{d.questions}</p>
      </section>

      <section aria-labelledby="canais" className="mt-10">
        <h2 id="canais" className="font-serif text-2xl font-semibold">{p.canaisTitulo}</h2>
        <ul className="mt-4 space-y-4">
          {canais.map((c) => (
            <li key={c.id} className="border-2 border-ink bg-parchment p-4 font-sans text-sm shadow-[4px_4px_0_var(--sombra)]" data-canal={c.id}>
              <h3 className="font-serif text-xl font-semibold">{c.titulo}</h3>
              <p className="mt-1 font-semibold">{c.quem}</p>
              <p className="mt-2 text-ink-soft">{c.oque}</p>
              <p className="mt-2"><strong>{p.comoFunciona}.</strong> {c.como}</p>
              <p className="mt-3 flex flex-wrap gap-3">
                <Link href={to(c.href)} className="botao botao-tinta botao-menor">{p.abrir}: {c.titulo}</Link>
                {"extra" in c && c.extra && <Link href={to(c.extra.href)} className="self-center underline hover:text-oxblood">{c.extra.texto}</Link>}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="ensinar" className="mt-10">
        <h2 id="ensinar" className="font-serif text-2xl font-semibold">{p.paraEnsinarTitulo}</h2>
        <div className="mt-4 border-2 border-dashed border-ink p-4 font-sans text-sm" data-canal="salalivre">
          <h3 className="font-serif text-xl font-semibold">{t.nav.freeRoom}</h3>
          <p className="mt-1 font-semibold">{p.canais.salalivre.quem}</p>
          <p className="mt-2 text-ink-soft">{t.salaLivre.description}</p>
          <p className="mt-2"><strong>{p.comoFunciona}.</strong> {p.canais.salalivre.como}</p>
          <p className="mt-3">
            <Link href={to("/sala-livre")} className="botao botao-menor">{p.abrir}: {t.nav.freeRoom}</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
