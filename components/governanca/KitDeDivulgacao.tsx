// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { type CSSProperties, type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { diaDe, type Formato, type LambeDoDia } from "@/lib/lambe-do-dia";
import { xilogravura } from "@/lib/xilogravuras";

/**
 * O kit de agitação, no desenho dos lambe-lambes do site: papel de uma cor por peça (o vermelho do grito, o anil da
 * pergunta, o verde da mata, o amarelo do ipê, o preto do luto, o papel cru do cordel), xilogravura, carimbo e
 * bandeirinha. Cartazes, lambes, faixa, folhetos, zine, convites, cartões, filipetas, marcadores, adesivos e
 * bandeirinhas; toda peça leva o site, o QR e o Instagram do instituto.
 * Tudo desenhado aqui, em HTML e SVG (vetor), no tamanho de verdade em milímetros, e impresso pelo próprio navegador
 * (Imprimir › Salvar como PDF). O QR code chega pronto do servidor, gerado pela biblioteca do próprio site.
 */
type Modo = "cor" | "tinta" | "escuro";
type Tom = "vermelho" | "anil" | "verde" | "ipe" | "preto" | "papel";
type Grupo = "rua" | "escola" | "mao" | "colar";
type Peca =
  | "lambe-do-dia"
  | "lambe"
  | "cartaz-a3"
  | "raios"
  | "lambe-rua"
  | "estude"
  | "faixa"
  | "evento"
  | "sala-de-aula"
  | "convite-nucleo"
  | "bandeirinhas"
  | "banner-mesa"
  | "folheto"
  | "boca-de-fabrica"
  | "voluntario"
  | "zine"
  | "calendario"
  | "marcadores"
  | "cartoes"
  | "filipetas"
  | "adesivos"
  | "insta-adesivos";

const INSTA = "@institutoluciaorg";

interface DefPeca {
  id: Peca;
  grupo: Grupo;
  nome: string;
  papel: string;
  pagina: string;
  w: number;
  h: number;
  nova?: boolean;
}

const PECAS: DefPeca[] = [
  { id: "lambe-do-dia", grupo: "rua", nome: "O lambe-lambe do dia", papel: "A4 retrato · o mesmo da página inicial", pagina: "A4 portrait", w: 210, h: 297, nova: true },
  { id: "lambe", grupo: "rua", nome: "O saber é do povo", papel: "A4 retrato", pagina: "A4 portrait", w: 210, h: 297 },
  { id: "cartaz-a3", grupo: "rua", nome: "O saber é do povo, em A3", papel: "A3 retrato", pagina: "A3 portrait", w: 297, h: 420 },
  { id: "raios", grupo: "rua", nome: "Estude de graça", papel: "A4 retrato", pagina: "A4 portrait", w: 210, h: 297 },
  { id: "lambe-rua", grupo: "rua", nome: "Ninguém é dono do que a gente aprende", papel: "A3 retrato, para colar com grude", pagina: "A3 portrait", w: 297, h: 420 },
  { id: "estude", grupo: "rua", nome: "Escolha o seu caderno", papel: "A4 retrato", pagina: "A4 portrait", w: 210, h: 297 },
  { id: "faixa", grupo: "rua", nome: "Faixa de muro", papel: "A4 paisagem (emende várias)", pagina: "A4 landscape", w: 297, h: 210 },
  { id: "evento", grupo: "escola", nome: "Cartaz de evento", papel: "A4 retrato, preencha na tela", pagina: "A4 portrait", w: 210, h: 297 },
  { id: "sala-de-aula", grupo: "escola", nome: "Estude de novo. De graça.", papel: "A3 retrato, para mural de escola", pagina: "A3 portrait", w: 297, h: 420 },
  { id: "convite-nucleo", grupo: "escola", nome: "Convite para o núcleo: Consciência de classe", papel: "A5 retrato, preencha na tela", pagina: "A5 portrait", w: 148, h: 210 },
  { id: "bandeirinhas", grupo: "escola", nome: "Bandeirinhas com a sua frase", papel: "A4 paisagem, duas por folha", pagina: "A4 landscape", w: 297, h: 210, nova: true },
  { id: "banner-mesa", grupo: "escola", nome: "Banner de mesa", papel: "A4 paisagem, dobrar em três", pagina: "A4 landscape", w: 297, h: 210 },
  { id: "folheto", grupo: "mao", nome: "Uma escola aberta no seu celular", papel: "A5 retrato (dois por folha A4)", pagina: "A5 portrait", w: 148, h: 210 },
  { id: "boca-de-fabrica", grupo: "mao", nome: "Quantas horas do seu dia são suas?", papel: "A5 retrato, para a porta da fábrica", pagina: "A5 portrait", w: 148, h: 210 },
  { id: "voluntario", grupo: "mao", nome: "Vem fazer junto", papel: "A5 retrato", pagina: "A5 portrait", w: 148, h: 210 },
  { id: "zine", grupo: "mao", nome: "Zine de uma folha", papel: "A4 paisagem, dobrado em 8", pagina: "A4 landscape", w: 297, h: 210 },
  { id: "calendario", grupo: "mao", nome: "Datas de luta (calendário de bolso)", papel: "A4 retrato, 4 por folha, recortar", pagina: "A4 portrait", w: 210, h: 297, nova: true },
  { id: "marcadores", grupo: "mao", nome: "Marcadores com frases", papel: "A4 retrato, 6 por folha, recortar", pagina: "A4 portrait", w: 210, h: 297 },
  { id: "cartoes", grupo: "mao", nome: "Cartões com QR", papel: "A4 retrato, 10 por folha, recortar", pagina: "A4 portrait", w: 210, h: 297 },
  { id: "filipetas", grupo: "mao", nome: "Filipetas com QR", papel: "A4 retrato, 16 por folha, recortar", pagina: "A4 portrait", w: 210, h: 297 },
  { id: "adesivos", grupo: "colar", nome: "Adesivos redondos", papel: "A4 retrato, papel adesivo, 12 por folha", pagina: "A4 portrait", w: 210, h: 297 },
  { id: "insta-adesivos", grupo: "colar", nome: "Tiras do @ (para corrigir o que já foi impresso)", papel: "A4 retrato, papel adesivo, 33 por folha", pagina: "A4 portrait", w: 210, h: 297 },
];

const GRUPOS: { id: Grupo; nome: string; texto: string }[] = [
  { id: "rua", nome: "Para colar na rua", texto: "Lambe-lambes, cartazes e faixa para muro, poste e mural." },
  { id: "escola", nome: "Para a escola, o bairro e o núcleo", texto: "Para chamar gente para a aula aberta, a roda e o mutirão." },
  { id: "mao", nome: "Para pôr na mão", texto: "Folhetos, zine, cartões e marcadores para entregar." },
  { id: "colar", nome: "Para colar em tudo", texto: "Adesivos de papel." },
];

const MODOS: { id: Modo; nome: string }[] = [
  { id: "cor", nome: "Colorido" },
  { id: "tinta", nome: "Baixa tinta (preto e branco)" },
  { id: "escuro", nome: "Escuro" },
];

/** As cores de uma peça. "realce" é o fundo da palavra destacada do grito; "destaque", a das estrelas e rótulos. */
interface Paleta {
  papel: string;
  texto: string;
  suave: string;
  destaque: string;
  realce: string;
  realceTexto: string;
  linha: string;
  tinta: boolean;
}

const TONS: Record<Tom, Omit<Paleta, "linha" | "tinta">> = {
  vermelho: { papel: "#C21F16", texto: "#FBF6E8", suave: "#FDE2DD", destaque: "#F0B323", realce: "#F4ECD8", realceTexto: "#C21F16" },
  anil: { papel: "#23408E", texto: "#FBF6E8", suave: "#C9D6F5", destaque: "#F0B323", realce: "#F0B323", realceTexto: "#1F1A14" },
  verde: { papel: "#2E6B4F", texto: "#F4ECD8", suave: "#D9E6DC", destaque: "#F0B323", realce: "#F4ECD8", realceTexto: "#2E6B4F" },
  ipe: { papel: "#F0B323", texto: "#1F1A14", suave: "#4A3A12", destaque: "#C21F16", realce: "#1F1A14", realceTexto: "#F0B323" },
  preto: { papel: "#1F1A14", texto: "#F4ECD8", suave: "#B3A584", destaque: "#E0372B", realce: "#C21F16", realceTexto: "#FFFFFF" },
  papel: { papel: "#F4ECD8", texto: "#1F1A14", suave: "#5A4E3C", destaque: "#C21F16", realce: "#C21F16", realceTexto: "#FFFFFF" },
};
// No modo escuro, o papel é sempre a noite e a cor do tom vira o destaque.
const BRILHO: Record<Tom, string> = { vermelho: "#E0372B", anil: "#8DA6EE", verde: "#6FBF92", ipe: "#F0B323", preto: "#E0372B", papel: "#E0372B" };
const RODA_DE_TONS: Tom[] = ["vermelho", "anil", "verde", "ipe"];

function paleta(tom: Tom, modo: Modo): Paleta {
  if (modo === "tinta") return { papel: "#FFFFFF", texto: "#000000", suave: "#333333", destaque: "#000000", realce: "#000000", realceTexto: "#FFFFFF", linha: "#000000", tinta: true };
  if (modo === "escuro") return { papel: "#17130E", texto: "#F4ECD8", suave: "#CDBB91", destaque: BRILHO[tom], realce: BRILHO[tom], realceTexto: "#17130E", linha: "#F4ECD8", tinta: false };
  return { ...TONS[tom], linha: "#1F1A14", tinta: false };
}

const OFERTA: [string, string][] = [
  ["Aulas", "trilhas do básico ao avançado, com exercícios"],
  ["Acervo", "obras em domínio público e de licença livre"],
  ["Ferramentas", "calculadora, gráficos, dicionário, programação"],
  ["Laboratórios", "elétrica, redes, segurança, montagem de computador"],
];
const F = { mono: "'IBM Plex Mono', ui-monospace, monospace", serif: "'EB Garamond', Georgia, serif", grito: "Inter, system-ui, sans-serif" };
type Mm = (n: number) => string;
const emMm: Mm = (n) => `${n}mm`;
const grito = (tamanho: string, extra: CSSProperties = {}): CSSProperties => ({ fontFamily: F.grito, fontWeight: 900, fontStyle: "italic", textTransform: "uppercase", letterSpacing: "-0.02em", lineHeight: 0.9, fontSize: tamanho, margin: 0, ...extra });
const rotulo = (tamanho: string, extra: CSSProperties = {}): CSSProperties => ({ fontFamily: F.mono, fontSize: tamanho, letterSpacing: "0.22em", textTransform: "uppercase", margin: 0, ...extra });

/** Os números do site, contados na montagem da página: os cartazes nunca ficam com um número velho. */
export interface NumerosDoKit {
  disciplinas: number;
  aulas: number;
  obras: number;
}
/** Campos que a pessoa preenche na tela antes de imprimir (cartaz de evento e convite do núcleo). */
export type Evento = { titulo: string; quando: string; onde: string; contato: string };

