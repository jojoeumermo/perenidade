// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { CadernetaDoTrabalhador } from "@/components/escola/caderneta/CadernetaDoTrabalhador";
import { ExportarCaderneta } from "@/components/escola/caderneta/ExportarCaderneta";
import { ImportarComprovante } from "@/components/escola/caderneta/ImportarComprovante";
import { SoComMatricula } from "@/components/escola/formatura/ConviteDeMatricula";
import { PaginaDaFormatura } from "@/components/escola/formatura/PaginaDaFormatura";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { textosDaFormatura } from "@/i18n/escola/formatura";
import { cursosParaFormatura } from "@/lib/escola/formatura-servidor";
import { textosDaBase } from "@/lib/escola/textos";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const p = textosDaFormatura(lang).paginas.caderneta;
  return paginaMeta(lang, "/escola/caderneta", `${p.meta} · ${textosDaBase(lang).meta.titulo}`, p.lead);
}

/**
 * A caderneta do trabalhador (E4-14; docs/escola/formatura.md): registros, horas estimadas, importação do comprovante do
 * modo turma e exportação por impressão ou .txt. Tudo no aparelho. Sem matrícula, a página mostra UM aviso só (o que é a
 * matrícula, o que dá, o que pede e o botão para fazer), dentro da caderneta; importar, exportar e a nota de rodapé somem.
 */
export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await loadLang(params);
  const t = textosDaFormatura(lang);
  const cursos = cursosParaFormatura();
  const base = localePath(lang, "/escola");
  return (
    <PaginaDaFormatura lang={lang} texto={t.paginas.caderneta} marca="caderneta">
      <CadernetaDoTrabalhador s={t.caderneta} c={t.comum} cursos={cursos} base={base} idioma={lang} />
      <ImportarComprovante s={t.importar} />
      <ExportarCaderneta s={t.exportar} sc={t.caderneta} c={t.comum} titulosDosCursos={Object.fromEntries(cursos.map((c) => [c.slug, c.titulo]))} />
      <SoComMatricula>
        <p className="formatura-aviso">{t.comum.naoEhDocumento}</p>
      </SoComMatricula>
    </PaginaDaFormatura>
  );
}
