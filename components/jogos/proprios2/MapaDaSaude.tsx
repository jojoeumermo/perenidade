// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { Aviso, Fontes, Moldura } from "./Base";
import { CASAS, FONTES_SAUDE, SIGILO, avaliarEscolha, ordemSugerida } from "./dados/saude";

const MAX = 3;

/** Etapa 1: marcar até 3 casas para a semana. Etapa 2: o sigilo. Famílias e nomes são inventados. */
export default function MapaDaSaude() {
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [conferido, setConferido] = useState(false);
  const [sigilo, setSigilo] = useState<number | null>(null);

  const alternar = (id: string) => {
    if (conferido) return;
    setMarcadas((m) => (m.includes(id) ? m.filter((x) => x !== id) : m.length < MAX ? [...m, id] : m));
  };
  const r = avaliarEscolha(CASAS, marcadas);
  const recomecar = () => {
    setMarcadas([]);
    setConferido(false);
    setSigilo(null);
  };

  return (
    <Moldura titulo="Mapa da saúde popular" intro="Você é agente comunitário de saúde (ACS) numa micro-área com 6 famílias. Todas são inventadas. Esta semana só dá para visitar 3 casas primeiro: quais? O ACS não diagnostica nem receita: ele visita, escuta, orienta e encaminha à equipe.">
      <p className="font-sans text-xs font-bold uppercase tracking-[0.1em]" role="status" aria-live="polite">
        Marcadas: {marcadas.length} de {MAX}
      </p>
      <ul className="mt-2 grid gap-3 sm:grid-cols-2">
        {CASAS.map((c) => {
          const on = marcadas.includes(c.id);
          return (
            <li key={c.id} className={`border-2 p-3 ${on ? "border-prelo-texto bg-folha" : "border-ink"}`}>
              <p className="font-serif text-lg font-semibold">{c.familia}</p>
              <p className="mt-1 text-sm leading-relaxed">{c.situacao}</p>
              <button type="button" onClick={() => alternar(c.id)} aria-pressed={on} disabled={conferido || (!on && marcadas.length >= MAX)} className="botao botao-papel mt-2 cursor-pointer text-sm">
                {on ? "Desmarcar a visita" : "Visitar primeiro"}
              </button>
              {conferido ? (
                <p className="mt-2 border-l-4 border-ink pl-2 text-xs leading-relaxed text-ink-soft">
                  <strong>{c.prioridade === 3 ? "Ir primeiro. " : c.prioridade === 2 ? "Esta semana ou na seguinte. " : "Rotina. "}</strong>
                  {c.porque}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      {!conferido ? (
        <button type="button" onClick={() => setConferido(true)} disabled={marcadas.length === 0} className="botao mt-4 cursor-pointer">
          Conferir as escolhas
        </button>
      ) : (
        <div>
          <Aviso>
            Você marcou {r.acertos} das {r.total} casas mais urgentes.{" "}
            {r.faltou.length ? `Ficou de fora: ${r.faltou.map((c) => c.familia.toLowerCase()).join(", ")}.` : "Nenhuma urgente ficou de fora."} Na vida real, a equipe de saúde classifica o risco junto com o ACS; aqui a ordem é só um exercício.{" "}
            Ordem sugerida: {ordemSugerida(CASAS).map((c) => c.familia).join("; ")}.
          </Aviso>
          <div className="mt-5 border-t border-ink/40 pt-4">
            <p className="font-serif text-lg font-semibold">E o sigilo?</p>
            <p className="mt-1 leading-relaxed">{SIGILO.cena}</p>
            <div className="mt-2 grid gap-2">
              {SIGILO.opcoes.map((o, n) => (
                <button key={o.texto} type="button" onClick={() => setSigilo(n)} aria-pressed={sigilo === n} className="guia-opcao text-left">
                  {o.texto}
                </button>
              ))}
            </div>
            {sigilo !== null ? <Aviso><strong>{SIGILO.opcoes[sigilo].certa ? "Certo. " : "Pense de novo. "}</strong>{SIGILO.opcoes[sigilo].retorno}</Aviso> : null}
          </div>
          <button type="button" onClick={recomecar} className="botao botao-papel mt-4 cursor-pointer">
            Jogar de novo
          </button>
        </div>
      )}
      <Fontes fontes={FONTES_SAUDE} nota="Lei 11.350/2006, art. 3º, §§ 2º e 3º (visitas, grupos acompanhados, registro só para controlar e planejar as ações); LGPD, art. 5º, II e art. 11 (dado de saúde é dado pessoal sensível). A lei não define uma ordem de prioridade: a ordem do jogo é didática." />
    </Moldura>
  );
}
