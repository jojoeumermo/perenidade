// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Os modelos prontos do estúdio, tirados do Kit de Lançamento do instituto: posts, stories, carrossel, cartaz,
// avatar e capas, todos com a identidade (pergaminho, tinta, bordô e vermelho da gráfica, a serifa editorial,
// a letra pesada das etiquetas e a monoespaçada dos rodapés). Quem usa troca os textos e as imagens. Um modelo pode
// ter várias páginas (o carrossel completo); a numeração "{pagina} / {total}" se ajusta sozinha.

import { COR, type Documento, elemento, forma, type FormatoId, imagem, marca, texto } from "./motor";

export type GrupoDeModelo = "Posts" | "Stories" | "Carrossel" | "Datas" | "Impressos" | "Site e vídeo" | "Capas e marca" | "Streetwear e ativismo";

export interface Modelo {
  id: string;
  nome: string;
  formato: FormatoId;
  grupo: GrupoDeModelo;
  montar: () => Documento;
  /** Modelos de várias páginas: todas elas (a primeira é a de montar). */
  paginas?: () => Documento[];
}

const base = (w: number, h: number, fundo: Partial<Documento["fundo"]> = {}): Documento => ({ v: 1, w, h, fundo: { cor: COR.Pergaminho, pontilhado: false, bordaCima: "", bordaBaixo: "", espessura: 0, ...fundo }, camadas: [] });

/** O cabeçalho dos posts: a marca com o nome à esquerda, uma etiqueta monoespaçada à direita. */
const cabecalho = (w: number, y: number, etiqueta: string, cor: string, corEtiqueta: string, m = 88) => [
  marca({ x: m, y, w: 64, variante: "nome", cor }),
  texto({ x: w / 2, y: y + 20, w: w / 2 - m, texto: etiqueta, fonte: "mono", tamanho: 21, peso: 500, cor: corEtiqueta, alinhar: "right", espacamento: 0.2, maiusculas: true, estilo: "etiqueta" }),
];
/** A faixa preta de chamada do rodapé, com o endereço em ouro. */
const faixa = (w: number, y: number, h: number, chamada: string, endereco: string, m = 88) => [
  forma("retangulo", { x: m, y, w: w - 2 * m, h, preenchimento: COR.Tinta, nome: "Faixa" }),
  texto({ x: m + 28, y: y + h / 2 - 14, w: (w - 2 * m) * 0.5, texto: chamada, fonte: "sans", tamanho: 22, peso: 800, cor: COR.Pergaminho, espacamento: 0.08, maiusculas: true }),
  texto({ x: w / 2, y: y + h / 2 - 16, w: w / 2 - m - 28, texto: endereco, fonte: "mono", tamanho: 26, peso: 500, cor: COR["Ouro claro"], alinhar: "right" }),
];
const rodapeSite = (w: number, y: number, m = 88) => texto({ x: m, y, w: w / 2, texto: "{link}", fonte: "mono", tamanho: 21, peso: 500, cor: COR["Bordô"], espacamento: 0.14, maiusculas: true, estilo: "rodape", nome: "Endereço" });
/** A numeração do carrossel (03 / 09), que se ajusta sozinha. */
const numeracao = (w: number, y: number, cor = COR["Bordô"], m = 88) => texto({ x: w / 2, y, w: w / 2 - m, texto: "{pagina} / {total}", fonte: "mono", tamanho: 21, peso: 500, cor, alinhar: "right", espacamento: 0.2, nome: "Numeração" });

// ───── Páginas do carrossel completo ─────

function carrosselCapa(): Documento {
  const d = base(1080, 1350, { pontilhado: true, bordaCima: COR["Bordô"], bordaBaixo: COR["Bordô"], espessura: 20 });
  d.camadas = [
    marca({ x: 88, y: 72, w: 64, variante: "nome", cor: COR.Tinta }),
    numeracao(1080, 92),
    texto({ x: 88, y: 330, w: 904, texto: "O que é o\nInstituto\n_Lúcia_?", fonte: "serifa", tamanho: 170, peso: 600, entrelinha: 0.94, espacamento: -0.02, destaque: COR["Bordô"], nome: "Título", estilo: "titulo" }),
    texto({ x: 88, y: 900, w: 800, texto: "Uma biblioteca comunitária, gratuita e sem anúncios.", fonte: "serifa", tamanho: 46, peso: 400, entrelinha: 1.22, cor: COR["Tinta suave"], nome: "Texto", estilo: "subtitulo" }),
    rodapeSite(1080, 1214),
    texto({ x: 540, y: 1210, w: 452, texto: "Arraste para o lado →", fonte: "sans", tamanho: 20, peso: 800, alinhar: "right", espacamento: 0.08, maiusculas: true }),
  ];
  return d;
}
function carrosselPagina(etiqueta: string, titulo: string, corpo: string): Documento {
  const d = base(1080, 1350, { pontilhado: true, bordaCima: COR["Bordô"], bordaBaixo: COR["Bordô"], espessura: 20 });
  d.camadas = [
    marca({ x: 88, y: 72, w: 64, variante: "nome", cor: COR.Tinta }),
    numeracao(1080, 92),
    texto({ x: 88, y: 300, w: 904, texto: etiqueta, fonte: "mono", tamanho: 23, peso: 500, cor: COR["Bordô"], espacamento: 0.2, maiusculas: true, nome: "Etiqueta", estilo: "etiqueta" }),
    texto({ x: 88, y: 350, w: 904, texto: titulo, fonte: "serifa", tamanho: 110, peso: 600, entrelinha: 0.97, espacamento: -0.02, nome: "Título", estilo: "titulo" }),
    texto({ x: 88, y: 780, w: 860, texto: corpo, fonte: "serifa", tamanho: 42, peso: 400, entrelinha: 1.25, cor: COR["Tinta suave"], nome: "Texto", estilo: "subtitulo" }),
    rodapeSite(1080, 1214),
  ];
  return d;
}
function carrosselFinal(): Documento {
  const d = base(1080, 1350, { cor: COR["Bordô"], bordaCima: COR.Tinta, bordaBaixo: COR.Tinta, espessura: 20 });
  d.camadas = [
    marca({ x: 88, y: 72, w: 64, variante: "nome", cor: COR.Pergaminho }),
    numeracao(1080, 92, COR["Ouro claro"]),
    forma("estrela", { x: 88, y: 300, w: 120, h: 120, preenchimento: COR["Ouro claro"], nome: "Estrela" }),
    texto({ x: 88, y: 470, w: 904, texto: "Entre, é\nde graça.", fonte: "serifa", tamanho: 160, peso: 600, entrelinha: 0.92, espacamento: -0.02, cor: COR.Pergaminho, nome: "Título" }),
    texto({ x: 88, y: 860, w: 860, texto: "Salve este post, mande para quem precisa e siga {arroba}.", fonte: "serifa", tamanho: 44, peso: 400, entrelinha: 1.22, cor: COR.Pergaminho, nome: "Chamada" }),
    ...faixa(1080, 1140, 100, "Aulas · Acervo · Jornal", "{link}"),
  ];
  return d;
}

