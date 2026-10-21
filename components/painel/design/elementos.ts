// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).

// Os elementos do estúdio que não são texto, forma simples nem foto: os desenhos livres (foice e martelo, punho,
// mapa do Brasil), os ícones de traço, o QR, o ornamento, o carimbo, o selo, a fita adesiva, os louros, os raios em
// traço, a pincelada, a seta desenhada à mão e a guia de figurinha do story. Cada um se desenha na caixa da camada
// (0, 0, w, h), já com a rotação e a opacidade aplicadas por quem chama.

import QRCode from "qrcode";
import { BRASIL, ESTADOS, FOICE_E_MARTELO, PUNHO, PUNHO_CARTAZ } from "./desenhos";
import { ICONES, type NomeDoIcone } from "./icones";

export type Desenho =
  | "foice-martelo"
  | "punho"
  | "punho-cartaz"
  | "brasil"
  | "brasil-estados"
  | "icone"
  | "qr"
  | "ornamento"
  | "carimbo"
  | "selo"
  | "fita"
  | "louros"
  | "raios-traco"
  | "pincelada"
  | "seta-mao"
  | "figurinha";

export interface DadosDoElemento {
  desenho: Desenho;
  cor: string;
  /** Segunda cor (fundo do QR, miolo do selo); vazio: transparente. */
  fundo: string;
  /** Espessura do traço (ícones, raios, ornamento), em pontos da arte. */
  espessura: number;
  /** O texto do QR, do carimbo (em cima) e do selo; no mapa dos estados, as siglas em destaque (SP, RJ…). */
  conteudo: string;
  /** O texto de baixo do carimbo. */
  conteudo2: string;
  icone?: NomeDoIcone;
  /** Raios, folhas dos louros. */
  quantidade?: number;
}

/** Desenhos de caminho (vetores livres), com a caixa original e o deslocamento. */
export const VETORES = {
  "foice-martelo": { ...FOICE_E_MARTELO, caminhos: FOICE_E_MARTELO.caminhos },
  punho: { ...PUNHO, desloca: [0, 0] as const },
  "punho-cartaz": { ...PUNHO_CARTAZ, desloca: [0, 0] as const },
  brasil: { ...BRASIL, desloca: [500, 500] as const },
};

const caminhosProntos = new Map<string, Path2D[]>();
function caminhos(chave: string, lista: readonly string[]): Path2D[] {
  let p = caminhosProntos.get(chave);
  if (!p) {
    p = lista.map((d) => new Path2D(d));
    caminhosProntos.set(chave, p);
  }
  return p;
}

/** O QR como matriz de módulos (guardado por conteúdo; o desenho a cada quadro fica leve). */
const qrs = new Map<string, { tamanho: number; cheio: (l: number, c: number) => boolean } | null>();
export function matrizQr(conteudo: string) {
  if (!qrs.has(conteudo)) {
    try {
      const qr = QRCode.create(conteudo || " ", { errorCorrectionLevel: "M" });
      const { size, data } = qr.modules;
      qrs.set(conteudo, { tamanho: size, cheio: (l, c) => Boolean(data[l * size + c]) });
    } catch {
      qrs.set(conteudo, null);
    }
  }
  return qrs.get(conteudo) ?? null;
}

function textoEmCirculo(ctx: CanvasRenderingContext2D, texto: string, cx: number, cy: number, raio: number, centro: number, embaixo: boolean) {
  // As letras correm pela borda: em cima, da esquerda para a direita por fora; embaixo, também legíveis (de pé).
  const larguras = [...texto].map((ch) => ctx.measureText(ch).width);
  const total = larguras.reduce((a, b) => a + b, 0);
  let angulo = centro - ((embaixo ? -1 : 1) * total) / raio / 2;
  [...texto].forEach((ch, i) => {
    const meio = angulo + ((embaixo ? -1 : 1) * larguras[i]) / raio / 2;
    ctx.save();
    ctx.translate(cx + raio * Math.cos(meio), cy + raio * Math.sin(meio));
    ctx.rotate(meio + (embaixo ? -Math.PI / 2 : Math.PI / 2));
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    angulo += ((embaixo ? -1 : 1) * larguras[i]) / raio;
  });
}