function Estrela({ cor, tamanho }: { cor: string; tamanho: string }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: tamanho, height: tamanho, flexShrink: 0 }} aria-hidden>
      <path d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.7 7.3L12 17.8 5.7 21.5l1.7-7.3L2 9.5l7.1-.6z" fill={cor} />
    </svg>
  );
}

/** A marca do instituto, sempre a mesma (o livro aberto com a estrela). Na baixa tinta, em tons de cinza. */
function Marca({ tamanho, modo }: { tamanho: string; modo: Modo }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/marca-512.png" alt="" style={{ width: tamanho, height: tamanho, flexShrink: 0, filter: modo === "tinta" ? "grayscale(1) contrast(1.4)" : undefined }} />;
}

/** O QR code em vetor. */
function Qr({ svg, tamanho }: { svg: string; tamanho: string }) {
  const limpo = svg.replace(/fill="#ffffff"/gi, 'fill="none"');
  return <div style={{ width: tamanho, height: tamanho, flexShrink: 0 }} aria-label="QR code para institutolucia.org" dangerouslySetInnerHTML={{ __html: limpo }} />;
}

/** O QR num selo branco (o leitor do celular precisa de fundo claro), com o convite para apontar a câmera. */
function SeloQr({ qr, tamanho, mm, legenda = true }: { qr: string; tamanho: number; mm: Mm; legenda?: boolean }) {
  return (
    <div style={{ background: "#fff", padding: mm(tamanho * 0.06), border: `${mm(0.5)} solid #1F1A14`, display: "inline-flex", flexDirection: "column", alignItems: "center", gap: mm(tamanho * 0.035), flexShrink: 0 }}>
      <Qr svg={qr} tamanho={mm(tamanho)} />
      {legenda && <span style={{ fontFamily: F.mono, fontSize: mm(Math.max(1.7, tamanho * 0.072)), letterSpacing: "0.1em", color: "#1F1A14", whiteSpace: "nowrap" }}>APONTE A CÂMERA</span>}
    </div>
  );
}

/** O Instagram do instituto, em toda peça: o desenho da câmera em traço e o @. */
function Insta({ cor, tamanho, mm }: { cor: string; tamanho: number; mm: Mm }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: mm(tamanho * 0.35), fontFamily: F.mono, fontWeight: 600, fontSize: mm(tamanho), color: cor, whiteSpace: "nowrap" }}>
      <svg viewBox="0 0 24 24" style={{ width: mm(tamanho * 1.15), height: mm(tamanho * 1.15), flexShrink: 0 }} aria-hidden fill="none" stroke={cor} strokeWidth="2.2">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4.2" />
        <circle cx="17.4" cy="6.6" r="1.1" fill={cor} stroke="none" />
      </svg>
      {INSTA}
    </span>
  );
}

/** A vinheta de xilogravura (veja lib/xilogravuras.ts), chapada na cor pedida. */
function Xilo({ spec, cor, largura, altura, alinhar = "xMidYMax" }: { spec: string; cor: string; largura: string; altura: string; alinhar?: string }) {
  return <svg aria-hidden viewBox="0 0 120 40" preserveAspectRatio={`${alinhar} meet`} fill="currentColor" style={{ width: largura, height: altura, display: "block", color: cor, flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: xilogravura(spec) }} />;
}

/** A palavra destacada do grito, no recorte de outra cor. */
function Realce({ p, folga, children, fundo, cor }: { p: Paleta; folga: string; children: ReactNode; fundo?: string; cor?: string }) {
  return <span style={{ background: fundo ?? p.realce, color: cor ?? p.realceTexto, padding: `0 ${folga}`, WebkitBoxDecorationBreak: "clone", boxDecorationBreak: "clone" }}>{children}</span>;
}

/** O carimbo redondo de anel duplo, torto, como o da página inicial: a linha de cima, a estrela e a de baixo. */
function Carimbo({ cima, baixo, d, giro, mm, p }: { cima: string; baixo: string; d: number; giro: number; mm: Mm; p: Paleta }) {
  const cor = p.tinta ? "#000" : "#6E1F1A";
  const maior = Math.max(cima.length, baixo.length, 4);
  const fonte = Math.min(d * 0.095, (d * 0.74) / (maior * 0.72));
  return (
    <div aria-hidden style={{ width: mm(d), height: mm(d), borderRadius: "50%", border: `${mm(d * 0.028)} solid ${cor}`, outline: `${mm(d * 0.012)} solid ${cor}`, outlineOffset: `-${mm(d * 0.075)}`, background: p.tinta ? "#fff" : "#F4ECD8", color: cor, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", fontFamily: F.mono, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", lineHeight: 1.35, fontSize: mm(fonte), transform: `rotate(${giro}deg)`, boxSizing: "border-box", padding: mm(d * 0.13) }}>
      <span>
        {cima}
        <br />★<br />
        {baixo}
      </span>
    </div>
  );
}

/** Um cordão de bandeirinhas, de ponta a ponta, nas quatro cores (na baixa tinta, preto e branco). */
function Cordao({ largura, altura, n, p, mm }: { largura: number; altura: number; n: number; p: Paleta; mm: Mm }) {
  const cores = p.tinta ? ["#000", "#fff"] : ["#C21F16", "#23408E", "#2E6B4F", "#F0B323"];
  const passo = largura / n;
  const curva = (x: number) => 2 + altura * 0.25 * (1 - ((x - largura / 2) / (largura / 2)) ** 2);
  return (
    <svg aria-hidden viewBox={`0 0 ${largura} ${altura}`} style={{ width: mm(largura), height: mm(altura), display: "block" }}>
      <path d={`M0 2 Q${largura / 2} ${2 + altura * 0.5} ${largura} 2`} fill="none" stroke={p.tinta ? "#000" : "#1F1A14"} strokeWidth={0.5} />
      {Array.from({ length: n }, (_, i) => {
        const x = i * passo + passo * 0.08;
        const w = passo * 0.84;
        const y = curva(x + w / 2);
        return <path key={i} d={`M${x} ${y - 0.4} H${x + w} L${x + w / 2} ${y + altura * 0.6} Z`} fill={cores[i % cores.length]} stroke="#1F1A14" strokeWidth={0.35} />;
      })}
    </svg>
  );
}

/** A folha da peça: o papel na cor do tom, o fio em volta e o conteúdo por cima. */
function Folha({ w, h, p, mm, children, borda = "simples", style }: { w: number; h: number; p: Paleta; mm: Mm; children: ReactNode; borda?: "simples" | "dupla" | "nenhuma"; style?: CSSProperties }) {
  return (
    <div style={{ width: mm(w), height: mm(h), boxSizing: "border-box", position: "relative", overflow: "hidden", background: p.papel, color: p.texto, fontFamily: F.serif, border: borda === "nenhuma" ? undefined : borda === "dupla" ? `${mm(1.8)} double ${p.linha}` : `${mm(1.2)} solid ${p.linha}`, ...style }}>
      {children}
    </div>
  );
}

function Assinatura({ p, modo, qr, mm, escala = 1 }: { p: Paleta; modo: Modo; qr: string; mm: Mm; escala?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: mm(6 * escala) }}>
      <SeloQr qr={qr} tamanho={30 * escala} mm={mm} />
      <div style={{ display: "grid", gap: mm(1.7 * escala) }}>
        <div style={{ display: "flex", alignItems: "center", gap: mm(2.5 * escala) }}>
          <Marca tamanho={mm(11 * escala)} modo={modo} />
          <span style={{ fontFamily: F.serif, fontSize: mm(8 * escala), fontWeight: 600, lineHeight: 1 }}>Instituto Lúcia</span>
        </div>
        <span style={{ fontFamily: F.mono, fontSize: mm(6 * escala), fontWeight: 600 }}>institutolucia.org</span>
        <Insta cor={p.texto} tamanho={4.4 * escala} mm={mm} />
        <span style={rotulo(mm(2.9 * escala), { letterSpacing: "0.18em", color: p.suave })}>Grátis · sem anúncio · sem conta</span>
      </div>
    </div>
  );
}

