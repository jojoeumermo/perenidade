// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { PageHeading } from "@/components/PageHeading";
import { localePath, type Locale } from "@/i18n/config";
import { hasBackend, useMe } from "@/lib/backend";
import { useCadastro } from "@/lib/cadastro";
import type { TextosDaBase } from "@/lib/escola/textos";
import { KEYS, useHydrated, useStored } from "@/lib/storage";

const cheio = "inline-flex min-h-11 items-center justify-center border-2 border-ink bg-ink px-5 py-2.5 font-semibold text-parchment hover:border-oxblood hover:bg-oxblood hover:text-parchment";
const vazado = "inline-flex min-h-11 items-center justify-center border-2 border-ink px-5 py-2.5 font-semibold hover:border-oxblood hover:text-oxblood";

/**
 * A porta da Escola: só entra quem tem conta no site. É a MESMA conta da Comunidade (a sessão do Supabase que o resto do
 * site usa, lida por useMe, de lib/backend.ts): quem já se cadastrou na Comunidade entra direto, sem passo novo. Sem
 * conta, a Escola mostra o que ela é e os mesmos caminhos da Comunidade: "Entrar" (/entrar) e "Criar conta"
 * (/entrar?criar=1, só quando o cadastro está aberto, como no Fórum). A conta pede só e-mail e senha (o apelido é
 * opcional); a Escola não pede idade, nome nem documento (LGPD, art. 14, § 4º: nada além do estritamente necessário).
 *
 * Menores (conferido no planalto.gov.br em 05/11/2026): a Escola não tem área própria para adolescentes, mas é serviço
 * "de acesso provável" por eles (ECA Digital, Lei 15.211/2025, art. 1º, parágrafo único, I). A LGPD (art. 14, § 1º)
 * pede o consentimento de um dos pais ou responsável para dados de criança. O ECA Digital, art. 24, caput, NÃO se
 * limita a rede social: vale para todo serviço "direcionado a crianças e adolescentes ou de acesso provável por eles" e
 * manda garantir que a conta de quem tem até 16 anos esteja vinculada à conta de um responsável legal. O site ainda não
 * tem esse vínculo (nem pede idade): a porta só orienta quem tem menos de 18 anos a criar a conta junto com o
 * responsável, o que NÃO cumpre o art. 24 sozinho. Ponto de revisão jurídica aberto (vínculo de contas ou Escola só para
 * maiores de 16), junto com o da Alumia, que é só para maiores de 18 por autodeclaração (o art. 9º, § 1º, veda a
 * autodeclaração como aferição de idade; docs/rede/PRIVACIDADE.md). O que a pessoa estuda fica no aparelho (o servidor
 * só recebe contagens anônimas).
 *
 * A sessão mora no navegador, então a conferência é daqui: o servidor manda um "conferindo" neutro (igual na hidratação);
 * com sessão guardada no aparelho, a Escola abre logo (e fecha de novo se o serviço disser que a sessão não vale mais);
 * sem sessão, a porta aparece sem esperar a rede.
 */
export function PortaDaEscola({
  lang,
  s,
  e,
  children,
}: {
  lang: Locale;
  s: TextosDaBase["porta"];
  e: Pick<TextosDaBase["entrada"], "olho" | "titulo" | "oQueE" | "oQueETexto" | "linhaNaoUniversidade">;
  children: React.ReactNode;
}) {
  const me = useMe();
  const hidratado = useHydrated();
  const sessao = useStored(KEYS.session);

  // Sem internet, o serviço não confere a sessão (useMe dá "out"); quem tem sessão guardada continua estudando no aparelho.
  const semRede = hidratado && typeof navigator !== "undefined" && navigator.onLine === false;
  const temSessao = hidratado && hasBackend && sessao !== "";
  if (me.status === "in" || (temSessao && (me.status === "loading" || semRede))) return <>{children}</>;
  if (me.status === "loading") {
    return (
      <div className="mx-auto min-h-[50vh] max-w-4xl px-4 py-16" data-porta-da-escola="conferindo">
        <p role="status" aria-busy="true" className="font-sans text-ink-soft">
          {s.conferindo}
        </p>
      </div>
    );
  }

  return <PortaFechada lang={lang} s={s} e={e} />;
}

/** A porta para quem não tem conta (ou não entrou): o que a Escola é, como entrar e os dois caminhos da Comunidade. */
function PortaFechada({ lang, s, e }: { lang: Locale; s: TextosDaBase["porta"]; e: Pick<TextosDaBase["entrada"], "olho" | "titulo" | "oQueE" | "oQueETexto" | "linhaNaoUniversidade"> }) {
  // Só aqui: quem já tem conta não precisa perguntar ao serviço se o cadastro está aberto.
  const cadastro = useCadastro();
  return (
    <div className="mx-auto max-w-4xl px-4 py-12" data-porta-da-escola="fechada">
      <PageHeading eyebrow={e.olho} title={e.titulo}>
        {s.lead}
      </PageHeading>

      <div className="mt-10 grid gap-8 font-sans md:grid-cols-2">
        <section aria-labelledby="porta-o-que-e">
          <h2 id="porta-o-que-e" className="font-serif text-3xl font-semibold">
            {e.oQueE}
          </h2>
          <p className="mt-3 text-lg leading-relaxed">{e.oQueETexto}</p>
          <p className="mt-3 text-ink-soft">{e.linhaNaoUniversidade}</p>
        </section>

        <section aria-labelledby="porta-como-entrar" className="border-2 border-ink bg-parchment-deep p-5 sm:p-6">
          <h2 id="porta-como-entrar" className="font-serif text-3xl font-semibold">
            {s.comoEntrar}
          </h2>
          <ol className="mt-4 grid gap-3">
            {s.passos.map((passo, n) => (
              <li key={passo} className="flex gap-3">
                <span aria-hidden className="font-mono text-xl text-gold">
                  {n + 1}
                </span>
                <span>{passo}</span>
              </li>
            ))}
          </ol>
          {hasBackend ? (
            <>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href={localePath(lang, "/entrar?volta=/escola")} className={cheio} data-porta-entrar="">
                  {s.entrar}
                </Link>
                {cadastro.aberto && (
                  <Link href={localePath(lang, "/entrar?criar=1&volta=/escola")} className={vazado} data-porta-criar="">
                    {s.criar}
                  </Link>
                )}
              </div>
              {cadastro.pronto && !cadastro.aberto && <p className="mt-3 text-sm text-ink-soft">{s.cadastroFechado}</p>}
            </>
          ) : (
            <p role="status" className="mt-5 border-l-2 border-oxblood pl-3">
              {s.semServico}
            </p>
          )}
          <p className="mt-4 text-sm text-ink-soft">{s.menores}</p>
          <p className="mt-2 text-sm">
            <Link href={localePath(lang, "/privacidade")} className="underline hover:text-oxblood">
              {s.privacidade}
            </Link>
          </p>
        </section>
      </div>

      <p className="mt-10 border-t border-rule pt-6 font-sans text-ink-soft">
        {s.abertas}{" "}
        <Link href={localePath(lang, "/trilhas")} className="font-semibold text-ink underline hover:text-oxblood">
          {s.verAulas} →
        </Link>
      </p>
    </div>
  );
}
