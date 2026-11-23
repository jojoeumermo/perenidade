// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Item 46 (Prompt 4): "Você está em dia". Uma ESCOLHA de cada pessoa, neste aparelho (desligada por padrão: a rolagem contínua do
// A20 continua sendo o que a linha faz). Ligada, a linha das abas principais para no primeiro post que a pessoa já tinha visto na
// visita anterior: mostra "Você está em dia" e só segue com "Ver mais antigos". O marco é o post mais novo que a linha mostrou da
// última vez, guardado só aqui (por aba). Nada vai ao servidor. Sem "@/" de propósito (roda nos testes).
import { gravarNoAparelho, lerDoAparelho, type Guarda } from "./aparelho";

/** A pessoa escolheu parar quando estiver em dia? */
export function emDiaEscolhido(g?: Guarda | null): boolean {
  return lerDoAparelho<boolean>("em-dia", g) === true;
}
export function escolherEmDia(sim: boolean, g?: Guarda | null): void {
  gravarNoAparelho("em-dia", sim ? true : null, g);
}

/** Vale para esta aba? Só as abas principais da linha (sem ":"), sem uma regra montada por cima. */
export function abaComEmDia(aba: string, comRegra: boolean): boolean {
  return !aba.includes(":") && !comRegra;
}

/** O marco desta aba (ISO do post mais novo mostrado da última vez), ou nulo na primeira vez. */
export function marcoDaAba(aba: string, g?: Guarda | null): string | null {
  const v = lerDoAparelho<string>(`visto:${aba}`, g);
  return typeof v === "string" && !Number.isNaN(Date.parse(v)) ? v : null;
}

/** Guarda o novo marco (só avança: um post antigo nunca puxa o marco para trás). */
export function guardarMarco(aba: string, itens: readonly { criado_em: string }[], g?: Guarda | null): void {
  const maisNovo = itens.reduce<string | null>((m, p) => (!m || Date.parse(p.criado_em) > Date.parse(m) ? p.criado_em : m), null);
  if (!maisNovo) return;
  const atual = marcoDaAba(aba, g);
  if (!atual || Date.parse(maisNovo) > Date.parse(atual)) gravarNoAparelho(`visto:${aba}`, maisNovo, g);
}

/**
 * Onde a linha para: o índice do primeiro post já visto (criado até o marco), ou nulo quando nenhum post carregado é antigo (a linha
 * continua carregando até achar um). Sem marco (primeira vez), nunca para.
 */
export function ondeParar(itens: readonly { criado_em: string }[], marco: string | null): number | null {
  if (!marco) return null;
  const m = Date.parse(marco);
  const i = itens.findIndex((p) => Date.parse(p.criado_em) <= m);
  return i < 0 ? null : i;
}
