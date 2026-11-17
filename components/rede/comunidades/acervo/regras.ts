// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As contas do acervo (frente 10D) que não dependem de tela nem de banco: limpar os metadados de um PDF, reconhecer o arquivo pelos
// bytes, comparar duas versões de um texto, montar a exportação da comunidade em HTML e os meses do arquivo. Roda no servidor (a rota
// app/api/rede/acervo), no navegador (antes de enviar) e no Node dos testes. Sem dependências e sem "@/" de propósito.

/** O tamanho máximo de um arquivo do núcleo (o mesmo do banco e do depósito). */
export const LIMITE_DO_ARQUIVO = 10 * 1024 * 1024;

export type ExtensaoDoAcervo = "pdf" | "jpg" | "png" | "webp";

/** O tipo do arquivo pelos primeiros bytes (nunca pela extensão nem pelo que o navegador diz). Nulo: não é aceito. */
export function identificarArquivo(b: Uint8Array): { ext: ExtensaoDoAcervo; mime: string } | null {
  if (b.length < 12) return null;
  const txt = (de: number, ate: number) => String.fromCharCode(...b.subarray(de, ate));
  if (txt(0, 5) === "%PDF-") return { ext: "pdf", mime: "application/pdf" };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (b[0] === 0x89 && txt(1, 4) === "PNG") return { ext: "png", mime: "image/png" };
  if (txt(0, 4) === "RIFF" && txt(8, 12) === "WEBP") return { ext: "webp", mime: "image/webp" };
  return null;
}

// ── PDF ──
//
// O PDF guarda quem fez e com o quê em dois lugares: o dicionário de informações (/Info: autor, programa, datas, título) e o pacote
// XMP (o mesmo, em XML). Os dois são APAGADOS no lugar, byte por byte (o texto vira espaço do mesmo tamanho): as posições do
// índice do arquivo (xref) continuam certas e o PDF abre igual. O que não dá para limpar com certeza faz o arquivo ser RECUSADO
// em vez de passar como se estivesse limpo: informações guardadas dentro de um fluxo comprimido, XMP comprimido, anexos, programas
// (JavaScript) e ações que abrem coisas de fora. Quem tiver um PDF assim pode imprimir em PDF de novo e enviar.

export type MotivoDaRecusaDoPdf = "nao_e_pdf" | "comprimido" | "anexo_ou_programa";

/** O que a limpeza do PDF devolve: os bytes limpos, ou o motivo da recusa. */
export type PdfLimpo = { ok: true; bytes: Uint8Array; apagados: number } | { ok: false; motivo: MotivoDaRecusaDoPdf };

const latin1 = (b: Uint8Array): string => {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return s;
};

/** Onde termina a string literal "( ... )" que começa em `i` (parênteses aninhados e escapes valem). -1 se não fecha. */
function fimDaLiteral(s: string, i: number): number {
  let nivel = 0;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (c === "\\") {
      j++;
      continue;
    }
    if (c === "(") nivel++;
    else if (c === ")" && --nivel === 0) return j;
  }
  return -1;
}

/** Apaga (vira espaço) o conteúdo de cada string de um trecho de dicionário: literais "( )" e hexadecimais "< >" (não "<<"). */
function apagarStrings(saida: Uint8Array, s: string, de: number, ate: number): number {
  let n = 0;
  for (let i = de; i < ate; i++) {
    const c = s[i];
    if (c === "(") {
      const fim = fimDaLiteral(s, i);
      if (fim < 0 || fim > ate) return n;
      for (let j = i + 1; j < fim; j++) saida[j] = 0x20;
      n++;
      i = fim;
    } else if (c === "<" && s[i + 1] !== "<" && s[i - 1] !== "<") {
      const fim = s.indexOf(">", i);
      if (fim < 0 || fim > ate) return n;
      // Hexadecimal: "20" repetido (espaços); um dígito sobrando vale "2" seguido de zero, também espaço.
      for (let j = i + 1; j < fim; j++) saida[j] = (j - i) % 2 === 1 ? 0x32 : 0x30;
      n++;
      i = fim;
    }
  }
  return n;
}

