// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A conferência antes de postar: o que a marca pede (contraste, letra que se lê no celular, cores da paleta) e o
// que costuma escapar (texto saindo da página ou caindo atrás dos botões do Instagram, texto de exemplo esquecido,
// imagem sem crédito ou pequena demais, legenda longa, página sem texto alternativo).

import { caixa, type Camada, type CamadaTexto, comVariaveis, diagramar, type Documento, imagemPronta, PALETA, tamanhoQueCabe, tipoDoInstagram, zonasDoInstagram } from "./motor";
import { LIMITE_DA_LEGENDA, type Projeto, variaveisDaPagina } from "./projeto";
import { semMarcas } from "./texto-rico";

export interface Problema {
  nivel: "erro" | "aviso" | "dica";
  /** Índice da página (0 a n-1); -1 para o projeto todo (legenda). */
  pagina: number;
  camada?: string;
  mensagem: string;
}

/** Textos dos modelos e dos botões de acrescentar que ninguém deve publicar. */
const EXEMPLOS = ["Escreva aqui", "cole aqui o QR", "Um título que fala alto", "Uma linha que explica o título.", "Escreva aqui. O texto quebra sozinho"];

function luminancia(cor: string): number | null {
  const m = /^#([0-9a-f]{6})$/i.exec(cor.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const canal = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
}
/** O contraste entre duas cores, de 1 a 21 (a WCAG pede 4,5 para texto comum e 3 para texto grande). */
export function contraste(a: string, b: string): number | null {
  const la = luminancia(a);
  const lb = luminancia(b);
  if (la === null || lb === null) return null;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** A cor que está atrás do centro da camada: a forma ou tarja logo abaixo, senão o fundo da página. */
function corAtras(doc: Documento, c: Camada): string | null {
  const i = doc.camadas.findIndex((k) => k.id === c.id);
  const b = caixa(c);
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  if (c.tipo === "texto" && c.fundo) return c.fundo;
  for (let j = i - 1; j >= 0; j--) {
    const k = doc.camadas[j];
    if (k.oculta || k.opacidade < 0.6) continue;
    const kb = caixa(k);
    if (cx < kb.x || cx > kb.x + kb.w || cy < kb.y || cy > kb.y + kb.h) continue;
    if (k.tipo === "imagem") return null; // foto atrás: não dá para saber
    if (k.tipo === "texto") {
      if (k.fundo) return k.fundo;
      continue;
    }
    if (k.tipo === "retangulo" || k.tipo === "elipse" || k.tipo === "escudo" || k.tipo === "triangulo") {
      if (k.gradiente) return null;
      if (k.preenchimento && k.preenchimento !== "transparent") return k.preenchimento;
    }
  }
  return doc.fundo.gradiente ? null : doc.fundo.cor;
}

const NA_PALETA = new Set(PALETA.map(([, cor]) => cor.toLowerCase()));
function coresDaCamada(c: Camada): string[] {
  if (c.tipo === "texto") return [c.cor, c.fundo, c.destaque ?? "", c.contorno ?? "", c.sombra ?? ""];
  if (c.tipo === "imagem") return [c.borda, c.corMeioTom ?? ""];
  if (c.tipo === "marca") return [c.cor, c.variante === "circulo" ? c.fundo : ""];
  if (c.tipo === "elemento") return [c.cor, c.fundo];
  return [c.preenchimento, c.borda];
}

/** Confere uma página. A largura de referência para "letra pequena" é a de um post (1080). */
export function conferirPagina(doc: Documento, indice: number, paletaDaCampanha: string[] = []): Problema[] {
  const saida: Problema[] = [];
  const k = doc.w / 1080;
  const instagram = tipoDoInstagram(doc);
  const zonas = zonasDoInstagram(doc).filter((z) => z.nome || z.w > 0);
  const extra = new Set(paletaDaCampanha.map((c) => c.toLowerCase()));
  const visiveis = doc.camadas.filter((c) => !c.oculta && !c.soGuia);
  if (!visiveis.length) saida.push({ nivel: "erro", pagina: indice, mensagem: "A página está vazia." });
  const foraDaPaleta = new Set<string>();
  for (const c of visiveis) {
    const nome = c.tipo === "texto" ? `“${semMarcas(comVariaveis(c.texto)).split("\n")[0].slice(0, 32)}”` : c.nome || "";
    const b = caixa(c);
    const folga = 2;
    if (b.x < -folga || b.y < -folga || b.x + b.w > doc.w + folga || b.y + b.h > doc.h + folga) {
      const cheia = b.w >= doc.w * 0.9 || b.h >= doc.h * 0.9 || c.tipo === "imagem" || c.tipo === "elemento" || (c.tipo !== "texto" && c.tipo !== "marca");
      if (!cheia) saida.push({ nivel: "aviso", pagina: indice, camada: c.id, mensagem: `${nome || "Uma camada"} passa da borda da página e vai sair cortado.` });
    }
    for (const cor of coresDaCamada(c)) {
      const limpa = cor.trim().toLowerCase();
      if (/^#[0-9a-f]{6}$/.test(limpa) && !NA_PALETA.has(limpa) && !extra.has(limpa)) foraDaPaleta.add(limpa);
    }
    if (c.tipo === "texto") {
      const texto = semMarcas(comVariaveis(c.texto));
      if (EXEMPLOS.some((e) => texto.startsWith(e))) saida.push({ nivel: "erro", pagina: indice, camada: c.id, mensagem: `Texto de exemplo ainda na arte: ${nome}.` });
      if (/\{[\p{L}_]+\}/u.test(comVariaveis(c.texto))) saida.push({ nivel: "aviso", pagina: indice, camada: c.id, mensagem: `Variável sem valor em ${nome}: preencha em Texto › Variáveis.` });
      const tamanho = tamanhoQueCabe(c);
      const minimo = (instagram ? 24 : 18) * k;
      if (tamanho < minimo) saida.push({ nivel: "aviso", pagina: indice, camada: c.id, mensagem: `Letra pequena demais para ler no celular em ${nome} (${Math.round(tamanho / k)} pt num post; o mínimo é ${instagram ? 24 : 18}).` });
      if (diagramar(c as CamadaTexto, undefined, tamanho).estourou) saida.push({ nivel: "aviso", pagina: indice, camada: c.id, mensagem: `Uma palavra não cabe na largura da caixa em ${nome}: alargue a caixa, diminua a letra ou ligue a hifenização.` });
      const atras = corAtras(doc, c);
      if (atras && !c.vazado) {
        const r = contraste(c.cor, atras);
        const grande = tamanho >= 40 * k || (tamanho >= 30 * k && c.peso >= 700);
        if (r !== null && r < (grande ? 3 : 4.5)) saida.push({ nivel: "aviso", pagina: indice, camada: c.id, mensagem: `Pouco contraste em ${nome} (${r.toFixed(1)} : 1; o mínimo é ${grande ? 3 : 4.5} : 1).` });
      }
      for (const z of zonas) {
        if (b.x < z.x + z.w && b.x + b.w > z.x && b.y < z.y + z.h && b.y + b.h > z.y) {
          saida.push({ nivel: "aviso", pagina: indice, camada: c.id, mensagem: `${nome} cai na área “${z.nome || "Corte da grade do perfil (3:4)"}” do Instagram.` });
          break;
        }
      }
    }
    if (c.tipo === "imagem") {
      if (!c.credito.trim()) saida.push({ nivel: "dica", pagina: indice, camada: c.id, mensagem: `Imagem sem crédito (${c.nome || "Imagem"}): se não for sua, escreva autor e licença.` });
      const img = imagemPronta(c.src);
      if (img) {
        const zoom = c.enquadre?.zoom ?? 1;
        const corte = c.recorte ? Math.min(c.recorte.w, c.recorte.h) : 1;
        const precisa = (Math.max(c.w / img.naturalWidth, c.h / img.naturalHeight) * zoom) / corte;
        if (precisa > 1.6) saida.push({ nivel: "aviso", pagina: indice, camada: c.id, mensagem: `A imagem ${c.nome || ""} é pequena para o tamanho em que está: pode sair borrada.` });
      }
    }
  }
  for (const cor of foraDaPaleta) saida.push({ nivel: "dica", pagina: indice, mensagem: `Cor fora da paleta da marca: ${cor}. Use a paleta ou guarde a cor na paleta da campanha.` });
  if (!doc.alt?.trim() && instagram) saida.push({ nivel: "aviso", pagina: indice, mensagem: "Falta o texto alternativo (para quem usa leitor de tela)." });
  if (doc.camadas.some((c) => c.soGuia && !c.oculta)) saida.push({ nivel: "dica", pagina: indice, mensagem: "As guias de figurinha não saem na exportação: lembre de pôr a figurinha no Instagram." });
  return saida;
}

/** Confere o projeto todo: cada página e a legenda. */
export function conferirProjeto(p: Projeto, comLegenda = true): Problema[] {
  const saida: Problema[] = [];
  p.paginas.forEach((doc, i) => {
    // As variáveis da página ({pagina}, {total}) valem durante a conferência dela.
    const vars = variaveisDaPagina(p, i);
    const comVars = { ...doc, camadas: doc.camadas.map((c) => (c.tipo === "texto" ? { ...c, texto: comVariaveis(c.texto, vars) } : c)) };
    saida.push(...conferirPagina(comVars, i, p.paleta));
  });
  if (comLegenda) {
    const legenda = p.legenda.trim();
    if (!legenda) saida.push({ nivel: "aviso", pagina: -1, mensagem: "A legenda do post está vazia." });
    if (legenda.length > LIMITE_DA_LEGENDA) saida.push({ nivel: "erro", pagina: -1, mensagem: `A legenda passa de ${LIMITE_DA_LEGENDA} caracteres (tem ${legenda.length}).` });
    const hashtags = legenda.match(/#[\p{L}\p{N}_]+/gu) ?? [];
    if (hashtags.length > 30) saida.push({ nivel: "erro", pagina: -1, mensagem: `Mais de 30 hashtags (${hashtags.length}): o Instagram recusa o post.` });
    const mencoes = legenda.match(/@[\w.]+/g) ?? [];
    if (mencoes.length > 20) saida.push({ nivel: "aviso", pagina: -1, mensagem: `Mais de 20 menções (${mencoes.length}).` });
    if (p.paginas.length > 20) saida.push({ nivel: "erro", pagina: -1, mensagem: "O carrossel do Instagram aceita até 20 páginas." });
    if (p.paginas.length > 1 && !p.paginas.some((d) => d.camadas.some((c) => c.tipo === "texto" && c.texto.includes("{pagina}")))) saida.push({ nivel: "dica", pagina: -1, mensagem: "Carrossel sem numeração: use {pagina} / {total} num texto para numerar sozinho." });
  }
  return saida;
}

/** Os créditos de todas as imagens, sem repetir, para a legenda ou o rodapé. */
export function creditosDo(p: Projeto): string[] {
  const vistos = new Set<string>();
  for (const doc of p.paginas) for (const c of doc.camadas) if (c.tipo === "imagem" && c.credito.trim()) vistos.add(c.credito.trim());
  return [...vistos];
}
