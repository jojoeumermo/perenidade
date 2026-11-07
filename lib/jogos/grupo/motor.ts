// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O motor dos jogos em grupo (T23). Quem cria a sala (o anfitrião) guarda o estado inteiro no próprio navegador e é o
// único que o muda: cada pessoa manda a sua ação ("respondi a 2", "a letra A") e o anfitrião aplica as regras daqui e
// devolve a todos a VISTA PÚBLICA, sem as respostas que ainda não foram reveladas. Não há servidor de jogo nem banco: a
// sala existe enquanto alguém está nela e some quando todos saem.
//
// Tudo aqui é puro (sem "@/", sem rede, sem relógio próprio: o "agora" vem de fora) para o teste em Node conferir as
// regras de cada jogo. Ação que chega pela rede é desconfiada: tipo, tamanho e faixa de cada campo são conferidos.
import type { CartaDaHistoria, ConceitoDoBingo, PalavraDaForca, Pergunta, TemaDeDebate } from "./banco";
import { criarSorteio, embaralhar } from "../base";
import { EQUIPES, limparApelido, limparArgumento, MAXIMO_DE_JOGADORES } from "./sala";

export type IdDoJogoEmGrupo = "corrida" | "mutirao" | "quem-disse" | "fato-ou-boato" | "assembleia" | "forca" | "bingo" | "fio";

export const JOGOS_EM_GRUPO: IdDoJogoEmGrupo[] = ["corrida", "mutirao", "quem-disse", "fato-ou-boato", "assembleia", "forca", "bingo", "fio"];

export interface Jogador {
  id: string;
  apelido: string;
  cor: number;
  equipe: number;
  /** Saiu da sala (fechou a aba, caiu a internet). Os pontos ficam; volta com o mesmo id se reabrir a mesma aba. */
  fora?: boolean;
}

export interface Opcoes {
  /** Quantas perguntas, palavras, cartas... */
  rodadas: number;
  /** Tempo por rodada, em segundos. 0: sem relógio (quem anima a sala avança). Padrão: sem relógio (WCAG 2.2.1). */
  segundos: number;
  /** Quantas equipes no Mutirão (2 a 4). */
  equipes: number;
  /** De onde vêm as perguntas: "glossario" ou a área (disciplina) dos exercícios. */
  fonte: string;
  /** Quem criou a sala também joga (ou só apresenta, num telão). */
  anfitriaoJoga: boolean;
}

export const OPCOES_PADRAO: Opcoes = { rodadas: 8, segundos: 0, equipes: 2, fonte: "glossario", anfitriaoJoga: true };
export const TEMPOS = [0, 15, 20, 30, 45, 60] as const;

export type Lado = "concordo" | "discordo" | "duvida";
export const LADOS: Lado[] = ["concordo", "discordo", "duvida"];

export interface Argumento {
  id: string;
  autor: string;
  lado: Lado;
  texto: string;
  oculto: boolean;
}

export interface PartidaPerguntas {
  tipo: "perguntas";
  modo: "individual" | "equipes";
  /** Corrida: quem acerta primeiro ganha mais. */
  rapidez: boolean;
  perguntas: Pergunta[];
  i: number;
  etapa: "respondendo" | "revelada";
  respostas: Record<string, { opcao: number; ordem: number }>;
  prazo: number | null;
  /** O que cada um (ou cada equipe) ganhou na última revelação. */
  ganhos: Record<string, number>;
  /** Equipes: a resposta que cada equipe deu (a mais votada entre os seus). */
  escolhas: Record<string, number>;
}

export interface PartidaDebate {
  tipo: "debate";
  tema: TemaDeDebate;
  etapa: "opiniao" | "argumentos" | "votacao" | "resultado" | "segunda";
  opiniao: Record<string, Lado>;
  argumentos: Argumento[];
  votos: Record<string, string>;
  opiniao2: Record<string, Lado>;
}

export interface PartidaForca {
  tipo: "forca";
  palavras: PalavraDaForca[];
  i: number;
  letras: string[];
  erros: number;
  /** A ordem das vezes (quem estava na sala quando a partida começou, mais quem chegou depois). */
  ordem: string[];
  vez: number;
  etapa: "jogando" | "salva" | "perdida";
  salvas: number;
  prazo: number | null;
  ultima?: { de: string; letra: string; acertou: boolean };
}

export interface PartidaBingo {
  tipo: "bingo";
  conceitos: ConceitoDoBingo[];
  /** Lado da cartela (3 ou 4). */
  lado: number;
  cartelas: Record<string, number[]>;
  chamadas: number[];
  marcadas: Record<string, number[]>;
  vencedores: string[];
  prazo: number | null;
  semente: number;
}

export interface PartidaFio {
  tipo: "fio";
  cartas: CartaDaHistoria[];
  linha: CartaDaHistoria[];
  i: number;
  etapa: "votando" | "revelada";
  votos: Record<string, number>;
  acertos: number;
  prazo: number | null;
  ultima?: { pos: number; certa: boolean; ano: number };
}

export type Partida = PartidaPerguntas | PartidaDebate | PartidaForca | PartidaBingo | PartidaFio;

export interface Recado {
  /** Para uma pessoa só (o "ainda não" do bingo); sem "para", é para todos. */
  para?: string;
  texto: string;
  /** Muda a cada recado, para a tela anunciar de novo um texto igual. */
  n: number;
}

