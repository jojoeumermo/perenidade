// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As áreas do site que a coordenação pode interditar e os caminhos de cada uma. A mesma lista de nomes mora no banco
// (interno.areas_publicas, em supabase/install.sql): `npm run testar:interdicao` falha se as duas divergirem.
// Sem os atalhos "@/" de propósito: o roteiro de conferência roda este arquivo direto no Node.

/** Cada área e os caminhos (depois do idioma) que ela fecha. Área nova: acrescente aqui, no banco e no painel. */
export const areasPublicas = [
  { id: "comunidade", nome: "Comunidade", caminhos: ["/comunidade"] },
  { id: "mural", nome: "Mural dos Trabalhadores", caminhos: ["/mural"] },
  { id: "reforco", nome: "Aula de reforço", caminhos: ["/reforco"] },
  { id: "contribuir", nome: "Contribuir e denunciar", caminhos: ["/contribuir", "/denunciar"] },
  { id: "jornal", nome: "Jornal, notícias e boletim", caminhos: ["/jornal", "/noticias"] },
  { id: "radio", nome: "Rádio e podcasts", caminhos: ["/radio", "/podcasts"] },
  { id: "acervo", nome: "Acervo, catálogo e autores", caminhos: ["/acervo", "/catalogo", "/autores"] },
  { id: "estudo", nome: "Disciplinas, trilhas e aulas", caminhos: ["/trilhas", "/estantes", "/avulsos", "/comecar", "/perguntas", "/ao-vivo", "/questoes"] },
  { id: "ferramentas", nome: "Ferramentas de prática e caderno", caminhos: ["/ferramentas", "/caderno", "/laboratorios", "/estudio-de-pratica"] },
  { id: "memoria", nome: "Memorial, galeria e linha do tempo", caminhos: ["/memorial", "/galeria", "/linha-do-tempo", "/dedicatoria"] },
  { id: "debate", nome: "Debates, checagens, falácias e glossário", caminhos: ["/debates", "/checagens", "/falacias", "/glossario"] },
  { id: "materiais", nome: "Materiais de campanha", caminhos: ["/materiais"] },
  { id: "dados", nome: "Dados do povo", caminhos: ["/dados"] },
  { id: "videos", nome: "Vídeos e videoaulas", caminhos: ["/videos", "/videoaulas"] },
  { id: "voluntariado", nome: "Voluntariado e apoio", caminhos: ["/voluntarios", "/apoie"] },
  { id: "busca", nome: "Busca", caminhos: ["/busca"] },
  { id: "gaveta", nome: "Gaveta Aberta", caminhos: ["/gaveta"] },
] as const;

export type AreaPublica = (typeof areasPublicas)[number]["id"];

/** O que o expurgo pode limpar: só o que o público escreve (igual a interno.areas_expurgo). */
export const areasDeExpurgo = [
  { id: "comunidade", nome: "Comunidade: conversas, respostas e votos" },
  { id: "mural", nome: "Mural dos Trabalhadores: anúncios" },
  { id: "anotacoes", nome: "Anotações públicas das aulas" },
  { id: "reforco", nome: "Pedidos de reforço não concluídos" },
  { id: "contribuicoes", nome: "Contribuições do público esperando a triagem" },
  { id: "gaveta", nome: "Gaveta Aberta: trabalhos enviados" },
] as const;

export interface EstadoDaInterdicao {
  geral: boolean;
  areas: string[];
  mensagem: string;
}

export const semInterdicao: EstadoDaInterdicao = { geral: false, areas: [], mensagem: "" };

/** Sempre abertos, mesmo com o site inteiro fora do ar: a entrada e o painel (para a equipe poder religar) e a própria página fantasma. */
const sempreAbertos = ["/entrar", "/painel", "/fora-do-ar"];
const idiomas = ["pt", "en", "es", "zh", "ru"];

/** Separa o idioma do resto do caminho: "/en/comunidade/x" → ["en", "/comunidade/x"]. Sem idioma, vale o português. */
export function semIdioma(caminho: string): [string, string] {
  const [, primeiro = "", ...resto] = caminho.split("/");
  if (idiomas.includes(primeiro)) return [primeiro, `/${resto.join("/")}`.replace(/\/+$/, "") || "/"];
  return ["pt", caminho.replace(/\/+$/, "") || "/"];
}

const dentro = (caminho: string, prefixo: string) => caminho === prefixo || caminho.startsWith(`${prefixo}/`);

/** A área a que um caminho (já sem o idioma) pertence, ou null para as páginas gerais (início, sobre, guia…). */
export function areaDoCaminho(caminho: string): AreaPublica | null {
  return areasPublicas.find((area) => area.caminhos.some((prefixo) => dentro(caminho, prefixo)))?.id ?? null;
}

/**
 * O caminho pedido está fechado agora? Devolve "geral" (o site inteiro fora do ar), a área interditada, ou null.
 * Arquivos (qualquer caminho com extensão) e os sempre abertos nunca fecham.
 */
export function fechado(caminhoCompleto: string, estado: EstadoDaInterdicao): AreaPublica | "geral" | null {
  const [, caminho] = semIdioma(caminhoCompleto);
  if (sempreAbertos.some((prefixo) => dentro(caminho, prefixo))) return null;
  if (/\.[a-z0-9]+$/i.test(caminho)) return null;
  if (estado.geral) return "geral";
  const area = areaDoCaminho(caminho);
  return area && estado.areas.includes(area) ? area : null;
}

/** Lê o pedaço "interdicao" da resposta de site(); qualquer coisa estranha vale como site aberto. */
export function lerEstado(resposta: unknown): EstadoDaInterdicao {
  const bruto = (resposta as { interdicao?: unknown } | null)?.interdicao as Partial<EstadoDaInterdicao> | undefined;
  if (!bruto || typeof bruto !== "object") return semInterdicao;
  return {
    geral: bruto.geral === true,
    areas: Array.isArray(bruto.areas) ? bruto.areas.filter((area): area is string => typeof area === "string") : [],
    mensagem: typeof bruto.mensagem === "string" ? bruto.mensagem.slice(0, 300) : "",
  };
}
