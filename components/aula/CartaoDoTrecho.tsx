// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import type { TextosDaAula } from "@/i18n/escola/aula";

const LADO = 1080;
const MARGEM = 96;
export const MAX_CARACTERES = 280;
const LIMITE_BYTES = 80 * 1024;

/** O trecho cortado em até 280 caracteres, numa palavra inteira, com reticências quando foi cortado. */
export function cortarTrecho(texto: string, max = MAX_CARACTERES): string {
  const limpo = texto.replace(/\s+/g, " ").trim();
  if (limpo.length <= max) return limpo;
  const corte = limpo.lastIndexOf(" ", max - 1);
  return `${limpo.slice(0, corte > max * 0.6 ? corte : max - 1).replace(/[\s,.;:]+$/, "")}…`;
}

/** Quebra o texto em linhas que cabem na largura, com a fonte já posta no contexto. */
function linhas(ctx: CanvasRenderingContext2D, texto: string, largura: number): string[] {
  const saida: string[] = [];
  let atual = "";
  for (const palavra of texto.split(" ")) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (ctx.measureText(tentativa).width <= largura || !atual) atual = tentativa;
    else {
      saida.push(atual);
      atual = palavra;
    }
  }
  if (atual) saida.push(atual);
  return saida;
}

/** As cores do tema que está na tela agora (claro, escuro, alto contraste), lidas das variáveis do CSS. */
function cores() {
  const css = getComputedStyle(document.documentElement);
  const v = (nome: string, padrao: string) => css.getPropertyValue(nome).trim() || padrao;
  return { fundo: v("--parchment", "#f8f5ee"), tinta: v("--ink", "#1f1a14"), suave: v("--ink-soft", "#5a4e3c"), fio: v("--rule", "#d9cfbc"), destaque: "#c21f16" };
}

