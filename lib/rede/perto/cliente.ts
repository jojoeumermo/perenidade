// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";
//
// O lado do navegador do "Perto" (Prompt 4, itens 2, 7 e 8), atrás de "alumia-p4-perto":
//   - o CÍRCULO DE CONFIANÇA: os contatos de segurança do modo ato que ACEITARAM (public.alumia_ato_situacao) com quem a pessoa tem
//     uma conversa aberta no chat cifrado (a conversa é o canal; o servidor não sabe que ela é do círculo);
//   - compartilhar a posição por tempo limitado (item 2): o aparelho lê a posição (navigator.geolocation, que pergunta a permissão),
//     arredonda AQUI e manda cifrada a cada conversa; ao vencer ou ao parar, manda "parei";
//   - o pedido de ajuda (item 7) e a volta para casa (item 8), com o cronômetro só neste aparelho.
// Nenhuma posição vai ao servidor em claro, nenhuma fica no disco, nenhuma vai a serviço de mapa de fora.
// Na prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim) nada vai a lugar nenhum: um dublê na memória da aba faz a tela andar.
import { modoAto } from "../modoato/cliente";
import { previaLigada } from "../publicar/alumia2";
import { type CorpoDePosicao, corpoDePosicao, distancia, duracaoDaVez, PAREI, PEDIDO, type Precisao, type Prazo, sosSemPosicao, VIDA_DE_UMA_VEZ_MS } from "./posicao";
import { CHAVE_DA_VOLTA, comecarVolta, guardarVolta, lerVolta, maisTempo, retomarVolta, type Volta } from "./volta";

export interface PessoaDoCirculo {
  handle: string;
  nome: string;
  /** A conversa aberta com ela (null: ainda não há; a tela oferece abrir). */
  conversa: string | null;
  /** A conversa já foi confirmada pela outra pessoa (dá para mandar agora). */
  pronta: boolean;
}

const erro = (codigo: string) => Object.assign(new Error(codigo), { code: codigo });
const previa = () => previaLigada();
const navegador = () => import("../chat/r2/navegador");

async function meuChat() {
  const { quemSouEu, chatDaConta, naFila } = await navegador();
  const { usuario } = await quemSouEu();
  const chat = usuario ? await chatDaConta(usuario) : null;
  return { chat, naFila };
}

/** O círculo: os contatos de segurança que aceitaram, com a conversa do chat de cada um (pelo @, que é o codinome do chat). */
export async function meuCirculo(): Promise<PessoaDoCirculo[]> {
  const situacao = await modoAto.situacao();
  const aceitos = situacao.contatos.filter((c) => c.aceito && c.handle);
  if (previa()) return aceitos.map((c, i) => ({ handle: c.handle!, nome: c.nome, conversa: i === 0 ? `previa-${c.handle}` : null, pronta: i === 0 }));
  const { chat } = await meuChat();
  const conversas = chat?.conversas() ?? [];
  return aceitos.map((c) => {
    const h = c.handle!.toLowerCase();
    const conv = conversas.find((x) => x.codinome === h && x.situacao === "aberta" && !x.bloqueada) ?? null;
    return { handle: c.handle!, nome: c.nome, conversa: conv?.id ?? null, pronta: !!conv && !!chat?.podeEscreverAgora(conv.id) };
  });
}

/** Na prévia: a Brasa compartilha a posição do bairro por 1 h (só na memória da aba, para a tela andar). */
let exemploPosto = false;
export async function exemploDaPrevia(): Promise<void> {
  if (!previa() || exemploPosto) return;
  exemploPosto = true;
  const { guardaDePosicoes } = await import("./guarda");
  guardaDePosicoes.receber("c:previa-brasa", "previa-brasa", corpoDePosicao({ la: -8.0632, lo: -34.8711, precisao: "bairro", duracaoMs: 60 * 60_000 }), Date.now());
}

/** O nome (o @ que este aparelho conhece) de quem mandou cada posição, pela origem "c:<conversa>". */
export async function nomesDasOrigens(): Promise<Record<string, string>> {
  if (previa()) return { "c:previa-brasa": "brasa" };
  const { chat } = await meuChat();
  return Object.fromEntries((chat?.conversas() ?? []).map((c) => [`c:${c.id}`, c.codinome]));
}

/** Abre (pede) a conversa com alguém do círculo que ainda não tem conversa. */
export async function abrirConversa(handle: string): Promise<void> {
  if (previa()) return;
  const { chat } = await import("../cliente-chat");
  await chat.abrir(handle);
}

