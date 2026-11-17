// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As contas da frente 13D (leve e no seu tempo), sem tela e sem navegador: a fila de posts que esperam a rede NESTE aparelho, a
// impressão que evita o post em dobro e a hora de parar. Tudo mora no armazenamento do próprio aparelho, com o prefixo da Alumia
// ("lucia:rede", lib/rede/saida.ts): o Sair rápido apaga junto. Nada disto vai ao servidor; a única coisa que sai é o post, quando a
// pessoa (ou a volta da rede) manda, pela mesma função de publicar de sempre (rede_publicar).
// Sem "@/" de propósito: os testes rodam estas funções no Node (scripts/testar-alumia-o13-leve.mjs).

/** O mínimo de um armazenamento (localStorage ou um falso nos testes). */
export interface ArmazemDaFila {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
  removeItem(chave: string): void;
}

/** As chaves deste aparelho. Todas começam por "lucia:rede": o Sair rápido (lib/rede/saida.ts) apaga sem precisar saber delas. */
export const CHAVES_DO_LEVE = {
  fila: "lucia:rede:leve:fila",
  saiu: "lucia:rede:leve:saiu",
  parar: "lucia:rede:leve:parar",
  pararVisto: "lucia:rede:leve:parar-visto",
} as const;

/** Quantos posts podem esperar a rede ao mesmo tempo neste aparelho. */
export const LIMITE_DA_FILA = 10;
/** O tamanho máximo do texto guardado (o banco confere de novo o dele na hora de publicar). */
export const LIMITE_DO_TEXTO = 5000;
/** Depois disto o post não sai sozinho: um texto de dias atrás (um ato, um chamado) pode não valer mais. A pessoa decide. */
export const DIAS_PARA_SAIR_SOZINHO = 3;
/** Por quanto tempo a impressão do post que saiu fica guardada (para o mesmo texto não sair duas vezes). */
export const MINUTOS_DA_IMPRESSAO = 15;
/** Depois de quanto tempo um envio que ficou "enviando" (aba fechada no meio) volta a valer como pendente. */
export const MINUTOS_DO_ENVIO_PRESO = 2;

/** Os dois públicos que o "Escrever leve" oferece: toda a Alumia ou só quem segue a pessoa (sem comunidade, sem roda, sem prazo). */
export const PUBLICOS_DO_LEVE = ["membros", "seguidores"] as const;
export type PublicoDoLeve = (typeof PUBLICOS_DO_LEVE)[number];

/** O pedido de publicação inteiro, guardado como vai ao banco (só post curto, sem imagem: o que cabe sem rede). */
export interface PedidoGuardado {
  tipo: "post";
  texto: string;
  publico: PublicoDoLeve;
}

export interface ItemDaFila {
  /** Um número aleatório deste aparelho (para apagar ou reenviar um item), sem relação com o banco. */
  id: string;
  /** O @ da conta que escreveu: o post nunca sai em outra conta que entrar depois neste aparelho. */
  conta: string;
  pedido: PedidoGuardado;
  criado_em: number;
  tentativas: number;
  /** O motivo do servidor quando ele recusou (aí não tenta sozinho de novo: a pessoa decide). */
  erro: string | null;
  /** Marcado antes de chamar o servidor; protege de duas abas mandarem o mesmo post. */
  enviando_desde: number | null;
}

export type SituacaoDoItem = "pronto" | "enviando" | "recusado" | "parado" | "outra_conta";

function lerJson<T>(armazem: ArmazemDaFila | null | undefined, chave: string, padrao: T): T {
  if (!armazem) return padrao;
  try {
    const bruto = armazem.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T) : padrao;
  } catch {
    return padrao;
  }
}

function gravarJson(armazem: ArmazemDaFila | null | undefined, chave: string, valor: unknown, vazio: boolean): void {
  if (!armazem) return;
  try {
    if (vazio) armazem.removeItem(chave);
    else armazem.setItem(chave, JSON.stringify(valor));
  } catch {
    // armazenamento cheio ou bloqueado: a tela diz que não guardou (guardarNaFila devolve o motivo)
  }
}

