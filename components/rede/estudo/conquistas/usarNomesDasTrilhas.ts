// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O título de verdade de cada trilha ("História do Brasil", não "historia do brasil"), da lista do site que a primeira entrada já
// usa (/api/rede/trilhas/[lang], estática, do próprio site). Uma busca por idioma, guardada enquanto a página vive. Sem a lista
// (erro, ou enquanto chega), vale o fim do endereço com espaços.
import { useEffect, useState } from "react";
import { nomeDoSlug } from "./regras";
import { comMaiuscula } from "./textos";

export type NomeDaTrilha = (slug: string) => string;

/** O nome de cada trilha e a lista do site (vazia enquanto chega ou se não chegar), em ordem de título. */
export interface NomesDasTrilhas {
  nome: NomeDaTrilha;
  lista: readonly { slug: string; titulo: string }[];
  /** A lista já chegou (ou não deu e não vai chegar): antes disso, a tela mostra esqueleto, não o fim do endereço. */
  pronta: boolean;
}

const pedidos = new Map<string, Promise<Map<string, string>>>();

function carregar(lang: string): Promise<Map<string, string>> {
  let p = pedidos.get(lang);
  if (!p) {
    p = fetch(`/api/rede/trilhas/${encodeURIComponent(lang)}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ trilhas?: { slug?: unknown; titulo?: unknown }[] }>) : { trilhas: [] }))
      .then((d) => new Map((d.trilhas ?? []).filter((x) => typeof x.slug === "string" && typeof x.titulo === "string").map((x) => [x.slug as string, x.titulo as string])))
      .catch(() => {
        pedidos.delete(lang);
        return new Map<string, string>();
      });
    pedidos.set(lang, p);
  }
  return p;
}

/** O nome da trilha como a pessoa lê, pelo slug. */
export const nomeSemLista: NomeDaTrilha = (slug) => comMaiuscula(nomeDoSlug(slug));

export function useNomesDasTrilhas(lang: string): NomesDasTrilhas {
  const [mapa, setMapa] = useState<Map<string, string> | null>(null);
  useEffect(() => {
    let vivo = true;
    carregar(lang).then((m) => vivo && setMapa(m));
    return () => {
      vivo = false;
    };
  }, [lang]);
  return {
    nome: (slug) => mapa?.get(slug) ?? nomeSemLista(slug),
    lista: mapa ? [...mapa].map(([slug, titulo]) => ({ slug, titulo })) : [],
    pronta: mapa !== null,
  };
}

const aulasPedidas = new Map<string, Promise<Map<string, string> | null>>();

/**
 * O título de verdade de uma aula ("A escravidão no Brasil", não "a escravidao no brasil"), da lista estática das aulas da trilha
 * (/api/rede/aulas/[lang]/[trilha]). `undefined` enquanto chega; nulo se não chegou (aí a tela usa o fim do endereço).
 */
export function useTituloDaAula(lang: string, trilha: string, aula: string): string | null | undefined {
  const chave = `${lang}/${trilha}`;
  const [lido, setLido] = useState<{ chave: string; mapa: Map<string, string> | null } | null>(null);
  useEffect(() => {
    let vivo = true;
    let p = aulasPedidas.get(chave);
    if (!p) {
      p = fetch(`/api/rede/aulas/${encodeURIComponent(lang)}/${encodeURIComponent(trilha)}`)
        .then((r) => (r.ok ? (r.json() as Promise<{ aulas?: { slug?: unknown; titulo?: unknown }[] }>) : { aulas: [] }))
        .then((d) => new Map((d.aulas ?? []).filter((x) => typeof x.slug === "string" && typeof x.titulo === "string").map((x) => [x.slug as string, x.titulo as string])))
        .catch(() => {
          aulasPedidas.delete(chave);
          return null;
        });
      aulasPedidas.set(chave, p);
    }
    p.then((mapa) => vivo && setLido({ chave, mapa }));
    return () => {
      vivo = false;
    };
  }, [chave, lang, trilha]);
  if (lido?.chave !== chave) return undefined;
  return lido.mapa?.get(aula) ?? null;
}
