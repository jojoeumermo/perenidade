// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// As peças comuns das telas dos atos: ícones, o mosaico do ato (com o cartão dourado escolhido NESTE aparelho), o carimbo com a
// data de antes riscada, o bloco da data e as ações Chegar, Chamar e Pôr na agenda. Cada peça tem uma função: nada é enfeite.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Carimbo } from "../ui/Carimbo";
import { MosaicoVivo } from "./MosaicoVivo";
import { sementeDoAparelho } from "@/lib/rede/atos/aparelho";
import { MOLAS, podeMexer } from "@/lib/rede/atos/movimento";
import { linkDoMapa, textoParaChamar } from "@/lib/rede/atos/chegar";
import { pontoEDetalhe } from "@/lib/rede/atos/formulario";
import { icsDoAto, nomeDoIcs } from "@/lib/rede/atos/ics";
import { blocoDaData, dataCurta, diaEHora, diaMes } from "@/lib/rede/atos/tempo";
import { normalizarPalavra } from "@/lib/rede/mosaico";
import { preencherAto, type TextosDosAtos } from "@/lib/rede/textos-atos";
import type { Ato } from "@/lib/rede/tipos-atos";
import "./atos.css";

// ───── ícones (traço de 2, 24×24, como os da casca) ─────
const svg = (d: ReactNode, tamanho = 22) => (
  <svg aria-hidden width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);
