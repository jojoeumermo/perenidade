// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { fill, localePath } from "@/i18n/config";
import { icsSemanal } from "@/lib/agenda";
import { aulasNaSemana, gravarMetas, lerDatas, lerMetas, type Metas, metasPadrao } from "@/lib/meu-estudo";
import type { TextosDoEstudo } from "@/lib/textos-estudo";
import { useI18n } from "../I18n";
import { Barra } from "./Barra";
import { baixar, useGuardado } from "./guardado";

type S = TextosDoEstudo["metas"];

const campo = "mt-1 w-full border-2 border-ink bg-parchment px-3 py-2";

/**
 * Meta da semana (recurso "metas"), opcional: quantas aulas a pessoa quer fazer por semana e um lembrete por arquivo de
 * agenda (.ics), que avisa mesmo com o site fechado. Sem sequência de dias, sem pontos e sem cobrança: a semana
 * começa do zero toda segunda-feira, e o texto nunca culpa ninguém. Tudo fica no aparelho.
 */
export function MetaDaSemana({ s }: { s: S }) {
  const { lang } = useI18n();
  const [metas, recarregar] = useGuardado<Metas>(lerMetas, metasPadrao);
  const [datas] = useGuardado<Record<string, number>>(lerDatas, {});
  const [aviso, setAviso] = useState("");
  const feitas = aulasNaSemana(datas);
  const mudar = (m: Partial<Metas>) => {
    gravarMetas({ ...metas, ...m });
    recarregar();
    setAviso("");
  };

  function lembrete() {
    try {
      const ics = icsSemanal({
        dias: metas.dias,
        hora: metas.hora,
        titulo: s.lembreteTitulo,
        descricao: metas.porSemana ? fill(s.lembreteDescricao, { n: metas.porSemana }) : s.lembreteSemMeta,
        url: `${window.location.origin}${localePath(lang, "/meu-estudo")}`,
        inicio: new Date(),
        id: "semanal",
      });
      baixar("lembrete-de-estudo.ics", ics, "text/calendar");
      setAviso(s.baixado);
    } catch {
      setAviso(s.escolhaDias);
    }
  }

  return (
    <section aria-labelledby="me-meta" className="border border-rule bg-parchment-deep p-5">
      <h2 id="me-meta" className="font-serif text-2xl font-semibold">
        {s.titulo}
      </h2>
      <p className="mt-1 text-ink-soft">{s.lead}</p>
      <label className="mt-4 block max-w-xs">
        {s.quantas}
        <select value={metas.porSemana} onChange={(e) => mudar({ porSemana: Number(e.target.value) })} className={campo}>
          <option value={0}>{s.semMeta}</option>
          {[1, 2, 3, 4, 5, 6, 7, 10, 14].map((n) => (
            <option key={n} value={n}>
              {fill(s.porSemana, { n })}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-4" role="status">
        {metas.porSemana > 0 ? (
          <>
            <p>{fill(s.estaSemana, { a: feitas, b: metas.porSemana })}</p>
            <div className="mt-1 max-w-md">
              <Barra feito={Math.min(feitas, metas.porSemana)} total={metas.porSemana} rotulo={s.titulo} />
            </div>
            <p className="mt-2 text-ink-soft">{feitas >= metas.porSemana ? s.cumprida : s.aindaDaTempo}</p>
          </>
        ) : (
          <p className="text-ink-soft">{fill(s.semMetaFeitas, { n: feitas })}</p>
        )}
      </div>

      <fieldset className="mt-6">
        <legend className="font-semibold">{s.lembrete}</legend>
        <p className="text-xs text-ink-soft">{s.lembreteLead}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {s.dias.map((nome, d) => (
            <label key={nome} className={`cursor-pointer border-2 px-2.5 py-1 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold ${metas.dias.includes(d) ? "border-ink bg-ink text-parchment" : "border-rule"}`}>
              <input type="checkbox" className="sr-only" checked={metas.dias.includes(d)} onChange={() => mudar({ dias: metas.dias.includes(d) ? metas.dias.filter((x) => x !== d) : [...metas.dias, d].sort() })} />
              {nome}
            </label>
          ))}
        </div>
        <label className="mt-3 block max-w-[10rem]">
          {s.hora}
          <input type="time" value={metas.hora} onChange={(e) => mudar({ hora: e.target.value || "19:00" })} className={campo} />
        </label>
        <button type="button" onClick={lembrete} disabled={metas.dias.length === 0} className="mt-3 cursor-pointer bg-ink px-4 py-2 font-sans text-sm font-semibold text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50">
          {s.baixarLembrete}
        </button>
        <p role="status" className="mt-2 min-h-5 text-xs">
          {aviso}
        </p>
        <p className="text-xs text-ink-soft">{s.porQueNaoNotificacao}</p>
      </fieldset>
    </section>
  );
}
