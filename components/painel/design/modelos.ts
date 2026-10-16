// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Os modelos prontos do estúdio, tirados do Kit de Lançamento do instituto: posts, stories, carrossel, cartaz,
// avatar e capas, todos com a identidade (pergaminho, tinta, bordô e vermelho da gráfica, a serifa editorial,
// a letra pesada das etiquetas e a monoespaçada dos rodapés). Quem usa troca os textos e as imagens.

import { COR, type Documento, forma, type FormatoId, imagem, marca, texto } from "./motor";

export interface Modelo {
  id: string;
  nome: string;
  formato: FormatoId;
  grupo: "Posts" | "Stories" | "Carrossel" | "Impressos" | "Capas e marca" | "Em branco";
  montar: () => Documento;
}

const base = (w: number, h: number, fundo: Partial<Documento["fundo"]> = {}): Documento => ({ v: 1, w, h, fundo: { cor: COR.Pergaminho, pontilhado: false, bordaCima: "", bordaBaixo: "", espessura: 0, ...fundo }, camadas: [] });

/** O cabeçalho dos posts: a marca com o nome à esquerda, uma etiqueta monoespaçada à direita. */
const cabecalho = (w: number, y: number, etiqueta: string, cor: string, corEtiqueta: string, m = 88) => [
  marca({ x: m, y, w: 64, variante: "nome", cor }),
  texto({ x: w / 2, y: y + 20, w: w / 2 - m, texto: etiqueta, fonte: "mono", tamanho: 21, peso: 500, cor: corEtiqueta, alinhar: "right", espacamento: 0.2, maiusculas: true }),
];
/** A faixa preta de chamada do rodapé, com o endereço em ouro. */
const faixa = (w: number, y: number, h: number, chamada: string, endereco: string, m = 88) => [
  forma("retangulo", { x: m, y, w: w - 2 * m, h, preenchimento: COR.Tinta, nome: "Faixa" }),
  texto({ x: m + 28, y: y + h / 2 - 14, w: (w - 2 * m) * 0.5, texto: chamada, fonte: "sans", tamanho: 22, peso: 800, cor: COR.Pergaminho, espacamento: 0.08, maiusculas: true }),
  texto({ x: w / 2, y: y + h / 2 - 16, w: w / 2 - m - 28, texto: endereco, fonte: "mono", tamanho: 26, peso: 500, cor: COR["Ouro claro"], alinhar: "right" }),
];
const rodapeSite = (w: number, y: number, m = 88) => texto({ x: m, y, w: w / 2, texto: "institutolucia.org", fonte: "mono", tamanho: 21, peso: 500, cor: COR["Bordô"], espacamento: 0.14, maiusculas: true });

