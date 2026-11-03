// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import Link from "@/components/Link";
import { localePath } from "@/i18n/config";
import type { TextosDaBusca } from "@/lib/escola/textos-da-busca";
import { casar, type Destino, hrefDe, type Intencao } from "@/lib/intencoes";
import { ligado } from "@/lib/recursos";
import type { SearchEntry } from "@/lib/search";
import { useI18n } from "../I18n";
import { useTextosDaBusca } from "./TextosDaBusca";
import "@/styles/escola-busca.css";

let intencoesProntas: Promise<Intencao[]> | null = null;

/** Baixa as intenções (content/busca-intencoes.json) uma vez, só quando a busca abre e a Escola está ligada. */
export function useIntencoes(): Intencao[] | null {
  const ativa = ligado("escola");
  const [lista, setLista] = useState<Intencao[] | null>(null);
  useEffect(() => {
    if (!ativa) return;
    let vivo = true;
    intencoesProntas ??= import("@/content/busca-intencoes.json").then((m) => ((m as { default?: unknown }).default ?? m) as Intencao[]);
    intencoesProntas
      .then((pronta) => {
        if (vivo) setLista(pronta);
      })
      .catch(() => {
        intencoesProntas = null;
      });
    return () => {
      vivo = false;
    };
  }, [ativa]);
  return ativa ? lista : null;
}

/** O título do destino: o do índice da busca (no idioma da página) ou, para páginas e ferramentas fora dele, o dos textos. */
export function tituloDoDestino(destino: Destino, entradas: readonly SearchEntry[], t: TextosDaBusca): string | null {
  const href = hrefDe(destino);
  if (destino.tipo === "ferramenta") return (t.ferramentas as Record<string, string>)[destino.id] ?? null;
  if (destino.tipo === "pagina") return (t.paginas as Record<string, string>)[destino.caminho] ?? entradas.find((e) => e.href === href)?.title ?? null;
  return entradas.find((e) => e.href === href)?.title ?? null;
}

/**
 * A caixa "Melhor caminho" no topo dos resultados (busca do alto e /busca): quando a pergunta casa com uma intenção de
 * content/busca-intencoes.json, mostra até três destinos com os títulos do índice. Sem casamento, não aparece nada e a
 * busca fica como era. Tudo no aparelho: a pergunta não sai daqui.
 */
export function MelhorCaminho({ consulta, entradas, compacto = false, aoEscolher }: { consulta: string; entradas: readonly SearchEntry[] | null; compacto?: boolean; aoEscolher?: () => void }) {
  const { lang } = useI18n();
  const contexto = useTextosDaBusca();
  const intencoes = useIntencoes();
  if (!contexto || !intencoes || !entradas || !consulta.trim()) return null;
  const t = contexto.textos;
  const destinos = casar(consulta, intencoes)
    .map((destino) => ({ destino, titulo: tituloDoDestino(destino, entradas, t) }))
    .filter((d): d is { destino: Destino; titulo: string } => Boolean(d.titulo));
  if (destinos.length === 0) return null;
  return (
    <section aria-label={t.melhor.titulo} className={`melhor-caminho border-2 border-gold bg-parchment-deep font-sans ${compacto ? "mx-2 mt-1 mb-2 px-3 py-2.5" : "mt-6 px-4 py-4"}`} data-melhor-caminho>
      <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-oxblood">{t.melhor.titulo}</p>
      {!compacto && <p className="mt-1 text-sm text-ink-soft">{t.melhor.lead}</p>}
      <ul className="mt-1.5">
        {destinos.map(({ destino, titulo }) => (
          <li key={hrefDe(destino)}>
            <Link href={localePath(lang, hrefDe(destino))} onClick={aoEscolher} className="melhor-caminho-item flex items-baseline gap-3 py-1.5 text-ink hover:text-oxblood">
              <span className="min-w-0 flex-1 font-serif text-[1.08rem] leading-snug underline-offset-4 hover:underline">{titulo}</span>
              <small className="shrink-0 text-xs text-ink-soft">{t.melhor[destino.tipo]}</small>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