const MODELOS_DA_MARCA: Modelo[] = [
  {
    id: "post-proposito",
    nome: "Propósito (título grande)",
    formato: "post",
    grupo: "Posts",
    montar: () => {
      const d = base(1080, 1350, { pontilhado: true, bordaCima: COR["Bordô"], bordaBaixo: COR["Bordô"], espessura: 20 });
      d.camadas = [
        ...cabecalho(1080, 72, "Educação popular", COR.Tinta, COR["Bordô"]),
        texto({ x: 88, y: 330, w: 904, texto: "Todo o\nconhecimento,\npara todos,\npara sempre.", fonte: "serifa", tamanho: 138, peso: 600, entrelinha: 0.97, espacamento: -0.02, nome: "Título", estilo: "titulo" }),
        texto({ x: 88, y: 900, w: 840, texto: "Aulas gratuitas, acervo livre e uma comunidade aberta, onde qualquer pessoa pergunta e qualquer pessoa responde.", fonte: "serifa", tamanho: 43, peso: 400, entrelinha: 1.25, cor: COR["Tinta suave"], nome: "Texto de apoio", estilo: "subtitulo" }),
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
        ...faixa(1080, 1160, 100, "Aulas · Acervo · Jornal · Rádio", "{link}"),
      ];
      return d;
    },
  },
  {
    id: "post-edicao-extra",
    nome: "Edição extraordinária (capa de jornal)",
    formato: "post",
    grupo: "Posts",
    montar: () => {
      const d = base(1080, 1350, { cor: COR.Papel, textura: "papel" });
      d.camadas = [
        forma("retangulo", { x: 0, y: 0, w: 1080, h: 150, preenchimento: COR["Vermelho da gráfica"], nome: "Faixa do alto" }),
        texto({ x: 60, y: 42, w: 960, texto: "Edição extraordinária", fonte: "sans", tamanho: 64, peso: 900, italico: true, cor: COR.Pergaminho, alinhar: "center", espacamento: 0.02, maiusculas: true, nome: "Chapéu", textura: true }),
        texto({ x: 60, y: 172, w: 480, texto: "Instituto Lúcia", fonte: "serifa", tamanho: 34, peso: 700, nome: "Jornal" }),
        texto({ x: 540, y: 182, w: 480, texto: "{data} · Ano I", fonte: "mono", tamanho: 20, peso: 500, cor: COR["Tinta suave"], alinhar: "right", espacamento: 0.12, maiusculas: true, nome: "Data" }),
        forma("linha", { x: 60, y: 236, w: 960, h: 6, preenchimento: COR.Tinta, espessura: 4, nome: "Fio" }),
        forma("linha", { x: 60, y: 246, w: 960, h: 2, preenchimento: COR.Tinta, espessura: 1.5, nome: "Fio fino" }),
        texto({ x: 60, y: 290, w: 960, texto: "A manchete\nque ninguém\npode perder.", fonte: "serifa", tamanho: 132, peso: 700, entrelinha: 0.93, espacamento: -0.025, nome: "Manchete", estilo: "titulo" }),
        imagem({ x: 60, y: 740, w: 560, h: 420, src: "/imagens/galeria/greve-geral-1917.webp", credito: "Greve geral de 1917, São Paulo. Domínio público.", filtro: "pb", meioTom: 7, corMeioTom: COR.Tinta, nome: "Foto" }),
        texto({ x: 650, y: 740, w: 370, texto: "Escreva aqui o resumo da notícia em duas ou três frases curtas. O detalhe fica para o site.", fonte: "serifa", tamanho: 34, peso: 400, entrelinha: 1.22, nome: "Resumo", hifenizar: true }),
        elemento({ x: 650, y: 1100, w: 370, h: 40, desenho: "ornamento", cor: COR["Vermelho da gráfica"], nome: "Ornamento" }),
        texto({ x: 60, y: 1190, w: 560, texto: "Greve geral de 1917, São Paulo. Domínio público.", fonte: "mono", tamanho: 16, peso: 400, cor: COR["Tinta suave"], nome: "Crédito" }),
        texto({ x: 60, y: 1250, w: 960, texto: "Leia tudo em {link}", fonte: "sans", tamanho: 26, peso: 800, cor: COR.Pergaminho, fundo: COR.Tinta, recuo: 18, alinhar: "center", espacamento: 0.06, maiusculas: true, nome: "Chamada" }),
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
        texto({ x: 88, y: 300, w: 420, texto: "{disciplinas}", fonte: "serifa", tamanho: 340, peso: 600, entrelinha: 0.8, espacamento: -0.03, cor: COR.Ouro, nome: "Número", anim: { tipo: "contador", inicio: 0.2, duracao: 1.6 } }),
        texto({ x: 520, y: 360, w: 480, texto: "disciplinas,\nda alfabetização\nao ensino superior.", fonte: "serifa", tamanho: 58, peso: 500, entrelinha: 1.04, cor: COR.Pergaminho, nome: "Explicação" }),
        forma("linha", { x: 88, y: 700, w: 904, h: 2, preenchimento: "#5c4c30", espessura: 2 }),
        texto({ x: 88, y: 730, w: 700, texto: "Linguagens e artes\nCiências e tecnologia\nHumanidades\nTeoria revolucionária\nLutas do povo", fonte: "serifa", tamanho: 46, peso: 500, entrelinha: 1.6, cor: COR.Pergaminho, nome: "Lista", marcador: "estrela", destaque: COR.Ouro }),
        texto({ x: 88, y: 1170, w: 600, texto: "E mais de {obras} obras livres para ler.", fonte: "serifa", tamanho: 34, peso: 400, italico: true, cor: COR.Fio }),
        texto({ x: 540, y: 1180, w: 452, texto: "{link}", fonte: "mono", tamanho: 21, peso: 500, cor: COR.Ouro, alinhar: "right", espacamento: 0.14, maiusculas: true }),
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
        texto({ x: 88, y: 250, w: 640, texto: "Três funções\nnovas.", fonte: "serifa", tamanho: 150, peso: 600, entrelinha: 0.9, espacamento: -0.025, nome: "Título", estilo: "titulo" }),
        imagem({ x: 756, y: 200, w: 236, h: 354, src: "/imagens/galeria/apsit-um-ano.webp", credito: "Aleksandr Apsit, 1918. Domínio público.", borda: COR.Tinta, espessura: 4, nome: "Imagem" }),
        forma("linha", { x: 88, y: 620, w: 904, h: 2, preenchimento: "rgba(31,26,20,0.3)", espessura: 2 }),
        texto({ x: 88, y: 650, w: 904, texto: "Educador secundário", fonte: "serifa", tamanho: 60, peso: 600, nome: "Item 1" }),
        texto({ x: 88, y: 720, w: 904, texto: "Contribui com materiais e aulas avulsas, sem precisar dar a disciplina inteira.", fonte: "serifa", tamanho: 34, peso: 400, entrelinha: 1.2 }),
        forma("linha", { x: 88, y: 820, w: 904, h: 2, preenchimento: "rgba(31,26,20,0.3)", espessura: 2 }),
        texto({ x: 88, y: 850, w: 904, texto: "Marketing", fonte: "serifa", tamanho: 60, peso: 600, nome: "Item 2" }),
        texto({ x: 88, y: 920, w: 904, texto: "Design e divulgação juntos: cuida do nosso Instagram, com posts e stories.", fonte: "serifa", tamanho: 34, peso: 400, entrelinha: 1.2 }),
        forma("linha", { x: 88, y: 1020, w: 904, h: 2, preenchimento: "rgba(31,26,20,0.3)", espessura: 2 }),
        ...faixa(1080, 1160, 100, "Candidaturas abertas", "{link}/voluntarios"),
      ];
      return d;
    },
  },
  {
    id: "post-saude",
    nome: "Saúde Solidária (cartão de profissional)",
    formato: "post",
    grupo: "Posts",
    montar: () => {
      const d = base(1080, 1350, { cor: COR["Pergaminho claro"], bordaCima: COR.Verde, bordaBaixo: COR.Verde, espessura: 20 });
      d.camadas = [
        ...cabecalho(1080, 72, "Saúde Solidária", COR.Tinta, COR.Verde),
        imagem({ x: 88, y: 230, w: 380, h: 380, src: "/imagens/galeria/kollwitz-pao.webp", credito: "Foto de quem atende (com autorização).", mascara: "circulo", borda: COR.Verde, espessura: 10, nome: "Foto" }),
        elemento({ x: 380, y: 520, w: 110, h: 110, desenho: "icone", icone: "saude", cor: COR.Pergaminho, fundo: COR.Verde, espessura: 2.2, nome: "Ícone" }),
        texto({ x: 520, y: 260, w: 472, texto: "Nome da profissional", fonte: "serifa", tamanho: 64, peso: 600, entrelinha: 1, nome: "Nome" }),
        texto({ x: 520, y: 410, w: 472, texto: "Psicóloga · CRP 00/00000", fonte: "mono", tamanho: 22, peso: 500, cor: COR.Verde, espacamento: 0.08, maiusculas: true, nome: "Registro" }),
        texto({ x: 520, y: 470, w: 180, texto: "Atende de graça", fonte: "sans", tamanho: 18, peso: 800, cor: COR.Branco, fundo: COR.Verde, recuo: 10, alinhar: "center", espacamento: 0.08, maiusculas: true, nome: "Tarja" }),
        texto({ x: 88, y: 700, w: 904, texto: "**Atendimento:** online, por vídeo\n**Quando:** terças, das 18h às 21h\n**Para quem:** estudantes e voluntários do instituto", fonte: "serifa", tamanho: 40, peso: 400, entrelinha: 1.5, marcador: "estrela", destaque: COR.Verde, nome: "Detalhes" }),
        texto({ x: 88, y: 1010, w: 904, texto: "“Cuidar também é um ato político.”", fonte: "serifa", tamanho: 46, peso: 500, italico: true, cor: COR.Verde, nome: "Frase" }),
        ...faixa(1080, 1160, 100, "Agende pelo site", "{link}/saude"),
      ];
      return d;
    },
  },
  {
    id: "post-memoria",
    nome: "Memória (álbum de fotos)",
    formato: "post",
    grupo: "Datas",
    montar: () => {
      const d = base(1080, 1350, { cor: COR.Papel, textura: "papel", vinheta: 0.25 });
      d.camadas = [
        texto({ x: 88, y: 80, w: 904, texto: "Memória", fonte: "mono", tamanho: 22, peso: 500, cor: COR["Bordô"], espacamento: 0.24, maiusculas: true, nome: "Etiqueta" }),
        imagem({ x: 110, y: 170, w: 520, h: 620, rot: -4, src: "/imagens/galeria/kollwitz-marcha-dos-teceloes.webp", credito: "Foto do acervo da família.", moldura: "revelada", legendaFoto: "1964", filtro: "sepia", nome: "Foto 1" }),
        imagem({ x: 560, y: 330, w: 420, h: 500, rot: 5, src: "/imagens/galeria/millet-respigadeiras.webp", credito: "Foto do acervo da família.", moldura: "revelada", legendaFoto: "a família", filtro: "sepia", nome: "Foto 2" }),
        texto({ x: 88, y: 900, w: 904, texto: "Uma vida de luta,\num legado de _esperança_.", fonte: "serifa", tamanho: 74, peso: 600, entrelinha: 1.02, destaque: COR["Bordô"], nome: "Título" }),
        texto({ x: 88, y: 1090, w: 700, texto: "escreva aqui uma lembrança curta", fonte: "manuscrita", tamanho: 46, peso: 500, cor: COR["Tinta suave"], nome: "Bilhete" }),
        elemento({ x: 790, y: 1060, w: 210, h: 210, rot: -10, desenho: "selo", cor: COR["Bordô"], fundo: COR.Pergaminho, conteudo: "Lúcia,\npresente!", nome: "Selo" }),
        texto({ x: 88, y: 1250, w: 600, texto: "{link}", fonte: "mono", tamanho: 20, peso: 500, cor: COR["Bordô"], espacamento: 0.14, maiusculas: true }),
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
        texto({ x: 88, y: 1500, w: 904, texto: "Pergunte. Alguém responde.", fonte: "serifa", tamanho: 66, peso: 500, italico: true, cor: COR["Bordô"], nome: "Chamada" }),
        texto({ x: 88, y: 1600, w: 904, texto: "{link}/comunidade", fonte: "mono", tamanho: 24, peso: 500, espacamento: 0.1, maiusculas: true }),
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
        marca({ x: 88, y: 270, w: 72, variante: "circulo", cor: COR.Pergaminho, fundo: COR["Bordô"] }),
        texto({ x: 180, y: 288, w: 500, texto: "Instituto Lúcia", fonte: "serifa", tamanho: 40, peso: 700, espacamento: -0.01 }),
        texto({ x: 540, y: 298, w: 452, texto: "O instituto chama", fonte: "mono", tamanho: 21, peso: 500, cor: COR["Bordô"], alinhar: "right", espacamento: 0.2, maiusculas: true }),
        forma("retangulo", { x: 88, y: 400, w: 904, h: 836, preenchimento: COR["Vermelho da gráfica"], nome: "Moldura" }),
        imagem({ x: 283, y: 428, w: 514, h: 780, src: "/imagens/galeria/moor-voluntario.webp", credito: "Dmitri Moor, 1920. Domínio público.", borda: COR.Tinta, espessura: 3, nome: "Imagem" }),
        texto({ x: 88, y: 1252, w: 904, texto: "«Você se alistou como voluntário?» Cartaz de Dmitri Moor, 1920. Domínio público.", fonte: "mono", tamanho: 18, peso: 400, entrelinha: 1.4, cor: COR["Tinta suave"], nome: "Crédito" }),
        texto({ x: 88, y: 1340, w: 904, texto: "E você, já se\nalistou?", fonte: "serifa", tamanho: 116, peso: 600, entrelinha: 0.95, espacamento: -0.02, nome: "Título" }),
        ...faixa(1080, 1600, 90, "Seja voluntário", "{link}/voluntarios"),
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
        forma("estrela", { x: 88, y: 270, w: 90, h: 90, preenchimento: COR.Pergaminho, nome: "Estrela" }),
        texto({ x: 200, y: 295, w: 792, texto: "Instituto Lúcia", fonte: "serifa", tamanho: 40, peso: 700, cor: COR.Pergaminho }),
        texto({ x: 88, y: 620, w: 904, texto: "Aula ao vivo\nhoje às {hora}", fonte: "sans", tamanho: 150, peso: 900, italico: true, entrelinha: 0.92, espacamento: -0.02, cor: COR.Pergaminho, maiusculas: true, nome: "Título", anim: { tipo: "subir", inicio: 0.2, duracao: 0.8 } }),
        texto({ x: 88, y: 1040, w: 904, texto: "Frações sem medo, com a educadora de matemática. De graça, sem instalar nada.", fonte: "serifa", tamanho: 48, peso: 400, entrelinha: 1.2, cor: COR.Pergaminho, nome: "Texto", anim: { tipo: "aparecer", inicio: 0.8, duracao: 0.8 } }),
        forma("cunha", { x: 680, y: 1520, w: 400, h: 400, preenchimento: COR.Tinta, nome: "Cunha" }),
        texto({ x: 88, y: 1500, w: 560, texto: "{link}/ao-vivo", fonte: "mono", tamanho: 26, peso: 500, cor: COR.Pergaminho, espacamento: 0.1, maiusculas: true }),
      ];
      return d;
    },
  },
  {
    id: "story-enquete",
    nome: "Pergunta com figurinha (enquete)",
    formato: "story",
    grupo: "Stories",
    montar: () => {
      const d = base(1080, 1920, { cor: COR.Tinta });
      d.camadas = [
        marca({ x: 88, y: 280, w: 64, variante: "nome", cor: COR.Pergaminho }),
        texto({ x: 88, y: 520, w: 904, texto: "Enquete", fonte: "mono", tamanho: 24, peso: 500, cor: COR.Ouro, espacamento: 0.24, maiusculas: true, nome: "Etiqueta" }),
        texto({ x: 88, y: 580, w: 904, texto: "Qual aula você\nquer na semana\nque vem?", fonte: "serifa", tamanho: 104, peso: 600, entrelinha: 0.98, cor: COR.Pergaminho, nome: "Pergunta" }),
        elemento({ x: 190, y: 1060, w: 700, h: 300, desenho: "figurinha", conteudo: "Figurinha de enquete aqui", soGuia: true, nome: "Guia da figurinha" }),
        elemento({ x: 760, y: 1400, w: 220, h: 200, desenho: "seta-mao", cor: COR.Ouro, rot: 160, nome: "Seta" }),
        texto({ x: 88, y: 1500, w: 650, texto: "Vote e compartilhe com a turma.", fonte: "manuscrita", tamanho: 56, peso: 600, cor: COR["Ouro claro"], nome: "Bilhete" }),
      ];
      return d;
    },
  },
  {
    id: "carrossel-completo",
    nome: "Carrossel completo (5 páginas)",
    formato: "carrossel",
    grupo: "Carrossel",
    montar: carrosselCapa,
    paginas: () => [
      carrosselCapa(),
      carrosselPagina("Aulas", "{disciplinas} disciplinas,\nda alfabetização\nao superior.", "Cada disciplina se divide em trilhas. As aulas são curtas, seguem uma ordem e terminam com um teste."),
      carrosselPagina("Acervo", "Obras livres,\ncom a fonte\nà vista.", "Livros, artigos e documentos em domínio público ou licença livre, para ler e baixar."),
      carrosselPagina("Comunidade", "Pergunte.\nAlguém\nresponde.", "Voluntários e estudantes tiram dúvidas uns dos outros, de graça e sem propaganda."),
      carrosselFinal(),
    ],
  },
  { id: "carrossel-capa", nome: "Carrossel: capa", formato: "carrossel", grupo: "Carrossel", montar: carrosselCapa },
  {
    id: "carrossel-pagina",
    nome: "Carrossel: página interna",
    formato: "carrossel",
    grupo: "Carrossel",
    montar: () => carrosselPagina("Aulas", "{disciplinas} disciplinas,\nda alfabetização\nao superior.", "Cada disciplina se divide em trilhas. As aulas são curtas, seguem uma ordem e terminam com um teste."),
  },
  { id: "carrossel-final", nome: "Carrossel: última página (chamada)", formato: "carrossel", grupo: "Carrossel", montar: carrosselFinal },
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
        texto({ x: m, y: 820, w: 500, texto: "**Aulas em trilhas**\n{disciplinas} disciplinas, da alfabetização ao superior.", fonte: "serifa", tamanho: 28, peso: 400, entrelinha: 1.25, nome: "Coluna 1" }),
        texto({ x: 650, y: 820, w: 502, texto: "**Acervo de obras livres**\nCada obra com a fonte e a licença à vista.", fonte: "serifa", tamanho: 28, peso: 400, entrelinha: 1.25, nome: "Coluna 2" }),
        texto({ x: m, y: 940, w: 500, texto: "**Comunidade e reforço**\nPergunte: um voluntário responde.", fonte: "serifa", tamanho: 28, peso: 400, entrelinha: 1.25, nome: "Coluna 3" }),
        texto({ x: 650, y: 940, w: 502, texto: "**Jornal, rádio e podcast**\nImprensa popular, com as fontes à vista.", fonte: "serifa", tamanho: 28, peso: 400, entrelinha: 1.25, nome: "Coluna 4" }),
        forma("retangulo", { x: m, y: 1100, w: 1064, h: 160, preenchimento: COR["Bordô"], nome: "Caixa" }),
        texto({ x: m + 30, y: 1125, w: 1004, texto: "Aqui ninguém paga, ninguém precisa de conta para aprender, e ninguém lucra.", fonte: "serifa", tamanho: 36, peso: 600, entrelinha: 1.2, cor: COR.Pergaminho }),
        texto({ x: m + 30, y: 1215, w: 1004, texto: "Um projeto de esquerda, do lado de quem trabalha. Mantido por voluntários, sem anúncios.", fonte: "serifa", tamanho: 24, peso: 400, italico: true, cor: COR.Pergaminho }),
        texto({ x: m, y: 1320, w: 1064, texto: "Aponte a câmera do celular", fonte: "sans", tamanho: 20, peso: 800, espacamento: 0.1, maiusculas: true }),
        elemento({ x: m, y: 1370, w: 260, h: 260, desenho: "qr", conteudo: "https://institutolucia.org", cor: COR.Tinta, fundo: COR.Branco, nome: "QR" }),
        texto({ x: 380, y: 1400, w: 700, texto: "{link}", fonte: "serifa", tamanho: 56, peso: 700 }),
        texto({ x: 380, y: 1480, w: 700, texto: "{arroba}", fonte: "mono", tamanho: 24, peso: 500, cor: COR["Tinta suave"] }),
      ];
      return d;
    },
  },
  {
    id: "cartaz-a3",
    nome: "Cartaz A3: punho e chamada",
    formato: "cartaz-a3",
    grupo: "Impressos",
    montar: () => {
      const d = base(1754, 2480, { cor: COR["Vermelho da gráfica"], textura: "serigrafia" });
      d.camadas = [
        elemento({ x: -200, y: -200, w: 2154, h: 2154, desenho: "raios-traco", cor: "rgba(244,236,216,0.18)", quantidade: 48, espessura: 10, nome: "Raios" }),
        elemento({ x: 527, y: 260, w: 700, h: 994, desenho: "punho", cor: COR.Tinta, nome: "Punho" }),
        forma("estrela", { x: 1210, y: 230, w: 240, h: 240, preenchimento: COR.Pergaminho, nome: "Estrela" }),
        texto({ x: 120, y: 1360, w: 1514, texto: "O saber\né do povo.", fonte: "sans", tamanho: 270, peso: 900, italico: true, entrelinha: 0.88, espacamento: -0.02, cor: COR.Pergaminho, maiusculas: true, alinhar: "center", nome: "Título", textura: true }),
        texto({ x: 120, y: 1980, w: 1514, texto: "Aulas, acervo e jornal. De graça, para sempre.", fonte: "serifa", tamanho: 64, peso: 500, italico: true, cor: COR.Pergaminho, alinhar: "center", nome: "Texto" }),
        elemento({ x: 120, y: 2160, w: 200, h: 200, desenho: "qr", conteudo: "https://institutolucia.org", cor: COR.Tinta, fundo: COR.Pergaminho, nome: "QR" }),
        texto({ x: 360, y: 2200, w: 1274, texto: "{link}", fonte: "mono", tamanho: 56, peso: 500, cor: COR.Pergaminho, espacamento: 0.08, maiusculas: true }),
        texto({ x: 360, y: 2290, w: 1274, texto: "Instituto Lúcia · {arroba}", fonte: "mono", tamanho: 36, peso: 500, cor: COR.Tinta, espacamento: 0.08 }),
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
        texto({ x: 60, y: 1080, w: 500, texto: "{link}/voluntarios", fonte: "mono", tamanho: 24, peso: 500, cor: COR.Pergaminho, espacamento: 0.08 }),
      ];
      return d;
    },
  },
  {
    id: "certificado",
    nome: "Certificado (A4 deitado)",
    formato: "certificado",
    grupo: "Impressos",
    montar: () => {
      const d = base(1754, 1240, { cor: COR["Pergaminho claro"], textura: "papel" });
      d.camadas = [
        forma("retangulo", { x: 50, y: 50, w: 1654, h: 1140, preenchimento: "transparent", borda: COR["Bordô"], espessura: 6, nome: "Moldura" }),
        forma("retangulo", { x: 72, y: 72, w: 1610, h: 1096, preenchimento: "transparent", borda: COR.Ouro, espessura: 2, nome: "Moldura fina" }),
        marca({ x: 812, y: 120, w: 130, variante: "circulo", cor: COR.Pergaminho, fundo: COR["Bordô"] }),
        texto({ x: 177, y: 290, w: 1400, texto: "Certificado", fonte: "serifa", tamanho: 110, peso: 600, alinhar: "center", espacamento: 0.02, nome: "Título" }),
        elemento({ x: 577, y: 430, w: 600, h: 40, desenho: "ornamento", cor: COR["Bordô"], nome: "Ornamento" }),
        texto({ x: 177, y: 510, w: 1400, texto: "O Instituto Lúcia certifica que", fonte: "serifa", tamanho: 40, peso: 400, italico: true, cor: COR["Tinta suave"], alinhar: "center" }),
        texto({ x: 177, y: 590, w: 1400, texto: "Nome da pessoa", fonte: "manuscrita", tamanho: 110, peso: 700, cor: COR["Bordô"], alinhar: "center", nome: "Nome" }),
        texto({ x: 277, y: 760, w: 1200, texto: "participou de … com carga horária de … horas, em {data}.", fonte: "serifa", tamanho: 38, peso: 400, entrelinha: 1.35, alinhar: "center", nome: "Texto" }),
        forma("linha", { x: 277, y: 1010, w: 480, h: 2, preenchimento: COR.Tinta, espessura: 2 }),
        texto({ x: 277, y: 1030, w: 480, texto: "Coordenação do Instituto Lúcia", fonte: "mono", tamanho: 20, peso: 500, alinhar: "center", espacamento: 0.06, maiusculas: true }),
        elemento({ x: 1260, y: 900, w: 230, h: 230, rot: -8, desenho: "carimbo", cor: COR["Bordô"], conteudo: "Instituto Lúcia", conteudo2: "Educação popular", nome: "Carimbo", textura: true }),
      ];
      return d;
    },
  },
  {
    id: "convite",
    nome: "Convite (evento)",
    formato: "convite",
    grupo: "Impressos",
    montar: () => {
      const d = base(1500, 2100, { cor: COR.Tinta, textura: "papel" });
      d.camadas = [
        elemento({ x: 450, y: 160, w: 600, h: 420, desenho: "louros", cor: COR.Ouro, nome: "Ramos" }),
        forma("estrela", { x: 650, y: 230, w: 200, h: 200, preenchimento: COR["Vermelho vivo"], nome: "Estrela" }),
        texto({ x: 150, y: 680, w: 1200, texto: "Você está convidada", fonte: "mono", tamanho: 34, peso: 500, cor: COR.Ouro, alinhar: "center", espacamento: 0.24, maiusculas: true, nome: "Chamada" }),
        texto({ x: 150, y: 760, w: 1200, texto: "Nome do\nencontro", fonte: "serifa", tamanho: 190, peso: 600, entrelinha: 0.92, cor: COR.Pergaminho, alinhar: "center", nome: "Título" }),
        elemento({ x: 450, y: 1210, w: 600, h: 40, desenho: "ornamento", cor: COR.Ouro, nome: "Ornamento" }),
        texto({ x: 150, y: 1310, w: 1200, texto: "{data} · {hora}\n{local}", fonte: "serifa", tamanho: 64, peso: 500, entrelinha: 1.3, cor: COR.Pergaminho, alinhar: "center", nome: "Quando e onde" }),
        texto({ x: 150, y: 1720, w: 1200, texto: "Entrada livre · traga quem você ama", fonte: "manuscrita", tamanho: 64, peso: 600, cor: COR["Ouro claro"], alinhar: "center", nome: "Bilhete" }),
        marca({ x: 640, y: 1880, w: 60, variante: "nome", cor: COR.Pergaminho }),
      ];
      return d;
    },
  },
  {
    id: "cracha",
    nome: "Crachá de voluntário",
    formato: "cracha",
    grupo: "Impressos",
    montar: () => {
      const d = base(638, 1011, { cor: COR.Pergaminho });
      d.camadas = [
        forma("retangulo", { x: 0, y: 0, w: 638, h: 300, preenchimento: COR["Bordô"], nome: "Faixa" }),
        forma("retangulo", { x: 269, y: 40, w: 100, h: 22, preenchimento: COR.Pergaminho, raio: 11, nome: "Furo do cordão" }),
        marca({ x: 60, y: 110, w: 54, variante: "nome", cor: COR.Pergaminho }),
        imagem({ x: 189, y: 220, w: 260, h: 260, src: "/imagens/galeria/kollwitz-pao.webp", credito: "", mascara: "circulo", borda: COR.Pergaminho, espessura: 10, nome: "Foto" }),
        texto({ x: 40, y: 520, w: 558, texto: "Nome Sobrenome", fonte: "serifa", tamanho: 58, peso: 600, alinhar: "center", ajustar: true, h: 70, nome: "Nome" }),
        texto({ x: 40, y: 610, w: 558, texto: "Voluntária · Educação", fonte: "mono", tamanho: 24, peso: 500, cor: COR["Bordô"], alinhar: "center", espacamento: 0.1, maiusculas: true, nome: "Função" }),
        elemento({ x: 239, y: 700, w: 160, h: 160, desenho: "qr", conteudo: "https://institutolucia.org", cor: COR.Tinta, fundo: COR.Branco, nome: "QR" }),
        texto({ x: 40, y: 900, w: 558, texto: "{link}", fonte: "mono", tamanho: 22, peso: 500, cor: COR["Tinta suave"], alinhar: "center", espacamento: 0.1, maiusculas: true }),
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
      d.camadas = [
        elemento({ x: 270, y: 270, w: 460, h: 460, desenho: "icone", icone: "microfone", cor: COR.Pergaminho, espessura: 1.5, nome: "Ícone" }),
      ];
      return d;
    },
  },
  {
    id: "destaque-estrela",
    nome: "Capa de destaque (estrela)",
    formato: "avatar",
    grupo: "Capas e marca",
    montar: () => {
      const d = base(1000, 1000, { cor: COR["Bordô"] });
      d.camadas = [forma("estrela", { x: 300, y: 300, w: 400, h: 400, preenchimento: COR.Pergaminho })];
      return d;
    },
  },
  {
    id: "selo",
    nome: "Selo “Lúcia, presente!”",
    formato: "avatar",
    grupo: "Capas e marca",
    montar: () => {
      const d = base(1000, 1000, { cor: COR.Pergaminho, textura: "papel" });
      d.camadas = [
        elemento({ x: 120, y: 120, w: 760, h: 760, desenho: "selo", cor: COR["Bordô"], fundo: COR.Pergaminho, conteudo: "Lúcia,\npresente!", nome: "Selo", textura: true }),
        forma("estrela", { x: 460, y: 190, w: 80, h: 80, preenchimento: COR.Ouro, nome: "Estrela" }),
      ];
      return d;
    },
  },
  {
    id: "capa-podcast",
    nome: "Capa de episódio (cartaz vermelho)",
    formato: "capa-podcast",
    grupo: "Site e vídeo",
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
    grupo: "Site e vídeo",
    montar: () => {
      const d = base(1200, 630, { pontilhado: true, bordaCima: COR["Bordô"], bordaBaixo: COR["Bordô"], espessura: 14 });
      d.camadas = [
        marca({ x: 64, y: 60, w: 56, variante: "nome", cor: COR.Tinta }),
        texto({ x: 64, y: 200, w: 1072, texto: "Todo o conhecimento,\npara todos, para sempre.", fonte: "serifa", tamanho: 86, peso: 600, entrelinha: 1, espacamento: -0.02, nome: "Título" }),
        texto({ x: 64, y: 430, w: 900, texto: "Escola e biblioteca comunitária, gratuita e sem anúncios.", fonte: "serifa", tamanho: 32, peso: 400, cor: COR["Tinta suave"] }),
        texto({ x: 64, y: 540, w: 600, texto: "{link}", fonte: "mono", tamanho: 22, peso: 500, cor: COR["Bordô"], espacamento: 0.14, maiusculas: true }),
      ];
      return d;
    },
  },
  {
    id: "banner-site",
    nome: "Faixa do site (campanha)",
    formato: "banner-site",
    grupo: "Site e vídeo",
    montar: () => {
      const d = base(1920, 640, { cor: COR["Bordô"] });
      d.camadas = [
        forma("cunha", { x: 1420, y: 140, w: 500, h: 500, preenchimento: COR.Tinta, nome: "Cunha" }),
        forma("estrela", { x: 1660, y: 120, w: 160, h: 160, preenchimento: COR.Pergaminho, nome: "Estrela" }),
        texto({ x: 120, y: 120, w: 1200, texto: "Campanha", fonte: "mono", tamanho: 28, peso: 500, cor: COR["Ouro claro"], espacamento: 0.24, maiusculas: true, nome: "Etiqueta" }),
        texto({ x: 120, y: 180, w: 1300, texto: "Ajude a manter o\ninstituto de graça.", fonte: "serifa", tamanho: 120, peso: 600, entrelinha: 0.95, cor: COR.Pergaminho, nome: "Título" }),
        texto({ x: 120, y: 470, w: 520, texto: "Saiba como", fonte: "sans", tamanho: 30, peso: 800, cor: COR.Tinta, fundo: COR.Pergaminho, recuo: 20, alinhar: "center", espacamento: 0.08, maiusculas: true, nome: "Botão" }),
      ];
      return d;
    },
  },
  {
    id: "capa-noticia",
    nome: "Capa de notícia do jornal",
    formato: "capa-noticia",
    grupo: "Site e vídeo",
    montar: () => {
      const d = base(1600, 900, { cor: COR["Preto de arquivo"] });
      d.camadas = [
        imagem({ x: 0, y: 0, w: 1600, h: 900, src: "/imagens/galeria/greve-geral-1917.webp", credito: "Greve geral de 1917, São Paulo. Domínio público.", filtro: "duotom", opacidade: 0.75, nome: "Foto" }),
        forma("retangulo", { x: 0, y: 520, w: 1600, h: 380, preenchimento: "rgba(23,19,14,0.78)", nome: "Faixa" }),
        texto({ x: 90, y: 560, w: 600, texto: "Jornal do Instituto", fonte: "mono", tamanho: 26, peso: 500, cor: COR.Ouro, espacamento: 0.2, maiusculas: true, nome: "Seção" }),
        texto({ x: 90, y: 610, w: 1420, texto: "A manchete da notícia em uma ou duas linhas", fonte: "serifa", tamanho: 84, peso: 600, entrelinha: 1, cor: COR.Pergaminho, nome: "Manchete" }),
        texto({ x: 90, y: 820, w: 1420, texto: "Greve geral de 1917, São Paulo. Domínio público.", fonte: "mono", tamanho: 18, peso: 400, cor: COR.Fio, nome: "Crédito" }),
      ];
      return d;
    },
  },
  {
    id: "video",
    nome: "Miniatura do YouTube (aula ao vivo)",
    formato: "video",
    grupo: "Site e vídeo",
    montar: () => {
      const d = base(1280, 720, { cor: COR["Preto de arquivo"], bordaCima: COR.Ouro, bordaBaixo: COR.Ouro, espessura: 14 });
      d.camadas = [
        forma("raios", { x: 0, y: 0, w: 1280, h: 720, preenchimento: "rgba(110,31,26,0.55)", opacidade: 0.8, nome: "Raios" }),
        texto({ x: 80, y: 200, w: 1120, texto: "Aula ao vivo", fonte: "sans", tamanho: 150, peso: 900, italico: true, cor: COR.Pergaminho, maiusculas: true, sombra: COR["Vermelho da gráfica"], sombraX: 8, sombraY: 8, nome: "Título" }),
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
    grupo: "Site e vídeo",
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

// ───── Streetwear e ativismo ─────
// Estampas, drops, lookbook, adesivo e etiqueta para quem faz roupa e arte de rua militante. Vão sem a marca do
// instituto: são de quem cria. As estampas saem melhor em PNG sem fundo (Exportar › sem a cor do fundo).

const STREETWEAR: Modelo[] = [
  {
    id: "estampa-punho",
    nome: "Estampa: punho e arco (serigrafia)",
    formato: "estampa",
    grupo: "Streetwear e ativismo",
    montar: () => {
      const d = base(2362, 2953, { cor: COR["Preto de arquivo"], textura: "serigrafia" });
      d.camadas = [
        texto({ x: 181, y: 330, w: 2000, texto: "Organizar", fonte: "sans", tamanho: 300, peso: 900, italico: true, cor: COR["Vermelho vivo"], alinhar: "center", maiusculas: true, curva: 38, textura: true, nome: "Arco de cima" }),
        elemento({ x: 581, y: 700, w: 1200, h: 1400, desenho: "punho-cartaz", cor: COR.Pergaminho, textura: true, nome: "Punho" }),
        texto({ x: 181, y: 2200, w: 2000, texto: "Lutar", fonte: "sans", tamanho: 420, peso: 900, italico: true, cor: COR.Pergaminho, alinhar: "center", maiusculas: true, textura: true, nome: "Palavra de baixo" }),
        texto({ x: 181, y: 2700, w: 2000, texto: "Vencer", fonte: "mono", tamanho: 90, peso: 500, cor: COR["Vermelho vivo"], alinhar: "center", espacamento: 0.4, maiusculas: true, nome: "Assinatura" }),
      ];
      return d;
    },
  },
  {
    id: "estampa-tipografica",
    nome: "Estampa: palavras empilhadas (vazado)",
    formato: "estampa",
    grupo: "Streetwear e ativismo",
    montar: () => {
      const d = base(2362, 2953, { cor: COR["Pergaminho claro"] });
      const linha = (y: number, t: string, vazado: boolean, cor: string) =>
        texto({ x: 120, y, w: 2122, texto: t, fonte: "sans", tamanho: 520, peso: 900, italico: true, entrelinha: 0.85, espacamento: -0.03, cor, alinhar: "center", maiusculas: true, vazado, contorno: vazado ? COR.Tinta : "", espContorno: vazado ? 14 : 0, nome: t });
      d.camadas = [
        linha(300, "O povo", false, COR.Tinta),
        linha(860, "não", true, COR.Tinta),
        linha(1420, "esquece", false, COR["Vermelho da gráfica"]),
        forma("linha", { x: 300, y: 2140, w: 1762, h: 12, preenchimento: COR.Tinta, espessura: 12, nome: "Fio" }),
        texto({ x: 120, y: 2240, w: 2122, texto: "Memória · Verdade · Justiça", fonte: "mono", tamanho: 96, peso: 500, cor: COR.Tinta, alinhar: "center", espacamento: 0.24, maiusculas: true, nome: "Lema" }),
      ];
      return d;
    },
  },
  {
    id: "estampa-estrela",
    nome: "Estampa: estrela, raios e faixa",
    formato: "estampa",
    grupo: "Streetwear e ativismo",
    montar: () => {
      const d = base(2362, 2953, { cor: COR["Preto de arquivo"] });
      d.camadas = [
        forma("raios", { x: 181, y: 300, w: 2000, h: 2000, preenchimento: COR["Vermelho da gráfica"], nome: "Raios" }),
        forma("estrela", { x: 631, y: 750, w: 1100, h: 1100, preenchimento: COR.Ouro, nome: "Estrela" }),
        elemento({ x: 181, y: 2160, w: 2000, h: 330, desenho: "pincelada", cor: COR.Pergaminho, nome: "Pincelada" }),
        texto({ x: 221, y: 2262, w: 1920, texto: "Terra, teto e trabalho", fonte: "sans", tamanho: 124, peso: 900, italico: true, cor: COR["Preto de arquivo"], alinhar: "center", maiusculas: true, nome: "Faixa" }),
      ];
      return d;
    },
  },
  {
    id: "post-drop",
    nome: "Novo drop (lançamento de peça)",
    formato: "post",
    grupo: "Streetwear e ativismo",
    montar: () => {
      const d = base(1080, 1350, { cor: COR["Preto de arquivo"] });
      d.camadas = [
        imagem({ x: 0, y: 0, w: 1080, h: 1350, src: "/imagens/galeria/kustodiev-bolchevique.webp", credito: "Troque pela foto da peça. Boris Kustodiev, O bolchevique, 1920. Domínio público.", filtro: "duotom", opacidade: 0.55, nome: "Foto da peça" }),
        texto({ x: 72, y: 80, w: 600, texto: "Novo drop", fonte: "mono", tamanho: 30, peso: 500, cor: COR.Pergaminho, espacamento: 0.3, maiusculas: true, nome: "Etiqueta" }),
        texto({ x: 72, y: 720, w: 936, texto: "Coleção\nChão de fábrica", fonte: "sans", tamanho: 100, peso: 900, italico: true, entrelinha: 0.9, cor: COR.Pergaminho, maiusculas: true, sombra: COR["Vermelho da gráfica"], sombraX: 8, sombraY: 8, nome: "Nome da coleção" }),
        texto({ x: 72, y: 1060, w: 700, texto: "Camiseta 100% algodão, serigrafia feita à mão. Edição limitada.", fonte: "sans", tamanho: 32, peso: 500, entrelinha: 1.3, cor: COR.Pergaminho, nome: "Descrição" }),
        texto({ x: 72, y: 1220, w: 420, texto: "Link na bio", fonte: "sans", tamanho: 26, peso: 800, cor: COR.Tinta, fundo: COR.Pergaminho, recuo: 16, alinhar: "center", espacamento: 0.1, maiusculas: true, nome: "Chamada" }),
        elemento({ x: 790, y: 1040, w: 230, h: 230, desenho: "selo", cor: COR["Vermelho da gráfica"], fundo: COR.Pergaminho, conteudo: "R$ 79", nome: "Preço" }),
      ];
      return d;
    },
  },
  {
    id: "story-lookbook",
    nome: "Lookbook (story)",
    formato: "story",
    grupo: "Streetwear e ativismo",
    montar: () => {
      const d = base(1080, 1920, { cor: COR.Papel, textura: "papel" });
      d.camadas = [
        imagem({ x: 80, y: 220, w: 920, h: 1180, src: "/imagens/galeria/greve-geral-1917.webp", credito: "Troque pela foto do look.", filtro: "pb", borda: COR.Tinta, espessura: 8, nome: "Foto do look" }),
        elemento({ x: 380, y: 190, w: 320, h: 70, desenho: "fita", cor: "rgba(240,207,142,0.8)", nome: "Fita" }),
        texto({ x: 80, y: 90, w: 920, texto: "Look 01", fonte: "mono", tamanho: 34, peso: 500, cor: COR["Bordô"], espacamento: 0.3, maiusculas: true, nome: "Número do look" }),
        texto({ x: 80, y: 1440, w: 920, texto: "Moletom “Memória”\nBoné “Organizar”", fonte: "sans", tamanho: 64, peso: 900, italico: true, entrelinha: 1, cor: COR.Tinta, maiusculas: true, nome: "Peças" }),
        texto({ x: 80, y: 1620, w: 700, texto: "Tamanhos P ao GG · envio para todo o Brasil", fonte: "sans", tamanho: 32, peso: 500, cor: COR["Tinta suave"], nome: "Detalhes" }),
        elemento({ x: 780, y: 1600, w: 200, h: 200, desenho: "seta-mao", cor: COR["Vermelho da gráfica"], nome: "Seta" }),
        elemento({ x: 240, y: 1730, w: 600, h: 130, desenho: "figurinha", soGuia: true, nome: "Guia da figurinha de link" }),
      ];
      return d;
    },
  },
  {
    id: "post-frase-de-rua",
    nome: "Frase de rua (pincel)",
    formato: "quadrado",
    grupo: "Streetwear e ativismo",
    montar: () => {
      const d = base(1080, 1080, { cor: COR["Pergaminho claro"], textura: "serigrafia" });
      d.camadas = [
        elemento({ x: 60, y: 290, w: 960, h: 480, desenho: "pincelada", cor: COR["Vermelho da gráfica"], nome: "Pincelada" }),
        texto({ x: 80, y: 330, w: 920, texto: "A rua\né nossa", fonte: "manuscrita", tamanho: 170, entrelinha: 1, peso: 700, cor: COR.Pergaminho, alinhar: "center", rot: -4, nome: "Frase" }),
        texto({ x: 80, y: 860, w: 920, texto: "@seu.perfil", fonte: "mono", tamanho: 30, peso: 500, cor: COR.Tinta, alinhar: "center", espacamento: 0.2, nome: "Perfil" }),
      ];
      return d;
    },
  },
  {
    id: "story-do-papel-a-camiseta",
    nome: "Do papel à camiseta (bastidores)",
    formato: "story",
    grupo: "Streetwear e ativismo",
    montar: () => {
      const d = base(1080, 1920, { cor: COR["Preto de arquivo"] });
      const passo = (n: string, y: number, titulo: string, corpo: string) => [
        texto({ x: 80, y, w: 160, texto: n, fonte: "sans", tamanho: 150, peso: 900, italico: true, cor: COR["Vermelho vivo"], nome: `Número ${n}` }),
        texto({ x: 280, y: y + 20, w: 720, texto: titulo, fonte: "sans", tamanho: 58, peso: 900, cor: COR.Pergaminho, maiusculas: true, nome: `Passo ${n}` }),
        texto({ x: 280, y: y + 100, w: 720, texto: corpo, fonte: "sans", tamanho: 34, peso: 500, entrelinha: 1.3, cor: COR.Fio, nome: `Explicação ${n}` }),
      ];
      d.camadas = [
        texto({ x: 80, y: 120, w: 920, texto: "Bastidores", fonte: "mono", tamanho: 32, peso: 500, cor: COR["Vermelho vivo"], espacamento: 0.3, maiusculas: true, nome: "Etiqueta" }),
        texto({ x: 80, y: 180, w: 920, texto: "Do papel\nà camiseta", fonte: "sans", tamanho: 130, peso: 900, italico: true, entrelinha: 0.92, cor: COR.Pergaminho, maiusculas: true, nome: "Título" }),
        ...passo("1", 620, "O desenho", "Rascunho no caderno, depois vetor. A ideia vem da rua e da história."),
        ...passo("2", 960, "A tela", "A arte vai para a tela de serigrafia, uma cor de cada vez."),
        ...passo("3", 1300, "A tinta", "Cada peça é puxada à mão por quem trabalha com a gente, com pagamento justo."),
        texto({ x: 80, y: 1720, w: 920, texto: "@seu.perfil", fonte: "mono", tamanho: 30, peso: 500, cor: COR.Fio, alinhar: "center", espacamento: 0.2, nome: "Perfil" }),
      ];
      return d;
    },
  },
  {
    id: "adesivo-carimbo",
    nome: "Adesivo redondo (carimbo)",
    formato: "adesivo",
    grupo: "Streetwear e ativismo",
    montar: () => {
      const d = base(945, 945, { cor: COR["Vermelho da gráfica"] });
      d.camadas = [
        elemento({ x: 40, y: 40, w: 865, h: 865, desenho: "carimbo", cor: COR.Pergaminho, conteudo: "Antifascista", conteudo2: "Sempre", nome: "Carimbo" }),
        elemento({ x: 302, y: 290, w: 340, h: 380, desenho: "punho", cor: COR.Pergaminho, nome: "Punho" }),
      ];
      return d;
    },
  },
  {
    id: "adesivo-palavra",
    nome: "Adesivo redondo (palavra de ordem)",
    formato: "adesivo",
    grupo: "Streetwear e ativismo",
    montar: () => {
      const d = base(945, 945, { cor: COR.Tinta });
      d.camadas = [
        forma("elipse", { x: 30, y: 30, w: 885, h: 885, preenchimento: COR.Ouro, nome: "Círculo" }),
        texto({ x: 80, y: 300, w: 785, texto: "Estude.\nOrganize.\nLute.", fonte: "sans", tamanho: 120, peso: 900, italico: true, entrelinha: 0.95, cor: COR.Tinta, alinhar: "center", maiusculas: true, nome: "Palavras" }),
      ];
      return d;
    },
  },
  {
    id: "tag-de-roupa",
    nome: "Etiqueta de roupa (tag)",
    formato: "tag",
    grupo: "Streetwear e ativismo",
    montar: () => {
      const d = base(591, 1063, { cor: COR.Papel, textura: "papel" });
      d.camadas = [
        forma("elipse", { x: 265, y: 50, w: 60, h: 60, preenchimento: COR["Pergaminho claro"], borda: COR.Tinta, espessura: 3, nome: "Furo" }),
        texto({ x: 50, y: 180, w: 491, texto: "Vista\nsua luta", fonte: "sans", tamanho: 92, peso: 900, italico: true, entrelinha: 0.92, cor: COR.Tinta, alinhar: "center", maiusculas: true, nome: "Lema" }),
        forma("estrela", { x: 245, y: 440, w: 100, h: 100, preenchimento: COR["Vermelho da gráfica"], nome: "Estrela" }),
        texto({ x: 50, y: 590, w: 491, texto: "Feita à mão por trabalhadores, com pagamento justo.", fonte: "serifa", tamanho: 32, peso: 400, entrelinha: 1.25, cor: COR.Tinta, alinhar: "center", nome: "Texto" }),
        texto({ x: 50, y: 820, w: 491, texto: "Lavar do avesso · não usar alvejante · secar à sombra", fonte: "mono", tamanho: 20, peso: 500, entrelinha: 1.4, cor: COR["Tinta suave"], alinhar: "center", maiusculas: true, nome: "Cuidados" }),
        texto({ x: 50, y: 960, w: 491, texto: "@seu.perfil", fonte: "mono", tamanho: 24, peso: 500, cor: COR["Bordô"], alinhar: "center", nome: "Perfil" }),
      ];
      return d;
    },
  },
];

export const MODELOS: Modelo[] = [...MODELOS_DA_MARCA, ...STREETWEAR];

export const GRUPOS: GrupoDeModelo[] = ["Posts", "Stories", "Carrossel", "Datas", "Impressos", "Site e vídeo", "Capas e marca", "Streetwear e ativismo"];

/** As páginas que o modelo cria (uma, ou todas as do carrossel completo). */
export const paginasDoModelo = (m: Modelo) => (m.paginas ? m.paginas() : [m.montar()]);
