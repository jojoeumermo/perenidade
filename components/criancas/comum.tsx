// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

/**
 * O que a área infantil inteira usa: o som (mudo guardado no aparelho), a fala em português do Brasil (síntese de voz
 * do próprio navegador, nunca microfone), o PORTÃO DE ADULTO e a mascote. Nada sai do aparelho, nada identifica a
 * criança: o que fica guardado (mudo, lembrete de pausa) fica só neste navegador e o adulto apaga quando quiser.
 */
import Link from "@/components/Link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

const CHAVE_MUDO = "lucia:criancas-mudo";
const CHAVE_PAUSA = "lucia:criancas-pausa";
const AVISO = "lucia-criancas-mudou";

function ler(chave: string) {
  try {
    return window.localStorage.getItem(chave);
  } catch {
    return null;
  }
}
function gravar(chave: string, valor: string | null) {
  try {
    if (valor === null) window.localStorage.removeItem(chave);
    else window.localStorage.setItem(chave, valor);
  } catch {
    // sem armazenamento: vale só nesta página
  }
  window.dispatchEvent(new Event(AVISO));
}
const assinar = (avisar: () => void) => {
  window.addEventListener(AVISO, avisar);
  window.addEventListener("storage", avisar);
  return () => {
    window.removeEventListener(AVISO, avisar);
    window.removeEventListener("storage", avisar);
  };
};

/** Mudo ligado por padrão no servidor; no aparelho, o que o adulto escolheu (padrão: com som). */
export function useMudo(): [boolean, (mudo: boolean) => void] {
  const mudo = useSyncExternalStore(assinar, () => ler(CHAVE_MUDO) === "1", () => true);
  return [mudo, (m) => gravar(CHAVE_MUDO, m ? "1" : null)];
}

/** Fala o texto em português do Brasil, se o som estiver ligado e o aparelho tiver voz. Devolve false sem voz. */
export function falar(texto: string, aoTerminar?: () => void, aCadaPalavra?: (inicio: number) => void): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || ler(CHAVE_MUDO) === "1") return false;
  const fala = new SpeechSynthesisUtterance(texto);
  fala.lang = "pt-BR";
  fala.rate = 0.9;
  const voz = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("pt-br")) ?? window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("pt"));
  if (voz) fala.voice = voz;
  if (aoTerminar) fala.onend = aoTerminar;
  if (aCadaPalavra) fala.onboundary = (e) => aCadaPalavra(e.charIndex);
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(fala);
  return true;
}
export const temVoz = () => typeof window !== "undefined" && "speechSynthesis" in window;

/**
 * O portão de adulto: um desafio curto de conta (diferente a cada vez), que uma criança pequena não resolve e um
 * adulto resolve em segundos. É uma BARREIRA, não uma verificação de idade. Protege a saída para o resto do site, os
 * links para fora e as configurações (som, pausa, apagar os dados).
 */
