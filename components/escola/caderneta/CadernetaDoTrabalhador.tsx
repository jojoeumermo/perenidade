// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { ConviteDeMatricula, SeloDoAparelho } from "@/components/escola/formatura/ConviteDeMatricula";
import { useCaderneta, useInscricoes, useMatricula } from "@/components/escola/guardado-escola";
import { fill } from "@/i18n/config";
import type { TextosDaFormatura } from "@/i18n/escola/formatura";
import { ordenarCaderneta, registroEditavel, removerRegistro, resumoDaCaderneta, editarRegistro, SECOES_DA_CADERNETA, secaoDoRegistro } from "@/lib/escola/caderneta";
import { acrescentarNaCaderneta, diaEmBrasilia, MAX_DETALHE, MAX_TITULO, type TipoDeRegistro } from "@/lib/escola/estudante";
import { cursoParaConta, type CursoParaFormatura } from "@/lib/escola/formatura";
import { horasDoCurso, horasFeitas } from "@/lib/escola/cursos";
import { useCompleted } from "@/lib/progress";

const TIPOS_NOVOS = ["outro", "tarefa", "caso"] as const satisfies readonly TipoDeRegistro[];

/**
 * A caderneta do trabalhador: registros agrupados por tipo, filtro por curso, "Registrar algo", editar, remover com
 * confirmação e as horas ESTIMADAS por curso. Tudo no aparelho (lucia:escola:caderneta).
 */
