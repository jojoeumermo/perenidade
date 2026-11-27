// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { ComoFunciona } from "@/components/ComoFunciona";
import { Mural } from "@/components/Mural";
import { loadLang } from "@/i18n";

/**
 * O Mural dos Trabalhadores dentro do aplicativo (aba Eu): título e apresentação, as regras e o mural em si (o mesmo
 * componente do site: busca por estado e cidade, anúncios, envio sem conta, retirada por código) e "como funciona".
 * Nada vai ao ar sem a coordenação ler. A lógica e os dados são os do site; a ordem e o desenho são do aplicativo.
 */
export default async function MuralDoApp({ params }: PageProps<"/[lang]/app/eu/mural">) {
  const { t } = await loadLang(params);
  const s = t.mural;
  return (
    <div className="app-hub app-mural-tela">
      <header className="app-hub-cabeca">
        <h1>{s.title}</h1>
        <p>{s.lead}</p>
      </header>
      <section className="app-cartao app-mural-regras" aria-labelledby="app-mural-regras">
        <h2 id="app-mural-regras" className="app-cartao-titulo app-cartao-titulo-menor">{s.rulesTitle}</h2>
        <ul>
          {s.rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </section>
      <div className="app-mural-corpo">
        <Mural s={s} />
      </div>
      <div className="app-mural-como">
        <ComoFunciona s={s.how} />
      </div>
    </div>
  );
}
