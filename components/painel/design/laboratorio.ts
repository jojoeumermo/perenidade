// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O laboratório público de design (no site, sem conta) usa o mesmo estúdio, mas nada do instituto sai de lá: os
// modelos são outros (genéricos, com outras cores, sem a marca, sem certificado, crachá ou qualquer documento que
// pareça oficial), a marca não é desenhada, as variáveis não apontam para o site e uma arte que cite o nome do
// instituto não é exportada. Material do instituto se faz no painel, pela equipe, com revisão; assim ninguém usa o
// laboratório para falsificar um certificado ou um cartaz "oficial".

import type { GrupoDeModelo, Modelo } from "./modelos";
import { type Camada, type Documento, elemento, forma, texto } from "./motor";
import type { Projeto } from "./projeto";

/** As variáveis de uma arte nova no laboratório: exemplos, sem o endereço nem o perfil do instituto. */
export const VARIAVEIS_DO_LABORATORIO: Record<string, string> = { link: "seusite.com.br", arroba: "@seuperfil", data: "12 de abril", hora: "19h", local: "Praça Central" };

/** As cores dos modelos do laboratório: de propósito, longe do pergaminho, do bordô e do vermelho do instituto. */
const C = {
  petroleo: "#0f4c5c",
  areia: "#f3ead7",
  coral: "#e36414",
  marinho: "#1d3557",
  gelo: "#f1faee",
  morango: "#e63946",
  menta: "#a8dadc",
  musgo: "#386641",
  creme: "#fefae0",
  mostarda: "#e9c46a",
  uva: "#5a189a",
  lilas: "#e0c3fc",
  grafite: "#22223b",
  branco: "#ffffff",
};

const base = (w: number, h: number, cor: string, extra: Partial<Documento["fundo"]> = {}): Documento => ({
  v: 1,
  w,
  h,
  fundo: { cor, pontilhado: false, bordaCima: "", bordaBaixo: "", espessura: 0, ...extra },
  camadas: [],
});
const pagina = (w: number, h: number, cor: string, camadas: Camada[], extra: Partial<Documento["fundo"]> = {}): Documento => ({ ...base(w, h, cor, extra), camadas });

function passo(numero: string, titulo: string, corpo: string): Documento {
  return pagina(1080, 1350, C.creme, [
    texto({ x: 88, y: 92, w: 600, texto: "Horta em casa", fonte: "mono", tamanho: 22, peso: 500, cor: C.musgo, espacamento: 0.2, maiusculas: true, nome: "Etiqueta" }),
    texto({ x: 540, y: 92, w: 452, texto: "{pagina} / {total}", fonte: "mono", tamanho: 22, peso: 500, cor: C.musgo, alinhar: "right", espacamento: 0.2, nome: "Numeração" }),
    texto({ x: 88, y: 250, w: 400, texto: numero, fonte: "sans", tamanho: 260, peso: 900, cor: C.mostarda, entrelinha: 0.9, nome: "Número" }),
    texto({ x: 88, y: 560, w: 904, texto: titulo, fonte: "sans", tamanho: 92, peso: 800, cor: C.musgo, entrelinha: 0.98, espacamento: -0.02, nome: "Título", estilo: "titulo" }),
    texto({ x: 88, y: 860, w: 860, texto: corpo, fonte: "serifa", tamanho: 42, peso: 400, cor: C.grafite, entrelinha: 1.28, nome: "Texto", estilo: "subtitulo" }),
    elemento({ x: 840, y: 1150, w: 150, h: 150, desenho: "icone", icone: "trigo", cor: C.musgo, espessura: 1.4, nome: "Ícone" }),
  ]);
}