export function CadernetaDoTrabalhador({ s, c, cursos, base, idioma }: { s: TextosDaFormatura["caderneta"]; c: TextosDaFormatura["comum"]; cursos: CursoParaFormatura[]; base: string; idioma: string }) {
  const matricula = useMatricula();
  const registros = useCaderneta();
  const inscricoes = useInscricoes();
  const concluidas = useCompleted();
  const [filtro, setFiltro] = useState("");
  const [abrindo, setAbrindo] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [form, setForm] = useState({ tipo: "outro" as (typeof TIPOS_NOVOS)[number], curso: "", data: "", titulo: "", detalhe: "" });
  const [erro, setErro] = useState(false);

  if (!matricula) return <ConviteDeMatricula c={c} base={base} />;

  const titulos = new Map(cursos.map((x) => [x.slug, x.titulo]));
  const paraResumo = inscricoes.flatMap((i) => {
    const curso = cursos.find((x) => x.slug === i.curso);
    if (!curso) return [];
    const conta = cursoParaConta(curso);
    return [{ slug: curso.slug, titulo: curso.titulo, horasFeitas: horasFeitas(conta, concluidas, i.dispensas, conta.minutosDaAula), horasTotais: horasDoCurso(conta, conta.minutosDaAula) }];
  });
  const resumo = resumoDaCaderneta(registros, inscricoes, paraResumo);
  const fmt = new Intl.NumberFormat(idioma, { maximumFractionDigits: 1 });
  const visiveis = ordenarCaderneta(registros.filter((r) => !filtro || r.curso === filtro));

  const abrir = () => {
    setForm({ tipo: "outro", curso: "", data: diaEmBrasilia(new Date()), titulo: "", detalhe: "" });
    setEditando(null);
    setErro(false);
    setAbrindo(true);
  };
  const salvar = (e: React.FormEvent) => {
    e.preventDefault();
    const titulo = form.titulo.trim();
    if (!titulo || !/^\d{4}-\d{2}-\d{2}$/.test(form.data)) return setErro(true);
    if (editando) {
      if (!editarRegistro(editando, { titulo, detalhe: form.detalhe })) return setErro(true);
    } else if (!acrescentarNaCaderneta({ tipo: form.tipo, ...(form.curso ? { curso: form.curso } : {}), data: form.data, titulo, detalhe: form.detalhe.trim() })) {
      return setErro(true);
    }
    setAbrindo(false);
    setEditando(null);
  };

  return (
    <div className="formatura-pilha" data-caderneta="">
      <SeloDoAparelho texto={c.noAparelho} />

      <section className="formatura-cartao" aria-labelledby="caderneta-resumo">
        <h2 id="caderneta-resumo" className="formatura-h2">
          {s.resumoTitulo}
        </h2>
        <p data-total-de-registros={resumo.total}>{fill(s.total, { n: resumo.total })}</p>
        {resumo.cursos.length > 0 ? (
          <>
            <h3 className="formatura-h3">{s.horasTitulo}</h3>
            <ul className="formatura-lista">
              {resumo.cursos.map((x) => (
                <li key={x.slug}>
                  {x.titulo}: {fill(s.horasLinha, { feitas: fmt.format(x.horasFeitas), total: fmt.format(x.horasTotais) })}
                  {x.formado ? ` · ${s.formado}` : ""}
                </li>
              ))}
            </ul>
            <p className="formatura-selo">
              {fill(s.horasSoma, { n: fmt.format(resumo.horasFeitas) })} · {c.estimativa}
            </p>
          </>
        ) : (
          <p className="formatura-fraco">{s.semCursos}</p>
        )}
      </section>

      <div className="formatura-barra">
        {cursos.length > 0 && registros.length > 0 ? (
          <label className="formatura-campo-em-linha">
            <span>{s.filtro}</span>
            <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
              <option value="">{s.todosOsCursos}</option>
              {[...new Set(registros.flatMap((r) => (r.curso ? [r.curso] : [])))].map((slug) => (
                <option key={slug} value={slug}>
                  {titulos.get(slug) ?? slug}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {!abrindo ? (
          <button type="button" className="formatura-botao" onClick={abrir}>
            {s.registrar}
          </button>
        ) : null}
      </div>

      {abrindo ? (
        <form className="formatura-cartao formatura-form" onSubmit={salvar} aria-label={editando ? s.editar : s.registrar}>
          {!editando ? (
            <>
              <label>
                <span>{s.tipoDoRegistro}</span>
                <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as (typeof TIPOS_NOVOS)[number] })}>
                  {TIPOS_NOVOS.map((t) => (
                    <option key={t} value={t}>
                      {s.tipos[t]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>{s.curso}</span>
                <select value={form.curso} onChange={(e) => setForm({ ...form, curso: e.target.value })}>
                  <option value="">{s.semCurso}</option>
                  {cursos.map((x) => (
                    <option key={x.slug} value={x.slug}>
                      {x.titulo}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>{s.data}</span>
                <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} required />
              </label>
            </>
          ) : null}
          <label>
            <span>{s.tituloDoRegistro}</span>
            <input type="text" value={form.titulo} maxLength={MAX_TITULO} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required />
          </label>
          <label>
            <span>{s.detalhe}</span>
            <textarea value={form.detalhe} maxLength={MAX_DETALHE} rows={4} onChange={(e) => setForm({ ...form, detalhe: e.target.value })} />
          </label>
          <p className="formatura-fraco">{s.avisoNomes}</p>
          {erro ? (
            <p role="alert" className="formatura-erro">
              {s.erro}
            </p>
          ) : null}
          <div className="formatura-barra">
            <button type="submit" className="formatura-botao">
              {s.salvar}
            </button>
            <button type="button" className="formatura-botao-fraco" onClick={() => setAbrindo(false)}>
              {s.cancelar}
            </button>
          </div>
        </form>
      ) : null}

      {registros.length === 0 ? (
        <div className="formatura-cartao" data-caderneta-vazia="">
          <h2 className="formatura-h2">{s.vazioTitulo}</h2>
          <p>{s.vazioTexto}</p>
        </div>
      ) : (
        SECOES_DA_CADERNETA.map((secao) => {
          const doGrupo = visiveis.filter((r) => secaoDoRegistro(r) === secao);
          if (doGrupo.length === 0) return null;
          return (
            <section key={secao} aria-labelledby={`secao-${secao}`}>
              <h2 id={`secao-${secao}`} className="formatura-h2">
                {s.secoes[secao]}
              </h2>
              <ul className="formatura-registros">
                {doGrupo.map((r) => (
                  <li key={r.id} className="formatura-cartao" data-registro={r.id}>
                    <p className="formatura-fraco">
                      {r.data}
                      {r.curso ? ` · ${titulos.get(r.curso) ?? r.curso}` : ""}
                    </p>
                    <p className="formatura-titulo-do-registro">{r.titulo}</p>
                    {r.detalhe ? <p className="formatura-detalhe">{r.detalhe}</p> : null}
                    {r.pessoas?.length ? (
                      <p className="formatura-fraco">
                        {s.pessoas}: {r.pessoas.join(", ")}
                      </p>
                    ) : null}
                    {removendo === r.id ? (
                      <div className="formatura-barra" role="alertdialog" aria-label={s.confirmaRemover}>
                        <span>{s.confirmaRemover}</span>
                        <button
                          type="button"
                          className="formatura-botao"
                          onClick={() => {
                            removerRegistro(r.id);
                            setRemovendo(null);
                          }}
                        >
                          {s.simRemover}
                        </button>
                        <button type="button" className="formatura-botao-fraco" onClick={() => setRemovendo(null)}>
                          {s.naoRemover}
                        </button>
                      </div>
                    ) : (
                      <div className="formatura-barra">
                        {registroEditavel(r) ? (
                          <button
                            type="button"
                            className="formatura-botao-fraco"
                            onClick={() => {
                              setForm({ tipo: "outro", curso: r.curso ?? "", data: r.data, titulo: r.titulo, detalhe: r.detalhe });
                              setEditando(r.id);
                              setErro(false);
                              setAbrindo(true);
                            }}
                          >
                            {s.editar}
                          </button>
                        ) : null}
                        <button type="button" className="formatura-botao-fraco" onClick={() => setRemovendo(r.id)}>
                          {s.remover}
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
