// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "@/components/Link";
import { nomeDoLab } from "@/components/labs/MapaDosLaboratorios";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { FINALIDADES, labsDaFinalidade, textosDoLab } from "@/lib/mapa-dos-laboratorios";

export const revalidate = 3600;

/**
 * Laboratórios dentro do aplicativo (aba Jogos e labs): os mesmos laboratórios do mapa do site, agrupados pela finalidade
 * ("o que eu quero fazer?"), em cartões de uma coluna. Abrir um laboratório ainda leva à página dele no site (cada um é
 * uma ferramenta própria): pendência registrada, não tratada como pronta. A tela cai sob a área "ferramentas" (/app/jogos).
 */
export default async function LaboratoriosDoApp({ params }: PageProps<"/[lang]/app/jogos/laboratorios">) {
  const { lang, t } = await loadLang(params);
  const s = t.labs;
  const m = s.mapa;
  return (
    <div className="app-hub app-labs-tela">
      <header className="app-hub-cabeca">
        <h1>{s.title}</h1>
        <p>{m.comoAchar}</p>
      </header>
      <nav className="app-labs-atalhos" aria-label={m.porFinalidade}>
        {FINALIDADES.map((f) => (
          <a key={f} href={`#${f}`}>
            {m.finalidades[f].titulo}
          </a>
        ))}
      </nav>
      {FINALIDADES.map((f) => (
        <section key={f} id={f} className="app-labs-grupo" aria-labelledby={`labs-${f}`}>
          <h2 id={`labs-${f}`} className="app-cartao-titulo app-cartao-titulo-menor">
            {m.finalidades[f].titulo}
          </h2>
          <p className="app-labs-serve">{m.finalidades[f].serve}</p>
          <ul>
            {labsDaFinalidade(f).map((lab) => (
              <li key={lab.id}>
                <Link href={localePath(lang, lab.rota)} className="app-cartao app-labs-cartao" data-lab={lab.id}>
                  <span className="app-cartao-titulo app-cartao-titulo-menor">{nomeDoLab(lab, t, lang)}</span>
                  <span className="app-cartao-texto">{textosDoLab(lab, lang).serve}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
