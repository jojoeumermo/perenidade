// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A conta isca da senha de pânico (onda 11, frente 11G), do lado do navegador. A isca é uma conta separada de verdade, criada
// pelo mesmo caminho de quem se cadastra (a porta de entrada: app/api/alumia/porta/conta, com a prova no aparelho e o desafio da
// Cloudflare quando ligado), com o e-mail que a pessoa informa. Ela passa pela triagem como qualquer conta e é preparada com perfil
// neutro: codinome, a primeira entrada concluída, um pacote de perfis públicos seguido e nenhum post.
//
// Para preparar a isca sem tirar a pessoa da conta dela, o aparelho abre a isca num SEGUNDO cliente do serviço de contas que vive
// só na memória desta página (nada gravado no armazenamento, sem renovar sozinho) e o fecha no fim. Nenhum pedido diz ao servidor
// que as duas contas são da mesma pessoa: a isca nunca é chamada com a sessão da conta real, nem o contrário.
// Na prévia sem banco (NEXT_PUBLIC_ALUMIA_PREVIA=sim), um dublê que vive na memória da página.
"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { BackendError } from "@/lib/backend";
import { criarClienteDescoberta } from "@/lib/rede/cliente-descoberta";
import { criarContaPelaPorta, entrarPelaPorta, type MotivoDaEntrada } from "@/lib/rede/convites/cliente";
import { resolverDesafio } from "@/lib/rede/convites/prova-aparelho";
import { previaLigada } from "@/lib/rede/publicar/alumia2";
import { gerarSenhaDaIsca, type ConteudoDoCofre } from "./cofre-de-panico";

/** Em que pé a isca está, do ponto de vista dela. */
export type EtapaDaIsca =
  | "confirmar_email"
  | "sem_pedido"
  | "em_analise"
  | "recusada"
  | "suspensa"
  | "cadastrar_fator"
  | "pedir_codigo"
  | "povoar"
  | "pronta";

export interface PacoteDaIsca {
  slug: string;
  titulo: string;
}

/** Uma isca aberta neste aparelho (só na memória). */
export interface IscaAberta {
  etapa: EtapaDaIsca;
  /** A marca da conta isca: o id dela, para o cofre guardar só o resumo (cofre-de-panico.ts, marcaDaConta). */
  id: string;
  codinome: string;
  regras: number;
  fator: string | null;
  /** O QR e o segredo do aplicativo autenticador, na etapa "cadastrar_fator". */
  qr?: { imagem: string; segredo: string };
  pacotes: PacoteDaIsca[];
}

export type ResultadoDaIsca<T> = { ok: true; valor: T } | { ok: false; motivo: MotivoDaEntrada | "codigo" | "email_igual" | "sem_servico" };

const URL_DO_BANCO = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const CHAVE_PUBLICA = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** A senha da isca: gerada no aparelho (cofre-de-panico.ts), antes da conta, para o cofre ser fechado antes de a conta nascer. */
export const novaSenhaDaIsca = gerarSenhaDaIsca;

/** Criar a conta isca pela porta, com a senha gerada no aparelho (que só o cofre guarda). */
export async function criarIsca(dados: { email: string; senha: string; codinome: string; volta: string; turnstile?: string }): Promise<ResultadoDaIsca<null>> {
  if (previaLigada()) {
    await new Promise((pronto) => setTimeout(pronto, 600));
    dubleDaPrevia.etapa = "confirmar_email";
    return { ok: true, valor: null };
  }
  const r = await criarContaPelaPorta({ email: dados.email, senha: dados.senha, codinome: dados.codinome, volta: dados.volta, turnstile: dados.turnstile });
  return r.ok ? { ok: true, valor: null } : { ok: false, motivo: r.motivo };
}

// ───── O segundo cliente, só na memória ─────
let aberta: { cliente: SupabaseClient; token: string } | null = null;

async function clienteDaIsca(): Promise<SupabaseClient> {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(URL_DO_BANCO, CHAVE_PUBLICA, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "isca-na-memoria" },
  });
}

/** Chama uma função do banco COMO a isca. */
async function chamarComoIsca<T>(funcao: string, argumentos: Record<string, unknown> = {}): Promise<T> {
  if (!aberta) throw new BackendError("sem_sessao");
  const { data, error } = await aberta.cliente.rpc(funcao, argumentos);
  if (error) throw new BackendError(/^[a-z_:]{3,40}$/.test(error.message ?? "") ? error.message : "falha");
  return data as T;
}

