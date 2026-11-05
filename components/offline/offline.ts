// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// O lado da página do funcionamento sem internet do aplicativo (docs/APP-OFFLINE.md): os textos dos avisos nos seis
// idiomas e a FILA do que precisa de rede. Sem React e sem disco: roda no navegador e no Node (scripts/testar-app-offline.mjs).
//
// Privacidade: a fila só guarda o que a PESSOA acabou de pedir para enviar (um formulário que ela mandou) e só no
// aparelho (localStorage). Nada sai sozinho: ao voltar a internet o item vai, uma vez, ao próprio site (/api/...), e a
// pessoa pode descartar a fila a qualquer hora. Nada é guardado sobre o que ela leu ou jogou.

export interface TextosDeRede {
  semInternet: string;
  fila: (n: number) => string;
  enviados: (n: number) => string;
  descartar: string;
  novaVersao: string;
  atualizar: string;
  depois: string;
}

const PT: TextosDeRede = {
  semInternet: "Sem internet. O que você já abriu continua aqui.",
  fila: (n) => `Esperando a internet para enviar: ${n}`,
  enviados: (n) => `Enviado: ${n}`,
  descartar: "Descartar",
  novaVersao: "Nova versão do aplicativo.",
  atualizar: "Toque para atualizar",
  depois: "Depois",
};

const TEXTOS: Record<string, TextosDeRede> = {
  pt: PT,
  en: { semInternet: "No internet. What you have already opened is still here.", fila: (n) => `Waiting for internet to send: ${n}`, enviados: (n) => `Sent: ${n}`, descartar: "Discard", novaVersao: "New version of the app.", atualizar: "Tap to update", depois: "Later" },
  es: { semInternet: "Sin internet. Lo que ya abriste sigue aquí.", fila: (n) => `Esperando internet para enviar: ${n}`, enviados: (n) => `Enviado: ${n}`, descartar: "Descartar", novaVersao: "Nueva versión de la aplicación.", atualizar: "Toca para actualizar", depois: "Después" },
  fr: { semInternet: "Pas d’internet. Ce que vous avez déjà ouvert reste ici.", fila: (n) => `En attente d’internet pour envoyer : ${n}`, enviados: (n) => `Envoyé : ${n}`, descartar: "Supprimer", novaVersao: "Nouvelle version de l’application.", atualizar: "Touchez pour mettre à jour", depois: "Plus tard" },
  ru: { semInternet: "Нет интернета. То, что вы уже открывали, осталось здесь.", fila: (n) => `Ждёт интернета для отправки: ${n}`, enviados: (n) => `Отправлено: ${n}`, descartar: "Удалить", novaVersao: "Новая версия приложения.", atualizar: "Нажмите, чтобы обновить", depois: "Позже" },
  zh: { semInternet: "没有网络。你已打开过的内容仍然可用。", fila: (n) => `等待网络后发送：${n}`, enviados: (n) => `已发送：${n}`, descartar: "丢弃", novaVersao: "应用有新版本。", atualizar: "点按以更新", depois: "稍后" },
};

export const textosDeRede = (lang: string): TextosDeRede => TEXTOS[lang] ?? PT;
export const IDIOMAS_DOS_AVISOS = Object.keys(TEXTOS);

// ───── A fila do que precisa de rede ─────

export const LIMITES_DA_FILA = { itens: 20, corpo: 16 * 1024, dias: 7, tentativas: 5 } as const;
export const CHAVE_DA_FILA = "lucia-fila-v1";
/** O evento que a página dispara quando a fila muda (o aviso na tela escuta). */
export const EVENTO_DA_FILA = "lucia-fila";

/** O pedaço de Storage de que a fila precisa (localStorage, ou um de mentira no teste). */
export type Armazem = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type MetodoDaFila = "POST" | "PUT" | "PATCH" | "DELETE";
export interface EntradaDaFila {
  /** Só caminho do próprio site, sob /api/. */
  url: string;
  metodo: MetodoDaFila;
  /** O corpo já em texto (JSON, normalmente). */
  corpo: string;
  tipo?: string;
}
export interface ItemDaFila extends EntradaDaFila {
  id: string;
  criado: number;
  tentativas: number;
}

const METODOS = new Set<string>(["POST", "PUT", "PATCH", "DELETE"]);

