// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useMemo, useState } from "react";
import { Fontes, Moldura } from "./Base";
import { FONTES_ZONEAMENTO, LADO, MAPA_INICIAL, NOTA_USUCAPIAO, USOS, avaliar, type Celula, type Uso } from "./dados/zoneamento";

const ROTULO: Record<Celula, string> = {
  corrego: "córrego",
  casa: "casa antiga",
  vazio: "sem uso",
  moradia: "moradia nova",
  comercio: "comércio",
  verde: "área verde",
  servico: "escola ou posto",
  oficina: "oficina",
};
const SIGLA: Record<Celula, string> = { corrego: "~", casa: "C", vazio: "·", moradia: "M", comercio: "K", verde: "V", servico: "S", oficina: "O" };

/** Mapa de 5 por 5 lotes. Cada lote livre é uma lista de escolha (funciona no teclado e no leitor de tela). */
export default function ZoneamentoPopular() {
  const [mapa, setMapa] = useState<Celula[]>(MAPA_INICIAL);
  const regras = useMemo(() => avaliar(mapa), [mapa]);
  const feitas = regras.filter((r) => r.ok).length;

  return (
    <Moldura titulo="Zoneamento popular" intro="Este bairro cresceu por conta própria: as casas do meio existem há anos. Decida o uso de cada lote livre e confira as regras do lado. Ninguém é expulso: as casas antigas ficam.">
      <div className="grid gap-6 md:grid-cols-[auto_1fr]">
        <div role="group" aria-label="Mapa do bairro, 5 linhas por 5 colunas" className="grid w-fit gap-1" style={{ gridTemplateColumns: `repeat(${LADO}, minmax(0, 1fr))` }}>
          {mapa.map((c, i) => {
            const linha = Math.floor(i / LADO) + 1;
            const coluna = (i % LADO) + 1;
            const fixa = c === "corrego" || c === "casa";
            const nome = `Lote linha ${linha}, coluna ${coluna}`;
            return fixa ? (
              <div key={i} role="img" aria-label={`${nome}: ${ROTULO[c]}`} className={`flex h-16 w-16 items-center justify-center border-2 border-ink font-mono text-lg ${c === "corrego" ? "bg-ink text-parchment" : "bg-folha font-bold"}`}>
                {SIGLA[c]}
              </div>
            ) : (
              <label key={i} className="relative block">
                <span className="sr-only">{nome}</span>
                <span aria-hidden="true" className="pointer-events-none absolute left-1 top-1 font-mono text-lg">{SIGLA[c]}</span>
                <select
                  value={c}
                  onChange={(e) => setMapa((m) => m.map((x, j) => (j === i ? (e.target.value as Uso) : x)))}
                  className="h-16 w-16 cursor-pointer border-2 border-ink bg-transparent pt-6 text-[0.62rem] leading-tight"
                >
                  {USOS.map((u) => (
                    <option key={u.id} value={u.id}>{u.nome}</option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>
        <div>
          <p className="font-sans text-xs font-bold uppercase tracking-[0.1em]" role="status" aria-live="polite">
            Regras cumpridas: {feitas} de {regras.length}
          </p>
          <ul className="mt-2 space-y-2">
            {regras.map((r) => (
              <li key={r.id} className="border-l-4 border-ink pl-3 text-sm leading-relaxed">
                <strong>{r.ok ? "Cumprida. " : "Falta. "}</strong>
                {r.texto}
                <span className="block text-xs text-ink-soft">{r.fonte}</span>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setMapa(MAPA_INICIAL)} className="botao botao-papel mt-4 cursor-pointer">
            Limpar o mapa
          </button>
        </div>
      </div>
      <p className="mt-4 font-sans text-xs leading-relaxed text-ink-soft">
        Legenda: ~ córrego, C casa antiga (zona de interesse social), M moradia nova, K comércio, V área verde, S escola ou posto, O oficina. Mostre o seu desenho a vizinhos e vizinhas: a gestão democrática, com participação da população, é diretriz do Estatuto da Cidade (art. 2º, II).
      </p>
      {feitas === regras.length ? <p role="status" className="mt-3 border-l-4 border-prelo-texto pl-3 leading-relaxed">Todas as regras cumpridas. {NOTA_USUCAPIAO}</p> : null}
      <Fontes fontes={FONTES_ZONEAMENTO} nota="O mapa é um exercício inventado; as três primeiras regras vêm de diretrizes da lei; as outras são do jogo e estão marcadas assim." />
    </Moldura>
  );
}