export const Icone = {
  visto: (t?: number) => svg(<path d="M5 12.5l4.5 4.5L19 7.5" />, t),
  conversa: (t?: number) => svg(<path d="M4 5h16v11H9l-5 4z" />, t),
  pino: (t?: number) => svg(<><path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21z" /><circle cx="12" cy="9.8" r="2.3" /></>, t),
  chamar: (t?: number) => svg(<><path d="M12 15V4M7.5 8.5L12 4l4.5 4.5" /><path d="M5 13v6h14v-6" /></>, t),
  agenda: (t?: number) => svg(<><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></>, t),
  baixo: (t?: number) => svg(<path d="M6 9l6 6 6-6" />, t),
  voltar: (t?: number) => svg(<path d="M15 5l-7 7 7 7" />, t),
  bandeira: (t?: number) => svg(<path d="M5 21V4M5 5h13l-2.5 4 2.5 4H5" />, t),
  fora: (t?: number) => svg(<><path d="M14 5h5v5M19 5l-8 8" /><path d="M18 14v5H5V6h5" /></>, t),
  copiar: (t?: number) => svg(<><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></>, t),
  sino: (t?: number) => svg(<><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></>, t),
  corrente: (t?: number) => svg(<><path d="M9.5 14.5l5-5" /><path d="M11 6.5l1.5-1.5a3.5 3.5 0 0 1 5 5L16 11.5" /><path d="M13 17.5L11.5 19a3.5 3.5 0 0 1-5-5L8 12.5" /></>, t),
};

/** O que o leitor de tela ouve do mosaico: a palavra e a proporção (nunca um número de pessoas). */
export function rotuloDoMosaico(t: TextosDosAtos, ato: Pick<Ato, "palavra" | "acesos" | "vou_eu" | "situacao">): string {
  const palavra = normalizarPalavra(ato.palavra);
  if (ato.acesos === null || ato.situacao === "cancelado") return preencherAto(t.mosaico.rotuloApagado, { palavra });
  const base = preencherAto(t.mosaico.rotuloAceso, { palavra, pct: Math.round(ato.acesos * 100) });
  return ato.vou_eu ? base + t.mosaico.rotuloVoce : base;
}

/**
 * O mosaico de um ato. O cartão dourado só aparece depois de montar no navegador: a semente que escolhe a posição dele nasce e
 * fica neste aparelho (lib/rede/atos/aparelho.ts). Ato cancelado fica apagado.
 */
export function MosaicoDoAto({ ato, t, quebrar, className, inclinar }: { ato: Ato; t: TextosDosAtos; quebrar?: number; className?: string; inclinar?: boolean }) {
  const [semente, setSemente] = useState<string | null>(null);
  useEffect(() => {
    queueMicrotask(() => setSemente(sementeDoAparelho()));
  }, []);
  const apagado = ato.situacao === "cancelado";
  return (
    <MosaicoVivo
      inclinar={inclinar}
      palavra={ato.palavra || ato.titulo}
      semente={ato.id}
      proporcao={apagado ? null : ato.acesos}
      quebrar={quebrar}
      voce={!apagado && ato.vou_eu && semente !== null}
      sementeLocal={semente ?? undefined}
      rotulo={rotuloDoMosaico(t, ato)}
      className={className}
    />
  );
}

/**
 * Bate o carimbo: cai de cima, grande e torto, bate na mesa com mola (quica um pouco), solta a tinta em volta e dá um tranco no
 * cartão. `forte` é a troca de situação (o organizador acabou de adiar ou cancelar): cai de mais alto e o tranco é maior.
 */
export function baterCarimbo(el: HTMLElement, forte = false, atraso = 0): void {
  if (!podeMexer()) return;
  const carimbo = el.querySelector<HTMLElement>(".al-carimbo");
  const tinta = el.querySelector<HTMLElement>(".al-carimbo-tinta");
  carimbo?.animate(
    [
      { scale: forte ? 3.2 : 2.3, rotate: forte ? "-16deg" : "-9deg", opacity: 0, filter: "blur(3px)" },
      { scale: 1, rotate: "0deg", opacity: 1, filter: "blur(0px)" },
    ],
    { duration: MOLAS.quique.duracao, easing: MOLAS.quique.easing, delay: atraso, fill: "backwards" },
  );
  tinta?.animate([{ opacity: 0, scale: 0.6 }, { opacity: 0.55, scale: 1.05, offset: 0.25 }, { opacity: 0, scale: 1.35 }], {
    duration: 700,
    delay: atraso + 150,
    easing: "ease-out",
  });
  const cartao = el.closest<HTMLElement>("article, .al-ato-item");
  cartao?.animate([{ translate: "0 0" }, { translate: `0 ${forte ? 4 : 2}px` }, { translate: "0 0" }], { duration: 260, delay: atraso + 150, easing: "cubic-bezier(.3,1.5,.5,1)" });
}

/**
 * O carimbo da situação, no idioma da tela, com física: bate quando aparece na tela pela primeira vez e bate de novo, mais forte,
 * quando a situação muda. Carimbo nunca é enfeite: só aparece por decisão humana registrada (a situação do ato).
 */
export function CarimboDoAto({ ato, t, tamanho = "m", className = "", bater = true }: { ato: Pick<Ato, "situacao">; t: TextosDosAtos; tamanho?: "p" | "m" | "g"; className?: string; bater?: boolean }) {
  const caixa = useRef<HTMLSpanElement>(null);
  const antes = useRef<Ato["situacao"] | null>(null);
  useEffect(() => {
    const el = caixa.current;
    const velha = antes.current;
    antes.current = ato.situacao;
    if (!el || !bater) return;
    if (velha !== null && velha !== ato.situacao) {
      baterCarimbo(el, true);
      return;
    }
    if (velha !== null || typeof IntersectionObserver === "undefined") return;
    const olho = new IntersectionObserver(
      (entradas) => {
        if (!entradas.some((e) => e.isIntersecting)) return;
        olho.disconnect();
        baterCarimbo(el, false, 200 + Math.random() * 180);
      },
      { threshold: 0.6 },
    );
    olho.observe(el);
    return () => olho.disconnect();
  }, [ato.situacao, bater]);
  return (
    <span ref={caixa} className={`al-carimbo-vivo ${className}`.trim()}>
      <span className="al-carimbo-tinta" aria-hidden data-situacao={ato.situacao} />
      <Carimbo situacao={ato.situacao} texto={t.situacao[ato.situacao]} tamanho={tamanho} />
    </span>
  );
}

/** "era 12/11", riscado, quando o ato foi adiado (a data de antes continua legível: ninguém é pego de surpresa). */
export function Era({ ato, t, lang }: { ato: Pick<Ato, "inicio_anterior">; t: TextosDosAtos; lang: string }) {
  if (!ato.inicio_anterior) return null;
  return <s className="al-ato-era">{preencherAto(t.era, { data: diaMes(ato.inicio_anterior, lang) })}</s>;
}

/** O bloco da data das listas: "15" grande e "NOV" embaixo. */
export function BlocoDaData({ iso, lang, apagado }: { iso: string; lang: string; apagado?: boolean }) {
  const b = blocoDaData(iso, lang);
  return (
    <span className={`al-ato-bloco${apagado ? " al-ato-bloco-apagado" : ""}`} aria-hidden>
      <span className="al-cond al-ato-bloco-dia">{b.dia}</span>
      <span className="al-cond al-ato-bloco-mes">{b.mes}</span>
    </span>
  );
}

/** A linha curta de um ato nas listas ("Itaquera · ter 6h · era 12/11" ou o motivo do cancelamento). */
export function LinhaCurta({ ato, t, lang, comData = true }: { ato: Ato; t: TextosDosAtos; lang: string; comData?: boolean }) {
  if (ato.situacao === "cancelado" && ato.motivo) return <span className="al-ato-linha-curta">{ato.motivo}</span>;
  const { ponto } = pontoEDetalhe(ato.onde);
  return (
    <span className="al-ato-linha-curta">
      {ponto}
      {comData ? <> · {diaEHora(ato.inicio, lang)}</> : null}
      {ato.inicio_anterior ? <> · <Era ato={ato} t={t} lang={lang} /></> : null}
    </span>
  );
}

/** O endereço público do ato (para Chamar e para o .ics). */
export function enderecoDoAto(lang: string, id: string): string {
  const origem = typeof location === "undefined" ? "https://alumia.institutolucia.org" : location.origin;
  return `${origem}/${lang}/alumia/ato/${id}`;
}

/**
 * "Chamar": o compartilhar do próprio aparelho (WhatsApp, Telegram…); sem ele, copia o link. Vai só o nome do ato, quando e onde;
 * nunca quem vai. Devolve "copiado" quando copiou (a tela avisa), "falhou" quando nem copiar deu (a tela mostra o endereço),
 * "compartilhado" ou "nada" (a pessoa fechou o compartilhar).
 */
export async function chamarAto(ato: Ato, lang: string): Promise<"compartilhado" | "copiado" | "falhou" | "nada"> {
  const url = enderecoDoAto(lang, ato.id);
  const texto = textoParaChamar(ato.titulo, dataCurta(ato.inicio, lang), pontoEDetalhe(ato.onde).ponto);
  try {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      await navigator.share({ title: ato.titulo, text: texto, url });
      return "compartilhado";
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return "nada";
  }
  try {
    await navigator.clipboard.writeText(`${texto}\n${url}`);
    return "copiado";
  } catch {
    // sem permissão da área de transferência (aba sem foco, navegador antigo): o jeito velho, por um campo escondido
    return copiarPeloCampo(`${texto}\n${url}`) ? "copiado" : "falhou";
  }
}

function copiarPeloCampo(texto: string): boolean {
  if (typeof document === "undefined") return false;
  const ativo = document.activeElement as HTMLElement | null;
  const campo = document.createElement("textarea");
  campo.value = texto;
  campo.setAttribute("readonly", "");
  campo.setAttribute("aria-hidden", "true");
  campo.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
  document.body.appendChild(campo);
  campo.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  campo.remove();
  ativo?.focus?.({ preventScroll: true });
  return ok;
}

/** "Pôr na agenda": monta o .ics NO APARELHO e baixa (nada vai ao servidor; ninguém fica sabendo). */
export function baixarIcs(ato: Ato, lang: string): void {
  const texto = icsDoAto(ato, { url: enderecoDoAto(lang, ato.id) });
  const blob = new Blob([texto], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nomeDoIcs(ato.titulo);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** O link do "Chegar": mapa livre de fora, só com o ponto público do ato; sem Referer, sem nada de quem clicou. */
export function hrefDoChegar(ato: Ato): string {
  return linkDoMapa(pontoEDetalhe(ato.onde).ponto, ato.cidade);
}