/** Confere a forma de um item lido do aparelho (um valor torto, de versão velha ou mexido à mão, é deixado de fora). */
function itemValido(x: unknown): x is ItemDaFila {
  const i = x as ItemDaFila;
  return Boolean(
    i && typeof i.id === "string" && typeof i.conta === "string" && i.pedido && i.pedido.tipo === "post" && typeof i.pedido.texto === "string"
      && (PUBLICOS_DO_LEVE as readonly string[]).includes(i.pedido.publico) && typeof i.criado_em === "number",
  );
}

/** A fila deste aparelho, do mais antigo ao mais novo. */
export function lerFila(armazem: ArmazemDaFila | null | undefined): ItemDaFila[] {
  const lista = lerJson<unknown>(armazem, CHAVES_DO_LEVE.fila, []);
  return Array.isArray(lista) ? lista.filter(itemValido).sort((a, b) => a.criado_em - b.criado_em) : [];
}

function gravarFila(armazem: ArmazemDaFila | null | undefined, fila: readonly ItemDaFila[]): boolean {
  gravarJson(armazem, CHAVES_DO_LEVE.fila, fila, fila.length === 0);
  // Confere: um aparelho sem espaço não pode deixar a pessoa achando que guardou.
  return fila.length === 0 || lerFila(armazem).length === fila.length;
}

/** O texto como vai: espaços das pontas fora, quebras de linha mantidas, nada além do limite. */
export function textoLimpo(texto: string): string {
  return texto.replace(/\r\n?/g, "\n").trim();
}

export type ResultadoDeGuardar =
  | { ok: true; item: ItemDaFila; repetido: boolean }
  | { ok: false; motivo: "vazio" | "longo" | "cheia" | "sem_conta" | "publico" | "sem_espaco" };

/**
 * Guarda um post na fila deste aparelho. O mesmo texto, com o mesmo público e da mesma conta, não entra duas vezes (devolve o que
 * já estava). `sorteio` dá o id (no navegador, crypto.randomUUID).
 */
export function guardarNaFila(
  armazem: ArmazemDaFila | null | undefined,
  dados: { conta: string | null | undefined; texto: string; publico: string },
  agora: number,
  sorteio: () => string,
): ResultadoDeGuardar {
  const texto = textoLimpo(dados.texto);
  if (!dados.conta) return { ok: false, motivo: "sem_conta" };
  if (!texto) return { ok: false, motivo: "vazio" };
  if (texto.length > LIMITE_DO_TEXTO) return { ok: false, motivo: "longo" };
  if (!(PUBLICOS_DO_LEVE as readonly string[]).includes(dados.publico)) return { ok: false, motivo: "publico" };
  const fila = lerFila(armazem);
  const igual = fila.find((i) => i.conta === dados.conta && i.pedido.texto === texto && i.pedido.publico === dados.publico);
  if (igual) return { ok: true, item: igual, repetido: true };
  if (fila.length >= LIMITE_DA_FILA) return { ok: false, motivo: "cheia" };
  const item: ItemDaFila = {
    id: sorteio(),
    conta: dados.conta,
    pedido: { tipo: "post", texto, publico: dados.publico as PublicoDoLeve },
    criado_em: agora,
    tentativas: 0,
    erro: null,
    enviando_desde: null,
  };
  if (!gravarFila(armazem, [...fila, item])) return { ok: false, motivo: "sem_espaco" };
  return { ok: true, item, repetido: false };
}

/** Tira um item da fila (a pessoa apagou, ou ele saiu). */
export function tirarDaFila(armazem: ArmazemDaFila | null | undefined, id: string): void {
  gravarFila(armazem, lerFila(armazem).filter((i) => i.id !== id));
}

function mudarItem(armazem: ArmazemDaFila | null | undefined, id: string, mudar: (i: ItemDaFila) => ItemDaFila): void {
  gravarFila(armazem, lerFila(armazem).map((i) => (i.id === id ? mudar(i) : i)));
}

