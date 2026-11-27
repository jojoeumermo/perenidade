// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { Cartaz } from "@/components/Cartaz";
import { Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { paginaMeta } from "@/lib/seo";
import { Acessibilidade, Estatuto } from "@/components/instituto/Estatuto";
import { VALORES } from "@/lib/instituto-valores";

export async function generateMetadata({ params }: PageProps<"/[lang]/instituto">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/instituto", t.nav.institute, t.instituto.description);
}

/** Propósito, missão, visão, valores e a carta de funcionamento (o estatuto, enquanto o instituto não é associação registrada). */
export default async function Instituto({ params }: PageProps<"/[lang]/instituto">) {
  const { lang, t } = await loadLang(params);
  const to = (path: string) => localePath(lang, path);
  const secao = "jornal-secao mt-14";
  return (
    <div className="mx-auto max-w-5xl px-4 py-12" lang="pt-BR">
      <Cartaz eyebrow="Quem somos, por escrito" title="O Instituto" slogan="Sem preço e sem cadeado" tone="vermelho">
        O propósito, a missão, a visão, os valores e as regras de funcionamento do Instituto Lúcia, num lugar só.
      </Cartaz>
      <Untranslated lang={lang} t={t} show={lang !== "pt"} />

      <section aria-labelledby="proposito" className="mt-12 grid gap-8 md:grid-cols-[14rem_1fr]">
        <h2 id="proposito" className="font-mono text-xs uppercase tracking-[0.25em] text-oxblood">Propósito</h2>
        <p className="font-serif text-3xl leading-snug md:text-4xl">Que o conhecimento acumulado pela humanidade volte a quem o produziu: <em className="text-oxblood">livre, gratuito e copiado por todos.</em></p>
      </section>

      <section aria-labelledby="missao" className="mt-12 grid gap-8 border-t-2 border-ink pt-8 md:grid-cols-[14rem_1fr]">
        <h2 id="missao" className="font-mono text-xs uppercase tracking-[0.25em] text-oxblood">Missão</h2>
        <p className="text-xl leading-relaxed">Manter, com trabalho voluntário, uma escola, uma biblioteca e um arquivo digitais, gratuitos e sem anúncios, em seis idiomas: aulas curtas que mostram as fontes, um acervo que leva às fontes legítimas das obras e ferramentas que funcionam no aparelho de quem estuda, sem exigir cadastro e sem vender dados.</p>
      </section>

      <section aria-labelledby="visao" className="mt-12 grid gap-8 border-t-2 border-ink pt-8 md:grid-cols-[14rem_1fr]">
        <h2 id="visao" className="font-mono text-xs uppercase tracking-[0.25em] text-oxblood">Visão</h2>
        <p className="text-xl leading-relaxed">Uma biblioteca de Alexandria ao contrário: que não dependa de poucas cópias, porque tudo nela pode ser copiado, e que sirva em casa, na sala de aula, no movimento e no trabalho, para quem quer aprender qualquer coisa, da alfabetização ao ensino superior e aos ofícios.</p>
      </section>

      <section aria-labelledby="valores" className="mt-14">
        <h2 id="valores" className={secao}><span className="jornal-editoria">Valores</span></h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {VALORES.map(([nome, texto], i) => (
            <li key={nome} className="border-2 border-ink bg-parchment-deep p-5 shadow-[4px_4px_0_0_var(--color-ink)]">
              <p className="font-mono text-xs text-oxblood">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="mt-1 font-serif text-2xl font-semibold">{nome}</h3>
              <p className="mt-2 font-sans text-sm text-ink-soft">{texto}</p>
            </li>
          ))}
        </ul>
      </section>

      <Estatuto />

      <Acessibilidade href={to("/relatar-erro")} />

      <p className="mt-12 font-sans text-sm">
        <Link href={to("/sobre")} className="underline hover:text-oxblood">Manifesto</Link> · <Link href={to("/termos")} className="underline hover:text-oxblood">Termos de uso</Link> · <Link href={to("/privacidade")} className="underline hover:text-oxblood">Política de privacidade</Link> · <Link href={to("/apoie")} className="underline hover:text-oxblood">Apoie e prestação de contas</Link>
      </p>
    </div>
  );
}
