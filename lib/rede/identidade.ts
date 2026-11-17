// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Regras puras da identidade pública opcional da Alumia (supabase/migracoes/20261113-alumia-o7-identidade-publica.sql): o que um
// nome público pode ser, a conta do recorte da foto e a conferência dos bytes do WebP (a mesma que o banco faz: sem EXIF, XMP,
// perfil de cor nem animação). Sem DOM e sem "@/" (roda no Node nos testes). O banco confere tudo de novo: isto é a primeira
// tranca, para a tela não pedir o que o servidor vai recusar.

/** Como a pessoa aparece: com codinome e rosto em mosaico (como nasce) ou com nome e foto que ela mesma escreveu e enviou. */
export type ModoDeIdentidade = "codinome" | "publica";

export interface FotoDaIdentidade {
  /** Data URL WebP. */
  dados: string;
  /** Enquanto a mediação não aceita, só a própria pessoa vê. */
  pendente: boolean;
}

/** O que `rede_identidade_minha` devolve (só a própria pessoa vê). */
export interface MinhaIdentidade {
  modo: ModoDeIdentidade;
  /** O nome público (nulo em codinome). */
  nome: string | null;
  /** O codinome em uso ou, em público, o guardado para a volta. */
  codinome: string | null;
  foto: FotoDaIdentidade | null;
  /** O dia em que passou a aparecer com o nome (AAAA-MM-DD). */
  desde: string | null;
  /** O interruptor está ligado e a conta pode escolher (conta de organização não escolhe). */
  disponivel: boolean;
  /** A pessoa ligou o Fediverso: o nome mostrado também sai para outros servidores. */
  federa: boolean;
  /** Só na resposta da volta: o codinome guardado não pôde voltar e veio um novo. */
  codinome_trocado?: boolean;
}

export const NOME_PUBLICO_MINIMO = 2;
export const NOME_PUBLICO_MAXIMO = 60;

/** Tira espaços repetidos e das pontas. */
export const arrumarNomePublico = (nome: string): string => nome.replace(/\s+/g, " ").trim();

/** Sem acento e em minúsculas, para comparar (espelho de interno.rede_chave). */
const chave = (texto: string): string =>
  arrumarNomePublico(texto)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export type ProblemaDoNome = "curto" | "longo" | "formato" | "reservado";

/**
 * O que impede este nome de ser um nome público, ou nulo se serve: 2 a 60 caracteres; letras (de qualquer alfabeto), espaço,
 * ponto, apóstrofo e hífen; começa por letra; sem endereço, sem @ e sem número; não se passa pelo Instituto nem pela equipe.
 */
