// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Image from "next/image";
import { loadLang } from "@/i18n";
import bust from "@/public/lucia.png";

/**
 * A dedicatória dentro do aplicativo (aba Eu): o verbete "Lúcia" num cartão, o busto e o texto da homenagem em uma
 * coluna de leitura. Mesmo texto da página do site (t.dedication); o desenho e a ordem são do aplicativo.
 */
export default async function DedicatoriaDoApp({ params }: PageProps<"/[lang]/app/eu/dedicatoria">) {
  const { t } = await loadLang(params);
  const d = t.dedication;
  return (
    <div className="app-hub app-dedicatoria-tela">
      <header className="app-hub-cabeca">
        <h1>{d.title}</h1>
        <p>{d.eyebrow}</p>
      </header>
      <article className="app-cartao app-dedicatoria-verbete">
        <h2 lang="pt-BR">Lúcia <span className="app-dedicatoria-silabas">Lú·ci·a</span></h2>
        <p className="app-dedicatoria-classe">{d.kind}</p>
        <ol>
          {d.senses.map((sense) => (
            <li key={sense}>{sense}</li>
          ))}
        </ol>
        <p className="app-dedicatoria-etim"><strong>{d.etymLabel}</strong> {d.etym}</p>
        <p className="app-dedicatoria-etim">{d.related}</p>
      </article>
      <Image src={bust} alt={d.bustAlt} sizes="80vw" className="app-dedicatoria-busto" />
      <div className="app-dedicatoria-texto">
        {d.text.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        <p className="app-dedicatoria-fecho">{d.closing}</p>
        <p className="app-dedicatoria-assina">{d.sign}</p>
      </div>
    </div>
  );
}
