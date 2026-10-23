// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import type HanziWriterTipo from "hanzi-writer";
import { useEffect, useRef, useState } from "react";
import { buscar, type Entrada, pinyinComAcento } from "@/lib/ferramentas/chines";
import { Bancada, BotaoClaro } from "../../labs/kit";
import { AVISO_DE_VOZ, ComoUsar, falar } from "./comum";

/** Baixa um arquivo do próprio site, comprimido ou não (o servidor às vezes já entrega descomprimido). */
export async function lerComprimido(url: string) {
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return new TextDecoder().decode(bytes);
  const fluxo = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(fluxo).text();
}

let dicionario: Promise<Entrada[]> | null = null;
const carregarDicionario = () => (dicionario ??= lerComprimido("/dados/chines/cedict.json.gzip").then((t) => JSON.parse(t) as Entrada[]));
let caracteres: Promise<[string, string, string][]> | null = null;
const carregarCaracteres = () => (caracteres ??= fetch("/dados/chines/caracteres.json").then((r) => r.json() as Promise<[string, string, string][]>));

const CREDITO_CEDICT = <>Dicionário: <a href="https://www.mdbg.net/chinese/dictionary?page=cedict" target="_blank" rel="noopener noreferrer nofollow" className="underline">CC-CEDICT</a>, de MDBG e colaboradores, licença CC BY-SA 4.0 (convertido para uso no site pelo instituto, sob a mesma licença). As traduções estão em inglês.</>;

