// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { fingerprintAvailable, passkeyCapable } from "./passkey";
import { getItem, setItem } from "./storage";

// Trava das conversas com a digital. Reaproveita a chave de acesso (passkey) que a pessoa já cadastrou para entrar:
// pedimos ao navegador uma assinatura com verificação do usuário (digital, rosto ou PIN do aparelho). A assinatura
// em si não é mandada a lugar nenhum: o que vale é o aparelho ter exigido a digital antes de responder. É uma trava
// de tela, contra quem pega o aparelho destravado, e não substitui a senha nem a cifra das conversas.

const CHAVE = "lucia:trava";
/** Depois de destravar, quanto tempo as conversas ficam abertas sem pedir de novo. */
const VALE_POR = 5 * 60 * 1000;
let destravadoEm = 0;
const conversasDestravadas = new Map<string, number>();

/** O aparelho tem digital e o site consegue pedir a chave de acesso? */
export async function travaDisponivel(): Promise<boolean> {
  return passkeyCapable() && (await fingerprintAvailable());
}

/** A pessoa ligou a trava neste aparelho (fica só aqui: cada aparelho decide o seu). */
export const travaLigada = () => getItem(CHAVE) === "1";
export const ligarTrava = (ligar: boolean) => setItem(CHAVE, ligar ? "1" : null);

/** Pede a digital. Verdadeiro se o aparelho confirmou a pessoa. */
export async function confirmarPessoa(): Promise<boolean> {
  if (!passkeyCapable()) return false;
  try {
    const desafio = crypto.getRandomValues(new Uint8Array(32));
    const credencial = await navigator.credentials.get({ publicKey: { challenge: desafio, rpId: window.location.hostname, userVerification: "required", timeout: 60_000 } });
    return credencial !== null;
  } catch {
    return false;
  }
}

export const estaDestravado = () => Date.now() - destravadoEm < VALE_POR;
export const conversaDestravada = (conversa: string) => Date.now() - (conversasDestravadas.get(conversa) ?? 0) < VALE_POR;

/** Destrava a tela das conversas (ou uma conversa trancada) por alguns minutos. */
export async function destravar(conversa?: string): Promise<boolean> {
  const ok = await confirmarPessoa();
  if (ok) {
    if (conversa) conversasDestravadas.set(conversa, Date.now());
    else destravadoEm = Date.now();
  }
  return ok;
}

export function travarAgora() {
  destravadoEm = 0;
  conversasDestravadas.clear();
}
