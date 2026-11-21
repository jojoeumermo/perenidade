// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O lado do aparelho dos passes anônimos (Privacy Pass, RFC 9576/9578, tipo 0x0002 Blind RSA 2048, pela @cloudflare/privacypass-ts).
//   1. pega a chave pública da semana (GET /api/alumia/passes/chave, sem sessão) e confere que ela é a ÚNICA chave daquela semana na
//      corrente do registro público de transparência que ESTE aparelho conferiu (lib/rede/chat/transparencia.ts, atualizarVista: a
//      corrente inteira desde a vista guardada aqui, que nunca volta atrás). Assim o servidor não consegue dar uma chave a cada pessoa
//      para reconhecer de quem é cada passe: uma linha inventada não fecha a corrente, e duas chaves na mesma semana são recusadas.
//      Limite: sem comparar a vista com outros aparelhos (fofoca), um servidor que mostre a uma pessoa um registro bifurcado DESDE O
//      COMEÇO (antes da primeira vista dela) não é pego aqui; o carimbo da vista ao lado do código de segurança é o que permite notar;
//   2. monta 30 pedidos cegos (a biblioteca sorteia o nonce e o fator de cegamento) e pede o lote com a sessão da conta
//      (POST /api/alumia/passes/emitir): o servidor sabe que a conta pegou o lote de hoje, mas não vê os passes;
//   3. termina cada passe (a biblioteca confere a assinatura RSA-PSS contra a chave do registro: resposta de outra chave é recusada);
//   4. gasta um passe por ação anônima (cabeçalho `Authorization: PrivateToken token="…"`): quem confere não sabe de quem é. Com o
//      servidor do chat separado (onda R3), quem confere é ele, só com a chave pública.
// O passe da urna anônima (frente resto-r2) é um passe com contexto: um por votação e por conta. Peça CEDO (ao abrir a votação) e
// gaste DEPOIS: pedir com a sessão e gastar sem ela no mesmo instante ligaria os dois pelo horário.
// Os passes ficam neste aparelho (localStorage, chave "alumia-passes-r2", a mesma da R2 para o Sair rápido levar): não dizem de quem
// são, mas quem os copiar gasta.
// Sem "@/" de propósito.
import { Token, genericBatched, publicVerif } from "@cloudflare/privacypass-ts";
import { sha256 } from "@noble/hashes/sha2.js";
import { atualizarVista, chaveRsaDePassesNaVista, INICIO, type VistaDoRegistro } from "../chat/transparencia";
import { bytesDe, deB64u, diaUtc, iguais, paraB64, paraB64u } from "../caixas/base";
import { erroDe, getAnonimo, postComSessao, transporte } from "../caixas/transporte";
import {
  cabecalhoDoPasse, contextoDaUrna, desafio, identidadeNoRegistro, MODO, nomeNaVista, PASSES_POR_DIA, semanaDe, TAMANHO_DO_PASSE, type TipoDaUrna,
} from "./comum";

const CHAVE_LOCAL = "alumia-passes-r2";
/** A vista do registro público que este aparelho já conferiu (só dados públicos: até onde a corrente fecha e as chaves de passes). */
const CHAVE_DA_VISTA = "alumia-passes-r2-vista";

interface Guardados {
  /** Passes gerais por semana da chave ("<semana>" → passes serializados em base64 de endereço). */
  porSemana: Record<string, string[]>;
  /** O dia em que esta conta já pegou o lote (para não pedir de novo e ouvir "ja_pegou"). */
  pegouEm: string | null;
  /** O passe da urna de cada votação ("<contexto em base64 de endereço>" → passe). */
  urnas: Record<string, string>;
}

let memoria: Guardados | null = null;
const vazio = (): Guardados => ({ porSemana: {}, pegouEm: null, urnas: {} });

function ler(): Guardados {
  if (memoria) return memoria;
  let g = vazio();
  try {
    const bruto = globalThis.localStorage?.getItem(CHAVE_LOCAL);
    const v = bruto ? (JSON.parse(bruto) as Partial<Guardados>) : null;
    if (v && typeof v === "object") {
      g.pegouEm = typeof v.pegouEm === "string" ? v.pegouEm : null;
      // Os passes da R2 (VOPRF, "porDia") não valem mais: só "porSemana" é lido.
      if (v.porSemana && typeof v.porSemana === "object") {
        for (const [s, lista] of Object.entries(v.porSemana)) {
          if (/^\d{1,7}$/.test(s) && Array.isArray(lista)) g.porSemana[s] = lista.filter((x): x is string => typeof x === "string");
        }
      }
      if (v.urnas && typeof v.urnas === "object") {
        for (const [c, p] of Object.entries(v.urnas)) if (/^[A-Za-z0-9_-]{43}$/.test(c) && typeof p === "string") g.urnas[c] = p;
      }
    }
  } catch {
    g = vazio(); /* sem armazenamento (janela privada): só na memória */
  }
  memoria = g;
  return g;
}

