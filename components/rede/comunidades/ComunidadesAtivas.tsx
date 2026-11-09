// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import Link from "@/components/Link";
import { comunidades } from "@/lib/rede/cliente-comunidades";
import { listaDeExemplo } from "@/lib/rede/conversa/exemplos";
import { preencher } from "@/lib/rede/preencher";
import { enderecos } from "@/lib/rede/tipos";
import { comunidadesAtivas, corDaComunidadeNova, enderecosCom, postsDaSemana, type ItemDaLista } from "@/lib/rede/tipos-comunidades";
import type { ContextoDoEncaixe } from "../encaixes";
import { IconeBusca, previa, useTextosAlumia3 } from "../conversa/base3";

/**
 * "Comunidades ativas" da coluna da direita (prancha computador-inicio): as quatro com mais posts nos últimos 7 dias, com o anel na
 * cor da comunidade e "N posts esta semana". Só posts, agregados e a partir de 3; nunca quem escreveu nem quantos membros (LGPD
 * art. 5º, II, e art. 11). Sem algoritmo e sem patrocínio: a ordem é a conta, e a regra está escrita embaixo.
 */
export function ComunidadesAtivas({ lang }: ContextoDoEncaixe) {
  const t = useTextosAlumia3(lang);
  const [lista, setLista] = useState<ItemDaLista[] | null>(null);
  useEffect(() => {
    let vivo = true;
    (previa() ? Promise.resolve({ itens: listaDeExemplo() }) : comunidades.lista())
      .then((r) => vivo && setLista(comunidadesAtivas(r.itens)))
      .catch(() => vivo && setLista([]));
    return () => {
      vivo = false;
    };
  }, []);
  if (!t || !lista || lista.length === 0) return null;
  return (
    <section className="al3 al3-ativas" aria-labelledby="al3-ativas">
      <h2 id="al3-ativas" className="al3-cond">{t.ativas.titulo}</h2>
      <ol>
        {lista.map((c) => {
          const n = postsDaSemana(c.posts_7d);
          return (
            <li key={c.slug}>
              <Link href={enderecos.comunidade(lang, c.slug)} className={`al3-cor-${corDaComunidadeNova(c.slug, c.cor)}`}>
                <span className="al3-anel" aria-hidden />
                <span className="al3-nome">{c.nome}</span>
                <span className="al3-cinza">{n === null ? t.ativas.poucos : preencher(t.ativas.semana, { n: n.toLocaleString(lang) })}</span>
              </Link>
            </li>
          );
        })}
      </ol>
      <p className="al3-regra">
        {t.ativas.regra} <Link href={enderecosCom.lista(lang)}>{t.ativas.verTodas}</Link>
      </p>
    </section>
  );
}

/** A busca do alto da coluna ("Buscar pessoas, atos, #temas"): leva a /alumia/buscar?q=, que procura na Alumia e no Fediverso. */
export function BuscaDaColuna({ lang }: ContextoDoEncaixe) {
  const t = useTextosAlumia3(lang);
  if (!t) return null;
  return (
    <form role="search" action={`/${lang}/alumia/buscar`} method="get" className="al3 al3-busca" aria-label={t.busca.rotulo}>
      <IconeBusca />
      <label className="al3-sr" htmlFor="al3-busca-coluna">{t.busca.rotulo}</label>
      <input id="al3-busca-coluna" name="q" type="search" placeholder={t.busca.placeholder} autoComplete="off" enterKeyHint="search" maxLength={100} />
    </form>
  );
}