export function problemaDoNomePublico(bruto: string): ProblemaDoNome | null {
  const nome = arrumarNomePublico(bruto);
  if ([...nome].length < NOME_PUBLICO_MINIMO) return "curto";
  if ([...nome].length > NOME_PUBLICO_MAXIMO) return "longo";
  if (!/^\p{L}[\p{L} .'’-]*[\p{L}.]$/u.test(nome) || /(https?|www\.)/i.test(nome)) return "formato";
  if (/(instituto lucia|alumia|moderac|mediac|coordenac|administra|equipe oficial|suporte)/.test(chave(nome))) return "reservado";
  return null;
}

export const nomePublicoValido = (nome: string): boolean => problemaDoNomePublico(nome) === null;

// ───────────────────────────── A foto ─────────────────────────────

/** O lado, em pixels, da foto guardada (quadrada). */
export const LADO_DA_FOTO = 240;
/** O máximo de caracteres da data URL que o banco aceita. */
export const LIMITE_DA_FOTO = 40000;
/** O maior arquivo que a tela abre para recortar (12 MB). */
export const PESO_MAXIMO_DO_ARQUIVO = 12 * 1024 * 1024;
/** Os tipos de arquivo aceitos para recortar. GIF e SVG ficam de fora (animação e código). */
export const tipoDeFotoAceito = (tipo: string): boolean => /^image\/(jpeg|png|webp|avif)$/i.test(tipo);

/** O recorte: `zoom` de 1 (a foto inteira no lado menor) a 4; `x` e `y` de -1 a 1, o quanto o quadro anda na sobra de cada eixo. */
export interface Recorte {
  zoom: number;
  x: number;
  y: number;
}

export const RECORTE_INICIAL: Recorte = { zoom: 1, x: 0, y: 0 };
export const ZOOM_MAXIMO = 4;

const entre = (v: number, min: number, max: number, semValor: number) => (Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : semValor);

export const limitarRecorte = (r: Recorte): Recorte => ({ zoom: entre(r.zoom, 1, ZOOM_MAXIMO, 1), x: entre(r.x, -1, 1, 0), y: entre(r.y, -1, 1, 0) });

/** O quadrado da imagem original (em pixels dela) que o recorte pega: sempre inteiro dentro da imagem. */
export function quadroDoRecorte(largura: number, altura: number, recorte: Recorte): { sx: number; sy: number; lado: number } {
  const r = limitarRecorte(recorte);
  const lado = Math.min(largura, altura) / r.zoom;
  const sx = ((largura - lado) / 2) * (1 + r.x);
  const sy = ((altura - lado) / 2) * (1 + r.y);
  return { sx, sy, lado };
}

/**
 * Os bytes são um WebP simples, sem EXIF, XMP, perfil de cor nem animação? Espelho de interno.rede3_perfil_webp_ok: cabeçalho
 * RIFF/WEBP, tamanho declarado igual ao do arquivo, e a lista de pedaços. É por esses pedaços que GPS, modelo da câmera e data
 * viajariam; o canvas do navegador não os grava, e isto confere antes de enviar.
 */
export function webpSemMetadados(b: Uint8Array): boolean {
  const n = b.length;
  const texto = (de: number) => String.fromCharCode(b[de], b[de + 1], b[de + 2], b[de + 3]);
  const u32 = (de: number) => b[de] + b[de + 1] * 256 + b[de + 2] * 65536 + b[de + 3] * 16777216;
  if (n < 20 || texto(0) !== "RIFF" || texto(8) !== "WEBP") return false;
  if (u32(4) + 8 !== n) return false;
  let pos = 12;
  let viu = false;
  while (pos + 8 <= n) {
    const quatro = texto(pos);
    const tam = u32(pos + 4);
    if (tam > n) return false;
    if (["EXIF", "XMP ", "ICCP", "ANIM", "ANMF"].includes(quatro)) return false;
    if (quatro === "VP8X") {
      if (tam < 10 || pos + 9 > n) return false;
      // bits do VP8X: 0x20 perfil de cor, 0x08 EXIF, 0x04 XMP, 0x02 animação
      if ((b[pos + 8] & (32 | 8 | 4 | 2)) !== 0) return false;
    }
    if (quatro === "VP8 " || quatro === "VP8L") viu = true;
    pos += 8 + tam + (tam % 2);
  }
  return viu && pos === n;
}

/** A data URL serve para enviar? WebP em base64, dentro do limite e sem metadados nos bytes. */
export function fotoAceitavel(dados: string | null | undefined, limite = LIMITE_DA_FOTO): boolean {
  if (typeof dados !== "string" || dados.length > limite || !/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/.test(dados)) return false;
  try {
    const binario = atob(dados.slice(23));
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
    return webpSemMetadados(bytes);
  } catch {
    return false;
  }
}

// ───────────────────────────── A intenção marcada no cadastro ─────────────────────────────

/**
 * No cadastro a pessoa pode marcar que quer aparecer com nome e foto. Nada vai ao servidor nessa hora (a triagem só vê codinome):
 * a marca fica neste aparelho e, depois de aprovada, a rede lembra UMA vez e abre a tela da escolha. Recusar apaga a marca.
 */
export const CHAVE_DA_INTENCAO = "alumia:identidade:quero-publica";
