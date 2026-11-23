// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O chat a dois da onda R2 montado no NAVEGADOR: o motor com a loja no OPFS, a loja selada deste aparelho (loja.ts), o histórico
// (lib/rede/chat/historico.ts), o registro de transparência (lib/rede/chat/transparencia.ts) e o transporte anônimo das caixas.
//
// O transporte é o das caixas anônimas (lib/rede/chat/r2/transporte-das-caixas.ts, sobre lib/rede/caixas/*, que falam com as rotas
// /api/alumia/* SEM a sessão da conta): ligado sozinho na primeira vez que o chat precisa dele, carregado só aqui (a casca do site não
// leva nada da cifra). `ligarTransporte` troca por outro (os testes).
import { carregarMotor } from "../../cifra/motor";
import { carregarSpqr } from "../r3/spqr";
import { agendarBusca } from "../../caixas/agenda";
import { ligarServidorDoChat } from "../../caixas/servidor-do-chat";
import { chamar } from "../../cliente";
import { guardarNoHistorico, mensagensDoHistorico, apagarConversaDoHistorico, apagarDoHistorico } from "../historico";
import { reabrirProteus } from "./proteus";
import { atualizarVista, conferirConta, INICIO, type LinhaDoRegistro, type VistaDoRegistro } from "../transparencia";
import { copia, deB64Url, paraB64Url, sortear } from "./bytes";
import { limparChatAntigo } from "./limpeza";
import { lerDaLoja, gravarNaLoja, apagarDaLoja, nomeDaLojaDoMotor } from "./loja";
import { ChatDoAparelho, type Dependencias, type EstadoDoAparelho, type Historico, type Lista, type MensagemDoChat, type Transporte } from "./servico";
import { cofreDaLista } from "../../aparelhos/sincronia";
import { type FonteDaIdentidade, ligarIdentidadeDoVoto } from "../../voto/identidade";
import { ligado } from "../../../recursos";

const erro = (codigo: string) => Object.assign(new Error(codigo), { code: codigo });

let transporte: Transporte | null = null;
/** Troca o transporte (os testes). Sem chamar isto, o chat usa o das caixas anônimas. */
export function ligarTransporte(t: Transporte): void {
  transporte = t;
}
/** O transporte do chat: o ligado, ou o das caixas anônimas (carregado na primeira vez). */
async function oTransporte(): Promise<Transporte> {
  if (!transporte) {
    let t = (await import("./transporte-das-caixas")).transporteDasCaixas();
    // Onda R3 (2.2, sem internet): só no app Android com o plugin da malha, o que o chat deposita também vai para a malha quando a
    // pessoa a ligou (lib/rede/malha/estou-bem.ts, comMalha). Imports dinâmicos: o site não baixa o núcleo da malha.
    if (await temMalhaNoApp()) {
      const { comMalha } = await import("../../malha/estou-bem");
      const malha = await import("../../malha/ativacao");
      t = comMalha(t, { guardar: (p) => malha.noDaMalha()?.guardar(p) ?? false }, () => malha.noDaMalha() !== null);
    }
    transporte = t;
  }
  return transporte;
}

/** Este código roda no app Android com o plugin da malha? (No site, nunca: lê só globalThis.Capacitor.) */
async function temMalhaNoApp(): Promise<boolean> {
  if (typeof globalThis === "undefined" || !("Capacitor" in globalThis)) return false;
  return (await import("../../malha/android")).pluginDaMalha() !== null;
}

/**
 * A malha reconhece as caixas deste chat (as da conversa a dois e a de sincronia) e entrega o que chega ao mesmo caminho da caixa,
 * na fila do chat (uma operação por vez). Só no app; trocada a cada chat aberto (a entrega guarda o último farol aceito por ato).
 */
async function ligarMalhaAoChat(chat: ChatDoAparelho): Promise<void> {
  if (!(await temMalhaNoApp())) return;
  const malha = await import("../../malha/ativacao");
  const { destinoComAtos } = await import("../../malha/atos");
  malha.definirDestino(destinoComAtos({ caixas: () => chat.caixasDaMalha(), mensagem: (id, d) => naFila(() => chat.receberDaMalha(copia(id), d)) }));
}