/** Em que pé está um item, para a tela dizer e para o envio sozinho decidir. */
export function situacaoDoItem(item: ItemDaFila, conta: string | null | undefined, agora: number): SituacaoDoItem {
  if (item.conta !== conta) return "outra_conta";
  if (item.enviando_desde !== null && agora - item.enviando_desde < MINUTOS_DO_ENVIO_PRESO * 60_000) return "enviando";
  if (item.erro) return "recusado";
  if (agora - item.criado_em > DIAS_PARA_SAIR_SOZINHO * 86_400_000) return "parado";
  return "pronto";
}

/** O que sai sozinho quando a rede volta: só os prontos da conta que está aberta, do mais antigo ao mais novo. */
export function prontosParaSair(fila: readonly ItemDaFila[], conta: string | null | undefined, agora: number): ItemDaFila[] {
  return fila.filter((i) => situacaoDoItem(i, conta, agora) === "pronto");
}

/**
 * A falha foi da rede (aí o post continua esperando) ou o servidor respondeu "não" (aí para e a pessoa vê o motivo)? Na dúvida,
 * conta como rede: um post que não sai é melhor que um post apagado sem a pessoa saber.
 */
export function falhaDeRede(erro: unknown, semRede: boolean): boolean {
  if (semRede) return true;
  const msg = erro instanceof Error ? erro.message : String(erro ?? "");
  if (!msg) return true;
  return /fetch|network|rede|conex|timeout|tempo esgotado|load failed|offline|sem_conexao|503|502|504/i.test(msg);
}

/** O código curto do erro do servidor (o que vem antes de ":"), para a tela procurar o texto; sem código, "desconhecido". */
export function codigoDoErro(erro: unknown): string {
  const msg = erro instanceof Error ? erro.message : String(erro ?? "");
  const codigo = msg.split(":")[0].trim();
  return /^[a-z_]{2,60}$/.test(codigo) ? codigo : "desconhecido";
}

// ───────────────────────── A impressão do que já saiu ─────────────────────────

interface Impressao {
  i: string;
  em: number;
}

/**
 * A impressão de um post (SHA-256 pela biblioteca do próprio navegador ou do Node, nunca conta feita à mão): conta, público e
 * texto. Guardada por 15 minutos depois que o post sai, ela deixa a Alumia perceber que o mesmo texto vai sair de novo.
 */
export async function impressaoDoPost(conta: string, publico: string, texto: string): Promise<string> {
  const dados = new TextEncoder().encode(`${conta}\n${publico}\n${textoLimpo(texto)}`);
  const resumo = await globalThis.crypto.subtle.digest("SHA-256", dados);
  return Array.from(new Uint8Array(resumo), (b) => b.toString(16).padStart(2, "0")).join("");
}

function impressoesValidas(armazem: ArmazemDaFila | null | undefined, agora: number): Impressao[] {
  const lista = lerJson<unknown>(armazem, CHAVES_DO_LEVE.saiu, []);
  if (!Array.isArray(lista)) return [];
  return lista.filter((x): x is Impressao => Boolean(x) && typeof (x as Impressao).i === "string" && typeof (x as Impressao).em === "number"
    && agora - (x as Impressao).em < MINUTOS_DA_IMPRESSAO * 60_000);
}

export function lembrarQueSaiu(armazem: ArmazemDaFila | null | undefined, impressao: string, agora: number): void {
  const lista = [...impressoesValidas(armazem, agora).filter((x) => x.i !== impressao), { i: impressao, em: agora }].slice(-LIMITE_DA_FILA * 2);
  gravarJson(armazem, CHAVES_DO_LEVE.saiu, lista, false);
}

export function jaSaiu(armazem: ArmazemDaFila | null | undefined, impressao: string, agora: number): boolean {
  return impressoesValidas(armazem, agora).some((x) => x.i === impressao);
}

// ───────────────────────── Mandar a fila ─────────────────────────

export interface ResultadoDoEnvio {
  saiu: { id: string; post: string | null }[];
  recusado: { id: string; codigo: string }[];
  /** Ficaram esperando (a rede caiu de novo no meio). */
  esperando: number;
}

