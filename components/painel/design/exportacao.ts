// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Tudo o que sai do estúdio: imagens (PNG, PNG transparente, JPG e WebP com qualidade), o carrossel numerado em
// .zip, os formatos lado a lado, o PDF da gráfica (300 dpi, sangria e marcas de corte), a separação de cores para
// serigrafia, o pacote da campanha (imagens, legenda, textos alternativos e créditos) e o vídeo das animações.

import { ziparBinarios } from "@/lib/zip";
import { adaptar, assinatura, carregarTudo, COR, desenhar, type Documento, exportar, formatoDe, formatoPorMedida, type FormatoId, nomeDeArquivo, PALETA, usarVariaveis } from "./motor";
import { montarPdf, marcasDeCorte, type PaginaPdf, textoPdf } from "./pdf";
import type { Projeto } from "./projeto";
import { variaveisDaPagina } from "./projeto";
import { creditosDo } from "./conferir";

export type TipoDeImagem = "png" | "png-transparente" | "jpeg" | "webp";
export const EXTENSAO: Record<TipoDeImagem, string> = { png: "png", "png-transparente": "png", jpeg: "jpg", webp: "webp" };

export function baixarArquivo(blob: Blob, nome: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 8000);
}

/** Roda uma função com as variáveis de uma página valendo (e volta às da página aberta depois). */
export async function comPagina<T>(p: Projeto, indice: number, fazer: () => Promise<T>, voltar: Record<string, string>): Promise<T> {
  usarVariaveis(variaveisDaPagina(p, indice));
  try {
    return await fazer();
  } finally {
    usarVariaveis(voltar);
  }
}

export interface OpcoesDeImagem {
  tipo: TipoDeImagem;
  qualidade: number;
  /** 1 = tamanho do formato; 2 = o dobro (para impressão ou telas grandes). */
  escala: number;
}

export const imagemDe = (doc: Documento, o: OpcoesDeImagem) =>
  exportar(doc, o.tipo === "png-transparente" ? "png" : o.tipo, { qualidade: o.qualidade, transparente: o.tipo === "png-transparente", escala: o.escala });

const doisDigitos = (i: number) => String(i + 1).padStart(2, "0");
const rotuloDaPagina = (doc: Documento, i: number) => `${doisDigitos(i)}${doc.variante ? `-${nomeDeArquivo(doc.variante)}` : ""}${doc.nome ? `-${nomeDeArquivo(doc.nome)}` : ""}`;

/** Uma página só, ou o carrossel inteiro em .zip (01, 02, 03...). */
export async function baixarImagens(p: Projeto, titulo: string, o: OpcoesDeImagem, paginas: number[], voltar: Record<string, string>, progresso?: (f: number) => void) {
  const base = nomeDeArquivo(titulo);
  if (paginas.length === 1) {
    const doc = p.paginas[paginas[0]];
    const blob = await comPagina(p, paginas[0], () => imagemDe(doc, o), voltar);
    baixarArquivo(blob, `${base}${p.paginas.length > 1 ? `-${doisDigitos(paginas[0])}` : ""}-${doc.w * o.escala}x${doc.h * o.escala}.${EXTENSAO[o.tipo]}`);
    return;
  }
  const arquivos: { nome: string; dados: Blob }[] = [];
  for (const [n, i] of paginas.entries()) {
    const doc = p.paginas[i];
    arquivos.push({ nome: `${base}-${rotuloDaPagina(doc, i)}.${EXTENSAO[o.tipo]}`, dados: await comPagina(p, i, () => imagemDe(doc, o), voltar) });
    progresso?.((n + 1) / paginas.length);
  }
  baixarArquivo(await ziparBinarios(arquivos), `${base}-carrossel.zip`);
}

/** As páginas em vários formatos (post, story, quadrado...), num .zip. */
export async function baixarFormatos(p: Projeto, titulo: string, formatos: FormatoId[], o: OpcoesDeImagem, voltar: Record<string, string>, progresso?: (f: number) => void) {
  const base = nomeDeArquivo(titulo);
  const arquivos: { nome: string; dados: Blob }[] = [];
  let feito = 0;
  for (const [i, doc] of p.paginas.entries()) {
    for (const id of formatos) {
      const f = formatoDe(id);
      if (!f) continue;
      const versao = doc.w === f.w && doc.h === f.h ? doc : adaptar(doc, f.w, f.h);
      arquivos.push({ nome: `${base}-${p.paginas.length > 1 ? `${rotuloDaPagina(doc, i)}-` : ""}${f.id}-${f.w}x${f.h}.${EXTENSAO[o.tipo]}`, dados: await comPagina(p, i, () => imagemDe(versao, o), voltar) });
      progresso?.(++feito / (p.paginas.length * formatos.length));
    }
  }
  baixarArquivo(await ziparBinarios(arquivos), `${base}-formatos.zip`);
}