/** Ao sair da conta, no Sair rápido e no pânico: a malha esquece o chat e os atos e para o Bluetooth. */
function desligarMalhaDoChat(): void {
  if (typeof globalThis === "undefined" || !("Capacitor" in globalThis)) return;
  void (async () => {
    const malha = await import("../../malha/ativacao");
    malha.definirDestino(null);
    (await import("../../malha/atos")).esquecerAtos();
    malha.desligarMalha();
  })().catch(() => undefined);
}

/** A conta já tem o chat novo ativado em algum aparelho? (O diretório público mostra os aparelhos dela.) */
export async function chatPublicado(codinome: string): Promise<boolean> {
  const d = await (await oTransporte()).lerDiretorio(codinome);
  return !!d && d.aparelhos.length > 0;
}

interface Guardado {
  estado: EstadoDoAparelho;
  /** A chave da loja do motor (DatabaseKey, 32 bytes). */
  motor: string;
  vista: VistaDoRegistro;
}

/** As marcas de aviso, guardadas no campo `visto` do histórico (bits): 1 fora de ordem, 2 cadeia quebrada, 4 faltou mensagem. */
export const AVISOS_NO_HISTORICO = { fora_de_ordem: 1, cadeia_quebrada: 2, faltando: 4 } as const;

function historicoDe(conta: string): Historico {
  return {
    async guardar(m: MensagemDoChat) {
      const bits = m.avisos.reduce((n, a) => n | AVISOS_NO_HISTORICO[a], 0);
      await guardarNoHistorico({
        id: `${m.conversa}.${m.id}.${m.aparelho}`, conta, conversa: m.conversa, autor: m.autor, quando: new Date(m.quando).toISOString(), expira: new Date(m.expira).toISOString(),
        texto: m.texto, idInterno: m.id, contador: m.contador, visto: { versao: bits, contador: 0 }, versao: 2, umaVez: m.umaVez, prova: m.prova ?? null,
        ...(m.editada ? { editada: true } : {}), ...(m.pendente ? { pendente: true } : {}), ...(m.anexo ? { anexo: m.anexo } : {}),
        ...(m.encaminhada ? { encaminhada: m.encaminhada } : {}),
        ...(m.agendada ? { agendada: m.agendada } : {}),
        ...(m.posicao ? { posicao: m.posicao } : {}),
      });
    },
    async editar(conversa, id, autor, texto) {
      // Só a mensagem do próprio autor (quem pede a edição tem de ser quem escreveu); a cópia de cada aparelho troca o texto.
      const todas = await mensagensDoHistorico(conta, conversa, null, 10_000);
      for (const x of todas.filter((y) => y.idInterno === id && y.autor === autor)) await guardarNoHistorico({ ...x, texto, editada: true });
    },
    async apagar(conversa, id, autor) {
      const todas = await mensagensDoHistorico(conta, conversa, null, 10_000);
      await apagarDoHistorico(todas.filter((x) => x.idInterno === id && x.autor === autor).map((x) => x.id));
    },
    async apagarConversa(conversa) {
      await apagarConversaDoHistorico(conta, conversa);
    },
  };
}

/** Quem está na conta e o codinome dela (o diretório é por codinome). */
export async function quemSouEu(): Promise<{ usuario: string; codinome: string | null }> {
  const { getClient } = await import("../../../backend");
  const supabase = await getClient();
  const usuario = (await supabase.auth.getSession()).data.session?.user.id;
  if (!usuario) throw erro("sem_sessao");
  const situacao = await chamar<{ handle?: string | null }>("rede_situacao").catch(() => null);
  return { usuario, codinome: situacao?.handle ?? null };
}

let aberto: { conta: string; chat: Promise<ChatDoAparelho | null> } | null = null;
let betaApagado = false;
/** As lojas do chat do beta foram apagadas nesta abertura (a tela avisa uma vez). */
export const betaApagadoAgora = () => betaApagado;
let fila: Promise<unknown> = Promise.resolve();
/** Uma operação do chat por vez nesta aba (o motor e a loja não aceitam duas transações cruzadas do mesmo estado). */
export function naFila<T>(fazer: () => Promise<T>): Promise<T> {
  const vez = fila.then(fazer, fazer);
  fila = vez.catch(() => undefined);
  return vez;
}

