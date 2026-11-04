// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O lado do navegador do aviso no celular (Web Push). A pessoa precisa tocar no botão: nada pede permissão sozinho. A chave pública
// VAPID vem da variável NEXT_PUBLIC_VAPID_PUBLIC_KEY (docs/rede/AVISOS.md); sem ela a tela diz que ainda não foi ligado.
import { avisos } from "@/lib/rede/cliente-avisos";

export type EstadoDoPush = "carregando" | "sem_suporte" | "ios" | "nao_configurado" | "bloqueado" | "desligado" | "ligado";

/** A chave pública VAPID, ou "" se este site ainda não foi configurado. */
export const chaveVapid = (): string => process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

const aBytes = (b64: string): Uint8Array<ArrayBuffer> => {
  const limpo = b64.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(limpo + "=".repeat((4 - (limpo.length % 4)) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

const emIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const instalado = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

async function registro(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return (await navigator.serviceWorker.getRegistration("/")) ?? (await navigator.serviceWorker.ready);
  } catch {
    return null;
  }
}

/** Em que pé está o aviso neste aparelho. */
export async function estadoDoPush(): Promise<EstadoDoPush> {
  if (typeof window === "undefined") return "carregando";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return emIos() && !instalado() ? "ios" : "sem_suporte";
  if (!chaveVapid()) return "nao_configurado";
  if (Notification.permission === "denied") return "bloqueado";
  const r = await registro();
  const sub = await r?.pushManager.getSubscription();
  return sub ? "ligado" : "desligado";
}

/** Liga o aviso neste aparelho: pede a permissão, assina no navegador e guarda a assinatura no servidor. Devolve o novo estado. */
export async function ligarPush(lang: string): Promise<EstadoDoPush> {
  const chave = chaveVapid();
  if (!chave) return "nao_configurado";
  const permissao = await Notification.requestPermission();
  if (permissao !== "granted") return permissao === "denied" ? "bloqueado" : "desligado";
  const r = await registro();
  if (!r) return "sem_suporte";
  const sub = (await r.pushManager.getSubscription()) ?? (await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(chave) }));
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
    await sub.unsubscribe();
    return "sem_suporte";
  }
  try {
    await avisos.pushAssinar(json.endpoint, json.keys.p256dh, json.keys.auth, lang);
  } catch (erro) {
    // O servidor não guardou: sem assinatura lá, não deixa a do navegador solta.
    await sub.unsubscribe().catch(() => undefined);
    throw erro;
  }
  return "ligado";
}

/** Desliga neste aparelho: tira do servidor e do navegador. */
export async function desligarPush(): Promise<EstadoDoPush> {
  const r = await registro();
  const sub = await r?.pushManager.getSubscription();
  if (sub) {
    await avisos.pushCancelar(sub.endpoint).catch(() => undefined);
    await sub.unsubscribe().catch(() => undefined);
  }
  return "desligado";
}
