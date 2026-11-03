// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { ConviteDeMatricula } from "@/components/escola/formatura/ConviteDeMatricula";
import { PublicarNaGaveta } from "@/components/escola/formatura/PublicarNaGaveta";
import { useProjetos } from "@/components/escola/formatura/usar-formatura";
import { useCaderneta, useInscricoes, useMatricula } from "@/components/escola/guardado-escola";
import Link from "@/components/Link";
import type { TextosDaFormatura } from "@/i18n/escola/formatura";
import { diaEmBrasilia } from "@/lib/escola/estudante";
import {
  apresentacaoFeita,
  type CursoParaFormatura,
  ETAPAS_DO_PROJETO,
  gravarEtapa,
  gravarTemaENotas,
  MAX_NOTAS,
  MAX_TEMA,
  REGRAS_DA_FORMATURA,
} from "@/lib/escola/formatura";

function TemaENotas({ s, curso, tema, notas }: { s: TextosDaFormatura["projeto"]; curso: string; tema: string; notas: string }) {
  const [t, setT] = useState(tema);
  const [n, setN] = useState(notas);
  const [salvo, setSalvo] = useState<boolean | null>(null);
  return (
    <form
      className="formatura-form"
      onSubmit={(e) => {
        e.preventDefault();
        setSalvo(gravarTemaENotas(curso, t, n));
      }}
    >
      <label>
        <span>{s.tema}</span>
        <input type="text" value={t} maxLength={MAX_TEMA} onChange={(e) => setT(e.target.value)} />
      </label>
      <label>
        <span>{s.notas}</span>
        <textarea value={n} rows={5} maxLength={MAX_NOTAS} onChange={(e) => setN(e.target.value)} />
      </label>
      <p className="formatura-fraco">{s.avisoNotas}</p>
      <div className="formatura-barra">
        <button type="submit" className="formatura-botao">
          {s.salvar}
        </button>
        {salvo !== null ? (
          <span role="status" className={salvo ? "formatura-fraco" : "formatura-erro"}>
            {salvo ? s.salvo : s.naoSalvou}
          </span>
        ) : null}
      </div>
    </form>
  );
}

/**
 * O projeto final de cada curso em 6 etapas, com a data em que a pessoa marcou cada uma. A apresentação vale sozinha se
 * houve banca popular registrada na caderneta (E4-15). Guarda em lucia:escola:projeto, só neste aparelho.
 */
export function ProjetoFinal({
  s,
  g,
  c,
  cursos,
  base,
  gavetaHref,
}: {
  s: TextosDaFormatura["projeto"];
  g: TextosDaFormatura["gaveta"];
  c: TextosDaFormatura["comum"];
  cursos: CursoParaFormatura[];
  base: string;
  gavetaHref: string;
}) {
  const matricula = useMatricula();
  const inscricoes = useInscricoes();
  const caderneta = useCaderneta();
  const projetos = useProjetos();
  const [escolhido, setEscolhido] = useState("");
  if (!matricula) return <ConviteDeMatricula c={c} base={base} />;

  const meus = inscricoes.flatMap((i) => cursos.filter((x) => x.slug === i.curso));
  if (meus.length === 0) {
    return (
      <div className="formatura-cartao" data-sem-curso="">
        <p>{s.semCurso}</p>
        <p>
          <Link href={`${base}/cursos`} className="formatura-botao">
            {s.verCursos}
          </Link>
        </p>
      </div>
    );
  }
  const curso = meus.find((x) => x.slug === escolhido) ?? meus[0];
  const p = projetos.cursos[curso.slug];
  const apresentacao = apresentacaoFeita(projetos, caderneta, curso.slug);
  const obrigatorias = REGRAS_DA_FORMATURA.etapasObrigatorias;

  return (
    <div className="formatura-pilha" data-projeto-final="">
      {meus.length > 1 ? (
        <label className="formatura-campo-em-linha">
          <span>{s.escolhaOCurso}</span>
          <select value={curso.slug} onChange={(e) => setEscolhido(e.target.value)}>
            {meus.map((x) => (
              <option key={x.slug} value={x.slug}>
                {x.titulo}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <h2 className="formatura-h2">{curso.titulo}</h2>
      )}

      <section className="formatura-cartao" aria-labelledby="projeto-enunciado">
        <h3 id="projeto-enunciado" className="formatura-h3">
          {s.enunciado} <span className="formatura-selo">{c.emRevisao}</span>
        </h3>
        <p>{curso.projetoFinal}</p>
      </section>

      <section aria-labelledby="projeto-etapas">
        <h3 id="projeto-etapas" className="formatura-h3">
          {s.etapasTitulo}
        </h3>
        <ol className="formatura-etapas">
          {ETAPAS_DO_PROJETO.map((etapa) => {
            const dia = etapa === "apresentacao" ? apresentacao.dia : (p?.etapas[etapa] ?? null);
            const pelaBanca = etapa === "apresentacao" && apresentacao.pelaBanca;
            const obrigatoria = obrigatorias.includes(etapa);
            return (
              <li key={etapa} className="formatura-cartao" data-etapa={etapa} data-feita={dia ? "" : undefined}>
                <label className="formatura-marca">
                  <input
                    type="checkbox"
                    checked={Boolean(dia)}
                    disabled={pelaBanca}
                    onChange={(e) => gravarEtapa(curso.slug, etapa, e.target.checked ? diaEmBrasilia(new Date()) : null)}
                  />
                  <span>
                    <strong>{s.etapas[etapa].nome}</strong>
                    {obrigatoria ? <span className="formatura-selo">{s.obrigatoria}</span> : null}
                  </span>
                </label>
                <p>{s.etapas[etapa].texto}</p>
                {dia ? (
                  <p className="formatura-fraco">
                    {s.marcadaEm} {dia}
                    {pelaBanca ? ` · ${s.pelaBanca}` : ""}
                  </p>
                ) : null}
                {etapa === "revisao" ? (
                  <p>
                    <Link href={`${base}/turmas/${curso.slug}`} className="formatura-link">
                      {s.linkOrientacao}
                    </Link>
                  </p>
                ) : null}
                {etapa === "apresentacao" ? (
                  <p className="formatura-links">
                    <Link href={`${base}/turmas/banca`} className="formatura-link">
                      {s.linkBanca}
                    </Link>
                    <Link href={`${base}/turmas/${curso.slug}`} className="formatura-link">
                      {s.linkSeminario}
                    </Link>
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>

      <TemaENotas key={`${curso.slug}|${p?.tema ?? ""}|${p?.notas ?? ""}`} s={s} curso={curso.slug} tema={p?.tema ?? ""} notas={p?.notas ?? ""} />

      <PublicarNaGaveta s={g} curso={curso} gavetaHref={gavetaHref} />
    </div>
  );
}