async function dependencias(conta: string, guardado: { motor: string; vista: VistaDoRegistro }): Promise<Dependencias> {
  const t = await oTransporte();
  const M = await carregarMotor();
  const motor = M.CoreCrypto.new(await M.Database.open(nomeDaLojaDoMotor(conta), new M.DatabaseKey(deB64Url(guardado.motor))));
  const spqr = await carregarSpqr();
  let vista = guardado.vista;
  // O servidor do chat separado (R3, 3.1): só vale o endereço configurado que é o último anotado no registro que este aparelho
  // conferiu; vazio ou fora do registro, as caixas ficam no site. Refeito a cada vez que a vista anda.
  ligarServidorDoChat(vista.servidorChat);
  return {
    motor,
    spqr,
    transporte: t,
    historico: historicoDe(conta),
    cofre: cofreDaLista,
    persistir: (estado) => gravarNaLoja<Guardado>(conta, { estado, motor: guardado.motor, vista }),
    sigo: async (_conta, codinome) => {
      const { rede } = await import("../../cliente");
      return (await rede.perfil(codinome)).sigo === true;
    },
    // Prompt 4, item 2: a posição que chegou vai para a guarda da memória desta aba (só a última de cada pessoa, sem trajeto).
    aoPosicao: (p) => void import("../../perto/guarda").then((g) => g.posicaoChegou(`c:${p.conversa}`, p.autor, p.corpo, p.quando), () => undefined),
    // Prompt 4, itens 139 e 140: o toque da chamada vai para a guarda da memória desta aba (nada no disco, nenhum registro de chamadas).
    // Com "alumia-p4-chamadas" desligado, o toque é descartado.
    aoChamada: (c) => {
      if (ligado("alumia-p4-chamadas")) void import("../../chamada/guarda").then((g) => g.toqueChegou(c.conversa, c.autor, c.nome, c.corpo, c.quando), () => undefined);
    },
    conferirRegistro: async (usuario, identidade) => {
      try {
        vista = await atualizarVista(vista, {
          ponta: () => chamar<{ seq: number; resumo: string }>("rede_kt_ponta"),
          trecho: (desde) => chamar<LinhaDoRegistro[]>("rede_kt_trecho", { p_desde: desde }),
        });
        ligarServidorDoChat(vista.servidorChat);
        return await conferirConta(vista, usuario, identidade);
      } catch {
        return "quebrado";
      }
    },
  };
}

/**
 * A fonte da identidade do voto em limiar (lib/rede/voto/identidade.ts) a partir do chat deste aparelho: assina só textos do voto
 * e confere as identidades de quem criou a votação e das guardiãs no registro público das chaves (o mesmo da conversa a dois).
 * Identidade que o registro mostra diferente vira "trocada"; registro que não fecha, "nao_conferida": nos dois casos o voto não sai.
 */
export function fonteDoVoto(conta: string, chat: ChatDoAparelho): FonteDaIdentidade {
  return {
    minha: async () => ({ usuario: conta, publica: deB64Url(chat.identidadePublica()), assinar: async (t) => chat.assinarParaOVoto(t) }),
    conferir: async (usuario, identidade) => {
      const r = await chat.conferirNoRegistro(usuario, identidade);
      return r === "confere" ? "conferida" : r === "nao_confere" ? "trocada" : "nao_conferida";
    },
  };
}

/** Abre o chat da conta da sessão (para a urna, que precisa da identidade): liga a fonte do voto se o chat existe aqui. */
export async function abrirIdentidadeDoVoto(): Promise<void> {
  const { usuario } = await quemSouEu();
  await chatDaConta(usuario);
}

// ── O relógio próprio do chat (revisão final da R2: metadados) ───────────────────────────────────────────────────────────────
/** O período da rotina: a lista sincronizada vai ao servidor (com sessão) uma vez por período, mudada ou não. */
export const PERIODO_DA_ROTINA_MS = 10 * 60_000;
/** Um instante sorteado em [0, maximo) por crypto.getRandomValues (nunca Math.random). */
export function sorteioDeTempo(maximo: number): number {
  const b = new Uint32Array(1);
  crypto.getRandomValues(b);
  return Math.floor((b[0] / 2 ** 32) * maximo);
}
let relogioDe: ChatDoAparelho | null = null;
/**
 * Liga o relógio do chat aberto nesta aba: a primeira volta num instante sorteado do período e, depois, uma a cada período. Em cada
 * volta, a rotina COM sessão (grava a lista, repõe pré-chaves) e, num instante sorteado dentro do período, a SEM sessão (cria a
 * caixa de sincronia). Nenhum evento do chat grava com sessão: o banco não vê a gravação da conta logo depois da chamada anônima.
 */