/** Dicionário de chinês no aparelho: busca por caractere, pinyin (com ou sem tons) ou palavra em inglês. */
export function DicionarioChines() {
  const [dic, setDic] = useState<Entrada[] | null>(null);
  const [comuns, setComuns] = useState<Map<string, number> | undefined>(undefined);
  const [erro, setErro] = useState(false);
  const [busca, setBusca] = useState("你好");
  const [conversor, setConversor] = useState("ni3 hao3, wo3 shi4 Ba1xi1 ren2");
  useEffect(() => {
    let vivo = true;
    carregarDicionario().then((d) => vivo && setDic(d)).catch(() => vivo && setErro(true));
    carregarCaracteres().then((l) => vivo && setComuns(new Map(l.map(([c], i) => [c, i])))).catch(() => undefined);
    return () => { vivo = false; };
  }, []);
  const resultados = dic ? buscar(dic, busca, 40, comuns) : [];
  return (
    <div>
      <Bancada titulo="Dicionário de chinês" subtitulo="Mais de 120 mil verbetes, consultados no seu aparelho">
        <label className="block text-sm font-semibold">Procure por caractere, pinyin (ma, mǎ ou ma3) ou palavra em inglês
          <input value={busca} onChange={(e) => setBusca(e.target.value.slice(0, 40))} className="mt-1 w-full border-2 border-ink bg-parchment px-3 py-2 text-lg" lang="zh-CN" />
        </label>
        {!dic && !erro && <p className="mt-3 text-sm text-ink-soft">Carregando o dicionário (cerca de 4 MB, só na primeira vez)…</p>}
        {erro && <p className="mt-3 text-sm text-oxblood">Não deu para carregar o dicionário. Confira a conexão e recarregue a página.</p>}
        {dic && busca.trim() && resultados.length === 0 && <p className="mt-3 text-sm">Nada encontrado.</p>}
        <ul className="mt-3 divide-y divide-rule rounded border-2 border-ink/20 bg-parchment">
          {resultados.map(([simp, trad, pin, glosas], i) => (
            <li key={`${simp}${pin}${i}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2">
              <span className="text-3xl" lang="zh-CN">{simp}</span>
              {trad && <span className="text-lg text-ink-soft" lang="zh-TW" title="Forma tradicional">{trad}</span>}
              <span className="font-mono text-oxblood">{pinyinComAcento(pin)}</span>
              <button type="button" onClick={() => falar(simp, "zh-CN", 0.7)} className="cursor-pointer text-xs underline">ouvir</button>
              {[...simp].length === 1 && <a href={`escrita-chinesa?c=${encodeURIComponent(simp)}`} className="text-xs underline">escrever</a>}
              <span className="basis-full text-sm" lang="en">{glosas}</span>
            </li>
          ))}
        </ul>
        <section className="mt-5 rounded-md border-2 border-dashed border-ink/30 p-3">
          <h3 className="font-semibold">Pinyin com números → com acentos</h3>
          <input value={conversor} onChange={(e) => setConversor(e.target.value.slice(0, 300))} aria-label="Pinyin com números" className="mt-2 w-full border-2 border-ink/30 bg-parchment px-2 py-1.5 font-mono" />
          <p className="mt-2 font-mono text-lg">{conversor.split(/([,.;!?\s]+)/).map((p) => (/^[a-züv:]+[1-5]?$/i.test(p) ? pinyinComAcento(p.replace(/([a-züv:]+[1-5])(?=[a-z])/gi, "$1 ")).replace(/ /g, "") : p)).join("")}</p>
          <p className="text-xs text-ink-soft">Escreva o número do tom depois de cada sílaba (5 ou nada para o tom neutro): nv3 vira nǚ.</p>
        </section>
        <p className="mt-3 text-xs text-ink-soft">{AVISO_DE_VOZ}</p>
      </Bancada>
      <ComoUsar
        passos={["Digite um caractere, um pinyin ou uma palavra em inglês.", "Toque em ouvir para a pronúncia e em escrever para ver a ordem dos traços.", "Use o conversor para escrever pinyin com acentos a partir dos números."]}
        atividades={["Procure “ma” e veja quantas palavras diferentes aparecem só mudando o tom. Compare com a ferramenta Tons do mandarim.", "Procure “water” e depois o caractere 水: em quantas palavras compostas ele aparece?", "Escreva o seu nome em pinyin com os tons usando o conversor e mostre a alguém do grupo."]}
        fonte={CREDITO_CEDICT}
      />
    </div>
  );
}

/** Escrita de caracteres chineses: a ordem dos traços animada e o treino traço por traço (Hanzi Writer). */
export function EscritaChinesa() {
  const [lista, setLista] = useState<[string, string, string][]>([]);
  const [char, setChar] = useState("你");
  const [filtro, setFiltro] = useState("");
  const [modo, setModo] = useState<"ver" | "treinar">("ver");
  const [aviso, setAviso] = useState("");
  const caixa = useRef<HTMLDivElement>(null);
  const escritor = useRef<HanziWriterTipo | null>(null);
  useEffect(() => {
    let vivo = true;
    carregarCaracteres().then((l) => vivo && setLista(l)).catch(() => undefined);
    const c = new URLSearchParams(window.location.search).get("c");
    if (c && [...c].length === 1) void Promise.resolve().then(() => setChar(c));
    return () => { vivo = false; };
  }, []);
  const disponivel = lista.length === 0 || lista.some((x) => x[0] === char);
  useEffect(() => {
    const div = caixa.current;
    if (!div || !disponivel) return;
    let vivo = true;
    div.innerHTML = "";
    void import("hanzi-writer").then(({ default: HanziWriter }) => {
      if (!vivo) return;
      const w = HanziWriter.create(div, char, {
        width: 260, height: 260, padding: 10, showOutline: true, strokeAnimationSpeed: 0.9, delayBetweenStrokes: 250,
        strokeColor: "#17130e", radicalColor: "#c21f16", outlineColor: "#d9cfb8", drawingColor: "#c21f16", highlightColor: "#1e56c8",
        charDataLoader: (c, onLoad, onError) => { fetch(`/dados/chines/hanzi/${c.codePointAt(0)!.toString(16)}.json`).then((r) => r.json()).then(onLoad).catch(onError); },
      });
      escritor.current = w;
      if (modo === "ver") void w.animateCharacter();
      else void w.quiz({ onMistake: () => setAviso("Quase: olhe o traço que pisca e tente de novo."), onCorrectStroke: () => setAviso(""), onComplete: ({ totalMistakes }) => setAviso(totalMistakes === 0 ? "✓ Perfeito, sem nenhum erro!" : `✓ Feito, com ${totalMistakes} erro(s). Tente de novo para fixar.`) });
    });
    return () => { vivo = false; escritor.current = null; };
  }, [char, modo, disponivel]);
  const info = lista.find((x) => x[0] === char);
  const visiveis = filtro.trim() ? lista.filter(([c, p, g]) => c === filtro.trim() || p.replace(/[1-5\s]/g, "").startsWith(filtro.trim().toLowerCase()) || g.toLowerCase().includes(filtro.trim().toLowerCase())) : lista.slice(0, 120);
  return (
    <div>
      <Bancada titulo="Escrita chinesa" subtitulo="A ordem dos traços, animada e para treinar com o dedo">
        <div className="grid gap-5 md:grid-cols-[auto_1fr]">
          <div>
            <div ref={caixa} className="h-[260px] w-[260px] rounded border-2 border-ink bg-white" aria-label={`Caractere ${char}`} role="img" />
            <p className="mt-2 text-center"><span className="text-3xl" lang="zh-CN">{char}</span> <span className="font-mono text-oxblood">{info ? pinyinComAcento(info[1]) : ""}</span></p>
            {info?.[2] && <p className="max-w-[260px] text-center text-xs text-ink-soft" lang="en">{info[2]}</p>}
            {!disponivel && <p className="max-w-[260px] text-sm text-oxblood">Este caractere não está no recorte do site (cerca de mil caracteres comuns).</p>}
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <BotaoClaro onClick={() => { setModo("ver"); setAviso(""); void escritor.current?.animateCharacter(); }}>▶ Ver os traços</BotaoClaro>
              <BotaoClaro onClick={() => { setModo("treinar"); setAviso("Desenhe cada traço na ordem, com o dedo ou o mouse."); }}>Treinar</BotaoClaro>
              <BotaoClaro onClick={() => falar(char, "zh-CN", 0.7)}>🔊</BotaoClaro>
            </div>
            {aviso && <p className="mt-2 max-w-[260px] text-sm">{aviso}</p>}
          </div>
          <div className="min-w-0">
            <label className="block text-sm font-semibold">Procurar (caractere, pinyin sem tom ou palavra em inglês)
              <input value={filtro} onChange={(e) => setFiltro(e.target.value.slice(0, 20))} className="mt-1 w-full border-2 border-ink/30 bg-parchment px-2 py-1.5" />
            </label>
            <div className="mt-2 flex max-h-80 flex-wrap gap-1 overflow-y-auto">
              {visiveis.map(([c]) => <button key={c} type="button" onClick={() => { setChar(c); setAviso(""); }} aria-pressed={c === char} lang="zh-CN" className={`h-10 w-10 cursor-pointer rounded border text-xl ${c === char ? "border-ink bg-[#ffd27a]" : "border-ink/20 bg-parchment hover:border-ink"}`}>{c}</button>)}
            </div>
            <p className="mt-1 text-xs text-ink-soft">{lista.length ? `${lista.length} caracteres no site${filtro.trim() ? "" : "; aparecem os 120 mais comuns, use a busca para os outros"}.` : "Carregando a lista…"}</p>
          </div>
        </div>
      </Bancada>
      <ComoUsar
        passos={["Escolha um caractere na lista ou procure pelo pinyin.", "Veja a animação da ordem dos traços quantas vezes quiser.", "Em Treinar, desenhe cada traço na ordem; o traço certo fica, o errado pisca."]}
        atividades={["Treine 人, 大 e 天: o que muda de um para o outro? (Dica: um traço a mais de cada vez.)", "Escreva 你好 (olá) traço por traço, sem olhar a animação, e conte os erros.", "Procure caracteres com o radical 氵 (água), como 河 e 海: o que eles têm em comum no sentido?"]}
        fonte={<>Animação: <a href="https://github.com/chanind/hanzi-writer" target="_blank" rel="noopener noreferrer nofollow" className="underline">Hanzi Writer</a> (MIT). Traços: <a href="https://github.com/skishore/makemeahanzi" target="_blank" rel="noopener noreferrer nofollow" className="underline">Make Me a Hanzi</a>, a partir das fontes AR PL da Arphic, sob a <a href="/dados/chines/hanzi/ARPHICPL.TXT" className="underline">Arphic Public License</a>. Pinyin e sentido: CC-CEDICT (CC BY-SA 4.0).</>}
      />
    </div>
  );
}