function gravar(g: Guardados): void {
  memoria = g;
  try {
    globalThis.localStorage?.setItem(CHAVE_LOCAL, JSON.stringify(g));
  } catch {
    /* fica só na memória */
  }
}

/** Tira os passes que já não valem (o passe geral vale na semana da chave e na seguinte). */
function podar(g: Guardados, agora: number): Guardados {
  const hoje = semanaDe(agora);
  const porSemana: Record<string, string[]> = {};
  for (const [s, lista] of Object.entries(g.porSemana)) if (Number(s) >= hoje - 1 && Number(s) <= hoje && lista.length) porSemana[s] = lista;
  return { porSemana, pegouEm: g.pegouEm === diaUtc(agora) ? g.pegouEm : null, urnas: { ...g.urnas } };
}

/** Quantos passes gerais ainda valem neste aparelho. */
export function passesGuardados(agora: number = Date.now()): number {
  return Object.values(podar(ler(), agora).porSemana).reduce((n, l) => n + l.length, 0);
}

/** Apaga todos os passes deste aparelho (Sair rápido, pânico, sair da conta). */
export function apagarPasses(): void {
  memoria = vazio();
  try {
    globalThis.localStorage?.removeItem(CHAVE_LOCAL);
  } catch {
    /* nada */
  }
}

/** Uma linha do registro público de transparência (public.rede_kt_trecho). */
interface LinhaDoRegistro {
  seq: number;
  tipo: string;
  quem: string;
  identidade: string;
  versao: number;
  dia: string;
  resumo: string;
}

/** O resumo de uma linha do registro com tipo (o mesmo de interno.rede_kt_resumo2), em base64 padrão. */
export function resumoDaLinha(anterior: string, l: Omit<LinhaDoRegistro, "resumo">): string {
  return paraB64(sha256(bytesDe(`${anterior}|${l.seq}|${l.tipo}|${l.quem}|${l.identidade}|${l.versao}|${l.dia}`)));
}

let vistaNaMemoria: VistaDoRegistro | null = null;
function lerVista(): VistaDoRegistro {
  try {
    const v = JSON.parse(globalThis.localStorage?.getItem(CHAVE_DA_VISTA) ?? "null") as VistaDoRegistro | null;
    if (v && Number.isInteger(v.seq) && typeof v.resumo === "string" && v.ultimas && typeof v.ultimas === "object") return v;
  } catch {
    /* sem armazenamento: começa do começo */
  }
  return vistaNaMemoria ?? INICIO;
}
function gravarVista(v: VistaDoRegistro): void {
  vistaNaMemoria = v;
  try {
    globalThis.localStorage?.setItem(CHAVE_DA_VISTA, JSON.stringify(v));
  } catch {
    /* fica só na memória */
  }
}

/**
 * Confere no registro público que a chave RSA (da semana ou do contexto) é a única com aquele nome: traz a corrente desde a vista
 * guardada neste aparelho (atualizarVista refaz o resumo de cada linha e recusa passado reescrito ou registro que volta atrás), e
 * procura a chave DENTRO da corrente conferida. `seq`, a linha que o servidor indica, tem de ser a linha da chave na corrente.
 */
export async function chaveEstaNoRegistro(semana: number, contexto: Uint8Array, publica: Uint8Array, seq: number): Promise<boolean> {
  if (!Number.isInteger(seq) || seq < 1 || !Number.isInteger(semana) || semana < 0) return false;
  let vista: VistaDoRegistro;
  try {
    vista = await atualizarVista(lerVista(), {
      ponta: () => transporte().rpcComSessao<{ seq: number; resumo: string }>("rede_kt_ponta", {}),
      trecho: (desde) => transporte().rpcComSessao<LinhaDoRegistro[]>("rede_kt_trecho", { p_desde: desde }),
    });
  } catch {
    return false;
  }
  gravarVista(vista);
  return chaveRsaDePassesNaVista(vista, nomeNaVista(semana, contexto), identidadeNoRegistro(semana, contexto, publica), seq);
}

