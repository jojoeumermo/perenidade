// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "@/components/Link";
import { fill, htmlLang, type Locale, localePath } from "@/i18n/config";
import type { TextosDaVida } from "@/i18n/escola/vida";
import { agrupadasPorMes, type Luta } from "@/lib/escola/lutas";
import { HojeNaLuta, PorNaAgenda } from "./HojeNaLuta";

const MAX_FATOS = 3;

/**
 * O Mapa das lutas: um mapa NO TEMPO, por mês. Servidor, sem parâmetros: a página é estática. O filtro "feriados do
 * campus" / "todas as datas" são links (:target no CSS), sem JavaScript. Só o feriado é "feriado do campus"; a data que
 * só tem fato é "data de memória". HojeNaLuta (cliente, pequeno) destaca hoje e a próxima data.
 */
export function LutasDoAno({ lutas, s, lang, proposto }: { lutas: Luta[]; s: TextosDaVida["lutas"]; lang: Locale; proposto: string | null }) {
  const local = htmlLang[lang];
  const mes = (n: number) => new Intl.DateTimeFormat(local, { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2024, n - 1, 1)));
  const dia = (mmdd: string) => new Intl.DateTimeFormat(local, { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(Date.parse(`2024-${mmdd}T00:00:00Z`)));
  return (
    <div className="lutas-raiz" data-lutas="">
      <span id="so-feriados" className="lutas-ancora" />
      <span id="todas" className="lutas-ancora" />
      {proposto ? <p className="vida-aviso">{proposto}</p> : null}
      <HojeNaLuta lutas={lutas.filter((l) => l.feriado).map((l) => ({ ...l, fatos: [] }))} s={s} />
      <nav className="lutas-filtros" aria-label={s.titulo}>
        <a href="#so-feriados" className="vida-botao-claro">
          {s.filtroFeriados}
        </a>
        <a href="#todas" className="vida-botao-claro">
          {s.filtroTodas}
        </a>
      </nav>
      <p className="vida-nota">{s.avisoMemoria}</p>
      {agrupadasPorMes(lutas).map(({ mes: m, lutas: doMes }) => (
        <section key={m} className="lutas-mes" aria-label={mes(m)}>
          <h2 className="vida-titulo capitalize">{mes(m)}</h2>
          {doMes.map((l) => (
            <article key={l.dia} id={`luta-${l.dia}`} className="lutas-luta" data-feriado={l.feriado ? "true" : "false"} data-dia={l.dia}>
              <h3>
                <span className="lutas-dia">{dia(l.dia)}</span>
                <span className="lutas-etiqueta">{l.feriado ? s.feriado : s.memoria}</span>
              </h3>
              {l.nome ? (
                <p className="font-semibold" lang="pt">
                  {l.nome}
                </p>
              ) : null}
              {l.fatos.length ? (
                <>
                  <p className="vida-nota">{s.fatos}</p>
                  <ul className="lutas-fatos" lang="pt">
                    {l.fatos.slice(0, MAX_FATOS).map((f) => (
                      <li key={`${f.ano}-${f.link}`}>
                        <span className="font-semibold">{f.ano}:</span> {f.texto}{" "}
                        <a href={f.link} target="_blank" rel="noreferrer" className="underline hover:text-oxblood">
                          {s.fonte}
                        </a>
                      </li>
                    ))}
                  </ul>
                  {l.fatos.length > MAX_FATOS ? <p className="vida-nota">{fill(s.mais, { n: l.fatos.length - MAX_FATOS })}</p> : null}
                </>
              ) : null}
              <div className="vida-botoes">
                {l.aula ? (
                  <Link href={localePath(lang, `/trilhas/${l.aula}`)} className="vida-botao-claro">
                    {s.aula}
                  </Link>
                ) : null}
                {l.fonte ? (
                  <a href={l.fonte} target="_blank" rel="noreferrer" className="vida-botao-claro">
                    {s.fonte}
                  </a>
                ) : null}
                <PorNaAgenda luta={{ ...l, fatos: l.fatos.slice(0, 1) }} texto={s.agenda} />
              </div>
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}