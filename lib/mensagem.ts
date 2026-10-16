// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).

// O conteúdo de uma mensagem das conversas, do lado de dentro do cifrado: o texto e o que vai junto (citação, encaminhada,
// menções, prévia de link, emoji da reação). Tudo isto é empacotado antes de assinar e cifrar: o banco nunca vê. Também
// a formatação simples (*negrito*, _itálico_, ~tachado~, `mono`, listas) e as menções @nome, lidas aqui para a tela desenhar.
//
// Este arquivo não depende do navegador, para poder ser testado no Node (scripts/testar-mensagens.mjs).

import { type Anexo, anexoValido, LIMITE_POR_MENSAGEM } from "./anexos.ts";

export interface Citacao {
  /** A mensagem citada, para a tela rolar até ela. */
  id: string;
  autor: string;
  nome: string;
  /** O começo do texto citado, guardado junto: a citação continua legível mesmo se a mensagem original sumir. */
  trecho: string;
}

export interface Previa {
  url: string;
  dominio: string;
  titulo: string;
}

export interface Conteudo {
  texto: string;
  citando?: Citacao;
  encaminhada?: boolean;
  /** As contas mencionadas com @nome. */
  mencoes?: string[];
  previa?: Previa;
  /** Numa reação: o emoji. */
  emoji?: string;
  /** Arquivos (foto, vídeo, áudio, PDF, DOCX): o texto vira a legenda. A chave de cada arquivo vai aqui dentro. */
  anexos?: Anexo[];
}

const PREFIXO = "j1.";
const EMOJIS_DE_REACAO = ["👍", "❤️", "😂", "😮", "😢", "🙏", "✊", "🌱"];
export const reacoes = EMOJIS_DE_REACAO;

/** Texto puro vai como está; o que leva algo a mais vai como JSON com o prefixo. */
export function empacotar(conteudo: Conteudo): string {
  const { texto, ...resto } = conteudo;
  const extras = Object.fromEntries(Object.entries(resto).filter(([, valor]) => valor !== undefined && valor !== false && !(Array.isArray(valor) && valor.length === 0)));
  if (Object.keys(extras).length === 0 && !texto.startsWith(PREFIXO)) return texto;
  return `${PREFIXO}${JSON.stringify({ texto, ...extras })}`;
}

const texto = (valor: unknown, maximo: number) => (typeof valor === "string" ? valor.slice(0, maximo) : "");

/** Lê o que veio: texto puro, ou o JSON. Nada de fora é confiado às cegas: cada campo é conferido e cortado. */
export function desempacotar(aberto: string): Conteudo {
  if (!aberto.startsWith(PREFIXO)) return { texto: aberto };
  try {
    const dados = JSON.parse(aberto.slice(PREFIXO.length)) as Record<string, unknown>;
    if (!dados || typeof dados !== "object") return { texto: aberto };
    const conteudo: Conteudo = { texto: texto(dados.texto, 4000) };
    const citando = dados.citando as Record<string, unknown> | undefined;
    if (citando && typeof citando === "object" && typeof citando.id === "string") {
      conteudo.citando = { id: texto(citando.id, 40), autor: texto(citando.autor, 40), nome: texto(citando.nome, 60), trecho: texto(citando.trecho, 160) };
    }
    if (dados.encaminhada === true) conteudo.encaminhada = true;
    if (Array.isArray(dados.mencoes)) conteudo.mencoes = dados.mencoes.filter((item): item is string => typeof item === "string").slice(0, 60);
    const previa = dados.previa as Record<string, unknown> | undefined;
    if (previa && typeof previa === "object" && typeof previa.url === "string" && /^https?:\/\//.test(previa.url)) {
      conteudo.previa = { url: texto(previa.url, 500), dominio: texto(previa.dominio, 100), titulo: texto(previa.titulo, 160) };
    }
    if (typeof dados.emoji === "string" && EMOJIS_DE_REACAO.includes(dados.emoji)) conteudo.emoji = dados.emoji;
    if (Array.isArray(dados.anexos)) {
      const anexos = dados.anexos.slice(0, LIMITE_POR_MENSAGEM).map(anexoValido).filter((anexo): anexo is Anexo => anexo !== null);
      if (anexos.length) conteudo.anexos = anexos;
    }
    return conteudo;
  } catch {
    return { texto: aberto };
  }
}