let pegando: Promise<void> | null = null;

/**
 * Garante passes: se não há nenhum que valha e a conta ainda não pegou o lote de hoje, pega (com a sessão da conta).
 * Erros: "entre_primeiro", "ja_pegou" (o lote de hoje já saiu, talvez para outro aparelho), "chave_fora_do_registro", "sem_servico", "rede".
 */
export function garantirPasses(agora: number = Date.now()): Promise<void> {
  if (passesGuardados(agora) > 0) return Promise.resolve();
  pegando ??= pegarLote(agora).finally(() => {
    pegando = null;
  });
  return pegando;
}

/** Confere a chave pública que a rota indica (da semana ou da urna) contra o registro. */
async function chaveConferida(corpo: Record<string, unknown> | null, contexto: Uint8Array): Promise<{ semana: number; publica: Uint8Array }> {
  const semana = Number(corpo?.semana);
  const publica = deB64u(corpo?.publica);
  const seq = Number(corpo?.seq);
  if (!publica || publica.length < 290 || publica.length > 600 || !Number.isInteger(semana)) throw erroDe("rede");
  if (contexto.length ? semana !== 0 : semana < 1) throw erroDe("rede");
  if (!(await chaveEstaNoRegistro(semana, contexto, publica, seq))) throw erroDe("chave_fora_do_registro");
  return { semana, publica };
}

const erroDaEmissao = (status: number, corpo: Record<string, unknown> | null) => {
  if (status === 409 || corpo?.erro === "ja_pegou") return erroDe("ja_pegou");
  if (status === 503) return erroDe("sem_servico");
  if (status === 401 || status === 403) return erroDe("entre_primeiro");
  return erroDe("rede");
};

/** Termina um passe e confere que é desta chave e do tamanho certo. */
async function terminar(cliente: publicVerif.Client, resposta: publicVerif.TokenResponse, publica: Uint8Array): Promise<string> {
  let passe: Token;
  try {
    // finalize confere a assinatura contra a chave do registro: se o servidor usou outra chave, lança, e nenhum passe é guardado.
    passe = await cliente.finalize(resposta);
  } catch {
    throw erroDe("chave_fora_do_registro");
  }
  const serial = passe.serialize();
  if (serial.length !== TAMANHO_DO_PASSE || !iguais(passe.authInput.tokenKeyId, sha256(publica))) throw erroDe("chave_fora_do_registro");
  return paraB64u(serial);
}

async function pegarLote(agora: number): Promise<void> {
  const g = podar(ler(), agora);
  if (g.pegouEm === diaUtc(agora)) throw erroDe("ja_pegou");
  const r0 = await getAnonimo("/api/alumia/passes/chave");
  if (r0.status === 503) throw erroDe("sem_servico");
  if (r0.status !== 200) throw erroDe("rede");
  const { semana, publica } = await chaveConferida(r0.corpo, new Uint8Array(0));
  if (Math.abs(semana - semanaDe(agora)) > 1) throw erroDe("rede");

  const clientes = Array.from({ length: PASSES_POR_DIA }, () => new publicVerif.Client(MODO));
  const pedidos: genericBatched.TokenRequest[] = [];
  for (const c of clientes) pedidos.push(new genericBatched.TokenRequest(await c.createTokenRequest(desafio(), publica)));
  const lote = new genericBatched.Client().createTokenRequest(pedidos);
  const r = await postComSessao("/api/alumia/passes/emitir", { lote: paraB64u(lote.serialize()) });
  if (r.status === 409 || r.corpo?.erro === "ja_pegou") gravar({ ...g, pegouEm: diaUtc(agora) });
  const bytes = r.status === 200 ? deB64u(r.corpo?.resposta) : null;
  if (!bytes) throw erroDaEmissao(r.status, r.corpo);
  let respostas: genericBatched.GenericBatchTokenResponse;
  try {
    respostas = new genericBatched.Client().deserializeTokenResponse(bytes);
  } catch {
    throw erroDe("rede");
  }
  if (respostas.tokenResponses.length !== PASSES_POR_DIA) throw erroDe("rede");
  const passes: string[] = [];
  for (let i = 0; i < PASSES_POR_DIA; i++) {
    const resposta = respostas.tokenResponses[i].tokenResponse;
    if (!(resposta instanceof publicVerif.TokenResponse)) throw erroDe("rede");
    passes.push(await terminar(clientes[i], resposta, publica));
  }
  const atual = podar(ler(), agora);
  const s = String(semana);
  gravar({ ...atual, porSemana: { ...atual.porSemana, [s]: [...(atual.porSemana[s] ?? []), ...passes] }, pegouEm: diaUtc(agora) });
}

