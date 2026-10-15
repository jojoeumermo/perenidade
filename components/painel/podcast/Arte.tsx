// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import { botao, botaoClaro, campo, rotulo } from "../comum";

// Modelos de capa e de arte de divulgação com a identidade do instituto: as cores do jornal (pergaminho, vermelho da
// gráfica, tinta), a estrela, a letra pesada dos cartazes e a serifa editorial. Quem produz só troca os textos.

export interface DadosArte {
  titulo: string;
  programa: string;
  serie: string;
  numero: string;
  temporada: string;
  convidado: string;
  chamada: string;
  foto: HTMLImageElement | ImageBitmap | null;
}

export const MODELOS = [
  { id: "cartaz", nome: "Cartaz vermelho" },
  { id: "jornal", nome: "Capa de jornal" },
  { id: "preto", nome: "Arquivo preto" },
  { id: "retrato", nome: "Retrato do convidado" },
  { id: "raios", nome: "Raios" },
  { id: "numero", nome: "Número grande (série)" },
] as const;
export type Modelo = (typeof MODELOS)[number]["id"];

export const FORMATOS = [
  { id: "capa", nome: "Capa do episódio (3000 × 3000)", w: 3000, h: 3000 },
  { id: "post", nome: "Post quadrado (1080 × 1080)", w: 1080, h: 1080 },
  { id: "retrato", nome: "Post em pé (1080 × 1350)", w: 1080, h: 1350 },
  { id: "story", nome: "Story e vídeo vertical (1080 × 1920)", w: 1080, h: 1920 },
] as const;
export type Formato = (typeof FORMATOS)[number]["id"];

const COR = { vermelho: "#c21f16", bordo: "#6e1f1a", tinta: "#1f1a14", pergaminho: "#f4ecd8", papel: "#e9dcbc", ouro: "#d4a24c" };

function familia(variavel: string, reserva: string): string {
  const valor = getComputedStyle(document.documentElement).getPropertyValue(variavel).trim();
  return valor || reserva;
}

let fontesProntas: Promise<{ serifa: string; sans: string; mono: string }> | null = null;
/** As letras do site, já carregadas, para o desenho não sair na letra do sistema. */
export function fontes() {
  fontesProntas ??= (async () => {
    const serifa = familia("--font-serif-display", "Georgia, serif");
    const sans = familia("--font-ui", "system-ui, sans-serif");
    const mono = familia("--font-archive", "monospace");
    await Promise.all([
      document.fonts.load(`600 100px ${serifa}`),
      document.fonts.load(`italic 900 100px ${sans}`),
      document.fonts.load(`500 100px ${mono}`),
    ]).catch(() => {});
    return { serifa, sans, mono };
  })();
  return fontesProntas;
}

let marca: Promise<HTMLImageElement | null> | null = null;
export function imagemDaMarca() {
  marca ??= new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = "/marca-512.png";
  });
  return marca;
}

/** Quebra o texto em linhas que cabem na largura; diminui a letra até caber no número de linhas. */
function caber(pena: CanvasRenderingContext2D, texto: string, fonte: (tamanho: number) => string, largura: number, maxLinhas: number, tamanho: number, minimo: number) {
  let t = tamanho;
  for (; t >= minimo; t -= Math.max(1, Math.round(t * 0.06))) {
    pena.font = fonte(t);
    const palavras = texto.split(/\s+/).filter(Boolean);
    const linhas: string[] = [];
    let atual = "";
    let cabe = true;
    for (const palavra of palavras) {
      const tentativa = atual ? `${atual} ${palavra}` : palavra;
      if (pena.measureText(tentativa).width <= largura) atual = tentativa;
      else {
        if (pena.measureText(palavra).width > largura) cabe = false;
        if (atual) linhas.push(atual);
        atual = palavra;
      }
    }
    if (atual) linhas.push(atual);
    if (cabe && linhas.length <= maxLinhas) return { linhas, tamanho: t };
  }
  pena.font = fonte(minimo);
  return { linhas: [texto.slice(0, 80)], tamanho: minimo };
}

