// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Fonte } from "../tipos";

export type PontaDaAgulha = "universal" | "bola" | "jeans";

export interface Tecido {
  id: string;
  nome: string;
  descricao: string;
  /** Números métricos (NM) de agulha que servem a esse tecido. */
  tamanhos: number[];
  ponta: PontaDaAgulha;
  retorno: string;
}

export const TAMANHOS = [70, 80, 90, 100] as const;

export const PONTAS: { id: PontaDaAgulha; nome: string }[] = [
  { id: "universal", nome: "Ponta comum (universal)" },
  { id: "bola", nome: "Ponta bola (para malha)" },
  { id: "jeans", nome: "Agulha para jeans (ponta forte)" },
];

/**
 * O número da agulha é o diâmetro em centésimos de milímetro (70 = 0,70 mm). Tecido fino pede agulha fina; tecido pesado, grossa;
 * malha pede ponta bola, que afasta os fios em vez de cortá-los. Fonte: Wikipédia (Sewing machine needle), conferida em 2026-11.
 */
export const TECIDOS: Tecido[] = [
  { id: "seda", nome: "Seda fina e chiffon", descricao: "Tecido muito leve e escorregadio.", tamanhos: [70], ponta: "universal", retorno: "A agulha de 0,70 mm passa sem abrir buracos visíveis." },
  { id: "algodao", nome: "Algodão leve (tricoline)", descricao: "Camisa, forro, roupa de verão.", tamanhos: [80], ponta: "universal", retorno: "A agulha 80 é a indicada para algodão e sintéticos leves." },
  { id: "malha", nome: "Malha de algodão (camiseta)", descricao: "Tecido que estica e é tecido em laçadas, não em trama.", tamanhos: [80, 90], ponta: "bola", retorno: "A ponta bola afasta as laçadas da malha em vez de cortá-las, e o tecido não fica com fios puxados nem falhas." },
  { id: "linho", nome: "Linho e veludo", descricao: "Tecido de peso médio.", tamanhos: [90], ponta: "universal", retorno: "A agulha 90 é a de peso médio, boa para linho e veludo." },
  { id: "jeans", nome: "Jeans grosso e lona", descricao: "Tecido pesado, trama bem apertada.", tamanhos: [100], ponta: "jeans", retorno: "Agulha de 1,00 mm e ponta forte: atravessa a trama apertada sem entortar nem quebrar." },
];

export interface Veredito {
  ok: boolean;
  motivos: string[];
}

export function avaliarAgulha(t: Tecido, tamanho: number, ponta: PontaDaAgulha): Veredito {
  const motivos: string[] = [];
  if (!t.tamanhos.includes(tamanho)) {
    motivos.push(tamanho < Math.min(...t.tamanhos) ? "A agulha está fina demais para esse tecido: pode entortar ou quebrar." : "A agulha está grossa demais para esse tecido: deixa buracos e marca o pano.");
  }
  if (ponta !== t.ponta) {
    motivos.push(t.ponta === "bola" ? "Malha pede ponta bola; ponta comum pode cortar as laçadas." : t.ponta === "jeans" ? "Pano pesado pede agulha para jeans, de ponta forte." : "Para esse tecido, a ponta comum é a certa; a ponta especial não ajuda.");
  }
  return { ok: motivos.length === 0, motivos };
}

/** O corte da costura visto de lado: onde o fio de cima se encontra com o de baixo. */
export type Ponto = "no-meio" | "em-cima" | "em-baixo";

export interface CasoDeTensao {
  id: string;
  /** O que a pessoa vê no tecido. */
  sintoma: string;
  /** Onde o ponto se encontra no corte. */
  ponto: Ponto;
  /** A ação certa no botão de tensão do fio de cima. */
  acao: "apertar" | "afrouxar" | "manter";
  explicacao: string;
}

/**
 * Sintomas conforme a página de ajuda da Brother (help.brother-usa.com, "Bobbin thread is showing on the top of the fabric"):
 * tensão do fio de cima apertada demais deixa o fio da bobina aparecer em cima; frouxa demais, o fio de cima aparece atrás.
 * Antes de mexer no botão, o certo é reenfiar a máquina. O ponto equilibrado fica no meio da espessura (Wikipédia, Lockstitch).
 */
export const CASOS_DE_TENSAO: CasoDeTensao[] = [
  {
    id: "bobina-em-cima",
    sintoma: "O fio da bobina (de baixo) aparece em cima, no direito do tecido.",
    ponto: "em-cima",
    acao: "afrouxar",
    explicacao: "A tensão do fio de cima está apertada demais e puxa o encontro dos fios para cima. Afrouxe o botão aos poucos e teste de novo em um retalho. Antes de mexer, reenfie a máquina com o calcador levantado.",
  },
  {
    id: "laco-atras",
    sintoma: "O fio de cima forma laçadas soltas no avesso, no lado de baixo do tecido.",
    ponto: "em-baixo",
    acao: "apertar",
    explicacao: "A tensão do fio de cima está frouxa demais e o encontro dos fios cai para baixo. Aperte o botão aos poucos. Antes, confira o enfiamento da máquina.",
  },
  {
    id: "equilibrado",
    sintoma: "Os dois lados mostram só o fio de cima e o fio de baixo, retos, sem laçadas.",
    ponto: "no-meio",
    acao: "manter",
    explicacao: "Ponto equilibrado: o fio de cima se encontra com o de baixo no meio da espessura do tecido. Não mexa em nada: ajuste só quando houver sintoma.",
  },
];

export const FONTES_PONTO: Fonte[] = [
  { nome: "Sewing machine needle (Wikipédia, CC BY-SA 4.0)", url: "https://en.wikipedia.org/wiki/Sewing_machine_needle" },
  { nome: "Lockstitch (Wikipédia, CC BY-SA 4.0)", url: "https://en.wikipedia.org/wiki/Lockstitch" },
  { nome: "Bobbin thread is showing on the top of the fabric (Brother, central de ajuda)", url: "https://help.brother-usa.com/app/answers/detail/a_id/64799/~/bobbin-thread-is-showing-on-the-top-of-the-fabric" },
];
