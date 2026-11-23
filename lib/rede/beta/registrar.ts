// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O registro de erros da tela da Alumia (P5, A21): quando algo quebra no aparelho de alguém, sai SÓ a mensagem limpa, a página
// limpa, a versão do site e a família do navegador (lib/rede/beta/tela.ts) para public.erro_tela_registrar, que soma por dia.
// O pedido vai SEMPRE como visitante (a chave pública, nunca o token da sessão): o banco não fica sabendo de qual conta veio.
// No máximo 8 por página aberta, cada mensagem uma vez. Nunca lança e nunca mostra nada: falhar aqui não atrapalha ninguém.
import { criarFreio, familiaDoNavegador, mensagemDoErro, mensagemLimpa, telaLimpa, versaoLimpa } from "./tela";

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const freio = criarFreio();
let versao: Promise<string> | null = null;

/** A versão do site no ar (o commit de /versao.txt, que a montagem escreve). Lida uma vez por página. */
function versaoDoSite(): Promise<string> {
  versao ??= fetch("/versao.txt", { cache: "no-store" })
    .then((r) => (r.ok ? r.text() : ""))
    .then(versaoLimpa)
    .catch(() => "");
  return versao;
}

/** Manda um erro da tela. Sem serviço, no servidor ou passado o freio, não faz nada. */
export async function registrarErroDaTela(erro: unknown): Promise<void> {
  try {
    if (typeof window === "undefined" || !url || !chave) return;
    const mensagem = mensagemLimpa(mensagemDoErro(erro));
    const pagina = telaLimpa(window.location.pathname);
    if (!mensagem || !freio(`${mensagem}|${pagina}`)) return;
    await fetch(`${url}/rest/v1/rpc/erro_tela_registrar`, {
      method: "POST",
      headers: { apikey: chave, Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p: { mensagem, pagina, versao: await versaoDoSite(), navegador: familiaDoNavegador(navigator.userAgent) } }),
      keepalive: true,
      credentials: "omit",
    });
  } catch {
    // Nada: o registro de erros nunca vira um erro.
  }
}