export interface EstadoDaSala {
  versao: number;
  codigo: string;
  anfitriao: string;
  jogadores: Jogador[];
  jogo: IdDoJogoEmGrupo;
  opcoes: Opcoes;
  fase: "saguao" | "jogando" | "fim";
  partida: Partida | null;
  /** Os pontos DESTA partida (por id de jogador, "equipe:N" ou "grupo"). Nada fica guardado depois. */
  pontos: Record<string, number>;
  expulsos: string[];
  recado?: Recado;
}

/** O conteúdo sorteado pelo anfitrião ao começar (o motor não sorteia nada: fica estável e testável). */
export type Pacote =
  | { tipo: "perguntas"; perguntas: Pergunta[] }
  | { tipo: "debate"; tema: TemaDeDebate }
  | { tipo: "forca"; palavras: PalavraDaForca[] }
  | { tipo: "bingo"; conceitos: ConceitoDoBingo[]; lado: number; semente: number }
  | { tipo: "fio"; cartas: CartaDaHistoria[] };

export type Acao =
  | { t: "entrar"; apelido: string }
  | { t: "sair" }
  | { t: "tique" }
  | { t: "escolher"; jogo: IdDoJogoEmGrupo; opcoes?: Partial<Opcoes> }
  | { t: "comecar"; pacote: Pacote }
  | { t: "avancar" }
  | { t: "encerrar" }
  | { t: "ocultar"; arg: string }
  | { t: "pular" }
  | { t: "expulsar"; id: string }
  | { t: "equipe"; n: number }
  | { t: "responder"; opcao: number }
  | { t: "opinar"; lado: Lado }
  | { t: "argumentar"; id: string; lado: Lado; texto: string }
  | { t: "votar"; arg: string }
  | { t: "letra"; letra: string }
  | { t: "chutar"; palavra: string }
  | { t: "marcar"; i: number }
  | { t: "bingo" }
  | { t: "posicao"; p: number };

/** Qual motor cada jogo usa. */
export const MOTOR: Record<IdDoJogoEmGrupo, Partida["tipo"]> = {
  corrida: "perguntas",
  mutirao: "perguntas",
  "quem-disse": "perguntas",
  "fato-ou-boato": "perguntas",
  assembleia: "debate",
  forca: "forca",
  bingo: "bingo",
  fio: "fio",
};

export const ID_VALIDO = /^[a-z0-9]{6,24}$/;

export function salaNova(codigo: string, anfitriao: string, apelido: string, jogo: IdDoJogoEmGrupo = "corrida"): EstadoDaSala {
  return {
    versao: 1,
    codigo,
    anfitriao,
    jogadores: [{ id: anfitriao, apelido: limparApelido(apelido) || "Anfitrião", cor: 0, equipe: 0 }],
    jogo,
    opcoes: { ...OPCOES_PADRAO },
    fase: "saguao",
    partida: null,
    pontos: {},
    expulsos: [],
  };
}

/** Quem está jogando agora: na sala, e o anfitrião só se ele também joga. */
export function participantes(e: EstadoDaSala): Jogador[] {
  return e.jogadores.filter((j) => !j.fora && (j.id !== e.anfitriao || e.opcoes.anfitriaoJoga));
}

const ehParticipante = (e: EstadoDaSala, id: string) => participantes(e).some((j) => j.id === id);
const inteiro = (v: unknown, min: number, max: number): number | null => (typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : null);

function mudou(e: EstadoDaSala, resto: Partial<EstadoDaSala>): EstadoDaSala {
  return { ...e, ...resto, versao: e.versao + 1 };
}

function comPartida(e: EstadoDaSala, partida: Partida, resto: Partial<EstadoDaSala> = {}): EstadoDaSala {
  return mudou(e, { partida, ...resto });
}

const somar = (pontos: Record<string, number>, ganhos: Record<string, number>) => {
  const saida = { ...pontos };
  for (const [k, v] of Object.entries(ganhos)) if (v) saida[k] = (saida[k] ?? 0) + v;
  return saida;
};

function prazoDe(e: EstadoDaSala, agora: number): number | null {
  return e.opcoes.segundos > 0 ? agora + e.opcoes.segundos * 1000 : null;
}

function recado(e: EstadoDaSala, texto: string, para?: string): Recado {
  return { texto, para, n: (e.recado?.n ?? 0) + 1 };
}

function equipeMaisVazia(e: EstadoDaSala): number {
  const n = Math.min(Math.max(e.opcoes.equipes, 2), EQUIPES.length);
  const contagem = Array.from({ length: n }, (_, i) => e.jogadores.filter((j) => !j.fora && j.equipe === i).length);
  return contagem.indexOf(Math.min(...contagem));
}

function corLivre(e: EstadoDaSala): number {
  const usadas = new Set(e.jogadores.map((j) => j.cor));
  for (let i = 0; i < MAXIMO_DE_JOGADORES; i++) if (!usadas.has(i)) return i;
  return e.jogadores.length % MAXIMO_DE_JOGADORES;
}

// ───────── Perguntas (Corrida, Mutirão, Quem disse?, Fato ou boato?) ─────────