/** O começo de um texto, para citar ou para a lista de conversas. */
export function trechoDe(valor: string, maximo = 120): string {
  const limpo = valor.replace(/\s+/g, " ").trim();
  return limpo.length <= maximo ? limpo : `${limpo.slice(0, maximo - 1)}…`;
}

// ───────────────────────────── Menções ─────────────────────────────

export const normalizar = (valor: string) => valor.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Quem foi mencionado com @nome (o primeiro nome ou o nome inteiro, sem acento e sem diferença de maiúsculas). */
export function extrairMencoes(valor: string, membros: { id: string; nome: string }[]): string[] {
  const achados = new Set<string>();
  const texto = normalizar(valor);
  for (const membro of membros) {
    const nome = normalizar(membro.nome).trim();
    if (!nome) continue;
    const primeiro = nome.split(" ")[0];
    for (const alvo of new Set([nome, primeiro])) {
      if (alvo.length < 2) continue;
      // "@nome" seguido de fim, espaço ou pontuação.
      const padrao = new RegExp(`(^|[^\\p{L}\\p{N}])@${alvo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^\\p{L}\\p{N}])`, "u");
      if (padrao.test(texto)) achados.add(membro.id);
    }
  }
  return [...achados];
}

// ───────────────────────────── Links e prévia ─────────────────────────────

const LINK = /\bhttps?:\/\/[^\s<>"'`]+|\bwww\.[^\s<>"'`]+/gi;

export function linksDe(valor: string): string[] {
  return (valor.match(LINK) ?? []).map((link) => link.replace(/[.,;:!?)\]]+$/, "")).map((link) => (link.startsWith("www.") ? `https://${link}` : link));
}

/**
 * A prévia é feita só com o que o endereço diz, no aparelho de quem envia. Nenhum site é consultado: a política de
 * segurança do painel não deixa o navegador buscar outros sites, e o servidor do instituto nunca busca o link.
 */
export function previaDoLink(link: string): Previa | null {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const dominio = url.hostname.replace(/^www\./, "");
  const partes = url.pathname.split("/").filter(Boolean);
  const ultima = partes.length ? decodeURIComponent(partes[partes.length - 1]).replace(/[-_+]/g, " ").replace(/\.[a-z0-9]{1,5}$/i, "") : "";
  const titulo = ultima.trim() ? ultima.trim().replace(/^\w/, (letra) => letra.toUpperCase()) : dominio;
  return { url: url.toString(), dominio, titulo: titulo.slice(0, 160) };
}

// ───────────────────────────── Formatação ─────────────────────────────

export type Pedaco =
  | { tipo: "texto"; valor: string }
  | { tipo: "negrito" | "italico" | "tachado" | "mono"; valor: string }
  | { tipo: "link"; valor: string; href: string }
  | { tipo: "mencao"; valor: string; id: string }
  | { tipo: "quebra" };

export interface Linha {
  /** Item de lista ("- ", "* " ou "1. "), com o número quando for numerada. */
  item?: { numero?: number };
  pedacos: Pedaco[];
}

const MARCAS: Record<string, "negrito" | "italico" | "tachado" | "mono"> = { "*": "negrito", _: "italico", "~": "tachado", "`": "mono" };

