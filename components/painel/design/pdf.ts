// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).

// Um gerador de PDF mínimo, sem biblioteca: páginas com imagens JPEG (DCTDecode), caminhos vetoriais (para o PDF
// vetorial e as marcas de corte) e texto curto em Helvetica (a linha de identificação da gráfica). As medidas são em
// pontos (1/72 de polegada); a origem do PDF é embaixo, à esquerda.

export interface ImagemPdf {
  jpeg: Uint8Array;
  /** Pixels da imagem. */
  w: number;
  h: number;
  /** Onde ela fica na página, em pontos (origem embaixo, à esquerda). */
  x: number;
  y: number;
  largura: number;
  altura: number;
}

export interface PaginaPdf {
  largura: number;
  altura: number;
  imagens: ImagemPdf[];
  /** Operadores de desenho do PDF (caminhos, cores), já na coordenada da página. */
  desenho?: string;
  /** Opacidades usadas no desenho (o desenho chama /GSn gs, com n o índice aqui). */
  opacidades?: number[];
  /** Imagens com transparência usadas pelo desenho (/Imn Do), em PNG decodificado: RGB e alfa à parte. */
  imagensRgba?: { rgb: Uint8Array; alfa: Uint8Array; w: number; h: number }[];
}

const enc = new TextEncoder();

/** O texto em WinAnsi (o português cabe todo), escapado para dentro de ( ). */
export function textoPdf(texto: string): string {
  let s = "";
  for (const ch of texto) {
    const c = ch.codePointAt(0)!;
    const b = c < 256 ? c : ch === "—" ? 0x97 : ch === "–" ? 0x96 : ch === "“" ? 0x93 : ch === "”" ? 0x94 : ch === "’" ? 0x92 : ch === "•" ? 0x95 : 0x3f;
    if (b === 0x28 || b === 0x29 || b === 0x5c) s += `\\${String.fromCharCode(b)}`;
    else if (b < 32 || b > 126) s += `\\${b.toString(8).padStart(3, "0")}`;
    else s += String.fromCharCode(b);
  }
  return s;
}

const n = (v: number) => (Math.round(v * 1000) / 1000).toString();

/** Monta o arquivo PDF. */
export function montarPdf(paginas: PaginaPdf[], titulo: string): Blob {
  const partes: Uint8Array[] = [];
  let tamanho = 0;
  const offsets: number[] = [];
  const escrever = (dado: string | Uint8Array) => {
    const b = typeof dado === "string" ? enc.encode(dado) : dado;
    partes.push(b);
    tamanho += b.length;
  };
  // Cabeçalho com bytes acima de 127 (diz aos programas que o arquivo é binário).
  escrever("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  let proximo = 1;
  const reservar = () => proximo++;
  const objeto = (id: number, corpo: string | Uint8Array[], dicionario?: string) => {
    offsets[id] = tamanho;
    if (typeof corpo === "string") escrever(`${id} 0 obj\n${corpo}\nendobj\n`);
    else {
      const total = corpo.reduce((a, b) => a + b.length, 0);
      escrever(`${id} 0 obj\n<< ${dicionario ?? ""} /Length ${total} >>\nstream\n`);
      for (const c of corpo) escrever(c);
      escrever("\nendstream\nendobj\n");
    }
  };
  const catalogo = reservar();
  const arvore = reservar();
  const fonte = reservar();
  const info = reservar();
  const idsDasPaginas: number[] = [];
  for (const p of paginas) {
    const id = reservar();
    idsDasPaginas.push(id);
    const conteudo = reservar();
    const imagens = p.imagens.map(() => reservar());
    const rgba = (p.imagensRgba ?? []).map(() => [reservar(), reservar()] as const);
    const estados = (p.opacidades ?? []).map(() => reservar());
    let ops = "";
    p.imagens.forEach((img, i) => {
      ops += `q ${n(img.largura)} 0 0 ${n(img.altura)} ${n(img.x)} ${n(img.y)} cm /Im${i} Do Q\n`;
    });
    if (p.desenho) ops += p.desenho;
    const xobjetos = [...imagens.map((ref, i) => `/Im${i} ${ref} 0 R`), ...rgba.map(([ref], i) => `/Ia${i} ${ref} 0 R`)].join(" ");
    const gs = estados.map((ref, i) => `/GS${i} ${ref} 0 R`).join(" ");
    objeto(id, `<< /Type /Page /Parent ${arvore} 0 R /MediaBox [0 0 ${n(p.largura)} ${n(p.altura)}] /Contents ${conteudo} 0 R /Resources << /Font << /F1 ${fonte} 0 R >> /XObject << ${xobjetos} >> /ExtGState << ${gs} >> >> >>`);
    objeto(conteudo, [enc.encode(ops)]);
    p.imagens.forEach((img, i) => objeto(imagens[i], [img.jpeg], `/Type /XObject /Subtype /Image /Width ${img.w} /Height ${img.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`));
    (p.imagensRgba ?? []).forEach((img, i) => {
      const [ref, mascara] = rgba[i];
      objeto(mascara, [img.alfa], `/Type /XObject /Subtype /Image /Width ${img.w} /Height ${img.h} /ColorSpace /DeviceGray /BitsPerComponent 8`);
      objeto(ref, [img.rgb], `/Type /XObject /Subtype /Image /Width ${img.w} /Height ${img.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /SMask ${mascara} 0 R`);
    });
    (p.opacidades ?? []).forEach((alfa, i) => objeto(estados[i], `<< /Type /ExtGState /ca ${n(alfa)} /CA ${n(alfa)} >>`));
  }
  objeto(catalogo, `<< /Type /Catalog /Pages ${arvore} 0 R >>`);
  objeto(arvore, `<< /Type /Pages /Kids [${idsDasPaginas.map((id) => `${id} 0 R`).join(" ")}] /Count ${idsDasPaginas.length} >>`);
  objeto(fonte, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  objeto(info, `<< /Title (${textoPdf(titulo)}) /Producer (Instituto Lucia - Estudio) /Creator (Estudio do Instituto Lucia) >>`);
  const xref = tamanho;
  let tabela = `xref\n0 ${proximo}\n0000000000 65535 f \n`;
  for (let i = 1; i < proximo; i++) tabela += `${String(offsets[i] ?? 0).padStart(10, "0")} 00000 n \n`;
  escrever(tabela);
  escrever(`trailer\n<< /Size ${proximo} /Root ${catalogo} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(partes as BlobPart[], { type: "application/pdf" });
}

/** As marcas de corte (em pontos) em volta da área final, afastadas da sangria. */
export function marcasDeCorte(x: number, y: number, largura: number, altura: number, sangria: number): string {
  const afasta = sangria + 2;
  const comprimento = 14;
  let s = "0 0 0 RG 0.25 w\n";
  const linha = (x1: number, y1: number, x2: number, y2: number) => {
    s += `${n(x1)} ${n(y1)} m ${n(x2)} ${n(y2)} l S\n`;
  };
  for (const [cx, sx] of [[x, -1], [x + largura, 1]] as const)
    for (const [cy, sy] of [[y, -1], [y + altura, 1]] as const) {
      linha(cx + sx * afasta, cy, cx + sx * (afasta + comprimento), cy);
      linha(cx, cy + sy * afasta, cx, cy + sy * (afasta + comprimento));
    }
  return s;
}