function revelarPerguntas(e: EstadoDaSala, p: PartidaPerguntas): EstadoDaSala {
  const pergunta = p.perguntas[p.i];
  const ganhos: Record<string, number> = {};
  const escolhas: Record<string, number> = {};
  if (p.modo === "individual") {
    const certos = Object.entries(p.respostas)
      .filter(([, r]) => r.opcao === pergunta.certa)
      .sort((a, b) => a[1].ordem - b[1].ordem);
    certos.forEach(([id], posicao) => {
      ganhos[id] = 1 + (p.rapidez ? (posicao === 0 ? 2 : posicao === 1 ? 1 : 0) : 0);
    });
  } else {
    const porEquipe = new Map<number, { opcao: number; ordem: number }[]>();
    for (const [id, r] of Object.entries(p.respostas)) {
      const j = e.jogadores.find((x) => x.id === id);
      if (!j) continue;
      porEquipe.set(j.equipe, [...(porEquipe.get(j.equipe) ?? []), r]);
    }
    for (const [equipe, lista] of porEquipe) {
      const votos = new Map<number, { n: number; primeiro: number }>();
      for (const r of lista) {
        const atual = votos.get(r.opcao) ?? { n: 0, primeiro: Infinity };
        votos.set(r.opcao, { n: atual.n + 1, primeiro: Math.min(atual.primeiro, r.ordem) });
      }
      const [escolha] = [...votos.entries()].sort((a, b) => b[1].n - a[1].n || a[1].primeiro - b[1].primeiro)[0];
      escolhas[`equipe:${equipe}`] = escolha;
      if (escolha === pergunta.certa) ganhos[`equipe:${equipe}`] = 1;
    }
  }
  return comPartida(e, { ...p, etapa: "revelada", prazo: null, ganhos, escolhas }, { pontos: somar(e.pontos, ganhos) });
}

function perguntas(e: EstadoDaSala, p: PartidaPerguntas, de: string, acao: Acao, agora: number): EstadoDaSala {
  const anfitriao = de === e.anfitriao;
  switch (acao.t) {
    case "responder": {
      if (p.etapa !== "respondendo" || !ehParticipante(e, de) || p.respostas[de]) return e;
      const opcao = inteiro(acao.opcao, 0, p.perguntas[p.i].opcoes.length - 1);
      if (opcao === null) return e;
      const respostas = { ...p.respostas, [de]: { opcao, ordem: Object.keys(p.respostas).length } };
      const novo = { ...p, respostas };
      if (participantes(e).every((j) => respostas[j.id])) return revelarPerguntas(e, novo);
      return comPartida(e, novo);
    }
    case "tique":
      return p.etapa === "respondendo" && p.prazo !== null && agora >= p.prazo ? revelarPerguntas(e, p) : e;
    case "avancar":
      if (!anfitriao) return e;
      if (p.etapa === "respondendo") return revelarPerguntas(e, p);
      if (p.i + 1 >= p.perguntas.length) return mudou(e, { fase: "fim" });
      return comPartida(e, { ...p, i: p.i + 1, etapa: "respondendo", respostas: {}, ganhos: {}, escolhas: {}, prazo: prazoDe(e, agora) });
    default:
      return e;
  }
}

// ───────── Assembleia (debate com votação) ─────────

const ETAPAS_DO_DEBATE: PartidaDebate["etapa"][] = ["opiniao", "argumentos", "votacao", "resultado", "segunda"];
export const ARGUMENTOS_POR_PESSOA = 2;

function debate(e: EstadoDaSala, p: PartidaDebate, de: string, acao: Acao): EstadoDaSala {
  const anfitriao = de === e.anfitriao;
  switch (acao.t) {
    case "opinar": {
      if (!ehParticipante(e, de) || !LADOS.includes(acao.lado)) return e;
      if (p.etapa === "opiniao") return comPartida(e, { ...p, opiniao: { ...p.opiniao, [de]: acao.lado } });
      if (p.etapa === "segunda") return comPartida(e, { ...p, opiniao2: { ...p.opiniao2, [de]: acao.lado } });
      return e;
    }
    case "argumentar": {
      if (p.etapa !== "argumentos" || !ehParticipante(e, de) || !LADOS.includes(acao.lado) || typeof acao.id !== "string" || !ID_VALIDO.test(acao.id)) return e;
      if (p.argumentos.some((a) => a.id === acao.id) || p.argumentos.filter((a) => a.autor === de).length >= ARGUMENTOS_POR_PESSOA) return e;
      const texto = typeof acao.texto === "string" ? limparArgumento(acao.texto) : "";
      if (!texto) return mudou(e, { recado: recado(e, "Esse texto não entrou: escreva de 3 a 160 letras, sem telefone, e-mail, link ou @.", de) });
      return comPartida(e, { ...p, argumentos: [...p.argumentos, { id: acao.id, autor: de, lado: acao.lado, texto, oculto: false }] });
    }
    case "votar": {
      if (p.etapa !== "votacao" || !ehParticipante(e, de)) return e;
      const arg = p.argumentos.find((a) => a.id === acao.arg);
      if (!arg || arg.oculto || arg.autor === de) return e;
      return comPartida(e, { ...p, votos: { ...p.votos, [de]: arg.id } });
    }
    case "ocultar": {
      // Moderação: quem anima a sala esconde um argumento (e os votos nele deixam de contar).
      if (!anfitriao || !p.argumentos.some((a) => a.id === acao.arg)) return e;
      const argumentos = p.argumentos.map((a) => (a.id === acao.arg ? { ...a, oculto: !a.oculto } : a));
      const votos = Object.fromEntries(Object.entries(p.votos).filter(([, v]) => !argumentos.find((a) => a.id === v)?.oculto));
      return comPartida(e, { ...p, argumentos, votos });
    }
    case "avancar": {
      if (!anfitriao) return e;
      const proxima = ETAPAS_DO_DEBATE[ETAPAS_DO_DEBATE.indexOf(p.etapa) + 1];
      if (!proxima) return mudou(e, { fase: "fim" });
      return comPartida(e, { ...p, etapa: proxima });
    }
    default:
      return e;
  }
}

