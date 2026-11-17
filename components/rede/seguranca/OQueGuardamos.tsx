// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { CabecaDaLei, CarregandoALei, NavDaLei, Rico } from "../lei/base";
import { useTextosDaLei } from "../lei/usarTextos";
import type { PropsDaTelaDoPacote } from "../registro";

/**
 * O que a Alumia guarda (/alumia/o-que-guardamos): cada dado, onde fica, por quanto tempo e quem lê, numa tabela só (no celular,
 * um cartão por dado). Escrito a partir das migrações (a lista conferida está em docs/rede/PRIVACIDADE.md); o que não está aqui a
 * Alumia não guarda. Abre sem conta (components/rede/entrada/PortaoDaAlumia.tsx, LIVRES).
 */
export default function OQueGuardamos({ lang, s }: PropsDaTelaDoPacote) {
  const t = useTextosDaLei(lang);
  if (!t) return <CarregandoALei rotulo={s.estados.carregando} />;
  const g = t.guardamos;
  return (
    <article className="le-pagina">
      <CabecaDaLei lang={lang} t={t} titulo={g.titulo} chamada={g.chamada} />
      <NavDaLei lang={lang} t={t} aberta="guardamos" />
      <nav className="le-guardamos-indice" aria-label={t.comum.indice}>
        <ul>
          {g.grupos.map((grupo, i) => (
            <li key={grupo.titulo}>
              <a href={`#guardamos-${i + 1}`}>{grupo.titulo}</a>
            </li>
          ))}
        </ul>
      </nav>
      <p className="le-guardamos-lugares">
        <Rico lang={lang} texto={g.lugares} />
      </p>
      <div className="le-tabela-caixa">
        <table className="le-tabela">
          <caption className="sr-only">{g.titulo}</caption>
          <thead>
            <tr>
              <th scope="col" className="al-cond">{g.colunas.dado}</th>
              <th scope="col" className="al-cond">{g.colunas.onde}</th>
              <th scope="col" className="al-cond">{g.colunas.tempo}</th>
              <th scope="col" className="al-cond">{g.colunas.quem}</th>
            </tr>
          </thead>
          {g.grupos.map((grupo, i) => (
            <tbody key={grupo.titulo} id={`guardamos-${i + 1}`}>
              <tr>
                <th scope="rowgroup" colSpan={4} className="al-cond">
                  <span>{grupo.titulo}</span>
                </th>
              </tr>
              {grupo.linhas.map((l) => (
                <tr key={l.dado} className={`le-linha${l.tempo === "—" ? " le-nada" : ""}`}>
                  <th scope="row">{l.dado}</th>
                  <td data-rotulo={g.colunas.onde}>{l.onde}</td>
                  <td data-rotulo={g.colunas.tempo}>{l.tempo}</td>
                  <td data-rotulo={g.colunas.quem}>{l.quem}</td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
      <p className="le-nota">
        <Rico lang={lang} texto={g.nota} />
      </p>
      <p className="le-nota">
        <Rico lang={lang} texto={t.comum.contato} />
      </p>
    </article>
  );
}
