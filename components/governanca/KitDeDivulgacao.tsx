// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";

/**
 * O kit do divulgador: cartaz A4 e A3, folheto A5, zine de uma folha e cartões com QR code. Tudo desenhado aqui, em
 * HTML e SVG (vetor), no tamanho de verdade em milímetros, e impresso pelo próprio navegador (Imprimir › Salvar como
 * PDF). O QR code chega pronto do servidor, gerado pela biblioteca do próprio site: nada de serviço de fora.
 */
type Modo = "cor" | "tinta" | "escuro";
type Peca = "cartaz-a4" | "cartaz-a3" | "folheto" | "zine" | "cartoes";

const PECAS: { id: Peca; nome: string; papel: string; pagina: string; w: number; h: number }[] = [
  { id: "cartaz-a4", nome: "Cartaz A4", papel: "A4 retrato", pagina: "A4 portrait", w: 210, h: 297 },
  { id: "cartaz-a3", nome: "Cartaz A3", papel: "A3 retrato", pagina: "A3 portrait", w: 297, h: 420 },
  { id: "folheto", nome: "Folheto A5", papel: "A5 retrato (dois por folha A4)", pagina: "A5 portrait", w: 148, h: 210 },
  { id: "zine", nome: "Zine de uma folha", papel: "A4 paisagem, dobrado em 8", pagina: "A4 landscape", w: 297, h: 210 },
  { id: "cartoes", nome: "Cartões com QR (10 por folha)", papel: "A4 retrato, recortar", pagina: "A4 portrait", w: 210, h: 297 },
];
const MODOS: { id: Modo; nome: string }[] = [
  { id: "cor", nome: "Colorido" },
  { id: "tinta", nome: "Baixa tinta (preto e branco)" },
  { id: "escuro", nome: "Escuro" },
];
const CORES: Record<Modo, { fundo: string; texto: string; destaque: string; faixa: string; faixaTexto: string; linha: string }> = {
  cor: { fundo: "#F4EBDB", texto: "#221C17", destaque: "#7A1F1F", faixa: "#7A1F1F", faixaTexto: "#F4EBDB", linha: "#221C17" },
  tinta: { fundo: "#FFFFFF", texto: "#000000", destaque: "#000000", faixa: "#FFFFFF", faixaTexto: "#000000", linha: "#000000" },
  escuro: { fundo: "#17130E", texto: "#F4EBDB", destaque: "#E8B4A0", faixa: "#7A1F1F", faixaTexto: "#F4EBDB", linha: "#F4EBDB" },
};

const OFERTA = [
  ["Aulas", "trilhas de estudo do básico ao avançado, com exercícios"],
  ["Biblioteca", "obras em domínio público e de licença livre para ler"],
  ["Ferramentas", "calculadora, gráficos, dicionário, programação e mais"],
  ["Laboratórios", "elétrica, redes, segurança, montagem de computador"],
];

function Estrela({ cor, tamanho }: { cor: string; tamanho: string }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: tamanho, height: tamanho }} aria-hidden>
      <path d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.7 7.3L12 17.8 5.7 21.5l1.7-7.3L2 9.5l7.1-.6z" fill={cor} />
    </svg>
  );
}

/** O QR code em vetor, na cor do modo. */
function Qr({ svg, cor, tamanho }: { svg: string; cor: string; tamanho: string }) {
  const pintado = svg.replace(/stroke="#000000"/g, `stroke="${cor}"`).replace(/fill="#000000"/g, `fill="${cor}"`).replace(/fill="#ffffff"/gi, 'fill="none"');
  return <div style={{ width: tamanho, height: tamanho }} aria-label="QR code para institutolucia.org" dangerouslySetInnerHTML={{ __html: pintado }} />;
}

