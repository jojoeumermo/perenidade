// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).

// O projeto do estúdio: uma ou mais páginas (o carrossel de verdade), a legenda do post, o texto alternativo de cada
// página, as variáveis ({link}, {arroba}, {data}...), os estilos de texto ligados e a paleta da campanha. Trabalhos
// antigos (uma página só, versão 1) abrem como projeto de uma página.

import { type Camada, type CamadaTexto, COR, type Documento, novoId } from "./motor";

export interface EstiloDeTexto {
  id: string;
  nome: string;
  fonte: CamadaTexto["fonte"];
  tamanho: number;
  peso: CamadaTexto["peso"];
  italico: boolean;
  cor: string;
  entrelinha: number;
  espacamento: number;
  maiusculas: boolean;
}

export interface Projeto {
  v: 2;
  paginas: Documento[];
  /** A legenda do post (até 2.200 caracteres no Instagram). */
  legenda: string;
  variaveis: Record<string, string>;
  estilos: EstiloDeTexto[];
  /** Cores guardadas desta campanha, além da paleta da marca. */
  paleta: string[];
  /** Duração do vídeo (animação), em segundos. */
  duracao: number;
  /** Idioma dos textos da arte (para as versões em outra língua). */
  idioma: string;
}

export const LIMITE_DA_LEGENDA = 2200;

/** As variáveis que toda arte já tem; quem usa pode mudar o valor e criar outras. */
export const VARIAVEIS_PADRAO: Record<string, string> = {
  link: "institutolucia.org",
  arroba: "@institutoluciaorg",
  data: "",
  hora: "19h",
  local: "",
  // Os números do site: o estúdio atualiza com os de agora ao abrir (veja numerosDoSite).
  disciplinas: "61",
  obras: "300",
};

/** Os estilos da marca (títulos, subtítulo, corpo, etiqueta, rodapé): ligados, mudam em todas as páginas juntos. */
export const ESTILOS_DA_MARCA: EstiloDeTexto[] = [
  { id: "titulo", nome: "Título", fonte: "serifa", tamanho: 120, peso: 600, italico: false, cor: COR.Tinta, entrelinha: 0.95, espacamento: -0.02, maiusculas: false },
  { id: "subtitulo", nome: "Subtítulo", fonte: "serifa", tamanho: 48, peso: 400, italico: false, cor: COR["Tinta suave"], entrelinha: 1.22, espacamento: 0, maiusculas: false },
  { id: "corpo", nome: "Corpo", fonte: "serifa", tamanho: 36, peso: 400, italico: false, cor: COR.Tinta, entrelinha: 1.3, espacamento: 0, maiusculas: false },
  { id: "etiqueta", nome: "Etiqueta", fonte: "mono", tamanho: 22, peso: 500, italico: false, cor: COR["Bordô"], entrelinha: 1.2, espacamento: 0.2, maiusculas: true },
  { id: "chamada", nome: "Chamada pesada", fonte: "sans", tamanho: 96, peso: 900, italico: true, cor: COR.Tinta, entrelinha: 0.92, espacamento: -0.02, maiusculas: true },
  { id: "rodape", nome: "Rodapé", fonte: "mono", tamanho: 21, peso: 500, italico: false, cor: COR["Bordô"], entrelinha: 1.2, espacamento: 0.14, maiusculas: true },
];

export const CAMPOS_DO_ESTILO = ["fonte", "tamanho", "peso", "italico", "cor", "entrelinha", "espacamento", "maiusculas"] as const;

export function projetoNovo(paginas: Documento[]): Projeto {
  return {
    v: 2,
    paginas: paginas.map((p) => ({ ...p, id: p.id ?? novoId() })),
    legenda: "",
    variaveis: { ...VARIAVEIS_PADRAO },
    estilos: ESTILOS_DA_MARCA.map((e) => ({ ...e })),
    paleta: [],
    duracao: 6,
    idioma: "pt-BR",
  };
}

/** Lê o que veio do banco (projeto novo ou documento antigo) e completa o que faltar. */
export function paraProjeto(dados: unknown): Projeto {
  const d = (dados ?? {}) as Partial<Projeto> & Partial<Documento>;
  if (d.v === 2 && Array.isArray(d.paginas) && d.paginas.length) {
    const p = projetoNovo(d.paginas as Documento[]);
    return {
      ...p,
      legenda: typeof d.legenda === "string" ? d.legenda : "",
      variaveis: { ...VARIAVEIS_PADRAO, ...(d.variaveis ?? {}) },
      estilos: Array.isArray(d.estilos) && d.estilos.length ? d.estilos : p.estilos,
      paleta: Array.isArray(d.paleta) ? d.paleta.filter((c) => typeof c === "string").slice(0, 24) : [],
      duracao: typeof d.duracao === "number" ? Math.min(30, Math.max(2, d.duracao)) : 6,
      idioma: typeof d.idioma === "string" ? d.idioma : "pt-BR",
    };
  }
  if (d.v === 1 && Array.isArray(d.camadas) && typeof d.w === "number") return projetoNovo([d as Documento]);
  return projetoNovo([]);
}