function ligarRelogio(chat: ChatDoAparelho): void {
  if (relogioDe === chat || typeof setTimeout !== "function") return;
  relogioDe = chat;
  const volta = () => {
    if (relogioDe !== chat) return;
    void naFila(() => chat.rotinaComSessao()).catch(() => undefined);
    setTimeout(() => {
      if (relogioDe === chat) void naFila(() => chat.rotinaAnonima()).catch(() => undefined);
    }, sorteioDeTempo(PERIODO_DA_ROTINA_MS));
    setTimeout(volta, PERIODO_DA_ROTINA_MS);
  };
  setTimeout(volta, sorteioDeTempo(PERIODO_DA_ROTINA_MS));
  vigiarCaixas(chat);
}

// ── O aviso para a tela (só nesta aba, nada vai à rede) ──────────────────────────────────────────────────────────────────────
type AoChegar = (qual: string) => void;
const ouvintes = new Set<AoChegar>();
/**
 * A tela aberta é avisada quando a agenda acabou de buscar uma caixa (o id da conversa, "sincronia" ou "pedidos"), para reler o
 * histórico deste aparelho na hora, em vez de esperar a próxima volta dela. É só um aviso dentro da aba: o horário das buscas
 * continua o da agenda (não depende de ter chegado mensagem), e nada aqui chama o servidor. Devolve a função que para de ouvir.
 */
export function aoChegarNoChat(fazer: AoChegar): () => void {
  ouvintes.add(fazer);
  return () => void ouvintes.delete(fazer);
}
function avisarTela(qual: string): void {
  for (const f of ouvintes) {
    try {
      f(qual);
    } catch {
      /* a tela que falhou não derruba a agenda */
    }
  }
}

// ── A agenda das caixas (onda R3, 3.3) ───────────────────────────────────────────────────────────────────────────────────────
let vigias: { chat: ChatDoAparelho; ativas: Map<string, () => void> } | null = null;
/**
 * Cada caixa deste aparelho (pedidos, sincronia, cada conversa) é buscada no SEU horário, pela agenda das caixas (intervalo fixo do
 * estado do aparelho, deslocamento sorteado por caixa), e não mais todas juntas a cada 30 s: buscar todas no mesmo instante ligava as
 * caixas entre si pelo horário. Conversa nova entra na agenda; conversa apagada sai.
 */
function vigiarCaixas(chat: ChatDoAparelho): void {
  pararVigias();
  const ativas = new Map<string, () => void>();
  vigias = { chat, ativas };
  const acertar = () => {
    if (vigias?.chat !== chat) return;
    const quer = new Set(chat.caixasVigiadas());
    for (const [qual, parar] of ativas) {
      if (quer.has(qual)) continue;
      parar();
      ativas.delete(qual);
    }
    for (const qual of quer)
      if (!ativas.has(qual))
        ativas.set(qual, agendarBusca(async () => {
          await naFila(() => chat.receberCaixa(qual));
          acertar();
          avisarTela(qual);
        }));
  };
  acertar();
}
/** A agenda das caixas está buscando para este chat? (A tela então só lê o que já chegou: não puxa as caixas todas de uma vez.) */
export const agendaLigada = (chat: ChatDoAparelho): boolean => vigias?.chat === chat;
function pararVigias(): void {
  for (const parar of vigias?.ativas.values() ?? []) parar();
  vigias = null;
}

/** O chat desta conta neste aparelho, se já foi ativado aqui. A primeira chamada limpa as lojas do beta. */
export function chatDaConta(conta: string): Promise<ChatDoAparelho | null> {
  if (aberto?.conta === conta) return aberto.chat;
  const chat = (async () => {
    if (await limparChatAntigo()) betaApagado = true;
    const guardado = await lerDaLoja<Guardado>(conta);
    if (!guardado) return null;
    const deps = await dependencias(conta, guardado);
    // O motor reaberto (página recarregada, outra aba) só cifra e decifra depois de ligar o Proteus de novo: o @wireapp/core-crypto
    // carrega a identidade da loja para a memória só no proteusInit. Era o "F5 quebra a conversa". Loja do motor trocada ou perdida
    // (impressão diferente da deste aparelho): "motor_trocado", e a tela oferece ligar este aparelho de novo.
    await reabrirProteus(deps.motor, guardado.estado.aparelho.impressao);
    const c = new ChatDoAparelho(deps, guardado.estado);
    ligarIdentidadeDoVoto(fonteDoVoto(conta, c));
    ligarRelogio(c);
    await ligarMalhaAoChat(c).catch(() => undefined);
    return c;
  })();
  aberto = { conta, chat };
  chat.catch(() => {
    if (aberto?.chat === chat) aberto = null;
  });
  return chat;
}

