// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useInscricoes } from "@/components/escola/guardado-escola";
import Link from "@/components/Link";
import { fill, type Locale, localePath } from "@/i18n/config";
import type { TextosDaTurma } from "@/i18n/escola/turma";
import type { Monitor } from "@/lib/escola/turma-do-curso";

/**
 * A monitoria do mês (D1-16): quem se formou no curso e atende na sala no horário. A lista vem de
 * content/escola/monitoria.json, curada pela coordenação (só com autorização de cada pessoa). "Quero ser monitor(a)"
 * aparece só para quem tem formadoEm neste curso NESTE aparelho; leva a /voluntarie-se e não manda nada sozinho.
 */
export function Monitoria({
  monitores,
  curso,
  tituloDoCurso,
  s,
  lang,
}: {
  monitores: Monitor[];
  curso: string;
  tituloDoCurso: string;
  s: TextosDaTurma["monitoria"];
  lang: Locale;
}) {
  const inscricoes = useInscricoes();
  const formado = inscricoes.some(
    (i) => i.curso === curso && Boolean(i.formadoEm),
  );
  return (
    <section
      className="turma-bloco"
      aria-labelledby="turma-monitoria"
      data-monitoria=""
    >
      <h2 id="turma-monitoria" className="turma-bloco-titulo">
        {s.titulo}
      </h2>
      <p className="turma-bloco-texto">{s.texto}</p>
      {monitores.length ? (
        <ul className="turma-lista">
          {monitores.map((m) => (
            <li key={`${m.apelido}-${m.horario}`}>
              <span className="font-semibold">{m.apelido}</span> ·{" "}
              {fill(s.horario, { horario: m.horario })}
            </li>
          ))}
        </ul>
      ) : (
        <p className="turma-nota">{s.nenhum}</p>
      )}
      {formado && (
        <div className="turma-convite" data-quero-ser-monitor="">
          <p className="font-semibold">{s.querSer}</p>
          <p className="mt-1">
            {fill(s.querSerTexto, { curso: tituloDoCurso })}
          </p>
          <Link
            href={localePath(lang, "/voluntarie-se")}
            className="botao mt-3"
          >
            {s.voluntarieSe}
          </Link>
        </div>
      )}
    </section>
  );
}
