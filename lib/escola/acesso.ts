// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Quem entra na Escola de Formação: a militância conferida NO BANCO (public.escola_eu, migração
// supabase/migracoes/2026-11-escola-formacao-base.sql). A porta (components/escola/PortaDaEscola.tsx) usa useEscola(); as
// telas leem as funções das outras frentes por lerDaEscola(), que trata "função ainda não existe no banco" como vazio.
//
// Nada daqui fica gravado no aparelho: a resposta mora só na memória desta aba (ser militante revela opinião política, e
// o aparelho pode ser dividido). Trocar de conta ou sair zera a memória (a chave é a sessão guardada).
//
// Prévia SÓ em desenvolvimento (npx next dev): /pt/escola?previa=militante mostra a Escola com dados de exemplo, sem banco.
// Em produção, process.env.NODE_ENV é "production" e o bloco some do pacote (o import da prévia é dinâmico e fica de fora).

import { useEffect, useState } from "react";
import { BackendError, hasBackend, rpc } from "../backend";
import { KEYS, useHydrated, useStored } from "../storage";
import type { EscolaEu, EscolaEuDentro, FuncaoDaEscola, FuncoesDaEscola } from "./contratos";

export type EstadoDaEscola =
  | { estado: "conferindo" }
  | { estado: "sem-servico" }
  | { estado: "sem-conta" }
  | { estado: "sem-militancia" }
  | { estado: "falha"; motivo: string }
  | { estado: "militante"; eu: EscolaEuDentro };

const CHAVE_DA_PREVIA = "lucia-escola-previa";

/** A prévia de desenvolvimento está ligada nesta aba? Em produção, sempre false. */
export function emPrevia(): boolean {
  if (process.env.NODE_ENV !== "development") return false;
  try {
    const pedida = new URLSearchParams(location.search).get("previa");
    if (pedida === "militante") sessionStorage.setItem(CHAVE_DA_PREVIA, "1");
    if (pedida === "nao") sessionStorage.removeItem(CHAVE_DA_PREVIA);
    return sessionStorage.getItem(CHAVE_DA_PREVIA) === "1";
  } catch {
    return false;
  }
}

// A memória da aba: uma resposta por sessão guardada.
let memoria: { sessao: string; eu: EscolaEu } | null = null;
let pedido: { sessao: string; promessa: Promise<EscolaEu> } | null = null;

function perguntar(sessao: string): Promise<EscolaEu> {
  if (memoria?.sessao === sessao) return Promise.resolve(memoria.eu);
  if (pedido?.sessao === sessao) return pedido.promessa;
  const promessa = rpc<EscolaEu>("escola_eu").then((eu) => {
    const limpo: EscolaEu = eu && eu.militante === true ? eu : { militante: false, conta: Boolean(eu?.conta) };
    memoria = { sessao, eu: limpo };
    return limpo;
  });
  pedido = { sessao, promessa };
  promessa.catch(() => (pedido = null));
  return promessa;
}

/** Esquece a resposta (depois de sair, ou para conferir de novo). */
export function esquecerEscola() {
  memoria = null;
  pedido = null;
}

function estadoDe(eu: EscolaEu): EstadoDaEscola {
  if (eu.militante) return { estado: "militante", eu };
  return eu.conta ? { estado: "sem-militancia" } : { estado: "sem-conta" };
}

/**
 * Quem sou eu na Escola. No servidor e na hidratação: "conferindo" (o HTML é o mesmo para todo mundo). Sem sessão
 * guardada: "sem-conta" na hora, sem ir à rede. Com sessão: pergunta ao banco uma vez por aba.
 */
