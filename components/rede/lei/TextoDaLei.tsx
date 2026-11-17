// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import type { ReactNode } from "react";
import { CabecaDaLei, Indice, NavDaLei, type PaginaDaLei, Rico, Secao, type SecaoDaLei } from "./base";
import type { TextosDaLei } from "./textos";

/**
 * Uma página de texto da lei (termos, privacidade): o cabeçalho com a versão, a faixa das cinco páginas, o sumário que acompanha
 * a leitura (no computador), as seções numeradas e, no fim, o contato da coordenação. `antes` entra entre a faixa e o texto;
 * `depois`, no fim do texto (o aceite, na página dos termos: primeiro se lê, depois se aceita).
 */
export function TextoDaLei({ lang, t, pagina, titulo, chamada, secoes, antes, depois }: {
  lang: string;
  t: TextosDaLei;
  pagina: PaginaDaLei;
  titulo: string;
  chamada: string;
  secoes: SecaoDaLei[];
  antes?: ReactNode;
  depois?: ReactNode;
}) {
  return (
    <article className="le-pagina">
      <CabecaDaLei lang={lang} t={t} titulo={titulo} chamada={chamada} comVersao />
      <NavDaLei lang={lang} t={t} aberta={pagina} />
      {antes}
      <div className="le-corpo">
        <Indice t={t} secoes={secoes} />
        <div>
          {secoes.map((secao, i) => (
            <Secao key={secao.id} lang={lang} secao={secao} n={i + 1} />
          ))}
          <p className="le-nota">
            <Rico lang={lang} texto={t.comum.contato} />
          </p>
          {depois}
        </div>
      </div>
    </article>
  );
}
