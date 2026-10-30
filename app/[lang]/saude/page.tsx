// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { Vitrine } from "@/components/saude/Vitrine";
import { Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { NOME_VITRINE, TEXTOS } from "@/lib/mural-saude";
import { AVISO_COMPLETO, EMAIL_DE_CONTATO, perfilDoArquivoVisivel, type Profissional } from "@/lib/saude";
import { paginaMeta } from "@/lib/seo";
import dados from "@/content/saude/profissionais.json";

export async function generateMetadata({ params }: PageProps<"/[lang]/saude">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/saude", t.saude.title, t.saude.description);
}

/**
 * O Mural de Saúde: contatos de profissionais com registro ativo no conselho. Funciona como o Mural dos Trabalhadores:
 * o instituto mostra o contato que o profissional autorizou, e a pessoa trata tudo direto com ele. Sem cadastro, sem
 * formulário, sem chat, sem agenda e sem dado de saúde no site. Visual neutro, sem lema nem símbolo do instituto: o
 * mural é independente das posições políticas dele (veja /saude/neutralidade).
 */
export default async function SaudePage({ params }: PageProps<"/[lang]/saude">) {
  const { lang, t } = await loadLang(params);
  const estaticos = (dados.profissionais as Profissional[]).filter(perfilDoArquivoVisivel);
  const [, ...avisos] = AVISO_COMPLETO;
  const [convite1, convite2] = TEXTOS.convite.split("{email}");
  return (
    <div className="mural-de-saude bg-parchment-deep text-ink">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <header className="border-b border-ink/30 pb-6">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/70">Mural de contatos</p>
          <h1 className="mt-2 font-serif text-[2.6rem] font-semibold leading-tight sm:text-5xl">{NOME_VITRINE}</h1>
          <p className="mt-3 max-w-3xl text-xl leading-relaxed">{TEXTOS.descricao}</p>
        </header>
        <Untranslated lang={lang} t={t} show={lang !== "pt"} />

        <section aria-labelledby="saude-aviso" className="mt-8 border border-ink/50 bg-folha font-sans text-sm" lang="pt-BR">
          <h2 id="saude-aviso" className="border-b border-ink/30 px-4 py-2 font-semibold">Leia antes de entrar em contato</h2>
          <ul className="list-disc space-y-1.5 py-3 pr-4 pl-9">
            {avisos.map((a) => <li key={a}>{a}</li>)}
          </ul>
          <p className="border-t border-ink/30 bg-ink px-4 py-2 font-semibold text-parchment">Emergência: SAMU 192 · Bombeiros 193 · CVV 188 (24 horas)</p>
        </section>

        <div lang="pt-BR">
          <Vitrine estaticos={estaticos} />
        </div>

        <section aria-labelledby="saude-como" className="mt-16 grid gap-8 font-sans md:grid-cols-3" lang="pt-BR">
          <h2 id="saude-como" className="font-serif text-3xl font-semibold md:col-span-3">Como funciona</h2>
          {TEXTOS.comoFunciona.map(([titulo, texto], i) => (
            <div key={titulo} className="border-t border-ink/40 pt-3">
              <p className="font-mono text-xs uppercase tracking-widest text-ink/70">Passo {i + 1}</p>
              <h3 className="mt-1 font-serif text-2xl font-semibold">{titulo}</h3>
              <p className="mt-1">{texto}</p>
            </div>
          ))}
        </section>

        <section className="mt-12 grid gap-6 border-t border-ink/40 pt-6 font-sans text-sm md:grid-cols-2" lang="pt-BR">
          <div>
            <h2 className="font-serif text-2xl font-semibold">É profissional de saúde?</h2>
            <p className="mt-2">
              {convite1}
              <a href={`mailto:${EMAIL_DE_CONTATO}?subject=${encodeURIComponent(`Quero aparecer no ${NOME_VITRINE}`)}`} className="underline hover:no-underline">{EMAIL_DE_CONTATO}</a>
              {convite2}
            </p>
            <p className="mt-2"><Link href={localePath(lang, "/saude/termo")} className="underline hover:no-underline">Ler o termo do mural</Link></p>
          </div>
          <div>
            <h2 className="font-serif text-2xl font-semibold">Em poucas palavras</h2>
            <p className="mt-2">{TEXTOS.avisoCurto}</p>
          </div>
        </section>

        <footer className="mt-12 border-t border-ink/40 pt-4 font-sans text-sm" lang="pt-BR">
          <p>
            O mural é mantido de forma independente das posições políticas do Instituto Lúcia, que não indica, não avalia nem classifica profissionais.{" "}
            <Link href={localePath(lang, "/saude/neutralidade")} className="underline hover:no-underline">Neutralidade do mural</Link>
            {" · "}
            <Link href={localePath(lang, "/saude/termo")} className="underline hover:no-underline">Termo do mural</Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