// ───────── Forca do mutirão (coletiva, por vez) ─────────

export const ERROS_DA_FORCA = 6;

/** A vez de quem: pula quem saiu da sala. */
export function daVez(e: EstadoDaSala, p: PartidaForca): string | null {
  const ativos = new Set(participantes(e).map((j) => j.id));
  const ordem = p.ordem.filter((id) => ativos.has(id));
  if (!ordem.length) return null;
  return ordem[p.vez % ordem.length];
}

export const palavraCompleta = (palavra: string, letras: readonly string[]) => [...palavra].every((l) => letras.includes(l));

function proximaVez(e: EstadoDaSala, p: PartidaForca, agora: number): PartidaForca {
  return { ...p, vez: p.vez + 1, prazo: prazoDe(e, agora) };
}

function forca(e: EstadoDaSala, p: PartidaForca, de: string, acao: Acao, agora: number): EstadoDaSala {
  const anfitriao = de === e.anfitriao;
  const palavra = p.palavras[p.i].palavra;
  switch (acao.t) {
    case "letra": {
      if (p.etapa !== "jogando" || daVez(e, p) !== de || typeof acao.letra !== "string" || !/^[A-Z]$/.test(acao.letra) || p.letras.includes(acao.letra)) return e;
      const letras = [...p.letras, acao.letra];
      const acertou = palavra.includes(acao.letra);
      const erros = p.erros + (acertou ? 0 : 1);
      const base = { ...p, letras, erros, ultima: { de, letra: acao.letra, acertou } };
      if (palavraCompleta(palavra, letras)) return comPartida(e, { ...base, etapa: "salva", salvas: p.salvas + 1, prazo: null }, { pontos: somar(e.pontos, { grupo: 1 }) });
      if (erros >= ERROS_DA_FORCA) return comPartida(e, { ...base, etapa: "perdida", prazo: null });
      return comPartida(e, proximaVez(e, base, agora));
    }
    case "chutar": {
      if (p.etapa !== "jogando" || daVez(e, p) !== de || typeof acao.palavra !== "string") return e;
      const chute = acao.palavra
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toUpperCase()
        .replace(/[^A-Z]/g, "")
        .slice(0, 20);
      if (!chute) return e;
      if (chute === palavra) return comPartida(e, { ...p, letras: [...new Set([...p.letras, ...palavra])], etapa: "salva", salvas: p.salvas + 1, prazo: null }, { pontos: somar(e.pontos, { grupo: 1 }) });
      const erros = p.erros + 1;
      if (erros >= ERROS_DA_FORCA) return comPartida(e, { ...p, erros, etapa: "perdida", prazo: null });
      return comPartida(e, proximaVez(e, { ...p, erros }, agora));
    }
    case "pular":
      return anfitriao && p.etapa === "jogando" ? comPartida(e, proximaVez(e, p, agora)) : e;
    case "tique":
      return p.etapa === "jogando" && p.prazo !== null && agora >= p.prazo ? comPartida(e, proximaVez(e, p, agora)) : e;
    case "avancar": {
      if (!anfitriao) return e;
      if (p.etapa === "jogando") return comPartida(e, { ...p, etapa: "perdida", prazo: null });
      if (p.i + 1 >= p.palavras.length) return mudou(e, { fase: "fim" });
      return comPartida(e, { ...p, i: p.i + 1, letras: [], erros: 0, etapa: "jogando", prazo: prazoDe(e, agora), ultima: undefined });
    }
    default:
      return e;
  }
}

// ───────── Bingo de conceitos ─────────

/** As linhas que valem bingo numa cartela de lado n: as linhas, as colunas e as duas diagonais (posições 0..n²-1). */
export function linhasDoBingo(n: number): number[][] {
  const linhas: number[][] = [];
  for (let r = 0; r < n; r++) linhas.push(Array.from({ length: n }, (_, c) => r * n + c));
  for (let c = 0; c < n; c++) linhas.push(Array.from({ length: n }, (_, r) => r * n + c));
  linhas.push(Array.from({ length: n }, (_, i) => i * n + i));
  linhas.push(Array.from({ length: n }, (_, i) => i * n + (n - 1 - i)));
  return linhas;
}

/** Tem bingo? Uma linha inteira marcada em que todos os conceitos já foram chamados. */
export function temBingo(cartela: readonly number[], marcadas: readonly number[], chamadas: readonly number[], lado: number): boolean {
  const chamado = new Set(chamadas);
  const marcado = new Set(marcadas);
  return linhasDoBingo(lado).some((linha) => linha.every((pos) => marcado.has(cartela[pos]) && chamado.has(cartela[pos])));
}

export const PREMIOS_DO_BINGO = [3, 2, 1];

