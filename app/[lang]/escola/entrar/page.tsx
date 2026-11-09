// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { SignIn } from "@/components/SignIn";
import { loadLang } from "@/i18n";
import { textosDaFormacaoBase } from "@/i18n/escola/formacao-base";

export async function generateMetadata({ params }: PageProps<"/[lang]/escola/entrar">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  return { title: textosDaFormacaoBase(lang).porta.entrarTitulo, robots: { index: false } };
}

/**
 * O entrar da Escola: o mesmo formulário de conta do site (SignIn), dentro da moldura da Escola (PortaPublica, pela
 * porta do layout). A Escola mora no endereço próprio (lib/escola/endereco.ts), com a sessão separada da do site: quem
 * já entrou no site entra aqui uma vez. Com ?volta=/escola, o formulário leva de volta à Escola ao entrar.
 */
export default async function EntrarNaEscola({ params }: PageProps<"/[lang]/escola/entrar">) {
  const { t, lang } = await loadLang(params);
  const tf = textosDaFormacaoBase(lang);
  return (
    <div className="mx-auto max-w-xl px-4 py-12" data-escola-entrar="">
      <p className="rotulo">{tf.porta.escola}</p>
      <h1 className="ef-t mt-2 text-4xl font-extrabold">{tf.porta.entrarTitulo}</h1>
      <p className="mt-3 text-lg text-ink-soft">{tf.porta.entrarTexto}</p>
      <div className="mt-8">
        <SignIn s={t.auth} />
      </div>
    </div>
  );
}