function estrelaPath(cx: number, cy: number, raio: number, pontas = 5, miolo = 0.382) {
  const p = new Path2D();
  for (let i = 0; i < pontas * 2; i++) {
    const r = i % 2 === 0 ? raio : raio * miolo;
    const a = -Math.PI / 2 + (i * Math.PI) / pontas;
    if (i === 0) p.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
    else p.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  p.closePath();
  return p;
}

/** Ruído determinístico (o mesmo desenho toda vez, para a arte não "tremer" a cada quadro). */
function aleatorio(semente: number) {
  let s = semente >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

/** Desenha o elemento na caixa (0, 0, w, h). A família da letra (para carimbo e selo) vem de quem chama. */
export function desenharElemento(ctx: CanvasRenderingContext2D, e: DadosDoElemento, w: number, h: number, letra: { sans: string; serifa: string; mao: string }) {
  const cor = e.cor || "#1f1a14";
  if (e.desenho in VETORES) {
    const v = VETORES[e.desenho as keyof typeof VETORES];
    const escala = Math.min(w / v.caixa[0], h / v.caixa[1]);
    ctx.save();
    ctx.translate((w - v.caixa[0] * escala) / 2, (h - v.caixa[1] * escala) / 2);
    ctx.scale(escala, escala);
    ctx.translate(v.desloca[0], v.desloca[1]);
    ctx.fillStyle = cor;
    for (const p of caminhos(e.desenho, v.caminhos)) ctx.fill(p, "evenodd");
    ctx.restore();
    return;
  }
  switch (e.desenho) {
    case "brasil-estados": {
      // Os 27 estados: os escolhidos (siglas no conteúdo) na segunda cor, os outros na cor principal, com fios claros.
      const lado = Math.min(w, h);
      const destaque = new Set((e.conteudo || "").toUpperCase().split(/[^A-Z]+/).filter(Boolean));
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(lado / 1000, lado / 1000);
      for (const estado of ESTADOS) {
        const p = caminhos(`uf:${estado.uf}`, [estado.d])[0];
        ctx.fillStyle = destaque.has(estado.uf) ? e.fundo || "#c21f16" : cor;
        ctx.fill(p, "evenodd");
      }
      ctx.strokeStyle = "rgba(251, 247, 236, 0.9)";
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(0.6, e.espessura || 1.4);
      for (const estado of ESTADOS) ctx.stroke(caminhos(`uf:${estado.uf}`, [estado.d])[0]);
      ctx.restore();
      return;
    }
    case "icone": {
      const nome = e.icone && e.icone in ICONES ? e.icone : "estrela";
      const lado = Math.min(w, h);
      ctx.save();
      ctx.translate((w - lado) / 2, (h - lado) / 2);
      ctx.scale(lado / 24, lado / 24);
      if (e.fundo) {
        ctx.fillStyle = e.fundo;
        for (const p of caminhos(`icone:${nome}`, ICONES[nome])) ctx.fill(p);
      }
      ctx.strokeStyle = cor;
      ctx.lineWidth = e.espessura > 0 ? e.espessura : 1.6;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const p of caminhos(`icone:${nome}`, ICONES[nome])) ctx.stroke(p);
      ctx.restore();
      return;
    }
    case "qr": {
      const m = matrizQr(e.conteudo);
      const lado = Math.min(w, h);
      ctx.save();
      ctx.translate((w - lado) / 2, (h - lado) / 2);
      if (e.fundo) {
        ctx.fillStyle = e.fundo;
        ctx.fillRect(0, 0, lado, lado);
      }
      if (m) {
        // Dois módulos de margem (a zona de silêncio mínima que os leitores toleram bem).
        const passo = lado / (m.tamanho + 4);
        ctx.fillStyle = cor;
        for (let l = 0; l < m.tamanho; l++) for (let c = 0; c < m.tamanho; c++) if (m.cheio(l, c)) ctx.fillRect((c + 2) * passo, (l + 2) * passo, passo + 0.4, passo + 0.4);
      }
      ctx.restore();
      return;
    }
    case "ornamento": {
      // Fio com a estrela no meio e losangos nas pontas (como nas aberturas do jornal).
      const meio = h / 2;
      const raio = Math.min(h / 2, w / 12);
      const fio = Math.max(1, e.espessura || h / 14);
      ctx.fillStyle = cor;
      ctx.fillRect(0, meio - fio / 2, w / 2 - raio * 1.8, fio);
      ctx.fillRect(w / 2 + raio * 1.8, meio - fio / 2, w / 2 - raio * 1.8, fio);
      ctx.fill(estrelaPath(w / 2, meio + raio * 0.08, raio));
      for (const x of [0, w]) {
        ctx.beginPath();
        ctx.moveTo(x, meio - fio * 2.2);
        ctx.lineTo(x + (x === 0 ? fio * 2.2 : -fio * 2.2), meio);
        ctx.lineTo(x, meio + fio * 2.2);
        ctx.closePath();
        ctx.fill();
      }
      return;
    }
    case "carimbo": {
      // Dois anéis, o texto correndo por cima e por baixo, a estrela no meio.
      const r = Math.min(w, h) / 2;
      const cx = w / 2;
      const cy = h / 2;
      const anel = Math.max(1.5, r * 0.035);
      ctx.strokeStyle = cor;
      ctx.fillStyle = cor;
      ctx.lineWidth = anel;
      ctx.beginPath();
      ctx.arc(cx, cy, r - anel / 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      const tamanho = r * 0.17;
      ctx.font = `800 ${tamanho}px ${letra.sans}`;
      ctx.letterSpacing = `${tamanho * 0.12}px`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (e.conteudo) textoEmCirculo(ctx, e.conteudo.toUpperCase(), cx, cy, r * 0.85, -Math.PI / 2, false);
      if (e.conteudo2) textoEmCirculo(ctx, e.conteudo2.toUpperCase(), cx, cy, r * 0.85, Math.PI / 2, true);
      ctx.letterSpacing = "0px";
      ctx.fill(estrelaPath(cx, cy + r * 0.03, r * 0.42));
      for (const lado of [-1, 1]) ctx.fill(estrelaPath(cx + lado * r * 0.85, cy, r * 0.06));
      return;
    }
    case "selo": {
      // Borda recortada (como selo de garantia), miolo liso e o texto no centro.
      const r = Math.min(w, h) / 2;
      const cx = w / 2;
      const cy = h / 2;
      const dentes = e.quantidade && e.quantidade >= 12 ? e.quantidade : 28;
      ctx.beginPath();
      for (let i = 0; i <= dentes * 2; i++) {
        const a = (i * Math.PI) / dentes;
        const rr = i % 2 === 0 ? r : r * 0.9;
        if (i === 0) ctx.moveTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
        else ctx.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
      }
      ctx.closePath();
      ctx.fillStyle = cor;
      ctx.fill();
      const miolo = e.fundo || "#f4ecd8";
      ctx.strokeStyle = miolo;
      ctx.lineWidth = Math.max(1, r * 0.025);
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.74, 0, Math.PI * 2);
      ctx.stroke();
      const linhas = (e.conteudo || "").split("\n").slice(0, 4);
      const tamanho = (r * 0.62) / Math.max(1.6, linhas.length * 1.05);
      ctx.fillStyle = miolo;
      ctx.font = `italic 600 ${tamanho}px ${letra.serifa}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      linhas.forEach((linha, i) => ctx.fillText(linha, cx, cy + (i - (linhas.length - 1) / 2) * tamanho * 1.05, r * 1.18));
      return;
    }
    case "fita": {
      // Fita adesiva meio transparente, com as pontas rasgadas em zigue-zague.
      const sorte = aleatorio(Math.round(w * 7 + h * 13));
      const dente = Math.max(3, h / 7);
      ctx.beginPath();
      ctx.moveTo(dente, 0);
      ctx.lineTo(w - dente, 0);
      let volta = 0;
      for (let y = 0; y < h; y += dente) ctx.lineTo(w - (volta++ % 2 === 0 ? dente * 0.15 : dente) - sorte() * dente * 0.3, Math.min(h, y + dente));
      ctx.lineTo(dente, h);
      volta = 0;
      for (let y = h; y > 0; y -= dente) ctx.lineTo((volta++ % 2 === 0 ? dente * 0.15 : dente) + sorte() * dente * 0.3, Math.max(0, y - dente));
      ctx.closePath();
      ctx.save();
      ctx.shadowColor = "rgba(23, 19, 14, 0.18)";
      ctx.shadowBlur = h * 0.15;
      ctx.shadowOffsetY = h * 0.05;
      ctx.fillStyle = cor;
      ctx.globalAlpha *= 0.85;
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = "rgba(23, 19, 14, 0.08)";
      ctx.lineWidth = Math.max(0.5, h * 0.02);
      ctx.stroke();
      return;
    }
    case "louros": {
      // Dois ramos de trigo em arco que se encontram embaixo (o emblema dos cartazes): em cada ponto do talo, um par
      // de grãos inclinados para cima, um para fora e um para dentro, diminuindo até a ponta.
      const pares = e.quantidade && e.quantidade >= 5 ? e.quantidade : 11;
      const cx = w / 2;
      const raio = Math.min(w / 2, h * 0.62) * 0.92;
      const cy = h - raio * 1.02;
      const abertura = 1.75;
      ctx.fillStyle = cor;
      ctx.strokeStyle = cor;
      ctx.lineCap = "round";
      for (const lado of [-1, 1]) {
        // O talo.
        ctx.lineWidth = Math.max(1, raio * 0.022);
        ctx.beginPath();
        const inicio = Math.PI / 2 + lado * 0.12;
        const fimDoTalo = Math.PI / 2 + lado * (0.12 + abertura);
        ctx.arc(cx, cy, raio, inicio, fimDoTalo, lado < 0);
        ctx.stroke();
        const grao = (px: number, py: number, dx: number, dy: number, comprimento: number) => {
          ctx.beginPath();
          ctx.ellipse(px + (dx * comprimento) / 2, py + (dy * comprimento) / 2, comprimento / 2, comprimento * 0.19, Math.atan2(dy, dx), 0, Math.PI * 2);
          ctx.fill();
        };
        for (let i = 0; i < pares; i++) {
          const t = (i + 0.5) / pares;
          const teta = Math.PI / 2 + lado * (0.12 + t * abertura);
          const px = cx + Math.cos(teta) * raio;
          const py = cy + Math.sin(teta) * raio;
          // Para onde o ramo cresce (tangente) e para fora (normal).
          const tx = -lado * Math.sin(teta);
          const ty = lado * Math.cos(teta);
          const nx = Math.cos(teta);
          const ny = Math.sin(teta);
          const comprimento = raio * (0.26 - t * 0.1);
          const inclina = 0.62;
          grao(px, py, tx * Math.cos(inclina) + nx * Math.sin(inclina), ty * Math.cos(inclina) + ny * Math.sin(inclina), comprimento);
          grao(px, py, tx * Math.cos(inclina) - nx * Math.sin(inclina), ty * Math.cos(inclina) - ny * Math.sin(inclina), comprimento * 0.9);
        }
        // O grão da ponta, seguindo o talo.
        const tetaFim = fimDoTalo;
        grao(cx + Math.cos(tetaFim) * raio, cy + Math.sin(tetaFim) * raio, -lado * Math.sin(tetaFim), lado * Math.cos(tetaFim), raio * 0.17);
      }
      return;
    }
    case "raios-traco": {
      // Raios de sol em traço, saindo de um centro (o sol "com raios em traço").
      const n = e.quantidade && e.quantidade >= 6 ? e.quantidade : 36;
      const cx = w / 2;
      const cy = h / 2;
      const r0 = Math.min(w, h) * 0.18;
      const r1 = Math.hypot(w, h) / 2;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      ctx.clip();
      ctx.strokeStyle = cor;
      ctx.lineCap = "butt";
      ctx.lineWidth = e.espessura > 0 ? e.espessura : Math.max(1, Math.min(w, h) / 120);
      for (let i = 0; i < n; i++) {
        const a = (i * Math.PI * 2) / n;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }
    case "pincelada": {
      // Uma passada de pincel atrás do texto: bordas irregulares, as pontas mais secas.
      const sorte = aleatorio(Math.round(w * 3 + h * 5));
      ctx.fillStyle = cor;
      ctx.beginPath();
      const passos = 28;
      ctx.moveTo(0, h * (0.15 + sorte() * 0.1));
      for (let i = 1; i <= passos; i++) ctx.lineTo((w * i) / passos, h * (0.05 + sorte() * 0.14));
      for (let i = passos; i >= 0; i--) ctx.lineTo((w * i) / passos, h * (0.86 + sorte() * 0.12));
      ctx.closePath();
      ctx.fill();
      ctx.globalCompositeOperation = "destination-out";
      for (let i = 0; i < 18; i++) {
        const y = h * (0.12 + sorte() * 0.76);
        const x = sorte() < 0.5 ? sorte() * w * 0.12 : w - sorte() * w * 0.12;
        ctx.fillRect(x, y, w * (0.04 + sorte() * 0.1), Math.max(1, h * 0.03));
      }
      ctx.globalCompositeOperation = "source-over";
      return;
    }
    case "seta-mao": {
      // Seta desenhada à mão, em curva, apontando para a direita e para baixo.
      ctx.strokeStyle = cor;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = e.espessura > 0 ? e.espessura : Math.max(2, Math.min(w, h) / 18);
      ctx.beginPath();
      ctx.moveTo(w * 0.06, h * 0.2);
      ctx.bezierCurveTo(w * 0.5, h * 0.02, w * 0.92, h * 0.3, w * 0.8, h * 0.86);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(w * 0.6, h * 0.68);
      ctx.lineTo(w * 0.8, h * 0.88);
      ctx.lineTo(w * 0.96, h * 0.64);
      ctx.stroke();
      return;
    }
    case "figurinha": {
      // Só guia (não sai na exportação): onde vai a figurinha de link, enquete ou pergunta do story.
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.strokeStyle = "#6e1f1a";
      ctx.lineWidth = Math.max(2, h * 0.025);
      ctx.setLineDash([h * 0.08, h * 0.06]);
      ctx.beginPath();
      ctx.roundRect(0, 0, w, h, Math.min(w, h) * 0.18);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#6e1f1a";
      ctx.font = `700 ${Math.min(h * 0.22, w * 0.09)}px ${letra.sans}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(e.conteudo || "Figurinha", w / 2, h / 2, w * 0.9);
      return;
    }
  }
}