function Pontos({ itens, p, mm, fonte, colunas = 1 }: { itens: [string, string?][]; p: Paleta; mm: Mm; fonte: number; colunas?: number }) {
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gridTemplateColumns: `repeat(${colunas}, 1fr)`, gap: `${mm(fonte * 0.5)} ${mm(fonte * 1.4)}` }}>
      {itens.map(([t, d]) => (
        <li key={t} style={{ display: "flex", gap: mm(fonte * 0.55), alignItems: "baseline", fontSize: mm(fonte), lineHeight: 1.22 }}>
          <Estrela cor={p.destaque} tamanho={mm(fonte * 0.78)} />
          <span>
            {d ? <strong>{t}:</strong> : t}
            {d ? ` ${d}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ───────────── Para colar na rua ───────────── */

const TOM_DO_FORMATO: Record<Formato, Tom> = { grito: "vermelho", pergunta: "anil", memoria: "preto", festa: "ipe", terra: "verde", cordel: "papel", classificado: "papel" };
const dataCurta = (dia: number) => {
  const d = new Date(dia * 86_400_000);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

/** O lambe-lambe do dia, o mesmo da página inicial, no papel da cor do formato e com o carimbo do mesmo tema. */
function LambeDoDiaImpresso({ dia, modo, qr }: { dia: LambeDoDia; modo: Modo; qr: string }) {
  const mm = emMm;
  const base = paleta(TOM_DO_FORMATO[dia.formato], modo);
  const p = dia.formato === "classificado" && modo === "cor" ? { ...base, papel: "#FBF6E8" } : base;
  const { linhas, texto, carimbo } = dia.lambe;
  const comprido = Math.max(...linhas.map((l) => l.length));
  const fonte = Math.max(15, Math.min(30, 170 / (0.64 * comprido)));
  const tiras = dia.formato === "classificado";
  return (
    <Folha w={210} h={297} p={p} mm={mm} borda={dia.formato === "cordel" ? "dupla" : "simples"}>
      {dia.formato === "festa" && (
        <div style={{ position: "absolute", left: 0, top: 0 }}>
          <Cordao largura={208} altura={24} n={12} p={p} mm={mm} />
        </div>
      )}
      {dia.formato === "pergunta" && (
        <span aria-hidden style={{ position: "absolute", right: mm(-14), top: mm(-34), fontFamily: F.grito, fontWeight: 900, fontStyle: "italic", fontSize: mm(300), lineHeight: 1, color: p.tinta ? "#ececec" : "rgba(255,255,255,0.13)" }}>
          ?
        </span>
      )}
      <div style={{ position: "relative", height: "100%", boxSizing: "border-box", padding: `${mm(dia.formato === "festa" ? 30 : 17)} ${mm(17)} ${mm(tiras ? 40 : 15)}`, display: "flex", flexDirection: "column", gap: mm(7) }}>
        {dia.formato === "cordel" && <Xilo spec={dia.xilo} cor={p.texto} largura="100%" altura={mm(60)} />}
        <p style={rotulo(mm(4), { color: p.suave })}>
          Lambe-lambe nº {dia.numero} · {dataCurta(dia.dia)}
        </p>
        <p style={grito(mm(fonte), { lineHeight: 0.88 })}>
          {linhas[0]}
          <br />
          {linhas[1]}
          <br />
          {linhas[2]}
        </p>
        <p style={{ fontSize: mm(7.4), lineHeight: 1.28, margin: 0, maxWidth: mm(150) }}>{texto}</p>
        {dia.formato !== "cordel" && <Xilo spec={dia.xilo} cor={p.texto} largura={mm(78)} altura={mm(26)} alinhar="xMinYMax" />}
        <div style={{ marginTop: "auto", borderTop: `${mm(0.6)} solid ${p.tinta ? "#000" : p.suave}`, paddingTop: mm(6) }}>
          <Assinatura p={p} modo={modo} qr={qr} mm={mm} />
        </div>
      </div>
      <div style={{ position: "absolute", right: mm(13), bottom: mm(tiras ? 66 : 40) }}>
        <Carimbo cima={carimbo?.[0] ?? "Grátis"} baixo={carimbo?.[1] ?? "Para sempre"} d={40} giro={-14} mm={mm} p={p} />
      </div>
      {tiras && (
        // As tirinhas de destacar do classificado de poste, com o endereço do site: quem passa leva uma.
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: mm(32), display: "flex", borderTop: `${mm(0.5)} dashed ${p.linha}` }}>
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} style={{ flex: 1, borderLeft: i ? `${mm(0.35)} dashed ${p.linha}` : undefined, writingMode: "vertical-rl", transform: "rotate(180deg)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.mono, fontSize: mm(3), fontWeight: 600, letterSpacing: "0.04em" }}>
              institutolucia.org
            </span>
          ))}
        </div>
      )}
    </Folha>
  );
}

/** O lambe-lambe de sempre, agora no vermelho do grito, com a xilogravura do livro e o carimbo de graça. */
function SaberDoPovo({ modo, qr, u }: { modo: Modo; qr: string; u: number }) {
  const mm: Mm = (n) => `${n * u}mm`;
  const p = paleta("vermelho", modo);
  return (
    <Folha w={210} h={297} p={p} mm={mm}>
      <div style={{ height: "100%", boxSizing: "border-box", padding: `${mm(14)} ${mm(16)} ${mm(14)}`, display: "flex", flexDirection: "column", gap: mm(6) }}>
        <Xilo spec="livro/estrelas/morro" cor={p.texto} largura="100%" altura={mm(46)} />
        <p style={rotulo(mm(4), { color: p.suave })}>Lambe-lambe · educação popular</p>
        <p style={grito(mm(29))}>
          O saber
          <br />é do
          <br />
          <Realce p={p} folga={mm(3)}>povo.</Realce>
        </p>
        <p style={{ fontSize: mm(7.2), lineHeight: 1.22, margin: 0, maxWidth: mm(150) }}>Uma escola e uma biblioteca livres, feitas por voluntários. Estude no celular ou no computador, no seu tempo.</p>
        <Pontos itens={OFERTA} p={p} mm={mm} fonte={5.1} />
        <div style={{ marginTop: "auto", borderTop: `${mm(0.6)} solid ${p.tinta ? "#000" : p.suave}`, paddingTop: mm(6) }}>
          <Assinatura p={p} modo={modo} qr={qr} mm={mm} />
        </div>
      </div>
      <div style={{ position: "absolute", right: mm(13), top: mm(96) }}>
        <Carimbo cima="Grátis" baixo="Para sempre" d={36} giro={12} mm={mm} p={p} />
      </div>
    </Folha>
  );
}

/** "Estude de graça": o sol de cordel nascendo atrás do grito, no amarelo do ipê. */
function EstudeDeGraca({ modo, qr, numeros }: { modo: Modo; qr: string; numeros: NumerosDoKit }) {
  const mm = emMm;
  const p = paleta("ipe", modo);
  const raios = Array.from({ length: 36 }, (_, i) => {
    const a = (i / 36) * Math.PI * 2;
    const b = a + Math.PI / 36;
    return `M200 300 L${200 + 520 * Math.cos(a)} ${300 + 520 * Math.sin(a)} L${200 + 520 * Math.cos(b)} ${300 + 520 * Math.sin(b)} Z`;
  }).join(" ");
  return (
    <Folha w={210} h={297} p={p} mm={mm}>
      {!p.tinta && (
        <svg aria-hidden viewBox="0 0 210 297" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          <path d={raios} fill={modo === "escuro" ? "#241d14" : "#E39E12"} />
        </svg>
      )}
      <div style={{ position: "relative", height: "100%", boxSizing: "border-box", padding: mm(16), display: "flex", flexDirection: "column", gap: mm(7) }}>
        <p style={rotulo(mm(4.2), { color: p.suave })}>Instituto Lúcia · de graça</p>
        <p style={grito(mm(33), { lineHeight: 0.88 })}>
          Estude
          <br />
          de <Realce p={p} folga={mm(2.5)}>graça.</Realce>
        </p>
        <p style={{ fontSize: mm(7.4), lineHeight: 1.22, margin: 0, maxWidth: mm(130) }}>Do ENEM à alfabetização, de programação a primeiros socorros. Sem pagar, sem conta, sem anúncio.</p>
        <Xilo spec="escola/sol/calcada" cor={p.texto} largura="100%" altura={mm(56)} />
        <p style={{ fontSize: mm(6.4), lineHeight: 1.25, margin: 0 }}>
          <strong>{numeros.disciplinas} disciplinas</strong>, laboratórios, rádio, jornal e uma biblioteca inteira. Tudo feito por voluntários, para quem trabalha e estuda.
        </p>
        <div style={{ marginTop: "auto" }}>
          <Assinatura p={p} modo={modo} qr={qr} mm={mm} />
        </div>
      </div>
    </Folha>
  );
}

/** O lambe de rua em A3: o grito enorme no verde da mata, a multidão embaixo e o QR grande. */
function NinguemEDono({ modo, qr }: { modo: Modo; qr: string }) {
  const mm = emMm;
  const p = paleta("verde", modo);
  return (
    <Folha w={297} h={420} p={p} mm={mm}>
      <div style={{ height: "100%", boxSizing: "border-box", padding: mm(22), display: "flex", flexDirection: "column", gap: mm(10), fontFamily: F.grito }}>
        <p style={rotulo(mm(6.5), { color: p.suave, letterSpacing: "0.3em" })}>Lambe-lambe · Instituto Lúcia</p>
        <p style={grito(mm(46), { lineHeight: 0.86, letterSpacing: "-0.03em", whiteSpace: "nowrap" })}>
          Ninguém
          <br />é dono
          <br />
          do que a
          <br />
          <Realce p={p} folga={mm(4)}>gente</Realce>
          <br />
          aprende.
        </p>
        <Xilo spec="multidao/passaros/calcada" cor={p.texto} largura="100%" altura={mm(78)} />
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: mm(10) }}>
          <SeloQr qr={qr} tamanho={50} mm={mm} />
          <div style={{ display: "grid", gap: mm(4) }}>
            <span style={{ fontFamily: F.mono, fontSize: mm(13), fontWeight: 600 }}>institutolucia.org</span>
            <Insta cor={p.texto} tamanho={9.5} mm={mm} />
          </div>
        </div>
      </div>
    </Folha>
  );
}

/** O cartaz das estantes: os cadernos coloridos com espiral e etiqueta, como na página inicial do site. */
function EscolhaOCaderno({ modo, qr, numeros }: { modo: Modo; qr: string; numeros: NumerosDoKit }) {
  const mm = emMm;
  const p = paleta("papel", modo);
  const cadernos: [string, string, string][] = [
    ["Alfabetização", "#C21F16", "#FBF6E8"],
    ["ENEM", "#23408E", "#FBF6E8"],
    ["Redação", "#F0B323", "#1F1A14"],
    ["Matemática", "#2E6B4F", "#F4ECD8"],
    ["Teoria revolucionária", "#1F1A14", "#F4ECD8"],
    ["Lutas do povo", "#6E1F1A", "#F4ECD8"],
  ];
  return (
    <Folha w={210} h={297} p={p} mm={mm} style={{ backgroundImage: p.tinta ? "none" : `radial-gradient(circle, ${modo === "escuro" ? "#3a3020" : "#cdbb91"} 0.35mm, transparent 0.45mm)`, backgroundSize: "6mm 6mm" }}>
      <div style={{ height: "100%", boxSizing: "border-box", padding: mm(16), display: "flex", flexDirection: "column" }}>
        <p style={rotulo(mm(4), { color: p.destaque })}>§ As estantes</p>
        <p style={{ fontSize: mm(17), lineHeight: 1, margin: `${mm(3)} 0 0`, fontWeight: 600 }}>Escolha o seu caderno.</p>
        <div style={{ marginTop: mm(10), display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: mm(6) }}>
          {cadernos.map(([nome, cor, letra], i) => (
            <div key={nome} style={{ position: "relative", height: mm(64), background: p.tinta ? "#fff" : cor, color: p.tinta ? "#000" : letra, border: `${mm(0.7)} solid #1F1A14`, boxShadow: p.tinta ? "none" : `${mm(1.6)} ${mm(1.6)} 0 #1F1A14`, padding: `${mm(4)} ${mm(3)} ${mm(4)} ${mm(8)}`, boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
              <span style={{ position: "absolute", left: mm(2.5), top: mm(5), bottom: mm(5), width: mm(2.4), backgroundImage: `radial-gradient(circle, ${p.tinta ? "#000" : "#F4ECD8"} 0.9mm, transparent 1mm)`, backgroundSize: `${mm(2.4)} ${mm(6)}` }} />
              <span style={{ display: "block", marginTop: mm(6), background: "#FBF6E8", color: "#1F1A14", border: `${mm(0.4)} solid #1F1A14`, padding: mm(2), fontSize: mm(5), fontWeight: 600, lineHeight: 1.05 }}>{nome}</span>
              <span style={{ marginTop: "auto", alignSelf: "flex-end" }}>
                <Xilo spec={["lapis/sol/chao", "livro/estrelas/chao", "pomba/nuvem/chao", "relogio/lua/chao", "bandeira/estrelas/chao", "punho/sol/chao"][i]} cor={p.tinta ? "#000" : letra} largura={mm(33)} altura={mm(11)} alinhar="xMaxYMax" />
              </span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: mm(6.5), lineHeight: 1.25, margin: `${mm(10)} 0 0` }}>
          São {numeros.disciplinas} disciplinas, do ensino fundamental ao superior, e ofícios que dão renda. Comece pelo essencial ou pela etapa que você quer estudar.
        </p>
        <div style={{ marginTop: "auto" }}>
          <Assinatura p={p} modo={modo} qr={qr} mm={mm} />
        </div>
      </div>
    </Folha>
  );
}

