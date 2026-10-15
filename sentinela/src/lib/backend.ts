// Sentinela Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later.
//
// A ligação do app com o banco do Sentinela: só por funções, com a sessão da pessoa. O app nunca recebe token de
// plataforma nenhuma. Sem serviço configurado, roda em modo de demonstração, com dados fictícios, para avaliar as telas.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { demo } from "./demo.ts";

const CHAVES = { url: "sentinela:url", anon: "sentinela:anon", worker: "sentinela:worker", tema: "sentinela:tema", demo: "sentinela:demo", sessao: "sentinela:sessao" };

const ler = (chave: string) => {
  try {
    return localStorage.getItem(chave) ?? "";
  } catch {
    return "";
  }
};
const gravar = (chave: string, valor: string) => {
  try {
    if (valor) localStorage.setItem(chave, valor);
    else localStorage.removeItem(chave);
  } catch {
    // sem armazenamento, a configuração vale só até fechar
  }
};

export interface Ligacao {
  url: string;
  anon: string;
  worker: string;
}

/** De onde o app fala: o que foi embutido na montagem ou o que a pessoa colou na primeira abertura. */
export function ligacao(): Ligacao {
  return {
    url: (ler(CHAVES.url) || import.meta.env.VITE_SENTINELA_SUPABASE_URL || "").replace(/\/$/, ""),
    anon: ler(CHAVES.anon) || import.meta.env.VITE_SENTINELA_ANON_KEY || "",
    worker: (ler(CHAVES.worker) || import.meta.env.VITE_SENTINELA_WORKER_URL || "").replace(/\/$/, ""),
  };
}
export function salvarLigacao(l: Ligacao) {
  gravar(CHAVES.url, l.url.trim());
  gravar(CHAVES.anon, l.anon.trim());
  gravar(CHAVES.worker, l.worker.trim());
  cliente = null;
}
export const temServico = () => Boolean(ligacao().url && ligacao().anon);
export const modoDemo = () => ler(CHAVES.demo) === "1" || (!temServico() && import.meta.env.VITE_DEMO === "1");
export const ligarDemo = (sim: boolean) => gravar(CHAVES.demo, sim ? "1" : "");

export const temaGuardado = () => ler(CHAVES.tema);
export const guardarTema = (tema: string) => gravar(CHAVES.tema, tema);

export class ErroDoServico extends Error {
  codigo: string;
  constructor(codigo: string) {
    super(codigo);
    this.codigo = codigo;
  }
}
const codigoDe = (mensagem: unknown) => {
  const texto = String(mensagem ?? "");
  return /^[a-z_]+(:[a-z_]+)?$/.test(texto) ? texto : "falha";
};