async function postarComoIsca(caminho: string, corpo: unknown): Promise<Record<string, unknown> | null> {
  const r = await fetch(caminho, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(aberta ? { Authorization: `Bearer ${aberta.token}` } : {}) },
    body: JSON.stringify(corpo),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  return (await r.json().catch(() => null)) as Record<string, unknown> | null;
}

interface EuDaIsca {
  logado?: boolean;
  situacao?: "sem_pedido" | "em_analise" | "aprovada" | "recusada" | "suspensa" | "sem_conta";
  codinome?: string | null;
  regras_versao?: number;
}

/** Lê em que pé a isca está (a sessão dela já aberta). */
async function lerEtapa(): Promise<IscaAberta> {
  if (!aberta) throw new BackendError("sem_sessao");
  const cliente = aberta.cliente;
  const { data: usuario } = await cliente.auth.getUser();
  const eu = await chamarComoIsca<EuDaIsca>("alumia_entrada_eu");
  const base: IscaAberta = { etapa: "sem_pedido", id: usuario.user?.id ?? "", codinome: eu.codinome ?? "", regras: eu.regras_versao ?? 1, fator: null, pacotes: [] };
  if (eu.situacao === "em_analise" || eu.situacao === "recusada" || eu.situacao === "suspensa") return { ...base, etapa: eu.situacao };
  if (eu.situacao !== "aprovada") return base;
  const [{ data: nivel }, { data: fatores }] = await Promise.all([cliente.auth.mfa.getAuthenticatorAssuranceLevel(), cliente.auth.mfa.listFactors()]);
  const fator = fatores?.totp?.find((f) => f.status === "verified")?.id ?? null;
  if (!fator) return { ...base, etapa: "cadastrar_fator" };
  if (nivel?.currentLevel !== "aal2") return { ...base, etapa: "pedir_codigo", fator };
  // Dentro: falta a primeira entrada (o passo "pronto") e um pacote seguido? A primeira entrada inacabada seria um sinal na tela.
  const descoberta = criarClienteDescoberta(chamarComoIsca);
  const explorar = await descoberta.explorar().catch(() => null);
  const pacotes = (explorar?.pacotes ?? []).map((p) => ({ slug: p.slug, titulo: p.titulo })).filter((p) => p.slug);
  const pronta = explorar?.eu?.passo === "pronto";
  return { ...base, etapa: pronta ? "pronta" : "povoar", fator, pacotes };
}

/** Abre a isca neste aparelho (só na memória) e diz em que pé ela está. */
export async function abrirIsca(conteudo: ConteudoDoCofre, turnstile?: string): Promise<ResultadoDaIsca<IscaAberta>> {
  if (previaLigada()) {
    await new Promise((pronto) => setTimeout(pronto, 500));
    const agora = { ...dubleDaPrevia, codinome: conteudo.codinome };
    // Na prévia, o e-mail "se confirma" depois da primeira olhada.
    if (dubleDaPrevia.etapa === "confirmar_email") dubleDaPrevia.etapa = "sem_pedido";
    return { ok: true, valor: agora };
  }
  await fecharIsca();
  const r = await entrarPelaPorta({ email: conteudo.email, senha: conteudo.senha, turnstile });
  if (!r.ok) return r.motivo === "nao_confirmado" ? { ok: true, valor: { etapa: "confirmar_email", id: "", codinome: conteudo.codinome, regras: 1, fator: null, pacotes: [] } } : { ok: false, motivo: r.motivo };
  try {
    const cliente = await clienteDaIsca();
    const { error } = await cliente.auth.setSession(r.sessao);
    if (error) return { ok: false, motivo: "falha" };
    aberta = { cliente, token: r.sessao.access_token };
    return { ok: true, valor: await lerEtapa() };
  } catch {
    return { ok: false, motivo: "falha" };
  }
}

/**
 * Manda o pedido de entrada da isca pelo passe da porta (que confere a rede no servidor) e o pedido. A impressão de rede NÃO é
 * registrada aqui: preparada no mesmo aparelho e na mesma rede da conta real, ela poria as duas contas lado a lado no banco.
 */