/** A faixa de muro: o cordão de bandeirinhas, o grito e o endereço, para emendar várias lado a lado. */
function FaixaDeMuro({ modo, qr }: { modo: Modo; qr: string }) {
  const mm = emMm;
  const p = paleta("anil", modo);
  return (
    <Folha w={297} h={210} p={p} mm={mm} style={{ display: "grid", gridTemplateRows: "auto 1fr auto" }}>
      <Cordao largura={295} altura={28} n={16} p={p} mm={mm} />
      <div style={{ display: "flex", alignItems: "center", gap: mm(10), padding: `0 ${mm(16)}` }}>
        <Xilo spec="livro/sol/chao" cor={p.texto} largura={mm(78)} altura={mm(78)} alinhar="xMidYMid" />
        <p style={grito(mm(30), { lineHeight: 0.88 })}>
          O saber
          <br />
          é do <Realce p={p} folga={mm(2.5)}>povo</Realce>
        </p>
      </div>
      <div style={{ background: p.tinta ? "#fff" : "#F4ECD8", color: "#1F1A14", borderTop: `${mm(1.2)} solid ${p.linha}`, padding: `${mm(5)} ${mm(16)}`, display: "flex", alignItems: "center", gap: mm(8) }}>
        <SeloQr qr={qr} tamanho={24} mm={mm} legenda={false} />
        <div style={{ display: "grid", gap: mm(2) }}>
          <p style={{ fontFamily: F.mono, fontSize: mm(12), fontWeight: 600, margin: 0 }}>institutolucia.org</p>
          <Insta cor="#1F1A14" tamanho={6.5} mm={mm} />
        </div>
        <p style={rotulo(mm(4), { marginLeft: "auto", textAlign: "right", letterSpacing: "0.2em", lineHeight: 1.6 })}>
          Educação popular
          <br />
          grátis · livre
        </p>
      </div>
    </Folha>
  );
}

/* ───────────── Para a escola, o bairro e o núcleo ───────────── */

/** Cartaz de evento: aula aberta, roda de conversa, mutirão, com cara de festa. Título, data e lugar vêm da tela. */
function CartazEvento({ modo, qr, ev }: { modo: Modo; qr: string; ev: Evento }) {
  const mm = emMm;
  const p = paleta("ipe", modo);
  return (
    <Folha w={210} h={297} p={p} mm={mm}>
      <div style={{ position: "absolute", left: 0, top: 0 }}>
        <Cordao largura={208} altura={26} n={12} p={p} mm={mm} />
      </div>
      <div style={{ height: "100%", boxSizing: "border-box", padding: `${mm(31)} ${mm(16)} ${mm(15)}`, display: "flex", flexDirection: "column", gap: mm(7) }}>
        <p style={rotulo(mm(4.3), { color: p.suave })}>★ Convite aberto · de graça</p>
        <p style={grito(mm(ev.titulo.length > 28 ? 17 : 23), { maxWidth: mm(150) })}>{ev.titulo || "Aula aberta"}</p>
        <div style={{ display: "grid", gap: mm(6), marginTop: mm(2) }}>
          {[
            ["Quando", ev.quando || "[dia e hora]"],
            ["Onde", ev.onde || "[lugar, com endereço público]"],
            ["Contato", ev.contato || INSTA],
          ].map(([r, v]) => (
            <div key={r} style={{ borderTop: `${mm(0.8)} solid ${p.linha}`, paddingTop: mm(3) }}>
              <p style={rotulo(mm(4), { color: p.destaque })}>{r}</p>
              <p style={{ fontSize: mm(10), lineHeight: 1.1, margin: `${mm(1.5)} 0 0`, fontWeight: 600 }}>{v}</p>
            </div>
          ))}
        </div>
        <p style={{ fontSize: mm(6), lineHeight: 1.25, margin: 0, maxWidth: mm(140) }}>Ninguém paga, ninguém precisa saber nada antes. Traga quem você quiser.</p>
        <div style={{ marginTop: "auto", borderTop: `${mm(0.8)} solid ${p.linha}`, paddingTop: mm(6) }}>
          <Assinatura p={p} modo={modo} qr={qr} mm={mm} />
        </div>
      </div>
      <div style={{ position: "absolute", right: mm(12), top: mm(118) }}>
        <Carimbo cima="Pode" baixo="chegar" d={36} giro={-12} mm={mm} p={p} />
      </div>
    </Folha>
  );
}

/** Cartaz de sala de aula (A3): o caderno pautado com a margem vermelha, para mural de escola, cursinho e biblioteca. */
function SalaDeAula({ modo, qr }: { modo: Modo; qr: string }) {
  const mm = emMm;
  const p = paleta("papel", modo);
  const materias = ["ENEM e redação", "Matemática", "Português", "Ciências", "História do Brasil", "Inglês e espanhol", "Programação", "Teoria revolucionária"];
  const verde = p.tinta ? "#000" : modo === "escuro" ? "#6FBF92" : "#2E6B4F";
  return (
    <Folha w={297} h={420} p={p} mm={mm} style={{ backgroundImage: p.tinta ? "none" : `repeating-linear-gradient(to bottom, transparent 0 ${mm(11.8)}, ${modo === "escuro" ? "#3a3020" : "#d9c9a3"} ${mm(11.8)} ${mm(12)})`, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: `${mm(18)} ${mm(20)} ${mm(8)}`, borderLeft: p.tinta ? undefined : `${mm(3)} solid #C21F16`, marginLeft: mm(26), flex: 1, display: "flex", flexDirection: "column" }}>
        <p style={rotulo(mm(6), { color: p.destaque })}>Estudou e não entendeu?</p>
        <p style={grito(mm(40), { margin: `${mm(6)} 0 0` })}>
          Estude de
          <br />
          novo.{" "}
          <Realce p={p} folga={mm(3)} fundo={verde} cor={p.tinta ? "#fff" : "#F4ECD8"}>
            De graça.
          </Realce>
        </p>
        <p style={{ fontSize: mm(10), lineHeight: 1.25, margin: `${mm(10)} 0 0`, maxWidth: mm(220) }}>Aulas curtas com exemplos do dia a dia, teste no fim e explicação de cada resposta. No celular, sem conta, sem anúncio.</p>
        <ul style={{ listStyle: "none", padding: 0, margin: `${mm(10)} 0 0`, display: "grid", gridTemplateColumns: "1fr 1fr", gap: `${mm(4)} ${mm(10)}` }}>
          {materias.map((m, i) => (
            <li key={m} style={{ display: "flex", alignItems: "center", gap: mm(3), fontSize: mm(8.5) }}>
              <Estrela cor={p.tinta ? "#000" : ["#C21F16", "#23408E", "#2E6B4F", "#C98A0B"][i % 4]} tamanho={mm(7)} />
              {m}
            </li>
          ))}
        </ul>
        <div style={{ marginTop: "auto", alignSelf: "flex-end" }}>
          <Xilo spec="escola/sol/calcada" cor={p.texto} largura={mm(120)} altura={mm(40)} alinhar="xMaxYMax" />
        </div>
      </div>
      <div style={{ background: p.tinta ? "#fff" : verde, color: p.tinta ? "#000" : "#F4ECD8", padding: mm(16), display: "flex", alignItems: "center", gap: mm(12), borderTop: `${mm(2)} solid ${p.linha}` }}>
        <SeloQr qr={qr} tamanho={54} mm={mm} />
        <div style={{ display: "grid", gap: mm(4) }}>
          <div style={{ display: "flex", alignItems: "center", gap: mm(4) }}>
            <Marca tamanho={mm(18)} modo={modo} />
            <span style={{ fontSize: mm(14), fontWeight: 600 }}>Instituto Lúcia</span>
          </div>
          <span style={{ fontFamily: F.mono, fontSize: mm(12), fontWeight: 600 }}>institutolucia.org</span>
          <Insta cor={p.tinta ? "#000" : "#F4ECD8"} tamanho={8} mm={mm} />
        </div>
      </div>
    </Folha>
  );
}

/** Convite para o estudo coletivo do percurso Consciência de classe (A5), com a roda de gente da xilogravura. */
function ConviteNucleo({ modo, qr, ev }: { modo: Modo; qr: string; ev: Evento }) {
  const mm = emMm;
  const p = paleta("anil", modo);
  return (
    <Folha w={148} h={210} p={p} mm={mm}>
      <div style={{ height: "100%", boxSizing: "border-box", padding: mm(10), display: "flex", flexDirection: "column", gap: mm(4) }}>
        <Xilo spec="roda/estrelas/chao" cor={p.texto} largura="100%" altura={mm(34)} />
        <p style={rotulo(mm(3.3), { color: p.suave })}>Núcleo de estudo · de graça</p>
        <p style={grito(mm(15), { lineHeight: 0.86, letterSpacing: "-0.03em" })}>
          Consciência
          <br />
          de <Realce p={p} folga={mm(1.6)}>classe.</Realce>
        </p>
        <p style={{ fontSize: mm(4.8), lineHeight: 1.3, margin: 0 }}>Ninguém nasce sabendo que é explorado. Venha estudar junto: uma hora por semana, com conversa, sem prova e sem pagar nada.</p>
        <div style={{ display: "grid", gap: mm(2.6), background: p.tinta ? "#fff" : "#F4ECD8", color: "#1F1A14", padding: mm(4.5), border: `${mm(0.6)} solid #1F1A14` }}>
          {[
            ["Quando", ev.quando || "[dia e hora]"],
            ["Onde", ev.onde || "[lugar público]"],
            ["Fale com", ev.contato || INSTA],
          ].map(([r, v]) => (
            <p key={r} style={{ margin: 0, fontSize: mm(4.5), lineHeight: 1.2 }}>
              <span style={rotulo(mm(3), { color: p.tinta ? "#000" : "#C21F16", letterSpacing: "0.2em" })}>{r} </span>
              <strong>{v}</strong>
            </p>
          ))}
        </div>
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: mm(4) }}>
          <SeloQr qr={qr} tamanho={21} mm={mm} legenda={false} />
          <div style={{ display: "grid", gap: mm(1.3) }}>
            <span style={{ fontFamily: F.mono, fontSize: mm(3.3), fontWeight: 600 }}>institutolucia.org/consciencia-de-classe</span>
            <Insta cor={p.texto} tamanho={3.3} mm={mm} />
          </div>
        </div>
      </div>
    </Folha>
  );
}

/** As letras da frase, uma por bandeirinha; o espaço entre as palavras vira uma estrela. */
function letrasDaFrase(frase: string): string[] {
  return [...frase.toUpperCase().replace(/\s+/g, " ").trim()].map((l) => (l === " " ? "★" : l));
}

