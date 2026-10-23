// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { fill } from "@/i18n/config";
import { idDaQuestao, registrarErro } from "@/lib/estudo";
import { lacunaCerta, lerCacaPalavras, lerForca, lerPares, lerTeste, montarGrade, numeroCerto, type Questao } from "@/lib/interativos";
import { imagemDoSite } from "@/lib/interativos-mais";
import { useI18n } from "../I18n";

// Testes autocorrigíveis e jogos (cartões, memória, forca, caça-palavras). Tudo no aparelho; quem erra um teste
// ganha a questão no caderno de erros, como nas perguntas do fim da aula.

const caixa = "no-print my-6 border-l-2 border-gold bg-parchment-deep p-4 font-sans text-sm";
const botao = "cursor-pointer bg-ink px-4 py-2 font-medium text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50";
const claro = "cursor-pointer border-2 border-ink px-4 py-1.5 font-medium hover:border-oxblood hover:text-oxblood";
const embaralhar = <T,>(lista: T[]) => {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
};

/** Enunciado ou alternativa com figura: "![descrição](/arquivos/gato.webp) texto". Só imagens do próprio site. */
function ComImagem({ texto, className }: { texto: string; className?: string }) {
  const m = /^!\[([^\]]*)\]\(([^)\s]+)\)\s*([\s\S]*)$/.exec(texto);
  if (!m || !imagemDoSite(m[2])) return <span className={className}>{texto}</span>;
  return (
    <span className={`inline-flex flex-col items-start gap-1 ${className ?? ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- imagem do acervo, já otimizada no envio */}
      <img src={m[2]} alt={m[1]} loading="lazy" className="max-h-48 max-w-full object-contain" />
      {m[3] && <span>{m[3]}</span>}
    </span>
  );
}

// ───────────── Teste ─────────────

export function Teste({ spec }: { spec: string }) {
  const { t } = useI18n();
  const questoes = useMemo(() => lerTeste(spec), [spec]);
  const [acertos, setAcertos] = useState<Record<number, boolean>>({});
  if (!questoes.length) return <pre className="text-sm">{spec}</pre>;
  const feitas = Object.keys(acertos).length;
  return (
    <div className={caixa}>
      <ol className="space-y-5">
        {questoes.map((q, i) => (
          <li key={i}>
            <UmaQuestao q={q} marcar={(certa) => setAcertos((a) => (i in a ? a : { ...a, [i]: certa }))} />
          </li>
        ))}
      </ol>
      {feitas > 0 && <p className="mt-4 font-mono text-xs" role="status">{fill(t.blocks.score, { a: Object.values(acertos).filter(Boolean).length, b: questoes.length })}</p>}
    </div>
  );
}

function UmaQuestao({ q, marcar }: { q: Questao; marcar: (certa: boolean) => void }) {
  const { t } = useI18n();
  const caminho = usePathname();
  const [resposta, setResposta] = useState<string[]>([]);
  const [ordem, setOrdem] = useState<string[]>(() => (q.tipo === "ordenar" ? embaralhar(q.itens) : []));
  const [conferida, setConferida] = useState<boolean | null>(null);
  const [escolhida, setEscolhida] = useState<number | null>(null);

  function conferir(certa: boolean, escolha = -1) {
    setConferida(certa);
    marcar(certa);
    if (!certa) {
      const opcoes = q.tipo === "escolha" ? q.opcoes.map((o) => o.texto) : q.tipo === "vf" ? [t.blocks.true, t.blocks.false] : [respostaCerta(q)];
      const certaIdx = q.tipo === "escolha" ? q.opcoes.findIndex((o) => o.certa) : q.tipo === "vf" ? (q.resposta ? 0 : 1) : 0;
      registrarErro({ id: idDaQuestao(q.enunciado, opcoes), pergunta: q.enunciado, opcoes, resposta: certaIdx, escolhida: escolha, explicacao: q.explicacao || undefined, href: caminho.replace(/^\/[a-z]{2}(?=\/)/, ""), origem: "aula" });
    }
  }

  const retorno = conferida !== null && (
    <div role="status" className="mt-2">
      <p className={conferida ? "font-semibold text-ok" : "font-semibold text-oxblood"}>{conferida ? t.blocks.right : t.blocks.wrong}</p>
      {!conferida && q.tipo === "escolha" && escolhida !== null && q.opcoes[escolhida]?.retorno && <p>{q.opcoes[escolhida].retorno}</p>}
      {!conferida && q.tipo !== "escolha" && <p>{t.blocks.answer} {respostaCerta(q)}</p>}
      {q.explicacao && <p className="text-ink-soft">{q.explicacao}</p>}
    </div>
  );

  if (q.tipo === "escolha") {
    return (
      <div>
        <p className="font-medium"><ComImagem texto={q.enunciado} /></p>
        <div className="mt-2 flex flex-wrap gap-2">
          {q.opcoes.map((o, k) => (
            <button key={k} type="button" disabled={conferida !== null} aria-pressed={escolhida === k} onClick={() => { setEscolhida(k); conferir(o.certa, k); }} className={`cursor-pointer border-2 bg-parchment px-3 py-1.5 text-left ${escolhida === k ? (o.certa ? "border-ok text-ok" : "border-oxblood") : "border-rule hover:border-gold"}`}>
              <ComImagem texto={o.texto} />
            </button>
          ))}
        </div>
        {retorno}
      </div>
    );
  }
  if (q.tipo === "vf") {
    return (
      <div>
        <p className="font-medium"><ComImagem texto={q.enunciado} /></p>
        <div className="mt-2 flex gap-2">
          {[true, false].map((v) => (
            <button key={String(v)} type="button" disabled={conferida !== null} onClick={() => { setEscolhida(v ? 0 : 1); conferir(v === q.resposta, v ? 0 : 1); }} className={claro}>
              {v ? t.blocks.true : t.blocks.false}
            </button>
          ))}
        </div>
        {retorno}
      </div>
    );
  }
  if (q.tipo === "numero") {
    return (
      <div onKeyDown={(e) => { if (e.key === "Enter" && conferida === null && resposta[0]) { e.preventDefault(); conferir(numeroCerto(q, resposta[0] ?? "")); } }}>
        <p className="font-medium"><ComImagem texto={q.enunciado} /></p>
        <div className="mt-2 flex gap-2">
          <input inputMode="decimal" aria-label={t.blocks.yourAnswer} value={resposta[0] ?? ""} onChange={(e) => setResposta([e.target.value])} disabled={conferida !== null} className="w-32 border-2 border-ink bg-parchment px-2 py-1.5 font-mono" />
          <button type="button" className={botao} disabled={conferida !== null || !resposta[0]} onClick={() => conferir(numeroCerto(q, resposta[0] ?? ""))}>{t.blocks.check}</button>
        </div>
        {retorno}
      </div>
    );
  }
  if (q.tipo === "lacunas") {
    const partes = q.enunciado.split("___");
    return (
      <div onKeyDown={(e) => { if (e.key === "Enter" && conferida === null) { e.preventDefault(); conferir(q.respostas.every((aceitas, k) => lacunaCerta(aceitas, resposta[k] ?? ""))); } }}>
        <p className="font-medium leading-9">
          {partes.map((parte, k) => (
            <span key={k}>
              {parte}
              {k < partes.length - 1 && (
                <input aria-label={`${t.blocks.yourAnswer} ${k + 1}`} value={resposta[k] ?? ""} disabled={conferida !== null} onChange={(e) => setResposta((r) => { const n = [...r]; n[k] = e.target.value; return n; })} className="mx-1 w-36 border-b-2 border-ink bg-parchment px-1 font-mono" />
              )}
            </span>
          ))}
        </p>
        <button type="button" className={`mt-2 ${botao}`} disabled={conferida !== null} onClick={() => conferir(q.respostas.every((aceitas, k) => lacunaCerta(aceitas, resposta[k] ?? "")))}>{t.blocks.check}</button>
        {retorno}
      </div>
    );
  }
  // Ordenar: subir e descer cada item (funciona no teclado e no toque, sem arrastar).
  return (
    <div>
      <p className="font-medium"><ComImagem texto={q.enunciado} /></p>
      <ol className="mt-2 space-y-1">
        {ordem.map((item, k) => (
          <li key={item} className="flex items-center gap-2 border border-rule bg-parchment px-2 py-1">
            <span className="w-5 font-mono text-xs text-ink-soft">{k + 1}</span>
            <span className="flex-1">{item}</span>
            <button type="button" aria-label={`${t.blocks.up}: ${item}`} disabled={k === 0 || conferida !== null} onClick={() => setOrdem((o) => { const n = [...o]; [n[k - 1], n[k]] = [n[k], n[k - 1]]; return n; })} className="cursor-pointer px-1.5 disabled:opacity-30">↑</button>
            <button type="button" aria-label={`${t.blocks.down}: ${item}`} disabled={k === ordem.length - 1 || conferida !== null} onClick={() => setOrdem((o) => { const n = [...o]; [n[k + 1], n[k]] = [n[k], n[k + 1]]; return n; })} className="cursor-pointer px-1.5 disabled:opacity-30">↓</button>
          </li>
        ))}
      </ol>
      <button type="button" className={`mt-2 ${botao}`} disabled={conferida !== null} onClick={() => conferir(ordem.every((item, k) => item === q.itens[k]))}>{t.blocks.check}</button>
      {retorno}
    </div>
  );
}

function respostaCerta(q: Questao): string {
  switch (q.tipo) {
    case "escolha":
      return q.opcoes.find((o) => o.certa)?.texto ?? "";
    case "vf":
      return q.resposta ? "V" : "F";
    case "numero":
      return q.tolerancia ? `${q.resposta} ± ${q.tolerancia}` : String(q.resposta);
    case "lacunas":
      return q.respostas.map((r) => r[0]).join(" / ");
    case "ordenar":
      return q.itens.join(" → ");
  }
}

// ───────────── Cartões ─────────────

function falar(texto: string, lingua: string) {
  if (!("speechSynthesis" in window) || !lingua) return false;
  const fala = new SpeechSynthesisUtterance(texto);
  fala.lang = lingua;
  const voz = window.speechSynthesis.getVoices().find((v) => v.lang.replace("_", "-").toLowerCase().startsWith(lingua.toLowerCase().slice(0, 2)));
  if (voz) fala.voice = voz;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(fala);
  return true;
}

export function Cartoes({ spec }: { spec: string }) {
  const { t } = useI18n();
  const { lingua, pares } = useMemo(() => lerPares(spec), [spec]);
  const [i, setI] = useState(0);
  const [virado, setVirado] = useState(false);
  if (!pares.length) return <pre className="text-sm">{spec}</pre>;
  const p = pares[i % pares.length];
  return (
    <div className={caixa}>
      <button type="button" onClick={() => setVirado((v) => !v)} aria-label={t.blocks.flip} className="flex min-h-36 w-full cursor-pointer items-center justify-center border-2 border-ink bg-parchment p-6 text-center font-serif text-2xl">
        {virado ? p.b : p.a}
      </button>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className={claro} onClick={() => { setI((n) => (n - 1 + pares.length) % pares.length); setVirado(false); }}>←</button>
        <span className="font-mono text-xs">{fill(t.blocks.cardOf, { i: (i % pares.length) + 1, n: pares.length })}</span>
        <button type="button" className={claro} onClick={() => { setI((n) => (n + 1) % pares.length); setVirado(false); }}>→</button>
        <button type="button" className={claro} onClick={() => setVirado((v) => !v)}>{t.blocks.flip}</button>
        {lingua && <button type="button" className={claro} onClick={() => falar(p.a, lingua)}>{t.blocks.listen}</button>}
      </div>
    </div>
  );
}

// ───────────── Jogo da memória ─────────────

export function Memoria({ spec }: { spec: string }) {
  const { t } = useI18n();
  const { pares } = useMemo(() => lerPares(spec), [spec]);
  const [cartas] = useState(() => embaralhar(pares.slice(0, 12).flatMap((p, k) => [{ par: k, texto: p.a }, { par: k, texto: p.b }])));
  const [abertas, setAbertas] = useState<number[]>([]);
  const [achados, setAchados] = useState<number[]>([]);
  const [jogadas, setJogadas] = useState(0);
  if (pares.length < 2) return <pre className="text-sm">{spec}</pre>;
  function abrir(k: number) {
    if (abertas.includes(k) || achados.includes(cartas[k].par) || abertas.length === 2) return;
    const novas = [...abertas, k];
    setAbertas(novas);
    if (novas.length === 2) {
      setJogadas((n) => n + 1);
      if (cartas[novas[0]].par === cartas[novas[1]].par) {
        setAchados((a) => [...a, cartas[k].par]);
        setAbertas([]);
      } else setTimeout(() => setAbertas([]), 1100);
    }
  }
  return (
    <div className={caixa}>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {cartas.map((c, k) => {
          const visivel = abertas.includes(k) || achados.includes(c.par);
          return (
            <button key={k} type="button" onClick={() => abrir(k)} aria-label={visivel ? c.texto : `${k + 1}`} className={`flex min-h-20 cursor-pointer items-center justify-center border-2 p-2 text-center ${achados.includes(c.par) ? "border-ok bg-parchment" : visivel ? "border-gold bg-parchment" : "border-ink bg-ink text-parchment"}`}>
              {visivel ? c.texto : "?"}
            </button>
          );
        })}
      </div>
      <p className="mt-2 font-mono text-xs" role="status">{fill(t.blocks.pairsFound, { a: achados.length, b: cartas.length / 2 })} · {fill(t.blocks.moves, { n: jogadas })}</p>
    </div>
  );
}

// ───────────── Forca ─────────────

const MAXIMO_DE_ERROS = 6;
const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZÇÁÉÍÓÚÂÊÔÃÕ".split("");
const semAcento = (l: string) => l.normalize("NFD").replace(/[̀-ͯ]/g, "");

export function Forca({ spec }: { spec: string }) {
  const { t } = useI18n();
  const palavras = useMemo(() => lerForca(spec), [spec]);
  const [i, setI] = useState(0);
  const [tentadas, setTentadas] = useState<string[]>([]);
  if (!palavras.length) return <pre className="text-sm">{spec}</pre>;
  const { palavra, dica } = palavras[i % palavras.length];
  // Uma letra sem acento vale para as com acento ("A" acerta "Ã").
  const revelada = (letra: string) => letra === " " || letra === "-" || tentadas.some((x) => semAcento(x) === semAcento(letra));
  const erros = tentadas.filter((x) => ![...palavra].some((l) => semAcento(l) === semAcento(x))).length;
  const ganhou = [...palavra].every(revelada);
  const perdeu = erros >= MAXIMO_DE_ERROS;
  return (
    <div className={caixa}>
      {dica && <p><strong>{t.blocks.hint}</strong> {dica}</p>}
      <p className="mt-3 font-mono text-2xl tracking-[0.3em]" aria-live="polite">{[...palavra].map((l) => (revelada(l) || perdeu ? l : "_")).join("")}</p>
      <p className="mt-1 font-mono text-xs">{fill(t.blocks.mistakes, { n: erros, max: MAXIMO_DE_ERROS })}</p>
      {ganhou || perdeu ? (
        <div className="mt-3" role="status">
          <p className={ganhou ? "font-semibold text-ok" : "font-semibold text-oxblood"}>{fill(ganhou ? t.blocks.wonWord : t.blocks.lostWord, { w: palavra })}</p>
          <button type="button" className={`mt-2 ${botao}`} onClick={() => { setI((n) => n + 1); setTentadas([]); }}>{t.blocks.newWord}</button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-1">
          {ALFABETO.filter((l) => !/[ÁÉÍÓÚÂÊÔÃÕ]/.test(l)).map((l) => (
            <button key={l} type="button" disabled={tentadas.includes(l)} onClick={() => setTentadas((x) => [...x, l])} className="h-9 w-9 cursor-pointer border border-ink bg-parchment font-mono disabled:opacity-30">{l}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ───────────── Caça-palavras ─────────────

export function CacaPalavras({ spec }: { spec: string }) {
  const { t } = useI18n();
  const { palavras, tamanho } = useMemo(() => lerCacaPalavras(spec), [spec]);
  const { grade, posicoes } = useMemo(() => montarGrade(palavras, tamanho), [palavras, tamanho]);
  const [inicio, setInicio] = useState<[number, number] | null>(null);
  const [achadas, setAchadas] = useState<string[]>([]);
  if (!palavras.length) return <pre className="text-sm">{spec}</pre>;
  const celulasAchadas = new Set(posicoes.filter((p) => achadas.includes(p.palavra)).flatMap((p) => p.celulas.map(([l, c]) => `${l}-${c}`)));
  function tocar(l: number, c: number) {
    if (!inicio) return setInicio([l, c]);
    const fim: [number, number] = [l, c];
    const achada = posicoes.find((p) => {
      const [a, b] = [p.celulas[0], p.celulas[p.celulas.length - 1]];
      return (a[0] === inicio[0] && a[1] === inicio[1] && b[0] === fim[0] && b[1] === fim[1]) || (b[0] === inicio[0] && b[1] === inicio[1] && a[0] === fim[0] && a[1] === fim[1]);
    });
    if (achada && !achadas.includes(achada.palavra)) setAchadas((x) => [...x, achada.palavra]);
    setInicio(null);
  }
  return (
    <div className={caixa}>
      <p className="text-ink-soft">{t.blocks.wordSearchHint}</p>
      <div className="mt-2 overflow-x-auto">
        <div className="inline-grid gap-0.5" style={{ gridTemplateColumns: `repeat(${tamanho}, 2rem)` }}>
          {grade.flatMap((linha, l) =>
            linha.map((letra, c) => {
              const marcada = celulasAchadas.has(`${l}-${c}`);
              const escolhida = inicio?.[0] === l && inicio?.[1] === c;
              return (
                <button key={`${l}-${c}`} type="button" onClick={() => tocar(l, c)} aria-label={`${letra}, ${l + 1}, ${c + 1}`} aria-pressed={escolhida} className={`h-8 w-8 cursor-pointer border font-mono ${escolhida ? "border-oxblood bg-gold/40" : marcada ? "border-ok bg-ok/15" : "border-rule bg-parchment"}`}>
                  {letra}
                </button>
              );
            }),
          )}
        </div>
      </div>
      <p className="mt-2 font-mono text-xs" role="status">{fill(t.blocks.found, { a: achadas.length, b: posicoes.length })}</p>
      <ul className="mt-1 flex flex-wrap gap-2">
        {posicoes.map((p) => <li key={p.palavra} className={achadas.includes(p.palavra) ? "text-ok line-through" : ""}>{p.palavra}</li>)}
      </ul>
    </div>
  );
}