async function jpegDe(tela: HTMLCanvasElement, qualidade = 0.92): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((ok, falha) => tela.toBlob((b) => (b ? ok(b) : falha(new Error("jpeg"))), "image/jpeg", qualidade));
  return new Uint8Array(await blob.arrayBuffer());
}

const PONTOS_POR_MM = 72 / 25.4;

/**
 * O PDF para a gráfica: cada página na medida final (em milímetros), em 300 dpi, com 3 mm de sangria (a borda da
 * arte se estende para fora do corte) e as marcas de corte. Formatos digitais saem no tamanho em pixels, sem marcas.
 */
export async function pdfDaGrafica(p: Projeto, titulo: string, voltar: Record<string, string>, opcoes: { sangria: number; marcas: boolean; dpi: number }, progresso?: (f: number) => void): Promise<Blob> {
  const paginas: PaginaPdf[] = [];
  for (const [i, doc] of p.paginas.entries()) {
    const f = formatoPorMedida(doc.w, doc.h);
    const mm = f?.mm;
    const larguraMm = mm ? mm[0] : (doc.w / 150) * 25.4;
    const alturaMm = mm ? mm[1] : (doc.h / 150) * 25.4;
    const pxPorMm = opcoes.dpi / 25.4;
    const escala = (larguraMm * pxPorMm) / doc.w;
    const sangriaMm = mm ? opcoes.sangria : 0;
    const sangriaPx = Math.round(sangriaMm * pxPorMm);
    await carregarTudo(doc);
    const arte = document.createElement("canvas");
    await comPagina(p, i, async () => desenhar(arte, doc, escala, { exportar: true }), voltar);
    // A sangria: a arte no meio e as bordas esticadas para fora (cor e fios continuam além do corte).
    const tela = document.createElement("canvas");
    tela.width = arte.width + 2 * sangriaPx;
    tela.height = arte.height + 2 * sangriaPx;
    const ctx = tela.getContext("2d")!;
    ctx.fillStyle = doc.fundo.cor;
    ctx.fillRect(0, 0, tela.width, tela.height);
    if (sangriaPx > 0) {
      const W = arte.width;
      const H = arte.height;
      const s = sangriaPx;
      ctx.drawImage(arte, 0, 0, 1, H, 0, s, s, H);
      ctx.drawImage(arte, W - 1, 0, 1, H, W + s, s, s, H);
      ctx.drawImage(arte, 0, 0, W, 1, s, 0, W, s);
      ctx.drawImage(arte, 0, H - 1, W, 1, s, H + s, W, s);
      ctx.drawImage(arte, 0, 0, 1, 1, 0, 0, s, s);
      ctx.drawImage(arte, W - 1, 0, 1, 1, W + s, 0, s, s);
      ctx.drawImage(arte, 0, H - 1, 1, 1, 0, H + s, s, s);
      ctx.drawImage(arte, W - 1, H - 1, 1, 1, W + s, H + s, s, s);
    }
    ctx.drawImage(arte, sangriaPx, sangriaPx);
    const margem = mm && opcoes.marcas ? 12 * PONTOS_POR_MM : 0;
    const larguraPt = (larguraMm + 2 * sangriaMm) * PONTOS_POR_MM + 2 * margem;
    const alturaPt = (alturaMm + 2 * sangriaMm) * PONTOS_POR_MM + 2 * margem;
    const corteX = margem + sangriaMm * PONTOS_POR_MM;
    const corteY = margem + sangriaMm * PONTOS_POR_MM;
    let desenho = "";
    if (mm && opcoes.marcas) {
      desenho += marcasDeCorte(corteX, corteY, larguraMm * PONTOS_POR_MM, alturaMm * PONTOS_POR_MM, sangriaMm * PONTOS_POR_MM);
      const linha = `${titulo} — página ${i + 1} de ${p.paginas.length} — ${larguraMm} × ${alturaMm} mm, ${opcoes.dpi} dpi, sangria de ${sangriaMm} mm — ${assinatura()}`;
      desenho += `BT /F1 6 Tf 0 0 0 rg ${margem.toFixed(2)} ${(margem / 3).toFixed(2)} Td (${textoPdf(linha)}) Tj ET\n`;
    }
    paginas.push({
      largura: larguraPt,
      altura: alturaPt,
      imagens: [{ jpeg: await jpegDe(tela, 0.95), w: tela.width, h: tela.height, x: margem, y: margem, largura: larguraPt - 2 * margem, altura: alturaPt - 2 * margem }],
      desenho,
    });
    progresso?.((i + 1) / p.paginas.length);
  }
  return montarPdf(paginas, titulo);
}

