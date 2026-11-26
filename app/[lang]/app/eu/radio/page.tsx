// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "@/components/Link";
import type { Station } from "@/components/RadioPage";
import stations from "@/content/radios.json";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";

export const revalidate = 3600;

const FRENTES: Station["frente"][] = ["brasil", "latina", "mundo"];

/**
 * Rádios do povo dentro do aplicativo (aba Eu): o diretório das emissoras por frente, cada uma com o link para o site
 * dela. O tocador com som contínuo (que acompanha a navegação) ainda é o do site: o cartão do topo leva a ele. Som não
 * foi provado em aparelho: é pendência registrada, não tratada como pronta.
 */
export default async function RadioDoApp({ params }: PageProps<"/[lang]/app/eu/radio">) {
  const { lang, t } = await loadLang(params);
  const s = t.radioPagina;
  const lista = stations as Station[];
  return (
    <div className="app-hub app-radio-tela">
      <header className="app-hub-cabeca">
        <h1>{t.radio.title}</h1>
        <p>{t.radio.lead}</p>
      </header>
      <Link href={localePath(lang, "/radio")} className="app-cartao app-radio-tocador" data-radio-tocador="">
        <span className="app-cartao-titulo app-cartao-titulo-menor">{t.nav.radio}</span>
        <span className="app-cartao-texto">{lista.filter((e) => e.transmissao).length} {s.playHere.other}</span>
      </Link>
      {FRENTES.map((f) => (
        <section key={f} className="app-radio-grupo" aria-labelledby={`radio-${f}`}>
          <h2 id={`radio-${f}`} className="app-cartao-titulo app-cartao-titulo-menor">
            {s.tabs[f]}
          </h2>
          <ul>
            {lista
              .filter((e) => e.frente === f)
              .map((e) => (
                <li key={e.id}>
                  <a href={e.site} target="_blank" rel="noopener noreferrer" className="app-cartao app-radio-emissora" data-emissora={e.id}>
                    <span className="app-cartao-titulo app-cartao-titulo-menor">{e.nome}</span>
                    <span className="app-cartao-texto">{e.lugar} · {e.descricao}</span>
                  </a>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