/** Bandeirinhas: duas por folha deitada, uma letra em cada, nas quatro cores; dobra-se a aba no barbante. */
function folhasDeBandeirinhas({ frase, modo }: { frase: string; modo: Modo }) {
  const mm = emMm;
  const letras = letrasDaFrase(frase || "Estude de graça");
  const folhas = Array.from({ length: Math.ceil(letras.length / 2) }, (_, i) => letras.slice(i * 2, i * 2 + 2));
  return folhas.map((par, f) => (
    <div key={f} style={{ width: mm(297), height: mm(210), background: "#fff", display: "flex" }}>
      {par.map((letra, i) => {
        const p = paleta(RODA_DE_TONS[(f * 2 + i) % RODA_DE_TONS.length], modo);
        return (
          <svg key={i} aria-hidden viewBox="0 0 148.5 210" style={{ width: mm(148.5), height: mm(210), display: "block" }}>
            <line x1="4" y1="20" x2="144.5" y2="20" stroke="#8a8a8a" strokeWidth="0.4" strokeDasharray="2.4 1.6" />
            <text x="74.25" y="12" textAnchor="middle" fontFamily={F.mono} fontSize="3.1" letterSpacing="0.5" fill="#666">
              DOBRE AQUI E PASSE O BARBANTE
            </text>
            <path d="M6 20 H142.5 L74.25 203 Z" fill={p.papel} stroke="#1F1A14" strokeWidth={p.tinta ? 0.8 : 0.5} />
            {letra === "★" ? (
              <path transform="translate(74.25 76) scale(1.9)" d="M0 -20 L5.9 -8.1 L19 -6.2 L9.5 3.1 L11.8 16.2 L0 10 L-11.8 16.2 L-9.5 3.1 L-19 -6.2 L-5.9 -8.1 Z" fill={p.texto} />
            ) : (
              <text x="74.25" y="104" textAnchor="middle" fontFamily={F.grito} fontWeight="900" fontStyle="italic" fontSize="64" fill={p.texto}>
                {letra}
              </text>
            )}
          </svg>
        );
      })}
    </div>
  ));
}

/** Banner de mesa: uma tenda de papel (A4 deitado, dobrado em três) para mesa de feira, ato e evento. */
function BannerDeMesa({ modo, qr }: { modo: Modo; qr: string }) {
  const mm = emMm;
  const p = paleta("vermelho", modo);
  const face = (girar: boolean) => (
    <div style={{ height: mm(90), transform: girar ? "rotate(180deg)" : undefined, background: p.papel, color: p.texto, display: "flex", flexDirection: "column", boxSizing: "border-box", fontFamily: F.grito }}>
      <Cordao largura={297} altura={17} n={18} p={p} mm={mm} />
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: mm(8), padding: `0 ${mm(12)}` }}>
        <Marca tamanho={mm(32)} modo={modo} />
        <div style={{ flex: 1 }}>
          <p style={grito(mm(14))}>Instituto Lúcia</p>
          <p style={rotulo(mm(4.2), { margin: `${mm(2.5)} 0 0`, letterSpacing: "0.12em", color: p.suave })}>Educação popular · grátis · livre</p>
          <p style={{ fontFamily: F.mono, fontSize: mm(4.6), margin: `${mm(1.5)} 0 0`, fontWeight: 600 }}>institutolucia.org · {INSTA}</p>
        </div>
        <SeloQr qr={qr} tamanho={38} mm={mm} legenda={false} />
      </div>
    </div>
  );
  return (
    <Folha w={297} h={210} p={paleta("papel", modo)} mm={mm} borda="nenhuma" style={{ display: "grid", gridTemplateRows: `${mm(90)} ${mm(30)} ${mm(90)}` }}>
      {face(true)}
      <div style={{ borderTop: `${mm(0.4)} dashed #1F1A14`, borderBottom: `${mm(0.4)} dashed #1F1A14`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.mono, fontSize: mm(3.4), color: "#5A4E3C", letterSpacing: "0.2em" }}>DOBRE NAS LINHAS · ESTA FAIXA FICA NA MESA</div>
      {face(false)}
    </Folha>
  );
}

/* ───────────── Para pôr na mão ───────────── */

function Folheto({ modo, qr, email }: { modo: Modo; qr: string; email: string }) {
  const mm = emMm;
  const p = paleta("papel", modo);
  const cabeca = paleta("anil", modo);
  return (
    <Folha w={148} h={210} p={p} mm={mm} style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ background: cabeca.papel, color: cabeca.texto, padding: `${mm(8)} ${mm(9)} ${mm(6)}`, borderBottom: `${mm(1)} solid ${p.linha}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: mm(3) }}>
          <Marca tamanho={mm(10)} modo={modo} />
          <strong style={{ fontSize: mm(6.3) }}>Instituto Lúcia</strong>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: mm(3), marginTop: mm(4) }}>
          <p style={grito(mm(10.5), { lineHeight: 0.92, flex: 1 })}>
            Uma escola aberta,{" "}
            <Realce p={cabeca} folga={mm(1.2)}>
              no seu celular.
            </Realce>
          </p>
          <Xilo spec="onibus/sol/calcada" cor={cabeca.texto} largura={mm(42)} altura={mm(14)} alinhar="xMaxYMax" />
        </div>
      </div>
      <div style={{ padding: `${mm(7)} ${mm(9)} 0`, flex: 1, display: "grid", alignContent: "start", gap: mm(4.5) }}>
        <p style={{ fontSize: mm(4.3), lineHeight: 1.35, margin: 0 }}>Educação popular mantida por voluntários, sem fins lucrativos e sem anúncios. Tudo é livre para estudar, imprimir e levar para a sala de aula.</p>
        <Pontos itens={[...OFERTA, ["Sala livre", "para professores montarem e projetarem a aula"]]} p={p} mm={mm} fonte={3.9} />
        <p style={{ fontSize: mm(4), lineHeight: 1.35, margin: 0 }}>
          <strong>Como começar:</strong> abra o site, escolha uma disciplina e comece pela primeira aula. Não precisa criar conta.
        </p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: mm(5), borderTop: `${mm(0.6)} solid ${p.linha}`, padding: `${mm(5)} ${mm(9)}` }}>
        <SeloQr qr={qr} tamanho={25} mm={mm} />
        <div>
          <p style={{ fontFamily: F.mono, fontSize: mm(5.1), fontWeight: 600, margin: 0 }}>institutolucia.org</p>
          <p style={{ margin: `${mm(1)} 0 0` }}>
            <Insta cor={p.texto} tamanho={3.5} mm={mm} />
          </p>
          <p style={{ fontSize: mm(3.5), margin: `${mm(1)} 0 0` }}>Contato: {email}</p>
          <p style={{ fontSize: mm(3.3), margin: `${mm(1)} 0 0`, color: p.destaque }}>Quer ajudar? institutolucia.org/pt/voluntarios</p>
        </div>
      </div>
    </Folha>
  );
}

/** Panfleto de boca de fábrica: a conta da mais-valia em linguagem de chão de fábrica, no anil da pergunta. */
function BocaDeFabrica({ modo, qr }: { modo: Modo; qr: string }) {
  const mm = emMm;
  const p = paleta("anil", modo);
  return (
    <Folha w={148} h={210} p={p} mm={mm}>
      <span aria-hidden style={{ position: "absolute", right: mm(-10), top: mm(-22), fontFamily: F.grito, fontWeight: 900, fontStyle: "italic", fontSize: mm(150), lineHeight: 1, color: p.tinta ? "#ececec" : "rgba(255,255,255,0.12)" }}>
        ?
      </span>
      <div style={{ position: "relative", height: "100%", boxSizing: "border-box", padding: mm(9), display: "flex", flexDirection: "column", gap: mm(4) }}>
        <p style={rotulo(mm(3.2), { color: p.suave })}>Para quem entra no turno</p>
        <p style={grito(mm(11.5), { lineHeight: 0.92 })}>
          Quantas horas
          <br />
          do seu dia são
          <br />
          <Realce p={p} folga={mm(1.5)}>suas?</Realce>
        </p>
        <Xilo spec="fabrica/nascente/trilho" cor={p.texto} largura="100%" altura={mm(20)} alinhar="xMinYMax" />
        <p style={{ margin: 0, fontSize: mm(4.05), lineHeight: 1.35 }}>
          Faça a conta: se em <strong>4 horas</strong> você já produziu o valor do seu salário do dia, as outras <strong>4 horas</strong> da jornada são de graça para o patrão.
        </p>
        <div style={{ display: "flex", border: `${mm(0.6)} solid ${p.tinta ? "#000" : "#1F1A14"}`, fontFamily: F.mono, fontSize: mm(3.1), textAlign: "center" }}>
          <div style={{ flex: 1, padding: mm(2), background: p.tinta ? "#fff" : "#2E6B4F", color: p.tinta ? "#000" : "#F4ECD8" }}>4 h · pagam o seu salário</div>
          <div style={{ flex: 1, padding: mm(2), background: p.tinta ? "#ddd" : "#C21F16", color: p.tinta ? "#000" : "#fff" }}>4 h · ficam com o patrão</div>
        </div>
        <p style={{ margin: 0, fontSize: mm(4.05), lineHeight: 1.35 }}>
          Isso tem nome: <strong>mais-valia</strong>. Entender a conta é o primeiro passo para mudar a divisão. Aulas curtas, de graça, no celular, sobre salário, direitos no trabalho (CLT), sindicato e greve.
        </p>
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: mm(4), borderTop: `${mm(0.6)} solid ${p.tinta ? "#000" : p.suave}`, paddingTop: mm(4) }}>
          <SeloQr qr={qr} tamanho={22} mm={mm} legenda={false} />
          <div style={{ display: "grid", gap: mm(1.5) }}>
            <span style={{ fontFamily: F.mono, fontSize: mm(4.3), fontWeight: 600 }}>institutolucia.org</span>
            <Insta cor={p.texto} tamanho={3.5} mm={mm} />
            <span style={{ fontSize: mm(3.4), color: p.suave }}>Instituto Lúcia · educação popular</span>
          </div>
        </div>
      </div>
    </Folha>
  );
}

/** O panfleto do voluntariado, no verde da mata: quem sabe alguma coisa vem ensinar. */
function Voluntario({ modo, qr }: { modo: Modo; qr: string }) {
  const mm = emMm;
  const p = paleta("verde", modo);
  const funcoes: [string][] = [["Ensinar uma disciplina"], ["Revisar aulas"], ["Traduzir"], ["Gravar áudio e podcast"], ["Desenhar cartazes"], ["Cuidar da comunidade"]];
  return (
    <Folha w={148} h={210} p={p} mm={mm}>
      <div style={{ height: "100%", boxSizing: "border-box", padding: mm(10), display: "flex", flexDirection: "column", gap: mm(4.5) }}>
        <p style={rotulo(mm(3.5), { color: p.suave })}>★ O Instituto Lúcia chama</p>
        <p style={grito(mm(17))}>
          Vem fazer
          <br />
          <Realce p={p} folga={mm(2)}>junto.</Realce>
        </p>
        <Xilo spec="roda/sol/chao" cor={p.texto} largura="100%" altura={mm(26)} />
        <p style={{ fontSize: mm(4.5), lineHeight: 1.3, margin: 0 }}>Sabe explicar alguma coisa? Escreve bem, desenha, grava, traduz? O instituto é feito por quem usa, no tempo de cada um, sem chefe e sem horário.</p>
        <Pontos itens={funcoes} p={p} mm={mm} fonte={3.8} colunas={2} />
        <div style={{ marginTop: "auto", background: p.tinta ? "#fff" : "#F4ECD8", color: "#1F1A14", border: `${mm(0.8)} solid #1F1A14`, padding: mm(4), display: "flex", alignItems: "center", gap: mm(4) }}>
          <SeloQr qr={qr} tamanho={22} mm={mm} legenda={false} />
          <div>
            <p style={rotulo(mm(3.1), { letterSpacing: "0.16em" })}>Candidatura, sem conta</p>
            <p style={{ fontFamily: F.mono, fontSize: mm(4.2), fontWeight: 600, margin: `${mm(1.5)} 0 0` }}>institutolucia.org/pt/voluntarios</p>
            <p style={{ margin: `${mm(1.5)} 0 0` }}>
              <Insta cor="#1F1A14" tamanho={3.5} mm={mm} />
            </p>
          </div>
        </div>
      </div>
    </Folha>
  );
}

