// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { baixar } from "@/components/estudo/guardado";
import { useNoNavegador } from "@/components/escola/formatura/usar-formatura";
import { useCaderneta, useMatricula } from "@/components/escola/guardado-escola";
import type { TextosDaFormatura } from "@/i18n/escola/formatura";
import {
  cabecalhoDaCaderneta,
  type OpcoesDaCaderneta,
  registrosParaExportar,
  SECOES_DA_CADERNETA,
  secaoDoRegistro,
  textoDaCaderneta,
} from "@/lib/escola/caderneta";
import { diaEmBrasilia } from "@/lib/escola/estudante";

/**
 * Exportar a caderneta: escolher os registros, imprimir ou salvar em PDF (a impressão do navegador, como a carteirinha) ou
 * baixar .txt. Nomes de terceiros e matrícula saem DESLIGADOS. O "nome na folha" fica só em memória.
 */
export function ExportarCaderneta({
  s,
  sc,
  c,
  titulosDosCursos,
}: {
  s: TextosDaFormatura["exportar"];
  sc: TextosDaFormatura["caderneta"];
  c: TextosDaFormatura["comum"];
  titulosDosCursos: Record<string, string>;
}) {
  const matricula = useMatricula();
  const registros = useCaderneta();
  const noNavegador = useNoNavegador();
  const [fora, setFora] = useState<string[]>([]);
  const [terceiros, setTerceiros] = useState(false);
  const [comMatricula, setComMatricula] = useState(false);
  const [nome, setNome] = useState("");
  // Sem matrícula, o aviso único fica com a caderneta (CadernetaDoTrabalhador): esta parte não repete o aviso.
  if (!matricula) return null;

  const ids = registros.map((r) => r.id).filter((id) => !fora.includes(id));
  const opcoes: OpcoesDaCaderneta = {
    rotulos: {
      secoes: sc.secoes,
      estudante: s.estudante,
      titulo: s.tituloDaFolha,
      matricula: s.matriculaRotulo,
      data: s.dataRotulo,
      quemAvaliou: s.quemAvaliou,
      curso: sc.curso,
      naoEhDocumento: c.naoEhDocumento,
      vazio: s.folhaVazia,
    },
    dia: diaEmBrasilia(new Date()),
    ids,
    incluirNomesDeTerceiros: terceiros,
    incluirMatricula: comMatricula,
    matricula: matricula.numero,
    apelido: matricula.apelido,
    nomeNaFolha: nome,
    titulosDosCursos,
  };
  const escolhidos = registrosParaExportar(registros, ids);
  const cabecalho = cabecalhoDaCaderneta(opcoes);

  const folha = (
    <article className="caderneta-folha">
      <header>
        <h1>{cabecalho[0]}</h1>
        {cabecalho.slice(1).map((l) => (
          <p key={l}>{l}</p>
        ))}
      </header>
      {escolhidos.length === 0 ? <p>{s.folhaVazia}</p> : null}
      {SECOES_DA_CADERNETA.map((secao) => {
        const doGrupo = escolhidos.filter((r) => secaoDoRegistro(r) === secao);
        if (doGrupo.length === 0) return null;
        return (
          <section key={secao}>
            <h2>{sc.secoes[secao]}</h2>
            <ul>
              {doGrupo.map((r) => (
                <li key={r.id}>
                  <strong>{r.data}</strong> {r.titulo}
                  {r.curso ? <em> · {titulosDosCursos[r.curso] ?? r.curso}</em> : null}
                  {r.detalhe ? <p>{r.detalhe}</p> : null}
                  {terceiros && r.pessoas?.length ? (
                    <p>
                      {s.quemAvaliou}: {r.pessoas.join(", ")}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <footer>{c.naoEhDocumento}</footer>
    </article>
  );

  return (
    <section className="formatura-cartao formatura-form" aria-labelledby="exportar-titulo" data-exportar="">
      <h2 id="exportar-titulo" className="formatura-h2">
        {s.titulo}
      </h2>
      <p>{s.lead}</p>
      {registros.length === 0 ? (
        <p className="formatura-fraco">{s.nadaParaExportar}</p>
      ) : (
        <>
          <fieldset>
            <legend>{s.selecionar}</legend>
            {registros.map((r) => (
              <label key={r.id} className="formatura-marca">
                <input type="checkbox" checked={!fora.includes(r.id)} onChange={(e) => setFora(e.target.checked ? fora.filter((x) => x !== r.id) : [...fora, r.id])} />
                <span>
                  {r.data} · {r.titulo}
                </span>
              </label>
            ))}
          </fieldset>
          <label className="formatura-marca">
            <input type="checkbox" checked={terceiros} onChange={(e) => setTerceiros(e.target.checked)} />
            <span>{s.nomesDeTerceiros}</span>
          </label>
          {terceiros ? <p className="formatura-fraco">{s.nomesDeTerceirosAviso}</p> : null}
          <label className="formatura-marca">
            <input type="checkbox" checked={comMatricula} onChange={(e) => setComMatricula(e.target.checked)} />
            <span>{s.incluirMatricula}</span>
          </label>
          <label>
            <span>{s.nomeNaFolha}</span>
            <input type="text" maxLength={80} value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="off" />
          </label>
          <p className="formatura-fraco">{s.nomeNaFolhaAviso}</p>
          <div className="formatura-barra no-print">
            <button type="button" className="formatura-botao" onClick={() => window.print()}>
              {s.imprimir}
            </button>
            <button type="button" className="formatura-botao-fraco" onClick={() => baixar("caderneta-escola-lucia-maria.txt", textoDaCaderneta(registros, opcoes), "text/plain;charset=utf-8")}>
              {s.baixarTxt}
            </button>
          </div>
          <p className="formatura-fraco">{s.imprimirDica}</p>
          <h3 className="formatura-h3">{s.previa}</h3>
          <div className="caderneta-previa">{folha}</div>
          {noNavegador ? createPortal(<div className="caderneta-impressao">{folha}</div>, document.body) : null}
        </>
      )}
    </section>
  );
}