function Cartaz({ c, qr, u, email }: { c: (typeof CORES)[Modo]; qr: string; u: number; email: string }) {
  const mm = (n: number) => `${n * u}mm`;
  return (
    <div style={{ width: mm(210), height: mm(297), background: c.fundo, color: c.texto, display: "flex", flexDirection: "column", fontFamily: "'EB Garamond', Georgia, serif", border: `${mm(1)} solid ${c.linha}` }}>
      <div style={{ background: c.faixa, color: c.faixaTexto, padding: `${mm(8)} ${mm(12)}`, display: "flex", alignItems: "center", gap: mm(4), borderBottom: `${mm(1)} solid ${c.linha}` }}>
        <Estrela cor={c.faixaTexto} tamanho={mm(12)} />
        <span style={{ fontSize: mm(11), fontWeight: 600 }}>Instituto Lúcia</span>
      </div>
      <div style={{ padding: `${mm(12)} ${mm(12)} 0`, flex: 1 }}>
        <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: mm(4), letterSpacing: "0.2em", textTransform: "uppercase", color: c.destaque, margin: 0 }}>Escola e biblioteca livre · grátis · sem anúncios</p>
        <h1 style={{ fontSize: mm(24), lineHeight: 1, margin: `${mm(4)} 0`, fontWeight: 700 }}>Conhecimento é do povo.</h1>
        <p style={{ fontSize: mm(7), lineHeight: 1.25, margin: 0 }}>Estude o que quiser, no seu tempo, no celular ou no computador. Sem pagar nada e sem precisar de conta.</p>
        <ul style={{ listStyle: "none", padding: 0, margin: `${mm(8)} 0 0`, display: "grid", gap: mm(3) }}>
          {OFERTA.map(([t, d]) => (
            <li key={t} style={{ fontSize: mm(6), lineHeight: 1.2, borderLeft: `${mm(2)} solid ${c.destaque}`, paddingLeft: mm(3) }}><strong>{t}:</strong> {d}</li>
          ))}
        </ul>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: mm(8), padding: mm(12), borderTop: `${mm(1)} solid ${c.linha}` }}>
        <Qr svg={qr} cor={c.texto} tamanho={mm(48)} />
        <div>
          <p style={{ fontSize: mm(5), margin: 0 }}>Aponte a câmera ou acesse</p>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: mm(9), fontWeight: 600, margin: `${mm(1)} 0` }}>institutolucia.org</p>
          <p style={{ fontSize: mm(4.5), margin: 0 }}>{email}</p>
        </div>
      </div>
    </div>
  );
}

