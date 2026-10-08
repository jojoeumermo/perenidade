// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
"use client";

import { useCallback, useEffect, useState } from "react";
import { BackendError, rpc, type Role } from "@/lib/backend";

// O painel é a mesa de trabalho da equipe e existe só em português.

export const campo = "mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2";
export const botao = "cursor-pointer bg-ink px-5 py-2.5 font-medium text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50";
export const botaoClaro = "cursor-pointer border-2 border-ink px-5 py-2 font-medium hover:border-oxblood hover:text-oxblood disabled:cursor-not-allowed disabled:opacity-50";
export const elo = "cursor-pointer underline hover:text-oxblood";
export const rotulo = "font-mono text-xs uppercase tracking-widest text-gold";

export const papeis: Record<Role["papel"], string> = {
  coordenacao: "Coordenação",
  curadoria: "Curadoria",
  educacao: "Educação",
  revisao: "Revisão",
  traducao: "Tradução",
  jornalismo: "Jornalismo",
};

export const situacoes: Record<string, string> = {
  pendente: "aguardando revisão",
  aprovada: "aprovada, vai ao ar na próxima publicação",
  recusada: "não aprovada",
  publicada: "no ar",
  resolvida: "resolvida",
  aceita: "aceita",
};

const erros: Record<string, string> = {
  entre_primeiro: "Entre na sua conta para continuar.",
  sem_permissao: "Você não tem permissão para isso.",
  muitos_pedidos: "Muitos pedidos em pouco tempo. Tente de novo mais tarde.",
  falta_fonte: "Cite pelo menos uma fonte.",
  conta_suspensa: "Esta conta está suspensa.",
  nao_encontrado: "Não encontrado.",
  ja_decidida: "Esta contribuição já foi decidida.",
  ja_pediu: "Você já fez esse pedido e ele está em análise.",
  ultima_coordenacao: "O instituto precisa de pelo menos uma pessoa na coordenação.",
  sem_conexao: "Sem conexão com o serviço.",
  falha: "Algo deu errado. Tente de novo.",
};

export function textoDoErro(erro: unknown): string {
  const codigo = erro instanceof BackendError ? erro.code : "falha";
  const [tipo, qual] = codigo.split(":");
  if (tipo === "invalido") return `Confira o campo: ${qual}.`;
  return erros[tipo] ?? erros.falha;
}

export const data = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

/** Carrega uma lista do serviço e devolve um jeito de recarregar. */
export function useLista<T>(funcao: string, argumentos: Record<string, unknown> = {}) {
  const [estado, setEstado] = useState<{ dados: T | null; erro: string }>({ dados: null, erro: "" });
  const [volta, setVolta] = useState(0);
  const chave = JSON.stringify(argumentos);

  useEffect(() => {
    let cancelado = false;
    rpc<T>(funcao, JSON.parse(chave) as Record<string, unknown>)
      .then((dados) => {
        if (!cancelado) setEstado({ dados, erro: "" });
      })
      .catch((erro: unknown) => {
        if (!cancelado) setEstado({ dados: null, erro: textoDoErro(erro) });
      });
    return () => {
      cancelado = true;
    };
  }, [funcao, chave, volta]);

  return { ...estado, recarregar: useCallback(() => setVolta((v) => v + 1), []) };
}

/** Executa uma ação e mostra o resultado em uma linha de aviso. */
export function useAcao(depois?: () => void) {
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  async function agir(funcao: string, argumentos: Record<string, unknown>, sucesso = "Feito.") {
    setOcupado(true);
    setAviso("");
    try {
      const resposta = await rpc<unknown>(funcao, argumentos);
      setAviso(sucesso);
      depois?.();
      return resposta;
    } catch (erro) {
      setAviso(textoDoErro(erro));
      return null;
    } finally {
      setOcupado(false);
    }
  }
  return { agir, aviso, setAviso, ocupado };
}

export function Aviso({ texto }: { texto: string }) {
  return (
    <p role="status" className="min-h-5 text-oxblood">
      {texto}
    </p>
  );
}
