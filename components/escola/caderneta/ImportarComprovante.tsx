// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { useMatricula } from "@/components/escola/guardado-escola";
import { fill } from "@/i18n/config";
import type { TextosDaFormatura } from "@/i18n/escola/formatura";
import { acrescentarNaCaderneta } from "@/lib/escola/estudante";
import { type Comprovante, lerComprovantes, registroDoComprovante, resumoDoComprovante } from "@/lib/turma";

/**
 * Cola um ou vários comprovantes do modo turma, mostra "N de M aulas" e guarda na caderneta com o código da turma.
 * O nome que a pessoa escreveu no comprovante NÃO é copiado. Importar o mesmo comprovante de novo substitui o registro.
 */
export function ImportarComprovante({ s }: { s: TextosDaFormatura["importar"] }) {
  const matricula = useMatricula();
  const [texto, setTexto] = useState("");
  const [lidos, setLidos] = useState<Comprovante[] | null>(null);
  const [invalidos, setInvalidos] = useState(0);
  const [apelidos, setApelidos] = useState<Record<string, string>>({});
  const [guardados, setGuardados] = useState<Record<string, boolean>>({});
  // Sem matrícula, o aviso único fica com a caderneta (CadernetaDoTrabalhador): esta parte não repete o aviso.
  if (!matricula) return null;

  const ler = () => {
    const r = lerComprovantes(texto);
    setLidos(r.lidos);
    setInvalidos(r.invalidos);
    setGuardados({});
  };
  const chave = (x: Comprovante) => `${x.s}-${x.d}`;

  return (
    <section className="formatura-cartao formatura-form" aria-labelledby="importar-titulo" data-importar="">
      <h2 id="importar-titulo" className="formatura-h2">
        {s.titulo}
      </h2>
      <p>{s.lead}</p>
      <label>
        <span>{s.campo}</span>
        <textarea value={texto} rows={4} onChange={(e) => setTexto(e.target.value)} placeholder="LUCIA-…" spellCheck={false} />
      </label>
      <div className="formatura-barra">
        <button type="button" className="formatura-botao" onClick={ler} disabled={!texto.trim()}>
          {s.ler}
        </button>
      </div>
      <p className="formatura-fraco">{s.semNome}</p>
      {lidos && lidos.length === 0 ? (
        <p role="status" className="formatura-erro">
          {s.nenhum}
        </p>
      ) : null}
      {invalidos > 0 ? (
        <p role="status" className="formatura-erro">
          {fill(s.invalidos, { n: invalidos })}
        </p>
      ) : null}
      {lidos && lidos.length > 0 ? (
        <ul className="formatura-registros">
          {lidos.map((x) => {
            const r = resumoDoComprovante(x);
            const k = chave(x);
            return (
              <li key={k} className="formatura-cartao" data-comprovante={r.codigo}>
                <p className="formatura-titulo-do-registro">{fill(s.concluiu, { feitas: r.feitas, total: r.total })}</p>
                <p className="formatura-fraco">
                  {s.codigo} {r.codigo} · {r.dia}
                  {r.completo ? ` · ${s.completo}` : ""}
                </p>
                {r.feitas === 0 ? (
                  <p>{s.nadaAGuardar}</p>
                ) : (
                  <>
                    <label>
                      <span>{s.comoChama}</span>
                      <input type="text" maxLength={120} value={apelidos[k] ?? ""} onChange={(e) => setApelidos({ ...apelidos, [k]: e.target.value })} />
                    </label>
                    <div className="formatura-barra">
                      <button
                        type="button"
                        className="formatura-botao"
                        disabled={guardados[k]}
                        onClick={() => {
                          const reg = registroDoComprovante(x, apelidos[k]);
                          if (reg && acrescentarNaCaderneta(reg)) setGuardados({ ...guardados, [k]: true });
                        }}
                      >
                        {guardados[k] ? s.guardado : s.guardar}
                      </button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