/** Só /api/... do próprio site: nunca outro endereço, nunca "//", nunca subir de pasta. */
export function enderecoDaFilaValido(url: unknown): url is string {
  return typeof url === "string" && url.length <= 300 && /^\/api\/[A-Za-z0-9\-._~/%?&=+,;:@]*$/.test(url) && !url.includes("..") && !url.includes("//");
}

const tamanhoDoCorpo = (corpo: string) => new TextEncoder().encode(corpo).length;

function itemValido(valor: unknown): valor is ItemDaFila {
  const item = valor as Partial<ItemDaFila> | null;
  return (
    !!item &&
    typeof item.id === "string" &&
    enderecoDaFilaValido(item.url) &&
    typeof item.metodo === "string" &&
    METODOS.has(item.metodo) &&
    typeof item.corpo === "string" &&
    tamanhoDoCorpo(item.corpo) <= LIMITES_DA_FILA.corpo &&
    typeof item.criado === "number" &&
    typeof item.tentativas === "number"
  );
}

/** Lê a fila, descartando o que está estragado ou velho demais (7 dias). Nunca lança. */
export function lerFila(armazem: Armazem, agora: number): ItemDaFila[] {
  try {
    const bruto = armazem.getItem(CHAVE_DA_FILA);
    if (!bruto) return [];
    const lista = JSON.parse(bruto);
    if (!Array.isArray(lista)) return [];
    const validade = LIMITES_DA_FILA.dias * 86_400_000;
    return lista.filter(itemValido).filter((item) => agora - item.criado <= validade && item.tentativas < LIMITES_DA_FILA.tentativas);
  } catch {
    return [];
  }
}

function gravar(armazem: Armazem, itens: ItemDaFila[]) {
  try {
    if (itens.length === 0) armazem.removeItem(CHAVE_DA_FILA);
    else armazem.setItem(CHAVE_DA_FILA, JSON.stringify(itens));
  } catch {
    // armazenamento cheio ou bloqueado: a fila fica como estava
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENTO_DA_FILA));
}

export type ResultadoDeEnfileirar = { ok: true; item: ItemDaFila } | { ok: false; motivo: "endereco" | "metodo" | "tamanho" | "cheia" };

/** Põe um envio na fila (a pessoa pediu; falta a internet). Recusa o que não for do site, for grande ou lotar a fila. */
export function enfileirar(armazem: Armazem, entrada: EntradaDaFila, agora: number): ResultadoDeEnfileirar {
  if (!enderecoDaFilaValido(entrada.url)) return { ok: false, motivo: "endereco" };
  if (!METODOS.has(entrada.metodo)) return { ok: false, motivo: "metodo" };
  if (tamanhoDoCorpo(entrada.corpo) > LIMITES_DA_FILA.corpo) return { ok: false, motivo: "tamanho" };
  const atual = lerFila(armazem, agora);
  if (atual.length >= LIMITES_DA_FILA.itens) return { ok: false, motivo: "cheia" };
  const item: ItemDaFila = { ...entrada, id: `${agora.toString(36)}-${atual.length}-${Math.floor(Math.random() * 1e6).toString(36)}`, criado: agora, tentativas: 0 };
  gravar(armazem, [...atual, item]);
  return { ok: true, item };
}

/** O que aconteceu com um envio: "ok" feito; "recusado" o servidor disse não (4xx: não adianta repetir); "erro" falha do servidor (5xx); "rede" sem internet. */
export type SituacaoDoEnvio = "ok" | "recusado" | "erro" | "rede";

/** Transforma o status HTTP (ou a falta dele) numa SituacaoDoEnvio. */
export const situacaoDoStatus = (status: number | null): SituacaoDoEnvio => (status === null ? "rede" : status >= 200 && status < 300 ? "ok" : status >= 500 || status === 429 || status === 408 ? "erro" : "recusado");

/**
 * Manda a fila, na ordem. Para no primeiro "rede" (sem internet de verdade) e guarda o resto. "ok" e "recusado" saem da
 * fila; "erro" fica com mais uma tentativa (some depois de 5). `enviar` é de quem chama (fetch no navegador, mentira no teste).
 */