/**
 * Tira um passe geral (o mais velho que ainda vale) e devolve o cabeçalho `Authorization` para a ação anônima. O passe sai deste
 * aparelho antes do uso: gasto ou perdido na rede, não volta (quem confere recusaria o repetido de todo jeito).
 */
export async function gastarPasse(agora: number = Date.now()): Promise<string> {
  await garantirPasses(agora);
  const g = podar(ler(), agora);
  const s = Object.keys(g.porSemana).sort((a, b) => Number(a) - Number(b))[0];
  const passe = s ? g.porSemana[s][0] : undefined;
  if (!s || !passe) throw erroDe("sem_passes");
  gravar({ ...g, porSemana: { ...g.porSemana, [s]: g.porSemana[s].slice(1) } });
  return cabecalhoDoPasse(passe);
}

// ── O passe da urna (com contexto) ───────────────────────────────────────────────────────────────────────────────────────

/**
 * Pega (com a sessão da conta) o passe da urna desta votação, se ainda não há um neste aparelho, e o guarda. Uma vez por conta por
 * votação ("ja_pegou" depois). Erros: os de garantirPasses, mais "sem_permissao" (a conta não vota nesta votação) e "invalido".
 */
export async function pegarPasseDaUrna(tipo: TipoDaUrna, alvo: string): Promise<void> {
  const contexto = contextoDaUrna(tipo, alvo);
  if (!contexto) throw erroDe("invalido");
  const nome = paraB64u(contexto);
  if (ler().urnas[nome]) return;
  const r0 = await postComSessao("/api/alumia/passes/emitir", { tipo, alvo });
  if (r0.status === 403 && r0.corpo?.erro === "sem_permissao") throw erroDe("sem_permissao");
  if (r0.status !== 200 || r0.corpo?.contexto !== nome) throw erroDaEmissao(r0.status, r0.corpo);
  const { publica } = await chaveConferida(r0.corpo, contexto);
  const cliente = new publicVerif.Client(MODO);
  const pedido = await cliente.createTokenRequest(desafio(contexto), publica);
  const r = await postComSessao("/api/alumia/passes/emitir", { tipo, alvo, pedido: paraB64u(pedido.serialize()) });
  const bytes = r.status === 200 ? deB64u(r.corpo?.resposta) : null;
  if (!bytes) throw erroDaEmissao(r.status, r.corpo);
  let resposta: publicVerif.TokenResponse;
  try {
    resposta = publicVerif.TokenResponse.deserialize(bytes);
  } catch {
    throw erroDe("rede");
  }
  const passe = await terminar(cliente, resposta, publica);
  const g = ler();
  gravar({ ...g, urnas: { ...g.urnas, [nome]: passe } });
}

/** O cabeçalho do passe da urna desta votação guardado neste aparelho, ou nulo. Não tira o passe (tire com esquecerPasseDaUrna). */
export function passeDaUrna(tipo: TipoDaUrna, alvo: string): string | null {
  const contexto = contextoDaUrna(tipo, alvo);
  const p = contexto ? ler().urnas[paraB64u(contexto)] : undefined;
  return p ? cabecalhoDoPasse(p) : null;
}

/** Tira o passe da urna desta votação (depois do depósito aceito, ou quando a votação fecha). */
export function esquecerPasseDaUrna(tipo: TipoDaUrna, alvo: string): void {
  const contexto = contextoDaUrna(tipo, alvo);
  if (!contexto) return;
  const g = ler();
  const urnas = { ...g.urnas };
  delete urnas[paraB64u(contexto)];
  gravar({ ...g, urnas });
}

/** O passe com contexto (o contrato da R3): pega se não há e devolve o cabeçalho. */
export async function passeComContexto(tipo: TipoDaUrna, alvo: string): Promise<string> {
  await pegarPasseDaUrna(tipo, alvo);
  const p = passeDaUrna(tipo, alvo);
  if (!p) throw erroDe("sem_passes");
  return p;
}

/** Só para os testes: esquece a memória (o armazenamento continua). */
export function _esquecerMemoria(): void {
  memoria = null;
  vistaNaMemoria = null;
}
