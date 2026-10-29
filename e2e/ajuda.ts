// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import crypto from "node:crypto";
import type { Page } from "@playwright/test";

// O banco de teste local (scripts/backend-local.mjs): mesma porta e mesmo segredo de desenvolvimento, que não abre nada
// fora desta máquina. BANCO_URL troca a porta quando o dev:local roda com PORTA_BANCO.
export const BANCO = process.env.BANCO_URL ?? "http://127.0.0.1:54399";
const SEGREDO = "instituto-lucia-desenvolvimento-local";
const b64 = (valor: string) => Buffer.from(valor).toString("base64url");
function assinar(dados: object) {
  const cabeca = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const corpo = b64(JSON.stringify(dados));
  return `${cabeca}.${corpo}.${crypto.createHmac("sha256", SEGREDO).update(`${cabeca}.${corpo}`).digest("base64url")}`;
}
export const CHAVE_ANON = assinar({ role: "anon", iss: "local", exp: Math.floor(Date.now() / 1000) + 86400 });

/** Entra com uma conta de teste (qualquer senha serve no banco local) e devolve a sessão. */
export async function sessao(email: string) {
  const r = await fetch(`${BANCO}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: CHAVE_ANON, "content-type": "application/json" }, body: JSON.stringify({ email, password: "x" }) });
  if (!r.ok) throw new Error(`não entrou como ${email}: ${r.status}`);
  return (await r.json()) as { access_token: string };
}

/** Chama uma função do banco como a pessoa da sessão. */
export async function rpc<T>(token: string, fn: string, args: object = {}): Promise<T> {
  const r = await fetch(`${BANCO}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: CHAVE_ANON, authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(args) });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${fn}: ${r.status} ${texto.slice(0, 200)}`);
  return (texto ? JSON.parse(texto) : null) as T;
}

/** Abre o site já com a sessão guardada, como se a pessoa tivesse entrado pelo formulário. */
export async function entrarComo(page: Page, email: string) {
  const s = await sessao(email);
  await page.addInitScript((valor) => window.localStorage.setItem("lucia:sessao", valor), JSON.stringify(s));
  return s;
}

/** Abre a página e espera o navegador terminar de carregar: antes disso, clique e digitação se perdem. */
export async function abrir(page: Page, caminho: string) {
  // O convite ao apoio da primeira visita fica fechado nos testes. O aviso de abertura em vigor muda de versão (e só
  // a versão fechada fica fechada): ele é fechado pelo botão, como a pessoa faria, e continua fechado nas próximas
  // páginas e recargas do mesmo teste, porque o registro só é criado quando ainda não existe.
  await page.addInitScript(() => {
    if (!window.localStorage.getItem("lucia:aviso")) window.localStorage.setItem("lucia:aviso", JSON.stringify({ apoio: Date.now() }));
  });
  await page.goto(caminho);
  await page.waitForLoadState("networkidle");
  const aviso = page.locator("dialog[open]").getByRole("button", { name: "Fechar" }).first();
  if (await aviso.waitFor({ timeout: 3000 }).then(() => true, () => false)) await aviso.click();
}