type PainelDeZine = { titulo: string; texto: string; xilo?: string; qr?: boolean; capa?: boolean };

function PainelDoZine({ painel, p, modo, qr, invertido }: { painel: PainelDeZine; p: Paleta; modo: Modo; qr: string; invertido?: boolean }) {
  const mm = emMm;
  const capa = painel.capa ? paleta("vermelho", modo) : p;
  return (
    <div style={{ width: mm(74.25), height: mm(105), boxSizing: "border-box", padding: mm(6), border: `${mm(0.3)} dashed ${p.linha}`, transform: invertido ? "rotate(180deg)" : undefined, display: "flex", flexDirection: "column", gap: mm(3), background: capa.papel, color: capa.texto }}>
      {painel.capa && <Marca tamanho={mm(12)} modo={modo} />}
      {painel.xilo && <Xilo spec={painel.xilo} cor={capa.texto} largura="100%" altura={mm(painel.capa ? 24 : 17)} />}
      <strong style={painel.capa ? grito(mm(8.6)) : { fontFamily: F.serif, fontWeight: 700, fontSize: mm(6.4), lineHeight: 1, color: p.destaque }}>{painel.titulo}</strong>
      <p style={{ fontSize: mm(3.9), lineHeight: 1.3, margin: 0 }}>{painel.texto}</p>
      {painel.qr && (
        <div style={{ marginTop: "auto", alignSelf: "flex-start" }}>
          <SeloQr qr={qr} tamanho={30} mm={mm} />
        </div>
      )}
    </div>
  );
}

/** Zine de uma folha: A4 deitado, 8 painéis, capa no vermelho; a fileira de cima de cabeça para baixo. */
function Zine({ modo, qr, email }: { modo: Modo; qr: string; email: string }) {
  const mm = emMm;
  const p = paleta("papel", modo);
  const paineis: PainelDeZine[] = [
    { titulo: "O saber é do povo", texto: "Instituto Lúcia: um guia de bolso.", xilo: "livro/estrelas/morro", capa: true },
    { titulo: "O que é", texto: "Escola e biblioteca digital, livre e gratuita, feita por voluntários. Sem anúncios e sem conta obrigatória.", xilo: "bandeira/sol/chao" },
    { titulo: "Aulas", texto: "Trilhas do básico ao avançado: matemática, línguas, história, ciências, ofícios e muito mais, com exercícios.", xilo: "escola/sol/calcada" },
    { titulo: "Acervo", texto: "Obras em domínio público e de licença livre, com a fonte de cada uma.", xilo: "livro/lua/chao" },
    { titulo: "Ferramentas", texto: "Calculadora, gráficos, dicionário, programação, música: tudo no navegador.", xilo: "lapis/nuvem/chao" },
    { titulo: "Laboratórios", texto: "Elétrica, redes, segurança digital e montagem de computador, sem risco.", xilo: "lamparina/estrelas/chao" },
    { titulo: "Vem fazer junto", texto: "Revise uma aula, traduza, grave áudio, desenhe. Veja: institutolucia.org/pt/voluntarios", xilo: "roda/sol/chao" },
    { titulo: "Acesse", texto: `institutolucia.org · ${INSTA} · ${email}`, qr: true },
  ];
  // A dobra clássica do zine de 8 páginas: na fileira de cima, de cabeça para baixo, as páginas 6, 5, 4 e 3; embaixo,
  // 7, 8 (contracapa), 1 (capa) e 2. Dobrada e cortada, a leitura sai na ordem certa.
  const cima = [paineis[5], paineis[4], paineis[3], paineis[2]];
  const baixo = [paineis[6], paineis[7], paineis[0], paineis[1]];
  return (
    <Folha w={297} h={210} p={p} mm={mm} borda="nenhuma" style={{ display: "grid", gridTemplateColumns: `repeat(4, ${mm(74.25)})`, gridTemplateRows: `${mm(105)} ${mm(105)}` }}>
      {cima.map((painel) => (
        <PainelDoZine key={painel.titulo} painel={painel} p={p} modo={modo} qr={qr} invertido />
      ))}
      {baixo.map((painel) => (
        <PainelDoZine key={painel.titulo} painel={painel} p={p} modo={modo} qr={qr} />
      ))}
    </Folha>
  );
}

// As datas que voltam todo ano (conferidas: leis federais, ONU e os próprios movimentos).
const DATAS_DE_LUTA: [string, string][] = [
  ["29/01", "Visibilidade Trans"],
  ["08/03", "Dia Internacional das Mulheres"],
  ["21/03", "Contra a Discriminação Racial"],
  ["17/04", "Luta Camponesa"],
  ["19/04", "Dia dos Povos Indígenas"],
  ["01/05", "Dia da Classe Trabalhadora"],
  ["13/05", "Denúncia contra o Racismo"],
  ["28/06", "Orgulho LGBTQIA+"],
  ["25/07", "Mulher Negra Latino-Americana e Caribenha e Tereza de Benguela"],
  ["29/08", "Visibilidade Lésbica"],
  ["05/09", "Dia Internacional da Mulher Indígena"],
  ["15/10", "Dia das Professoras e dos Professores"],
  ["20/11", "Zumbi e Consciência Negra"],
  ["29/11", "Solidariedade com o Povo Palestino"],
  ["10/12", "Dia dos Direitos Humanos"],
];