function Folheto({ c, qr, email }: { c: (typeof CORES)[Modo]; qr: string; email: string }) {
  return (
    <div style={{ width: "148mm", height: "210mm", background: c.fundo, color: c.texto, padding: "10mm", boxSizing: "border-box", display: "flex", flexDirection: "column", fontFamily: "'EB Garamond', Georgia, serif", border: `0.6mm solid ${c.linha}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: "3mm" }}><Estrela cor={c.destaque} tamanho="8mm" /><strong style={{ fontSize: "7mm" }}>Instituto Lúcia</strong></div>
      <h1 style={{ fontSize: "11mm", lineHeight: 1.02, margin: "5mm 0 3mm" }}>Uma escola aberta, de graça, no seu celular.</h1>
      <p style={{ fontSize: "4.2mm", lineHeight: 1.35, margin: 0 }}>O Instituto Lúcia é um projeto de educação popular mantido por voluntários, sem fins lucrativos e sem anúncios. Tudo o que está lá é livre para estudar, imprimir e levar para a sala de aula.</p>
      <ul style={{ fontSize: "4mm", lineHeight: 1.35, paddingLeft: "5mm", margin: "4mm 0" }}>
        {OFERTA.map(([t, d]) => <li key={t}><strong>{t}:</strong> {d}.</li>)}
        <li><strong>Sala livre:</strong> para professores montarem e projetarem a própria aula.</li>
      </ul>
      <p style={{ fontSize: "4mm", lineHeight: 1.35, margin: 0 }}><strong>Como começar:</strong> abra o site, escolha uma disciplina e comece pela primeira aula. Não precisa criar conta.</p>
      <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: "5mm", borderTop: `0.5mm solid ${c.linha}`, paddingTop: "4mm" }}>
        <Qr svg={qr} cor={c.texto} tamanho="30mm" />
        <div>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "5.5mm", fontWeight: 600, margin: 0 }}>institutolucia.org</p>
          <p style={{ fontSize: "3.6mm", margin: "1mm 0 0" }}>Contato: {email}</p>
          <p style={{ fontSize: "3.2mm", margin: "1mm 0 0", color: c.destaque }}>Quer ajudar? institutolucia.org/pt/voluntarie-se</p>
        </div>
      </div>
    </div>
  );
}

type PainelDeZine = { titulo: string; texto: string; qr?: boolean };

function PainelDoZine({ p, c, qr, invertido }: { p: PainelDeZine; c: (typeof CORES)[Modo]; qr: string; invertido?: boolean }) {
  return (
    <div style={{ width: "74.25mm", height: "105mm", boxSizing: "border-box", padding: "6mm", border: `0.3mm dashed ${c.linha}`, transform: invertido ? "rotate(180deg)" : undefined, display: "flex", flexDirection: "column", gap: "3mm" }}>
      <strong style={{ fontSize: "6.5mm", lineHeight: 1.05, color: c.destaque }}>{p.titulo}</strong>
      <p style={{ fontSize: "4mm", lineHeight: 1.3, margin: 0 }}>{p.texto}</p>
      {p.qr && <div style={{ marginTop: "auto" }}><Qr svg={qr} cor={c.texto} tamanho="34mm" /></div>}
    </div>
  );
}

/** Zine de uma folha: A4 deitado, 8 painéis; a fileira de cima de cabeça para baixo (dobra e corte no meio). */
function Zine({ c, qr, email }: { c: (typeof CORES)[Modo]; qr: string; email: string }) {
  const paineis: PainelDeZine[] = [
    { titulo: "Instituto Lúcia", texto: "Conhecimento é do povo. Um guia de bolso." },
    { titulo: "O que é", texto: "Escola e biblioteca digital, livre e gratuita, feita por voluntários. Sem anúncios e sem conta obrigatória." },
    { titulo: "Aulas", texto: "Trilhas do básico ao avançado: matemática, línguas, história, ciências, ofícios e muito mais, com exercícios." },
    { titulo: "Biblioteca", texto: "Obras em domínio público e de licença livre, com a fonte de cada uma." },
    { titulo: "Ferramentas", texto: "Calculadora, gráficos, dicionário, programação, música: tudo no navegador." },
    { titulo: "Laboratórios", texto: "Elétrica, redes, segurança digital e montagem de computador, sem risco." },
    { titulo: "Ajude", texto: "Revise uma aula, traduza, grave áudio, desenhe. Veja: institutolucia.org/pt/voluntarie-se" },
    { titulo: "Acesse", texto: `institutolucia.org · ${email}`, qr: true },
  ];
  // A dobra clássica do zine de 8 páginas: na fileira de cima, de cabeça para baixo, as páginas 6, 5, 4 e 3; embaixo,
  // 7, 8 (contracapa), 1 (capa) e 2. Dobrada e cortada, a leitura sai na ordem certa.
  const cima = [paineis[5], paineis[4], paineis[3], paineis[2]];
  const baixo = [paineis[6], paineis[7], paineis[0], paineis[1]];
  return (
    <div style={{ width: "297mm", height: "210mm", background: c.fundo, color: c.texto, fontFamily: "'EB Garamond', Georgia, serif", display: "grid", gridTemplateColumns: "repeat(4, 74.25mm)", gridTemplateRows: "105mm 105mm" }}>
      {cima.map((p) => <PainelDoZine key={p.titulo} p={p} c={c} qr={qr} invertido />)}
      {baixo.map((p) => <PainelDoZine key={p.titulo} p={p} c={c} qr={qr} />)}
    </div>
  );
}

function Cartoes({ c, qr }: { c: (typeof CORES)[Modo]; qr: string }) {
  return (
    <div style={{ width: "210mm", height: "297mm", background: "#fff", display: "grid", gridTemplateColumns: "85mm 85mm", gridAutoRows: "55mm", gap: "0", justifyContent: "center", alignContent: "center" }}>
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} style={{ background: c.fundo, color: c.texto, border: `0.3mm dashed ${c.linha}`, boxSizing: "border-box", padding: "5mm", display: "flex", alignItems: "center", gap: "4mm", fontFamily: "'EB Garamond', Georgia, serif" }}>
          <Qr svg={qr} cor={c.texto} tamanho="36mm" />
          <div>
            <Estrela cor={c.destaque} tamanho="6mm" />
            <p style={{ fontSize: "5mm", fontWeight: 700, margin: "1mm 0", lineHeight: 1.05 }}>Instituto Lúcia</p>
            <p style={{ fontSize: "3.2mm", margin: 0, lineHeight: 1.2 }}>Escola e biblioteca livre e gratuita</p>
            <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "3mm", margin: "2mm 0 0" }}>institutolucia.org</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function KitDeDivulgacao({ qr, email }: { qr: string; email: string }) {
  const [peca, setPeca] = useState<Peca>("cartaz-a4");
  const [modo, setModo] = useState<Modo>("cor");
  const atual = PECAS.find((p) => p.id === peca)!;
  const c = CORES[modo];

  function imprimir() {
    const raiz = document.documentElement;
    const estilo = document.createElement("style");
    estilo.textContent = `@page { size: ${atual.pagina}; margin: 0; }`;
    document.head.appendChild(estilo);
    raiz.setAttribute("data-imprimir-peca", "");
    const limpar = () => {
      raiz.removeAttribute("data-imprimir-peca");
      estilo.remove();
      window.removeEventListener("afterprint", limpar);
    };
    window.addEventListener("afterprint", limpar);
    window.print();
  }

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-end gap-4 border-[3px] border-ink bg-parchment-deep p-4 font-sans">
        <label className="block">
          <span className="block text-sm font-semibold">Peça</span>
          <select value={peca} onChange={(e) => setPeca(e.target.value as Peca)} className="mt-1 border-2 border-ink bg-parchment px-2 py-1.5">
            {PECAS.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </label>
        <fieldset>
          <legend className="text-sm font-semibold">Tinta</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {MODOS.map((m) => (
              <button key={m.id} type="button" aria-pressed={modo === m.id} onClick={() => setModo(m.id)} className={`cursor-pointer border-2 px-3 py-1.5 ${modo === m.id ? "border-ink bg-ink text-parchment" : "border-ink/40 hover:border-ink"}`}>{m.nome}</button>
            ))}
          </div>
        </fieldset>
        <button type="button" onClick={imprimir} className="ml-auto cursor-pointer border-2 border-ink bg-[#c21f16] px-5 py-2.5 font-semibold text-white hover:bg-oxblood">Imprimir esta peça</button>
        <p className="w-full text-sm text-ink-soft">Papel: {atual.papel}. Tamanho real: {atual.w} × {atual.h} mm.</p>
      </div>
      {/* A prévia encolhe para caber na tela; a impressão sai no tamanho real. */}
      <div className="mt-6 overflow-x-auto border border-rule bg-[#d8d0c0] p-4">
        <div className="peca-impressa mx-auto" style={{ width: `${atual.w}mm` }}>
          {peca === "cartaz-a4" && <Cartaz c={c} qr={qr} u={1} email={email} />}
          {peca === "cartaz-a3" && <Cartaz c={c} qr={qr} u={297 / 210} email={email} />}
          {peca === "folheto" && <Folheto c={c} qr={qr} email={email} />}
          {peca === "zine" && <Zine c={c} qr={qr} email={email} />}
          {peca === "cartoes" && <Cartoes c={c} qr={qr} />}
        </div>
      </div>
      {peca === "zine" && (
        <p className="mt-4 font-sans text-sm text-ink-soft">Como dobrar o zine: dobre a folha ao meio no comprido e no largo, abra, dobre ao meio no largo e corte só o centro (entre os painéis do meio), abra e dobre de novo pelo comprido, empurre as pontas para o centro até formar o livrinho. A capa é o painel &ldquo;Instituto Lúcia&rdquo;.</p>
      )}
    </div>
  );
}
