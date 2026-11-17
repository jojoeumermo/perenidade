// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { escolherVoz, ETIQUETA_DA_LINGUA, textoParaOuvir, trechosParaFalar } from "@/lib/rede/midia/voz";
import type { Post } from "@/lib/rede/tipos";
import type { ContextoDoEncaixe } from "../encaixes";
import { useTextosDaMidia } from "./base";

// ── Uma fala por vez, na página toda ──────────────────────────────────────────────────────────────────────────────────────
// Tocar "Ouvir" em outro post para o que estava falando; sair da página para tudo. Nada fica guardado.
let falando: string | null = null;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());
const assinar = (f: () => void) => {
  ouvintes.add(f);
  return () => void ouvintes.delete(f);
};

function sintese(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined" ? window.speechSynthesis : null;
}

export function pararDeFalar(): void {
  sintese()?.cancel();
  if (falando !== null) {
    falando = null;
    avisar();
  }
}

function falar(id: string, texto: string, voz: SpeechSynthesisVoice, lang: string): void {
  const s = sintese();
  if (!s) return;
  s.cancel();
  const trechos = trechosParaFalar(texto);
  if (!trechos.length) return;
  falando = id;
  avisar();
  trechos.forEach((t, i) => {
    const u = new SpeechSynthesisUtterance(t);
    u.voice = voz;
    u.lang = voz.lang || ETIQUETA_DA_LINGUA[lang] || lang;
    if (i === trechos.length - 1) {
      u.onend = () => {
        if (falando === id) {
          falando = null;
          avisar();
        }
      };
    }
    u.onerror = () => {
      if (falando === id) {
        falando = null;
        avisar();
      }
    };
    s.speak(u);
  });
}

if (typeof window !== "undefined") window.addEventListener("pagehide", pararDeFalar);

/** A voz local do aparelho para a língua da página (nula: o aparelho não tem; o botão não aparece). */
function useVozLocal(lang: string): SpeechSynthesisVoice | null {
  const [voz, setVoz] = useState<SpeechSynthesisVoice | null>(null);
  useEffect(() => {
    const s = sintese();
    if (!s) return;
    const ler = () => setVoz(escolherVoz(s.getVoices(), lang));
    ler();
    s.addEventListener("voiceschanged", ler);
    return () => s.removeEventListener("voiceschanged", ler);
  }, [lang]);
  return voz;
}

function IconeOuvir({ falandoAgora }: { falandoAgora: boolean }) {
  return falandoAgora ? (
    <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  ) : (
    <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10v4a1 1 0 0 0 1 1h2.5L12 19V5L7.5 9H5a1 1 0 0 0-1 1Z" />
      <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
    </svg>
  );
}

/**
 * "Ouvir" um post ou uma resposta com a voz do aparelho. Só aparece quando o aparelho tem voz local no idioma da página. Tocar de
 * novo para; "Escape" com o foco no botão também para. `classe` vem de quem pendura (o menu do cartão, a fileira da resposta).
 */
export function BotaoOuvir({ post, lang, classe, resposta = false, comRotulo = true }: { post: Post & { silenciada?: boolean }; lang: string; classe: string; resposta?: boolean; comRotulo?: boolean }) {
  const tm = useTextosDaMidia(lang);
  const voz = useVozLocal(lang);
  const agora = useSyncExternalStore(assinar, () => falando, () => null);
  const id = `ouvir-${post.id}`;
  const meu = agora === id;
  useEffect(() => () => {
    if (falando === id) pararDeFalar();
  }, [id]);
  if (!tm || !voz || post.silenciada) return null;
  const rotulo = meu ? `${tm.ouvir.lendo} · ${tm.ouvir.parar}` : resposta ? tm.ouvir.rotuloResposta : tm.ouvir.rotulo;
  return (
    <button
      type="button"
      className={classe}
      aria-pressed={meu}
      aria-label={comRotulo ? undefined : rotulo}
      title={rotulo}
      onClick={(e) => {
        e.stopPropagation();
        if (meu) return pararDeFalar();
        const texto = textoParaOuvir({ titulo: post.titulo, texto: post.texto, corpo: post.corpo, aviso: post.aviso }, { aviso: tm.ouvir.aviso, link: tm.ouvir.link });
        falar(id, texto, voz, lang);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && meu) {
          e.preventDefault();
          pararDeFalar();
        }
      }}
    >
      <IconeOuvir falandoAgora={meu} />
      {comRotulo && <span>{meu ? tm.ouvir.parar : tm.ouvir.botao}</span>}
    </button>
  );
}

/**
 * Enquanto a leitura que começou no menu "mais" toca, uma pílula fixa no pé da tela diz que está lendo e dá o "Parar a leitura"
 * fora do menu (fechado o menu, o botão de dentro some da vista). Vai para o corpo da página com a pele da Alumia (os tokens).
 */
function PilulaDaLeitura({ lang, id }: { lang: string; id: string }) {
  const tm = useTextosDaMidia(lang);
  const agora = useSyncExternalStore(assinar, () => falando, () => null);
  if (!tm || agora !== id || typeof document === "undefined") return null;
  return createPortal(
    <div className="al-pele m12-lendo" role="status" onClick={(e) => e.stopPropagation()}>
      <IconeOuvir falandoAgora={false} />
      <span>{tm.ouvir.lendo}</span>
      <button type="button" className="m12-lendo-parar" onClick={() => pararDeFalar()}>
        {tm.ouvir.parar}
      </button>
    </div>,
    document.body,
  );
}

/** No menu "mais" do cartão (encaixe acoesDoCartao). */
export function OuvirNoCartao({ lang, post }: ContextoDoEncaixe & { post: Post }) {
  return (
    <>
      <BotaoOuvir post={post} lang={lang} classe="al2-acao justify-start" />
      <PilulaDaLeitura lang={lang} id={`ouvir-${post.id}`} />
    </>
  );
}