export async function pedirEntradaDaIsca(codinome: string, motivo: string, regras: number): Promise<ResultadoDaIsca<IscaAberta>> {
  if (previaLigada()) {
    await new Promise((pronto) => setTimeout(pronto, 500));
    dubleDaPrevia.etapa = "em_analise";
    return { ok: true, valor: { ...dubleDaPrevia, codinome } };
  }
  if (!aberta) return { ok: false, motivo: "falha" };
  try {
    const d = await postarComoIsca("/api/alumia/porta/desafio", { momento: "pedido" });
    if (d?.ok && typeof d.desafio === "string" && typeof d.dificuldade === "number") {
      const resposta = await resolverDesafio(d.desafio, d.dificuldade);
      const passe = await postarComoIsca("/api/alumia/porta/pedido", { desafio: d.desafio, resposta, convite: null });
      if (passe && passe.ok === false && passe.motivo !== "banco") return { ok: false, motivo: "muitos_pedidos" };
    }
    await chamarComoIsca("alumia_entrada_pedir", { p_codinome: codinome.trim(), p_motivo: motivo.trim(), p_maior: true, p_versao: regras, p_aceite: true });
    return { ok: true, valor: await lerEtapa() };
  } catch {
    return { ok: false, motivo: "falha" };
  }
}

/** Começa o cadastro do aplicativo autenticador da isca: devolve o QR e o segredo para a pessoa pôr no aplicativo dela. */
export async function comecarFatorDaIsca(isca: IscaAberta): Promise<ResultadoDaIsca<IscaAberta>> {
  if (previaLigada()) return { ok: true, valor: { ...isca, fator: "f1", qr: { imagem: "", segredo: "JBSWY3DPEHPK3PXP" } } };
  if (!aberta) return { ok: false, motivo: "falha" };
  const { data, error } = await aberta.cliente.auth.mfa.enroll({ factorType: "totp", friendlyName: `alumia-${Date.now().toString(36)}` });
  if (error || !data) return { ok: false, motivo: "falha" };
  return { ok: true, valor: { ...isca, fator: data.id, qr: { imagem: data.totp.qr_code, segredo: data.totp.secret } } };
}

/** Confere o código do aplicativo da isca (no cadastro e quando a sessão dela ainda não tem o segundo fator). */
export async function conferirCodigoDaIsca(fator: string, codigo: string): Promise<ResultadoDaIsca<IscaAberta>> {
  if (previaLigada()) {
    dubleDaPrevia.etapa = "povoar";
    return { ok: true, valor: { ...dubleDaPrevia } };
  }
  if (!aberta) return { ok: false, motivo: "falha" };
  const { error } = await aberta.cliente.auth.mfa.challengeAndVerify({ factorId: fator, code: codigo.replace(/\D/g, "") });
  if (error) return { ok: false, motivo: "codigo" };
  try {
    return { ok: true, valor: await lerEtapa() };
  } catch {
    return { ok: false, motivo: "falha" };
  }
}

/** Deixa a isca com cara de conta usada: a primeira entrada concluída (sem escolhas) e, se a pessoa escolheu, um pacote seguido. */
export async function povoarIsca(pacote: string | null): Promise<ResultadoDaIsca<IscaAberta>> {
  if (previaLigada()) {
    await new Promise((pronto) => setTimeout(pronto, 500));
    dubleDaPrevia.etapa = "pronta";
    return { ok: true, valor: { ...dubleDaPrevia } };
  }
  if (!aberta) return { ok: false, motivo: "falha" };
  const descoberta = criarClienteDescoberta(chamarComoIsca);
  try {
    await descoberta.adiar().catch(() => null);
    await descoberta.guia(true).catch(() => null);
    if (pacote) await descoberta.seguirPacote(pacote);
    return { ok: true, valor: await lerEtapa() };
  } catch {
    return { ok: false, motivo: "falha" };
  }
}

/** Fecha a sessão da isca neste aparelho (só a desta página; a conta continua existindo). Nunca lança. */
export async function fecharIsca(): Promise<void> {
  const era = aberta;
  aberta = null;
  if (!era) return;
  try {
    await era.cliente.auth.signOut({ scope: "local" });
  } catch {
    // a sessão em memória some com a página de qualquer jeito
  }
}

// ───── O dublê da prévia ─────
const dubleDaPrevia: IscaAberta = {
  etapa: "sem_pedido",
  id: "00000000-0000-4000-8000-000000000001",
  codinome: "",
  regras: 1,
  fator: "f1",
  pacotes: [
    { slug: "leitura", titulo: "Clube de leitura" },
    { slug: "cultura", titulo: "Agenda cultural" },
    { slug: "enem", titulo: "Estudo para o ENEM" },
  ],
};