/** As variáveis valendo numa página: as do projeto mais {pagina} e {total} (com zero à esquerda: 03 / 09). */
export function variaveisDaPagina(p: Projeto, indice: number): Record<string, string> {
  const total = p.paginas.length;
  const casas = total >= 10 ? 2 : 2;
  const data = p.variaveis.data || new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
  return { ...p.variaveis, data, pagina: String(indice + 1).padStart(casas, "0"), total: String(total).padStart(casas, "0") };
}

/** Aplica um estilo (já mudado) em todas as camadas ligadas a ele, em todas as páginas. */
export function aplicarEstilo(p: Projeto, estilo: EstiloDeTexto, ajustar: (c: Camada) => Camada): Projeto {
  return {
    ...p,
    estilos: p.estilos.map((e) => (e.id === estilo.id ? estilo : e)),
    paginas: p.paginas.map((pagina) => ({
      ...pagina,
      camadas: pagina.camadas.map((c) => {
        if (c.tipo !== "texto" || c.estilo !== estilo.id) return c;
        const proporcao = c.tamanho / (p.estilos.find((e) => e.id === estilo.id)?.tamanho || c.tamanho);
        const nova: CamadaTexto = { ...c };
        for (const campo of CAMPOS_DO_ESTILO) (nova as unknown as Record<string, unknown>)[campo] = estilo[campo];
        // Num formato diferente o tamanho acompanha a proporção que a camada já tinha em relação ao estilo.
        nova.tamanho = Math.round(estilo.tamanho * (Number.isFinite(proporcao) && proporcao > 0 ? proporcao : 1));
        return ajustar(nova);
      }),
    })),
  };
}

/** O estilo tirado de uma camada (para "criar estilo a partir desta camada"). */
export const estiloDaCamada = (c: CamadaTexto, nome: string): EstiloDeTexto => ({
  id: novoId(),
  nome,
  fonte: c.fonte,
  tamanho: c.tamanho,
  peso: c.peso,
  italico: c.italico,
  cor: c.cor,
  entrelinha: c.entrelinha,
  espacamento: c.espacamento,
  maiusculas: c.maiusculas,
});

// ───── Temas de um clique ─────

export interface Tema {
  id: string;
  nome: string;
  descricao: string;
  /** Fundo, texto principal, texto de apoio, destaque, faixas. */
  cores: { fundo: string; texto: string; apoio: string; destaque: string; faixa: string };
  pontilhado: boolean;
  textura: "" | "papel" | "serigrafia";
}

export const TEMAS: Tema[] = [
  { id: "marca", nome: "Marca (pergaminho)", descricao: "O padrão do instituto: pergaminho, tinta e bordô.", cores: { fundo: COR.Pergaminho, texto: COR.Tinta, apoio: COR["Tinta suave"], destaque: COR["Bordô"], faixa: COR["Bordô"] }, pontilhado: true, textura: "" },
  { id: "campanha", nome: "Campanha", descricao: "Vermelho da gráfica, letra clara e faixas pretas.", cores: { fundo: COR["Vermelho da gráfica"], texto: COR.Pergaminho, apoio: COR["Ouro claro"], destaque: COR.Tinta, faixa: COR.Tinta }, pontilhado: false, textura: "serigrafia" },
  { id: "memoria", nome: "Memória e luto", descricao: "Preto de arquivo e ouro: respeito, sem ser triste.", cores: { fundo: COR["Preto de arquivo"], texto: COR.Pergaminho, apoio: COR.Fio, destaque: COR.Ouro, faixa: COR.Ouro }, pontilhado: false, textura: "papel" },
  { id: "festa", nome: "Festa", descricao: "Ouro claro com vermelho vivo, para comemorar.", cores: { fundo: COR["Ouro claro"], texto: COR.Tinta, apoio: COR["Ouro escuro"], destaque: COR["Vermelho vivo"], faixa: COR["Vermelho vivo"] }, pontilhado: true, textura: "" },
  { id: "urgencia", nome: "Urgência", descricao: "Preto e vermelho vivo, alto contraste, para avisos.", cores: { fundo: COR.Tinta, texto: COR.Branco, apoio: COR.Fio, destaque: COR["Vermelho vivo"], faixa: COR["Vermelho vivo"] }, pontilhado: false, textura: "" },
  { id: "papel", nome: "Papel de jornal", descricao: "Papel envelhecido e tinta, como o jornal impresso.", cores: { fundo: COR.Papel, texto: COR.Tinta, apoio: COR["Tinta suave"], destaque: COR["Vermelho da gráfica"], faixa: COR.Tinta }, pontilhado: false, textura: "papel" },
];