/** Desenha o cartão 1080×1080: o trecho entre aspas, o título da aula e o endereço do site, em fonte do sistema. */
function desenhar(canvas: HTMLCanvasElement, trecho: string, titulo: string, endereco: string) {
  canvas.width = LADO;
  canvas.height = LADO;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const c = cores();
  ctx.fillStyle = c.fundo;
  ctx.fillRect(0, 0, LADO, LADO);
  // A faixa vermelha à esquerda, como a margem do caderno.
  ctx.fillStyle = c.destaque;
  ctx.fillRect(0, 0, 18, LADO);
  const largura = LADO - MARGEM * 2;
  let tamanho = 64;
  let quebradas: string[] = [];
  // A letra diminui até o trecho caber no espaço do meio.
  for (; tamanho >= 36; tamanho -= 4) {
    ctx.font = `600 ${tamanho}px Georgia, "Times New Roman", serif`;
    quebradas = linhas(ctx, `“${trecho}”`, largura);
    if (quebradas.length * tamanho * 1.3 <= LADO - 420) break;
  }
  ctx.fillStyle = c.tinta;
  ctx.textBaseline = "top";
  const altura = quebradas.length * tamanho * 1.3;
  let y = Math.max(MARGEM + 40, (LADO - 260 - altura) / 2 + 40);
  for (const linha of quebradas) {
    ctx.fillText(linha, MARGEM, y);
    y += tamanho * 1.3;
  }
  ctx.fillStyle = c.fio;
  ctx.fillRect(MARGEM, LADO - 240, largura, 3);
  ctx.fillStyle = c.tinta;
  ctx.font = `700 40px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  const tituloEmLinhas = linhas(ctx, titulo, largura).slice(0, 2);
  tituloEmLinhas.forEach((linha, i) => ctx.fillText(linha, MARGEM, LADO - 200 + i * 50));
  ctx.fillStyle = c.suave;
  ctx.font = `500 32px ui-monospace, "Cascadia Mono", Menlo, monospace`;
  ctx.fillText(endereco, MARGEM, LADO - 90);
}

function emBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolver) => canvas.toBlob((b) => resolver(b), "image/png"));
}

/**
 * O cartão do trecho (Etapa 4, R1-25): uma imagem PNG de 1080×1080, feita num canvas neste aparelho (nada vai para o
 * servidor), com até 280 caracteres do trecho, o título da aula, o endereço do site e as cores do tema atual. Com o
 * compartilhar do aparelho que aceita arquivo, abre a lista de aplicativos; sem ele, baixa a imagem e copia o link.
 */
export function CartaoDoTrecho({ trecho, titulo, endereco, s, fechar }: { trecho: string; titulo: string; endereco: string; s: TextosDaAula["cartao"]; fechar: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const botaoFechar = useRef<HTMLButtonElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState("");
  const [aviso, setAviso] = useState("");
  const aoFechar = useRef(fechar);
  useEffect(() => {
    aoFechar.current = fechar;
  }, [fechar]);

  useEffect(() => {
    let url = "";
    let vivo = true;
    (async () => {
      if (!canvas.current) return;
      desenhar(canvas.current, cortarTrecho(trecho), titulo, endereco.replace(/^https?:\/\//, "").replace(/\/$/, ""));
      const blob = await emBlob(canvas.current);
      if (!blob || !vivo) return;
      // PNG de cores chapadas fica bem abaixo do limite; se passar, sai em JPEG, que é sempre menor.
      const final = blob.size <= LIMITE_BYTES ? blob : ((await new Promise<Blob | null>((r) => canvas.current?.toBlob((b) => r(b), "image/jpeg", 0.82))) ?? blob);
      const tipo = final.type === "image/jpeg" ? "jpg" : "png";
      url = URL.createObjectURL(final);
      setPrevia(url);
      setArquivo(new File([final], `trecho-instituto-lucia.${tipo}`, { type: final.type }));
    })();
    botaoFechar.current?.focus();
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && aoFechar.current();
    window.addEventListener("keydown", tecla);
    return () => {
      vivo = false;
      window.removeEventListener("keydown", tecla);
      if (url) URL.revokeObjectURL(url);
    };
  }, [trecho, titulo, endereco]);

  const podeCompartilharArquivo = Boolean(arquivo && typeof navigator.canShare === "function" && navigator.canShare({ files: [arquivo] }));
  const link = typeof window !== "undefined" ? window.location.href.split("#")[0] : "";

  const compartilhar = async () => {
    if (!arquivo) return;
    try {
      await navigator.share({ files: [arquivo], title: titulo, text: link });
    } catch {
      // a pessoa fechou a janela de compartilhar
    }
  };
  const baixar = async () => {
    if (!arquivo || !previa) return;
    const a = document.createElement("a");
    a.href = previa;
    a.download = arquivo.name;
    a.click();
    try {
      await navigator.clipboard.writeText(link);
      setAviso(s.baixado);
    } catch {
      setAviso(s.soBaixado);
    }
  };

  return (
    <div className="folha-da-palavra-veu no-print no-leitor" onClick={fechar}>
      <div role="dialog" aria-modal="true" aria-label={s.titulo} className="folha-da-palavra cartao-do-trecho" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <p className="font-serif text-2xl font-semibold">{s.titulo}</p>
          <button ref={botaoFechar} type="button" onClick={fechar} aria-label={s.fechar} className="folha-da-palavra-fechar">
            <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <canvas ref={canvas} hidden />
        {previa ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previa} alt={s.alt} width={LADO} height={LADO} className="mt-3 aspect-square w-full max-w-[22rem] border-2 border-ink" data-cartao-bytes={arquivo?.size} />
        ) : (
          <p role="status" className="mt-3 text-ink-soft">
            {s.gerando}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          {podeCompartilharArquivo && (
            <button type="button" className="botao botao-tinta" onClick={() => void compartilhar()}>
              {s.compartilhar}
            </button>
          )}
          <button type="button" className={podeCompartilharArquivo ? "botao" : "botao botao-tinta"} disabled={!arquivo} onClick={() => void baixar()}>
            {s.baixar}
          </button>
        </div>
        <p role="status" className="mt-2 min-h-5 text-sm">
          {aviso}
        </p>
        <p className="text-xs text-ink-soft">{s.privado}</p>
      </div>
    </div>
  );
}