export function useEscola(): EstadoDaEscola & { conferirDeNovo: () => void } {
  const hidratado = useHydrated();
  const sessao = useStored(KEYS.session);
  const [vez, setVez] = useState(0);
  const [resposta, setResposta] = useState<{ chave: string; estado: EstadoDaEscola } | null>(null);
  const previa = hidratado && emPrevia();
  const chave = `${previa ? "previa" : sessao}#${vez}`;

  // Sem serviço ou sem sessão, a resposta sai na hora, sem ir à rede (e sem efeito).
  const imediato: EstadoDaEscola | null = !hidratado ? { estado: "conferindo" } : previa ? null : !hasBackend ? { estado: "sem-servico" } : !sessao ? { estado: "sem-conta" } : null;

  useEffect(() => {
    if (!hidratado || (!previa && (!hasBackend || !sessao))) return;
    let vivo = true;
    const definir = (estado: EstadoDaEscola) => vivo && setResposta({ chave, estado });
    if (previa) {
      import("./previa").then((m) => definir({ estado: "militante", eu: m.EU_DE_EXEMPLO }));
    } else {
      perguntar(sessao).then(
        (eu) => definir(estadoDe(eu)),
        (erro: unknown) => {
          const motivo = erro instanceof BackendError ? erro.code : "falha";
          // Banco sem a função (migração ainda não rodou) ou conta suspensa: a porta fica fechada, sem quebrar.
          // Sessão vencida ou inválida: quem perdeu a sessão volta à porta de quem ainda não entrou ("Já sou militante: entrar"),
          // e não lê que não é militante.
          if (motivo === "entre_primeiro") definir({ estado: "sem-conta" });
          else if (motivo === "banco_desatualizado" || motivo === "conta_suspensa") definir({ estado: "sem-militancia" });
          else definir({ estado: "falha", motivo });
        },
      );
    }
    return () => {
      vivo = false;
    };
  }, [hidratado, previa, sessao, chave]);

  const estado: EstadoDaEscola = imediato ?? (resposta?.chave === chave ? resposta.estado : { estado: "conferindo" });
  return {
    ...estado,
    conferirDeNovo: () => {
      esquecerEscola();
      setVez((v) => v + 1);
    },
  };
}

// ───────────────────────────── As funções das outras frentes ─────────────────────────────

export type LidoDaEscola<T> =
  | { ok: true; dados: T }
  /** "ausente": a função ainda não existe no banco (a frente dona ainda não foi instalada). A tela mostra o vazio honesto. */
  | { ok: false; motivo: "ausente" | "sem_permissao" | "sem_servico" | "falha" };

/** Chama uma função da Escola pelo contrato (lib/escola/contratos.ts). Nunca lança: devolve ok ou o motivo. */
export async function lerDaEscola<N extends FuncaoDaEscola>(nome: N, args?: FuncoesDaEscola[N]["args"]): Promise<LidoDaEscola<FuncoesDaEscola[N]["volta"]>> {
  if (emPrevia()) {
    const { exemploDe } = await import("./previa");
    const dados = exemploDe(nome);
    return dados === undefined ? { ok: false, motivo: "ausente" } : { ok: true, dados: dados as FuncoesDaEscola[N]["volta"] };
  }
  try {
    const dados = await rpc<FuncoesDaEscola[N]["volta"]>(nome, (args ?? {}) as Record<string, unknown>);
    return { ok: true, dados };
  } catch (erro) {
    const codigo = erro instanceof BackendError ? erro.code : "falha";
    if (codigo === "banco_desatualizado") return { ok: false, motivo: "ausente" };
    if (codigo === "sem_permissao" || codigo === "entre_primeiro") return { ok: false, motivo: "sem_permissao" };
    if (codigo === "sem_servico") return { ok: false, motivo: "sem_servico" };
    return { ok: false, motivo: "falha" };
  }
}

/** lerDaEscola num componente: null enquanto carrega. */
export function useDaEscola<N extends FuncaoDaEscola>(nome: N, args?: FuncoesDaEscola[N]["args"]): LidoDaEscola<FuncoesDaEscola[N]["volta"]> | null {
  const [lido, setLido] = useState<{ chave: string; valor: LidoDaEscola<FuncoesDaEscola[N]["volta"]> } | null>(null);
  const chave = `${nome}:${JSON.stringify(args ?? {})}`;
  useEffect(() => {
    let vivo = true;
    lerDaEscola(nome, JSON.parse(chave.slice(nome.length + 1)) as FuncoesDaEscola[N]["args"]).then((valor) => vivo && setLido({ chave, valor }));
    return () => {
      vivo = false;
    };
  }, [nome, chave]);
  return lido?.chave === chave ? lido.valor : null;
}