const claro = (cor: string) => {
  const m = /^#([0-9a-f]{6})$/i.exec(cor);
  if (!m) return true;
  const n = parseInt(m[1], 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 150;
};

/**
 * Troca as cores da página pelas do tema, pelo papel de cada cor: o que era cor de texto principal vira o texto do
 * tema, o que era bordô/vermelho vira o destaque, faixas e formas escuras viram a faixa. Fotos não mudam.
 */
export function aplicarTema(doc: Documento, tema: Tema): Documento {
  const t = tema.cores;
  const papelDaCor = (cor: string, emTexto: boolean): string => {
    const c = cor.toLowerCase();
    if (!c || c === "transparent") return cor;
    if ([COR["Bordô"], COR["Vermelho da gráfica"], COR["Vermelho vivo"], COR.Ouro, COR["Ouro escuro"]].includes(c)) return t.destaque;
    if ([COR["Tinta suave"], COR.Fio, COR["Ouro claro"]].includes(c)) return t.apoio;
    if (emTexto) return claro(c) === claro(doc.fundo.cor) ? t.fundo : t.texto;
    return claro(c) === claro(doc.fundo.cor) ? t.fundo : t.faixa;
  };
  return {
    ...doc,
    fundo: {
      ...doc.fundo,
      cor: t.fundo,
      gradiente: null,
      pontilhado: tema.pontilhado,
      textura: tema.textura,
      bordaCima: doc.fundo.bordaCima ? t.faixa : "",
      bordaBaixo: doc.fundo.bordaBaixo ? t.faixa : "",
    },
    camadas: doc.camadas.map((c): Camada => {
      if (c.tipo === "texto") return { ...c, cor: papelDaCor(c.cor, true), fundo: c.fundo ? papelDaCor(c.fundo, false) : "", destaque: t.destaque };
      if (c.tipo === "marca") return { ...c, cor: claro(t.fundo) ? t.texto : t.texto, fundo: t.destaque };
      if (c.tipo === "elemento") return { ...c, cor: papelDaCor(c.cor, false) };
      if (c.tipo === "imagem") return { ...c, borda: c.borda ? t.texto : "" };
      return { ...c, preenchimento: papelDaCor(c.preenchimento, false), borda: c.borda ? papelDaCor(c.borda, false) : "" };
    }),
  };
}

// ───── Datas do calendário ─────

export interface DataDoCalendario {
  dia: number;
  mes: number;
  nome: string;
  sugestao: string;
  modelo: string;
}

/** As datas do calendário editorial do instituto (dia e mês), com o modelo sugerido. */
export const DATAS: DataDoCalendario[] = [
  { dia: 8, mes: 3, nome: "Dia Internacional da Mulher", sugestao: "Mulheres que fazem o instituto, ou uma pensadora do acervo.", modelo: "post-memoria" },
  { dia: 1, mes: 5, nome: "Dia do Trabalhador", sugestao: "Educação popular é direito de quem trabalha.", modelo: "post-edicao-extra" },
  { dia: 5, mes: 5, nome: "Lúcia, presente!", sugestao: "A memória de Lúcia, que dá nome ao instituto.", modelo: "post-memoria" },
  { dia: 19, mes: 9, nome: "Paulo Freire (nascimento)", sugestao: "Uma frase de Paulo Freire e um convite para estudar.", modelo: "quadrado-frase" },
  // O dia em que o site abriu ao público (o mesmo de site.historyFrom).
  { dia: 11, mes: 10, nome: "Aniversário do Instituto Lúcia", sugestao: "Os números do ano e um obrigado a quem fez acontecer.", modelo: "post-numeros" },
  { dia: 15, mes: 10, nome: "Dia do Professor", sugestao: "Agradecer quem ensina de graça no instituto.", modelo: "post-lista" },
  { dia: 20, mes: 11, nome: "Dia da Consciência Negra", sugestao: "Zumbi, Dandara e as lutas do povo negro no acervo.", modelo: "post-edicao-extra" },
];

/** As próximas datas a partir de hoje (as do ano seguinte quando as deste já passaram). */
export function proximasDatas(hoje = new Date(), quantas = 3): (DataDoCalendario & { quando: Date; faltam: number })[] {
  const zero = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return DATAS.map((d) => {
    let quando = new Date(zero.getFullYear(), d.mes - 1, d.dia);
    if (quando < zero) quando = new Date(zero.getFullYear() + 1, d.mes - 1, d.dia);
    return { ...d, quando, faltam: Math.round((quando.getTime() - zero.getTime()) / 86_400_000) };
  })
    .sort((a, b) => a.faltam - b.faltam)
    .slice(0, quantas);
}