/** Manda o mesmo corpo a cada conversa (cada uma cifrada à parte). Devolve quantas conversas receberam. */
async function mandarA(conversas: readonly string[], corpo: CorpoDePosicao): Promise<{ entregues: number; falharam: number }> {
  if (previa()) return { entregues: conversas.length, falharam: 0 };
  const { chat, naFila } = await meuChat();
  if (!chat) throw erro("dm_sem_chave");
  let entregues = 0;
  let falharam = 0;
  for (const id of conversas) {
    try {
      const r = await naFila(() => chat.mandarPosicao(id, corpo));
      if (r.entregues > 0) entregues++;
      else falharam++;
    } catch {
      falharam++;
    }
  }
  return { entregues, falharam };
}

/** A posição de agora (pergunta a permissão na primeira vez). null: sem permissão, sem sinal ou demorou. */
function posicaoDeAgora(precisa: boolean, limiteMs = 12_000): Promise<{ la: number; lo: number } | null> {
  if (previa()) return Promise.resolve({ la: -8.0476, lo: -34.877 });
  const geo = typeof navigator !== "undefined" ? navigator.geolocation : undefined;
  if (!geo) return Promise.resolve(null);
  return new Promise((pronto) => {
    geo.getCurrentPosition(
      (p) => pronto({ la: p.coords.latitude, lo: p.coords.longitude }),
      () => pronto(null),
      { enableHighAccuracy: precisa, timeout: limiteMs, maximumAge: 30_000 },
    );
  });
}

// ── Compartilhar (item 2) ───────────────────────────────────────────────────────────────────────────────────────────────────

export type EstadoDoCompartilhar =
  | { ligado: false; erro?: string }
  | { ligado: true; prazo: Prazo; precisao: Precisao; conversas: string[]; comecou: number; ultimaEm: number | null; erro?: string };

/** Entre uma atualização e outra: no mínimo isto (e só se andou 100 m); no "até eu parar", renova a cada 5 min mesmo parada. */
const INTERVALO_MS = 60_000;
const RENOVAR_MS = 5 * 60_000;

let estado: EstadoDoCompartilhar = { ligado: false };
let vigia: number | null = null;
let relogio: ReturnType<typeof setInterval> | null = null;
let ultima: { la: number; lo: number; em: number } | null = null;
let ultimaVista: { la: number; lo: number } | null = null;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((o) => o());
const mudar = (novo: EstadoDoCompartilhar) => {
  estado = novo;
  avisar();
};

/** As conversas que ainda servem (abertas e sem bloqueio): quem saiu do círculo para de receber na hora. */
async function aindaAbertas(conversas: readonly string[]): Promise<string[]> {
  if (previa()) return [...conversas];
  const { chat } = await meuChat();
  const abertas = new Set((chat?.conversas() ?? []).filter((c) => c.situacao === "aberta" && !c.bloqueada && !c.apagada).map((c) => c.id));
  return conversas.filter((c) => abertas.has(c));
}

async function enviarAgora(forcar: boolean) {
  if (!estado.ligado || !ultimaVista) return;
  const valem = await aindaAbertas(estado.conversas).catch(() => estado.ligado ? estado.conversas : []);
  if (!estado.ligado) return;
  if (valem.length !== estado.conversas.length) {
    if (!valem.length) return void pararDeCompartilhar(false);
    mudar({ ...estado, conversas: valem });
  }
  const agora = Date.now();
  const dura = duracaoDaVez(estado.prazo, estado.comecou, agora);
  if (dura === null) return void pararDeCompartilhar();
  if (!forcar && ultima) {
    const andou = distancia(ultima, ultimaVista);
    const passou = agora - ultima.em;
    if (passou < INTERVALO_MS || (andou < 100 && passou < (estado.prazo === "parar" ? RENOVAR_MS : 10 * RENOVAR_MS))) return;
  }
  const corpo = corpoDePosicao({ ...ultimaVista, precisao: estado.precisao, duracaoMs: dura });
  ultima = { ...ultimaVista, em: agora };
  const r = await mandarA(estado.conversas, corpo).catch(() => ({ entregues: 0, falharam: estado.ligado ? estado.conversas.length : 0 }));
  if (estado.ligado) mudar({ ...estado, ultimaEm: r.entregues > 0 ? agora : estado.ultimaEm, erro: r.entregues === 0 ? "nao_saiu" : undefined });
}