/** Limpa os metadados de um PDF (veja acima) ou diz por que recusa. Pura. */
export function limparPdf(b: Uint8Array): PdfLimpo {
  if (identificarArquivo(b)?.ext !== "pdf") return { ok: false, motivo: "nao_e_pdf" };
  const s = latin1(b);
  // Anexo, programa ou ação que abre coisa de fora: a Alumia não guarda (nem para quem envia, nem para quem abre).
  if (/\/(JavaScript|JS|EmbeddedFiles?|Launch|RichMedia|SubmitForm|ImportData|GoToR)\b/.test(s)) return { ok: false, motivo: "anexo_ou_programa" };
  const saida = b.slice();
  let apagados = 0;

  // 1. Cada /Info N G R (pode haver mais de um, um por atualização do arquivo): o objeto precisa estar à vista, fora de fluxo.
  const refs = new Set<string>();
  for (const m of s.matchAll(/\/Info\s+(\d+)\s+(\d+)\s+R\b/g)) refs.add(`${m[1]} ${m[2]}`);
  for (const ref of refs) {
    const [num, ger] = ref.split(" ");
    const cabecas = [...s.matchAll(new RegExp(`(?:^|[\\r\\n\\s])${num}\\s+${ger}\\s+obj\\b`, "g"))];
    if (cabecas.length === 0) return { ok: false, motivo: "comprimido" };
    for (const cabeca of cabecas) {
      const ini = (cabeca.index ?? 0) + cabeca[0].length;
      const fim = s.indexOf("endobj", ini);
      if (fim < 0) return { ok: false, motivo: "comprimido" };
      apagados += apagarStrings(saida, s, ini, fim);
    }
  }

  // 2. O XMP comprimido não dá para ler sem descomprimir: recusa. (Objeto com /Type /Metadata e /Filter antes do "stream".)
  for (const m of s.matchAll(/\/Type\s*\/Metadata\b/g)) {
    const ini = s.lastIndexOf("obj", m.index ?? 0);
    const fluxo = s.indexOf("stream", m.index ?? 0);
    const trecho = s.slice(ini < 0 ? 0 : ini, fluxo < 0 ? (m.index ?? 0) + 200 : fluxo);
    if (/\/Filter\b/.test(trecho)) return { ok: false, motivo: "comprimido" };
  }

  // 3. Cada pacote XMP à vista vira espaço do mesmo tamanho (do "<?xpacket begin" ao fim do "<?xpacket end ...?>", ou o x:xmpmeta).
  const pacotes = /<\?xpacket\s+begin[\s\S]*?<\?xpacket\s+end[^>]*>|<x:xmpmeta[\s\S]*?<\/x:xmpmeta>/g;
  for (const m of s.matchAll(pacotes)) {
    const ini = m.index ?? 0;
    for (let j = ini; j < ini + m[0].length; j++) saida[j] = 0x20;
    apagados++;
  }
  // Um xmpmeta aberto e não fechado (pacote cortado): recusa, em vez de deixar metade.
  if (/<x:xmpmeta/.test(latin1(saida))) return { ok: false, motivo: "comprimido" };
  return { ok: true, bytes: saida, apagados };
}

// ── Comparar versões ──

export type LinhaDaDiferenca = { tipo: "igual" | "saiu" | "entrou"; texto: string };

/**
 * A diferença linha a linha entre duas versões de um texto (a de antes e a de agora), pela maior subsequência comum. Textos muito
 * grandes (mais de 1.500 linhas somadas) não são comparados linha a linha: sai tudo como "saiu" e "entrou", sem travar a tela.
 */