export const MODELOS_DO_LABORATORIO: Modelo[] = [
  {
    id: "lab-evento",
    nome: "Evento (sarau na praça)",
    formato: "post",
    grupo: "Posts",
    montar: () =>
      pagina(1080, 1350, C.petroleo, [
        elemento({ x: 540, y: -200, w: 900, h: 900, desenho: "raios-traco", cor: C.coral, opacidade: 0.35, nome: "Raios" }),
        texto({ x: 88, y: 110, w: 360, texto: "Evento aberto", fonte: "sans", tamanho: 24, peso: 800, cor: C.petroleo, fundo: C.areia, recuo: 14, alinhar: "center", espacamento: 0.1, maiusculas: true, nome: "Etiqueta" }),
        texto({ x: 88, y: 380, w: 904, texto: "Sarau\nna praça", fonte: "sans", tamanho: 190, peso: 900, cor: C.areia, entrelinha: 0.88, espacamento: -0.03, nome: "Título", estilo: "titulo" }),
        texto({ x: 88, y: 800, w: 820, texto: "Poesia, música e ==microfone aberto==. Traga um amigo e um texto para ler.", fonte: "serifa", tamanho: 46, peso: 400, cor: C.areia, destaque: C.coral, entrelinha: 1.22, nome: "Texto", estilo: "subtitulo" }),
        forma("linha", { x: 88, y: 1080, w: 904, h: 4, preenchimento: C.coral, espessura: 3, nome: "Fio" }),
        texto({ x: 88, y: 1120, w: 904, texto: "{data} · {hora} · {local}", fonte: "mono", tamanho: 30, peso: 500, cor: C.areia, espacamento: 0.06, nome: "Quando e onde" }),
        texto({ x: 88, y: 1210, w: 904, texto: "{arroba}", fonte: "mono", tamanho: 24, peso: 500, cor: C.menta, espacamento: 0.1, nome: "Perfil" }),
      ]),
  },
  {
    id: "lab-dicas",
    nome: "Lista de dicas",
    formato: "post",
    grupo: "Posts",
    montar: () =>
      pagina(1080, 1350, C.gelo, [
        forma("retangulo", { x: 0, y: 0, w: 1080, h: 24, preenchimento: C.morango, nome: "Faixa" }),
        texto({ x: 88, y: 150, w: 904, texto: "3 dicas para\nestudar melhor", fonte: "serifa", tamanho: 110, peso: 700, cor: C.marinho, entrelinha: 0.98, espacamento: -0.02, nome: "Título", estilo: "titulo" }),
        texto({
          x: 88,
          y: 520,
          w: 860,
          texto: "Estude em blocos de 25 minutos e descanse 5.\nExplique o assunto em voz alta, como se ensinasse.\nRevise no dia seguinte, antes de esquecer.",
          fonte: "sans",
          tamanho: 44,
          peso: 500,
          cor: C.marinho,
          entrelinha: 1.35,
          marcador: "numero",
          destaque: C.morango,
          nome: "Lista",
        }),
        texto({ x: 88, y: 1180, w: 700, texto: "Salve para não esquecer", fonte: "manuscrita", tamanho: 56, peso: 600, cor: C.morango, nome: "Chamada" }),
        elemento({ x: 790, y: 1090, w: 200, h: 200, desenho: "seta-mao", cor: C.morango, rot: 180, nome: "Seta" }),
      ]),
  },
  {
    id: "lab-feira",
    nome: "Feira de trocas",
    formato: "post",
    grupo: "Posts",
    montar: () =>
      pagina(1080, 1350, C.mostarda, [
        elemento({ x: 70, y: 420, w: 940, h: 300, desenho: "pincelada", cor: C.creme, nome: "Pincelada" }),
        texto({ x: 88, y: 120, w: 904, texto: "Traga o que não usa,\nleve o que precisa.", fonte: "serifa", tamanho: 52, peso: 500, italico: true, cor: C.grafite, entrelinha: 1.15, nome: "Chamada" }),
        texto({ x: 100, y: 450, w: 880, texto: "FEIRA DE\nTROCAS", fonte: "sans", tamanho: 150, peso: 900, cor: C.grafite, alinhar: "center", entrelinha: 0.88, espacamento: -0.02, nome: "Título", estilo: "titulo" }),
        texto({ x: 88, y: 860, w: 904, texto: "Livros\nRoupas\nBrinquedos\nPlantas", fonte: "sans", tamanho: 44, peso: 700, cor: C.grafite, entrelinha: 1.3, marcador: "ponto", destaque: C.coral, nome: "Lista" }),
        texto({ x: 560, y: 1200, w: 432, texto: "{data} · {local}", fonte: "mono", tamanho: 26, peso: 500, cor: C.grafite, alinhar: "right", nome: "Quando e onde" }),
      ]),
  },
  {
    id: "lab-frase",
    nome: "Frase (quadrado)",
    formato: "quadrado",
    grupo: "Posts",
    montar: () =>
      pagina(1080, 1080, C.uva, [
        texto({ x: 88, y: 60, w: 300, texto: "“", fonte: "serifa", tamanho: 320, peso: 700, cor: C.lilas, entrelinha: 1, nome: "Aspas" }),
        texto({ x: 88, y: 330, w: 904, texto: "Escreva aqui uma frase curta que valha a pena guardar.", fonte: "serifa", tamanho: 78, peso: 500, italico: true, cor: C.branco, entrelinha: 1.12, nome: "Frase", estilo: "titulo" }),
        texto({ x: 88, y: 860, w: 904, texto: "— Nome de quem disse", fonte: "sans", tamanho: 34, peso: 700, cor: C.lilas, espacamento: 0.04, nome: "Autoria" }),
      ]),
  },
  {
    id: "lab-story-contagem",
    nome: "Contagem regressiva",
    formato: "story",
    grupo: "Stories",
    montar: () =>
      pagina(1080, 1920, C.marinho, [
        texto({ x: 88, y: 360, w: 904, texto: "Faltam", fonte: "sans", tamanho: 80, peso: 800, cor: C.menta, alinhar: "center", maiusculas: true, espacamento: 0.08, nome: "Antes" }),
        texto({ x: 88, y: 500, w: 904, texto: "3", fonte: "sans", tamanho: 560, peso: 900, cor: C.gelo, alinhar: "center", entrelinha: 0.9, nome: "Número", anim: { tipo: "crescer", inicio: 0.2, duracao: 0.8 } }),
        texto({ x: 88, y: 1060, w: 904, texto: "dias para o lançamento", fonte: "serifa", tamanho: 70, peso: 500, italico: true, cor: C.gelo, alinhar: "center", nome: "Depois" }),
        texto({ x: 240, y: 1500, w: 600, texto: "Ative o lembrete", fonte: "sans", tamanho: 34, peso: 800, cor: C.marinho, fundo: C.morango, recuo: 22, alinhar: "center", maiusculas: true, espacamento: 0.06, nome: "Chamada" }),
      ]),
  },
  {
    id: "lab-story-pergunta",
    nome: "Caixa de perguntas",
    formato: "story",
    grupo: "Stories",
    montar: () =>
      pagina(1080, 1920, C.coral, [
        texto({ x: 88, y: 380, w: 904, texto: "Me pergunte\nqualquer\ncoisa", fonte: "sans", tamanho: 130, peso: 900, cor: C.areia, entrelinha: 0.92, espacamento: -0.02, nome: "Título", estilo: "titulo" }),
        texto({ x: 88, y: 860, w: 820, texto: "Respondo as melhores amanhã, às {hora}.", fonte: "serifa", tamanho: 52, peso: 400, cor: C.areia, entrelinha: 1.2, nome: "Texto" }),
        elemento({ x: 190, y: 1180, w: 700, h: 300, desenho: "figurinha", conteudo: "Caixa de perguntas", soGuia: true, nome: "Guia da figurinha" }),
      ]),
  },
  {
    id: "lab-carrossel",
    nome: "Carrossel passo a passo (5 páginas)",
    formato: "carrossel",
    grupo: "Carrossel",
    montar: () =>
      pagina(1080, 1350, C.musgo, [
        texto({ x: 540, y: 92, w: 452, texto: "{pagina} / {total}", fonte: "mono", tamanho: 22, peso: 500, cor: C.creme, alinhar: "right", espacamento: 0.2, nome: "Numeração" }),
        texto({ x: 88, y: 330, w: 904, texto: "Como montar\numa horta\nem casa", fonte: "sans", tamanho: 140, peso: 900, cor: C.creme, entrelinha: 0.92, espacamento: -0.03, nome: "Título", estilo: "titulo" }),
        texto({ x: 88, y: 860, w: 820, texto: "Três passos, pouco espaço e nenhum gasto grande.", fonte: "serifa", tamanho: 46, peso: 400, cor: C.creme, entrelinha: 1.22, nome: "Texto", estilo: "subtitulo" }),
        texto({ x: 560, y: 1220, w: 432, texto: "Arraste para o lado →", fonte: "sans", tamanho: 24, peso: 800, cor: C.mostarda, alinhar: "right", maiusculas: true, espacamento: 0.08, nome: "Chamada" }),
      ]),
    paginas: () => [
      MODELOS_DO_LABORATORIO.find((m) => m.id === "lab-carrossel")!.montar(),
      passo("1", "Escolha um canto com sol", "Quatro horas de sol por dia bastam para temperos como cebolinha, salsa e manjericão."),
      passo("2", "Reaproveite potes", "Garrafas, latas e caixas viram vasos: faça furos no fundo para a água escorrer."),
      passo("3", "Regue pouco e sempre", "Terra úmida, nunca encharcada. De manhã cedo é o melhor horário."),
      pagina(1080, 1350, C.mostarda, [
        texto({ x: 540, y: 92, w: 452, texto: "{pagina} / {total}", fonte: "mono", tamanho: 22, peso: 500, cor: C.grafite, alinhar: "right", espacamento: 0.2, nome: "Numeração" }),
        texto({ x: 88, y: 420, w: 904, texto: "Gostou?\nSalve e mande\npara alguém.", fonte: "sans", tamanho: 120, peso: 900, cor: C.grafite, entrelinha: 0.95, espacamento: -0.02, nome: "Título" }),
        texto({ x: 88, y: 1000, w: 904, texto: "Mais dicas em {arroba}", fonte: "mono", tamanho: 32, peso: 500, cor: C.grafite, nome: "Perfil" }),
      ]),
    ],
  },
  {
    id: "lab-cartaz",
    nome: "Cartaz A4: feira de ciências",
    formato: "cartaz-a4",
    grupo: "Impressos",
    montar: () =>
      pagina(1240, 1754, C.gelo, [
        forma("elipse", { x: 640, y: -180, w: 820, h: 820, preenchimento: C.menta, nome: "Círculo" }),
        forma("elipse", { x: 860, y: 240, w: 260, h: 260, preenchimento: C.morango, nome: "Círculo pequeno" }),
        texto({ x: 100, y: 120, w: 600, texto: "Entrada livre", fonte: "mono", tamanho: 28, peso: 600, cor: C.marinho, espacamento: 0.2, maiusculas: true, nome: "Etiqueta" }),
        texto({ x: 100, y: 560, w: 1040, texto: "Feira de\nCiências", fonte: "serifa", tamanho: 200, peso: 700, cor: C.marinho, entrelinha: 0.9, espacamento: -0.02, nome: "Título", estilo: "titulo" }),
        texto({ x: 100, y: 1010, w: 900, texto: "Experimentos, robôs de sucata e uma oficina de foguetes de garrafa para todas as idades.", fonte: "sans", tamanho: 44, peso: 500, cor: C.marinho, entrelinha: 1.3, nome: "Texto", estilo: "subtitulo" }),
        forma("retangulo", { x: 100, y: 1340, w: 1040, h: 240, preenchimento: C.marinho, raio: 24, nome: "Caixa" }),
        texto({ x: 150, y: 1385, w: 700, texto: "{data}\n{hora} · {local}", fonte: "sans", tamanho: 50, peso: 800, cor: C.gelo, entrelinha: 1.25, nome: "Quando e onde" }),
        elemento({ x: 920, y: 1370, w: 180, h: 180, desenho: "qr", conteudo: "https://exemplo.org", cor: C.marinho, fundo: C.gelo, nome: "QR" }),
      ]),
  },
  {
    id: "lab-folheto",
    nome: "Folheto A5: aulas de violão",
    formato: "folheto-a5",
    grupo: "Impressos",
    montar: () =>
      pagina(874, 1240, C.grafite, [
        texto({ x: 70, y: 90, w: 734, texto: "Turmas para iniciantes", fonte: "mono", tamanho: 22, peso: 500, cor: C.mostarda, espacamento: 0.2, maiusculas: true, nome: "Etiqueta" }),
        texto({ x: 70, y: 170, w: 734, texto: "Aulas de\nviolão", fonte: "serifa", tamanho: 140, peso: 700, italico: true, cor: C.creme, entrelinha: 0.92, nome: "Título", estilo: "titulo" }),
        texto({ x: 70, y: 560, w: 700, texto: "Sem precisar saber nada\nViolão emprestado na aula\nTurmas de manhã e à noite", fonte: "sans", tamanho: 34, peso: 600, cor: C.creme, entrelinha: 1.45, marcador: "estrela", destaque: C.mostarda, nome: "Lista" }),
        forma("linha", { x: 70, y: 1010, w: 734, h: 3, preenchimento: C.mostarda, espessura: 2, nome: "Fio" }),
        texto({ x: 70, y: 1050, w: 734, texto: "Inscrições: {link}", fonte: "sans", tamanho: 32, peso: 800, cor: C.mostarda, nome: "Inscrições" }),
        texto({ x: 70, y: 1110, w: 734, texto: "{local}", fonte: "mono", tamanho: 22, peso: 500, cor: C.creme, nome: "Local" }),
      ]),
  },
  {
    id: "lab-convite",
    nome: "Convite de festa",
    formato: "convite",
    grupo: "Impressos",
    montar: () =>
      pagina(1500, 2100, C.creme, [
        forma("retangulo", { x: 60, y: 60, w: 1380, h: 1980, preenchimento: "transparent", borda: C.uva, espessura: 6, nome: "Moldura" }),
        elemento({ x: 450, y: 220, w: 600, h: 430, desenho: "louros", cor: C.mostarda, nome: "Louros" }),
        texto({ x: 150, y: 760, w: 1200, texto: "Você está convidado", fonte: "sans", tamanho: 50, peso: 700, cor: C.uva, alinhar: "center", maiusculas: true, espacamento: 0.14, nome: "Chamada" }),
        texto({ x: 150, y: 880, w: 1200, texto: "Festa de\naniversário", fonte: "manuscrita", tamanho: 230, peso: 700, cor: C.uva, alinhar: "center", entrelinha: 0.9, nome: "Título", estilo: "titulo" }),
        texto({ x: 150, y: 1430, w: 1200, texto: "{data} · {hora}\n{local}", fonte: "serifa", tamanho: 72, peso: 500, cor: C.grafite, alinhar: "center", entrelinha: 1.3, nome: "Quando e onde" }),
        texto({ x: 150, y: 1800, w: 1200, texto: "Confirme presença até a véspera", fonte: "serifa", tamanho: 44, peso: 400, italico: true, cor: C.grafite, alinhar: "center", nome: "Confirmação" }),
      ]),
  },
  {
    id: "lab-miniatura",
    nome: "Miniatura de vídeo",
    formato: "video",
    grupo: "Site e vídeo",
    montar: () =>
      pagina(1280, 720, C.morango, [
        forma("retangulo", { x: 700, y: 60, w: 520, h: 600, preenchimento: C.gelo, raio: 28, rot: 3, nome: "Lugar da foto" }),
        texto({ x: 760, y: 330, w: 400, texto: "Sua foto aqui", fonte: "sans", tamanho: 36, peso: 700, cor: C.marinho, alinhar: "center", rot: 3, nome: "Aviso da foto" }),
        texto({ x: 60, y: 140, w: 640, texto: "COMO\nFAZER\nPÃO", fonte: "sans", tamanho: 150, peso: 900, cor: C.gelo, entrelinha: 0.86, espacamento: -0.02, sombra: C.marinho, sombraX: 8, sombraY: 8, nome: "Título", estilo: "titulo" }),
        texto({ x: 60, y: 610, w: 600, texto: "em 10 minutos", fonte: "manuscrita", tamanho: 64, peso: 700, cor: C.mostarda, nome: "Detalhe" }),
      ]),
  },
  {
    id: "lab-cartao-link",
    nome: "Cartão de link (artigo)",
    formato: "banner",
    grupo: "Site e vídeo",
    montar: () =>
      pagina(1200, 630, C.areia, [
        forma("retangulo", { x: 0, y: 0, w: 24, h: 630, preenchimento: C.petroleo, nome: "Faixa" }),
        texto({ x: 90, y: 90, w: 900, texto: "Blog · Leitura de 5 min", fonte: "mono", tamanho: 24, peso: 500, cor: C.coral, espacamento: 0.14, maiusculas: true, nome: "Etiqueta" }),
        texto({ x: 90, y: 170, w: 1000, texto: "O título do seu artigo cabe em duas linhas", fonte: "serifa", tamanho: 72, peso: 700, cor: C.petroleo, entrelinha: 1.02, nome: "Título", estilo: "titulo" }),
        texto({ x: 90, y: 520, w: 900, texto: "{link}", fonte: "mono", tamanho: 26, peso: 500, cor: C.petroleo, nome: "Endereço" }),
      ]),
  },
];