export function PortaoDeAdulto({ aberto, fechar, liberar, motivo }: { aberto: boolean; fechar: () => void; liberar: () => void; motivo: string }) {
  const [desafio, setDesafio] = useState<{ a: number; b: number } | null>(null);
  const [resposta, setResposta] = useState("");
  const [errou, setErrou] = useState(false);
  useEffect(() => {
    if (!aberto) return;
    // O desafio é sorteado ao abrir (fora da renderização) e muda a cada vez.
    void Promise.resolve().then(() => {
      setDesafio({ a: 6 + Math.floor(Math.random() * 7), b: 13 + Math.floor(Math.random() * 7) });
      setResposta("");
      setErrou(false);
    });
  }, [aberto]);
  if (!aberto || !desafio) return null;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="portao-titulo" className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4">
      <form
        className="w-full max-w-md border-4 border-ink bg-parchment p-6 font-sans text-ink"
        onSubmit={(e) => {
          e.preventDefault();
          if (Number(resposta.trim()) === desafio.a * desafio.b) liberar();
          else {
            setErrou(true);
            setDesafio({ a: 6 + Math.floor(Math.random() * 7), b: 13 + Math.floor(Math.random() * 7) });
            setResposta("");
          }
        }}
      >
        <h2 id="portao-titulo" className="text-2xl font-bold">Só para adultos</h2>
        <p className="mt-2">{motivo} Peça para um adulto responder:</p>
        <label className="mt-4 block text-xl">
          Quanto é {desafio.a} × {desafio.b}?
          <input inputMode="numeric" autoFocus value={resposta} onChange={(e) => setResposta(e.target.value.replace(/\D/g, "").slice(0, 4))} className="mt-2 block w-full border-2 border-ink bg-white px-3 py-3 text-2xl" />
        </label>
        {errou && <p className="mt-2 text-oxblood">Não foi dessa vez. Tente esta outra conta.</p>}
        <p className="mt-5 flex gap-3">
          <button type="submit" className="min-h-12 cursor-pointer border-2 border-ink bg-ink px-5 font-bold text-parchment">Continuar</button>
          <button type="button" onClick={fechar} className="min-h-12 cursor-pointer border-2 border-ink px-5 font-bold">Voltar</button>
        </p>
      </form>
    </div>
  );
}

/** A Lua, mascote da área infantil (desenho original, em SVG). */
export function Mascote({ tamanho = 96, humor = "feliz" }: { tamanho?: number; humor?: "feliz" | "pensando" | "festa" }) {
  return (
    <svg viewBox="0 0 120 120" width={tamanho} height={tamanho} aria-hidden>
      <circle cx="60" cy="62" r="46" fill="#F6C945" stroke="#221C17" strokeWidth="4" />
      <circle cx="84" cy="44" r="10" fill="#EFB52E" />
      <circle cx="40" cy="82" r="7" fill="#EFB52E" />
      <circle cx="46" cy="56" r="6" fill="#221C17" />
      <circle cx="74" cy="56" r="6" fill="#221C17" />
      <circle cx="48" cy="54" r="2" fill="#fff" />
      <circle cx="76" cy="54" r="2" fill="#fff" />
      <circle cx="36" cy="70" r="6" fill="#F08A7E" opacity=".7" />
      <circle cx="84" cy="70" r="6" fill="#F08A7E" opacity=".7" />
      {humor === "pensando" ? <path d="M50 80 h20" stroke="#221C17" strokeWidth="4" strokeLinecap="round" /> : <path d="M46 76 q14 14 28 0" fill="none" stroke="#221C17" strokeWidth="4" strokeLinecap="round" />}
      {humor === "festa" && <path d="M60 4 l6 12 13 2 -10 9 3 13 -12 -7 -12 7 3 -13 -10 -9 13 -2z" fill="#7A1F1F" />}
    </svg>
  );
}

/** Lembrete de pausa a cada 20 minutos (desligável pelo adulto, guardado só no aparelho). */
function LembreteDePausa() {
  const desligado = useSyncExternalStore(assinar, () => ler(CHAVE_PAUSA) === "0", () => true);
  const [aviso, setAviso] = useState(false);
  useEffect(() => {
    if (desligado) return;
    const t = window.setInterval(() => setAviso(true), 20 * 60 * 1000);
    return () => window.clearInterval(t);
  }, [desligado]);
  if (!aviso) return null;
  return (
    <div role="status" className="fixed inset-x-4 bottom-4 z-[80] mx-auto max-w-md border-4 border-ink bg-[#FFF4D6] p-5 text-center font-sans text-ink shadow-lg">
      <Mascote tamanho={64} />
      <p className="mt-2 text-xl font-bold">Hora de uma pausa!</p>
      <p className="mt-1">Levante, estique os braços, beba água e olhe para longe um pouquinho.</p>
      <button type="button" onClick={() => setAviso(false)} className="mt-3 min-h-12 cursor-pointer border-2 border-ink bg-ink px-6 font-bold text-parchment">Voltei!</button>
    </div>
  );
}