export function diferencaDeLinhas(antes: string, agora: string): LinhaDaDiferenca[] {
  const a = antes.replace(/\r\n/g, "\n").split("\n");
  const b = agora.replace(/\r\n/g, "\n").split("\n");
  if (a.length + b.length > 1500) return [...a.map((texto) => ({ tipo: "saiu" as const, texto })), ...b.map((texto) => ({ tipo: "entrou" as const, texto }))];
  const m = a.length;
  const n = b.length;
  const t: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) t[i][j] = a[i] === b[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
  const saida: LinhaDaDiferenca[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      saida.push({ tipo: "igual", texto: a[i] });
      i++;
      j++;
    } else if (t[i + 1][j] >= t[i][j + 1]) saida.push({ tipo: "saiu", texto: a[i++] });
    else saida.push({ tipo: "entrou", texto: b[j++] });
  }
  while (i < m) saida.push({ tipo: "saiu", texto: a[i++] });
  while (j < n) saida.push({ tipo: "entrou", texto: b[j++] });
  return saida;
}

// ── Exportar a comunidade ──

export interface PostExportado {
  id: string;
  criado_em: string;
  tipo: string;
  titulo: string | null;
  texto: string;
  corpo: string | null;
  resposta_a: string | null;
  autor: string;
}

export interface ExportacaoDaComunidade {
  comunidade: { slug: string; nome: string; descricao: string; categoria: string; tipo: string; criada_em: string };
  regras: { numero: number; titulo: string; texto: string }[];
  wiki: { pagina: string; titulo: string; corpo: string; versao: number; editado_em: string }[];
  colecoes: { titulo: string; descricao: string; posts: string[] }[];
  exportado_em: string;
  regra: string;
  posts: PostExportado[];
}

/** Os textos que o HTML exportado usa (vêm do idioma da tela). */
export interface TextosDaExportacao {
  titulo: string;
  exportadoEm: string;
  regra: string;
  regras: string;
  wiki: string;
  colecoes: string;
  posts: string;
  semPosts: string;
  respostaA: string;
}

const escapar = (t: string | null | undefined): string =>
  String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

/**
 * A exportação em HTML: um arquivo só, sem script, sem fonte, imagem ou folha de estilo de fora, e todo texto escapado (o que
 * alguém escreveu num post nunca vira código na página de quem abre o arquivo). Pura.
 */
export function exportacaoEmHtml(e: ExportacaoDaComunidade, t: TextosDaExportacao, lang: string): string {
  const data = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(iso));
    } catch {
      return iso;
    }
  };
  const ids = new Set(e.posts.map((p) => p.id));
  const post = (p: PostExportado) => `<article id="p-${escapar(p.id)}">
<p class="meta">${escapar(p.autor)} · <time datetime="${escapar(p.criado_em)}">${escapar(data(p.criado_em))}</time>${p.resposta_a ? ` · ${escapar(t.respostaA)} ${ids.has(p.resposta_a) ? `<a href="#p-${escapar(p.resposta_a)}">#</a>` : "#"}` : ""}</p>
${p.titulo ? `<h3>${escapar(p.titulo)}</h3>` : ""}<p class="texto">${escapar(p.texto)}</p>${p.corpo ? `<div class="texto">${escapar(p.corpo)}</div>` : ""}
</article>`;
  return `<!doctype html>
<html lang="${escapar(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<meta name="robots" content="noindex">
<title>${escapar(e.comunidade.nome)} · ${escapar(t.titulo)}</title>
<style>
body{font:16px/1.55 system-ui,sans-serif;max-width:46rem;margin:0 auto;padding:1.5rem 1rem;color:#1f1a14;background:#f3efe6}
h1,h2{font-family:system-ui,sans-serif;text-transform:uppercase;letter-spacing:.02em}
h1{border-bottom:6px solid #e8321f;padding-bottom:.3rem}
article{border-top:1px solid #d6cfc2;padding:.6rem 0}
.meta{color:#5b5348;font-size:.9rem;margin:0}
.texto{white-space:pre-wrap}
@media (prefers-color-scheme:dark){body{background:#0f0e0d;color:#f3efe6}.meta{color:#bdb5a8}article{border-color:#3a3530}}
</style>
</head>
<body>
<h1>${escapar(e.comunidade.nome)}</h1>
<p>${escapar(e.comunidade.descricao)}</p>
<p class="meta">${escapar(t.exportadoEm)} ${escapar(data(e.exportado_em))} · ${escapar(t.regra)}</p>
<h2>${escapar(t.regras)}</h2>
<ol>${e.regras.map((r) => `<li><strong>${escapar(r.titulo)}</strong>${r.texto ? ` ${escapar(r.texto)}` : ""}</li>`).join("")}</ol>
${e.wiki.length ? `<h2>${escapar(t.wiki)}</h2>${e.wiki.map((w) => `<section><h3>${escapar(w.titulo)}</h3><div class="texto">${escapar(w.corpo)}</div></section>`).join("\n")}` : ""}
${e.colecoes.length ? `<h2>${escapar(t.colecoes)}</h2><ul>${e.colecoes.map((c) => `<li><strong>${escapar(c.titulo)}</strong>${c.descricao ? ` ${escapar(c.descricao)}` : ""}<ol>${c.posts.filter((id) => ids.has(id)).map((id) => `<li><a href="#p-${escapar(id)}">${escapar(e.posts.find((p) => p.id === id)?.titulo || e.posts.find((p) => p.id === id)?.texto.slice(0, 80) || id)}</a></li>`).join("")}</ol></li>`).join("")}</ul>` : ""}
<h2>${escapar(t.posts)}</h2>
${e.posts.length ? e.posts.map(post).join("\n") : `<p>${escapar(t.semPosts)}</p>`}
</body>
</html>
`;
}