/**
 * A separação de cores para serigrafia: um fotolito (preto no branco) por cor de tinta da arte, na resolução da
 * gráfica. Cada pixel vai para a tinta mais próxima; o que não é tinta da paleta (fotos, degradês) vai para um
 * fotolito à parte, em tons de cinza. O fundo da página é o papel (ou a camiseta) e não vira fotolito.
 */
export async function separacaoDeCores(p: Projeto, indice: number, titulo: string, voltar: Record<string, string>, escala = 2): Promise<Blob> {
  const doc = p.paginas[indice];
  await carregarTudo(doc);
  const tela = document.createElement("canvas");
  await comPagina(p, indice, async () => desenhar(tela, doc, escala, { exportar: true }), voltar);
  const ctx = tela.getContext("2d", { willReadFrequently: true })!;
  const { data } = ctx.getImageData(0, 0, tela.width, tela.height);
  const hex = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  // As tintas: as cores sólidas que a arte usa (da paleta da marca e da campanha), menos o fundo.
  const usadas = new Set<string>();
  const anotar = (c?: string) => {
    if (c && /^#[0-9a-f]{6}$/i.test(c)) usadas.add(c.toLowerCase());
  };
  for (const c of doc.camadas) {
    if (c.oculta || c.soGuia) continue;
    if (c.tipo === "texto") [c.cor, c.fundo, c.destaque, c.contorno, c.sombra].forEach(anotar);
    else if (c.tipo === "marca") [c.cor, c.variante === "circulo" ? c.fundo : ""].forEach(anotar);
    else if (c.tipo === "elemento") [c.cor, c.fundo].forEach(anotar);
    else if (c.tipo === "imagem") [c.borda, c.meioTom ? c.corMeioTom || COR.Tinta : ""].forEach(anotar);
    else [c.preenchimento, c.borda].forEach(anotar);
  }
  [doc.fundo.bordaCima, doc.fundo.bordaBaixo].forEach(anotar);
  const papel = doc.fundo.cor.toLowerCase();
  usadas.delete(papel);
  const tintas = [...usadas].map((c) => ({ cor: c, rgb: hex(c), nome: PALETA.find(([, k]) => k.toLowerCase() === c)?.[0] ?? c }));
  const todas = [{ cor: papel, rgb: hex(papel), nome: "papel" }, ...tintas];
  const placas = tintas.map(() => new Uint8ClampedArray(tela.width * tela.height * 4).fill(255));
  const resto = new Uint8ClampedArray(tela.width * tela.height * 4).fill(255);
  let temResto = false;
  for (let i = 0; i < data.length; i += 4) {
    let melhor = 0;
    let distancia = Infinity;
    for (let t = 0; t < todas.length; t++) {
      const [r, g, b] = todas[t].rgb;
      const d = (data[i] - r) ** 2 + (data[i + 1] - g) ** 2 + (data[i + 2] - b) ** 2;
      if (d < distancia) {
        distancia = d;
        melhor = t;
      }
    }
    if (distancia > 60 ** 2) {
      // Longe de qualquer tinta: foto ou degradê.
      const cinza = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      resto[i] = resto[i + 1] = resto[i + 2] = cinza;
      temResto = true;
    } else if (melhor > 0) {
      const placa = placas[melhor - 1];
      placa[i] = placa[i + 1] = placa[i + 2] = 0;
    }
  }
  const paraPng = async (px: Uint8ClampedArray<ArrayBuffer>) => {
    const t = document.createElement("canvas");
    t.width = tela.width;
    t.height = tela.height;
    t.getContext("2d")!.putImageData(new ImageData(px, tela.width, tela.height), 0, 0);
    return new Promise<Blob>((ok, falha) => t.toBlob((b) => (b ? ok(b) : falha(new Error("png"))), "image/png"));
  };
  const base = nomeDeArquivo(titulo);
  const arquivos: { nome: string; dados: Blob }[] = [];
  for (const [i, t] of tintas.entries()) arquivos.push({ nome: `${base}-fotolito-${doisDigitos(i)}-${nomeDeArquivo(t.nome)}-${t.cor.slice(1)}.png`, dados: await paraPng(placas[i]) });
  if (temResto) arquivos.push({ nome: `${base}-fotolito-fotos-e-degrades.png`, dados: await paraPng(resto) });
  const leia = [
    `Separação de cores — ${titulo}`,
    "",
    `Tamanho: ${tela.width} × ${tela.height} pixels (${escala}× o tamanho da arte).`,
    `Papel ou camiseta: ${papel} (não vira fotolito).`,
    "",
    "Um fotolito por tinta (preto = onde a tinta vai):",
    ...tintas.map((t, i) => `  ${doisDigitos(i)}. ${t.nome} (${t.cor})`),
    ...(temResto ? ["", "fotos-e-degrades: o que não é cor sólida (fotos, degradês), em tons de cinza, para retícula."] : []),
    "",
    "Confira com a gráfica o registro (alinhamento) e a ordem das tintas.",
  ].join("\n");
  arquivos.push({ nome: "LEIA-ME.txt", dados: new Blob([leia], { type: "text/plain" }) });
  return ziparBinarios(arquivos);
}

/** O pacote da campanha: as páginas nos formatos escolhidos, a legenda, os textos alternativos e os créditos. */
export async function pacoteDaCampanha(p: Projeto, titulo: string, formatos: FormatoId[], o: OpcoesDeImagem, voltar: Record<string, string>, progresso?: (f: number) => void): Promise<Blob> {
  const base = nomeDeArquivo(titulo);
  const arquivos: { nome: string; dados: Blob }[] = [];
  const total = p.paginas.length * Math.max(1, formatos.length);
  let feito = 0;
  for (const [i, doc] of p.paginas.entries()) {
    const lista = formatos.length ? formatos : [];
    if (!lista.length) {
      arquivos.push({ nome: `imagens/${base}-${rotuloDaPagina(doc, i)}.${EXTENSAO[o.tipo]}`, dados: await comPagina(p, i, () => imagemDe(doc, o), voltar) });
      progresso?.(++feito / total);
    }
    for (const id of lista) {
      const f = formatoDe(id);
      if (!f) continue;
      const versao = doc.w === f.w && doc.h === f.h ? doc : adaptar(doc, f.w, f.h);
      arquivos.push({ nome: `${f.curto.toLowerCase().replace(/[^a-z0-9]+/g, "-")}/${base}-${rotuloDaPagina(doc, i)}.${EXTENSAO[o.tipo]}`, dados: await comPagina(p, i, () => imagemDe(versao, o), voltar) });
      progresso?.(++feito / total);
    }
  }
  const creditos = creditosDo(p);
  const texto = (s: string) => new Blob([s], { type: "text/plain" });
  arquivos.push({ nome: "legenda.txt", dados: texto(`${p.legenda.trim()}${creditos.length ? `\n\nCréditos das imagens: ${creditos.join(" · ")}` : ""}\n`) });
  arquivos.push({ nome: "textos-alternativos.txt", dados: texto(p.paginas.map((d, i) => `${doisDigitos(i)}: ${d.alt?.trim() || "(sem texto alternativo)"}`).join("\n")) });
  if (creditos.length) arquivos.push({ nome: "creditos.txt", dados: texto(creditos.join("\n")) });
  return ziparBinarios(arquivos);
}

/** Os tipos de vídeo que o navegador grava (MP4 quando dá; senão WebM). */
export function tipoDeVideo(): { mime: string; extensao: "mp4" | "webm" } | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const [mime, extensao] of [
    ["video/mp4;codecs=avc1.42E01E", "mp4"],
    ["video/mp4", "mp4"],
    ["video/webm;codecs=vp9", "webm"],
    ["video/webm", "webm"],
  ] as const)
    if (MediaRecorder.isTypeSupported(mime)) return { mime, extensao };
  return null;
}