/** A faixa de cima da área infantil: casa, som e a porta (com portão) para os adultos e o resto do site. */
export function CabecalhoInfantil({ lang }: { lang: string }) {
  const [mudo, setMudo] = useMudo();
  const [portao, setPortao] = useState<null | "site" | "adultos">(null);
  const router = useRouter();
  return (
    <>
      <header className="no-print sticky top-0 z-40 border-b-4 border-ink bg-[#FFF4D6] font-sans">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-2">
          <Link href={`/${lang}/criancas`} className="flex min-h-12 items-center gap-2 text-xl font-bold text-ink">
            <Mascote tamanho={44} />
            Cantinho da Lua
          </Link>
          <span className="ml-auto" />
          <button type="button" onClick={() => setMudo(!mudo)} aria-pressed={!mudo} className="min-h-12 min-w-12 cursor-pointer border-2 border-ink bg-white px-3 text-lg font-bold" aria-label={mudo ? "Ligar o som" : "Desligar o som"}>
            {mudo ? "🔇 Som desligado" : "🔊 Som ligado"}
          </button>
          <button type="button" onClick={() => setPortao("adultos")} className="min-h-12 cursor-pointer border-2 border-ink bg-white px-3 font-bold">Para adultos</button>
        </div>
      </header>
      <PortaoDeAdulto
        aberto={portao !== null}
        motivo="Esta parte leva para fora do Cantinho."
        fechar={() => setPortao(null)}
        liberar={() => {
          setPortao(null);
          router.push(`/${lang}/criancas/adultos`);
        }}
      />
      <LembreteDePausa />
    </>
  );
}

/** Cartão com a faixa etária, o objetivo e a nota para o adulto, no pé de cada atividade. */
export function NotaParaOAdulto({ idade, objetivo, aprende, nota }: { idade: string; objetivo: string; aprende: string; nota: string }) {
  return (
    <details className="mt-10 border-2 border-dashed border-ink/50 bg-white/60 p-4 font-sans text-sm">
      <summary className="cursor-pointer font-bold">Para o adulto · {idade}</summary>
      <p className="mt-2"><strong>Objetivo:</strong> {objetivo}</p>
      <p className="mt-1"><strong>O que a criança aprende:</strong> {aprende}</p>
      <p className="mt-1">{nota}</p>
      <p className="mt-1 text-ink-soft">Conteúdo em revisão por educador.</p>
    </details>
  );
}

/** Configurações dos adultos: som, lembrete de pausa e apagar o que o Cantinho guardou neste aparelho. */
export function ConfiguracoesDoCantinho() {
  const [mudo, setMudo] = useMudo();
  const pausaDesligada = useSyncExternalStore(assinar, () => ler(CHAVE_PAUSA) === "0", () => false);
  const [apagado, setApagado] = useState(false);
  return (
    <div className="space-y-3 font-sans">
      <label className="flex items-center gap-2"><input type="checkbox" checked={!mudo} onChange={(e) => setMudo(!e.target.checked)} /> Som e leitura em voz alta ligados</label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={!pausaDesligada} onChange={(e) => gravar(CHAVE_PAUSA, e.target.checked ? null : "0")} /> Lembrete de pausa a cada 20 minutos</label>
      <button type="button" className="cursor-pointer border-2 border-ink px-4 py-2 font-bold" onClick={() => {
        try {
          for (const k of Object.keys(window.localStorage)) if (k.startsWith("lucia:criancas")) window.localStorage.removeItem(k);
        } catch {
          // sem armazenamento: não há o que apagar
        }
        window.dispatchEvent(new Event(AVISO));
        setApagado(true);
      }}>Apagar tudo o que o Cantinho guardou neste aparelho</button>
      {apagado && <p role="status">Pronto: nada do Cantinho ficou guardado neste aparelho.</p>}
    </div>
  );
}