/** A cartela de uma pessoa: sempre a mesma para o mesmo id e a mesma partida (quem chega depois também ganha a sua). */
export function cartelaPara(id: string, semente: number, total: number, lado: number): number[] {
  let h = semente >>> 0;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193) >>> 0;
  return embaralhar(
    Array.from({ length: total }, (_, i) => i),
    criarSorteio(h),
  ).slice(0, lado * lado);
}

function bingo(e: EstadoDaSala, p: PartidaBingo, de: string, acao: Acao, agora: number): EstadoDaSala {
  const anfitriao = de === e.anfitriao;
  const chamar = (): EstadoDaSala => {
    if (p.chamadas.length >= p.conceitos.length) return mudou(e, { fase: "fim" });
    return comPartida(e, { ...p, chamadas: [...p.chamadas, p.chamadas.length], prazo: prazoDe(e, agora) });
  };
  switch (acao.t) {
    case "marcar": {
      const cartela = p.cartelas[de];
      if (!cartela || !ehParticipante(e, de)) return e;
      const i = inteiro(acao.i, 0, p.conceitos.length - 1);
      if (i === null || !cartela.includes(i)) return e;
      const minhas = p.marcadas[de] ?? [];
      const marcadas = minhas.includes(i) ? minhas.filter((x) => x !== i) : [...minhas, i];
      return comPartida(e, { ...p, marcadas: { ...p.marcadas, [de]: marcadas } });
    }
    case "bingo": {
      const cartela = p.cartelas[de];
      if (!cartela || p.vencedores.includes(de)) return e;
      if (!temBingo(cartela, p.marcadas[de] ?? [], p.chamadas, p.lado)) return mudou(e, { recado: recado(e, "Ainda não: falta uma linha inteira só com conceitos já chamados. Confira as marcas.", de) });
      const vencedores = [...p.vencedores, de];
      const premio = PREMIOS_DO_BINGO[p.vencedores.length] ?? 1;
      const apelido = e.jogadores.find((j) => j.id === de)?.apelido ?? "";
      const fim = vencedores.length >= Math.min(PREMIOS_DO_BINGO.length, participantes(e).length);
      return comPartida(e, { ...p, vencedores, prazo: fim ? null : p.prazo }, { pontos: somar(e.pontos, { [de]: premio }), recado: recado(e, `Bingo de ${apelido}!`), ...(fim ? { fase: "fim" as const } : {}) });
    }
    case "avancar":
      return anfitriao ? chamar() : e;
    case "tique":
      return p.prazo !== null && agora >= p.prazo ? chamar() : e;
    default:
      return e;
  }
}

// ───────── Fio da história (linha do tempo coletiva) ─────────

/** A carta de ano `ano` cabe na posição `pos` da linha (0 = antes de todas)? Ano igual ao vizinho também vale. */
export function cabeNaPosicao(linha: readonly CartaDaHistoria[], ano: number, pos: number): boolean {
  if (pos < 0 || pos > linha.length) return false;
  return (pos === 0 || linha[pos - 1].ano <= ano) && (pos === linha.length || ano <= linha[pos].ano);
}

/** A posição mais votada (empate: a de quem votou primeiro; ninguém votou: -1). */
export function posicaoDoGrupo(votos: Record<string, number>): number {
  const contagem = new Map<number, number>();
  for (const v of Object.values(votos)) contagem.set(v, (contagem.get(v) ?? 0) + 1);
  let melhor = -1;
  let maior = 0;
  for (const v of Object.values(votos)) {
    const n = contagem.get(v) ?? 0;
    if (n > maior) {
      maior = n;
      melhor = v;
    }
  }
  return melhor;
}

function revelarFio(e: EstadoDaSala, p: PartidaFio): EstadoDaSala {
  const carta = p.cartas[p.i];
  const pos = posicaoDoGrupo(p.votos);
  const certa = cabeNaPosicao(p.linha, carta.ano, pos);
  const linha = [...p.linha, carta].sort((a, b) => a.ano - b.ano);
  return comPartida(e, { ...p, linha, etapa: "revelada", prazo: null, acertos: p.acertos + (certa ? 1 : 0), ultima: { pos, certa, ano: carta.ano } }, certa ? { pontos: somar(e.pontos, { grupo: 1 }) } : {});
}

function fio(e: EstadoDaSala, p: PartidaFio, de: string, acao: Acao, agora: number): EstadoDaSala {
  const anfitriao = de === e.anfitriao;
  switch (acao.t) {
    case "posicao": {
      if (p.etapa !== "votando" || !ehParticipante(e, de)) return e;
      const pos = inteiro(acao.p, 0, p.linha.length);
      if (pos === null) return e;
      const votos = { ...p.votos, [de]: pos };
      return comPartida(e, { ...p, votos });
    }
    case "tique":
      return p.etapa === "votando" && p.prazo !== null && agora >= p.prazo ? revelarFio(e, p) : e;
    case "avancar":
      if (!anfitriao) return e;
      if (p.etapa === "votando") return revelarFio(e, p);
      if (p.i + 1 >= p.cartas.length) return mudou(e, { fase: "fim" });
      return comPartida(e, { ...p, i: p.i + 1, etapa: "votando", votos: {}, prazo: prazoDe(e, agora), ultima: undefined });
    default:
      return e;
  }
}

// ───────── A sala ─────────

