// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { Arsenal } from "@/components/vale-o-escrito/Arsenal";
import { CabecaDoVale } from "@/components/vale-o-escrito/Cabeca";
import { localePath } from "@/i18n/config";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";
import { dadosDoObservatorio } from "@/lib/vale-o-escrito/consulta";
import { textosDoObservatorio } from "@/lib/vale-o-escrito/textos";

// Os casos aprovados no banco entram sem novo deploy: a página é refeita a cada 5 minutos (lib/vale-o-escrito/banco.ts).
export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const s = textosDoObservatorio(lang);
  return paginaMeta(lang, "/vale-o-escrito/arsenal", s.arsenal.titulo, s.arsenal.lead);
}

/**
 * O "Arsenal" (T31 3.5 e 3.7): o catálogo buscável de tudo o que está publicado (casos, eventos, documentos e as
 * relações com fonte entre pessoas e organizações). O servidor lê os arquivos conferidos e o componente filtra no
 * navegador. O layout já devolve 404 com o recurso desligado.
 */
export default async function ArsenalDoVale({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await loadLang(params);
  const s = textosDoObservatorio(lang);
  return (
    <div className="ve-pagina ve-doc ve-pagina-larga">
      <CabecaDoVale olho={s.arsenal.olho} titulo={s.arsenal.titulo} voltar={{ href: localePath(lang, "/vale-o-escrito"), texto: s.navegacao.inicio }}>
        {s.arsenal.lead}
      </CabecaDoVale>
      <Arsenal dados={await dadosDoObservatorio(lang)} s={s} lang={lang} />
      <ul className="ve-avisos">
        <li>{s.avisos.presuncao}</li>
        <li>{s.avisos.segundoFonte}</li>
        <li>{s.avisos.semVitimas}</li>
        <li>{s.avisos.curadoriaAnonima}</li>
      </ul>
    </div>
  );
}
