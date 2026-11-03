// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "@/components/Link";
import { fill, type Locale, localePath } from "@/i18n/config";
import type { TextosDaTurma } from "@/i18n/escola/turma";
import { arrobaNaRede, type Orientador } from "@/lib/escola/turma-do-curso";

/**
 * A orientação do projeto final (R1-38): quem tem vaga no curso, da lista content/escola/orientadores.json (curada pela
 * coordenação, com autorização de cada pessoa), e como pedir: mensagem na Rede Lúcia pelo perfil público ou o e-mail
 * público do Instituto. As vagas são controladas pela coordenação no arquivo. O papel "mentoria" do painel não muda.
 */
export function Orientacao({
  orientadores,
  tituloDoCurso,
  s,
  lang,
}: {
  orientadores: Orientador[];
  tituloDoCurso: string;
  s: TextosDaTurma["orientacao"];
  lang: Locale;
}) {
  return (
    <section
      className="turma-bloco"
      aria-labelledby="turma-orientacao"
      data-orientacao=""
    >
      <h2 id="turma-orientacao" className="turma-bloco-titulo">
        {s.titulo}
      </h2>
      <p className="turma-bloco-texto">{s.texto}</p>
      {orientadores.length ? (
        <ul className="turma-lista">
          {orientadores.map((o) => (
            <li key={o.apelido} className="turma-orientador">
              <p>
                <span className="font-semibold">{o.apelido}</span> ·{" "}
                {o.vagasSemestre === 1
                  ? s.vagaUma
                  : fill(s.vagas, { n: o.vagasSemestre })}
              </p>
              {o.contato.tipo === "rede" ? (
                <p className="mt-1 text-sm">
                  {fill(s.pelaRede, { perfil: arrobaNaRede(o.contato.valor) })}{" "}
                  <Link
                    href={localePath(lang, "/comunidade")}
                    className="underline hover:text-oxblood"
                  >
                    {s.abrirRede}
                  </Link>
                </p>
              ) : (
                <p className="mt-1 text-sm">
                  {fill(s.peloEmail, {
                    email: o.contato.valor,
                    curso: tituloDoCurso,
                  })}{" "}
                  <a
                    href={`mailto:${o.contato.valor}`}
                    className="underline hover:text-oxblood"
                  >
                    {o.contato.valor}
                  </a>
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="turma-nota">{s.nenhum}</p>
      )}
      <p className="turma-nota text-sm">{s.mentoria}</p>
    </section>
  );
}
