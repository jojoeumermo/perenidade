// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";

/**
 * O kit de agitação do divulgador, no desenho dos lambe-lambes do site: cartazes A4 e A3 (três artes), faixa de muro,
 * folheto A5, zine de uma folha, panfleto de voluntariado, cartões com QR code, adesivos redondos e marcadores de página.
 * Tudo desenhado aqui, em HTML e SVG (vetor), no tamanho de verdade em milímetros, e impresso pelo próprio navegador
 * (Imprimir › Salvar como PDF). A marca é sempre a do instituto (o livro aberto com a estrela). O QR code chega pronto
 * do servidor, gerado pela biblioteca do próprio site: nada de serviço de fora.
 */
type Modo = "cor" | "tinta" | "escuro";
type Peca = "lambe" | "raios" | "estude" | "cartaz-a3" | "faixa" | "folheto" | "voluntario" | "zine" | "cartoes" | "adesivos" | "marcadores";

const PECAS: { id: Peca; nome: string; papel: string; pagina: string; w: number; h: number }[] = [
  { id: "lambe", nome: "Cartaz lambe-lambe “O saber é do povo”", papel: "A4 retrato", pagina: "A4 portrait", w: 210, h: 297 },
  { id: "raios", nome: "Cartaz de raios “Estude de graça”", papel: "A4 retrato", pagina: "A4 portrait", w: 210, h: 297 },
  { id: "estude", nome: "Cartaz caderno “Escolha o seu caderno”", papel: "A4 retrato", pagina: "A4 portrait", w: 210, h: 297 },
  { id: "cartaz-a3", nome: "Cartaz A3 (o lambe-lambe grande)", papel: "A3 retrato", pagina: "A3 portrait", w: 297, h: 420 },
  { id: "faixa", nome: "Faixa de muro", papel: "A4 paisagem (emende várias)", pagina: "A4 landscape", w: 297, h: 210 },
  { id: "folheto", nome: "Folheto A5", papel: "A5 retrato (dois por folha A4)", pagina: "A5 portrait", w: 148, h: 210 },
  { id: "voluntario", nome: "Panfleto “Vem fazer junto”", papel: "A5 retrato", pagina: "A5 portrait", w: 148, h: 210 },
  { id: "zine", nome: "Zine de uma folha", papel: "A4 paisagem, dobrado em 8", pagina: "A4 landscape", w: 297, h: 210 },
  { id: "cartoes", nome: "Cartões com QR (10 por folha)", papel: "A4 retrato, recortar", pagina: "A4 portrait", w: 210, h: 297 },
  { id: "adesivos", nome: "Adesivos redondos (12 por folha)", papel: "A4 retrato, papel adesivo", pagina: "A4 portrait", w: 210, h: 297 },
  { id: "marcadores", nome: "Marcadores de página (6 por folha)", papel: "A4 retrato, recortar", pagina: "A4 portrait", w: 210, h: 297 },
];
const MODOS: { id: Modo; nome: string }[] = [
  { id: "cor", nome: "Colorido" },
  { id: "tinta", nome: "Baixa tinta (preto e branco)" },
  { id: "escuro", nome: "Escuro" },
];
type Cores = { papel: string; texto: string; prelo: string; preto: string; claro: string; linha: string; suave: string };
const CORES: Record<Modo, Cores> = {
  cor: { papel: "#F4ECD8", texto: "#1F1A14", prelo: "#C21F16", preto: "#1F1A14", claro: "#F4ECD8", linha: "#1F1A14", suave: "#5A4E3C" },
  tinta: { papel: "#FFFFFF", texto: "#000000", prelo: "#000000", preto: "#FFFFFF", claro: "#000000", linha: "#000000", suave: "#333333" },
  escuro: { papel: "#17130E", texto: "#F4ECD8", prelo: "#E0372B", preto: "#000000", claro: "#F4ECD8", linha: "#F4ECD8", suave: "#CDBB91" },
};

const OFERTA = [
  ["Aulas", "trilhas do básico ao avançado, com exercícios"],
  ["Acervo", "obras em domínio público e de licença livre"],
  ["Ferramentas", "calculadora, gráficos, dicionário, programação"],
  ["Laboratórios", "elétrica, redes, segurança, montagem de computador"],
];
const mono = "'IBM Plex Mono', ui-monospace, monospace";
const serif = "'EB Garamond', Georgia, serif";
const grito = "Inter, system-ui, sans-serif";

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