// ── Arquivo por mês ──

/** "2026-11" → "novembro de 2026" (no idioma da tela, sem fuso de ninguém: o mês é o do calendário). */
export function nomeDoMes(mes: string, lang: string, comAno = true): string {
  const m = /^(\d{4})-(\d{2})$/.exec(mes);
  if (!m) return mes;
  try {
    return new Intl.DateTimeFormat(lang, { month: "long", ...(comAno ? { year: "numeric" as const } : {}), timeZone: "UTC" }).format(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 15)));
  } catch {
    return mes;
  }
}

/** Os meses agrupados por ano, do mais novo ao mais antigo (a tela desenha um ano por linha). */
export function mesesPorAno<T extends { mes: string }>(meses: readonly T[]): { ano: string; meses: T[] }[] {
  const anos = new Map<string, T[]>();
  for (const m of [...meses].sort((a, b) => (a.mes < b.mes ? 1 : -1))) {
    const ano = m.mes.slice(0, 4);
    anos.set(ano, [...(anos.get(ano) ?? []), m]);
  }
  return [...anos].map(([ano, lista]) => ({ ano, meses: lista }));
}

/** Tamanho escrito para gente ("1,2 MB"). */
export function tamanhoEscrito(bytes: number, lang: string): string {
  const fmt = (n: number, unidade: string) => `${n.toLocaleString(lang, { maximumFractionDigits: n < 10 ? 1 : 0 })} ${unidade}`;
  if (bytes < 1024) return fmt(bytes, "B");
  if (bytes < 1024 * 1024) return fmt(bytes / 1024, "KB");
  if (bytes < 1024 * 1024 * 1024) return fmt(bytes / (1024 * 1024), "MB");
  return fmt(bytes / (1024 * 1024 * 1024), "GB");
}

/** O id de post dentro de um endereço colado (".../alumia/p/<uuid>" ou o próprio uuid). Nulo se não achar. */
export function postDoEndereco(texto: string): string | null {
  const m = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(texto.trim());
  return m ? m[1].toLowerCase() : null;
}

/** Move um item da lista (a ordem escrita da coleção): de `de` para `para`, sem mudar o resto. Pura. */
export function mover<T>(lista: readonly T[], de: number, para: number): T[] {
  if (de < 0 || de >= lista.length || para < 0 || para >= lista.length || de === para) return [...lista];
  const nova = [...lista];
  const [item] = nova.splice(de, 1);
  nova.splice(para, 0, item);
  return nova;
}
