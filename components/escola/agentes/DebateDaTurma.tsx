// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useId, useMemo, useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { useI18n } from "@/components/I18n";
import Link from "@/components/Link";
import { type Locale, localePath } from "@/i18n/config";
import type { TextosDoAcompanhante } from "@/i18n/escola/acompanhante";
import type { TextosDosAgentes } from "@/i18n/escola/agentes";
import { conferirCampo, LIMITES_DOS_AGENTES, resumoDaAula } from "@/lib/escola/agentes";
import type { SearchEntry, SearchHit } from "@/lib/search";
import { Conversa } from "../acompanhante/Conversa";
import { conferirComTextos } from "./conferir";

type Buscador = (consulta: string, limite?: number) => SearchHit[];
let buscador: Promise<Buscador> | null = null;
/** O índice leve do site (/<idioma>/indice-leve.json, só as aulas) e o mesmo motor da busca do círculo de cultura (E4-15). */
function carregarBuscador(lang: Locale): Promise<Buscador> {
  buscador ??= Promise.all([
    fetch(localePath(lang, "/indice-leve.json")).then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<SearchEntry[]>;
    }),
    import("@/lib/search"),
    import("@/content/busca.json"),
  ]).then(([entradas, { buildSearch }, sinonimos]) =>
    buildSearch(
      entradas.filter((e) => e.kind === "aula"),
      (sinonimos as { default?: Record<string, string> }).default ?? (sinonimos as unknown as Record<string, string>),
    ),
  );
  buscador.catch(() => {
    buscador = null;
  });
  return buscador;
}

interface AulaEscolhida {
  titulo: string;
  href: string;
  resumo: string;
}

/**
 * Agente da turma (modo "turma" do assistente): quem facilita acha uma aula no índice leve, vê o resumo copiado do
 * índice (sem reescrever), edita se quiser e pede de 4 a 6 perguntas abertas. Só o título e o resumo vão ao assistente.
 * Nada é escrito no círculo de cultura: o botão só leva até ele.
 */