export const compartilhar = {
  estado: () => estado,
  ouvir(fazer: () => void): () => void {
    ouvintes.add(fazer);
    return () => void ouvintes.delete(fazer);
  },
  async comecar(o: { conversas: string[]; prazo: Prazo; precisao: Precisao }): Promise<void> {
    if (!o.conversas.length) throw erro("sem_circulo");
    await pararDeCompartilhar(false);
    const primeira = await posicaoDeAgora(o.precisao === "exata");
    if (!primeira) throw erro("sem_local");
    ultimaVista = primeira;
    ultima = null;
    mudar({ ligado: true, prazo: o.prazo, precisao: o.precisao, conversas: [...o.conversas], comecou: Date.now(), ultimaEm: null });
    await enviarAgora(true);
    if (!previa() && navigator.geolocation) {
      vigia = navigator.geolocation.watchPosition(
        (p) => {
          ultimaVista = { la: p.coords.latitude, lo: p.coords.longitude };
          void enviarAgora(false);
        },
        () => undefined,
        { enableHighAccuracy: o.precisao === "exata", maximumAge: 30_000, timeout: 60_000 },
      );
    }
    relogio = setInterval(() => void enviarAgora(false), 30_000);
  },
  parar: () => pararDeCompartilhar(),
  /**
   * Aceitar o pedido de localização de alguém (item 2): se já compartilho, a conversa entra na lista com o mesmo prazo e a mesma
   * precisão; senão, começa só com ela, por 1 h, só o bairro (a pessoa pode parar ou mudar depois).
   * A partilha em curso pode ser de posição EXATA: aí entrar nela entrega as coordenadas exatas, enquanto o botão do pedido
   * promete "só o bairro". Precisão exata só com a confirmação explícita de quem compartilha (posicaoExataConfirmada: true),
   * lida na tela antes de chamar.
   */
  async incluir(conversa: string, o: { posicaoExataConfirmada?: boolean } = {}): Promise<void> {
    if (estado.ligado) {
      if (estado.precisao === "exata" && o.posicaoExataConfirmada !== true) throw erro("precisa_confirmar_exata");
      if (!estado.conversas.includes(conversa)) mudar({ ...estado, conversas: [...estado.conversas, conversa] });
      const corpo = ultimaVista ? corpoDePosicao({ ...ultimaVista, precisao: estado.precisao, duracaoMs: duracaoDaVez(estado.prazo, estado.comecou, Date.now()) ?? 60_000 }) : null;
      if (corpo) await mandarA([conversa], corpo);
      return;
    }
    await this.comecar({ conversas: [conversa], prazo: 60, precisao: "bairro" });
  },
  /** Uma conversa saiu do círculo (fechada, bloqueada, apagada): para de mandar a ela, e para tudo se não sobrou ninguém. */
  tirar(conversa: string): void {
    if (!estado.ligado || !estado.conversas.includes(conversa)) return;
    const resto = estado.conversas.filter((c) => c !== conversa);
    if (!resto.length) void pararDeCompartilhar(false);
    else mudar({ ...estado, conversas: resto });
  },
};

/**
 * "Mandar onde estou agora, uma vez só" (item 2, ponto de encontro): uma posição que vale 1 h em quem recebe e não se renova (não liga
 * o compartilhamento). Devolve quantas conversas receberam.
 */
export async function mandarUmaVez(conversas: readonly string[], precisao: Precisao): Promise<{ entregues: number }> {
  if (!conversas.length) throw erro("sem_circulo");
  const p = await posicaoDeAgora(precisao === "exata");
  if (!p) throw erro("sem_local");
  const r = await mandarA(conversas, corpoDePosicao({ ...p, precisao, duracaoMs: VIDA_DE_UMA_VEZ_MS }));
  if (r.entregues === 0) throw erro("nao_saiu");
  return { entregues: r.entregues };
}

/** Pedir a localização de alguém (item 2): chega como pedido, sem posição; a pessoa aceita ou recusa, e recusar não avisa ninguém. */
export async function pedirLocalizacao(conversa: string): Promise<void> {
  const r = await mandarA([conversa], PEDIDO);
  if (r.entregues === 0) throw erro("nao_saiu");
}

async function pararDeCompartilhar(avisarQuemRecebe = true): Promise<void> {
  const antes = estado;
  if (vigia !== null && typeof navigator !== "undefined") navigator.geolocation?.clearWatch(vigia);
  if (relogio) clearInterval(relogio);
  vigia = null;
  relogio = null;
  ultima = null;
  ultimaVista = null;
  if (antes.ligado) {
    mudar({ ligado: false });
    // "Parei": quem recebe apaga na hora (sem isso, a posição sumiria só quando vencesse).
    if (avisarQuemRecebe) await mandarA(antes.conversas, PAREI).catch(() => undefined);
  }
}

