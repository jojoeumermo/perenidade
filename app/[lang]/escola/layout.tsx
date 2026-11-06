// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { notFound } from "next/navigation";
import { FeriadoDoCampus } from "@/components/escola/calendario/FeriadoDoCampus";
import { EstacaoDoAno } from "@/components/escola/EstacaoDoAno";
import { NavDaEscola } from "@/components/escola/NavDaEscola";
import { PortaDaEscola } from "@/components/escola/PortaDaEscola";
import { loadLang } from "@/i18n";
import { estacaoDe, feriadoDoDia } from "@/lib/escola/calendario";
import { FERIADOS, textosDoCampus } from "@/lib/escola/campus-servidor";
import { hojeEmBrasilia } from "@/lib/escola/tempo";
import { textosDaBase } from "@/lib/escola/textos";
import { ligado } from "@/lib/recursos";

/**
 * A moldura de todas as páginas da Escola Revolucionária Lúcia Maria (/escola e abaixo): a porta (só entra quem tem
 * conta no site, a mesma da Comunidade; components/escola/PortaDaEscola.tsx), a faixa de links da Escola e o wrapper
 * com data-escola. Desligada (recurso "escola", que só liga pelo nome), nenhuma página daqui existe.
 * O E4-09 acrescenta aqui data-semestre ("1" | "2" | "ferias"), data-feriado (MM-DD), a estação e a faixa do feriado.
 */
export default async function EscolaLayout({ children, params }: LayoutProps<"/[lang]/escola">) {
  if (!ligado("escola")) notFound();
  const { lang } = await loadLang(params);
  const s = textosDaBase(lang);
  // E4-09: a estação do ano letivo e o feriado do campus do dia em que a página foi feita; o navegador acerta para hoje.
  const c = textosDoCampus(lang);
  const hoje = hojeEmBrasilia();
  const e = s.entrada;
  return (
    <div data-escola="" data-semestre={estacaoDe(hoje)} data-feriado={feriadoDoDia(hoje)?.dia}>
      <PortaDaEscola lang={lang} s={s.porta} e={{ olho: e.olho, titulo: e.titulo, oQueE: e.oQueE, oQueETexto: e.oQueETexto, linhaNaoUniversidade: e.linhaNaoUniversidade }}>
        <NavDaEscola lang={lang} s={s.nav} />
        <EstacaoDoAno feriados={FERIADOS} s={c.estacao} sCal={c.calendario} />
        <FeriadoDoCampus feriados={FERIADOS} s={c.feriado} />
        {children}
      </PortaDaEscola>
    </div>
  );
}
