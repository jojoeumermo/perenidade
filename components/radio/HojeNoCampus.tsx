// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "@/components/Link";
import type { TextosDoSom } from "@/i18n/escola/som";
import { localePath, type Locale } from "@/i18n/config";
import { fatosCuradosDoDia, montarRoteiro, PALAVRAS_POR_MINUTO, type FatoDoRoteiro, type Roteiro } from "@/lib/hoje-no-campus";
import { semanaDe } from "@/lib/lambe-do-dia";
import { OuvirComLeitor } from "./OuvirComLeitor";
import "@/styles/escola-som.css";

/** A aula da semana, só com o que o roteiro usa (o servidor manda as próximas semanas, como na inicial). */
export interface SemanaDoRoteiro {
  semana: number;
  caminho: string;
  titulo: string;
  trilha: string;
  resumo: string;
  minutos: number;
}

export interface FatoCurado extends FatoDoRoteiro {
  /** "MM-DD" */
  dia: string;
}

const nunca = () => () => {};

/** "pt.wikipedia.org › Revolução Cubana", legível (o link guarda o endereço codificado). */
function enderecoLegivel(link: string): string {
  let texto = link.replace(/^https:\/\//, "").replace(/\/wiki\//, " › ");
  try {
    texto = decodeURIComponent(texto);
  } catch {
    // endereço com código quebrado: mostra como veio
  }
  return texto.replace(/_/g, " ");
}

/**
 * Hoje no campus, na página da rádio: o roteiro do dia montado no aparelho (lib/hoje-no-campus.ts), na tela e para
 * ouvir pela voz do aparelho. Em português os fatos vêm da lista curada (content/neste-dia.json, que a página já traz);
 * nos outros idiomas, do nosso /api/neste-dia (os fatos da Wikipédia no idioma). O HTML do servidor é o mesmo para
 * todo mundo (só o título e "montando"): a data e o roteiro entram depois da hidratação.
 */
export function HojeNoCampus({ lang, s, ouvir, curados, semanas }: { lang: Locale; s: TextosDoSom["hoje"]; ouvir: TextosDoSom["ouvir"]; curados: FatoCurado[]; semanas: SemanaDoRoteiro[] }) {
  const agora = useSyncExternalStore(nunca, () => semanaDe(new Date()), () => semanas[0]?.semana ?? 0);
  const aula = semanas.find((x) => x.semana === agora) ?? semanas.at(agora > (semanas.at(-1)?.semana ?? 0) ? -1 : 0) ?? null;
  const [roteiro, setRoteiro] = useState<Roteiro | null>(null);

  useEffect(() => {
    let vivo = true;
    const hoje = new Date();
    const montar = (fatos: FatoDoRoteiro[]) => {
      if (!vivo) return;
      setRoteiro(
        montarRoteiro({
          data: hoje,
          fatos,
          aulaDaSemana: aula ? { titulo: aula.titulo, trilha: aula.trilha, resumo: aula.resumo, minutos: aula.minutos } : null,
          idioma: lang,
          frases: s.roteiro,
        }),
      );
    };
    if (lang === "pt") {
      montar(fatosCuradosDoDia(curados, hoje).map(({ ano, texto, link }) => ({ ano, texto, link })));
    } else {
      // Só os fatos da data de hoje: os dos dias vizinhos (que a API traz para completar) ficam de fora do roteiro.
      fetch(`/api/neste-dia?lang=${lang}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((dados: { dia?: string; fatos?: (FatoDoRoteiro & { dia?: string })[] } | null) => montar((dados?.fatos ?? []).filter((f) => !f.dia || f.dia === dados?.dia)))
        .catch(() => montar([]));
    }
    return () => {
      vivo = false;
    };
  }, [lang, curados, aula, s.roteiro]);

  const minutos = roteiro ? Math.max(1, Math.round(roteiro.palavras / PALAVRAS_POR_MINUTO)) : 0;
  return (
    <section className="hoje-no-campus cartao p-5 sm:p-7" aria-labelledby="hoje-no-campus-titulo" data-hoje-no-campus="">
      <p className="rotulo">{s.rotulo}</p>
      <h2 id="hoje-no-campus-titulo" className="mt-2 font-serif text-3xl font-semibold leading-tight sm:text-4xl">
        {s.titulo}
      </h2>
      <p className="mt-2 max-w-[62ch] font-sans text-ink-soft">{s.lead}</p>
      {!roteiro ? (
        <p className="mt-5 font-sans text-sm text-ink-soft" aria-live="polite">
          {s.montando}
        </p>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
            <OuvirComLeitor alvo="#hoje-no-campus-texto" lang={lang} s={ouvir} />
            <p className="font-mono text-xs uppercase tracking-[0.12em] text-ink-soft">{s.duracao.replace("{n}", String(roteiro.palavras)).replace("{min}", String(minutos))}</p>
          </div>
          <div id="hoje-no-campus-texto" lang={lang === "pt" ? "pt-BR" : lang} className="hoje-roteiro mt-5 max-w-[66ch] space-y-3 font-serif text-lg leading-relaxed">
            {roteiro.partes.map((parte, i) => (
              <p key={`${parte.tipo}-${i}`} className={parte.tipo === "fato" ? "hoje-fato" : undefined}>
                {parte.texto}
              </p>
            ))}
          </div>
          <div className="no-print mt-5 flex flex-wrap items-start gap-x-8 gap-y-3 border-t border-rule pt-4 font-sans text-sm">
            {roteiro.fatos.length > 0 && (
              <div>
                <p className="font-semibold">{s.fontes}</p>
                <ul className="mt-1 space-y-1">
                  {roteiro.fatos.map((f) => (
                    <li key={f.link + f.ano}>
                      <a href={f.link} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-ink-soft underline hover:text-oxblood">
                        {f.ano} · {enderecoLegivel(f.link)}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {aula && (
              <Link href={localePath(lang, aula.caminho)} className="inline-flex min-h-11 items-center font-semibold underline decoration-[#c21f16] underline-offset-4 hover:text-oxblood">
                {s.abrirAula} →
              </Link>
            )}
          </div>
          <p className="mt-3 font-sans text-xs text-ink-soft">{s.vozDoAparelho}</p>
        </>
      )}
    </section>
  );
}
