// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O B1 das organizações (supabase/migracoes/20261110-alumia-b1-perfil-org.sql): os tipos do que as funções rede_org_* novas
// devolvem e as regras puras que a tela usa antes de mandar (o banco confere tudo de novo). Sem "@/" de propósito (roda no Node
// nos testes: scripts/testar-alumia-b1-perfil-org.mjs).
//
// Privacidade (PLANO-ALUMIA §6; LGPD art. 5º, II e art. 11: filiação e opinião política são dado sensível):
//  - quem ocupa uma função só vem para quem é de dentro (gestor ou membro de núcleo); de fora, `ocupantes` é nulo;
//  - na Ata Viva, a pessoa recebe só a PRÓPRIA posição e o lugar; a fila por codinome só vem para a mesa, e some quando a ata fecha;
//  - os sinais de consenso só viram mosaico a partir de 3 (`mosaico` nulo abaixo), em passos de 10 %; nada individual fica guardado;
//  - o caixa nunca traz quem lançou, quem conferiu nem quem doou.
import { pareceDadoPessoal } from "../atos/quadros";

export type Permissao = "caixa" | "mesa" | "tear" | "avisos" | "arquivos";
export const PERMISSOES: readonly Permissao[] = ["caixa", "mesa", "tear", "avisos", "arquivos"];
export type TipoDeFuncao = "tesouraria" | "comunicacao" | "seguranca" | "secretaria" | "formacao" | "coordenacao" | "outra";
export const TIPOS_DE_FUNCAO: readonly TipoDeFuncao[] = ["tesouraria", "comunicacao", "seguranca", "secretaria", "formacao", "coordenacao", "outra"];
/** As permissões que cada tipo sugere ao criar (quem gerencia pode mudar). */
export const PERMISSOES_SUGERIDAS: Record<TipoDeFuncao, Permissao[]> = {
  tesouraria: ["caixa"], comunicacao: ["avisos"], seguranca: [], secretaria: ["tear"], formacao: ["arquivos"], coordenacao: ["mesa", "tear"], outra: [],
};

export interface Ocupante { mandato: string; handle: string; codinome: string; fim: string; origem: "nomeacao" | "eleicao"; eu: boolean }
export interface FuncaoDaOrg { id: string; tipo: TipoDeFuncao; nome: string; permissoes: Permissao[]; vagas: number; ocupantes: Ocupante[] | null }
export interface MinhaFuncao { funcao: string; nome: string; fim: string; mandato: string; permissoes: Permissao[] }
export interface FuncoesDaOrg { dentro: boolean; gerencio: boolean; funcoes: FuncaoDaOrg[]; minhas: MinhaFuncao[] }

export interface ConsultaDaEleicao {
  id: string; metodo: "ranqueada"; prazo: string; situacao: "aberta" | "fechada"; votantes: number | null; quorumAtingido: boolean | null;
  possoVotar: boolean; votei: boolean; opcoes: { id: string; texto: string; proporcao: number | null }[];
}
export interface EleicaoDaOrg {
  id: string; funcao: { id: string; nome: string; tipo: TipoDeFuncao }; inscricoesAte: string; prazo: string; mandatoFim: string; quorum: number | null;
  situacao: "inscricoes" | "votacao" | "apurada" | "vazia" | "sem_quorum";
  candidatos: { handle: string; codinome: string; eu: boolean }[]; souCandidata: boolean; possoCandidatar: boolean;
  consulta: ConsultaDaEleicao | null; eleita: { handle: string; codinome: string } | null;
}

export type Posicao = "favor" | "contra" | "esclarecimento";
export const POSICOES: readonly Posicao[] = ["favor", "contra", "esclarecimento"];
export type Sinal = "concordo" | "duvida" | "bloqueio" | "abstencao";
export const SINAIS: readonly Sinal[] = ["concordo", "duvida", "bloqueio", "abstencao"];
export type CarimboDaAta = "aprovado" | "retirado" | "vai_a_base";
export const CARIMBOS: readonly CarimboDaAta[] = ["aprovado", "retirado", "vai_a_base"];

/** O agregado dos sinais (proporções em passos de 10 %), só a partir de 3. */
export interface MosaicoDosSinais { concordo: number; duvida: number; bloqueio: number; abstencao: number; pessoas?: number | null }
export interface PontoDaAta { id: string; ordem: number; texto: string; carimbo: CarimboDaAta | null; deliberacao: string; carimbadoEm: string | null; sinais: MosaicoDosSinais | null }
export interface AtaViva {
  id: string; titulo: string; situacao: "aberta" | "fechada"; abertaEm: string; fechadaEm: string | null; post: string | null;
  org: { handle: string; codinome: string }; plenaria: string | null; souMesa: boolean; dentro: boolean;
  pontoAtual: string | null; falaSegundos: number;
  fala: { desde: string; posicao: Posicao; quem: string | null; souEu: boolean } | null;
  minha: { posicao: Posicao; lugar: number } | null;
  naFila: number | null;
  fila: { id: string; posicao: Posicao; codinome: string; funcoes: string[] }[] | null;
  sinais: { abertos: boolean; mosaico: MosaicoDosSinais | null; meu: Sinal | null; haBloqueio: boolean | null } | null;
  pontos: PontoDaAta[];
}
export interface AtasDaOrg { mesa: boolean; dentro: boolean; atas: AtaViva[] }