/**
 * Ativa o chat neste aparelho: aparelho NOVO, com chaves novas da conta (primeira vez) ou com as que vieram do QR de ligar ou da
 * cópia de segurança. Nunca reaproveita sessão nem chave de aparelho de antes.
 */
export async function ativarAqui(conta: string, codinome: string, chaves?: { identidade: Uint8Array; pedidos: Uint8Array; sincronia: Uint8Array; geracao?: number }, lista?: Lista | null): Promise<ChatDoAparelho> {
  if (await limparChatAntigo()) betaApagado = true;
  await apagarDaLoja(conta);
  const guardado = { motor: paraB64Url(sortear(32)), vista: INICIO };
  const deps = await dependencias(conta, guardado);
  const chat = await ChatDoAparelho.nascer(deps, conta, codinome, chaves ? { identidade: copia(chaves.identidade), pedidos: copia(chaves.pedidos), sincronia: copia(chaves.sincronia), lista: lista ?? null, geracao: chaves.geracao } : undefined);
  aberto = { conta, chat: Promise.resolve(chat) };
  ligarIdentidadeDoVoto(fonteDoVoto(conta, chat));
  ligarRelogio(chat);
  await ligarMalhaAoChat(chat).catch(() => undefined);
  return chat;
}

/** Esquece o chat desta conta neste aparelho (a loja, o motor e o histórico). As outras contas ficam. */
export async function esquecerAqui(conta: string): Promise<void> {
  if (aberto?.conta === conta) {
    aberto = null;
    relogioDe = null;
    pararVigias();
    ligarIdentidadeDoVoto(null);
    desligarMalhaDoChat();
  }
  await apagarDaLoja(conta);
  await apagarConversaDoHistorico(conta).catch(() => undefined);
}

/** Depois do "Sair rápido" ou do pânico: esta aba esquece o chat aberto (a loja já foi apagada por quem chamou). */
export function esquecerNaMemoria(): void {
  aberto = null;
  relogioDe = null;
  pararVigias();
  ligarIdentidadeDoVoto(null);
  desligarMalhaDoChat();
}

// ── Ligar um aparelho pelo QR (lib/rede/aparelhos/ligar.ts) ─────────────────────────────────────────────────────────────────
/**
 * Aparelho NOVO (a conta já entrou nele, o chat ainda não): mostra o QR e espera o aparelho velho mandar as chaves da conta pelo
 * canal (uma caixa anônima). O QR vale 10 minutos; o canal é apagado no fim, com ou sem sucesso.
 */
export async function esperarLigacao(conta: string, codinome: string): Promise<{ qr: string; esperar: (parar: () => boolean) => Promise<"ligado" | "expirou" | "parou"> }> {
  const t = await oTransporte();
  const { prepararQr, abrirNoNovo, esquecerEspera, VALIDADE_DO_QR_MS } = await import("../../aparelhos/ligar");
  const { resumoDoPasse } = await import("./conversa");
  const { qr, espera } = await prepararQr(conta);
  await t.criarCaixa({ id: espera.canal.id, pdH: resumoDoPasse(espera.canal.pd), pl: espera.canal.pl });
  const canal = { id: espera.canal.id, pl: espera.canal.pl };
  return {
    qr,
    async esperar(parar) {
      try {
        while (Date.now() - espera.criadoEm < VALIDADE_DO_QR_MS) {
          if (parar()) return "parou";
          for (const p of await t.buscar(canal, 0).catch(() => [])) {
            const pacote = await abrirNoNovo(espera, p.envelope);
            if (!pacote) continue;
            await naFila(() =>
              ativarAqui(conta, codinome, { identidade: deB64Url(pacote.identidade), pedidos: deB64Url(pacote.pedidos), sincronia: deB64Url(pacote.sincronia), geracao: pacote.geracao }),
            );
            return "ligado";
          }
          await new Promise((r) => setTimeout(r, 2000));
        }
        return "expirou";
      } finally {
        await t.apagar(canal).catch(() => undefined);
        esquecerEspera(espera);
      }
    },
  };
}