function limparOpcoes(atual: Opcoes, novas: Partial<Opcoes> | undefined): Opcoes {
  if (!novas || typeof novas !== "object") return atual;
  return {
    rodadas: inteiro(novas.rodadas, 3, 20) ?? atual.rodadas,
    segundos: typeof novas.segundos === "number" && (TEMPOS as readonly number[]).includes(novas.segundos) ? novas.segundos : atual.segundos,
    equipes: inteiro(novas.equipes, 2, EQUIPES.length) ?? atual.equipes,
    fonte: typeof novas.fonte === "string" && /^[a-z0-9-]{2,40}$/.test(novas.fonte) ? novas.fonte : atual.fonte,
    anfitriaoJoga: typeof novas.anfitriaoJoga === "boolean" ? novas.anfitriaoJoga : atual.anfitriaoJoga,
  };
}

function partidaDoPacote(e: EstadoDaSala, pacote: Pacote, agora: number): Partida | null {
  const prazo = prazoDe(e, agora);
  switch (pacote.tipo) {
    case "perguntas":
      if (!Array.isArray(pacote.perguntas) || !pacote.perguntas.length) return null;
      return { tipo: "perguntas", modo: e.jogo === "mutirao" ? "equipes" : "individual", rapidez: e.jogo === "corrida", perguntas: pacote.perguntas.slice(0, 20), i: 0, etapa: "respondendo", respostas: {}, prazo, ganhos: {}, escolhas: {} };
    case "debate":
      return pacote.tema ? { tipo: "debate", tema: pacote.tema, etapa: "opiniao", opiniao: {}, argumentos: [], votos: {}, opiniao2: {} } : null;
    case "forca":
      if (!Array.isArray(pacote.palavras) || !pacote.palavras.length) return null;
      return { tipo: "forca", palavras: pacote.palavras.slice(0, 20), i: 0, letras: [], erros: 0, ordem: participantes(e).map((j) => j.id), vez: 0, etapa: "jogando", salvas: 0, prazo };
    case "bingo": {
      const lado = pacote.lado === 3 ? 3 : 4;
      if (!Array.isArray(pacote.conceitos) || pacote.conceitos.length < lado * lado + 2) return null;
      const semente = typeof pacote.semente === "number" ? pacote.semente >>> 0 : 1;
      const cartelas = Object.fromEntries(participantes(e).map((j) => [j.id, cartelaPara(j.id, semente, pacote.conceitos.length, lado)]));
      return { tipo: "bingo", conceitos: pacote.conceitos, lado, cartelas, chamadas: [0], marcadas: {}, vencedores: [], prazo, semente };
    }
    case "fio":
      if (!Array.isArray(pacote.cartas) || pacote.cartas.length < 3) return null;
      return { tipo: "fio", cartas: pacote.cartas, linha: [pacote.cartas[0]], i: 1, etapa: "votando", votos: {}, acertos: 0, prazo };
  }
}

/**
 * Aplica uma ação. Devolve o MESMO objeto quando nada mudou (o anfitrião então não transmite nada). `de` é o id de quem
 * mandou; as ações de quem anima a sala (escolher, começar, avançar, encerrar, ocultar, pular, expulsar) só valem do
 * anfitrião.
 */
export function aplicar(e: EstadoDaSala, de: string, acao: Acao, agora: number): EstadoDaSala {
  if (!acao || typeof acao !== "object" || typeof de !== "string" || !ID_VALIDO.test(de)) return e;
  if (e.expulsos.includes(de)) return e;
  const anfitriao = de === e.anfitriao;
  switch (acao.t) {
    case "entrar": {
      const apelido = typeof acao.apelido === "string" ? limparApelido(acao.apelido) : "";
      const ja = e.jogadores.find((j) => j.id === de);
      if (ja) {
        if (!ja.fora && (ja.apelido === apelido || !apelido)) return e;
        return mudou(e, { jogadores: e.jogadores.map((j) => (j.id === de ? { ...j, fora: false, apelido: apelido || j.apelido } : j)) });
      }
      if (e.jogadores.filter((j) => !j.fora).length >= MAXIMO_DE_JOGADORES) return e;
      const novo: Jogador = { id: de, apelido: apelido || `Visita ${e.jogadores.length + 1}`, cor: corLivre(e), equipe: equipeMaisVazia(e) };
      let partida = e.partida;
      // Quem chega no meio da forca entra no fim da fila das vezes; no bingo, ganha a sua cartela.
      if (partida?.tipo === "forca") partida = { ...partida, ordem: [...partida.ordem, de] };
      if (partida?.tipo === "bingo") partida = { ...partida, cartelas: { ...partida.cartelas, [de]: cartelaPara(de, partida.semente, partida.conceitos.length, partida.lado) } };
      return mudou(e, { jogadores: [...e.jogadores, novo], partida });
    }
    case "sair":
      return e.jogadores.some((j) => j.id === de && !j.fora) ? mudou(e, { jogadores: e.jogadores.map((j) => (j.id === de ? { ...j, fora: true } : j)) }) : e;
    case "expulsar": {
      if (!anfitriao || acao.id === e.anfitriao || !e.jogadores.some((j) => j.id === acao.id)) return e;
      return mudou(e, { jogadores: e.jogadores.filter((j) => j.id !== acao.id), expulsos: [...e.expulsos, acao.id].slice(-50) });
    }
    case "equipe": {
      if (e.fase === "jogando" && e.partida?.tipo === "perguntas") return e; // no meio da partida, ninguém troca de lado
      const n = inteiro(acao.n, 0, Math.min(e.opcoes.equipes, EQUIPES.length) - 1);
      if (n === null || !e.jogadores.some((j) => j.id === de)) return e;
      return mudou(e, { jogadores: e.jogadores.map((j) => (j.id === de ? { ...j, equipe: n } : j)) });
    }
    case "escolher": {
      if (!anfitriao || e.fase === "jogando") return e;
      const jogo = JOGOS_EM_GRUPO.includes(acao.jogo) ? acao.jogo : e.jogo;
      const opcoes = limparOpcoes(e.opcoes, acao.opcoes);
      // Menos equipes: quem estava numa equipe que sumiu volta para a primeira.
      const jogadores = e.jogadores.map((j) => (j.equipe >= opcoes.equipes ? { ...j, equipe: j.equipe % opcoes.equipes } : j));
      return mudou(e, { jogo, opcoes, jogadores, fase: "saguao", partida: null });
    }
    case "comecar": {
      if (!anfitriao || !acao.pacote || MOTOR[e.jogo] !== acao.pacote.tipo) return e;
      const partida = partidaDoPacote(e, acao.pacote, agora);
      return partida ? mudou(e, { partida, fase: "jogando", pontos: {}, recado: undefined }) : e;
    }
    case "encerrar":
      return anfitriao ? mudou(e, { fase: "saguao", partida: null }) : e;
    default:
      break;
  }
  if (e.fase !== "jogando" || !e.partida) return e;
  const p = e.partida;
  switch (p.tipo) {
    case "perguntas":
      return perguntas(e, p, de, acao, agora);
    case "debate":
      return debate(e, p, de, acao);
    case "forca":
      return forca(e, p, de, acao, agora);
    case "bingo":
      return bingo(e, p, de, acao, agora);
    case "fio":
      return fio(e, p, de, acao, agora);
  }
}

