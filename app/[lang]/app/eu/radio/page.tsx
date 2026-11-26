// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { TocarEmissora } from "@/components/app/TocarEmissora";
import Link from "@/components/Link";
import type { Station } from "@/components/RadioPage";
import stations from "@/content/radios.json";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { textosDoAppNovo } from "@/components/app/textos-app";

export const revalidate = 3600;

const FRENTES: Station["frente"][] = ["brasil", "latina", "mundo"];

/**
 * Rádios do povo dentro do aplicativo (aba Eu): o diretório das emissoras por frente, cada uma com o link para o site
 * dela. As emissoras com transmissão têm um botão de ouvir que usa o mesmo tocador do site (o som acompanha a navegação
 * pelo app); as outras só abrem o site delas. Som não foi provado em aparelho real: é pendência registrada, não tratada como pronta.
 */
export default async function RadioDoApp({ params }: PageProps<"/[lang]/app/eu/radio">) {
  const { lang, t } = await loadLang(params);
  const s = t.radioPagina;
  const n = textosDoAppNovo(lang);
  const lista = stations as Station[];
  return (
    <div className="app-hub app-radio-tela">
      <header className="app-hub-cabeca">
        <h1>{t.radio.title}</h1>
        <p>{n.radioLead}</p>
      </header>
      <Link href={localePath(lang, "/radio")} className="app-cartao app-radio-tocador" data-radio-tocador="">
        <span className="app-cartao-titulo app-cartao-titulo-menor">{n.radioTocador} →</span>
        <span className="app-cartao-texto">{n.radioTocadorLead}</span>
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
                <li key={e.id} className={e.transmissao ? "app-radio-linha" : undefined}>
                  {e.transmissao && <TocarEmissora id={e.id} nome={e.nome} lugar={e.lugar} url={e.transmissao} ouvir={t.radio.listen} pausar={t.radio.pause} falhou={n.radioFalhou} />}
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