export function DebateDaTurma({ s, comum, a }: { s: TextosDosAgentes["turma"]; comum: TextosDosAgentes["comum"]; a: TextosDoAcompanhante }) {
  const { lang } = useI18n();
  const id = useId();
  const [consulta, setConsulta] = useState("");
  const [estado, setEstado] = useState<"parado" | "buscando" | "erro">("parado");
  const [achados, setAchados] = useState<SearchHit[] | null>(null);
  const [aula, setAula] = useState<AulaEscolhida | null>(null);
  const [resumo, setResumo] = useState("");
  const conferir = useMemo(() => conferirComTextos(comum), [comum]);
  const dadoNoResumo = conferirCampo(resumo);

  async function procurar() {
    const q = consulta.trim();
    if (q.length < 2) return;
    setEstado("buscando");
    try {
      const buscar = await carregarBuscador(lang as Locale);
      setAchados(buscar(q, 8));
      setEstado("parado");
    } catch {
      setAchados(null);
      setEstado("erro");
    }
  }

  function escolher(hit: SearchHit) {
    const texto = resumoDaAula(hit.entry);
    setAula({ titulo: hit.entry.title.slice(0, LIMITES_DOS_AGENTES.tituloMax), href: hit.entry.href, resumo: texto });
    setResumo(texto);
  }

  return (
    <div data-debate-da-turma>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void procurar();
        }}
      >
        <label htmlFor={`${id}-q`} className="block font-semibold">
          {s.buscar}
        </label>
        <p className="text-sm text-ink-soft">{s.buscarDica}</p>
        <p className="mt-2 flex flex-wrap gap-2">
          <input id={`${id}-q`} type="search" value={consulta} onChange={(e) => setConsulta(e.target.value.slice(0, 120))} className="acompanhante-campo min-w-0 flex-1 border-2 border-ink bg-parchment px-3 py-2 font-serif text-base" data-busca-aula />
          <button type="submit" className="acompanhante-botao" disabled={consulta.trim().length < 2 || estado === "buscando"}>
            {s.buscar}
          </button>
        </p>
      </form>
      <div role="status" aria-live="polite">
        {estado === "buscando" && <p className="mt-2 text-ink-soft">{s.buscando}</p>}
        {estado === "erro" && <p className="mt-2 text-oxblood">{s.semIndice}</p>}
        {achados && achados.length === 0 && estado === "parado" && <p className="mt-2 text-ink-soft">{s.nada}</p>}
      </div>
      {achados && achados.length > 0 && (
        <ul className="mt-3 space-y-2" data-aulas-achadas>
          {achados.map((hit) => (
            <li key={hit.entry.href} className="acompanhante-modo flex flex-wrap items-center justify-between gap-2">
              <span>
                <span className="block font-semibold">{hit.entry.title}</span>
                <span className="block text-xs text-ink-soft">{hit.entry.context}</span>
              </span>
              <button type="button" className="acompanhante-botao-claro" onClick={() => escolher(hit)} data-usar-aula>
                {s.escolher}
              </button>
            </li>
          ))}
        </ul>
      )}

      {aula && (
        <section className="mt-8" aria-labelledby={`${id}-aula`}>
          <h2 id={`${id}-aula`} className="font-serif text-2xl font-semibold">
            {s.aulaEscolhida}: {aula.titulo}
          </h2>
          <label htmlFor={`${id}-resumo`} className="mt-3 block font-semibold">
            {s.resumo}
          </label>
          <p className="text-sm text-ink-soft">{s.resumoDica}</p>
          <textarea
            id={`${id}-resumo`}
            value={resumo}
            rows={6}
            maxLength={LIMITES_DOS_AGENTES.resumoMax}
            onChange={(e) => setResumo(e.target.value.slice(0, LIMITES_DOS_AGENTES.resumoMax))}
            className="acompanhante-campo mt-2 w-full border-2 border-ink bg-parchment px-3 py-2 font-serif text-base"
            data-resumo-da-aula
          />
          {dadoNoResumo && (
            <p role="status" className={`mt-1 text-sm font-semibold ${dadoNoResumo.bloqueia ? "text-oxblood" : ""}`}>
              {comum.dadoPessoal[dadoNoResumo.aviso]}
            </p>
          )}
          <p className="mt-3 text-sm font-semibold">{s.aviso}</p>
          <div className="mt-4">
            <Conversa
              key={aula.href}
              s={a}
              modo="turma"
              contexto={{ trecho: resumo }}
              itens={["resumo"]}
              campo={{ rotulo: s.tituloDaAula, max: LIMITES_DOS_AGENTES.tituloMax, min: LIMITES_DOS_AGENTES.tituloMin, linhas: 2, lang }}
              inicial={aula.titulo}
              botao={s.botao}
              umaVez
              semServidor="aviso"
              avisoDaResposta={s.aviso}
              bloqueado={resumo.trim().length === 0 || Boolean(dadoNoResumo?.bloqueia)}
              conferirTexto={conferir}
              acaoNaResposta={(texto) => (
                <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <CopyButton text={texto} label={s.copiarPerguntas} done={comum.copiado} />
                  <Link href={aula.href} className="underline hover:text-oxblood">
                    {s.verAula}
                  </Link>
                  <Link href={localePath(lang as Locale, "/escola/turmas/circulo")} className="underline hover:text-oxblood">
                    {s.levarParaCirculo}
                  </Link>
                </p>
              )}
            />
          </div>
        </section>
      )}
      <p className="mt-8 border-l-4 border-gold pl-3 text-sm">
        {s.semServidor}{" "}
        <Link href={localePath(lang as Locale, "/escola/turmas/circulo")} className="underline hover:text-oxblood">
          {s.levarParaCirculo}
        </Link>
      </p>
    </div>
  );
}
