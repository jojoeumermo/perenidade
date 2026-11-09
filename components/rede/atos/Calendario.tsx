// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { Botao } from "../ui/Botao";
import type { PropsDaTelaDoPacote } from "../registro";
import { ItemDoAto } from "./ItemDoAto";
import { baixarIcs, Icone } from "./partes";
import { useListaDeAtos, useTextosDosAtos } from "./usar";
import { PREVIA_DOS_ATOS } from "@/lib/rede/cliente-atos";
import type { Ato } from "@/lib/rede/tipos-atos";
import "./atos.css";

/** Agrupa por mês ("novembro de 2026"), na ordem da data. */
function porMes(itens: Ato[], lang: string): [string, Ato[]][] {
  const grupos = new Map<string, Ato[]>();
  for (const a of [...itens].sort((x, y) => x.inicio.localeCompare(y.inicio))) {
    const mes = new Intl.DateTimeFormat(lang, { month: "long", year: "numeric" }).format(new Date(a.inicio));
    grupos.set(mes, [...(grupos.get(mes) ?? []), a]);
  }
  return [...grupos];
}

/**
 * O calendário (/alumia/calendario): os atos da comunidade pedida (?comunidade=slug, pela rota) ou de quem a pessoa segue, por
 * mês, cada um com "Pôr na agenda" (.ics feito neste aparelho). Os encontros de núcleo entram quando a F4 abrir o encaixe.
 */
export default function Calendario({ lang, params }: PropsDaTelaDoPacote) {
  const t = useTextosDosAtos(lang);
  const comunidade = params.comunidade ?? null;
  const { estado, recarregar } = useListaDeAtos("seguindo", { comunidade });
  if (!t) return <div className="al-cal" aria-busy="true" />;
  return (
    <section className="al-cal" aria-labelledby="al-cal-titulo">
      <header className="al-atos-cabeca">
        <Link href={`/${lang}/alumia/atos`} className="al-atos-voltar" aria-label={t.pagina.todos}>
          {Icone.voltar(26)}
        </Link>
        <h1 id="al-cal-titulo" className="al-cond al-atos-titulo">
          {t.calendario.titulo}
        </h1>
      </header>
      {PREVIA_DOS_ATOS ? <p className="al-atos-previa">{t.tela.previa}</p> : null}
      {estado.fase === "carregando" ? (
        <p className="al-atos-ajuda">{t.tela.carregando}</p>
      ) : estado.fase === "erro" ? (
        <div className="al-atos-vazio" role="alert">
          <p>{t.tela.erro}</p>
          <Botao variante="contorno" onClick={recarregar}>
            {t.tela.tentar}
          </Botao>
        </div>
      ) : estado.dados.length === 0 ? (
        <p className="al-atos-ajuda">{t.aba.vazio}</p>
      ) : (
        porMes(estado.dados, lang).map(([mes, atos]) => (
          <section key={mes} aria-label={mes}>
            <h2 className="al-cond al-cal-mes">{mes}</h2>
            <ul className="al-cal-lista">
              {atos.map((a) => (
                <li key={a.id} className="al-cal-item">
                  <ItemDoAto ato={a} t={t} lang={lang} />
                  {a.situacao !== "cancelado" ? (
                    <Botao variante="fantasma" tamanho="p" aria-label={`${t.acoes.agenda}: ${a.titulo}`} title={t.acoes.agendaAjuda} icone={Icone.agenda(18)} onClick={() => baixarIcs(a, lang)} />
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </section>
  );
}