/** Datas de luta: o calendário de bolso que serve de marcador, quatro por folha, um em cada cor. */
function Calendario({ modo, qr }: { modo: Modo; qr: string }) {
  const mm = emMm;
  return (
    <div style={{ width: mm(210), height: mm(297), background: "#fff", display: "grid", gridTemplateColumns: `repeat(4, ${mm(48)})`, gap: mm(3), justifyContent: "center", alignContent: "center" }}>
      {RODA_DE_TONS.map((tom) => {
        const p = paleta(tom, modo);
        return (
          <div key={tom} style={{ height: mm(285), boxSizing: "border-box", border: `${mm(0.3)} dashed #8a8a8a`, background: p.papel, color: p.texto, padding: `${mm(5)} ${mm(4)}`, display: "flex", flexDirection: "column", gap: mm(2.5), fontFamily: F.serif }}>
            <Xilo spec="bandeira/sol/chao" cor={p.texto} largura="100%" altura={mm(13)} />
            <p style={rotulo(mm(2.3), { color: p.suave, letterSpacing: "0.16em" })}>Calendário de bolso</p>
            <p style={grito(mm(8.4))}>
              Datas
              <br />
              de luta
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: `${mm(1.5)} 0 0`, display: "grid", gap: mm(2.1) }}>
              {DATAS_DE_LUTA.map(([data, nome]) => (
                <li key={data} style={{ display: "grid", gridTemplateColumns: `${mm(10.5)} 1fr`, gap: mm(1.5), alignItems: "baseline", borderTop: `${mm(0.25)} solid ${p.tinta ? "#000" : p.suave}`, paddingTop: mm(1.2) }}>
                  <span style={{ fontFamily: F.mono, fontSize: mm(3.1), fontWeight: 700, color: p.destaque }}>{data}</span>
                  <span style={{ fontSize: mm(3.25), lineHeight: 1.12 }}>{nome}</span>
                </li>
              ))}
            </ul>
            <div style={{ marginTop: "auto", display: "grid", justifyItems: "center", gap: mm(1.5) }}>
              <SeloQr qr={qr} tamanho={18} mm={mm} legenda={false} />
              <span style={{ fontFamily: F.mono, fontSize: mm(2.5), fontWeight: 600 }}>institutolucia.org</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Marcadores de página: a xilogravura no alto, a marca, uma frase de estudo e o QR. 6 por folha, cada um numa cor. */
function Marcadores({ modo, qr }: { modo: Modo; qr: string }) {
  const mm = emMm;
  const frases: [string, Tom, string][] = [
    ["Estudar é um direito.", "vermelho", "escola/sol/chao"],
    ["Quem sabe ensina, quem não sabe aprende.", "anil", "roda/estrelas/chao"],
    ["O saber é do povo.", "verde", "livro/estrelas/chao"],
    ["Todo o conhecimento, para todos, para sempre.", "ipe", "lapis/sol/chao"],
    ["Leia, anote, passe adiante.", "preto", "vela/estrelas/chao"],
    ["A biblioteca é de todo mundo.", "papel", "flor/passaros/chao"],
  ];
  return (
    <div style={{ width: mm(210), height: mm(297), background: "#fff", display: "grid", gridTemplateColumns: `repeat(6, ${mm(32)})`, gap: mm(2), justifyContent: "center", alignContent: "center" }}>
      {frases.map(([frase, tom, xilo]) => {
        const p = paleta(tom, modo);
        return (
          <div key={frase} style={{ height: mm(270), boxSizing: "border-box", border: `${mm(0.3)} dashed #8a8a8a`, background: p.papel, color: p.texto, padding: `${mm(4)} ${mm(2.5)}`, display: "flex", flexDirection: "column", alignItems: "center", fontFamily: F.serif, textAlign: "center" }}>
            <Xilo spec={xilo} cor={p.texto} largura="100%" altura={mm(9)} />
            <Marca tamanho={mm(13)} modo={modo} />
            <p style={{ fontSize: mm(3.6), fontWeight: 600, margin: `${mm(1.5)} 0 0` }}>Instituto Lúcia</p>
            <Estrela cor={p.destaque} tamanho={mm(5)} />
            <p style={grito(mm(7.6), { writingMode: "vertical-rl", transform: "rotate(180deg)", lineHeight: 1, margin: `${mm(5)} 0`, flex: 1 })}>{frase}</p>
            <SeloQr qr={qr} tamanho={20} mm={mm} legenda={false} />
            <p style={{ fontFamily: F.mono, fontSize: mm(2.4), margin: `${mm(2)} 0 0` }}>institutolucia.org</p>
            <p style={{ fontFamily: F.mono, fontSize: mm(2.2), fontWeight: 600, margin: `${mm(0.6)} 0 0` }}>{INSTA}</p>
          </div>
        );
      })}
    </div>
  );
}

/** Cartões de visita com QR, 10 por folha, uma cor por fileira. */
function Cartoes({ modo, qr }: { modo: Modo; qr: string }) {
  const mm = emMm;
  const tons: Tom[] = ["vermelho", "anil", "verde", "ipe", "papel"];
  return (
    <div style={{ width: mm(210), height: mm(297), background: "#fff", display: "grid", gridTemplateColumns: `${mm(85)} ${mm(85)}`, gridAutoRows: mm(55), justifyContent: "center", alignContent: "center" }}>
      {Array.from({ length: 10 }, (_, i) => {
        const p = paleta(tons[Math.floor(i / 2)], modo);
        return (
          <div key={i} style={{ background: p.papel, color: p.texto, border: `${mm(0.3)} dashed #8a8a8a`, boxSizing: "border-box", padding: mm(4), display: "flex", alignItems: "center", gap: mm(4), fontFamily: F.serif }}>
            <SeloQr qr={qr} tamanho={30} mm={mm} legenda={false} />
            <div style={{ display: "grid", gap: mm(1) }}>
              <Marca tamanho={mm(8)} modo={modo} />
              <p style={{ fontSize: mm(4.8), fontWeight: 700, margin: 0, lineHeight: 1.05 }}>Instituto Lúcia</p>
              <p style={grito(mm(3.6), { color: p.destaque })}>O saber é do povo.</p>
              <p style={{ fontFamily: F.mono, fontSize: mm(2.9), margin: `${mm(1)} 0 0`, fontWeight: 600 }}>institutolucia.org</p>
              <Insta cor={p.texto} tamanho={2.6} mm={mm} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Filipetas com QR: 16 tirinhas por folha, para deixar no balcão, no ônibus, na fila do posto. */
function Filipetas({ modo, qr }: { modo: Modo; qr: string }) {
  const mm = emMm;
  const frases = ["O saber é do povo.", "Estude de graça.", "Ninguém é dono do que a gente aprende.", "Aula curta, no celular, sem conta."];
  return (
    <div style={{ width: mm(210), height: mm(297), background: "#fff", display: "grid", gridTemplateColumns: `${mm(100)} ${mm(100)}`, gridAutoRows: mm(34), justifyContent: "center", alignContent: "center" }}>
      {Array.from({ length: 16 }, (_, i) => {
        const p = paleta(RODA_DE_TONS[Math.floor(i / 2) % RODA_DE_TONS.length], modo);
        return (
          <div key={i} style={{ border: `${mm(0.3)} dashed #8a8a8a`, boxSizing: "border-box", background: p.papel, color: p.texto, display: "flex", alignItems: "center", gap: mm(3), padding: mm(3), fontFamily: F.serif }}>
            <SeloQr qr={qr} tamanho={24} mm={mm} legenda={false} />
            <div style={{ display: "grid", gap: mm(1.2) }}>
              <span style={grito(mm(4.3), { lineHeight: 0.95 })}>{frases[Math.floor(i / 4) % frases.length]}</span>
              <span style={{ fontFamily: F.mono, fontSize: mm(3.1), fontWeight: 600 }}>institutolucia.org</span>
              <Insta cor={p.texto} tamanho={2.7} mm={mm} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ───────────── Para colar em tudo ───────────── */

/** Adesivos redondos como carimbos de anel duplo: uma frase e uma xilogravura cada, 12 por folha. */
function Adesivos({ modo }: { modo: Modo }) {
  const mm = emMm;
  const frases: [string, string, string][] = [
    ["O saber", "é do povo", "livro/estrelas/chao"],
    ["Estude", "de graça", "escola/sol/chao"],
    ["Leia e passe", "adiante", "vela/estrelas/chao"],
    ["Quem sabe", "ensina", "roda/sol/chao"],
    ["Educação", "é direito", "lapis/nuvem/chao"],
    ["Aprender não", "tem idade", "flor/passaros/chao"],
  ];
  return (
    <div style={{ width: mm(210), height: mm(297), background: "#fff", display: "grid", gridTemplateColumns: `repeat(3, ${mm(60)})`, gridAutoRows: mm(62), gap: `${mm(4)} ${mm(6)}`, justifyContent: "center", alignContent: "center" }}>
      {Array.from({ length: 12 }, (_, i) => {
        const p = paleta(RODA_DE_TONS[i % RODA_DE_TONS.length], modo);
        const [a, b, xilo] = frases[i % frases.length];
        return (
          <div key={i} style={{ width: mm(60), height: mm(60), borderRadius: "50%", border: `${mm(0.8)} solid ${p.linha}`, outline: `${mm(0.4)} solid ${p.texto}`, outlineOffset: `-${mm(3.2)}`, background: p.papel, color: p.texto, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", boxSizing: "border-box", gap: mm(1.2) }}>
            <Xilo spec={xilo} cor={p.texto} largura={mm(30)} altura={mm(10)} />
            <p style={grito(mm(6.4), { lineHeight: 0.92 })}>
              {a}
              <br />
              {b}
            </p>
            <p style={{ fontFamily: F.mono, fontSize: mm(2.6), margin: 0, fontWeight: 600 }}>institutolucia.org</p>
          </div>
        );
      })}
    </div>
  );
}

/** Tiras do @: para colar nos materiais que já foram impressos sem o Instagram. */
function AdesivosDoInsta({ modo }: { modo: Modo }) {
  const mm = emMm;
  const tons: Tom[] = ["papel", "vermelho", "anil", "verde", "ipe"];
  return (
    <div style={{ width: mm(210), height: mm(297), background: "#fff", display: "grid", gridTemplateColumns: `repeat(3, ${mm(62)})`, gridAutoRows: mm(22), gap: `${mm(3)} ${mm(4)}`, justifyContent: "center", alignContent: "center" }}>
      {Array.from({ length: 33 }, (_, i) => {
        const p = paleta(tons[i % tons.length], modo);
        return (
          <div key={i} style={{ border: `${mm(0.6)} solid ${p.linha}`, boxSizing: "border-box", background: p.papel, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: mm(1) }}>
            <span style={rotulo(mm(2.4), { letterSpacing: "0.2em", color: p.suave })}>Siga no Instagram</span>
            <Insta cor={p.texto} tamanho={4.1} mm={mm} />
          </div>
        );
      })}
    </div>
  );
}

/* ───────────── A bancada ───────────── */

/** As folhas de uma peça (quase todas têm uma; as bandeirinhas têm uma a cada duas letras). */
function folhasDa(peca: Peca, modo: Modo, qr: string, email: string, ev: Evento, frase: string, numeros: NumerosDoKit, dia: LambeDoDia | undefined): ReactNode[] {
  switch (peca) {
    case "lambe-do-dia":
      return dia ? [<LambeDoDiaImpresso key="0" dia={dia} modo={modo} qr={qr} />] : [];
    case "lambe":
      return [<SaberDoPovo key="0" modo={modo} qr={qr} u={1} />];
    case "cartaz-a3":
      return [<SaberDoPovo key="0" modo={modo} qr={qr} u={297 / 210} />];
    case "raios":
      return [<EstudeDeGraca key="0" modo={modo} qr={qr} numeros={numeros} />];
    case "lambe-rua":
      return [<NinguemEDono key="0" modo={modo} qr={qr} />];
    case "estude":
      return [<EscolhaOCaderno key="0" modo={modo} qr={qr} numeros={numeros} />];
    case "faixa":
      return [<FaixaDeMuro key="0" modo={modo} qr={qr} />];
    case "evento":
      return [<CartazEvento key="0" modo={modo} qr={qr} ev={ev} />];
    case "sala-de-aula":
      return [<SalaDeAula key="0" modo={modo} qr={qr} />];
    case "convite-nucleo":
      return [<ConviteNucleo key="0" modo={modo} qr={qr} ev={ev} />];
    case "bandeirinhas":
      return folhasDeBandeirinhas({ frase, modo });
    case "banner-mesa":
      return [<BannerDeMesa key="0" modo={modo} qr={qr} />];
    case "folheto":
      return [<Folheto key="0" modo={modo} qr={qr} email={email} />];
    case "boca-de-fabrica":
      return [<BocaDeFabrica key="0" modo={modo} qr={qr} />];
    case "voluntario":
      return [<Voluntario key="0" modo={modo} qr={qr} />];
    case "zine":
      return [<Zine key="0" modo={modo} qr={qr} email={email} />];
    case "calendario":
      return [<Calendario key="0" modo={modo} qr={qr} />];
    case "marcadores":
      return [<Marcadores key="0" modo={modo} qr={qr} />];
    case "cartoes":
      return [<Cartoes key="0" modo={modo} qr={qr} />];
    case "filipetas":
      return [<Filipetas key="0" modo={modo} qr={qr} />];
    case "adesivos":
      return [<Adesivos key="0" modo={modo} />];
    case "insta-adesivos":
      return [<AdesivosDoInsta key="0" modo={modo} />];
  }
}

// Um milímetro na tela (96 pontos por polegada).
const PX = 96 / 25.4;
// O QR das miniaturas: só o desenho dos três cantos, leve (o de verdade aparece na prévia e na impressão).
const QR_MINIATURA = '<svg viewBox="0 0 7 7" xmlns="http://www.w3.org/2000/svg"><path fill="#000000" d="M0 0h3v3H0zM4 0h3v3H4zM0 4h3v3H0zM4 4h1v1H4zM6 4h1v1H6zM5 5h1v1H5zM4 6h1v1H4zM6 6h1v1H6z"/></svg>';

/** A miniatura de uma peça no catálogo: a peça de verdade, encolhida para caber na caixa. */
function Miniatura({ def, lambe, numeros }: { def: DefPeca; lambe: LambeDoDia | undefined; numeros: NumerosDoKit }) {
  const caixa = { w: 150, h: 150 };
  const escala = Math.min(caixa.w / (def.w * PX), caixa.h / (def.h * PX));
  const [primeira] = folhasDa(def.id, "cor", QR_MINIATURA, "contato@institutolucia.org", { titulo: "Aula aberta", quando: "", onde: "", contato: "" }, "Estude", numeros, lambe);
  return (
    <span aria-hidden className="kit-miniatura" style={{ height: caixa.h }}>
      <span style={{ width: def.w * PX * escala, height: def.h * PX * escala, overflow: "hidden", display: "block", boxShadow: "2px 2px 0 rgba(31,26,20,0.35)" }}>
        <span style={{ display: "block", width: `${def.w}mm`, transform: `scale(${escala})`, transformOrigin: "top left", pointerEvents: "none" }}>{primeira}</span>
      </span>
    </span>
  );
}

/** A prévia na bancada: a peça inteira, encolhida para caber na largura da tela (a impressão sai no tamanho real). */
function Previa({ def, folhas }: { def: DefPeca; folhas: ReactNode[] }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(0);
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const observador = new ResizeObserver(([entrada]) => setLargura(entrada.contentRect.width));
    observador.observe(el);
    return () => observador.disconnect();
  }, []);
  const larguraPx = def.w * PX;
  const vao = 6 * PX;
  const escala = largura ? Math.min(1, largura / larguraPx) : 1;
  const altura = (folhas.length * def.h * PX + (folhas.length - 1) * vao) * escala;
  return (
    <div ref={caixa} className="overflow-hidden" style={{ height: largura ? altura : undefined }}>
      <div className="peca-impressa" style={{ width: `${def.w}mm`, transform: `scale(${escala})`, transformOrigin: "top left", marginLeft: largura > larguraPx ? (largura - larguraPx) / 2 : 0, display: "grid", gap: `${vao}px` }}>
        {folhas.map((folha, i) => (
          <div key={i} style={{ boxShadow: "0 2px 10px rgba(31,26,20,0.25)" }}>
            {folha}
          </div>
        ))}
      </div>
    </div>
  );
}

const nunca = () => () => {};

export function KitDeDivulgacao({ qr, email, numeros, lambes }: { qr: string; email: string; numeros: NumerosDoKit; lambes: LambeDoDia[] }) {
  const [peca, setPeca] = useState<Peca>("lambe-do-dia");
  const [modo, setModo] = useState<Modo>("cor");
  const [ev, setEv] = useState<Evento>({ titulo: "Aula aberta: o que é mais-valia", quando: "", onde: "", contato: "" });
  const [frase, setFrase] = useState("Estude de graça");
  const [imprimindo, setImprimindo] = useState(false);
  // As miniaturas só no navegador: no HTML da página ficam só os nomes (as 22 peças de verdade pesariam muito).
  const montado = useSyncExternalStore(nunca, () => true, () => false);
  // O lambe de hoje: a página é estática, então o navegador escolhe pela data (sem erro de hidratação).
  const hoje = useSyncExternalStore(nunca, () => diaDe(new Date()), () => lambes[0]?.dia ?? 0);
  const [passo, setPasso] = useState(0);
  const indiceDeHoje = Math.max(0, lambes.findIndex((d) => d.dia === hoje));
  const indice = Math.min(lambes.length - 1, Math.max(0, indiceDeHoje + passo));
  const dia = lambes[indice];
  const bancada = useRef<HTMLElement>(null);
  const atual = PECAS.find((p) => p.id === peca)!;
  const folhas = folhasDa(peca, modo, qr, email, ev, frase, numeros, dia);

  // Na hora de imprimir, a peça vai para uma raiz só dela, fora da página: sai o número certo de folhas, nem uma a mais.
  useEffect(() => {
    if (!imprimindo) return;
    const raiz = document.documentElement;
    const estilo = document.createElement("style");
    estilo.textContent = `@page { size: ${atual.pagina}; margin: 0; }`;
    document.head.appendChild(estilo);
    raiz.setAttribute("data-imprimir-peca", "");
    const limpar = () => {
      raiz.removeAttribute("data-imprimir-peca");
      estilo.remove();
      setImprimindo(false);
    };
    window.addEventListener("afterprint", limpar, { once: true });
    window.print();
    return () => window.removeEventListener("afterprint", limpar);
  }, [imprimindo, atual.pagina]);

  function escolher(id: Peca) {
    setPeca(id);
    requestAnimationFrame(() => bancada.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }));
  }

  const campo = "mt-1 block w-full border-2 border-ink bg-parchment px-3 py-2 font-normal";
  return (
    <div className="mt-6">
      {/* O catálogo: as peças de verdade em miniatura, separadas pelo uso. */}
      <div className="grid gap-10">
        {GRUPOS.map((g) => (
          <section key={g.id} aria-labelledby={`kit-${g.id}`}>
            <h3 id={`kit-${g.id}`} className="font-serif text-2xl font-semibold">{g.nome}</h3>
            <p className="mt-1 font-sans text-sm text-ink-soft">{g.texto}</p>
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {PECAS.filter((p) => p.grupo === g.id).map((p) => (
                <li key={p.id} className="min-w-0">
                  <button type="button" aria-pressed={peca === p.id} onClick={() => escolher(p.id)} className="kit-ficha">
                    {montado ? <Miniatura def={p} lambe={dia} numeros={numeros} /> : <span aria-hidden className="kit-miniatura" style={{ height: 150 }} />}
                    <span className="mt-2.5 block font-sans text-sm font-bold leading-tight">
                      {p.nova && <span className="kit-nova">Nova</span>}
                      {p.nome}
                    </span>
                    <span className="mt-0.5 block font-mono text-[0.66rem] uppercase tracking-[0.06em] text-ink-soft">{p.papel}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* A bancada: a peça escolhida, a tinta, os campos, o botão de imprimir e a prévia. */}
      <section ref={bancada} aria-labelledby="kit-bancada" className="mt-12 scroll-mt-24 border-2 border-ink bg-folha p-4 shadow-[4px_4px_0_var(--sombra)] sm:p-5">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-soft">Na bancada</p>
        <h3 id="kit-bancada" className="mt-1 font-serif text-2xl font-semibold leading-tight">{atual.nome}</h3>
        <p className="mt-1 font-sans text-sm text-ink-soft">
          Papel: {atual.papel}. Tamanho real: {atual.w} × {atual.h} mm{folhas.length > 1 ? `, ${folhas.length} folhas` : ""}.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-4 font-sans">
          <fieldset>
            <legend className="text-sm font-semibold">Tinta</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {MODOS.map((m) => (
                <button key={m.id} type="button" aria-pressed={modo === m.id} onClick={() => setModo(m.id)} className={`cursor-pointer border-2 px-3 py-1.5 text-sm ${modo === m.id ? "border-ink bg-ink text-parchment" : "border-ink hover:bg-parchment"}`}>
                  {m.nome}
                </button>
              ))}
            </div>
          </fieldset>
          <button type="button" onClick={() => setImprimindo(true)} className="botao botao-prelo ml-auto">
            Imprimir esta peça
          </button>
        </div>
        {peca === "lambe-do-dia" && dia && (
          <div className="mt-4 flex flex-wrap items-center gap-3 font-sans text-sm">
            <button type="button" disabled={indice === 0} onClick={() => setPasso(passo - 1)} className="cursor-pointer border-2 border-ink px-3 py-1.5 disabled:cursor-default disabled:opacity-40">← Dia anterior</button>
            <span className="font-mono">
              {dataCurta(dia.dia)} · lambe-lambe nº {dia.numero}
            </span>
            <button type="button" disabled={indice === lambes.length - 1} onClick={() => setPasso(passo + 1)} className="cursor-pointer border-2 border-ink px-3 py-1.5 disabled:cursor-default disabled:opacity-40">Próximo dia →</button>
          </div>
        )}
        {(peca === "evento" || peca === "convite-nucleo") && (
          <div className="mt-4 grid gap-3 font-sans sm:grid-cols-2">
            {peca === "evento" && (
              <label className="text-sm font-semibold sm:col-span-2">
                Título do evento
                <input value={ev.titulo} maxLength={60} onChange={(e) => setEv({ ...ev, titulo: e.target.value })} className={campo} />
              </label>
            )}
            <label className="text-sm font-semibold">
              Quando
              <input value={ev.quando} maxLength={50} placeholder="Sábado, 8/11, às 15h" onChange={(e) => setEv({ ...ev, quando: e.target.value })} className={campo} />
            </label>
            <label className="text-sm font-semibold">
              Onde (lugar público)
              <input value={ev.onde} maxLength={60} placeholder="Biblioteca do bairro, sala 2" onChange={(e) => setEv({ ...ev, onde: e.target.value })} className={campo} />
            </label>
            <label className="text-sm font-semibold sm:col-span-2">
              Contato (deixe vazio para usar o Instagram do instituto)
              <input value={ev.contato} maxLength={50} onChange={(e) => setEv({ ...ev, contato: e.target.value })} className={campo} />
            </label>
            <p className="text-xs text-ink-soft sm:col-span-2">Não ponha endereço de casa nem telefone pessoal num cartaz de rua.</p>
          </div>
        )}
        {peca === "bandeirinhas" && (
          <label className="mt-4 block max-w-md font-sans text-sm font-semibold">
            A frase das bandeirinhas (uma letra em cada; o espaço vira estrela)
            <input value={frase} maxLength={24} onChange={(e) => setFrase(e.target.value)} className={campo} />
          </label>
        )}
        <div className="mt-5 bg-[#d8d0c0] p-3 sm:p-4">
          <Previa def={atual} folhas={folhas} />
        </div>
        {peca === "zine" && <p className="mt-4 font-sans text-sm text-ink-soft">Como dobrar o zine: dobre a folha ao meio no comprido e no largo, abra, dobre ao meio no largo e corte só o centro (entre os painéis do meio), abra e dobre de novo pelo comprido, empurre as pontas para o centro até formar o livrinho. A capa é o painel vermelho, &ldquo;O saber é do povo&rdquo;.</p>}
        {peca === "insta-adesivos" && <p className="mt-4 font-sans text-sm text-ink-soft">Imprima em papel adesivo (ou em papel comum e cole com cola bastão) e cole nos cartazes, folhetos e cartões que já foram impressos sem o Instagram. Cada tira tem 62 × 22 mm.</p>}
        {peca === "banner-mesa" && <p className="mt-4 font-sans text-sm text-ink-soft">Dobre nas duas linhas tracejadas, formando um triângulo deitado: as duas faces ficam de pé, uma para cada lado da mesa.</p>}
        {peca === "faixa" && <p className="mt-4 font-sans text-sm text-ink-soft">Para uma faixa comprida, imprima várias folhas e emende lado a lado com cola de farinha (o grude dos lambe-lambes).</p>}
        {peca === "bandeirinhas" && <p className="mt-4 font-sans text-sm text-ink-soft">Recorte cada bandeirinha, dobre a aba de cima sobre um barbante e cole. Pendure na ordem da frase.</p>}
        {peca === "calendario" && <p className="mt-4 font-sans text-sm text-ink-soft">Recorte nas linhas tracejadas: cada tira serve de marcador de livro e lembra as datas de luta do ano.</p>}
        {peca === "lambe-do-dia" && <p className="mt-4 font-sans text-sm text-ink-soft">É o mesmo cartaz que está hoje na página inicial; dá para imprimir o dos próximos dias também. Para colar na rua, use grude (cola de farinha) e não cubra o lambe de ninguém.</p>}
      </section>

      {imprimindo &&
        createPortal(
          <div className="peca-para-imprimir">
            {folhas.map((folha, i) => (
              <div key={i} className="folha-impressa">
                {folha}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