// ── Pedido de ajuda (item 7) ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Manda o pedido de ajuda, com a posição EXATA de agora (se o aparelho conseguir em 12 s; senão, sem posição), a todas as conversas
 * prontas do círculo. A confirmação ("tem certeza?") é da tela.
 */
export async function pedirAjuda(conversas: readonly string[], opcoes: { volta?: boolean } = {}): Promise<{ entregues: number; falharam: number; semPosicao: boolean }> {
  if (!conversas.length) throw erro("sem_circulo");
  const p = await posicaoDeAgora(true);
  const corpo = p ? corpoDePosicao({ ...p, precisao: "exata", duracaoMs: 60 * 60_000, sos: true, volta: !!opcoes.volta }) : sosSemPosicao(!!opcoes.volta);
  const r = await mandarA(conversas, corpo);
  if (r.entregues === 0) throw erro("nao_saiu");
  return { ...r, semPosicao: !p };
}

/** As conversas prontas do círculo (as que recebem o pedido de ajuda). */
export async function conversasProntas(): Promise<string[]> {
  return (await meuCirculo()).filter((p) => p.pronta && p.conversa).map((p) => p.conversa!);
}

// ── Volta para casa (item 8): o cronômetro só neste aparelho ────────────────────────────────────────────────────────────────

const lerGuardada = (): string | null => {
  try {
    return globalThis.localStorage?.getItem(CHAVE_DA_VOLTA) ?? null;
  } catch {
    return null;
  }
};
const gravar = (v: Volta | null) => {
  try {
    if (v) globalThis.localStorage?.setItem(CHAVE_DA_VOLTA, guardarVolta(v));
    else globalThis.localStorage?.removeItem(CHAVE_DA_VOLTA);
  } catch {
    // sem armazenamento: o cronômetro vale enquanto a aba estiver aberta
  }
};
let voltaNaMemoria: Volta | null = null;
let voltaLida = false;
const ouvintesDaVolta = new Set<() => void>();

export const volta = {
  /** A volta em curso (lida do aparelho na primeira vez; vencida enquanto a Alumia estava fechada: o último aviso começa agora). */
  atual(): Volta | null {
    if (!voltaLida) {
      voltaLida = true;
      const lida = lerVolta(lerGuardada(), Date.now());
      voltaNaMemoria = lida ? retomarVolta(lida, Date.now()) : null;
      if (lida !== voltaNaMemoria) gravar(voltaNaMemoria);
    }
    return voltaNaMemoria;
  },
  ouvir(fazer: () => void): () => void {
    ouvintesDaVolta.add(fazer);
    return () => void ouvintesDaVolta.delete(fazer);
  },
  comecar(minutos: number) {
    this.trocar(comecarVolta(minutos, Date.now()));
  },
  mais(minutos: number) {
    const v = this.atual();
    if (v) this.trocar(maisTempo(v, minutos, Date.now()));
  },
  /** "Cheguei": para o cronômetro; com `estouBem`, manda o "Estou bem" do modo ato aos contatos de segurança. */
  async cheguei(estouBem: boolean): Promise<{ avisados: number } | null> {
    this.trocar(null);
    return estouBem ? modoAto.estouBem() : null;
  },
  /**
   * O prazo e o último aviso passaram: tira a volta do aparelho ANTES de mandar (assim outra aba aberta não manda de novo) e manda o
   * pedido de ajuda com a marca "volta". Devolve null se outra aba já tinha tirado.
   */
  async venceu(): Promise<Awaited<ReturnType<typeof pedirAjuda>> | null> {
    if (!voltaNaMemoria) return null;
    let outraAba = false;
    try {
      outraAba = !!globalThis.localStorage && globalThis.localStorage.getItem(CHAVE_DA_VOLTA) === null;
    } catch {
      // sem armazenamento: só esta aba sabe da volta
    }
    this.trocar(null);
    if (outraAba) return null;
    return pedirAjuda(await conversasProntas(), { volta: true });
  },
  trocar(v: Volta | null) {
    voltaLida = true;
    voltaNaMemoria = v;
    gravar(v);
    ouvintesDaVolta.forEach((o) => o());
  },
};

// O Sair rápido e o "apagar tudo do chat" param o compartilhamento (sem mandar nada) e esquecem a volta da memória.
void import("../chat/gaveta").then(({ aoApagarTudoDoChat }) =>
  aoApagarTudoDoChat(() => {
    void pararDeCompartilhar(false);
    voltaNaMemoria = null;
  }),
);
