// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { fill, type Locale } from "@/i18n/config";
import type { DadosDaCarteirinha } from "@/lib/escola/matricula";
import { enderecoCurto, FrenteDaCarteirinha, type TextosDaCarteirinha, VersoDaCarteirinha } from "./Carteirinha";

// As cores do certificado (app/globals.css), as mesmas da carteirinha na tela.
const PAPEL = "#fbf7ec";
const TINTA = "#1c1712";
const OURO = "#a8862f";
const OURO_ESCURO = "#8a6a1c";
const CINZA = "#5c5245";
const BORDO = "#8c1c13";

/** 85,6 x 54 mm a 300 pontos por polegada (o tamanho de um cartão). */
const LARGURA = 1011;
const ALTURA = 638;
const VAO = 48;

/** As letras do site, lidas do que está na tela (o nome real da fonte carregada pelo Next). */
function fontes() {
  const de = (seletor: string, reserva: string) => {
    const el = document.querySelector(seletor);
    return el ? getComputedStyle(el).fontFamily || reserva : reserva;
  };
  return {
    serif: de("[data-carteirinha-frente] .carteirinha-escola", "Georgia, serif"),
    sans: de("[data-carteirinha-verso] .carteirinha-aviso", "system-ui, sans-serif"),
    mono: de("[data-carteirinha-frente] .carteirinha-numero", "ui-monospace, monospace"),
  };
}

/** Quebra um texto em linhas que cabem na largura. */
function linhas(ctx: CanvasRenderingContext2D, texto: string, largura: number): string[] {
  const saida: string[] = [];
  // Chinês não tem espaço entre as palavras: quebra por caractere.
  const pedacos = /\s/.test(texto) ? texto.split(/(\s+)/) : [...texto];
  let atual = "";
  for (const p of pedacos) {
    const teste = atual + p;
    if (ctx.measureText(teste.trim()).width > largura && atual.trim()) {
      saida.push(atual.trim());
      atual = p.trimStart();
    } else atual = teste;
  }
  if (atual.trim()) saida.push(atual.trim());
  return saida;
}

const carregar = (src: string) =>
  new Promise<HTMLImageElement>((ok, falha) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = falha;
    img.src = src;
  });

function moldura(ctx: CanvasRenderingContext2D, y: number) {
  ctx.fillStyle = PAPEL;
  ctx.beginPath();
  ctx.roundRect(0, y, LARGURA, ALTURA, 30);
  ctx.fill();
  ctx.strokeStyle = TINTA;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(26, y + 26, LARGURA - 52, ALTURA - 52, 16);
  ctx.stroke();
  ctx.strokeStyle = OURO;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(42, y + 42, LARGURA - 84, ALTURA - 84, 10);
  ctx.stroke();
}

/** Desenha as duas faces, uma embaixo da outra, num PNG. O aviso de meia-entrada vai na imagem. */
async function desenhar(d: DadosDaCarteirinha, s: TextosDaCarteirinha, foto: string | null, qr: string | null, lang: Locale): Promise<Blob> {
  const f = fontes();
  const canvas = document.createElement("canvas");
  canvas.width = LARGURA;
  canvas.height = ALTURA * 2 + VAO;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("sem canvas");
  ctx.textBaseline = "alphabetic";

  // ── Frente ──
  moldura(ctx, 0);
  const x0 = 70;
  ctx.fillStyle = TINTA;
  ctx.font = `600 54px ${f.serif}`;
  ctx.fillText(s.escola, x0, 125, 640);
  ctx.fillStyle = OURO_ESCURO;
  ctx.font = `500 22px ${f.mono}`;
  ctx.textAlign = "right";
  ctx.fillText(s.casa.toLocaleUpperCase(lang), LARGURA - x0, 122);
  ctx.textAlign = "left";
  ctx.strokeStyle = OURO;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x0, 148);
  ctx.lineTo(LARGURA - x0, 148);
  ctx.stroke();

  // O rosto: a foto (se a pessoa quis) ou as iniciais, num círculo.
  const cx = x0 + 96;
  const cy = 330;
  const r = 96;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = "#f1e8d2";
  ctx.fill();
  ctx.clip();
  if (foto) {
    try {
      const img = await carregar(foto);
      const lado = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, cx - r, cy - r, r * 2, r * 2);
    } catch {
      // foto que não abre: ficam as iniciais
    }
  }
  ctx.restore();
  if (!foto) {
    ctx.fillStyle = BORDO;
    ctx.font = `600 76px ${f.serif}`;
    ctx.textAlign = "center";
    ctx.fillText(d.iniciais || "★", cx, cy + 27);
    ctx.textAlign = "left";
  }
  ctx.strokeStyle = TINTA;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  const xd = cx + r + 48;
  const larguraDados = LARGURA - x0 - xd;
  ctx.fillStyle = TINTA;
  ctx.font = `600 54px ${f.serif}`;
  ctx.fillText(d.apelido ?? s.estudante, xd, 268, larguraDados);
  const campos: [string, string, string][] = [
    [s.rotuloNumero, d.numero, f.mono],
    [s.rotuloCurso, d.curso ?? s.semCurso, f.serif],
    [s.rotuloSemestre, d.semestre, f.serif],
  ];
  campos.forEach(([rotulo, valor, fonte], i) => {
    const y = 330 + i * 46;
    ctx.fillStyle = OURO_ESCURO;
    ctx.font = `500 20px ${f.sans}`;
    ctx.fillText(rotulo.toLocaleUpperCase(lang), xd, y);
    ctx.fillStyle = TINTA;
    ctx.font = `400 30px ${fonte}`;
    ctx.fillText(valor, xd + 150, y, larguraDados - 150);
  });
  ctx.fillStyle = CINZA;
  ctx.font = `400 22px ${f.sans}`;
  ctx.fillText(`${fill(s.desde, { ano: d.desde })} · ${s.popular}`, xd, 500, larguraDados);

  // ── Verso ──
  const y0 = ALTURA + VAO;
  moldura(ctx, y0);
  const largura = LARGURA - x0 * 2;
  ctx.font = `700 30px ${f.sans}`;
  const aviso = linhas(ctx, s.avisoNaoDocumento, largura - 40);
  const alturaAviso = aviso.length * 38 + 30;
  ctx.strokeStyle = BORDO;
  ctx.lineWidth = 4;
  ctx.strokeRect(x0, y0 + 70, largura, alturaAviso);
  ctx.fillStyle = BORDO;
  aviso.forEach((l, i) => ctx.fillText(l, x0 + 20, y0 + 70 + 44 + i * 38));
  ctx.fillStyle = CINZA;
  ctx.font = `400 21px ${f.sans}`;
  const lei = linhas(ctx, s.leiNaoVale, largura);
  lei.forEach((l, i) => ctx.fillText(l, x0, y0 + 70 + alturaAviso + 36 + i * 28));

  const lado = 150;
  const yq = y0 + ALTURA - 70 - lado;
  if (qr) {
    try {
      const img = await carregar(qr);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, x0, yq, lado, lado);
    } catch {
      // sem QR: fica o endereço escrito
    }
  }
  ctx.fillStyle = TINTA;
  ctx.font = `400 24px ${f.sans}`;
  ctx.fillText(s.qr, x0 + lado + 30, yq + 64, largura - lado - 30);
  ctx.font = `400 24px ${f.mono}`;
  ctx.fillText(enderecoCurto(lang), x0 + lado + 30, yq + 104, largura - lado - 30);

  return new Promise((ok, falha) => canvas.toBlob((b) => (b ? ok(b) : falha(new Error("sem imagem"))), "image/png"));
}