// ───────── A vista pública (o que vai para todos) ─────────

export interface VistaPerguntas {
  tipo: "perguntas";
  modo: "individual" | "equipes";
  rapidez: boolean;
  i: number;
  total: number;
  etapa: "respondendo" | "revelada";
  enunciado: string;
  opcoes: string[];
  /** Só depois da revelação. */
  certa?: number;
  explicacao?: string;
  fonte?: string;
  aula?: { titulo: string; href: string };
  /** Quem já respondeu (sem dizer o quê, até a revelação). */
  responderam: string[];
  respostas?: Record<string, number>;
  ganhos: Record<string, number>;
  escolhas: Record<string, number>;
  restante: number | null;
}

export interface VistaDebate {
  tipo: "debate";
  tema: TemaDeDebate;
  etapa: PartidaDebate["etapa"];
  opinaram: string[];
  /** As contagens da primeira opinião aparecem no resultado; as da segunda, também no resultado e depois. */
  contagem?: Record<Lado, number>;
  contagem2?: Record<Lado, number>;
  opinaram2: string[];
  /** Os argumentos, sem o autor (a votação é pelo texto, não pela pessoa). */
  argumentos: { id: string; lado: Lado; texto: string; oculto: boolean; votos?: number }[];
  votaram: string[];
}

export interface VistaForca {
  tipo: "forca";
  i: number;
  total: number;
  mascara: string;
  dica: string;
  letras: string[];
  erros: number;
  maximo: number;
  vez: string | null;
  etapa: PartidaForca["etapa"];
  salvas: number;
  /** A palavra aparece quando a rodada acaba. */
  termo?: string;
  aula?: { titulo: string; href: string };
  ultima?: PartidaForca["ultima"];
  restante: number | null;
}

export interface VistaBingo {
  tipo: "bingo";
  lado: number;
  termos: string[];
  cartelas: Record<string, number[]>;
  marcadas: Record<string, number[]>;
  /** As definições chamadas, da mais nova para a mais antiga; o termo da mais nova fica escondido. */
  chamadas: { i: number; definicao: string; termo?: string }[];
  restam: number;
  vencedores: string[];
  restante: number | null;
}

export interface VistaFio {
  tipo: "fio";
  linha: CartaDaHistoria[];
  atual: { texto: string; ano?: number };
  numero: number;
  total: number;
  etapa: PartidaFio["etapa"];
  votos: Record<string, number>;
  acertos: number;
  ultima?: PartidaFio["ultima"];
  restante: number | null;
}

export type VistaDaPartida = VistaPerguntas | VistaDebate | VistaForca | VistaBingo | VistaFio;

export interface VistaDaSala extends Omit<EstadoDaSala, "partida" | "expulsos"> {
  partida: VistaDaPartida | null;
}

const restante = (prazo: number | null, agora: number) => (prazo === null ? null : Math.max(0, prazo - agora));

function contar(opinioes: Record<string, Lado>): Record<Lado, number> {
  const c: Record<Lado, number> = { concordo: 0, discordo: 0, duvida: 0 };
  for (const l of Object.values(opinioes)) c[l]++;
  return c;
}