export const MODELOS: Modelo[] = [
  {
    id: "post-proposito",
    nome: "Propósito (título grande)",
    formato: "post",
    grupo: "Posts",
    montar: () => {
      const d = base(1080, 1350, { pontilhado: true, bordaCima: COR["Bordô"], bordaBaixo: COR["Bordô"], espessura: 20 });
      d.camadas = [
        ...cabecalho(1080, 72, "Educação popular", COR.Tinta, COR["Bordô"]),
        texto({ x: 88, y: 330, w: 904, texto: "Todo o\nconhecimento,\npara todos,\npara sempre.", fonte: "serifa", tamanho: 138, peso: 600, entrelinha: 0.97, espacamento: -0.02, nome: "Título" }),
        texto({ x: 88, y: 900, w: 840, texto: "Aulas gratuitas, acervo livre e uma comunidade aberta, onde qualquer pessoa pergunta e qualquer pessoa responde.", fonte: "serifa", tamanho: 43, peso: 400, entrelinha: 1.25, cor: COR["Tinta suave"], nome: "Texto de apoio" }),
        texto({ x: 88, y: 1200, w: 180, texto: "De graça", fonte: "sans", tamanho: 20, peso: 800, cor: COR.Pergaminho, fundo: COR.Tinta, recuo: 14, alinhar: "center", espacamento: 0.08, maiusculas: true, nome: "Etiqueta" }),
        rodapeSite(1080, 1214, 600),
      ];
      return d;
    },
  },
  {
    id: "post-no-ar",
    nome: "Estamos no ar (vermelho)",
    formato: "post",
    grupo: "Posts",
    montar: () => {
      const d = base(1080, 1350, { cor: COR["Vermelho da gráfica"], bordaCima: COR.Tinta, bordaBaixo: COR.Tinta, espessura: 20 });
      d.camadas = [
        ...cabecalho(1080, 72, "Lançamento", COR.Branco, COR.Branco),
        texto({ x: 88, y: 420, w: 904, texto: "Estamos\nno ar.", fonte: "serifa", tamanho: 220, peso: 600, entrelinha: 0.9, espacamento: -0.025, cor: COR.Branco, nome: "Título" }),
        texto({ x: 88, y: 860, w: 820, texto: "O Instituto Lúcia abriu as portas. Entre: é de graça.", fonte: "serifa", tamanho: 48, peso: 400, entrelinha: 1.2, cor: COR.Branco, nome: "Texto de apoio" }),
        ...faixa(1080, 1160, 100, "Aulas · Acervo · Jornal · Rádio", "institutolucia.org"),
      ];
      return d;
    },
  },
  {
    id: "post-numeros",
    nome: "Número grande (fundo preto)",
    formato: "post",
    grupo: "Posts",
    montar: () => {
      const d = base(1080, 1350, { cor: COR["Preto de arquivo"], bordaCima: COR.Ouro, bordaBaixo: COR.Ouro, espessura: 20 });
      d.camadas = [
        ...cabecalho(1080, 72, "O acervo", COR.Pergaminho, COR.Ouro),
        texto({ x: 88, y: 300, w: 420, texto: "61", fonte: "serifa", tamanho: 340, peso: 600, entrelinha: 0.8, espacamento: -0.03, cor: COR.Ouro, nome: "Número" }),
        texto({ x: 520, y: 360, w: 480, texto: "disciplinas,\nda alfabetização\nao ensino superior.", fonte: "serifa", tamanho: 58, peso: 500, entrelinha: 1.04, cor: COR.Pergaminho, nome: "Explicação" }),
        forma("linha", { x: 88, y: 700, w: 904, h: 2, preenchimento: "#5c4c30", espessura: 2 }),
        texto({ x: 88, y: 730, w: 700, texto: "Linguagens e artes\nCiências e tecnologia\nHumanidades\nTeoria revolucionária\nLutas do povo", fonte: "serifa", tamanho: 46, peso: 500, entrelinha: 1.6, cor: COR.Pergaminho, nome: "Lista" }),
        texto({ x: 700, y: 730, w: 292, texto: "13\n10\n16\n08\n12", fonte: "mono", tamanho: 28, peso: 500, entrelinha: 2.63, cor: COR.Ouro, alinhar: "right", nome: "Contagens" }),
        texto({ x: 88, y: 1170, w: 600, texto: "E mais de 300 obras livres para ler.", fonte: "serifa", tamanho: 34, peso: 400, italico: true, cor: COR.Fio }),
        texto({ x: 540, y: 1180, w: 452, texto: "institutolucia.org", fonte: "mono", tamanho: 21, peso: 500, cor: COR.Ouro, alinhar: "right", espacamento: 0.14, maiusculas: true }),
      ];
      return d;
    },
  },
  {
    id: "post-lista",
    nome: "Lista com imagem (novidades)",
    formato: "post",
    grupo: "Posts",
    montar: () => {
      const d = base(1080, 1350, { pontilhado: true, bordaCima: COR.Tinta, bordaBaixo: COR.Tinta, espessura: 20 });
      d.camadas = [
        ...cabecalho(1080, 72, "Voluntariado", COR["Bordô"], COR["Bordô"]),
        texto({ x: 88, y: 250, w: 640, texto: "Três funções\nnovas.", fonte: "serifa", tamanho: 150, peso: 600, entrelinha: 0.9, espacamento: -0.025, nome: "Título" }),
        imagem({ x: 756, y: 200, w: 236, h: 354, src: "/imagens/galeria/apsit-um-ano.webp", credito: "Aleksandr Apsit, 1918. Domínio público.", borda: COR.Tinta, espessura: 4, nome: "Imagem" }),
        forma("linha", { x: 88, y: 620, w: 904, h: 2, preenchimento: "rgba(31,26,20,0.3)", espessura: 2 }),
        texto({ x: 88, y: 650, w: 904, texto: "Educador secundário", fonte: "serifa", tamanho: 60, peso: 600, nome: "Item 1" }),
        texto({ x: 88, y: 720, w: 904, texto: "Contribui com materiais e aulas avulsas, sem precisar dar a disciplina inteira.", fonte: "serifa", tamanho: 34, peso: 400, entrelinha: 1.2 }),
        forma("linha", { x: 88, y: 820, w: 904, h: 2, preenchimento: "rgba(31,26,20,0.3)", espessura: 2 }),
        texto({ x: 88, y: 850, w: 904, texto: "Marketing", fonte: "serifa", tamanho: 60, peso: 600, nome: "Item 2" }),
        texto({ x: 88, y: 920, w: 904, texto: "Design e divulgação juntos: cuida do nosso Instagram, com posts e stories.", fonte: "serifa", tamanho: 34, peso: 400, entrelinha: 1.2 }),
        forma("linha", { x: 88, y: 1020, w: 904, h: 2, preenchimento: "rgba(31,26,20,0.3)", espessura: 2 }),
        ...faixa(1080, 1160, 100, "Candidaturas abertas", "institutolucia.org/voluntarios"),
      ];
      return d;
    },
  },
  {
    id: "quadrado-frase",
    nome: "Frase do dia (quadrado)",
    formato: "quadrado",
    grupo: "Posts",
    montar: () => {
      const d = base(1080, 1080, { pontilhado: true, bordaCima: COR["Bordô"], bordaBaixo: COR["Bordô"], espessura: 20 });
      d.camadas = [
        ...cabecalho(1080, 72, "Frase do dia", COR.Tinta, COR["Bordô"]),
        texto({ x: 88, y: 300, w: 904, texto: "“A educação é um ato de amor, por isso, um ato de coragem.”", fonte: "serifa", tamanho: 84, peso: 500, italico: true, entrelinha: 1.08, espacamento: -0.01, nome: "Frase" }),
        texto({ x: 88, y: 800, w: 904, texto: "Paulo Freire, Educação como prática da liberdade (1967)", fonte: "mono", tamanho: 22, peso: 500, cor: COR["Bordô"], espacamento: 0.08, nome: "Autoria" }),
        rodapeSite(1080, 940),
      ];
      return d;
    },
  },
  {
    id: "story-comunidade",
    nome: "Comunidade (pergunta e resposta)",
    formato: "story",
    grupo: "Stories",
    montar: () => {
      const d = base(1080, 1920, { pontilhado: true });
      d.camadas = [
        marca({ x: 88, y: 260, w: 64, variante: "nome", cor: COR.Tinta }),
        texto({ x: 88, y: 480, w: 904, texto: "Comunidade aberta", fonte: "mono", tamanho: 23, peso: 500, cor: COR["Bordô"], espacamento: 0.2, maiusculas: true, nome: "Etiqueta" }),
        texto({ x: 88, y: 530, w: 904, texto: "Travou numa\nmatéria?", fonte: "serifa", tamanho: 150, peso: 600, entrelinha: 0.95, espacamento: -0.02, nome: "Título" }),
        forma("retangulo", { x: 88, y: 920, w: 904, h: 250, preenchimento: COR["Pergaminho claro"], borda: COR.Fio, espessura: 2, nome: "Cartão 1" }),
        texto({ x: 124, y: 950, w: 120, texto: "Dúvida", fonte: "sans", tamanho: 19, peso: 800, cor: COR.Branco, fundo: COR["Bordô"], recuo: 10, alinhar: "center", espacamento: 0.08, maiusculas: true }),
        texto({ x: 124, y: 1010, w: 832, texto: "Como eu resolvo uma equação do segundo grau?", fonte: "serifa", tamanho: 46, peso: 500, entrelinha: 1.15, nome: "Pergunta" }),
        forma("retangulo", { x: 152, y: 1200, w: 840, h: 250, preenchimento: COR["Pergaminho claro"], borda: COR.Verde, espessura: 2, nome: "Cartão 2" }),
        texto({ x: 188, y: 1230, w: 160, texto: "Resolvida", fonte: "sans", tamanho: 19, peso: 800, cor: COR.Branco, fundo: COR.Verde, recuo: 10, alinhar: "center", espacamento: 0.08, maiusculas: true }),
        texto({ x: 188, y: 1290, w: 768, texto: "Ache o delta: b² − 4ac. Depois, aplique a fórmula de Bhaskara.", fonte: "serifa", tamanho: 40, peso: 400, entrelinha: 1.2, nome: "Resposta" }),
        texto({ x: 88, y: 1530, w: 904, texto: "Pergunte. Alguém responde.", fonte: "serifa", tamanho: 66, peso: 500, italico: true, cor: COR["Bordô"], nome: "Chamada" }),
        texto({ x: 88, y: 1640, w: 904, texto: "institutolucia.org/comunidade", fonte: "mono", tamanho: 24, peso: 500, espacamento: 0.1, maiusculas: true }),
      ];
      return d;
    },
  },
  {
    id: "story-cartaz",
    nome: "Cartaz histórico (moldura vermelha)",
    formato: "story",
    grupo: "Stories",
    montar: () => {
      const d = base(1080, 1920, { pontilhado: true });
      d.camadas = [
        marca({ x: 88, y: 230, w: 72, variante: "circulo", cor: COR.Pergaminho, fundo: COR["Bordô"] }),
        texto({ x: 180, y: 248, w: 500, texto: "Instituto Lúcia", fonte: "serifa", tamanho: 40, peso: 700, espacamento: -0.01 }),
        texto({ x: 540, y: 258, w: 452, texto: "O instituto chama", fonte: "mono", tamanho: 21, peso: 500, cor: COR["Bordô"], alinhar: "right", espacamento: 0.2, maiusculas: true }),
        forma("retangulo", { x: 88, y: 380, w: 904, h: 856, preenchimento: COR["Vermelho da gráfica"], nome: "Moldura" }),
        imagem({ x: 273, y: 408, w: 534, h: 800, src: "/imagens/galeria/moor-voluntario.webp", credito: "Dmitri Moor, 1920. Domínio público.", borda: COR.Tinta, espessura: 3, nome: "Imagem" }),
        texto({ x: 88, y: 1252, w: 904, texto: "«Você se alistou como voluntário?» Cartaz de Dmitri Moor, 1920. Domínio público.", fonte: "mono", tamanho: 18, peso: 400, entrelinha: 1.4, cor: COR["Tinta suave"], nome: "Crédito" }),
        texto({ x: 88, y: 1360, w: 904, texto: "E você, já se\nalistou?", fonte: "serifa", tamanho: 122, peso: 600, entrelinha: 0.95, espacamento: -0.02, nome: "Título" }),
        ...faixa(1080, 1640, 100, "Seja voluntário", "institutolucia.org/voluntarios"),
      ];
      return d;
    },
  },
  {
    id: "story-aviso",
    nome: "Aviso rápido (vermelho)",
    formato: "story",
    grupo: "Stories",
    montar: () => {
      const d = base(1080, 1920, { cor: COR["Vermelho da gráfica"] });
      d.camadas = [
        forma("estrela", { x: 88, y: 260, w: 90, h: 90, preenchimento: COR.Pergaminho, nome: "Estrela" }),
        texto({ x: 200, y: 285, w: 792, texto: "Instituto Lúcia", fonte: "serifa", tamanho: 40, peso: 700, cor: COR.Pergaminho }),
        texto({ x: 88, y: 620, w: 904, texto: "Aula ao vivo\nhoje às 19h", fonte: "sans", tamanho: 150, peso: 900, italico: true, entrelinha: 0.92, espacamento: -0.02, cor: COR.Pergaminho, maiusculas: true, nome: "Título" }),
        texto({ x: 88, y: 1040, w: 904, texto: "Frações sem medo, com a educadora de matemática. De graça, sem instalar nada.", fonte: "serifa", tamanho: 48, peso: 400, entrelinha: 1.2, cor: COR.Pergaminho, nome: "Texto" }),
        forma("cunha", { x: 680, y: 1520, w: 400, h: 400, preenchimento: COR.Tinta, nome: "Cunha" }),
        texto({ x: 88, y: 1640, w: 560, texto: "institutolucia.org/ao-vivo", fonte: "mono", tamanho: 26, peso: 500, cor: COR.Pergaminho, espacamento: 0.1, maiusculas: true }),
      ];
      return d;
    },
  },
  {
    id: "carrossel-capa",
    nome: "Carrossel: capa (1 / 5)",
    formato: "carrossel",
    grupo: "Carrossel",
    montar: () => {
      const d = base(1080, 1350, { pontilhado: true, bordaCima: COR["Bordô"], bordaBaixo: COR["Bordô"], espessura: 20 });
      d.camadas = [
        marca({ x: 88, y: 72, w: 64, variante: "nome", cor: COR.Tinta }),
        texto({ x: 540, y: 92, w: 452, texto: "1 / 5", fonte: "mono", tamanho: 21, peso: 500, cor: COR["Bordô"], alinhar: "right", espacamento: 0.2 }),
        texto({ x: 88, y: 330, w: 904, texto: "O que é o\nInstituto\nLúcia?", fonte: "serifa", tamanho: 170, peso: 600, entrelinha: 0.94, espacamento: -0.02, nome: "Título" }),
        texto({ x: 88, y: 900, w: 800, texto: "Uma biblioteca comunitária, gratuita e sem anúncios.", fonte: "serifa", tamanho: 46, peso: 400, entrelinha: 1.22, cor: COR["Tinta suave"], nome: "Texto" }),
        rodapeSite(1080, 1214),
        texto({ x: 540, y: 1210, w: 452, texto: "Arraste para o lado →", fonte: "sans", tamanho: 20, peso: 800, alinhar: "right", espacamento: 0.08, maiusculas: true }),
      ];
      return d;
    },
  },
  {
    id: "carrossel-pagina",
    nome: "Carrossel: página interna",
    formato: "carrossel",
    grupo: "Carrossel",
    montar: () => {
      const d = base(1080, 1350, { pontilhado: true, bordaCima: COR["Bordô"], bordaBaixo: COR["Bordô"], espessura: 20 });
      d.camadas = [
        marca({ x: 88, y: 72, w: 64, variante: "nome", cor: COR.Tinta }),
        texto({ x: 540, y: 92, w: 452, texto: "2 / 5", fonte: "mono", tamanho: 21, peso: 500, cor: COR["Bordô"], alinhar: "right", espacamento: 0.2 }),
        texto({ x: 88, y: 300, w: 904, texto: "Aulas", fonte: "mono", tamanho: 23, peso: 500, cor: COR["Bordô"], espacamento: 0.2, maiusculas: true, nome: "Etiqueta" }),
        texto({ x: 88, y: 350, w: 904, texto: "61 disciplinas,\nda alfabetização\nao superior.", fonte: "serifa", tamanho: 110, peso: 600, entrelinha: 0.97, espacamento: -0.02, nome: "Título" }),
        texto({ x: 88, y: 780, w: 860, texto: "Cada disciplina se divide em trilhas. As aulas são curtas, seguem uma ordem e terminam com um teste.", fonte: "serifa", tamanho: 42, peso: 400, entrelinha: 1.25, cor: COR["Tinta suave"], nome: "Texto" }),
        rodapeSite(1080, 1214),
      ];
      return d;
    },
  },
  {
    id: "cartaz-a4",
    nome: "Cartaz A4: estude de graça",
    formato: "cartaz-a4",
    grupo: "Impressos",
    montar: () => {
      const d = base(1240, 1754, { bordaCima: COR["Bordô"], bordaBaixo: COR["Bordô"], espessura: 22 });
      const m = 88;
      d.camadas = [
        marca({ x: m, y: 70, w: 80, variante: "circulo", cor: COR.Pergaminho, fundo: COR["Bordô"] }),
        texto({ x: m + 100, y: 92, w: 500, texto: "Instituto Lúcia", fonte: "serifa", tamanho: 46, peso: 700, espacamento: -0.01 }),
        texto({ x: 620, y: 104, w: 532, texto: "Educação popular", fonte: "mono", tamanho: 20, peso: 500, cor: COR["Bordô"], alinhar: "right", espacamento: 0.2, maiusculas: true }),
        texto({ x: m, y: 260, w: 1064, texto: "Estude\nde graça.", fonte: "serifa", tamanho: 190, peso: 600, entrelinha: 0.92, espacamento: -0.02, nome: "Título" }),
        texto({ x: m, y: 660, w: 1000, texto: "Uma escola e uma biblioteca feitas pelo povo, para o povo. Sem preço e sem cadeado.", fonte: "serifa", tamanho: 38, peso: 400, entrelinha: 1.28, nome: "Texto" }),
        forma("linha", { x: m, y: 800, w: 1064, h: 2, preenchimento: COR.Tinta, espessura: 2 }),
        texto({ x: m, y: 820, w: 500, texto: "Aulas em trilhas\n61 disciplinas, da alfabetização ao superior.", fonte: "serifa", tamanho: 28, peso: 400, entrelinha: 1.25, nome: "Coluna 1" }),
        texto({ x: 650, y: 820, w: 502, texto: "Acervo de obras livres\nCada obra com a fonte e a licença à vista.", fonte: "serifa", tamanho: 28, peso: 400, entrelinha: 1.25, nome: "Coluna 2" }),
        texto({ x: m, y: 940, w: 500, texto: "Comunidade e reforço\nPergunte: um voluntário responde.", fonte: "serifa", tamanho: 28, peso: 400, entrelinha: 1.25, nome: "Coluna 3" }),
        texto({ x: 650, y: 940, w: 502, texto: "Jornal, rádio e podcast\nImprensa popular, com as fontes à vista.", fonte: "serifa", tamanho: 28, peso: 400, entrelinha: 1.25, nome: "Coluna 4" }),
        forma("retangulo", { x: m, y: 1100, w: 1064, h: 160, preenchimento: COR["Bordô"], nome: "Caixa" }),
        texto({ x: m + 30, y: 1125, w: 1004, texto: "Aqui ninguém paga, ninguém precisa de conta para aprender, e ninguém lucra.", fonte: "serifa", tamanho: 36, peso: 600, entrelinha: 1.2, cor: COR.Pergaminho }),
        texto({ x: m + 30, y: 1215, w: 1004, texto: "Um projeto de esquerda, do lado de quem trabalha. Mantido por voluntários, sem anúncios.", fonte: "serifa", tamanho: 24, peso: 400, italico: true, cor: COR.Pergaminho }),
        texto({ x: m, y: 1320, w: 1064, texto: "Aponte a câmera do celular", fonte: "sans", tamanho: 20, peso: 800, espacamento: 0.1, maiusculas: true }),
        forma("retangulo", { x: m, y: 1370, w: 260, h: 260, preenchimento: COR.Branco, borda: COR.Tinta, espessura: 3, nome: "Lugar do QR" }),
        texto({ x: m + 20, y: 1470, w: 220, texto: "cole aqui o QR", fonte: "mono", tamanho: 18, peso: 400, cor: COR["Tinta suave"], alinhar: "center" }),
        texto({ x: 380, y: 1400, w: 700, texto: "institutolucia.org", fonte: "serifa", tamanho: 56, peso: 700 }),
        texto({ x: 380, y: 1480, w: 700, texto: "@institutoluciaorg", fonte: "mono", tamanho: 24, peso: 500, cor: COR["Tinta suave"] }),
      ];
      return d;
    },
  },
  {
    id: "folheto-a5",
    nome: "Folheto A5: chamada",
    formato: "folheto-a5",
    grupo: "Impressos",
    montar: () => {
      const d = base(874, 1240, { cor: COR["Vermelho da gráfica"] });
      d.camadas = [
        forma("estrela", { x: 60, y: 60, w: 90, h: 90, preenchimento: COR.Pergaminho }),
        texto({ x: 60, y: 260, w: 754, texto: "Sabe explicar\nalguma coisa?\nEscreva uma aula.", fonte: "sans", tamanho: 92, peso: 900, italico: true, entrelinha: 0.95, espacamento: -0.02, cor: COR.Pergaminho, maiusculas: true, nome: "Título" }),
        texto({ x: 60, y: 700, w: 754, texto: "Também precisamos de quem revise, traduza, cuide do acervo, escreva para o jornal, desenhe e programe. Nenhuma função exige diploma.", fonte: "serifa", tamanho: 34, peso: 400, entrelinha: 1.25, cor: COR.Pergaminho, nome: "Texto" }),
        forma("cunha", { x: 574, y: 940, w: 300, h: 300, preenchimento: COR.Tinta }),
        texto({ x: 60, y: 1080, w: 500, texto: "institutolucia.org/voluntarios", fonte: "mono", tamanho: 24, peso: 500, cor: COR.Pergaminho, espacamento: 0.08 }),
      ];
      return d;
    },
  },
  {
    id: "avatar",
    nome: "Avatar das redes",
    formato: "avatar",
    grupo: "Capas e marca",
    montar: () => {
      const d = base(1000, 1000, { cor: COR["Bordô"] });
      d.camadas = [marca({ x: 220, y: 220, w: 560, variante: "simbolo", cor: COR.Pergaminho })];
      return d;
    },
  },
  {
    id: "destaque",
    nome: "Capa de destaque (ícone)",
    formato: "avatar",
    grupo: "Capas e marca",
    montar: () => {
      const d = base(1000, 1000, { cor: COR["Bordô"] });
      d.camadas = [forma("estrela", { x: 300, y: 300, w: 400, h: 400, preenchimento: COR.Pergaminho })];
      return d;
    },
  },
  {
    id: "capa-podcast",
    nome: "Capa de episódio (cartaz vermelho)",
    formato: "capa-podcast",
    grupo: "Capas e marca",
    montar: () => {
      const d = base(3000, 3000, { cor: COR["Vermelho da gráfica"] });
      d.camadas = [
        forma("cunha", { x: 1650, y: 1860, w: 1350, h: 1140, preenchimento: COR.Tinta }),
        forma("estrela", { x: 210, y: 210, w: 390, h: 390, preenchimento: COR.Pergaminho }),
        texto({ x: 660, y: 330, w: 2000, texto: "Podcast · Ep. 1", fonte: "mono", tamanho: 84, peso: 500, cor: COR.Pergaminho, espacamento: 0.1, maiusculas: true, nome: "Etiqueta" }),
        texto({ x: 210, y: 1020, w: 2580, texto: "A Comuna de Paris em 72 dias", fonte: "sans", tamanho: 390, peso: 900, italico: true, entrelinha: 0.96, cor: COR.Pergaminho, maiusculas: true, nome: "Título" }),
        marca({ x: 210, y: 2520, w: 270, variante: "nome", cor: COR.Pergaminho }),
        texto({ x: 1500, y: 2600, w: 1290, texto: "Instituto Lúcia", fonte: "mono", tamanho: 78, peso: 500, cor: COR.Pergaminho, alinhar: "right", maiusculas: true }),
      ];
      return d;
    },
  },
  {
    id: "banner",
    nome: "Cartão de link (compartilhamento)",
    formato: "banner",
    grupo: "Capas e marca",
    montar: () => {
      const d = base(1200, 630, { pontilhado: true, bordaCima: COR["Bordô"], bordaBaixo: COR["Bordô"], espessura: 14 });
      d.camadas = [
        marca({ x: 64, y: 60, w: 56, variante: "nome", cor: COR.Tinta }),
        texto({ x: 64, y: 200, w: 1072, texto: "Todo o conhecimento,\npara todos, para sempre.", fonte: "serifa", tamanho: 86, peso: 600, entrelinha: 1, espacamento: -0.02, nome: "Título" }),
        texto({ x: 64, y: 430, w: 900, texto: "Escola e biblioteca comunitária, gratuita e sem anúncios.", fonte: "serifa", tamanho: 32, peso: 400, cor: COR["Tinta suave"] }),
        texto({ x: 64, y: 540, w: 600, texto: "institutolucia.org", fonte: "mono", tamanho: 22, peso: 500, cor: COR["Bordô"], espacamento: 0.14, maiusculas: true }),
      ];
      return d;
    },
  },
  {
    id: "video",
    nome: "Capa de vídeo (16:9)",
    formato: "video",
    grupo: "Capas e marca",
    montar: () => {
      const d = base(1280, 720, { cor: COR["Preto de arquivo"], bordaCima: COR.Ouro, bordaBaixo: COR.Ouro, espessura: 14 });
      d.camadas = [
        forma("raios", { x: 0, y: 0, w: 1280, h: 720, preenchimento: "rgba(110,31,26,0.55)", opacidade: 0.8, nome: "Raios" }),
        texto({ x: 80, y: 220, w: 1120, texto: "Aula ao vivo", fonte: "sans", tamanho: 150, peso: 900, italico: true, cor: COR.Pergaminho, maiusculas: true, nome: "Título" }),
        texto({ x: 80, y: 420, w: 1120, texto: "Frações sem medo", fonte: "serifa", tamanho: 56, peso: 500, cor: COR.Ouro, nome: "Subtítulo" }),
        marca({ x: 80, y: 580, w: 56, variante: "nome", cor: COR.Pergaminho }),
      ];
      return d;
    },
  },
  {
    id: "capa-rede",
    nome: "Capa de perfil (larga)",
    formato: "capa-rede",
    grupo: "Capas e marca",
    montar: () => {
      const d = base(1640, 624, { cor: COR["Bordô"] });
      d.camadas = [
        marca({ x: 120, y: 182, w: 260, variante: "simbolo", cor: COR.Pergaminho }),
        texto({ x: 440, y: 190, w: 1100, texto: "Instituto Lúcia", fonte: "serifa", tamanho: 120, peso: 700, cor: COR.Pergaminho, espacamento: -0.02 }),
        texto({ x: 444, y: 350, w: 1100, texto: "Escola e biblioteca comunitária · gratuita · sem anúncios", fonte: "mono", tamanho: 28, peso: 500, cor: COR["Ouro claro"], espacamento: 0.08, maiusculas: true }),
      ];
      return d;
    },
  },
];

export const GRUPOS: Modelo["grupo"][] = ["Posts", "Stories", "Carrossel", "Impressos", "Capas e marca"];