/** O QR code em vetor, na cor do modo. */
function Qr({ svg, cor, tamanho }: { svg: string; cor: string; tamanho: string }) {
  const pintado = svg.replace(/stroke="#000000"/g, `stroke="${cor}"`).replace(/fill="#000000"/g, `fill="${cor}"`).replace(/fill="#ffffff"/gi, 'fill="none"');
  return <div style={{ width: tamanho, height: tamanho, flexShrink: 0 }} aria-label="QR code para institutolucia.org" dangerouslySetInnerHTML={{ __html: pintado }} />;
}

function Assinatura({ c, modo, qr, mm, escala = 1 }: { c: Cores; modo: Modo; qr: string; mm: (n: number) => string; escala?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: mm(6 * escala) }}>
      <div style={{ background: "#fff", padding: mm(2 * escala), border: `${mm(0.8)} solid ${c.linha}` }}>
        <Qr svg={qr} cor="#000000" tamanho={mm(34 * escala)} />
      </div>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: mm(2.5 * escala) }}>
          <Marca tamanho={mm(11 * escala)} modo={modo} />
          <span style={{ fontFamily: serif, fontSize: mm(8 * escala), fontWeight: 600 }}>Instituto Lúcia</span>
        </div>
        <p style={{ fontFamily: mono, fontSize: mm(6.2 * escala), fontWeight: 600, margin: `${mm(2 * escala)} 0 0` }}>institutolucia.org</p>
        <p style={{ fontFamily: mono, fontSize: mm(3 * escala), letterSpacing: "0.18em", textTransform: "uppercase", margin: `${mm(1 * escala)} 0 0`, color: c.suave }}>Grátis · sem anúncio · sem conta</p>
      </div>
    </div>
  );
}