export function estrela(pena: CanvasRenderingContext2D, cx: number, cy: number, raio: number, cor: string) {
  pena.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? raio : raio * 0.382;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pena[i === 0 ? "moveTo" : "lineTo"](cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  pena.closePath();
  pena.fillStyle = cor;
  pena.fill();
}

function cobrir(pena: CanvasRenderingContext2D, foto: HTMLImageElement | ImageBitmap, x: number, y: number, w: number, h: number) {
  const escala = Math.max(w / foto.width, h / foto.height);
  const fw = foto.width * escala;
  const fh = foto.height * escala;
  pena.drawImage(foto, x + (w - fw) / 2, y + (h - fh) / 2, fw, fh);
}

const etiqueta = (d: DadosArte) =>
  [d.serie, d.temporada ? `T${d.temporada}` : "", d.numero ? `EP. ${d.numero}` : ""].filter(Boolean).join(" · ").toUpperCase();

/** Desenha o modelo na tela. Todas as medidas são proporcionais: o mesmo desenho serve de 1080 a 3000 pontos. */
export async function desenharArte(tela: HTMLCanvasElement, modelo: Modelo, formato: Formato, d: DadosArte) {
  const { w, h } = FORMATOS.find((f) => f.id === formato)!;
  tela.width = w;
  tela.height = h;
  const pena = tela.getContext("2d");
  if (!pena) return;
  const { serifa, sans, mono } = await fontes();
  const logo = await imagemDaMarca();
  const u = Math.min(w, h) / 100; // uma "unidade" = 1% do lado menor
  const m = 7 * u; // margem
  const larg = w - 2 * m;
  const pesada = (t: number) => `italic 900 ${t}px ${sans}`;
  const editorial = (t: number) => `600 ${t}px ${serifa}`;
  const fina = (t: number) => `500 ${t}px ${mono}`;
  pena.textBaseline = "alphabetic";
  pena.textAlign = "left";

  const rodape = (cor: string, fundoLogo = true) => {
    const tam = 9 * u;
    if (logo) {
      if (fundoLogo) pena.drawImage(logo, m, h - m - tam, tam, tam);
    }
    pena.fillStyle = cor;
    pena.font = fina(2.6 * u);
    pena.fillText("INSTITUTO LÚCIA", m + (logo ? tam + 2.5 * u : 0), h - m - tam / 2 + 0.9 * u);
    pena.textAlign = "right";
    pena.fillText((d.programa || "PODCAST").toUpperCase().slice(0, 34), w - m, h - m - tam / 2 + 0.9 * u);
    pena.textAlign = "left";
  };

  if (modelo === "cartaz") {
    pena.fillStyle = COR.vermelho;
    pena.fillRect(0, 0, w, h);
    pena.fillStyle = COR.tinta;
    pena.beginPath();
    pena.moveTo(w, h * 0.62);
    pena.lineTo(w, h);
    pena.lineTo(w * 0.55, h);
    pena.closePath();
    pena.fill();
    estrela(pena, m + 6 * u, m + 6 * u, 6.5 * u, COR.pergaminho);
    pena.fillStyle = COR.pergaminho;
    pena.font = fina(2.8 * u);
    pena.fillText(etiqueta(d) || "PODCAST", m + 15 * u, m + 7.2 * u);
    const { linhas, tamanho } = caber(pena, d.titulo.toUpperCase(), pesada, larg, h > w ? 7 : 5, 13 * u, 5 * u);
    pena.font = pesada(tamanho);
    let y = h * (h > w ? 0.34 : 0.3) + tamanho;
    for (const linha of linhas) {
      pena.fillText(linha, m, y);
      y += tamanho * 0.96;
    }
    if (d.convidado) {
      pena.font = editorial(4.6 * u);
      pena.fillText(`com ${d.convidado}`, m, y + 3 * u);
    }
    rodape(COR.pergaminho);
  } else if (modelo === "jornal") {
    pena.fillStyle = COR.pergaminho;
    pena.fillRect(0, 0, w, h);
    const faixa = 17 * u;
    pena.fillStyle = COR.vermelho;
    pena.fillRect(0, m, w - 18 * u, faixa);
    pena.fillStyle = COR.tinta;
    pena.fillRect(w - 18 * u, m, 18 * u, faixa);
    estrela(pena, w - 9 * u, m + faixa / 2, 5.5 * u, COR.pergaminho);
    const nome = caber(pena, (d.programa || "Podcast").toUpperCase(), pesada, w - 18 * u - 2 * m, 1, 9 * u, 4 * u);
    pena.fillStyle = COR.pergaminho;
    pena.font = pesada(nome.tamanho);
    pena.fillText(nome.linhas[0], m, m + faixa / 2 + nome.tamanho * 0.36);
    pena.fillStyle = COR.tinta;
    pena.fillRect(m, m + faixa + 2 * u, larg, 0.8 * u);
    pena.fillRect(m, m + faixa + 3.4 * u, larg, 0.3 * u);
    pena.font = fina(2.8 * u);
    pena.fillStyle = COR.bordo;
    pena.fillText(etiqueta(d) || "NOVO EPISÓDIO", m, m + faixa + 9 * u);
    const { linhas, tamanho } = caber(pena, d.titulo, editorial, larg, h > w ? 7 : 5, 11 * u, 5 * u);
    pena.fillStyle = COR.tinta;
    pena.font = editorial(tamanho);
    let y = m + faixa + 13 * u + tamanho;
    for (const linha of linhas) {
      pena.fillText(linha, m, y);
      y += tamanho * 1.05;
    }
    if (d.chamada || d.convidado) {
      pena.font = `italic 400 ${4.4 * u}px ${serifa}`;
      pena.fillStyle = COR.bordo;
      const extra = caber(pena, d.chamada || `com ${d.convidado}`, (t) => `italic 400 ${t}px ${serifa}`, larg, 3, 4.4 * u, 3 * u);
      for (const linha of extra.linhas) {
        y += extra.tamanho * 0.4;
        pena.fillText(linha, m, y + extra.tamanho);
        y += extra.tamanho * 1.1;
      }
    }
    rodape(COR.tinta);
  } else if (modelo === "preto") {
    pena.fillStyle = COR.tinta;
    pena.fillRect(0, 0, w, h);
    pena.strokeStyle = COR.ouro;
    pena.lineWidth = 0.6 * u;
    pena.strokeRect(m / 2, m / 2, w - m, h - m);
    pena.fillStyle = COR.ouro;
    pena.font = fina(2.8 * u);
    pena.fillText((etiqueta(d) || "ARQUIVO VIVO · PODCAST").split("").join(" "), m, m + 5 * u);
    estrela(pena, w - m - 5 * u, m + 4 * u, 4 * u, COR.vermelho);
    const { linhas, tamanho } = caber(pena, d.titulo, editorial, larg, h > w ? 8 : 5, 12 * u, 5 * u);
    pena.fillStyle = COR.pergaminho;
    pena.font = editorial(tamanho);
    let y = h * 0.42 - ((linhas.length - 1) * tamanho) / 2;
    for (const linha of linhas) {
      pena.fillText(linha, m, y);
      y += tamanho * 1.06;
    }
    if (d.convidado) {
      pena.fillStyle = COR.ouro;
      pena.font = `italic 400 ${4.6 * u}px ${serifa}`;
      pena.fillText(`com ${d.convidado}`, m, y + 2 * u);
    }
    rodape(COR.papel);
  } else if (modelo === "retrato") {
    pena.fillStyle = COR.tinta;
    pena.fillRect(0, 0, w, h);
    if (d.foto) {
      pena.save();
      pena.filter = "grayscale(1) contrast(1.15)";
      cobrir(pena, d.foto, 0, 0, w, h);
      pena.restore();
      pena.fillStyle = "rgba(194, 31, 22, 0.35)";
      pena.globalCompositeOperation = "multiply";
      pena.fillRect(0, 0, w, h);
      pena.globalCompositeOperation = "source-over";
    } else {
      for (let i = 0; i < 18; i++) {
        pena.fillStyle = i % 2 ? COR.bordo : COR.vermelho;
        pena.fillRect((i * w) / 18, 0, w / 18 + 1, h * 0.6);
      }
    }
    const grad = pena.createLinearGradient(0, h * 0.4, 0, h);
    grad.addColorStop(0, "rgba(31, 26, 20, 0)");
    grad.addColorStop(0.55, "rgba(31, 26, 20, 0.92)");
    grad.addColorStop(1, COR.tinta);
    pena.fillStyle = grad;
    pena.fillRect(0, 0, w, h);
    // Montado de baixo para cima: o rodapé, o nome do convidado e o título, que sobe conforme o número de linhas.
    const { linhas, tamanho } = caber(pena, d.titulo.toUpperCase(), pesada, larg, h > w ? 5 : 3, 9 * u, 4.5 * u);
    const base = h - m - 13 * u - (d.convidado ? 7 * u : 0);
    let y = base - (linhas.length - 1) * tamanho * 0.98;
    pena.fillStyle = COR.vermelho;
    pena.fillRect(m, y - tamanho - 3 * u, 22 * u, 1.2 * u);
    pena.fillStyle = COR.pergaminho;
    pena.font = fina(2.8 * u);
    pena.fillText(etiqueta(d) || "PODCAST", m, y - tamanho - 5.5 * u);
    pena.font = pesada(tamanho);
    for (const linha of linhas) {
      pena.fillText(linha, m, y);
      y += tamanho * 0.98;
    }
    if (d.convidado) {
      pena.font = editorial(5 * u);
      pena.fillStyle = COR.ouro;
      pena.fillText(d.convidado, m, y + 2 * u);
    }
    rodape(COR.pergaminho);
  } else if (modelo === "raios") {
    pena.fillStyle = COR.vermelho;
    pena.fillRect(0, 0, w, h);
    // A faixa preta de baixo cresce com o título; os raios ocupam o resto.
    const titulo = caber(pena, d.titulo.toUpperCase(), pesada, larg, h > w ? 6 : 3, 8.5 * u, 4 * u);
    const caixa = Math.min(h * 0.6, h - m - 13 * u - titulo.linhas.length * titulo.tamanho * 0.98 - 9 * u);
    const cx = w / 2;
    const cy = caixa * 0.55;
    pena.fillStyle = COR.bordo;
    for (let i = 0; i < 24; i += 2) {
      const a0 = (i * Math.PI * 2) / 24;
      const a1 = ((i + 1) * Math.PI * 2) / 24;
      pena.beginPath();
      pena.moveTo(cx, cy);
      pena.lineTo(cx + Math.cos(a0) * w * 2, cy + Math.sin(a0) * w * 2);
      pena.lineTo(cx + Math.cos(a1) * w * 2, cy + Math.sin(a1) * w * 2);
      pena.closePath();
      pena.fill();
    }
    pena.beginPath();
    pena.arc(cx, cy, 15 * u, 0, Math.PI * 2);
    pena.fillStyle = COR.pergaminho;
    pena.fill();
    estrela(pena, cx, cy + u, 11 * u, COR.vermelho);
    pena.fillStyle = COR.tinta;
    pena.fillRect(0, caixa, w, h - caixa);
    pena.fillStyle = COR.ouro;
    pena.font = fina(2.8 * u);
    pena.fillText(etiqueta(d) || "PODCAST", m, caixa + 6 * u);
    const { linhas, tamanho } = titulo;
    pena.fillStyle = COR.pergaminho;
    pena.font = pesada(tamanho);
    let y = caixa + 8 * u + tamanho * 0.85;
    for (const linha of linhas) {
      pena.fillText(linha, m, y);
      y += tamanho * 0.98;
    }
    rodape(COR.pergaminho);
  } else {
    pena.fillStyle = COR.pergaminho;
    pena.fillRect(0, 0, w, h);
    pena.fillStyle = COR.tinta;
    pena.font = `italic 900 ${48 * u}px ${sans}`;
    const numero = d.numero || "1";
    pena.fillText(numero.padStart(2, "0"), m - 2 * u, h * 0.55);
    pena.fillStyle = COR.vermelho;
    pena.fillRect(m, h * 0.58, larg, 1.6 * u);
    estrela(pena, w - m - 6 * u, m + 6 * u, 6 * u, COR.vermelho);
    pena.fillStyle = COR.bordo;
    pena.font = fina(3 * u);
    pena.fillText([d.serie || d.programa, d.temporada ? `TEMPORADA ${d.temporada}` : ""].filter(Boolean).join(" · ").toUpperCase(), m, m + 5 * u);
    const { linhas, tamanho } = caber(pena, d.titulo, editorial, larg, h > w ? 6 : 3, 8.5 * u, 4 * u);
    pena.fillStyle = COR.tinta;
    pena.font = editorial(tamanho);
    let y = h * 0.58 + 5 * u + tamanho;
    for (const linha of linhas) {
      pena.fillText(linha, m, y);
      y += tamanho * 1.05;
    }
    rodape(COR.tinta);
  }
}

/**
 * O estúdio de arte: escolhe o modelo e o formato, troca os textos (e a foto, no modelo de retrato) e baixa a imagem
 * ou usa como capa do episódio. Tudo é desenhado no navegador.
 */
export function EstudioDeArte({ inicial, aoUsarComoCapa, rotuloCapa = "Usar como capa do episódio" }: { inicial: Partial<DadosArte>; aoUsarComoCapa?: (tela: HTMLCanvasElement) => Promise<void>; rotuloCapa?: string }) {
  const [dados, setDados] = useState<DadosArte>({ titulo: "", programa: "", serie: "", numero: "", temporada: "", convidado: "", chamada: "", foto: null, ...inicial });
  const [modelo, setModelo] = useState<Modelo>("cartaz");
  const [formato, setFormato] = useState<Formato>("capa");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const tela = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (tela.current) void desenharArte(tela.current, modelo, formato, dados);
  }, [modelo, formato, dados]);

  const muda = (campoNome: keyof DadosArte) => (e: React.ChangeEvent<HTMLInputElement>) => setDados({ ...dados, [campoNome]: e.target.value });

  async function foto(arquivo: File | undefined) {
    if (!arquivo) return;
    try {
      setDados({ ...dados, foto: await createImageBitmap(arquivo) });
    } catch {
      setAviso("Não deu para abrir esta imagem.");
    }
  }

  function baixar() {
    const atual = tela.current;
    if (!atual) return;
    atual.toBlob(
      (blob) => {
        if (!blob) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${(dados.titulo || "arte").toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").slice(0, 50)}-${formato}.jpg`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      },
      "image/jpeg",
      0.9,
    );
  }

  async function usar() {
    if (!tela.current || !aoUsarComoCapa) return;
    setOcupado(true);
    setAviso("");
    try {
      if (formato !== "capa") {
        setFormato("capa");
        await desenharArte(tela.current, modelo, "capa", dados);
      }
      await aoUsarComoCapa(tela.current);
      setAviso("Capa salva.");
    } catch {
      setAviso("Não deu certo salvar a capa. Tente de novo.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div>
        <div className="flex flex-wrap gap-2">
          {MODELOS.map((item) => (
            <button key={item.id} type="button" onClick={() => setModelo(item.id)} aria-pressed={modelo === item.id} className={`cursor-pointer border-2 px-3 py-1.5 ${modelo === item.id ? "border-ink bg-ink text-parchment" : "border-rule hover:border-ink"}`}>
              {item.nome}
            </button>
          ))}
        </div>
        <canvas ref={tela} className="mt-4 max-h-[70vh] w-full border-2 border-ink object-contain" style={{ aspectRatio: `${FORMATOS.find((f) => f.id === formato)!.w} / ${FORMATOS.find((f) => f.id === formato)!.h}` }} />
      </div>
      <div className="space-y-3">
        <label className="block">
          Formato
          <select value={formato} onChange={(e) => setFormato(e.target.value as Formato)} className={campo}>
            {FORMATOS.map((f) => (
              <option key={f.id} value={f.id}>{f.nome}</option>
            ))}
          </select>
        </label>
        <label className="block">
          Título do episódio
          <input value={dados.titulo} onChange={muda("titulo")} maxLength={140} className={campo} />
        </label>
        <div className="grid grid-cols-3 gap-2">
          <label className="block">
            Nº
            <input value={dados.numero} onChange={muda("numero")} maxLength={4} className={campo} />
          </label>
          <label className="block">
            Temporada
            <input value={dados.temporada} onChange={muda("temporada")} maxLength={2} className={campo} />
          </label>
          <label className="block">
            Série
            <input value={dados.serie} onChange={muda("serie")} maxLength={60} className={campo} />
          </label>
        </div>
        <label className="block">
          Convidado(a)
          <input value={dados.convidado} onChange={muda("convidado")} maxLength={80} className={campo} />
        </label>
        <label className="block">
          Chamada (opcional)
          <input value={dados.chamada} onChange={muda("chamada")} maxLength={120} className={campo} />
        </label>
        <label className="block">
          Nome do programa
          <input value={dados.programa} onChange={muda("programa")} maxLength={60} className={campo} />
        </label>
        {modelo === "retrato" && (
          <label className="block">
            Foto do convidado (só com autorização de imagem)
            <input type="file" accept="image/*" onChange={(e) => void foto(e.target.files?.[0])} className="mt-1 block w-full" />
          </label>
        )}
        <p className="flex flex-wrap gap-2 pt-2">
          <button type="button" onClick={baixar} className={botaoClaro}>Baixar imagem</button>
          {aoUsarComoCapa && (
            <button type="button" onClick={() => void usar()} disabled={ocupado} className={botao}>{ocupado ? "Salvando…" : rotuloCapa}</button>
          )}
        </p>
        <p role="status" className="min-h-5 text-oxblood">{aviso}</p>
        <p className={rotulo}>Dica</p>
        <p className="text-ink-soft">Para o Instagram, gere o post quadrado ou em pé; para Reels, TikTok e Shorts, o vertical. Quer algo diferente dos modelos? Peça ao design na aba Divulgação do episódio.</p>
      </div>
    </div>
  );
}
