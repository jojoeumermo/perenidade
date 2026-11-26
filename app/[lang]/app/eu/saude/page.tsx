// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "@/components/Link";
import { Vitrine } from "@/components/saude/Vitrine";
import { Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { NOME_VITRINE, TEXTOS } from "@/lib/mural-saude";
import { AVISO_COMPLETO, perfilDoArquivoVisivel, type Profissional } from "@/lib/saude";
import dados from "@/content/saude/profissionais.json";

const EMERGENCIA = [
  ["SAMU", "192"],
  ["Bombeiros", "193"],
  ["CVV", "188"],
] as const;

/**
 * O Mural de Saúde dentro do aplicativo (aba Eu): os telefones de emergência e o aviso "leia antes" vêm primeiro, depois a
 * vitrine de contatos (o mesmo componente do site, com o registro no conselho e o contato que o profissional autorizou),
 * depois "como funciona". O mural continua independente das posições do instituto: sem lema nem símbolo. O termo e a
 * neutralidade abrem as páginas do site (pendência registrada). Textos de aviso idênticos aos do site, de propósito.
 */
export default async function SaudeDoApp({ params }: PageProps<"/[lang]/app/eu/saude">) {
  const { lang, t } = await loadLang(params);
  const estaticos = (dados.profissionais as Profissional[]).filter(perfilDoArquivoVisivel);
  const [, ...avisos] = AVISO_COMPLETO;
  return (
    <div className="app-hub app-saude-tela mural-de-saude" lang="pt-BR">
      <header className="app-hub-cabeca">
        <h1>{NOME_VITRINE}</h1>
        <p>{TEXTOS.descricao}</p>
      </header>
      <Untranslated lang={lang} t={t} show={lang !== "pt"} />
      <section className="app-cartao app-saude-emergencia" aria-labelledby="app-saude-emerg">
        <h2 id="app-saude-emerg" className="app-cartao-titulo app-cartao-titulo-menor">Em emergência, ligue</h2>
        <ul>
          {EMERGENCIA.map(([nome, numero]) => (
            <li key={numero}>
              <span>{nome}</span>
              <a href={`tel:${numero}`} aria-label={`Ligar para ${nome}: ${numero}`}>{numero}</a>
            </li>
          ))}
        </ul>
        <p className="app-cartao-texto">O CVV atende 24 horas, todos os dias.</p>
      </section>
      <section className="app-cartao app-saude-aviso" aria-labelledby="app-saude-aviso">
        <h2 id="app-saude-aviso" className="app-cartao-titulo app-cartao-titulo-menor">Leia antes de entrar em contato</h2>
        <ul>
          {avisos.map((a) => <li key={a}>{a}</li>)}
        </ul>
      </section>
      <div className="app-saude-vitrine">
        <Vitrine estaticos={estaticos} />
      </div>
      <h2 className="app-titulo-secao">Como funciona</h2>
      <ol className="app-saude-como">
        {TEXTOS.comoFunciona.map(([titulo, texto]) => (
          <li key={titulo} className="app-cartao">
            <span className="app-cartao-titulo app-cartao-titulo-menor">{titulo}</span>
            <span className="app-cartao-texto">{texto}</span>
          </li>
        ))}
      </ol>
      <Link href={localePath(lang, "/saude/termo")} className="app-cartao app-saude-link">
        <span className="app-cartao-titulo app-cartao-titulo-menor">Termo do mural</span>
        <span className="app-cartao-texto">Abre na página do site.</span>
      </Link>
      <Link href={localePath(lang, "/saude/neutralidade")} className="app-cartao app-saude-link">
        <span className="app-cartao-titulo app-cartao-titulo-menor">Neutralidade</span>
        <span className="app-cartao-texto">Abre na página do site.</span>
      </Link>
    </div>
  );
}
