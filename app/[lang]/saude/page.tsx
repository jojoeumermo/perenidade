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

/** Os telefones de emergência, sempre visíveis no alto do mural e discáveis no celular. */
const EMERGENCIA = [
  ["SAMU", "192"],
  ["Bombeiros", "193"],
  ["CVV", "188"],
] as const;

/**
 * O Mural de Saúde: contatos de profissionais com registro ativo no conselho. Funciona como o Mural dos Trabalhadores:
 * o instituto mostra o contato que o profissional autorizou, e a pessoa trata tudo direto com ele. Sem cadastro, sem
 * formulário, sem chat, sem agenda e sem dado de saúde no site. Visual sóbrio e informativo (letra sem serifa, fundo
 * liso, linhas finas no lugar de caixas), sem lema nem símbolo do instituto: o mural é independente das posições
 * políticas dele (veja /saude/neutralidade).
 */
export default async function SaudePage({ params }: PageProps<"/[lang]/saude">) {
  const { lang, t } = await loadLang(params);
  const estaticos = (dados.profissionais as Profissional[]).filter(perfilDoArquivoVisivel);
  const [, ...avisos] = AVISO_COMPLETO;
  const [convite1, convite2] = TEXTOS.convite.split("{email}");
  const link = "underline decoration-ink/40 underline-offset-2 hover:decoration-ink";
  return (
    <div className="mural-de-saude bg-parchment font-sans text-ink">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <header className="max-w-3xl">
          <p className="text-sm font-medium text-ink-soft">Mural de contatos · profissionais com registro ativo no conselho</p>
          <h1 className="mt-2 text-[2.1rem] font-semibold leading-tight tracking-tight sm:text-[2.6rem]">{NOME_VITRINE}</h1>
          <p className="mt-3 text-lg leading-relaxed text-ink-soft">{TEXTOS.descricao}</p>
          <nav aria-label="Atalhos do mural" className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <a href="#saude-como" className={link}>Como funciona</a>
            <Link href={localePath(lang, "/saude/termo")} className={link}>Termo do mural</Link>
            <Link href={localePath(lang, "/saude/neutralidade")} className={link}>Neutralidade</Link>
          </nav>
        </header>
        <Untranslated lang={lang} t={t} show={lang !== "pt"} />

        <section aria-labelledby="saude-aviso" className="mt-8 grid gap-6 border-y border-rule py-6 text-[0.95rem] md:grid-cols-[minmax(0,1fr)_16rem]" lang="pt-BR">
          <div>
            <h2 id="saude-aviso" className="font-semibold">Leia antes de entrar em contato</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 leading-relaxed text-ink-soft marker:text-ink/40">
              {avisos.map((a) => <li key={a}>{a}</li>)}
            </ul>
          </div>
          <div className="border-l-4 border-ink pl-4 md:self-start">
            <h2 className="font-semibold">Em emergência, ligue</h2>
            <ul className="mt-2 space-y-1">
              {EMERGENCIA.map(([nome, numero]) => (
                <li key={numero} className="flex items-baseline justify-between gap-3">
                  <span>{nome}</span>
                  <a href={`tel:${numero}`} aria-label={`Ligar para ${nome}: ${numero}`} className="text-xl font-semibold tabular-nums hover:underline">{numero}</a>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-ink-soft">O CVV atende 24 horas, todos os dias.</p>
          </div>
        </section>

        <div lang="pt-BR">
          <Vitrine estaticos={estaticos} />
        </div>

        <section aria-labelledby="saude-como" className="mt-16 scroll-mt-28 border-t border-rule pt-8" lang="pt-BR">
          <h2 id="saude-como" className="text-2xl font-semibold tracking-tight">Como funciona</h2>
          <ol className="mt-6 grid gap-8 md:grid-cols-3">
            {TEXTOS.comoFunciona.map(([titulo, texto], i) => (
              <li key={titulo} className="flex gap-4">
                <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ink/40 text-sm font-semibold tabular-nums">{i + 1}</span>
                <div>
                  <h3 className="font-semibold">{titulo}</h3>
                  <p className="mt-1 leading-relaxed text-ink-soft">{texto}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-14 grid gap-8 border-t border-rule pt-8 text-[0.95rem] md:grid-cols-2" lang="pt-BR">
          <div>
            <h2 className="text-lg font-semibold">É profissional de saúde?</h2>
            <p className="mt-2 leading-relaxed text-ink-soft">
              {convite1}
              <a href={`mailto:${EMAIL_DE_CONTATO}?subject=${encodeURIComponent(`Quero aparecer no ${NOME_VITRINE}`)}`} className={`${link} text-ink`}>{EMAIL_DE_CONTATO}</a>
              {convite2}
            </p>
            <p className="mt-2"><Link href={localePath(lang, "/saude/termo")} className={link}>Ler o termo do mural</Link></p>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Em poucas palavras</h2>
            <p className="mt-2 leading-relaxed text-ink-soft">{TEXTOS.avisoCurto}</p>
          </div>
        </section>

        <footer className="mt-14 border-t border-rule pt-5 text-sm text-ink-soft" lang="pt-BR">
          <p>
            O mural é mantido de forma independente das posições políticas do Instituto Lúcia, que não indica, não avalia nem classifica profissionais.{" "}
            <Link href={localePath(lang, "/saude/neutralidade")} className={link}>Neutralidade do mural</Link>
            {" · "}
            <Link href={localePath(lang, "/saude/termo")} className={link}>Termo do mural</Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