/**
 * Manda os prontos da conta aberta, um de cada vez e em ordem. Antes de chamar o servidor marca o item como "enviando" (outra aba
 * não manda o mesmo); se o servidor publicou, tira da fila e guarda a impressão; se recusou, guarda o motivo e não tenta mais
 * sozinho; se a rede caiu, desmarca e para (o resto espera a próxima volta). `soEstes`: só os ids pedidos (o "Enviar agora", que
 * também vale para o recusado e o parado).
 */
export async function mandarFila(opcoes: {
  armazem: ArmazemDaFila | null | undefined;
  conta: string | null | undefined;
  publicar: (pedido: PedidoGuardado) => Promise<{ id?: string } | null | undefined>;
  agora: () => number;
  semRede: () => boolean;
  soEstes?: readonly string[];
}): Promise<ResultadoDoEnvio> {
  const { armazem, conta, publicar, agora, semRede, soEstes } = opcoes;
  const r: ResultadoDoEnvio = { saiu: [], recusado: [], esperando: 0 };
  if (!conta) return r;
  const fila = lerFila(armazem);
  const lista = soEstes
    ? fila.filter((i) => soEstes.includes(i.id) && i.conta === conta && situacaoDoItem(i, conta, agora()) !== "enviando")
    : prontosParaSair(fila, conta, agora());
  for (let k = 0; k < lista.length; k++) {
    const item = lista[k];
    // Outra aba pode ter mandado no meio: confere de novo no aparelho antes de marcar.
    const atual = lerFila(armazem).find((i) => i.id === item.id);
    if (!atual || situacaoDoItem(atual, conta, agora()) === "enviando") continue;
    mudarItem(armazem, item.id, (i) => ({ ...i, enviando_desde: agora(), tentativas: i.tentativas + 1 }));
    try {
      const post = await publicar(atual.pedido);
      tirarDaFila(armazem, item.id);
      lembrarQueSaiu(armazem, await impressaoDoPost(conta, atual.pedido.publico, atual.pedido.texto), agora());
      r.saiu.push({ id: item.id, post: post?.id ?? null });
    } catch (erro) {
      if (falhaDeRede(erro, semRede())) {
        mudarItem(armazem, item.id, (i) => ({ ...i, enviando_desde: null }));
        r.esperando = lista.length - k;
        break;
      }
      const codigo = codigoDoErro(erro);
      mudarItem(armazem, item.id, (i) => ({ ...i, enviando_desde: null, erro: codigo }));
      r.recusado.push({ id: item.id, codigo });
    }
  }
  return r;
}

// ───────────────────────── A hora de parar ─────────────────────────

/** "23:00" → minutos do dia (no horário do aparelho); torto → nulo. */
export function minutosDoDia(hhmm: string | null | undefined): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm ?? "");
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h <= 23 && min <= 59 ? h * 60 + min : null;
}

/** Por quantas horas, depois da hora escolhida, o lembrete ainda aparece (quem abre a Alumia às 2 h da manhã também é lembrada). */
export const HORAS_DO_LEMBRETE = 5;

/**
 * O dia "da noite" a que um momento pertence, no horário do aparelho: depois da meia-noite, dentro da janela, ainda conta como a
 * noite anterior (o lembrete das 23 h visto às 23 h 30 não volta à 0 h 30).
 */
export function noiteDe(data: Date, hora: number): string {
  const minutos = data.getHours() * 60 + data.getMinutes();
  const d = new Date(data.getFullYear(), data.getMonth(), data.getDate());
  if (minutos < hora) d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Está na hora de lembrar? Só dentro da janela (a hora escolhida mais HORAS_DO_LEMBRETE) e uma vez por noite. */
export function horaDeLembrar(data: Date, hhmm: string | null | undefined, vistoNaNoite: string | null | undefined): boolean {
  const hora = minutosDoDia(hhmm);
  if (hora === null) return false;
  const minutos = data.getHours() * 60 + data.getMinutes();
  const desde = (minutos - hora + 1440) % 1440;
  if (desde >= HORAS_DO_LEMBRETE * 60) return false;
  return vistoNaNoite !== noiteDe(data, hora);
}
