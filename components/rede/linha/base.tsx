// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { ligado } from "@/lib/recursos";
import { type FiltroDaLinha, type LinhaMontada, type ModoDaLinha, guardarModo, lerLinhas, lerModo } from "@/lib/rede/linha-aberta";
import { preencher } from "@/lib/rede/preencher";
import { previaLigada } from "@/lib/rede/publicar/alumia2";
import { alumia2Ligada } from "@/lib/rede/rotas-novas";
import { carregarTextosDaLinha, type TextosDaLinha } from "@/lib/rede/textos-linha";
import "./linha.css";

/** A linha com regra aberta está ligada? Precisa da Alumia nova e do interruptor próprio (lib/recursos.ts). */
export function linhaAbertaLigada(): boolean {
  return alumia2Ligada() && ligado("alumia-linha-aberta");
}

/** A prévia com dados de exemplo (NEXT_PUBLIC_ALUMIA_PREVIA=sim): nada vai ao banco. */
export const previa = (): boolean => previaLigada();

/** Os textos da linha no idioma da página (só um idioma chega ao navegador). Nulo enquanto carrega. */
export function useTextosDaLinha(lang: string, quer = true): TextosDaLinha | null {
  const [t, setT] = useState<{ lang: string; t: TextosDaLinha } | null>(null);
  useEffect(() => {
    if (!quer) return;
    let vivo = true;
    carregarTextosDaLinha(lang).then((x) => vivo && setT({ lang, t: x }));
    return () => {
      vivo = false;
    };
  }, [lang, quer]);
  return t?.lang === lang ? t.t : null;
}

/** O aviso que as peças da linha trocam entre si quando a pessoa muda a ordem ou as linhas (a barra e a página da regra). */
const EVENTO = "alumia:linha-mudou";
export function avisarQueMudou(): void {
  try {
    window.dispatchEvent(new Event(EVENTO));
  } catch {
    // sem janela: nada a avisar
  }
}

/** A ordem escolhida (guardada só no aparelho) e como trocar. Começa em "Em roda" e lê o aparelho depois de montar. */
export function useModoDaLinha(): [ModoDaLinha, (m: ModoDaLinha) => void] {
  const [modo, setModo] = useState<ModoDaLinha>(() => (typeof window === "undefined" ? "roda" : lerModo()));
  useEffect(() => {
    const ler = () => setModo(lerModo());
    window.addEventListener(EVENTO, ler);
    window.addEventListener("storage", ler);
    return () => {
      window.removeEventListener(EVENTO, ler);
      window.removeEventListener("storage", ler);
    };
  }, []);
  return [
    modo,
    (m) => {
      guardarModo(m);
      setModo(m);
      avisarQueMudou();
    },
  ];
}

/** As linhas que a pessoa montou (só no aparelho), sempre em dia com o que a tela "Minhas linhas" gravar. */
export function useLinhasMontadas(): LinhaMontada[] {
  const [linhas, setLinhas] = useState<LinhaMontada[]>(() => (typeof window === "undefined" ? [] : lerLinhas()));
  useEffect(() => {
    const ler = () => setLinhas(lerLinhas());
    window.addEventListener(EVENTO, ler);
    window.addEventListener("storage", ler);
    return () => {
      window.removeEventListener(EVENTO, ler);
      window.removeEventListener("storage", ler);
    };
  }, []);
  return linhas;
}

/** O filtro por extenso, como frase: "Entra: tudo o que você pode ver, só chamado e ato, com chamado em Recife." */
export function descreverLinha(t: TextosDaLinha, base: LinhaMontada["base"], filtro: FiltroDaLinha): string {
  const partes: string[] = [t.descricao.base[base]];
  if (filtro.tipos?.length) partes.push(preencher(t.descricao.tipos, { lista: filtro.tipos.map((x) => t.linhas.tipo[x].toLowerCase()).join(", ") }));
  if (filtro.cidade) partes.push(preencher(t.descricao.cidade, { cidade: filtro.cidade }));
  if (filtro.tags?.length) partes.push(preencher(t.descricao.tags, { lista: filtro.tags.map((x) => `#${x}`).join(", ") }));
  if (filtro.nucleos) partes.push(t.descricao.nucleos);
  if (filtro.estudo) partes.push(t.descricao.estudo);
  return preencher(t.descricao.frase, { partes: partes.join(", ") });
}

/** A troca "Em roda / Ordem de chegada": dois ladrilhos, o escolhido aceso. Serve na barra do Início e na página da regra. */
export function TrocaDeModo({ t, modo, aoMudar, grande = false }: { t: TextosDaLinha; modo: ModoDaLinha; aoMudar: (m: ModoDaLinha) => void; grande?: boolean }) {
  return (
    <div className={`ro-troca${grande ? " ro-troca-g" : ""}`} role="group" aria-label={t.modo.rotulo}>
      {(["roda", "chegada"] as const).map((m) => (
        <button key={m} type="button" className="ro-troca-botao al-cond" aria-pressed={modo === m} title={m === "roda" ? t.modo.rodaCurta : t.modo.chegadaCurta} onClick={() => modo !== m && aoMudar(m)}>
          {m === "roda" ? <SinalDaRoda /> : <SinalDaChegada />}
          {t.modo[m]}
        </button>
      ))}
    </div>
  );
}

/**
 * O sinal da roda: dois ladrilhos por fileira, em três fileiras, alternando o tom (a vez de cada pessoa, uma depois da outra).
 * Parado e sem forma de círculo, para não ler como "carregando". Decorativo.
 */
export function SinalDaRoda({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={`ro-sinal ${className}`.trim()}>
      <rect x={4} y={4} width={7} height={4.2} rx={0.8} />
      <rect x={13} y={4} width={7} height={4.2} rx={0.8} opacity={0.45} />
      <rect x={4} y={9.9} width={7} height={4.2} rx={0.8} opacity={0.45} />
      <rect x={13} y={9.9} width={7} height={4.2} rx={0.8} />
      <rect x={4} y={15.8} width={7} height={4.2} rx={0.8} />
      <rect x={13} y={15.8} width={7} height={4.2} rx={0.8} opacity={0.45} />
    </svg>
  );
}

/** O sinal da ordem de chegada: três ladrilhos em fila, de cima para baixo. Decorativo. */
export function SinalDaChegada({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={`ro-sinal ${className}`.trim()}>
      <rect x={5} y={4} width={14} height={3.6} rx={0.7} />
      <rect x={5} y={10.2} width={14} height={3.6} rx={0.7} opacity={0.7} />
      <rect x={5} y={16.4} width={14} height={3.6} rx={0.7} opacity={0.4} />
    </svg>
  );
}
