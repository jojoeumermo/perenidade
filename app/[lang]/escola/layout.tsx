// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { notFound } from "next/navigation";
import { NavDaEscola } from "@/components/escola/NavDaEscola";
import { loadLang } from "@/i18n";
import { textosDaBase } from "@/lib/escola/textos";
import { ligado } from "@/lib/recursos";

/**
 * A moldura de todas as páginas da Escola Lúcia Maria (/escola e abaixo): a faixa de links da Escola e o wrapper com
 * data-escola. Desligada (recurso "escola", que só liga pelo nome), nenhuma página daqui existe.
 * O E4-09 acrescenta aqui data-semestre (e o que mais o calendário pedir) no mesmo wrapper.
 */
export default async function EscolaLayout({ children, params }: LayoutProps<"/[lang]/escola">) {
  if (!ligado("escola")) notFound();
  const { lang } = await loadLang(params);
  const s = textosDaBase(lang);
  return (
    <div data-escola="">
      <NavDaEscola lang={lang} s={s.nav} />
      {children}
    </div>
  );
}
