// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import type { ContextoDoEncaixe } from "../../encaixes";
import { previa } from "../../conversa/base3";
import { BuscaNaComunidade } from "./BuscaNaComunidade";
import { acervo } from "./cliente";
import { Colecoes } from "./Colecoes";
import { Exportar } from "./Exportar";
import { PorMes } from "./PorMes";
import { useTextosDoAcervo } from "./textos";
import "./acervo.css";

type Parte = "colecoes" | "meses" | "buscar" | "exportar";

/**
 * A aba "Acervo" da comunidade (frente 10D, pelo encaixe abasDaComunidade): coleções, arquivo por mês, busca dentro da comunidade e,
 * só para a moderação, exportar. As partes são ladrilhos (Mosaico da Arquibancada); a escolhida fica guardada só na aba do
 * navegador (sessionStorage), nunca no banco.
 */
export function AbaDoAcervo({ lang, s, situacao, slug }: ContextoDoEncaixe & { slug: string }) {
  const t = useTextosDoAcervo(lang);
  const [parte, setParteCrua] = useState<Parte>(() => {
    try {
      const v = sessionStorage.getItem(`acv-parte:${slug}`);
      return v === "meses" || v === "buscar" || v === "exportar" ? v : "colecoes";
    } catch {
      return "colecoes";
    }
  });
  const [modera, setModera] = useState(false);
  const logado = situacao.logado;

  useEffect(() => {
    let vivo = true;
    // Quem pode criar coleção na comunidade é a moderação dela: o mesmo sinal decide se a parte Exportar aparece (o banco confere de novo).
    acervo
      .colecoes({ slug })
      .then((r) => vivo && setModera(r.pode_criar && (previa() || situacao.membro)))
      .catch(() => vivo && setModera(false));
    return () => {
      vivo = false;
    };
  }, [slug, situacao.membro]);

  function setParte(p: Parte) {
    setParteCrua(p);
    try {
      sessionStorage.setItem(`acv-parte:${slug}`, p);
    } catch {
      // sem sessionStorage: só não lembra
    }
  }

  if (!t) return <p role="status" className="al3-vazio">{s.estados.carregando}</p>;
  const partes: [Parte, string, string][] = [
    ["colecoes", t.secoes.colecoes, t.secoes.colecoesDica],
    ["meses", t.secoes.meses, t.secoes.mesesDica],
    ["buscar", t.secoes.buscar, t.secoes.buscarDica],
    ...(modera ? ([["exportar", t.secoes.exportar, t.secoes.exportarDica]] as [Parte, string, string][]) : []),
  ];
  const atual = parte === "exportar" && !modera ? "colecoes" : parte;

  return (
    <div className="acv">
      <nav aria-label={t.secoes.rotulo}>
        <ul className="acv-partes" style={{ listStyle: "none", padding: 0 }}>
          {partes.map(([chave, rotulo, dica]) => (
            <li key={chave}>
              <button type="button" className="acv-parte" style={{ width: "100%" }} aria-current={atual === chave ? "true" : undefined} onClick={() => setParte(chave)}>
                <span className="acv-cond">{rotulo}</span>
                <small>{dica}</small>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      {atual === "colecoes" && <Colecoes alvo={{ slug }} lang={lang} s={s} t={t} logado={logado} />}
      {atual === "meses" && <PorMes slug={slug} lang={lang} s={s} t={t} logado={logado} />}
      {atual === "buscar" && <BuscaNaComunidade slug={slug} lang={lang} s={s} t={t} logado={logado} />}
      {atual === "exportar" && <Exportar slug={slug} lang={lang} t={t} />}
    </div>
  );
}