export async function esvaziarFila(armazem: Armazem, enviar: (item: ItemDaFila) => Promise<SituacaoDoEnvio>, agora: number): Promise<{ enviados: number; restantes: number }> {
  const fila = lerFila(armazem, agora);
  const sobra: ItemDaFila[] = [];
  let enviados = 0;
  for (let i = 0; i < fila.length; i++) {
    const item = fila[i];
    const situacao = await enviar(item).catch((): SituacaoDoEnvio => "rede");
    if (situacao === "ok") enviados++;
    else if (situacao === "erro") sobra.push({ ...item, tentativas: item.tentativas + 1 });
    else if (situacao === "rede") {
      sobra.push(item, ...fila.slice(i + 1));
      break;
    }
    // "recusado": o servidor não quer; repetir não muda nada.
  }
  const final = sobra.filter((item) => item.tentativas < LIMITES_DA_FILA.tentativas);
  gravar(armazem, final);
  return { enviados, restantes: final.length };
}

/** A pessoa mandou descartar: esvazia a fila. */
export function descartarFila(armazem: Armazem) {
  gravar(armazem, []);
}

/**
 * Para quem envia algo que precisa de rede (um formulário): tenta agora; sem internet, põe na fila e avisa. Devolve
 * "enviado", "na-fila" ou "recusado" (o servidor disse não) / "falhou" (não coube na fila).
 */
export async function enviarOuEnfileirar(armazem: Armazem, entrada: EntradaDaFila, enviar: (entrada: EntradaDaFila) => Promise<SituacaoDoEnvio>, agora: number): Promise<"enviado" | "na-fila" | "recusado" | "falhou"> {
  const situacao = await enviar(entrada).catch((): SituacaoDoEnvio => "rede");
  if (situacao === "ok") return "enviado";
  if (situacao === "recusado") return "recusado";
  return enfileirar(armazem, entrada, agora).ok ? "na-fila" : "falhou";
}

// ───── Atualização do service worker ─────

/** O que a página precisa de um registro de service worker (um de mentira no teste). */
export interface RegistroMinimo {
  waiting: { postMessage(mensagem: unknown): void } | null;
  installing: { state: string; addEventListener(tipo: "statechange", f: () => void): void } | null;
  addEventListener(tipo: "updatefound", f: () => void): void;
}

/**
 * Avisa `aoHaverNova` quando há uma versão nova ESPERANDO (já instalada, sem ter assumido). Vale para a que já estava
 * esperando ao abrir e para as que chegam depois. Devolve a função que manda a nova assumir.
 */
export function acompanharAtualizacao(registro: RegistroMinimo, haControle: boolean, aoHaverNova: () => void): () => void {
  const avisar = () => {
    if (haControle && registro.waiting) aoHaverNova();
  };
  avisar();
  registro.addEventListener("updatefound", () => {
    const novo = registro.installing;
    novo?.addEventListener("statechange", () => {
      if (novo.state === "installed") avisar();
    });
  });
  return () => registro.waiting?.postMessage({ tipo: "pular" });
}

/** Janela mínima entre duas buscas de versão nova ao voltar para o aplicativo (30 min). */
export const INTERVALO_DE_BUSCA = 30 * 60_000;
export const podeBuscarVersao = (ultima: number, agora: number) => agora - ultima >= INTERVALO_DE_BUSCA;

/** Guardar a casca fica de fora no modo de economia de dados do aparelho. */
export const podeGuardarCasca = (conexao: { saveData?: boolean; effectiveType?: string } | undefined) => !(conexao?.saveData || conexao?.effectiveType === "slow-2g" || conexao?.effectiveType === "2g");

// ───── Pedidos da página ao service worker (só no navegador) ─────

/** Manda o service worker guardar as 5 telas das abas do idioma e, se vierem, as aulas indicadas (hrefs sem o idioma). Sem efeito se não houver service worker ou se o aparelho pediu economia de dados. */
export async function pedirCasca(lang: string, extras: readonly string[] = []): Promise<void> {
  try {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator) || navigator.onLine === false) return;
    if (!podeGuardarCasca((navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection)) return;
    const registro = await navigator.serviceWorker.ready;
    registro.active?.postMessage({ tipo: "casca", lang, extras: extras.map((href) => `/${lang}${href}`) });
  } catch {
    // sem service worker (desenvolvimento, navegação privada): a casca só não fica guardada
  }
}