const botao = "inline-flex min-h-11 cursor-pointer items-center bg-ink px-5 py-2.5 font-semibold text-parchment hover:bg-oxblood disabled:cursor-wait disabled:opacity-60";
const claro = "inline-flex min-h-11 cursor-pointer items-center border-2 border-ink px-5 py-2 font-semibold hover:border-oxblood hover:text-oxblood";

/**
 * Imprimir e "Baixar imagem". Imprimir segue o padrão do certificado (components/CertificadoDaTrilha.tsx): enquanto a
 * página está aberta, a impressão tem o tamanho do cartão e sem margens, e window.print() abre a caixa do navegador.
 * As duas faces para imprimir ficam num bloco filho direto do <body> (só a impressão o mostra). A imagem é desenhada
 * num canvas, no aparelho, e vai pelo compartilhar do celular (navigator.share com o arquivo) ou como download.
 */
export function BaixarCarteirinha({ d, s, foto, qr, lang }: { d: DadosDaCarteirinha; s: TextosDaCarteirinha; foto: string | null; qr: string | null; lang: Locale }) {
  const [estado, setEstado] = useState<"livre" | "gerando" | "falhou">("livre");

  async function baixar() {
    setEstado("gerando");
    try {
      const blob = await desenhar(d, s, foto, qr, lang);
      const nome = `${s.nomeDoArquivo}.png`;
      const arquivo = new File([blob], nome, { type: "image/png" });
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [arquivo] })) {
        try {
          await navigator.share({ files: [arquivo], title: s.escola });
          setEstado("livre");
          return;
        } catch (erro) {
          // A pessoa fechou o compartilhar: não baixa por conta própria.
          if ((erro as Error)?.name === "AbortError") {
            setEstado("livre");
            return;
          }
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nome;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      setEstado("livre");
    } catch {
      setEstado("falhou");
    }
  }

  return (
    <div className="no-print mt-6 font-sans">
      {/* Enquanto a carteirinha está aberta, a impressão é do tamanho do cartão (85,6 x 54 mm) e sem margens. */}
      <style>{"@page { size: 85.6mm 54mm; margin: 0; }"}</style>
      <div className="flex flex-wrap gap-3">
        <button type="button" className={botao} onClick={() => window.print()}>
          {s.imprimir}
        </button>
        <button type="button" className={claro} onClick={() => void baixar()} disabled={estado === "gerando"} aria-busy={estado === "gerando"}>
          {estado === "gerando" ? s.gerando : s.baixar}
        </button>
      </div>
      <p className="mt-2 max-w-2xl text-xs text-ink-soft">{s.imprimirDica}</p>
      <p role="status" className="mt-2 text-sm text-oxblood">
        {estado === "falhou" ? s.falhou : ""}
      </p>
      {typeof document !== "undefined" &&
        createPortal(
          <div className="carteirinha-impressao" aria-hidden>
            <FrenteDaCarteirinha d={d} s={s} foto={foto} rotulada={false} />
            <VersoDaCarteirinha s={s} qr={qr} lang={lang} rotulada={false} />
          </div>,
          document.body,
        )}
    </div>
  );
}
