// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import Link from "@/components/Link";
import { fill, type Locale, localePath } from "@/i18n/config";
import type { TextosDaTurma } from "@/i18n/escola/turma";
import { acrescentarNaCaderneta } from "@/lib/escola/estudante";
import {
  COMPETENCIAS_DA_BANCA,
  type Devolutiva,
  MAX_PESSOAS_DA_BANCA,
  registroDaBanca,
} from "@/lib/escola/turma-do-curso";

type S = TextosDaTurma["banca"];

const vazia: Devolutiva = { clareza: "", curso: "", vida: "", proximo: "" };
const hojeAqui = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
};

/**
 * A ficha de devolutiva da banca popular online (R1-39): por competência, sem nota, para imprimir ou preencher neste
 * aparelho. "Registrar na minha caderneta" grava um registro tipo 'banca' (lib/escola/estudante.ts), que o E4-14 lê
 * como projeto apresentado em banca. Os nomes da banca são opcionais e só entram com a permissão confirmada.
 */
export function BancaPopular({
  cursos,
  s,
  lang,
}: {
  cursos: { slug: string; titulo: string }[];
  s: S;
  lang: Locale;
}) {
  const [curso, setCurso] = useState("");
  const [data, setData] = useState("");
  const [devolutiva, setDevolutiva] = useState<Devolutiva>(vazia);
  const [pessoas, setPessoas] = useState<string[]>(() =>
    Array.from({ length: MAX_PESSOAS_DA_BANCA }, () => ""),
  );
  const [permissao, setPermissao] = useState(false);
  const [estado, setEstado] = useState<
    "" | "registrado" | "falta" | "faltaPermissao"
  >("");

  useEffect(() => {
    const id = window.setTimeout(() => setData((d) => d || hojeAqui()), 0);
    return () => window.clearTimeout(id);
  }, []);

  function registrar() {
    const nomes = pessoas.map((p) => p.trim()).filter(Boolean);
    if (nomes.length && !permissao) return setEstado("faltaPermissao");
    const registro = registroDaBanca(
      { curso, data, devolutiva, pessoas: nomes },
      s.competencias,
      s.tituloDoRegistro,
    );
    if (!registro || !acrescentarNaCaderneta(registro))
      return setEstado("falta");
    setEstado("registrado");
  }

  return (
    <section
      className="banca-ficha"
      aria-labelledby="banca-ficha"
      data-banca-ficha=""
    >
      <h2 id="banca-ficha" className="turma-bloco-titulo">
        {s.fichaTitulo}
      </h2>
      <p className="turma-bloco-texto no-print">{s.fichaTexto}</p>
      <div className="banca-campos">
        <label className="block">
          <span className="turma-rotulo-campo">{s.curso}</span>
          <select
            className="turma-input"
            value={curso}
            onChange={(e) => setCurso(e.target.value)}
            data-banca-curso=""
          >
            <option value="">{s.escolhaCurso}</option>
            {cursos.map((c) => (
              <option key={c.slug} value={c.slug} lang="pt">
                {c.titulo}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="turma-rotulo-campo">{s.data}</span>
          <input
            type="date"
            className="turma-input"
            value={data}
            onChange={(e) => setData(e.target.value)}
          />
        </label>
      </div>
      <ol className="banca-competencias">
        {COMPETENCIAS_DA_BANCA.map((c) => (
          <li key={c}>
            <label className="block">
              <span className="font-serif text-xl font-semibold">
                {s.competencias[c]}
              </span>
              <span className="block text-sm text-ink-soft">
                {s.perguntas[c]}
              </span>
              <textarea
                className="turma-input banca-texto"
                rows={3}
                maxLength={480}
                value={devolutiva[c]}
                onChange={(e) =>
                  setDevolutiva((d) => ({ ...d, [c]: e.target.value }))
                }
                data-banca-devolutiva={c}
              />
            </label>
          </li>
        ))}
      </ol>
      <fieldset className="banca-pessoas">
        <legend className="font-semibold">{s.pessoasTitulo}</legend>
        <p className="text-sm text-ink-soft">{s.pessoasTexto}</p>
        {pessoas.map((p, i) => (
          <label key={i} className="mt-2 block">
            <span className="turma-rotulo-campo">
              {fill(s.pessoa, { n: i + 1 })}
            </span>
            <input
              className="turma-input"
              value={p}
              maxLength={60}
              onChange={(e) =>
                setPessoas((lista) =>
                  lista.map((x, j) => (j === i ? e.target.value : x)),
                )
              }
            />
          </label>
        ))}
        <label className="turma-concordo mt-3">
          <input
            type="checkbox"
            checked={permissao}
            onChange={(e) => setPermissao(e.target.checked)}
          />
          <span>{s.permissao}</span>
        </label>
      </fieldset>
      <div className="turma-botoes no-print">
        <button
          type="button"
          className="botao botao-tinta"
          onClick={registrar}
          data-banca-registrar=""
        >
          {s.registrar}
        </button>
        <button type="button" className="botao" onClick={() => window.print()}>
          {s.imprimir}
        </button>
      </div>
      <p
        role="status"
        className={
          estado === "registrado"
            ? "turma-nota no-print"
            : "turma-aviso no-print"
        }
        data-banca-estado={estado}
      >
        {estado === "registrado"
          ? s.registrado
          : estado === "falta"
            ? s.falta
            : estado === "faltaPermissao"
              ? s.faltaPermissao
              : ""}
        {estado === "registrado" && (
          <>
            {" "}
            <Link
              href={localePath(lang, "/escola/caderneta")}
              className="underline hover:text-oxblood"
            >
              {s.caderneta}
            </Link>
          </>
        )}
      </p>
    </section>
  );
}