/** O lambe-lambe: a faixa preta com o grito, o “povo” em vermelho num recorte claro e a oferta do instituto. */
function Lambe({ c, modo, qr, u }: { c: Cores; modo: Modo; qr: string; u: number }) {
  const mm = (n: number) => `${n * u}mm`;
  return (
    <div style={{ width: mm(210), height: mm(297), background: c.papel, color: c.texto, display: "flex", flexDirection: "column", boxSizing: "border-box", border: `${mm(1.5)} solid ${c.linha}`, fontFamily: serif, position: "relative", overflow: "hidden" }}>
      <div style={{ background: modo === "tinta" ? "#fff" : c.preto, color: modo === "tinta" ? "#000" : "#F4ECD8", padding: `${mm(14)} ${mm(14)} ${mm(12)}`, borderBottom: `${mm(1.5)} solid ${c.linha}` }}>
        <p style={{ fontFamily: mono, fontSize: mm(4.2), letterSpacing: "0.28em", margin: 0, color: modo === "tinta" ? "#000" : "#E0837A" }}>LAMBE-LAMBE Nº 1 · EDUCAÇÃO POPULAR</p>
        <p style={{ fontFamily: grito, fontWeight: 900, fontStyle: "italic", textTransform: "uppercase", letterSpacing: "-0.02em", lineHeight: 0.9, fontSize: mm(29), margin: `${mm(6)} 0 0` }}>
          O saber
          <br />é do
          <br />
          <span style={{ background: modo === "tinta" ? "#000" : "#F4ECD8", color: modo === "tinta" ? "#fff" : "#C21F16", padding: `0 ${mm(3)}` }}>povo.</span>
        </p>
      </div>
      <div style={{ padding: `${mm(10)} ${mm(14)} 0`, flex: 1 }}>
        <p style={{ fontSize: mm(7.5), lineHeight: 1.2, margin: 0 }}>Uma escola e uma biblioteca livres, feitas por voluntários. Estude no celular ou no computador, no seu tempo.</p>
        <ul style={{ listStyle: "none", padding: 0, margin: `${mm(7)} 0 0`, display: "grid", gap: mm(3) }}>
          {OFERTA.map(([t, d]) => (
            <li key={t} style={{ display: "flex", gap: mm(3), alignItems: "baseline", fontSize: mm(5.4), lineHeight: 1.2 }}>
              <Estrela cor={c.prelo} tamanho={mm(4.5)} />
              <span><strong>{t}:</strong> {d}</span>
            </li>
          ))}
        </ul>
      </div>
      <div style={{ padding: mm(14), borderTop: `${mm(1)} solid ${c.linha}` }}>
        <Assinatura c={c} modo={modo} qr={qr} mm={mm} />
      </div>
      {/* O carimbo redondo, torto. */}
      <div style={{ position: "absolute", right: mm(12), top: mm(92), width: mm(34), height: mm(34), borderRadius: "50%", border: `${mm(1)} solid ${c.prelo}`, color: c.prelo, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", fontFamily: mono, fontSize: mm(3.3), fontWeight: 600, letterSpacing: "0.12em", lineHeight: 1.45, transform: "rotate(14deg)", background: c.papel }}>
        GRÁTIS
        <br />★ LIVRE ★
        <br />PARA
        <br />SEMPRE
      </div>
    </div>
  );
}

/** O sol de raios vermelhos dos cartazes de 1918, com a estrela grande e o chamado para estudar de graça. */
function Raios({ c, modo, qr }: { c: Cores; modo: Modo; qr: string }) {
  const mm = (n: number) => `${n}mm`;
  const tinta = modo === "tinta";
  return (
    <div style={{ width: mm(210), height: mm(297), boxSizing: "border-box", border: `${mm(1.5)} solid ${c.linha}`, display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: serif, background: c.papel, color: c.texto }}>
      <div style={{ position: "relative", height: mm(190), overflow: "hidden", background: tinta ? "repeating-conic-gradient(from 0deg at 0% 100%, #000 0deg 5deg, #fff 5deg 10deg)" : "repeating-conic-gradient(from 0deg at 0% 100%, #C21F16 0deg 5deg, #A51810 5deg 10deg)", borderBottom: `${mm(1.5)} solid ${c.linha}` }}>
        <div style={{ position: "absolute", right: mm(-20), bottom: mm(-28), opacity: tinta ? 1 : 0.95 }}>
          <Estrela cor={tinta ? "#000" : "#1F1A14"} tamanho={mm(150)} />
        </div>
        <div style={{ position: "relative", padding: mm(14), color: "#fff" }}>
          <p style={{ fontFamily: mono, fontSize: mm(4.2), letterSpacing: "0.26em", margin: 0, background: tinta ? "#000" : "transparent", display: "inline-block", padding: tinta ? mm(1.5) : 0 }}>INSTITUTO LÚCIA · DE GRAÇA</p>
          <p style={{ fontFamily: grito, fontWeight: 900, fontStyle: "italic", textTransform: "uppercase", lineHeight: 0.88, letterSpacing: "-0.02em", fontSize: mm(33), margin: `${mm(8)} 0 0`, background: tinta ? "#000" : "transparent", display: "inline-block", padding: tinta ? mm(2) : 0 }}>
            Estude
            <br />
            de graça.
          </p>
          <p style={{ fontSize: mm(7.5), lineHeight: 1.2, margin: `${mm(8)} 0 0`, maxWidth: mm(118), background: tinta ? "#000" : "transparent", padding: tinta ? mm(1.5) : 0 }}>Do ENEM à alfabetização, de programação a primeiros socorros. Sem pagar, sem conta, sem anúncio.</p>
        </div>
      </div>
      <div style={{ padding: mm(14), display: "flex", flexDirection: "column", gap: mm(7), flex: 1, justifyContent: "space-between" }}>
        <p style={{ fontSize: mm(6.5), lineHeight: 1.25, margin: 0 }}>
          <strong>80 disciplinas</strong>, laboratórios, rádio, jornal e uma biblioteca inteira. Tudo feito por voluntários, para quem trabalha e estuda.
        </p>
        <Assinatura c={c} modo={modo} qr={qr} mm={mm} />
      </div>
    </div>
  );
}

/** O cartaz das estantes: os cadernos coloridos com espiral e etiqueta, como na página inicial do site. */
function Estude({ c, modo, qr }: { c: Cores; modo: Modo; qr: string }) {
  const mm = (n: number) => `${n}mm`;
  const tinta = modo === "tinta";
  const cadernos: [string, string][] = [
    ["Alfabetização", "#6E1F1A"],
    ["ENEM", "#2F5D34"],
    ["Redação", "#8A5F1C"],
    ["Matemática", "#1F1A14"],
    ["Teoria revolucionária", "#C21F16"],
    ["Lutas do povo", "#5A4E3C"],
  ];
  return (
    <div style={{ width: mm(210), height: mm(297), boxSizing: "border-box", border: `${mm(1.5)} solid ${c.linha}`, padding: mm(14), display: "flex", flexDirection: "column", fontFamily: serif, color: c.texto, backgroundColor: c.papel, backgroundImage: tinta ? "none" : `radial-gradient(circle, ${modo === "escuro" ? "#3a3020" : "#cdbb91"} 0.35mm, transparent 0.45mm)`, backgroundSize: "6mm 6mm" }}>
      <p style={{ fontFamily: mono, fontSize: mm(4), letterSpacing: "0.24em", margin: 0, color: c.prelo }}>§ AS ESTANTES</p>
      <p style={{ fontSize: mm(17), lineHeight: 1, margin: `${mm(3)} 0 0`, fontWeight: 500 }}>Escolha o seu caderno.</p>
      <div style={{ marginTop: mm(10), display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: mm(6) }}>
        {cadernos.map(([nome, cor]) => (
          <div key={nome} style={{ position: "relative", height: mm(62), background: tinta ? "#fff" : cor, border: `${mm(0.7)} solid #1F1A14`, boxShadow: tinta ? "none" : `${mm(1.6)} ${mm(1.6)} 0 #1F1A14`, padding: `${mm(4)} ${mm(3)} ${mm(4)} ${mm(8)}`, boxSizing: "border-box" }}>
            <span style={{ position: "absolute", left: mm(2.5), top: mm(5), bottom: mm(5), width: mm(2.4), backgroundImage: `radial-gradient(circle, ${tinta ? "#000" : "#F4ECD8"} 0.9mm, transparent 1mm)`, backgroundSize: `${mm(2.4)} ${mm(6)}` }} />
            <span style={{ display: "block", marginTop: mm(10), background: "#FBF6E8", color: "#1F1A14", border: `${mm(0.4)} solid #1F1A14`, padding: mm(2), fontSize: mm(5), fontWeight: 600, lineHeight: 1.05 }}>{nome}</span>
          </div>
        ))}
      </div>
      <p style={{ fontSize: mm(6.5), lineHeight: 1.25, margin: `${mm(10)} 0 0` }}>São 80 disciplinas, do ensino fundamental ao superior, e ofícios que dão renda. Comece pelo essencial ou pela etapa que você quer estudar.</p>
      <div style={{ marginTop: "auto" }}>
        <Assinatura c={c} modo={modo} qr={qr} mm={mm} />
      </div>
    </div>
  );
}

/** A faixa de muro: uma tira deitada com o grito e o endereço, para emendar várias lado a lado. */
function Faixa({ c, modo, qr }: { c: Cores; modo: Modo; qr: string }) {
  const tinta = modo === "tinta";
  return (
    <div style={{ width: "297mm", height: "210mm", boxSizing: "border-box", border: `1.5mm solid ${c.linha}`, display: "grid", gridTemplateRows: "1fr auto", background: tinta ? "#fff" : "#C21F16", color: tinta ? "#000" : "#fff", fontFamily: grito }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10mm", padding: "0 14mm" }}>
        <Estrela cor={tinta ? "#000" : "#1F1A14"} tamanho="62mm" />
        <p style={{ fontWeight: 900, fontStyle: "italic", textTransform: "uppercase", lineHeight: 0.86, letterSpacing: "-0.02em", fontSize: "34mm", margin: 0 }}>
          O saber
          <br />é do povo
        </p>
      </div>
      <div style={{ background: tinta ? "#000" : "#1F1A14", color: "#F4ECD8", padding: "6mm 14mm", display: "flex", alignItems: "center", gap: "8mm" }}>
        <div style={{ background: "#fff", padding: "1.5mm" }}>
          <Qr svg={qr} cor="#000000" tamanho="26mm" />
        </div>
        <p style={{ fontFamily: mono, fontSize: "13mm", fontWeight: 600, margin: 0 }}>institutolucia.org</p>
        <p style={{ marginLeft: "auto", fontFamily: mono, fontSize: "4mm", letterSpacing: "0.2em", textAlign: "right", margin: 0 }}>EDUCAÇÃO POPULAR
          <br />GRÁTIS · LIVRE</p>
      </div>
    </div>
  );
}

function Folheto({ c, modo, qr, email }: { c: Cores; modo: Modo; qr: string; email: string }) {
  return (
    <div style={{ width: "148mm", height: "210mm", background: c.papel, color: c.texto, boxSizing: "border-box", display: "flex", flexDirection: "column", fontFamily: serif, border: `1mm solid ${c.linha}` }}>
      <div style={{ background: modo === "tinta" ? "#fff" : c.preto, color: modo === "tinta" ? "#000" : "#F4ECD8", padding: "9mm", borderBottom: `1mm solid ${c.linha}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: "3mm" }}>
          <Marca tamanho="10mm" modo={modo} />
          <strong style={{ fontSize: "6.5mm" }}>Instituto Lúcia</strong>
        </div>
        <p style={{ fontFamily: grito, fontWeight: 900, fontStyle: "italic", textTransform: "uppercase", lineHeight: 0.92, letterSpacing: "-0.02em", fontSize: "11mm", margin: "5mm 0 0" }}>Uma escola aberta, no seu celular.</p>
      </div>
      <div style={{ padding: "8mm 9mm 0", flex: 1 }}>
        <p style={{ fontSize: "4.3mm", lineHeight: 1.35, margin: 0 }}>Educação popular mantida por voluntários, sem fins lucrativos e sem anúncios. Tudo é livre para estudar, imprimir e levar para a sala de aula.</p>
        <ul style={{ listStyle: "none", padding: 0, margin: "5mm 0", display: "grid", gap: "2mm" }}>
          {[...OFERTA, ["Sala livre", "para professores montarem e projetarem a aula"]].map(([t, d]) => (
            <li key={t} style={{ display: "flex", gap: "2mm", fontSize: "4mm", lineHeight: 1.3 }}>
              <Estrela cor={c.prelo} tamanho="3.4mm" />
              <span><strong>{t}:</strong> {d}.</span>
            </li>
          ))}
        </ul>
        <p style={{ fontSize: "4mm", lineHeight: 1.35, margin: 0 }}><strong>Como começar:</strong> abra o site, escolha uma disciplina e comece pela primeira aula. Não precisa criar conta.</p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "5mm", borderTop: `0.6mm solid ${c.linha}`, padding: "6mm 9mm" }}>
        <div style={{ background: "#fff", padding: "1mm" }}>
          <Qr svg={qr} cor="#000000" tamanho="27mm" />
        </div>
        <div>
          <p style={{ fontFamily: mono, fontSize: "5.2mm", fontWeight: 600, margin: 0 }}>institutolucia.org</p>
          <p style={{ fontSize: "3.6mm", margin: "1mm 0 0" }}>Contato: {email}</p>
          <p style={{ fontSize: "3.3mm", margin: "1mm 0 0", color: c.prelo }}>Quer ajudar? institutolucia.org/pt/voluntarios</p>
        </div>
      </div>
    </div>
  );
}

/** O panfleto do voluntariado: quem sabe alguma coisa vem ensinar. */
function Voluntario({ c, modo, qr }: { c: Cores; modo: Modo; qr: string }) {
  const funcoes = ["Ensinar uma disciplina", "Revisar aulas", "Traduzir", "Gravar áudio e podcast", "Desenhar cartazes", "Cuidar da comunidade"];
  const tinta = modo === "tinta";
  return (
    <div style={{ width: "148mm", height: "210mm", boxSizing: "border-box", border: `1mm solid ${c.linha}`, background: tinta ? "#fff" : "#C21F16", color: tinta ? "#000" : "#fff", fontFamily: serif, display: "flex", flexDirection: "column", padding: "10mm" }}>
      <p style={{ fontFamily: mono, fontSize: "3.6mm", letterSpacing: "0.24em", margin: 0 }}>★ O INSTITUTO LÚCIA CHAMA</p>
      <p style={{ fontFamily: grito, fontWeight: 900, fontStyle: "italic", textTransform: "uppercase", lineHeight: 0.9, letterSpacing: "-0.02em", fontSize: "17mm", margin: "5mm 0 0" }}>
        Vem fazer
        <br />
        <span style={{ background: tinta ? "#000" : "#1F1A14", color: "#F4ECD8", padding: "0 2mm" }}>junto.</span>
      </p>
      <p style={{ fontSize: "4.6mm", lineHeight: 1.3, margin: "6mm 0 0" }}>Sabe explicar alguma coisa? Escreve bem, desenha, grava, traduz? O instituto é feito por quem usa, no tempo de cada um, sem chefe e sem horário.</p>
      <ul style={{ listStyle: "none", padding: 0, margin: "5mm 0 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2mm 4mm" }}>
        {funcoes.map((f) => (
          <li key={f} style={{ display: "flex", gap: "1.8mm", fontSize: "3.9mm", lineHeight: 1.25 }}>
            <Estrela cor={tinta ? "#000" : "#F4ECD8"} tamanho="3.2mm" />
            {f}
          </li>
        ))}
      </ul>
      <div style={{ marginTop: "auto", background: tinta ? "#fff" : "#F4ECD8", color: "#1F1A14", border: "0.8mm solid #1F1A14", padding: "4mm", display: "flex", alignItems: "center", gap: "4mm" }}>
        <Qr svg={qr} cor="#000000" tamanho="24mm" />
        <div>
          <p style={{ fontFamily: mono, fontSize: "3.2mm", letterSpacing: "0.16em", margin: 0 }}>CANDIDATURA, SEM CONTA</p>
          <p style={{ fontFamily: mono, fontSize: "4.4mm", fontWeight: 600, margin: "1.5mm 0 0" }}>institutolucia.org/pt/voluntarios</p>
          <div style={{ display: "flex", alignItems: "center", gap: "2mm", marginTop: "2mm" }}>
            <Marca tamanho="7mm" modo={modo} />
            <span style={{ fontSize: "4mm", fontWeight: 600 }}>Instituto Lúcia</span>
          </div>
        </div>
      </div>
    </div>
  );
}

type PainelDeZine = { titulo: string; texto: string; qr?: boolean; capa?: boolean };

function PainelDoZine({ p, c, modo, qr, invertido }: { p: PainelDeZine; c: Cores; modo: Modo; qr: string; invertido?: boolean }) {
  const escuro = p.capa && modo !== "tinta";
  return (
    <div style={{ width: "74.25mm", height: "105mm", boxSizing: "border-box", padding: "6mm", border: `0.3mm dashed ${c.linha}`, transform: invertido ? "rotate(180deg)" : undefined, display: "flex", flexDirection: "column", gap: "3mm", background: escuro ? "#1F1A14" : undefined, color: escuro ? "#F4ECD8" : undefined }}>
      {p.capa && <Marca tamanho="14mm" modo={modo} />}
      <strong style={{ fontFamily: p.capa ? grito : serif, fontStyle: p.capa ? "italic" : undefined, fontWeight: p.capa ? 900 : 700, textTransform: p.capa ? "uppercase" : undefined, fontSize: p.capa ? "9mm" : "6.5mm", lineHeight: 1, color: p.capa ? undefined : c.prelo }}>{p.titulo}</strong>
      <p style={{ fontSize: "4mm", lineHeight: 1.3, margin: 0 }}>{p.texto}</p>
      {p.qr && (
        <div style={{ marginTop: "auto", background: "#fff", padding: "1mm", alignSelf: "flex-start" }}>
          <Qr svg={qr} cor="#000000" tamanho="34mm" />
        </div>
      )}
    </div>
  );
}

/** Zine de uma folha: A4 deitado, 8 painéis; a fileira de cima de cabeça para baixo (dobra e corte no meio). */
function Zine({ c, modo, qr, email }: { c: Cores; modo: Modo; qr: string; email: string }) {
  const paineis: PainelDeZine[] = [
    { titulo: "O saber é do povo", texto: "Instituto Lúcia: um guia de bolso.", capa: true },
    { titulo: "O que é", texto: "Escola e biblioteca digital, livre e gratuita, feita por voluntários. Sem anúncios e sem conta obrigatória." },
    { titulo: "Aulas", texto: "Trilhas do básico ao avançado: matemática, línguas, história, ciências, ofícios e muito mais, com exercícios." },
    { titulo: "Acervo", texto: "Obras em domínio público e de licença livre, com a fonte de cada uma." },
    { titulo: "Ferramentas", texto: "Calculadora, gráficos, dicionário, programação, música: tudo no navegador." },
    { titulo: "Laboratórios", texto: "Elétrica, redes, segurança digital e montagem de computador, sem risco." },
    { titulo: "Vem fazer junto", texto: "Revise uma aula, traduza, grave áudio, desenhe. Veja: institutolucia.org/pt/voluntarios" },
    { titulo: "Acesse", texto: `institutolucia.org · ${email}`, qr: true },
  ];
  // A dobra clássica do zine de 8 páginas: na fileira de cima, de cabeça para baixo, as páginas 6, 5, 4 e 3; embaixo,
  // 7, 8 (contracapa), 1 (capa) e 2. Dobrada e cortada, a leitura sai na ordem certa.
  const cima = [paineis[5], paineis[4], paineis[3], paineis[2]];
  const baixo = [paineis[6], paineis[7], paineis[0], paineis[1]];
  return (
    <div style={{ width: "297mm", height: "210mm", background: c.papel, color: c.texto, fontFamily: serif, display: "grid", gridTemplateColumns: "repeat(4, 74.25mm)", gridTemplateRows: "105mm 105mm" }}>
      {cima.map((p) => <PainelDoZine key={p.titulo} p={p} c={c} modo={modo} qr={qr} invertido />)}
      {baixo.map((p) => <PainelDoZine key={p.titulo} p={p} c={c} modo={modo} qr={qr} />)}
    </div>
  );
}

function Cartoes({ c, modo, qr }: { c: Cores; modo: Modo; qr: string }) {
  return (
    <div style={{ width: "210mm", height: "297mm", background: "#fff", display: "grid", gridTemplateColumns: "85mm 85mm", gridAutoRows: "55mm", justifyContent: "center", alignContent: "center" }}>
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} style={{ background: c.papel, color: c.texto, border: `0.3mm dashed ${c.linha}`, boxSizing: "border-box", padding: "4mm", display: "flex", alignItems: "center", gap: "4mm", fontFamily: serif }}>
          <div style={{ background: "#fff", padding: "1mm" }}>
            <Qr svg={qr} cor="#000000" tamanho="33mm" />
          </div>
          <div>
            <Marca tamanho="9mm" modo={modo} />
            <p style={{ fontSize: "5mm", fontWeight: 700, margin: "1mm 0", lineHeight: 1.05 }}>Instituto Lúcia</p>
            <p style={{ fontFamily: grito, fontWeight: 900, fontStyle: "italic", textTransform: "uppercase", fontSize: "3.6mm", margin: 0, color: c.prelo }}>O saber é do povo</p>
            <p style={{ fontFamily: mono, fontSize: "3mm", margin: "2mm 0 0" }}>institutolucia.org</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Adesivos redondos: a estrela grande, o grito em volta e o endereço. 12 por folha de papel adesivo. */
function Adesivos({ c, modo }: { c: Cores; modo: Modo }) {
  const tinta = modo === "tinta";
  return (
    <div style={{ width: "210mm", height: "297mm", background: "#fff", display: "grid", gridTemplateColumns: "repeat(3, 60mm)", gridAutoRows: "62mm", gap: "4mm 6mm", justifyContent: "center", alignContent: "center" }}>
      {Array.from({ length: 12 }, (_, i) => {
        const vermelho = i % 2 === 0 && !tinta;
        return (
          <div key={i} style={{ width: "60mm", height: "60mm", borderRadius: "50%", border: `0.8mm solid ${c.linha}`, background: vermelho ? "#C21F16" : tinta ? "#fff" : c.preto, color: tinta ? "#000" : "#F4ECD8", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", fontFamily: grito, boxSizing: "border-box" }}>
            <Estrela cor={vermelho ? "#1F1A14" : tinta ? "#000" : "#C21F16"} tamanho="16mm" />
            <p style={{ fontWeight: 900, fontStyle: "italic", textTransform: "uppercase", lineHeight: 0.9, fontSize: "7.5mm", margin: "2mm 0 0" }}>O saber
              <br />é do povo</p>
            <p style={{ fontFamily: mono, fontSize: "2.8mm", margin: "2mm 0 0", letterSpacing: "0.04em" }}>institutolucia.org</p>
          </div>
        );
      })}
    </div>
  );
}

/** Marcadores de página: a marca no alto, uma frase de estudo e o QR embaixo. 6 por folha. */
function Marcadores({ c, modo, qr }: { c: Cores; modo: Modo; qr: string }) {
  const frases = ["Estudar é um direito.", "Quem sabe ensina, quem não sabe aprende.", "O saber é do povo.", "Todo o conhecimento, para todos, para sempre.", "Leia, anote, passe adiante.", "A biblioteca é de todo mundo."];
  return (
    <div style={{ width: "210mm", height: "297mm", background: "#fff", display: "grid", gridTemplateColumns: "repeat(6, 32mm)", gap: "2mm", justifyContent: "center", alignContent: "center" }}>
      {frases.map((frase, i) => (
        <div key={frase} style={{ height: "270mm", boxSizing: "border-box", border: `0.3mm dashed ${c.linha}`, background: i % 2 ? c.papel : modo === "tinta" ? "#fff" : c.preto, color: i % 2 ? c.texto : modo === "tinta" ? "#000" : "#F4ECD8", padding: "5mm 3mm", display: "flex", flexDirection: "column", alignItems: "center", fontFamily: serif, textAlign: "center" }}>
          <Marca tamanho="16mm" modo={modo} />
          <p style={{ fontSize: "4mm", fontWeight: 600, margin: "2mm 0 0" }}>Instituto Lúcia</p>
          <Estrela cor={c.prelo} tamanho="6mm" />
          <p style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontFamily: grito, fontWeight: 900, fontStyle: "italic", textTransform: "uppercase", fontSize: "8mm", lineHeight: 1, margin: "6mm 0", flex: 1 }}>{frase}</p>
          <div style={{ background: "#fff", padding: "1mm" }}>
            <Qr svg={qr} cor="#000000" tamanho="22mm" />
          </div>
          <p style={{ fontFamily: mono, fontSize: "2.4mm", margin: "2mm 0 0" }}>institutolucia.org</p>
        </div>
      ))}
    </div>
  );
}

export function KitDeDivulgacao({ qr, email }: { qr: string; email: string }) {
  const [peca, setPeca] = useState<Peca>("lambe");
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
    <div className="mt-6">
      {/* As peças em fichas: clique para ver a prévia; embaixo, a tinta e o botão de imprimir. */}
      <div className="grid gap-2 font-sans sm:grid-cols-2 lg:grid-cols-3">
        {PECAS.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={peca === p.id}
            onClick={() => setPeca(p.id)}
            className={`flex cursor-pointer flex-col items-start border-2 px-3 py-2 text-left ${peca === p.id ? "border-ink bg-ink text-parchment shadow-[3px_3px_0_var(--prelo)]" : "border-ink bg-folha hover:shadow-[3px_3px_0_var(--sombra)]"}`}
          >
            <span className="text-sm font-bold leading-tight">{p.nome}</span>
            <span className={`mt-0.5 font-mono text-[0.68rem] uppercase tracking-[0.08em] ${peca === p.id ? "text-[#cdbb91]" : "text-ink-soft"}`}>{p.papel}</span>
          </button>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-end gap-4 border-2 border-ink bg-folha p-4 font-sans shadow-[4px_4px_0_var(--sombra)]">
        <fieldset>
          <legend className="text-sm font-semibold">Tinta</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {MODOS.map((m) => (
              <button key={m.id} type="button" aria-pressed={modo === m.id} onClick={() => setModo(m.id)} className={`cursor-pointer border-2 px-3 py-1.5 text-sm ${modo === m.id ? "border-ink bg-ink text-parchment" : "border-ink hover:bg-parchment"}`}>{m.nome}</button>
            ))}
          </div>
        </fieldset>
        <button type="button" onClick={imprimir} className="botao botao-prelo ml-auto">Imprimir esta peça</button>
        <p className="w-full text-sm text-ink-soft">Papel: {atual.papel}. Tamanho real: {atual.w} × {atual.h} mm.</p>
      </div>
      {/* A prévia encolhe para caber na tela; a impressão sai no tamanho real. */}
      <div className="mt-6 overflow-x-auto border-2 border-ink bg-[#d8d0c0] p-4">
        <div className="peca-impressa mx-auto" style={{ width: `${atual.w}mm` }}>
          {peca === "lambe" && <Lambe c={c} modo={modo} qr={qr} u={1} />}
          {peca === "raios" && <Raios c={c} modo={modo} qr={qr} />}
          {peca === "estude" && <Estude c={c} modo={modo} qr={qr} />}
          {peca === "cartaz-a3" && <Lambe c={c} modo={modo} qr={qr} u={297 / 210} />}
          {peca === "faixa" && <Faixa c={c} modo={modo} qr={qr} />}
          {peca === "folheto" && <Folheto c={c} modo={modo} qr={qr} email={email} />}
          {peca === "voluntario" && <Voluntario c={c} modo={modo} qr={qr} />}
          {peca === "zine" && <Zine c={c} modo={modo} qr={qr} email={email} />}
          {peca === "cartoes" && <Cartoes c={c} modo={modo} qr={qr} />}
          {peca === "adesivos" && <Adesivos c={c} modo={modo} />}
          {peca === "marcadores" && <Marcadores c={c} modo={modo} qr={qr} />}
        </div>
      </div>
      {peca === "zine" && (
        <p className="mt-4 font-sans text-sm text-ink-soft">Como dobrar o zine: dobre a folha ao meio no comprido e no largo, abra, dobre ao meio no largo e corte só o centro (entre os painéis do meio), abra e dobre de novo pelo comprido, empurre as pontas para o centro até formar o livrinho. A capa é o painel &ldquo;O saber é do povo&rdquo;.</p>
      )}
      {peca === "faixa" && <p className="mt-4 font-sans text-sm text-ink-soft">Para uma faixa comprida, imprima várias folhas e emende lado a lado com cola de farinha (o grude dos lambe-lambes).</p>}
    </div>
  );
}