export function vistaDaPartida(p: Partida, agora: number): VistaDaPartida {
  switch (p.tipo) {
    case "perguntas": {
      const q = p.perguntas[p.i];
      const revelada = p.etapa === "revelada";
      return {
        tipo: "perguntas",
        modo: p.modo,
        rapidez: p.rapidez,
        i: p.i,
        total: p.perguntas.length,
        etapa: p.etapa,
        enunciado: q.enunciado,
        opcoes: q.opcoes,
        ...(revelada ? { certa: q.certa, explicacao: q.explicacao, fonte: q.fonte, aula: q.aula, respostas: Object.fromEntries(Object.entries(p.respostas).map(([k, r]) => [k, r.opcao])) } : {}),
        responderam: Object.keys(p.respostas),
        ganhos: p.ganhos,
        escolhas: p.escolhas,
        restante: restante(p.prazo, agora),
      };
    }
    case "debate": {
      const depois = p.etapa === "resultado" || p.etapa === "segunda";
      const votosPorArg = new Map<string, number>();
      for (const v of Object.values(p.votos)) votosPorArg.set(v, (votosPorArg.get(v) ?? 0) + 1);
      return {
        tipo: "debate",
        tema: p.tema,
        etapa: p.etapa,
        opinaram: Object.keys(p.opiniao),
        opinaram2: Object.keys(p.opiniao2),
        ...(depois ? { contagem: contar(p.opiniao), contagem2: contar(p.opiniao2) } : {}),
        argumentos: p.argumentos.map((a) => ({ id: a.id, lado: a.lado, texto: a.oculto ? "" : a.texto, oculto: a.oculto, ...(depois ? { votos: votosPorArg.get(a.id) ?? 0 } : {}) })),
        votaram: Object.keys(p.votos),
      };
    }
    case "forca": {
      const w = p.palavras[p.i];
      const fim = p.etapa !== "jogando";
      return {
        tipo: "forca",
        i: p.i,
        total: p.palavras.length,
        mascara: [...w.palavra].map((l) => (fim || p.letras.includes(l) ? l : "_")).join(""),
        dica: w.dica,
        letras: p.letras,
        erros: p.erros,
        maximo: ERROS_DA_FORCA,
        vez: null,
        etapa: p.etapa,
        salvas: p.salvas,
        ...(fim ? { termo: w.termo, aula: w.aula } : {}),
        ultima: p.ultima,
        restante: restante(p.prazo, agora),
      };
    }
    case "bingo":
      return {
        tipo: "bingo",
        lado: p.lado,
        termos: p.conceitos.map((c) => c.termo),
        cartelas: p.cartelas,
        marcadas: p.marcadas,
        chamadas: [...p.chamadas].reverse().map((i, n) => ({ i: n === 0 ? -1 : i, definicao: p.conceitos[i].definicao, ...(n === 0 ? {} : { termo: p.conceitos[i].termo }) })),
        restam: p.conceitos.length - p.chamadas.length,
        vencedores: p.vencedores,
        restante: restante(p.prazo, agora),
      };
    case "fio": {
      const carta = p.cartas[p.i];
      return {
        tipo: "fio",
        linha: p.linha,
        atual: { texto: carta.texto, ...(p.etapa === "revelada" ? { ano: carta.ano } : {}) },
        numero: p.i,
        total: p.cartas.length - 1,
        etapa: p.etapa,
        votos: p.votos,
        acertos: p.acertos,
        ultima: p.ultima,
        restante: restante(p.prazo, agora),
      };
    }
  }
}

/** O que o anfitrião transmite: o estado sem as respostas escondidas, sem a lista de expulsos e sem o autor dos argumentos. */
export function vistaPublica(e: EstadoDaSala, agora: number): VistaDaSala {
  const { partida, expulsos: _expulsos, ...resto } = e;
  void _expulsos;
  let vista = partida ? vistaDaPartida(partida, agora) : null;
  if (vista?.tipo === "forca" && partida?.tipo === "forca") vista = { ...vista, vez: daVez(e, partida) };
  return { ...resto, partida: vista };
}

/**
 * Quando o anfitrião some (fechou a aba), a pessoa seguinte assume a sala a partir da última vista: a turma, as equipes e
 * os pontos ficam; a partida em curso volta ao saguão (as respostas escondidas iam só com o anfitrião antigo).
 */
export function assumirSala(v: VistaDaSala, novoAnfitriao: string): EstadoDaSala {
  const { partida: _partida, ...resto } = v;
  void _partida;
  return {
    ...resto,
    versao: v.versao + 1,
    anfitriao: novoAnfitriao,
    jogadores: v.jogadores.map((j) => (j.id === v.anfitriao ? { ...j, fora: true } : j)),
    fase: "saguao",
    partida: null,
    expulsos: [],
    recado: { texto: "Quem animava a sala saiu. A sala segue com outra pessoa no comando; a partida recomeça do saguão.", n: (v.recado?.n ?? 0) + 1 },
  };
}

/** Quem assume: entre quem está na sala (presença), o primeiro da lista de jogadores (quem chegou antes). */
export function sucessor(v: VistaDaSala, presentes: readonly string[]): string | null {
  const aqui = new Set(presentes);
  return v.jogadores.find((j) => j.id !== v.anfitriao && aqui.has(j.id))?.id ?? null;
}

/** Os pontos em ordem (maior primeiro), para o quadro do fim. */
export function classificacao(v: Pick<VistaDaSala, "pontos" | "jogadores">, modo: "jogadores" | "equipes"): { chave: string; pontos: number }[] {
  const chaves = modo === "equipes" ? Object.keys(v.pontos).filter((k) => k.startsWith("equipe:")) : v.jogadores.map((j) => j.id);
  return chaves.map((chave) => ({ chave, pontos: v.pontos[chave] ?? 0 })).sort((a, b) => b.pontos - a.pontos);
}