/** Aparelho VELHO: lê o QR do aparelho novo e manda as chaves da conta (nunca as do aparelho) pelo canal. */
export async function ligarPeloQr(conta: string, qr: string): Promise<"enviado" | "outra_conta" | "invalido"> {
  const t = await oTransporte();
  const c = await chatDaConta(conta);
  if (!c) throw erro("dm_sem_chave");
  const { lerQr, selarParaONovo } = await import("../../aparelhos/ligar");
  const lido = lerQr(qr.trim(), conta);
  if (lido === "invalido" || lido === "outra_conta") return lido;
  const chaves = c.chavesDaConta();
  const envelope = await selarParaONovo(lido, { conta, identidade: chaves.identidade, pedidos: chaves.pedidos, sincronia: chaves.sincronia, lista: null, geracao: c.geracaoDaLista() });
  await t.depositar(lido.canal, envelope, null);
  return "enviado";
}

// ── A cópia de segurança (lib/rede/aparelhos/copia.ts) ──────────────────────────────────────────────────────────────────────
/**
 * Cria (ou troca) a cópia de segurança: cifrada AQUI, com 24 palavras sorteadas (devolvidas uma vez, para a pessoa anotar) ou com o
 * Argon2id de uma frase dela. O servidor guarda só o arquivo cifrado. Não leva sessão, estado de grupo nem chave de aparelho.
 */
export async function criarCopia(conta: string, modo: "palavras" | "frase", frase?: string): Promise<{ palavras?: string[] }> {
  const t = await oTransporte();
  const c = await chatDaConta(conta);
  if (!c) throw erro("dm_sem_chave");
  const copia = await import("../../aparelhos/copia");
  let chave: Uint8Array;
  let argon: Parameters<typeof copia.cifrarCopia>[2] = null;
  let palavras: string[] | undefined;
  if (modo === "frase") {
    if (!frase || [...frase.trim()].length < 12) throw erro("frase_curta");
    const r = await copia.chaveDaFrase(frase);
    chave = r.chave;
    argon = r.cabecalho;
  } else {
    const r = copia.novaChaveDaCopia();
    chave = r.chave;
    palavras = r.palavras;
  }
  const k = c.chavesDaConta();
  const arquivo = await copia.cifrarCopia(chave, { v: 1, conta, identidade: k.identidade, pedidos: k.pedidos, sincronia: k.sincronia, lista: c.estado.lista, codigos: {}, feitaDia: Math.floor(Date.now() / 86_400_000) }, argon);
  chave.fill(0);
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const atual = await t.lerCofre("copia");
    if ((await t.gravarCofre("copia", atual?.versao ?? 0, arquivo)) !== "versao_ocupada") return { palavras };
  }
  throw erro("lista_ocupada");
}

/** A cópia de segurança desta conta existe no servidor? E de que jeito ela abre (palavras ou frase)? */
export async function copiaGuardada(): Promise<"palavras" | "frase" | null> {
  const guardada = await (await oTransporte()).lerCofre("copia");
  if (!guardada) return null;
  const { modoDaCopia } = await import("../../aparelhos/copia");
  return modoDaCopia(guardada.blob)?.modo ?? null;
}

/** Restaura a cópia NESTE aparelho: aparelho novo com as chaves da conta e a lista; sessões e grupos se refazem. */
export async function restaurarCopia(conta: string, codinome: string, segredo: string): Promise<"restaurada" | "errada" | "sem_copia"> {
  const guardada = await (await oTransporte()).lerCofre("copia");
  if (!guardada) return "sem_copia";
  const copia = await import("../../aparelhos/copia");
  const modo = copia.modoDaCopia(guardada.blob);
  if (!modo) return "errada";
  const chave = modo.modo === "palavras" ? copia.chaveDasPalavras(segredo) : (await copia.chaveDaFrase(segredo, modo.argon2id ?? undefined).catch(() => null))?.chave ?? null;
  if (!chave) return "errada";
  const aberta = await copia.abrirCopia(chave, guardada.blob);
  chave.fill(0);
  if (!aberta || aberta.conta !== conta) return "errada";
  await naFila(() => ativarAqui(conta, codinome, { identidade: deB64Url(aberta.identidade), pedidos: deB64Url(aberta.pedidos), sincronia: deB64Url(aberta.sincronia) }, (aberta.lista as Lista | null) ?? null));
  return "restaurada";
}
