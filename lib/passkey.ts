// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { getClient, hasBackend, localBackend } from "./backend";
import { KEYS, setItem } from "./storage";

// Entrada pela impressão digital. Por baixo é uma "chave de acesso" (passkey, padrão WebAuthn): o aparelho guarda
// uma chave secreta que só libera depois de conferir a digital, e o serviço de contas guarda a metade pública.
// A digital em si nunca sai do celular. Quem confere o dedo é o Android: o site não escolhe (nem consegue
// proibir) o método de desbloqueio que o aparelho oferece. Veja docs/biometria-setup.md.

export type PasskeyOutcome = "ok" | "cancelled" | "exists" | "unsupported" | "failed";

export interface PasskeyResult {
  outcome: PasskeyOutcome;
  /** O motivo técnico, para a coordenação consertar (domínio não autorizado, serviço desligado…). */
  detail: string;
}

export interface Passkey {
  id: string;
  nome: string;
  criada: string;
  usada: string;
}

/** O navegador (ou o WebView do aplicativo) sabe pedir uma chave de acesso? */
export const passkeyCapable = () => hasBackend && !localBackend && typeof window !== "undefined" && window.isSecureContext && typeof window.PublicKeyCredential === "function";

/** O aparelho tem leitor próprio (digital) e bloqueio de tela configurado? Sem isso o botão nem aparece. */
export async function fingerprintAvailable(): Promise<boolean> {
  if (!passkeyCapable()) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

function explain(failure: unknown): PasskeyResult {
  const error = failure as { name?: string; code?: string; status?: number; message?: string } | null;
  const name = error?.name ?? "";
  const code = error?.code ?? "";
  // A pessoa fechou a janela do sistema, o tempo acabou ou outro pedido tomou o lugar: não é defeito.
  if (name === "NotAllowedError" || name === "AbortError" || code === "ERROR_CEREMONY_ABORTED") return { outcome: "cancelled", detail: "" };
  if (name === "InvalidStateError" || code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED") return { outcome: "exists", detail: "" };
  if (name === "NotSupportedError") return { outcome: "unsupported", detail: "" };
  return { outcome: "failed", detail: [error?.status, code || name, error?.message].filter(Boolean).join(" · ").slice(0, 200) };
}

/** Entra na conta com a digital. Não pede e-mail: o aparelho mostra as chaves que tem para este site. */
export async function signInWithFingerprint(captchaToken?: string): Promise<PasskeyResult> {
  if (!passkeyCapable()) return { outcome: "unsupported", detail: "" };
  try {
    const supabase = await getClient();
    const { error } = await supabase.auth.signInWithPasskey({ options: { captchaToken: captchaToken || undefined } });
    if (error) return explain(error);
    setItem(KEYS.passkey, "1");
    return { outcome: "ok", detail: "" };
  } catch (failure) {
    return explain(failure);
  }
}

/** Cadastra a digital deste aparelho na conta que está aberta. */
export async function registerFingerprint(): Promise<PasskeyResult> {
  if (!passkeyCapable()) return { outcome: "unsupported", detail: "" };
  try {
    const supabase = await getClient();
    const { data, error } = await supabase.auth.registerPasskey();
    if (error) return explain(error);
    // O nome ajuda a pessoa a reconhecer o aparelho na lista; se não der para gravar, a chave vale do mesmo jeito.
    if (data?.id) await supabase.auth.passkey.update({ passkeyId: data.id, friendlyName: deviceName() }).catch(() => null);
    setItem(KEYS.passkey, "1");
    return { outcome: "ok", detail: "" };
  } catch (failure) {
    return explain(failure);
  }
}

export async function listFingerprints(): Promise<Passkey[]> {
  const supabase = await getClient();
  const { data, error } = await supabase.auth.passkey.list();
  if (error) throw error;
  return (data ?? []).map((item) => ({ id: item.id, nome: item.friendly_name ?? "", criada: item.created_at, usada: item.last_used_at ?? "" }));
}

export async function removeFingerprint(id: string): Promise<void> {
  const supabase = await getClient();
  const { error } = await supabase.auth.passkey.delete({ passkeyId: id });
  if (error) throw error;
}

function deviceName(): string {
  const agent = navigator.userAgent;
  const model = /Android [\d.]+; ([^;)]+?)(?: Build|[;)])/.exec(agent)?.[1]?.trim();
  if (model && model !== "K") return model.slice(0, 60);
  if (/Android/.test(agent)) return "Celular Android";
  if (/iPhone|iPad/.test(agent)) return "iPhone ou iPad";
  return "Este computador";
}