/** Grava as animações da página num vídeo (em tempo real: um vídeo de 6 segundos leva 6 segundos). */
export async function gravarVideo(doc: Documento, segundos: number, progresso?: (f: number) => void): Promise<{ blob: Blob; extensao: string }> {
  const tipo = tipoDeVideo();
  if (!tipo) throw new Error("video");
  await carregarTudo(doc);
  const escala = Math.min(1, 1080 / Math.max(doc.w, doc.h));
  const tela = document.createElement("canvas");
  desenhar(tela, doc, escala, { exportar: true, t: 0 });
  const fluxo = tela.captureStream(30);
  const gravador = new MediaRecorder(fluxo, { mimeType: tipo.mime, videoBitsPerSecond: 8_000_000 });
  const pedacos: Blob[] = [];
  gravador.ondataavailable = (e) => {
    if (e.data.size) pedacos.push(e.data);
  };
  const terminou = new Promise<void>((ok) => {
    gravador.onstop = () => ok();
  });
  gravador.start(250);
  const inicio = performance.now();
  await new Promise<void>((ok) => {
    const quadro = () => {
      const t = (performance.now() - inicio) / 1000;
      desenhar(tela, doc, escala, { exportar: true, t });
      progresso?.(Math.min(1, t / segundos));
      if (t < segundos) requestAnimationFrame(quadro);
      else ok();
    };
    requestAnimationFrame(quadro);
  });
  gravador.stop();
  await terminou;
  fluxo.getTracks().forEach((t) => t.stop());
  return { blob: new Blob(pedacos, { type: tipo.mime.split(";")[0] }), extensao: tipo.extensao };
}