export type TipoDeCaixa = "nucleo" | "ato" | "greve" | "geral";
export const TIPOS_DE_CAIXA: readonly TipoDeCaixa[] = ["greve", "ato", "nucleo", "geral"];
export interface LancamentoDoCaixa { id: string; tipo: "entrada" | "saida"; centavos: number; descricao: string; dia: string; carimbos: 0 | 1 | 2; conferidoEm: string | null; nota: boolean; meu: boolean; possoConferir: boolean }
export interface CaixaDaOrg { id: string; nome: string; tipo: TipoDeCaixa; pix: string | null; link: string | null; nucleo: string | null; saldo: number; entradas: number; saidas: number; esperando: number | null; lancamentos: LancamentoDoCaixa[] }
export interface CaixasDaOrg { dentro: boolean; tesouraria: boolean; gerencio: boolean; caixas: CaixaDaOrg[] }

export type Chama = "apagado" | "brasa" | "plena";
export interface ConviteDoLampiao { codigo: string; validade: string; usos: number }
export interface PedidoDeLampiao {
  nome: string; quando: string; onde: string; cor: 1 | 2 | 3 | 4 | 5; pauta: string; tarefa: string; cidade: string; uf: string | null; mapa: boolean;
  convite: { dias: number; usos: number } | null;
}
export interface EstadoNoMapa { uf: string; cidades: string[] }
export interface OrgNoDiretorio { handle: string; codinome: string; tipo: string; cidade: string | null; palavra: string; bio: string; verificadaEm: string; nucleos: number }
export interface PaginaDoDiretorio { itens: OrgNoDiretorio[]; depois: string | null }

export const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"] as const;

// ───────────────────────────── regras puras ─────────────────────────────

/**
 * As 10 casas do mosaico dos sinais, na ordem concordo → dúvida → bloqueio → abstenção (cada casa = 10 %). Nulo abaixo de 3
 * sinais (o servidor já manda nulo; aqui é a segunda trava). As casas que sobram do arredondamento ficam apagadas ("vazio").
 */
export function mosaicoDosSinais(m: MosaicoDosSinais | null | undefined): (Sinal | "vazio")[] | null {
  if (!m) return null;
  const casas: (Sinal | "vazio")[] = [];
  for (const s of SINAIS) {
    const n = Math.max(0, Math.min(10, Math.round((Number(m[s]) || 0) * 10)));
    for (let i = 0; i < n && casas.length < 10; i++) casas.push(s);
  }
  while (casas.length < 10) casas.push("vazio");
  return casas;
}

/** O cronômetro-lampião treme nos últimos 15 segundos da fala (e para quando o tempo acaba). */
export function tremeOLampiao(restam: number): boolean {
  return restam > 0 && restam <= 15;
}

/** Quantos segundos restam da fala (negativo quando passou). */
export function segundosRestantes(desde: string, total: number, agora = Date.now()): number {
  const t = new Date(desde).getTime();
  return Number.isFinite(t) ? Math.ceil(total - (agora - t) / 1000) : total;
}

/** "4ª" (pt e es), "4th" (en), "4e" (fr), "4-я" (ru), "第4" (zh). */
export function ordinalDaFila(n: number, lang: string): string {
  if (lang === "en") {
    const r10 = n % 10, r100 = n % 100;
    return `${n}${r10 === 1 && r100 !== 11 ? "st" : r10 === 2 && r100 !== 12 ? "nd" : r10 === 3 && r100 !== 13 ? "rd" : "th"}`;
  }
  if (lang === "fr") return n === 1 ? "1re" : `${n}e`;
  if (lang === "ru") return `${n}-я`;
  if (lang === "zh") return `第${n}`;
  return `${n}ª`;
}

/** "12,50", "1.234,5", "10" ou "12.5" viram centavos; nulo se não for valor positivo. */
export function centavosDe(texto: string): number | null {
  const t = (texto ?? "").trim().replace(/\s|R\$/g, "");
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+([.,]\d{1,2})?$/.test(t)) return null;
  const normal = /,/.test(t) ? t.replace(/\./g, "").replace(",", ".") : t;
  const c = Math.round(Number(normal) * 100);
  return Number.isFinite(c) && c >= 1 && c <= 100_000_000_000 ? c : null;
}

/** R$ 1.234,50 no formato do idioma (o real é a moeda das organizações brasileiras; o símbolo fica). */
export function dinheiro(centavos: number, lang: string): string {
  return new Intl.NumberFormat(lang === "pt" ? "pt-BR" : lang, { style: "currency", currency: "BRL" }).format(centavos / 100);
}

/** Confere um lançamento antes de mandar: descrição de 3 a 140 sem dado pessoal (doador nunca aparece) e valor. */
export function conferirLancamento(d: { descricao: string; valor: string }): { descricao?: "curto" | "dado_pessoal"; valor?: "numero" } {
  const p: { descricao?: "curto" | "dado_pessoal"; valor?: "numero" } = {};
  const t = d.descricao.trim();
  if (t.length < 3 || t.length > 140) p.descricao = "curto";
  else if (pareceDadoPessoal(t)) p.descricao = "dado_pessoal";
  if (centavosDe(d.valor) === null) p.valor = "numero";
  return p;
}

/** O link do convite do núcleo: o código vai no fragmento (#), que o navegador não manda a servidor nenhum. */
export function linkDoConvite(origem: string, lang: string, handle: string, codigo: string): string {
  return `${origem}/${lang}/alumia/u/${encodeURIComponent(handle)}?aba=nucleos#convite=${encodeURIComponent(codigo)}`;
}

/** O código de convite do fragmento do endereço (#convite=…), se houver: 32 letras e números. */
export function conviteDoFragmento(hash: string): string | null {
  const m = /(?:^#|&)convite=([0-9a-f]{32})(?:&|$)/i.exec(hash ?? "");
  return m ? m[1].toLowerCase() : null;
}
