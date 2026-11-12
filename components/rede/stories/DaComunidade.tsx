// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import "./stories.css";
import { useEffect, useState, type CSSProperties } from "react";
import { armazemDoAparelho, grupoVisto, lerVistos } from "@/lib/rede/stories/aparelho";
import { anelEmCss } from "@/lib/rede/stories/visual";
import type { Situacao } from "@/lib/rede/tipos";
import type { GrupoDaFaixa } from "@/lib/rede/tipos-stories";
import { Avatar16 } from "../ui/Avatar16";
import { preencherStory, useClienteDosStories, useTextosDosStories } from "./usar";
import { Visor } from "./Visor";

/** Junta os grupos da mesma autora (pelo @), somando os stories e ficando com o instante do mais novo. */
function juntarPorAutora(grupos: GrupoDaFaixa[]): GrupoDaFaixa[] {
  const porHandle = new Map<string, GrupoDaFaixa>();
  for (const g of grupos) {
    const ja = porHandle.get(g.autora.handle);
    if (!ja) porHandle.set(g.autora.handle, { ...g, ids: [...g.ids] });
    else {
      ja.ids = [...new Set([...ja.ids, ...g.ids])];
      if (g.ultimo_em > ja.ultimo_em) ja.ultimo_em = g.ultimo_em;
    }
  }
  return [...porHandle.values()];
}

/**
 * "Stories que falam desta comunidade" (B1): na página da comunidade, as bolinhas de quem tem story no ar que a menciona (ou que
 * foi publicado só para ela). O banco (rede_story_da_comunidade) devolve só os que EU posso ver, e nada em comunidade fechada
 * para quem não é membro. Sem nenhum story, não desenha nada. Como na faixa de Início, abrir é só uma leitura: o "já vi" fica
 * no aparelho e ninguém fica sabendo quem viu.
 */
export default function StoriesDaComunidade({ lang, situacao, slug }: { lang: string; situacao: Situacao; slug: string }) {
  const t = useTextosDosStories(lang);
  const cliente = useClienteDosStories();
  const [estado, setEstado] = useState<{ slug: string; grupos: GrupoDaFaixa[]; vistos: Record<string, number> } | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const logado = situacao.logado || !!cliente?.previa;

  useEffect(() => {
    if (!cliente || !logado) return;
    let vivo = true;
    cliente
      .daComunidade(slug)
      .then((grupos) => {
        if (vivo) setEstado({ slug, grupos, vistos: lerVistos(armazemDoAparelho(), Date.now()) });
      })
      // Sem a função no banco (ou sem rede): a página da comunidade segue inteira, só sem esta fileira.
      .catch(() => vivo && setEstado({ slug, grupos: [], vistos: {} }));
    return () => {
      vivo = false;
    };
  }, [cliente, logado, slug, versao]);

  // Uma bolinha por pessoa: dois stories da mesma autora viram um grupo só (antes saíam duas bolinhas iguais, com a mesma chave).
  const grupos = juntarPorAutora(estado?.slug === slug ? estado.grupos : []);
  if (!t || !cliente || !logado || grupos.length === 0) return null;

  const fila = grupos.map((g) => g.autora.handle);
  const autoras = Object.fromEntries(grupos.map((g) => [g.autora.handle, g.autora]));

  return (
    <section className="al-st-faixa al-st-faixa-comunidade" aria-label={t.b1.comunidade.faixa}>
      <h2 className="al-st-destaques-titulo">{t.b1.comunidade.faixa}</h2>
      <ul className="al-st-faixa-trilho">
        {grupos.map((g) => {
          const visto = grupoVisto(g, estado?.vistos ?? {});
          return (
            <li key={g.autora.handle} className="al-st-faixa-item">
              <button
                type="button"
                className="al-st-bolinha"
                data-visto={visto ? "sim" : "nao"}
                aria-haspopup="dialog"
                aria-label={preencherStory(t.b1.comunidade.abrir, { nome: g.autora.nome })}
                onClick={() => setAberto(g.autora.handle)}
              >
                <span className="al-st-anel" style={{ "--al-st-anel": anelEmCss(g.autora.handle, visto) } as CSSProperties}>
                  <span className="al-st-anel-miolo">
                    <Avatar16 handle={g.autora.handle} cor={g.autora.cor ?? undefined} tamanho={52} />
                  </span>
                </span>
                <span className="al-st-nome" aria-hidden>
                  {g.autora.nome}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {aberto ? (
        <Visor
          key={aberto}
          t={t}
          cliente={cliente}
          lang={lang}
          handle={aberto}
          fila={fila}
          autoras={autoras}
          aoFechar={() => {
            setAberto(null);
            setVersao((v) => v + 1);
          }}
          aoMudou={() => setVersao((v) => v + 1)}
        />
      ) : null}
    </section>
  );
}