export const GRUPOS_DO_LABORATORIO: GrupoDeModelo[] = ["Posts", "Stories", "Carrossel", "Impressos", "Site e vídeo"];

const VALORES_DO_INSTITUTO = new Set(["institutolucia.org", "@institutoluciaorg"]);

/** Uma arte aberta no laboratório: sem a marca do instituto e com as variáveis de exemplo no lugar das dele. */
export function paraOLaboratorio(p: Projeto): Projeto {
  const variaveis: Record<string, string> = {};
  for (const [k, v] of Object.entries(p.variaveis)) {
    if (k === "disciplinas" || k === "obras") continue;
    variaveis[k] = VALORES_DO_INSTITUTO.has(v.trim().toLowerCase()) ? (VARIAVEIS_DO_LABORATORIO[k] ?? "") : v;
  }
  return {
    ...p,
    variaveis: { ...VARIAVEIS_DO_LABORATORIO, ...variaveis },
    paginas: p.paginas.map((d) => ({ ...d, camadas: d.camadas.filter((c) => c.tipo !== "marca") })),
  };
}

/** Só as letras, sem acento: "**Instituto** _Lúcia_", "INSTITUTO-LÚCIA" e "institutolucia.org" ficam iguais. */
const letras = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z]/g, "");

/** Se a arte cita o instituto em algum texto (camadas, carimbo, selo, legenda, variáveis, nome ou texto alternativo). */
export function citaOInstituto(p: Projeto): boolean {
  const textos: string[] = [p.legenda, ...Object.values(p.variaveis)];
  for (const d of p.paginas) {
    textos.push(d.nome ?? "", d.alt ?? "");
    for (const c of d.camadas) {
      if (c.tipo === "texto") textos.push(c.texto);
      else if (c.tipo === "elemento") textos.push(c.conteudo, c.conteudo2);
      else if (c.tipo === "imagem") textos.push(c.legendaFoto ?? "", c.credito);
      else if (c.tipo === "marca") return true;
    }
  }
  return textos.some((t) => letras(t ?? "").includes("institutolucia"));
}

export const AVISO_DO_LABORATORIO =
  "O laboratório público não exporta artes com o nome ou a marca do Instituto Lúcia. Material do instituto é feito pela equipe, no painel.";
