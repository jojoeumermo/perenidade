// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O formulário do ato no compositor (prancha celular-escrever-ato: "Nome do ato (vira a palavra do mosaico)", Quando, Onde,
// Chamado e a prévia do mosaico apagado). Puro: confere os campos com os MESMOS limites do banco (rede_chamados e rede_publicar),
// para a pessoa ver o problema antes de mandar; o servidor confere de novo. Sem "@/" de propósito (roda no Node nos testes).
import { normalizarPalavra } from "../mosaico";
import { LIMITES_DO_ATO, type DadosDoAto } from "../tipos-atos";
import { lerLinkDeApoio, lerMeta } from "./quadros";
import { dataOk } from "./tempo";

/** O que a pessoa escreveu (antes de conferir). */
export interface CamposDoAto {
  titulo: string;
  quando: string | null;
  onde: string;
  cidade: string;
  descricao: string;
  /** Opcionais (B1): a meta de presença e o link de apoio, como a pessoa escreveu. */
  meta?: string;
  link_apoio?: string;
}

export const CAMPOS_VAZIOS: CamposDoAto = { titulo: "", quando: null, onde: "", cidade: "", descricao: "", meta: "", link_apoio: "" };

const limpo = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Confere os campos e devolve o que vai junto no rede_publicar (tipo "chamado" no banco, "Ato" na tela). `agora` vem de fora para
 * os testes. A palavra do mosaico sai do nome pela regra do banco (A–Z e espaço, 2 a 14): um nome só de números ou sinais não
 * desenha nada e por isso é recusado.
 */
export function conferirAto(c: CamposDoAto, agora: number = Date.now()): DadosDoAto {
  const titulo = limpo(c.titulo);
  const onde = limpo(c.onde);
  const cidade = limpo(c.cidade);
  const descricao = c.descricao.trim();
  const palavra = normalizarPalavra(titulo);
  const problemas: DadosDoAto["problemas"] = {};
  const L = LIMITES_DO_ATO;

  if (!titulo) problemas.titulo = "vazio";
  else if (titulo.length < L.tituloMin) problemas.titulo = "curto";
  else if (titulo.length > L.tituloMax) problemas.titulo = "longo";
  else if (palavra.replace(/ /g, "").length < 2) problemas.titulo = "palavra";

  if (!dataOk(c.quando)) problemas.quando = "vazio";
  else {
    const t = new Date(c.quando).getTime();
    if (t <= agora) problemas.quando = "passado";
    else if (t > agora + L.diasMax * 86_400_000) problemas.quando = "longe";
  }

  if (!onde) problemas.onde = "vazio";
  else if (onde.length < L.ondeMin) problemas.onde = "curto";
  else if (onde.length > L.ondeMax) problemas.onde = "longo";

  if (!cidade) problemas.cidade = "vazio";
  else if (cidade.length < L.cidadeMin) problemas.cidade = "curto";
  else if (cidade.length > L.cidadeMax) problemas.cidade = "longo";

  if (!descricao) problemas.descricao = "vazio";
  else if (descricao.length > L.descricaoMax) problemas.descricao = "longo";

  const meta = lerMeta(c.meta ?? "");
  if (meta === "numero") problemas.meta = "numero";
  const link = lerLinkDeApoio(c.link_apoio ?? "");
  if (link === "link") problemas.link_apoio = "link";

  return {
    tipo: "ato",
    titulo,
    palavra,
    quando: dataOk(c.quando) ? new Date(c.quando).toISOString() : null,
    onde,
    cidade,
    descricao,
    meta: typeof meta === "number" ? meta : null,
    link_apoio: typeof link === "string" ? link : null,
    pronto: Object.keys(problemas).length === 0,
    problemas,
  };
}

/**
 * O ponto do ato e o detalhe, quando quem chamou escreveu os dois juntos ("Praça da Sé · concentração na escadaria"): o ponto é o
 * que vai na faixa e no mapa; o detalhe só na página.
 */
export function pontoEDetalhe(onde: string): { ponto: string; detalhe: string } {
  const i = onde.indexOf(" · ");
  if (i < 0) return { ponto: onde.trim(), detalhe: "" };
  return { ponto: onde.slice(0, i).trim(), detalhe: onde.slice(i + 3).trim() };
}