let cliente: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  const l = ligacao();
  if (!l.url || !l.anon) throw new ErroDoServico("sem_servico");
  cliente ??= createClient(l.url, l.anon, { auth: { storageKey: CHAVES.sessao, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  return cliente;
}

/** Chama uma função do banco. No modo de demonstração, responde com dados fictícios. */
export async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  if (modoDemo()) return demo(fn, args) as T;
  const { data, error } = await supabase().rpc(fn, args);
  if (error) throw new ErroDoServico(codigoDe(error.message));
  return data as T;
}

/** Chama o coletor (coletar agora, executar ações) com a sessão da pessoa. */
export async function worker(caminho: string): Promise<unknown> {
  if (modoDemo()) return { partes: { site: "no ar · 200 · 212 ms · nota 95 (demonstração)" }, alertas: 0, emails: 0 };
  const l = ligacao();
  if (!l.worker) throw new ErroDoServico("sem_coletor");
  const { data } = await supabase().auth.getSession();
  if (!data.session) throw new ErroDoServico("entre_primeiro");
  const resposta = await fetch(`${l.worker}${caminho}`, { method: "POST", headers: { Authorization: `Bearer ${data.session.access_token}` }, signal: AbortSignal.timeout(60_000) });
  if (!resposta.ok) throw new ErroDoServico(resposta.status === 403 ? "sem_permissao" : "falha");
  return resposta.json();
}

export interface Eu {
  id: string;
  nome: string;
  email: string;
  papel: "dono" | "analista" | "leitor";
  ativo: boolean;
  segundo_fator_na_sessao: boolean;
  tem_fator: boolean;
  avisos: { email: boolean; desktop: boolean; minimo: string };
  alertas_abertos: number;
}

type Estado = { status: "carregando" } | { status: "fora" } | { status: "dentro"; eu: Eu };

export function useEu(): Estado & { recarregar: () => void } {
  const [estado, setEstado] = useState<Estado>({ status: "carregando" });
  const [volta, setVolta] = useState(0);
  useEffect(() => {
    let cancelado = false;
    const terminar = (e: Estado) => {
      if (!cancelado) setEstado(e);
    };
    if (modoDemo()) {
      rpc<Eu>("eu").then((eu) => terminar({ status: "dentro", eu }));
      return;
    }
    if (!temServico()) {
      terminar({ status: "fora" });
      return;
    }
    const s = supabase();
    s.auth.getSession().then(({ data }) => {
      if (!data.session) return terminar({ status: "fora" });
      return rpc<Eu | null>("eu").then((eu) => terminar(eu ? { status: "dentro", eu } : { status: "fora" }));
    }).catch(() => terminar({ status: "fora" }));
    const { data: ouvinte } = s.auth.onAuthStateChange(() => setVolta((v) => v + 1));
    return () => {
      cancelado = true;
      ouvinte.subscription.unsubscribe();
    };
  }, [volta]);
  return { ...estado, recarregar: useCallback(() => setVolta((v) => v + 1), []) };
}

export async function sair() {
  if (modoDemo()) {
    ligarDemo(false);
    window.location.reload();
    return;
  }
  try {
    await supabase().auth.signOut();
  } finally {
    gravar(CHAVES.sessao, "");
  }
}

export const dono = (eu: Eu | null) => eu?.papel === "dono";
export const analista = (eu: Eu | null) => eu?.papel === "dono" || eu?.papel === "analista";

/** Carrega dados de uma função e devolve um jeito de recarregar. Recarrega sozinho a cada minuto. */
export function useDados<T>(fn: string, args: Record<string, unknown> = {}, intervalo = 60_000) {
  const [estado, setEstado] = useState<{ dados: T | null; erro: string; carregando: boolean }>({ dados: null, erro: "", carregando: true });
  const [volta, setVolta] = useState(0);
  const chave = JSON.stringify(args);
  useEffect(() => {
    let cancelado = false;
    setEstado((e) => ({ ...e, carregando: true }));
    rpc<T>(fn, JSON.parse(chave) as Record<string, unknown>)
      .then((dados) => {
        if (!cancelado) setEstado({ dados, erro: "", carregando: false });
      })
      .catch((erro: unknown) => {
        if (!cancelado) setEstado((e) => ({ dados: e.dados, erro: textoDoErro(erro), carregando: false }));
      });
    const relogio = intervalo > 0 ? setInterval(() => setVolta((v) => v + 1), intervalo) : undefined;
    const aoMudar = () => setVolta((v) => v + 1);
    window.addEventListener("sentinela-mudou", aoMudar);
    return () => {
      cancelado = true;
      if (relogio) clearInterval(relogio);
      window.removeEventListener("sentinela-mudou", aoMudar);
    };
  }, [fn, chave, volta, intervalo]);
  return { ...estado, recarregar: useCallback(() => setVolta((v) => v + 1), []) };
}

/** Avisa todas as telas para recarregar (depois de uma ação, ou quando o coletor avisa que coletou). */
export const avisarMudanca = () => window.dispatchEvent(new Event("sentinela-mudou"));

const erros: Record<string, string> = {
  entre_primeiro: "Entre na sua conta para continuar.",
  sem_permissao: "Você não tem permissão para isso.",
  confirme_segundo_fator: "Confirme o código do aplicativo autenticador.",
  muitos_pedidos: "Muitos pedidos em pouco tempo. Tente de novo mais tarde.",
  nao_encontrado: "Não encontrado.",
  ja_decidida: "Esta ação já foi decidida.",
  outra_pessoa_confirma: "Quem propôs não pode confirmar: outra pessoa da equipe precisa confirmar.",
  limite_contas: "O painel aceita até cinco contas ativas.",
  ultimo_dono: "O painel precisa de pelo menos um dono.",
  nao_a_si_mesmo: "Isso não se faz na própria conta.",
  segredo_nao_cabe_aqui: "Isso parece um segredo. Tokens ficam só nos segredos do coletor, nunca aqui.",
  convite_invalido: "Este convite não vale mais.",
  sem_servico: "O app ainda não foi ligado a um serviço.",
  sem_coletor: "O endereço do coletor não foi configurado.",
  falha: "Algo deu errado. Tente de novo.",
};
export function textoDoErro(erro: unknown): string {
  const codigo = erro instanceof ErroDoServico ? erro.codigo : "falha";
  const [tipo, qual] = codigo.split(":");
  if (tipo === "invalido") return `Confira o campo: ${qual}.`;
  return erros[tipo] ?? erros.falha;
}
