// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { Cartaz } from "@/components/Cartaz";
import { Vitrine } from "@/components/saude/Vitrine";
import { Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { AVISO_COMPLETO, AVISO_CURTO, EMAIL_DE_CONTATO, type Profissional } from "@/lib/saude";
import { paginaMeta } from "@/lib/seo";
import dados from "@/content/saude/profissionais.json";

export async function generateMetadata({ params }: PageProps<"/[lang]/saude">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/saude", t.saude.title, t.saude.description);
}

/**
 * Saúde Solidária: o mural de contatos de profissionais de saúde voluntários. Funciona como o Mural dos Trabalhadores:
 * o instituto mostra o contato que o profissional autorizou, e a pessoa combina tudo direto com ele. Sem cadastro, sem
 * formulário, sem chat, sem agenda e sem dado de saúde no site.
 */
export default async function SaudePage({ params }: PageProps<"/[lang]/saude">) {
  const { lang, t } = await loadLang(params);
  const s = t.saude;
  const estaticos = dados.profissionais as Profissional[];
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <Cartaz eyebrow={s.eyebrow} title={s.title} slogan={s.slogan} tone="preto">
        {s.lead}
      </Cartaz>
      <Untranslated lang={lang} t={t} show={lang !== "pt"} />

      <section aria-labelledby="saude-aviso" className="mt-8 border-2 border-ink font-sans text-sm" lang="pt-BR">
        <h2 id="saude-aviso" className="jornal-preto px-4 py-2 font-black uppercase italic tracking-tight">Leia antes de entrar em contato</h2>
        <ul className="list-disc space-y-1.5 py-3 pr-4 pl-9 text-ink-soft">
          {AVISO_COMPLETO.slice(1).map((a) => <li key={a}>{a}</li>)}
        </ul>
        <p className="border-t-2 border-ink bg-[#c21f16] px-4 py-2 font-bold text-white">Emergência: SAMU 192 · Bombeiros 193 · CVV 188 (24 horas)</p>
      </section>

      <div lang="pt-BR">
        <Vitrine estaticos={estaticos} />
      </div>

      <section aria-labelledby="saude-como" className="mt-16 grid gap-8 font-sans md:grid-cols-3" lang="pt-BR">
        <h2 id="saude-como" className="font-serif text-3xl font-semibold md:col-span-3">Como funciona</h2>
        {[
          ["1", "Escolha", "Os perfis aparecem em ordem alfabética: não há ranking nem indicação. Leia a abordagem, as áreas e a forma de atendimento."],
          ["2", "Baixe o cartão", "Ao tocar em Ver contato, você lê os avisos e baixa um cartão de encaminhamento com um código. Ele fica só no seu aparelho."],
          ["3", "Fale direto", "Mande o cartão ao profissional pelo contato que ele autorizou. Valor, horário e forma de atendimento são combinados entre vocês."],
        ].map(([n, titulo, texto]) => (
          <div key={n} className="border-t-4 border-[#c21f16] pt-3">
            <p className="font-mono text-xs uppercase tracking-widest text-oxblood">Passo {n}</p>
            <h3 className="mt-1 font-serif text-2xl font-semibold">{titulo}</h3>
            <p className="mt-1 text-ink-soft">{texto}</p>
          </div>
        ))}
      </section>

      <section className="mt-12 grid gap-6 border-t-2 border-ink pt-6 font-sans text-sm md:grid-cols-2" lang="pt-BR">
        <div>
          <h2 className="font-serif text-2xl font-semibold">É profissional de saúde?</h2>
          <p className="mt-2 text-ink-soft">Psicólogos, médicos, enfermeiros, nutricionistas, fisioterapeutas, assistentes sociais e outros profissionais com registro ativo podem aparecer aqui como voluntários, atendendo de graça ou por valor social. Escreva para <a href={`mailto:${EMAIL_DE_CONTATO}?subject=${encodeURIComponent("Quero aparecer na Saúde Solidária")}`} className="underline hover:text-oxblood">{EMAIL_DE_CONTATO}</a>: a coordenação cria o seu acesso ao painel, onde você preenche o perfil, aceita o termo e aprova o texto antes de ir ao ar.</p>
          <p className="mt-2"><Link href={localePath(lang, "/saude/termo")} className="underline hover:text-oxblood">Ler o termo da vitrine</Link></p>
        </div>
        <div>
          <h2 className="font-serif text-2xl font-semibold">Em poucas palavras</h2>
          <p className="mt-2 text-ink-soft">{AVISO_CURTO}</p>
        </div>
      </section>
    </div>
  );
}