/** Quebra uma linha em pedaços: marcas de formatação, links e menções. As marcas só valem coladas ao texto, como no WhatsApp. */
function pedacosDe(valor: string, membros: { id: string; nome: string }[]): Pedaco[] {
  const saida: Pedaco[] = [];
  let i = 0;
  let solto = "";
  const despejar = () => {
    if (!solto) return;
    for (const pedaco of textoComLinksEMencoes(solto, membros)) saida.push(pedaco);
    solto = "";
  };
  while (i < valor.length) {
    const marca = valor[i];
    const tipo = MARCAS[marca];
    const antes = i === 0 ? " " : valor[i - 1];
    if (tipo && /[\s(\[{"'>]|^$/.test(antes) && i + 1 < valor.length && !/\s/.test(valor[i + 1])) {
      // Procura o fechamento na mesma linha, colado ao texto e seguido de fim, espaço ou pontuação.
      let fim = valor.indexOf(marca, i + 1);
      while (fim !== -1 && (/\s/.test(valor[fim - 1]) || (fim + 1 < valor.length && /[\p{L}\p{N}]/u.test(valor[fim + 1])))) fim = valor.indexOf(marca, fim + 1);
      if (fim !== -1 && fim > i + 1) {
        despejar();
        const dentro = valor.slice(i + 1, fim);
        if (tipo === "mono") saida.push({ tipo, valor: dentro });
        else saida.push({ tipo, valor: dentro });
        i = fim + 1;
        continue;
      }
    }
    solto += marca;
    i++;
  }
  despejar();
  // Pedaços de texto vizinhos viram um só.
  return saida.reduce<Pedaco[]>((lista, pedaco) => {
    const anterior = lista[lista.length - 1];
    if (pedaco.tipo === "texto" && anterior?.tipo === "texto") anterior.valor += pedaco.valor;
    else lista.push(pedaco);
    return lista;
  }, []);
}

function textoComLinksEMencoes(valor: string, membros: { id: string; nome: string }[]): Pedaco[] {
  const saida: Pedaco[] = [];
  const nomes = membros
    .flatMap((membro) => {
      const inteiro = membro.nome.trim();
      const primeiro = inteiro.split(/\s+/)[0] ?? "";
      return [...new Set([inteiro, primeiro])].filter((nome) => nome.length >= 2).map((nome) => ({ id: membro.id, nome }));
    })
    .sort((a, b) => b.nome.length - a.nome.length);
  const regex = new RegExp(`${LINK.source}|@(${nomes.map((item) => item.nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") || "(?!)"})(?=$|[^\\p{L}\\p{N}])`, "giu");
  let ultimo = 0;
  for (const achado of valor.matchAll(regex)) {
    const indice = achado.index ?? 0;
    if (indice > ultimo) saida.push({ tipo: "texto", valor: valor.slice(ultimo, indice) });
    const bruto = achado[0];
    if (bruto.startsWith("@")) {
      const alvo = nomes.find((item) => normalizar(item.nome) === normalizar(bruto.slice(1)));
      if (alvo) saida.push({ tipo: "mencao", valor: bruto, id: alvo.id });
      else saida.push({ tipo: "texto", valor: bruto });
    } else {
      const cauda = /[.,;:!?)\]]+$/.exec(bruto)?.[0] ?? "";
      const link = bruto.slice(0, bruto.length - cauda.length);
      saida.push({ tipo: "link", valor: link, href: link.startsWith("www.") ? `https://${link}` : link });
      if (cauda) saida.push({ tipo: "texto", valor: cauda });
    }
    ultimo = indice + bruto.length;
  }
  if (ultimo < valor.length) saida.push({ tipo: "texto", valor: valor.slice(ultimo) });
  return saida;
}

/** O texto de uma mensagem, pronto para a tela desenhar: linhas (com itens de lista) de pedaços formatados. */
export function formatar(valor: string, membros: { id: string; nome: string }[] = []): Linha[] {
  return valor.split("\n").map((linha) => {
    const item = /^(?:[-*•]\s+|(\d{1,2})[.)]\s+)/.exec(linha);
    if (item) return { item: { numero: item[1] ? Number(item[1]) : undefined }, pedacos: pedacosDe(linha.slice(item[0].length), membros) };
    return { pedacos: pedacosDe(linha, membros) };
  });
}

/** O texto sem as marcas de formatação, para a lista de conversas e as citações. */
export function semFormatacao(valor: string): string {
  return formatar(valor)
    .map((linha) => linha.pedacos.map((pedaco) => ("valor" in pedaco ? pedaco.valor : "")).join(""))
    .join("\n");
}
